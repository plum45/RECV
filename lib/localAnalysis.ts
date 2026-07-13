import { TickerData, IndicatorData, SupportResistanceData } from "../types/market";
import { NewsArticle } from "../types/news";
import { SentimentData } from "../types/analysis";

interface LocalAnalysisPayload {
  symbol: string;
  timeframe: string;
  tradingStyle: string;
  risk: string;
  marketData: TickerData;
  indicators: IndicatorData;
  supportResistance: SupportResistanceData;
  news: NewsArticle[];
  sentiment: SentimentData;
  klines?: any[];
}

const fmt = (num: number, decimals = 2): string => {
  if (isNaN(num) || !isFinite(num)) return "N/A";
  if (num >= 1000) return Math.round(num).toLocaleString();
  return num.toFixed(decimals);
};

const pct = (num: number): string => `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;

export function generateLocalReport(payload: LocalAnalysisPayload): string {
  const { symbol, timeframe, tradingStyle, risk, marketData, indicators, supportResistance, news, sentiment, klines } = payload;

  const price = marketData.currentPrice;
  const { ema20, ema50, ema200, rsi14, macd, atr14, pivot, volumeAnalysis,
    bollingerBands, adx, stochasticRSI, fibonacci, vwap, marketStructure } = indicators;
  const { supportZones, resistanceZones } = supportResistance;
  const fib = fibonacci;
  const bb  = bollingerBands;
  const ms  = marketStructure;

  // ── MARKET BIAS (multi-factor) ──────────────────────────────────────────
  let bullPoints = 0, bearPoints = 0;

  // EMA stack
  if (price > ema20) bullPoints += 2; else bearPoints += 2;
  if (price > ema50) bullPoints += 2; else bearPoints += 2;
  if (ema200 > 0 && price > ema200) bullPoints += 3; else if (ema200 > 0) bearPoints += 3;
  if (ema20 > ema50) bullPoints += 1; else bearPoints += 1;

  // RSI
  if (rsi14 > 55) bullPoints += 2;
  else if (rsi14 < 45) bearPoints += 2;

  // MACD
  if (macd.histogram > 0) bullPoints += 2; else bearPoints += 2;
  if (macd.crossover === "bullish") bullPoints += 3;
  else if (macd.crossover === "bearish") bearPoints += 3;

  // ADX direction
  if (adx.direction === "up" && adx.trending) bullPoints += 3;
  else if (adx.direction === "down" && adx.trending) bearPoints += 3;

  // Market structure
  if (ms.type === "uptrend") bullPoints += 3;
  else if (ms.type === "downtrend") bearPoints += 3;
  if (ms.breakOfStructure === "bullish_bos") bullPoints += 4;
  else if (ms.breakOfStructure === "bearish_bos") bearPoints += 4;

  // VWAP
  if (price > vwap) bullPoints += 1; else bearPoints += 1;

  // Bollinger
  if (bb.percentB > 0.6) bullPoints += 1; else if (bb.percentB < 0.4) bearPoints += 1;

  // StochRSI
  if (stochasticRSI.k > stochasticRSI.d && !stochasticRSI.overbought) bullPoints += 1;
  else if (stochasticRSI.k < stochasticRSI.d && !stochasticRSI.oversold) bearPoints += 1;

  // OBV trend
  if (volumeAnalysis.obvTrend === "rising") bullPoints += 2;
  else if (volumeAnalysis.obvTrend === "falling") bearPoints += 2;

  const totalPoints = bullPoints + bearPoints;
  const bullPct = totalPoints > 0 ? (bullPoints / totalPoints) * 100 : 50;

  type Bias = "Strong Bullish" | "Bullish" | "Neutral / Sideway" | "Bearish" | "Strong Bearish";
  const bias: Bias =
    bullPct >= 70 ? "Strong Bullish" :
    bullPct >= 55 ? "Bullish" :
    bullPct >= 45 ? "Neutral / Sideway" :
    bullPct >= 30 ? "Bearish" :
    "Strong Bearish";

  const biasEmoji = { "Strong Bullish": "🟢🟢", Bullish: "🟢", "Neutral / Sideway": "🟡", Bearish: "🔴", "Strong Bearish": "🔴🔴" }[bias];

  // ── FIBONACCI CONTEXT ───────────────────────────────────────────────────
  const fibLevels = [
    { label: "Fib 23.6%", price: fib.r236 },
    { label: "Fib 38.2%", price: fib.r382 },
    { label: "Fib 50.0%", price: fib.r500 },
    { label: "Fib 61.8% (Golden)", price: fib.r618 },
    { label: "Fib 78.6%", price: fib.r786 },
  ];
  const nearestFib = fibLevels.reduce((closest, lv) =>
    Math.abs(lv.price - price) < Math.abs(closest.price - price) ? lv : closest
  );
  const distToFib = ((price - nearestFib.price) / nearestFib.price) * 100;
  const fibContext = `ราคาอยู่ใกล้ **${nearestFib.label}** ที่ $${fmt(nearestFib.price)} (ห่าง ${pct(distToFib)})`;

  // ── VWAP CONTEXT ────────────────────────────────────────────────────────
  const vwapDist = ((price - vwap) / vwap) * 100;
  const vwapContext = price > vwap
    ? `ราคาอยู่เหนือ VWAP ($${fmt(vwap)}) ที่ ${pct(vwapDist)} — นักลงทุนสถาบันส่วนใหญ่อยู่ในกำไร แรงขายยังน้อย`
    : `ราคาอยู่ต่ำกว่า VWAP ($${fmt(vwap)}) ที่ ${pct(vwapDist)} — สถาบันส่วนใหญ่ยังขาดทุน มีแรงขายค้างอยู่`;

  // ── BOLLINGER BAND CONTEXT ──────────────────────────────────────────────
  const bbContext = bb.squeeze
    ? `📉 Bollinger Squeeze ตรวจพบ: ความผันผวนอยู่ในระดับต่ำ เตรียมรับรอบ Breakout ที่รุนแรงในเร็วๆ นี้`
    : bb.percentB > 0.85
    ? `⚠️ ราคาใกล้แตะ Upper Band ($${fmt(bb.upper)}) — ความเสี่ยงพักตัวระยะสั้นสูงขึ้น`
    : bb.percentB < 0.15
    ? `⚠️ ราคาใกล้แตะ Lower Band ($${fmt(bb.lower)}) — โอกาสเด้งกลับทางเทคนิคเปิดกว้าง`
    : `ราคาอยู่ในโซนกลาง Bollinger Bands (%B: ${(bb.percentB * 100).toFixed(0)}%)`;

  // ── ADX CONTEXT ─────────────────────────────────────────────────────────
  const adxContext = adx.trending
    ? `ADX = ${adx.adx.toFixed(1)} (>${25}): **แนวโน้มกำลังวิ่งแรง** (+DI ${adx.plusDI.toFixed(1)} vs -DI ${adx.minusDI.toFixed(1)}) — ทิศทาง ${adx.direction === "up" ? "ขาขึ้น" : "ขาลง"} มีความน่าเชื่อถือสูง`
    : `ADX = ${adx.adx.toFixed(1)} (<25): ตลาดยังไม่มีแนวโน้มชัดเจน แนะนำระวังสัญญาณหลอก`;

  // ── MARKET STRUCTURE CONTEXT ────────────────────────────────────────────
  const bosText = ms.breakOfStructure === "bullish_bos"
    ? `\n🚨 **Bullish BOS (Break of Structure):** ราคาทะลุเหนือ Swing High ก่อนหน้า ($${fmt(ms.lastSwingHigh)}) — สัญญาณเปลี่ยนแนวโน้มขาขึ้น`
    : ms.breakOfStructure === "bearish_bos"
    ? `\n🚨 **Bearish BOS (Break of Structure):** ราคาหลุดต่ำกว่า Swing Low ก่อนหน้า ($${fmt(ms.lastSwingLow)}) — สัญญาณเปลี่ยนแนวโน้มขาลง`
    : "";

  const structureText = ms.type === "uptrend"
    ? `Higher Highs (${fmt(ms.lastSwingHigh)}) & Higher Lows (${fmt(ms.lastSwingLow)}) — โครงสร้างขาขึ้นยืนยัน`
    : ms.type === "downtrend"
    ? `Lower Highs (${fmt(ms.lastSwingHigh)}) & Lower Lows (${fmt(ms.lastSwingLow)}) — โครงสร้างขาลงยืนยัน`
    : `Sideways — ไม่มี HH/HL หรือ LH/LL ที่ชัดเจน กรอบ $${fmt(ms.lastSwingLow)} - $${fmt(ms.lastSwingHigh)}`;

  // ── SCORING ────────────────────────────────────────────────────────────
  const scoreTrend     = bias === "Strong Bullish" ? 20 : bias === "Bullish" ? 16 : bias === "Neutral / Sideway" ? 10 : bias === "Bearish" ? 6 : 2;
  const scoreStructure = ms.type === "uptrend" ? 14 : ms.type === "downtrend" ? 4 : 9;
  const scoreSR        = (supportZones.length + resistanceZones.length) >= 4 ? 14 : 9;
  const scoreMomentum  = rsi14 > 60 ? 13 : rsi14 < 40 ? 5 : 9;
  const scoreAdx       = adx.trending ? 9 : 5;
  const scoreVol       = volumeAnalysis.isVolumeSpike ? 8 : volumeAnalysis.obvTrend === "rising" ? 7 : 5;

  let scoreNews = 6;
  const posNews = news.filter((n) => n.sentiment === "positive").length;
  const negNews = news.filter((n) => n.sentiment === "negative").length;
  if (posNews > negNews) scoreNews = 9;
  else if (negNews > posNews) scoreNews = 3;

  const scoreSentiment = sentiment.overallSentiment === "Extreme Bullish" ? 5 :
    sentiment.overallSentiment === "Bullish" ? 4 :
    sentiment.overallSentiment === "Neutral" ? 3 : 2;

  const totalScore = scoreTrend + scoreStructure + scoreSR + scoreMomentum + scoreAdx + scoreVol + scoreNews + scoreSentiment;

  // ── ENTRY / SL / TP MATH ───────────────────────────────────────────────
  // Support / Resistance levels (from S/R engine or fibonacci fallback)
  const parseSRMid = (zone: string | undefined): number => {
    if (!zone) return 0;
    const parts = zone.replace(/,/g, "").split("-");
    if (parts.length === 2) return (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
    return 0;
  };

  const sup1 = parseSRMid(supportZones[0]?.zone)   || fib.r618 || price * 0.97;
  const sup2 = parseSRMid(supportZones[1]?.zone)    || fib.r786 || price * 0.94;
  const res1 = parseSRMid(resistanceZones[0]?.zone) || fib.r236 || price * 1.03;
  const res2 = parseSRMid(resistanceZones[1]?.zone) || fib.ext127 || price * 1.06;

  // Fibonacci as additional TP/entry reference
  const fibClosestSupport = [fib.r382, fib.r500, fib.r618, fib.r786]
    .filter((f) => f < price)
    .reduce((a, b) => (Math.abs(b - price) < Math.abs(a - price) ? b : a), fib.r618);
  const fibClosestRes = [fib.r236, fib.r0, fib.ext127]
    .filter((f) => f > price)
    .reduce((a, b) => (Math.abs(b - price) < Math.abs(a - price) ? b : a), fib.r236);

  // ATR-based SL buffer adjusted for Trading Style
  let slFactor = 1.5;
  if (tradingStyle === "day") {
    slFactor = 1.0;
  } else if (tradingStyle === "position") {
    slFactor = 2.5;
  }
  const slBuffer = atr14 * slFactor;

  // Long setup
  const longEntry  = sup1 > 0 ? sup1 : price;
  const longSL     = Math.max(sup2 * 0.995, longEntry - slBuffer);
  const longTP1    = res1 > longEntry ? res1 : price * 1.02;
  const longTP2    = res2 > res1 ? res2 : price * 1.05;
  const longTP3    = fib.ext161 > longTP2 ? fib.ext161 : longTP2 * 1.03;
  const longRR     = longEntry > longSL ? ((longTP2 - longEntry) / (longEntry - longSL)) : 0;

  // Short setup
  const shortEntry = res1 > 0 ? res1 : price;
  const shortSL    = shortEntry + slBuffer;
  const shortTP1   = sup1 < shortEntry ? sup1 : price * 0.98;
  const shortTP2   = sup2 < sup1 ? sup2 : price * 0.95;
  const shortTP3   = fib.r786 < shortTP2 ? fib.r786 : shortTP2 * 0.97;
  const shortRR    = shortSL > shortEntry ? ((shortEntry - shortTP2) / (shortSL - shortEntry)) : 0;

  // Position sizing
  const parsedRiskPct = parseFloat(risk.replace("%", "")) / 100;
  const refAccount    = 10000;
  const riskDollar    = refAccount * parsedRiskPct;
  const longRiskPU    = longEntry - longSL;
  const posSize       = longRiskPU > 0 ? (riskDollar / longRiskPU).toFixed(4) : "N/A";

  const styleName = tradingStyle === "day" ? "Day Trade" : tradingStyle === "position" ? "Position Trade" : "Swing Trade";
  const holdingDesc = 
    tradingStyle === "day" ? "นาทีถึงภายในวัน (Minutes to Intraday)" :
    tradingStyle === "position" ? "หลายสัปดาห์ถึงหลายเดือน (Weeks to Months)" :
    "หลายวันถึงหลายสัปดาห์ (3–20 วันโดยประมาณ)";

  // Warning alert if data is insufficient
  let warningAlert = "";
  if (!klines || klines.length < 150) {
    warningAlert = `\n> [!WARNING]\n> ข้อมูลแท่งเทียนประวัติศาสตร์มีจำนวนไม่เพียงพอ (${klines?.length || 0}/150) สำหรับสไตล์การเทรดแบบ ${styleName} สัญญาณการวิเคราะห์อาจไม่มีความเสถียรเพียงพอ โปรดใช้ความระมัดระวังสูงสุดในการเปิดออเดอร์\n`;
  }

  // ── GENERATE REPORT ────────────────────────────────────────────────────
  return `# 📊 Rocket AI · ${symbol} Analysis Report
