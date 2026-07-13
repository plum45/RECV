import { NextResponse } from "next/server";
import axios from "axios";
import { getTicker, getKlines } from "../../../../lib/binance";
import { calculateIndicators } from "../../../../lib/indicators";
import { calculateSupportResistance } from "../../../../lib/supportResistance";
import { getFirebaseAdminDb } from "../../../../lib/firebaseAdmin";
import { getTelegramBotToken } from "../../../../lib/telegramConfig";
import { calculateAlertOutcome, isWithinQuietHours, resolveSymbolAlertConfig } from "../../../../lib/alertUtils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return triggerAlerts(request);
}

export async function POST(request: Request) {
  return triggerAlerts(request);
}

async function triggerAlerts(request: Request) {
  try {
    const cronSecret = process.env.ALERT_CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
      }
    }

    const db = getFirebaseAdminDb();
    const activeSubscribers: any[] = [];

    // Load active subscribers from Firestore
    if (db) {
      try {
        const subsSnap = await db.collection("activeAlertSubscriptions").where("enabled", "==", true).get();
        subsSnap.forEach((doc) => {
          const data = doc.data();
          if (data.chatId && data.enabled) {
            activeSubscribers.push(data);
          }
        });
      } catch (err: any) {
        console.error("Failed to query activeAlertSubscriptions:", err.message);
      }
    }

    // Also support legacy/single-account env var fallback if configured
    const legacyTgToken = process.env.TELEGRAM_BOT_TOKEN;
    const legacyTgChatId = process.env.TELEGRAM_CHAT_ID;
    const legacyLineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const legacyLineUserId = process.env.LINE_USER_ID;

    if (activeSubscribers.length === 0 && (!legacyTgToken || !legacyTgChatId) && (!legacyLineToken || !legacyLineUserId)) {
      return NextResponse.json({
        success: true,
        message: "No active Telegram subscribers or legacy alert configuration found.",
        triggeredCount: 0,
      });
    }

    // Gather unique symbols across all subscribers plus legacy fallback symbols
    const defaultSymbols = (process.env.ALERT_SYMBOLS || "BTC-USD,ETH-USD,SOL-USD").split(",").map((s) => s.trim().toUpperCase());
    const symbolSet = new Set<string>();

    activeSubscribers.forEach((sub) => {
      const symbols = Array.isArray(sub.symbols) && sub.symbols.length > 0 ? sub.symbols : defaultSymbols;
      symbols.forEach((s: string) => symbolSet.add(s.toUpperCase()));
    });

    if (legacyTgChatId || legacyLineUserId) {
      defaultSymbols.forEach((s) => symbolSet.add(s));
    }

    const symbolsToScan = Array.from(symbolSet);
    const alertsSentCount: Record<string, number> = {};
    const symbolPrices: Record<string, number> = {};
    const now = Date.now();

    // Loop exactly ONCE per symbol
    for (const symbol of symbolsToScan) {
      try {
        const ticker = await getTicker(symbol);
        symbolPrices[symbol] = ticker.currentPrice;
        const isCrypto = symbol.toUpperCase().endsWith("-USD");
        const timeframe = isCrypto ? "4H" : "1D";
        const klines = await getKlines(symbol, timeframe, 450);

        const indicators = calculateIndicators(klines);
        const supportResistance = calculateSupportResistance(klines, indicators, ticker.currentPrice);
        const price = ticker.currentPrice;
        const { rsi14, macd } = indicators;

        // Evaluate S/R Flip Zone touch
        let touchedFlipZone = "";
        const allZones = [...supportResistance.supportZones, ...supportResistance.resistanceZones];
        const flipZones = allZones.filter((z) => z.reasons.some((r) => r.includes("S/R Flip")));

        for (const f of flipZones) {
          const [lowStr, highStr] = f.zone.replace(/,/g, "").split("-");
          const lowVal = parseFloat(lowStr);
          const highVal = parseFloat(highStr);
          if (!isNaN(lowVal) && !isNaN(highVal)) {
            const margin = price * 0.005; // 0.5% margin
            if (price >= lowVal - margin && price <= highVal + margin) {
              touchedFlipZone = `${f.type === "support" ? "แนวรับสำคัญ" : "แนวต้านสำคัญ"} $${f.zone} (${f.reasons.find((r) => r.includes("Flip"))})`;
              break;
            }
          }
        }

        // Evaluate Major Support proximity
        let touchedStrongSupport = "";
        const strongSupports = supportResistance.supportZones.filter((z) => z.score >= 3);
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
            if (distancePct <= threshold && distancePct >= brokenThreshold) {
              touchedStrongSupport = `ราคาเข้าใกล้แนวรับสำคัญ S1 ที่ $${closestSupport.zone} (ห่างเพียง ${distancePct >= 0 ? "+" : ""}${distancePct.toFixed(2)}%) [ความน่าเชื่อถือ: ${closestSupport.score}/10] (${timeframe} Timeframe)`;
            }
          }
        }

        // 1. Evaluate and send for Multi-User Telegram subscribers
        for (const sub of activeSubscribers) {
          const subSymbols = Array.isArray(sub.symbols) && sub.symbols.length > 0 ? sub.symbols : defaultSymbols;
          if (!subSymbols.includes(symbol)) continue;

          const uid = sub.uid;
          const chatId = sub.chatId;

          // Check Quiet Hours (GMT+7 timezone)
          if (isWithinQuietHours(sub.quietHours, new Date(now))) {
            console.log(`Skipping alert delivery for uid ${uid} due to Quiet Hours.`);
            continue;
          }

          // Per-symbol configs override
          const symbolConfig = resolveSymbolAlertConfig({
            rsiEnabled: sub.rsiEnabled !== false,
            macdEnabled: sub.macdEnabled !== false,
            srFlipEnabled: sub.srFlipEnabled !== false,
            supportEnabled: sub.supportEnabled !== false,
            configs: sub.configs || {},
          }, symbol);

          const cooldownMinutes = Math.max(15, typeof sub.cooldownMinutes === "number" ? sub.cooldownMinutes : 120);
          const cooldownMs = cooldownMinutes * 60 * 1000;

          // Fetch user's alert history & state lock for this symbol
          let stateData: any = {};
          let stateRef: any = null;
          if (db) {
            stateRef = db.collection("users").doc(uid).collection("alertHistory").doc(symbol);
            const stateDoc = await stateRef.get();
            stateData = stateDoc.exists ? stateDoc.data() : {};
          }

          const triggeredMessages: string[] = [];
          const newState: any = { ...stateData, updatedAt: now };

          // --- RSI Trigger ---
          if (symbolConfig.rsiEnabled) {
            if (rsi14 < 30) {
              if (stateData.rsiLock !== "oversold" && (!stateData.lastRsiAlertTime || now - stateData.lastRsiAlertTime > cooldownMs)) {
                triggeredMessages.push(`📊 RSI Oversold (${Math.round(rsi14)}) - สัญญาณขายมากเกินไป มีโอกาสปรับตัวหรือกลับตัวขึ้น`);
                newState.rsiLock = "oversold";
                newState.lastRsiAlertTime = now;
              }
            } else if (rsi14 > 70) {
              if (stateData.rsiLock !== "overbought" && (!stateData.lastRsiAlertTime || now - stateData.lastRsiAlertTime > cooldownMs)) {
                triggeredMessages.push(`📊 RSI Overbought (${Math.round(rsi14)}) - สัญญาณซื้อมากเกินไป มีโอกาสปรับฐานหรือย่อตัวลง`);
                newState.rsiLock = "overbought";
                newState.lastRsiAlertTime = now;
              }
            } else if (rsi14 >= 30 && rsi14 <= 70) {
              // Unlock RSI lock when back to normal zone
              newState.rsiLock = null;
            }
          }

          // --- MACD Crossover Trigger ---
          if (symbolConfig.macdEnabled) {
            if (macd.crossover === "bullish") {
              if (stateData.lastMacdCrossover !== "bullish" && (!stateData.lastMacdAlertTime || now - stateData.lastMacdAlertTime > cooldownMs)) {
                triggeredMessages.push(`🚀 MACD เกิดสัญญาณ Bullish Crossover (สัญญาณซื้อ/เปลี่ยนแนวโน้มเป็นขาขึ้น)`);
                newState.lastMacdCrossover = "bullish";
                newState.lastMacdAlertTime = now;
              }
            } else if (macd.crossover === "bearish") {
              if (stateData.lastMacdCrossover !== "bearish" && (!stateData.lastMacdAlertTime || now - stateData.lastMacdAlertTime > cooldownMs)) {
                triggeredMessages.push(`📉 MACD เกิดสัญญาณ Bearish Crossover (สัญญาณขาย/เปลี่ยนแนวโน้มเป็นขาลง)`);
                newState.lastMacdCrossover = "bearish";
                newState.lastMacdAlertTime = now;
              }
            }
          }

          // --- S/R Flip Zone Trigger ---
          if (symbolConfig.srFlipEnabled) {
            if (touchedFlipZone) {
              if (stateData.srFlipLock !== touchedFlipZone && (!stateData.lastSrFlipAlertTime || now - stateData.lastSrFlipAlertTime > cooldownMs)) {
                triggeredMessages.push(`🔄 ราคาเข้าใกล้โซนกลับบทบาท (S/R Flip): ${touchedFlipZone}`);
                newState.srFlipLock = touchedFlipZone;
                newState.lastSrFlipAlertTime = now;
              }
            } else {
              newState.srFlipLock = null;
            }
          }

          // --- Support Proximity Trigger ---
          if (symbolConfig.supportEnabled) {
            if (touchedStrongSupport) {
              if (stateData.supportLock !== touchedStrongSupport && (!stateData.lastSupportAlertTime || now - stateData.lastSupportAlertTime > cooldownMs)) {
                triggeredMessages.push(`🛡️ ${touchedStrongSupport}`);
                newState.supportLock = touchedStrongSupport;
                newState.lastSupportAlertTime = now;
              }
            } else {
              newState.supportLock = null;
            }
          }

          // Update state locks regardless of whether new alert fired (e.g. for unlock clearing)
          if (db && stateRef) {
            await stateRef.set(newState, { merge: true });
          }

          // Send Telegram message to user if trigger conditions fired
          if (triggeredMessages.length > 0) {
            const thaiAlertMsg =
              `🚨 [Rocket AI Alert: ${symbol}]\n` +
              `💰 ราคาปัจจุบัน: $${price.toLocaleString()} (${ticker.change24h >= 0 ? "+" : ""}${ticker.change24h.toFixed(2)}%)\n\n` +
              `📌 เงื่อนไขทางเทคนิคที่ตรวจพบในรอบสแกน:\n` +
              triggeredMessages.map((t) => `- ${t}`).join("\n") +
              `\n\n🎯 คำแนะนำ: กรุณาเปิดตรวจสอบกราฟและแผนการเทรดบนแดชบอร์ด Rocket AI เพื่อวางกรอบจุดเข้า (Entry) และจุดตัดขาดทุน (Stop Loss) อย่างรัดกุม\n\n` +
              `*หมายเหตุ: ข้อมูลนี้เป็นเพียงการวิเคราะห์ทางเทคนิคเบื้องต้น ไม่ใช่คำแนะนำในการลงทุนหรือชี้ชวนการซื้อขายแต่อย่างใด*`;

            const sent = await sendUserTelegramMessage(uid, chatId, thaiAlertMsg, db);
            if (sent) {
              alertsSentCount[symbol] = (alertsSentCount[symbol] || 0) + 1;
              if (db) {
                try {
                  await db.collection("users").doc(uid).collection("alertHistoryLogs").add({
                    symbol,
                    priceAtTrigger: price,
                    triggeredMessages,
                    sentAt: now,
                    outcome1h: null,
                    outcome24h: null,
                    status: "Pending"
                  });
                } catch (e: any) {
                  console.error(`Failed to write alertHistoryLog for uid ${uid}:`, e.message);
                }
              }
            }
          }
        }

        // 2. Evaluate and send for Legacy/Single-account environment variables if present
        if (legacyTgChatId && legacyTgToken && defaultSymbols.includes(symbol)) {
          const legacyTriggers: string[] = [];
          if (rsi14 < 30) legacyTriggers.push(`RSI Oversold (${Math.round(rsi14)})`);
          else if (rsi14 > 70) legacyTriggers.push(`RSI Overbought (${Math.round(rsi14)})`);
          if (macd.crossover === "bullish") legacyTriggers.push("MACD Bullish Crossover");
          else if (macd.crossover === "bearish") legacyTriggers.push("MACD Bearish Crossover");
          if (touchedFlipZone) legacyTriggers.push(`S/R Flip: ${touchedFlipZone}`);
          if (touchedStrongSupport) legacyTriggers.push(touchedStrongSupport);

          if (legacyTriggers.length > 0) {
            const msg = `🚨 [Rocket AI Alert: ${symbol}]\nราคา: $${price.toLocaleString()} (${ticker.change24h >= 0 ? "+" : ""}${ticker.change24h.toFixed(2)}%)\nเงื่อนไข:\n` +
                        legacyTriggers.map((t) => `- ${t}`).join("\n");
            try {
              await axios.post(`https://api.telegram.org/bot${legacyTgToken}/sendMessage`, {
                chat_id: legacyTgChatId,
                text: msg,
              }, { timeout: 8000 });
            } catch (e: any) {
              console.error(`Legacy Telegram alert failed for ${symbol}:`, e.message);
            }
          }
        }

      } catch (err: any) {
        console.error(`Error processing market scan for ${symbol}:`, err.message);
      }
    }

    // 3. Update pending outcomes after scanning is done
    if (db) {
      const oneHour = 60 * 60 * 1000;
      const twentyFourHours = 24 * 60 * 60 * 1000;

      for (const sub of activeSubscribers) {
        try {
          const logsSnap = await db.collection("users").doc(sub.uid).collection("alertHistoryLogs")
            .where("status", "==", "Pending")
            .get();

          for (const doc of logsSnap.docs) {
            const log = doc.data();
            const docRef = doc.ref;
            const elapsed = now - log.sentAt;
            const updates: any = {};

            let currentPrice = symbolPrices[log.symbol];
            if (!currentPrice) {
              try {
                const tk = await getTicker(log.symbol);
                currentPrice = tk.currentPrice;
                symbolPrices[log.symbol] = currentPrice;
              } catch (e) {
                // ignore
              }
            }

            if (currentPrice) {
              const pctChange = ((currentPrice - log.priceAtTrigger) / log.priceAtTrigger) * 100;

              if (!log.outcome1h && elapsed >= oneHour) {
                updates.outcome1h = {
                  price: currentPrice,
                  changePercent: pctChange,
                  result: pctChange >= 0.5 ? "Bullish 📈" : pctChange <= -0.5 ? "Bearish 📉" : "Neutral ➡️"
                };
              }

              if (!log.outcome24h && elapsed >= twentyFourHours) {
                updates.outcome24h = {
                  price: currentPrice,
                  changePercent: pctChange,
                  result: pctChange >= 1.5 ? "Bullish 📈" : pctChange <= -1.5 ? "Bearish 📉" : "Neutral ➡️"
                };
                updates.status = "Completed";
              } else if (elapsed >= oneHour && elapsed < twentyFourHours) {
                updates.status = "Pending";
              }

              if (updates.outcome1h) {
                updates.outcome1h = calculateAlertOutcome(log.priceAtTrigger, currentPrice, 0.5);
              }

              if (updates.outcome24h) {
                updates.outcome24h = calculateAlertOutcome(log.priceAtTrigger, currentPrice, 1.5);
              }

              if (Object.keys(updates).length > 0) {
                await docRef.update(updates);
              }
            }
          }
        } catch (e: any) {
          console.error(`Failed to update alert logs for user ${sub.uid}:`, e.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Completed multi-user alert scan across ${symbolsToScan.length} symbols.`,
      scannedSymbols: symbolsToScan,
      alertsDeliveredBySymbol: alertsSentCount,
    });
  } catch (error: any) {
    console.error("Alert trigger root error:", error.message);
    return NextResponse.json({ success: false, error: "Failed to execute alert triggers", message: error.message }, { status: 500 });
  }
}

async function sendUserTelegramMessage(uid: string, chatId: string, text: string, db: any): Promise<boolean> {
  const token = getTelegramBotToken();
  if (!token) return false;
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await axios.post(url, { chat_id: chatId, text }, { timeout: 8000 });
    return true;
  } catch (err: any) {
    const errMsg = err?.response?.data?.description || err.message;
    console.error(`Failed to deliver Telegram alert to uid ${uid} (${chatId}):`, errMsg);

    // Disable telegram for this user if bot is blocked or user deactivated
    if (typeof errMsg === "string" && (errMsg.includes("bot was blocked") || errMsg.includes("user is deactivated") || errMsg.includes("chat not found"))) {
      if (db) {
        try {
          await db.collection("users").doc(uid).collection("settings").doc("telegram").update({
            enabled: false,
            error: `Disabled due to Telegram delivery failure: ${errMsg}`,
          });
          await db.collection("activeAlertSubscriptions").doc(uid).delete().catch(() => {});
        } catch (e) {
          // ignore
        }
      }
    }
    return false;
  }
}
