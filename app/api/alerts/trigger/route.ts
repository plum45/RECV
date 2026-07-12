import { NextResponse } from "next/server";
import axios from "axios";
import { getTicker, getKlines } from "../../../../lib/binance";
import { calculateIndicators } from "../../../../lib/indicators";
import { calculateSupportResistance } from "../../../../lib/supportResistance";
import { generateAnalysisReport } from "../../../../lib/openai";
import { checkRateLimit, getAiCache, setAiCache } from "../../../../lib/aiCache";

export async function GET(request: Request) {
  return triggerAlerts(request);
}

export async function POST(request: Request) {
  return triggerAlerts(request);
}

async function triggerAlerts(request: Request) {
  try {
    const clientIp = request.headers.get("x-forwarded-for") || "local-client";
    const rateCheck = checkRateLimit(`alerts:${clientIp}`, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ success: false, message: "Rate limit exceeded" }, { status: 429 });
    }

    const cronSecret = process.env.ALERT_CRON_SECRET;
    if (process.env.NODE_ENV === "production" && (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const lineUserId = process.env.LINE_USER_ID;
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;
    const symbolStr = process.env.ALERT_SYMBOLS || "BTC-USD,ETH-USD,SOL-USD";

    if ((!lineToken || !lineUserId) && (!tgToken || !tgChatId)) {
      return NextResponse.json({
        success: false,
        message: "No complete LINE or Telegram channel configuration was found.",
      });
    }

    const symbols = symbolStr.split(",").map((s) => s.trim().toUpperCase());
    const alertsSent: string[] = [];

    for (const symbol of symbols) {
      try {
        // 1. Fetch data
        const ticker = await getTicker(symbol);
        const isCrypto = symbol.toUpperCase().endsWith("-USD");
        const timeframe = isCrypto ? "4H" : "1D";
        const klines = await getKlines(symbol, timeframe, 450);

        // 2. Indicators & SR
        const indicators = calculateIndicators(klines);
        const supportResistance = calculateSupportResistance(
          klines,
          indicators,
          ticker.currentPrice
        );

        const price = ticker.currentPrice;
        const { rsi14, macd } = indicators;

        // 3. Evaluate triggers
        const triggers: string[] = [];

        // Condition A: RSI Extreme
        if (rsi14 < 30) {
          triggers.push(`RSI Oversold (${Math.round(rsi14)}) - สัญญาณขายมากเกินไป มีโอกาสกลับตัวขึ้น`);
        } else if (rsi14 > 70) {
          triggers.push(`RSI Overbought (${Math.round(rsi14)}) - สัญญาณซื้อมากเกินไป มีโอกาสปรับฐานลง`);
        }

        // Condition B: MACD Crossover
        if (macd.crossover === "bullish") {
          triggers.push("MACD เกิดสัญญาณ Bullish Crossover (สัญญาณซื้อ)");
        } else if (macd.crossover === "bearish") {
          triggers.push("MACD เกิดสัญญาณ Bearish Crossover (สัญญาณขาย)");
        }

        // Condition C: S/R Flip Zone Touch
        let touchedFlipZone = "";
        const allZones = [
          ...supportResistance.supportZones,
          ...supportResistance.resistanceZones,
        ];
        const flipZones = allZones.filter((z) =>
          z.reasons.some((r) => r.includes("S/R Flip"))
        );

        for (const f of flipZones) {
          const [lowStr, highStr] = f.zone.replace(/,/g, "").split("-");
          const lowVal = parseFloat(lowStr);
          const highVal = parseFloat(highStr);

          if (!isNaN(lowVal) && !isNaN(highVal)) {
            const margin = price * 0.005; // 0.5% margin
            if (price >= lowVal - margin && price <= highVal + margin) {
              touchedFlipZone = `${f.type === "support" ? "แนวรับสำคัญ" : "แนวต้านสำคัญ"} $${f.zone} (${f.reasons.find((r) => r.includes("Flip"))})`;
              triggers.push(`ราคาเข้าใกล้โซนกลับบทบาท (S/R Flip): ${touchedFlipZone}`);
              break;
            }
          }
        }

        // Condition D: Closest Strong Support Zone Proximity
        const strongSupports = supportResistance.supportZones.filter(z => z.score >= 3);
        const closestSupport = strongSupports.length > 0 ? strongSupports[0] : (supportResistance.supportZones[0] || null);
        if (closestSupport) {
          const [lowStr, highStr] = closestSupport.zone.replace(/,/g, "").split("-");
          const lowVal = parseFloat(lowStr);
          const highVal = parseFloat(highStr);
          const supportMid = !isNaN(lowVal) && !isNaN(highVal) ? (lowVal + highVal) / 2 : (parseFloat(closestSupport.zone.replace(/,/g, "")) || 0);

          if (supportMid > 0) {
            const distancePct = ((price - supportMid) / supportMid) * 100;
            const threshold = isCrypto ? 2.0 : 2.5;
            const brokenThreshold = isCrypto ? -0.75 : -1.0;
            // Trigger if within threshold of major support
            if (distancePct <= threshold && distancePct >= brokenThreshold) {
              triggers.push(`ราคาเข้าใกล้แนวรับสำคัญ S1 ที่ $${closestSupport.zone} (ห่างเพียง ${distancePct >= 0 ? "+" : ""}${distancePct.toFixed(2)}%) [ความน่าเชื่อถือ: ${closestSupport.score}/10] (${timeframe} Timeframe)`);
            }
          }
        }

        // 4. Send alert if any trigger condition is met
        if (triggers.length > 0) {
          let message = "";
          
          if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "your_openai_api_key") {
            const cacheKey = `alert:${symbol}`;
            const cachedAlert = getAiCache(cacheKey);

            if (cachedAlert) {
              message = cachedAlert;
            } else {
              try {
                const prompt = `
Generate a quick, urgent trading alert in Thai for ${symbol}.
Current Price: $${price.toLocaleString()} (${ticker.change24h >= 0 ? "+" : ""}${ticker.change24h.toFixed(2)}%)
Triggered Events:
${triggers.map((t) => `- ${t}`).join("\n")}
Closest S/R Zone details: ${touchedFlipZone || "No S/R Flip nearby, regular support/resistance zones exist"}

Format requirements:
- Start with: 🚨 [Rocket AI Alert: ${symbol}]
- List the current price.
- Clearly mention what indicators triggered the alert.
- Give a short, actionable recommendation (Long/Short entry or watch closely).
- Keep the entire message under 5 sentences. Absolutely no markdown other than emojis.
`;
                message = await generateAnalysisReport(prompt);
                setAiCache(cacheKey, message, 300); // Cache alert message for 5 minutes
              } catch (err: any) {
                console.error("OpenAI failed to generate alert text:", err.message);
              }
            }
          }

          // Fallback message if OpenAI is disabled or failed
          if (!message) {
            message = `🚨 [Rocket AI Alert: ${symbol}]\n` +
                      `ราคาปัจจุบัน: $${price.toLocaleString()} (${ticker.change24h >= 0 ? "+" : ""}${ticker.change24h.toFixed(2)}%)\n` +
                      `พบบทสัญญาณเทคนิคคัลสำคัญในกราฟ 1H:\n` +
                      triggers.map((t) => `- ${t}`).join("\n") +
                      `\nคำแนะนำ: กรุณาเปิดตรวจสอบแผนเทรดบนแดชบอร์ด Rocket AI เพื่อวางกรอบจุดเข้าและตัดขาดทุนที่เหมาะสม`;
          }

          // Send to Line Notify
          let delivered = false;
          if (lineToken && lineUserId) {
            try {
              await axios.post("https://api.line.me/v2/bot/message/push", {
                to: lineUserId,
                messages: [{ type: "text", text: message }],
              }, {
                headers: {
                  "Authorization": `Bearer ${lineToken}`,
                  "Content-Type": "application/json",
                },
                timeout: 8000,
              });
              delivered = true;
            } catch (err: any) {
              console.error(`Failed to send Line alert for ${symbol}:`, err.message);
            }
          }

          // Send to Telegram
          if (tgToken && tgChatId) {
            try {
              const url = `https://api.telegram.org/bot${tgToken}/sendMessage`;
              await axios.post(url, {
                chat_id: tgChatId,
                text: message,
              }, { timeout: 8000 });
              delivered = true;
            } catch (err: any) {
              console.error(`Failed to send Telegram alert for ${symbol}:`, err.message);
            }
          }

          if (delivered) alertsSent.push(symbol);
        }
      } catch (err: any) {
        console.error(`Error processing alert checks for ${symbol}:`, err.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Completed alert scan. Checked: ${symbols.join(", ")}. Alerts sent for: ${alertsSent.length > 0 ? alertsSent.join(", ") : "None"}`,
      triggeredSymbols: alertsSent,
    });
  } catch (error: any) {
    console.error("Alert trigger root error:", error.message);
    return NextResponse.json(
      { success: false, error: "Failed to execute alert triggers", message: error.message },
      { status: 500 }
    );
  }
}