${warningAlert}
> **คำชี้แจงสถานะ:** ระดับ "Long Setup" ในตารางวิเคราะห์ข้อมูลนี้ หมายถึง **มุมมองเชิงเทคนิคอลที่คาดว่าราคาของหลักทรัพย์จะปรับตัวสูงขึ้น (Bullish Outlook)** ไม่ได้มีความสัมพันธ์กับระยะเวลาหรือข้อกำหนดระยะการถือครองเปิดออเดอร์แต่อย่างใด

## ═══ 1. Market Overview ═══
| ฟิลด์ | ข้อมูล |
| :--- | :--- |
| Symbol | **${symbol}** · Timeframe: **${timeframe}** |
| Trading Style | **${styleName}** (ระยะถือครองโดยประมาณ: ${holdingDesc}) |
| ราคาปัจจุบัน | **$${fmt(price)}** |
| 24h Range | Low $${fmt(marketData.low24h)} → High $${fmt(marketData.high24h)} |
| 24h Change | ${pct(marketData.change24h)} |
| VWAP (50-bar) | $${fmt(vwap)} |
| อัปเดต | ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} |

---

## ═══ 2. Market Bias & Trend Direction ═══
**${biasEmoji} สัญญาณโดยรวม: ${bias}** (Bull Points: ${bullPoints} vs Bear Points: ${bearPoints})

