import { NextResponse } from "next/server";
import axios from "axios";
import { getTicker, getKlines } from "../../../../lib/binance";
import { calculateIndicators } from "../../../../lib/indicators";
import { calculateSupportResistance } from "../../../../lib/supportResistance";
import { generateAnalysisReport } from "../../../../lib/openai";

export async function GET() {
  return triggerAlerts();
}

export async function POST() {
  return triggerAlerts();
}

async function triggerAlerts() {
  try {
    const lineToken = process.env.LINE_NOTIFY_TOKEN;
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;
    const symbolStr = process.env.ALERT_SYMBOLS || "BTC-USD,ETH-USD,SOL-USD";

    if (!lineToken && (!tgToken || !tgChatId)) {
      return NextResponse.json({
        success: false,
        message: "No alert channels (Line or Telegram) configured in environment variables.",
      });
    }

    const symbols = symbolStr.split(",").map((s) => s.trim().toUpperCase());
    const alertsSent: string[] = [];

    for (const symbol of symbols) {
      try {
        // 1. Fetch data
        const ticker = await getTicker(symbol);
        const klines = await getKlines(symbol, "1H", 200);

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

        // 4. Send alert if any trigger condition is met
        if (triggers.length > 0) {
          let message = "";
          
          if (process.env.OPENAI_API_KEY) {
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
            } catch (err: any) {
              console.error("OpenAI failed to generate alert text:", err.message);
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
          if (lineToken) {
            try {
              const params = new URLSearchParams();
              params.append("message", message);
              await axios.post("https://notify-api.line.me/api/notify", params, {
                headers: {
                  "Authorization": `Bearer ${lineToken}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                timeout: 8000,
              });
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
            } catch (err: any) {
              console.error(`Failed to send Telegram alert for ${symbol}:`, err.message);
            }
          }

          alertsSent.push(symbol);
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