${vwapContext}

**Market Structure:** ${structureText}${bosText}

**ADX Trend Strength:** ${adxContext}

**Fibonacci Context:** ${fibContext}

**Bollinger Bands:** ${bbContext}

---

## ═══ 3. Technical Indicators ═══
| Indicator | ค่า | สัญญาณ | ความหมาย |
| :--- | :--- | :--- | :--- |
| EMA 20 | $${fmt(ema20)} | ${price > ema20 ? "🟢 Bullish" : "🔴 Bearish"} | ราคา${price > ema20 ? "อยู่เหนือ" : "ต่ำกว่า"} EMA20 — แนวโน้มระยะสั้น |
| EMA 50 | $${fmt(ema50)} | ${price > ema50 ? "🟢 Bullish" : "🔴 Bearish"} | แนวรับ/ต้านระยะกลาง |
| EMA 200 | ${ema200 > 0 ? `$${fmt(ema200)}` : "N/A (ข้อมูลน้อย)"} | ${ema200 > 0 ? (price > ema200 ? "🟢 Bullish" : "🔴 Bearish") : "—"} | ภาพใหญ่ตลาดระยะยาว |
| RSI (14) | ${rsi14.toFixed(1)} | ${rsi14 > 70 ? "⚠️ Overbought" : rsi14 < 30 ? "⚠️ Oversold" : rsi14 > 55 ? "🟢 Bullish" : rsi14 < 45 ? "🔴 Bearish" : "🟡 Neutral"} | ${rsi14 > 70 ? "ซื้อมากเกินไป เสี่ยงพักตัว" : rsi14 < 30 ? "ขายมากเกินไป เสี่ยงเด้ง" : "โมเมนตัมปกติ"} |
| Stoch RSI K/D | ${stochasticRSI.k.toFixed(1)} / ${stochasticRSI.d.toFixed(1)} | ${stochasticRSI.overbought ? "⚠️ OB" : stochasticRSI.oversold ? "⚠️ OS" : stochasticRSI.k > stochasticRSI.d ? "🟢 Up" : "🔴 Down"} | Stoch RSI เร็วกว่า RSI ปกติ ช่วยจับจุดกลับตัว |
| MACD Hist | ${macd.histogram.toFixed(3)} | ${macd.histogram > 0 ? "🟢 Positive" : "🔴 Negative"} | ${macd.crossover !== "none" ? `⚡ **Fresh ${macd.crossover === "bullish" ? "Bullish" : "Bearish"} Crossover!**` : "ไม่มีการตัดกันใหม่"} |
| ADX | ${adx.adx.toFixed(1)} | ${adx.trending ? "✅ Trending" : "⚠️ Ranging"} | +DI ${adx.plusDI.toFixed(1)} vs -DI ${adx.minusDI.toFixed(1)} |
| Bollinger %B | ${(bb.percentB * 100).toFixed(1)}% | ${bb.squeeze ? "🔵 Squeeze" : bb.percentB > 0.8 ? "⚠️ Upper" : bb.percentB < 0.2 ? "⚠️ Lower" : "🟡 Mid"} | BW: ${(bb.bandwidth * 100).toFixed(2)}% ${bb.squeeze ? "— Squeeze Active!" : ""} |
| ATR (14) | ${atr14.toFixed(2)} | — | ความผันผวนต่อแท่ง ใช้ตั้ง SL: ×1.5 = $${fmt(atr14 * 1.5)} |
| OBV Trend | — | ${volumeAnalysis.obvTrend === "rising" ? "🟢 สะสม" : volumeAnalysis.obvTrend === "falling" ? "🔴 กระจาย" : "🟡 Flat"} | Volume สนับสนุน${volumeAnalysis.obvTrend === "rising" ? "ฝั่งซื้อ (Accumulation)" : volumeAnalysis.obvTrend === "falling" ? "ฝั่งขาย (Distribution)" : "ทั้งสองฝั่งเท่ากัน"} |
| Volume Ratio | ${volumeAnalysis.volumeRatio.toFixed(2)}x | ${volumeAnalysis.isVolumeSpike ? "🚀 Spike" : "📊 Normal"} | ${volumeAnalysis.isVolumeSpike ? "ปริมาณซื้อขายหนาแน่นผิดปกติ!" : "ปกติ"} เฉลี่ย 20 แท่ง: ${volumeAnalysis.avgVolume20.toLocaleString()} |

---

## ═══ 4. Fibonacci Retracement ═══
*(อ้างอิงจาก Swing High $${fmt(fib.swing_high)} → Swing Low $${fmt(fib.swing_low)} — 60 แท่งล่าสุด)*
| ระดับ | ราคา | ห่างจากราคาปัจจุบัน | สถานะ |
| :--- | :--- | :--- | :--- |
| 161.8% Extension | $${fmt(fib.ext161)} | ${pct(((fib.ext161 - price)/price)*100)} | 🎯 Target (Extension) |
| 127.2% Extension | $${fmt(fib.ext127)} | ${pct(((fib.ext127 - price)/price)*100)} | 🎯 Target (Extension) |
| **100% (Swing High)** | **$${fmt(fib.r0)}** | **${pct(((fib.r0 - price)/price)*100)}** | แนวต้านหลัก |
| **23.6%** | **$${fmt(fib.r236)}** | **${pct(((fib.r236 - price)/price)*100)}** | ${fib.r236 > price ? "แนวต้าน" : "แนวรับ"} |
| **38.2%** | **$${fmt(fib.r382)}** | **${pct(((fib.r382 - price)/price)*100)}** | ${fib.r382 > price ? "แนวต้าน" : "แนวรับ"} |
| **50.0%** | **$${fmt(fib.r500)}** | **${pct(((fib.r500 - price)/price)*100)}** | ${fib.r500 > price ? "แนวต้าน" : "แนวรับกลาง"} |
| **61.8% (Golden Ratio)** | **$${fmt(fib.r618)}** | **${pct(((fib.r618 - price)/price)*100)}** | ${fib.r618 > price ? "แนวต้าน" : "⭐ แนวรับทอง"} |
| **78.6%** | **$${fmt(fib.r786)}** | **${pct(((fib.r786 - price)/price)*100)}** | ${fib.r786 > price ? "แนวต้าน" : "แนวรับลึก"} |
| 0% (Swing Low) | $${fmt(fib.r100)} | ${pct(((fib.r100 - price)/price)*100)} | แนวรับสุดท้าย |

---

## ═══ 5. Pivot Points & S/R Zones ═══
**Pivot Point:** $${fmt(pivot.p)}
| Pivot Level | ราคา | ระยะห่าง |
| :--- | :--- | :--- |
| R3 | $${fmt(pivot.r3)} | ${pct(((pivot.r3-price)/price)*100)} |
| R2 | $${fmt(pivot.r2)} | ${pct(((pivot.r2-price)/price)*100)} |
| R1 | $${fmt(pivot.r1)} | ${pct(((pivot.r1-price)/price)*100)} |
| **P** | **$${fmt(pivot.p)}** | **${pct(((pivot.p-price)/price)*100)}** |
| S1 | $${fmt(pivot.s1)} | ${pct(((pivot.s1-price)/price)*100)} |
| S2 | $${fmt(pivot.s2)} | ${pct(((pivot.s2-price)/price)*100)} |
| S3 | $${fmt(pivot.s3)} | ${pct(((pivot.s3-price)/price)*100)} |

**โซนแนวรับ-แนวต้าน (Quantitative Engine):**
| โซน | ประเภท | คะแนน | เหตุผล |
| :--- | :--- | :--- | :--- |
${supportZones.map((z) => `| $${z.zone} | 🟢 Support | ${z.score}/10 | ${z.reasons.slice(0,2).join(" + ")} |`).join("\n")}
${resistanceZones.map((z) => `| $${z.zone} | 🔴 Resistance | ${z.score}/10 | ${z.reasons.slice(0,2).join(" + ")} |`).join("\n")}

---

## ═══ 6. Scenario Analysis ═══

### 🐂 Bullish Case
* **เงื่อนไข:** ราคาปิดแท่งยืนเหนือ $${fmt(res1)} + ADX > 25 + Volume Spike
* TP1: $${fmt(longTP1)} (Resistance 1)
* TP2: $${fmt(longTP2)} (Resistance 2 / Fib Ext)
* TP3: $${fmt(longTP3)} (Fib 161.8% Extension)
* **Invalidation:** ราคาหลุดต่ำกว่า $${fmt(Math.max(ema20, pivot.s1))}

### 🐻 Bearish Case
* **เงื่อนไข:** ราคาปิดแท่งหลุดต่ำกว่า $${fmt(sup1)} + OBV ลดลง + RSI < 45
* TP1: $${fmt(shortTP1)} (Support 1)
* TP2: $${fmt(shortTP2)} (Support 2 / Fib Level)
* TP3: $${fmt(shortTP3)} (Fib 78.6%)
* **Invalidation:** ราคาทะลุเหนือ $${fmt(Math.min(ema20 * 1.01, pivot.r1))}

### ↔️ Sideway Case
* กรอบ: $${fmt(sup1)} — $${fmt(res1)}
* ${bb.squeeze ? "⚡ Bollinger Squeeze กำลัง Build-Up: เตรียมรับ Breakout รุนแรง!" : "รอ Volume Spike ยืนยันทิศทาง Breakout"}
* เข้า Long ที่: $${fmt(sup1)} SL: $${fmt(sup2)}
* เข้า Short ที่: $${fmt(res1)} SL: $${fmt(res2)}

---

## ═══ 7. Trade Setup ═══

### 📈 Long Setup (${tradingStyle})
| ฟิลด์ | ราคา | หมายเหตุ |
| :--- | :--- | :--- |
| Entry | $${fmt(longEntry)} | แนวรับ S1 / Fib ${fmt(fibClosestSupport)} |
| Stop Loss | $${fmt(longSL)} | ATR ×1.5 ต่ำกว่า S2 |
| TP1 | $${fmt(longTP1)} | Resistance 1 |
| TP2 | $${fmt(longTP2)} | Resistance 2 / Fib Ext |
| TP3 | $${fmt(longTP3)} | Fib 161.8% Extension |
| **R:R Ratio** | **1:${longRR.toFixed(2)}** | ${longRR >= 2 ? "✅ ดี" : longRR >= 1.5 ? "🟡 พอใช้" : "⚠️ เสี่ยงสูง"} |
| Position Size | ~${posSize} หุ้น | อ้างอิงพอร์ต $10,000 · Risk ${risk} |

### 📉 Short Setup (${tradingStyle})
| ฟิลด์ | ราคา | หมายเหตุ |
| :--- | :--- | :--- |
| Entry | $${fmt(shortEntry)} | แนวต้าน R1 / Fib ${fmt(fibClosestRes)} |
| Stop Loss | $${fmt(shortSL)} | ATR ×1.5 เหนือ R1 |
| TP1 | $${fmt(shortTP1)} | Support 1 |
| TP2 | $${fmt(shortTP2)} | Support 2 |
| TP3 | $${fmt(shortTP3)} | Fib 78.6% |
| **R:R Ratio** | **1:${shortRR.toFixed(2)}** | ${shortRR >= 2 ? "✅ ดี" : shortRR >= 1.5 ? "🟡 พอใช้" : "⚠️ เสี่ยงสูง"} |

---

## ═══ 8. Rocket Score ═══
| หมวด | คะแนน | Max |
| :--- | :--- | :--- |
| Trend & Bias | ${scoreTrend} | 20 |
| Market Structure (HH/HL) | ${scoreStructure} | 15 |
| Support / Resistance | ${scoreSR} | 15 |
| RSI Momentum | ${scoreMomentum} | 15 |
| ADX Trend Strength | ${scoreAdx} | 10 |
| Volume & OBV | ${scoreVol} | 10 |
| News | ${scoreNews} | 10 |
| Sentiment | ${scoreSentiment} | 5 |
| **รวม** | **${totalScore}** | **100** |

---

## ═══ 9. สรุปภาษาคนทั่วไป ═══
ตลาด **${symbol}** ตอนนี้ชี้ทิศทาง **${bias}** โดยมีสัญญาณสนับสนุนจาก ${bullPoints > bearPoints ? "เส้น EMA เรียงตัวขาขึ้น" : "EMA กดดันราคาขาลง"} ADX ที่ ${adx.adx.toFixed(0)} ${adx.trending ? "(มีแนวโน้ม)" : "(ยังไม่มีแนวโน้มชัด)"} และ OBV ชี้ว่า Volume ${volumeAnalysis.obvTrend === "rising" ? "สะสมเพิ่มขึ้น" : volumeAnalysis.obvTrend === "falling" ? "กระจายออก" : "นิ่ง"}

แนวรับใกล้สุด: **$${fmt(sup1)}** (${supportZones[0]?.reasons[0] || "Fibonacci/Pivot"}) | แนวต้านใกล้สุด: **$${fmt(res1)}** (${resistanceZones[0]?.reasons[0] || "Fibonacci/Pivot"})

${macd.crossover !== "none" ? `⚡ **เพิ่งเกิด ${macd.crossover === "bullish" ? "Bullish" : "Bearish"} MACD Crossover** — สัญญาณพิเศษน่าสนใจ!` : ""}
${bb.squeeze ? "🔵 **Bollinger Squeeze กำลัง Build-Up** — เตรียมรับ Breakout รุนแรง!" : ""}
${ms.breakOfStructure !== "none" ? `🚨 **${ms.breakOfStructure === "bullish_bos" ? "Bullish" : "Bearish"} Break of Structure ตรวจพบ!**` : ""}

---

## ═══ 10. Risk Warning ═══
**⚠️ นี่ไม่ใช่คำแนะนำทางการเงิน ข้อมูลทั้งหมดเป็นเพียงการวิเคราะห์เชิงเทคนิค ใช้ Stop Loss เสมอ ไม่ควรเสี่ยงเงินทุนเกินกว่าที่รับได้**
`;
}
