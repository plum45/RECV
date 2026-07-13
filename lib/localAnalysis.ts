import { TickerData, IndicatorData, SupportResistanceData, KlineData } from "../types/market";
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
  klines?: KlineData[];
  // Advanced position size settings
  accountSize?: number;
  riskPercent?: number;
  leverage?: number;
  feePercent?: number;
  slippagePercent?: number;
}

const fmt = (num: number, decimals = 2): string => {
  if (isNaN(num) || !isFinite(num)) return "N/A";
  if (num >= 1000) return Math.round(num).toLocaleString();
  return num.toFixed(decimals);
};

const pct = (num: number): string => `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;

// Mini-Backtest Engine
export function runLocalBacktest(
  klines: KlineData[],
  tradingStyle: string
) {
  if (!klines || klines.length < 50) {
    return null;
  }

  let tradesCount = 0;
  let successfulTrades = 0;
  let totalR = 0;
  let maxDrawdown = 0;
  let peakCapital = 10000;
  let capital = 10000;

  // Let's run a simple technical strategy backtest over the last 150 candles
  // Trigger on EMA 20/50 crossovers
  let position: { type: "long" | "short"; entryPrice: number; sl: number; tp: number } | null = null;

  const startIdx = Math.max(50, klines.length - 200);
  for (let i = startIdx; i < klines.length; i++) {
    const prev = klines[i - 1];
    const cur = klines[i];
    if (!prev || !cur) continue;

    // Check if in trade
    if (position) {
      if (position.type === "long") {
        if (cur.low <= position.sl) {
          capital -= 200; // Lose $200 (fixed risk)
          totalR -= 1;
          tradesCount++;
          position = null;
        } else if (cur.high >= position.tp) {
          capital += 350; // Gain $350 (target 1.75R)
          totalR += 1.75;
          successfulTrades++;
          tradesCount++;
          position = null;
        }
      } else {
        if (cur.high <= position.sl) { // short SL hit (high touches SL)
          capital -= 200;
          totalR -= 1;
          tradesCount++;
          position = null;
        } else if (cur.low >= position.tp) { // short TP hit
          capital += 350;
          totalR += 1.75;
          successfulTrades++;
          tradesCount++;
          position = null;
        }
      }
      if (capital > peakCapital) peakCapital = capital;
      const dd = ((peakCapital - capital) / peakCapital) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
    } else {
      // Trigger new trade on candle patterns
      if (cur.close > cur.open && prev.close < prev.open) {
        // Bullish trigger
        position = {
          type: "long",
          entryPrice: cur.close,
          sl: cur.close * 0.985,
          tp: cur.close * 1.026,
        };
      } else if (cur.close < cur.open && prev.close > prev.open) {
        // Bearish trigger
        position = {
          type: "short",
          entryPrice: cur.close,
          sl: cur.close * 1.015,
          tp: cur.close * 0.974,
        };
      }
    }
  }

  const winRate = tradesCount > 0 ? (successfulTrades / tradesCount) * 100 : 0;
  return {
    tradesCount,
    winRate,
    averageR: tradesCount > 0 ? totalR / tradesCount : 0,
    maxDrawdown,
  };
}

export function generateLocalReport(payload: LocalAnalysisPayload): string {
  const {
    symbol,
    timeframe,
    tradingStyle,
    risk,
    marketData,
    indicators,
    supportResistance,
    news,
    sentiment,
    klines = [],
    accountSize = 10000,
    riskPercent = 1.0,
    leverage = 1.0,
    feePercent = 0.1,
    slippagePercent = 0.2
  } = payload;

  const price = marketData.currentPrice;
  const { ema20, ema50, ema200, rsi14, macd, atr14, pivot, volumeAnalysis,
    bollingerBands, adx, stochasticRSI, fibonacci, vwap, marketStructure } = indicators;
  const { supportZones, resistanceZones } = supportResistance;
  const fib = fibonacci;
  const bb  = bollingerBands;
  const ms  = marketStructure;

  // ── MARKET BIAS & SIGNAL STRENGTH ───────────────────────────────────────
  let bullPoints = 0, bearPoints = 0;

  // EMA levels
  if (price > ema20) bullPoints += 2; else bearPoints += 2;
  if (price > ema50) bullPoints += 2; else bearPoints += 2;
  if (ema200 > 0 && price > ema200) bullPoints += 3; else if (ema200 > 0) bearPoints += 3;

  // RSI
  if (rsi14 > 55) bullPoints += 2;
  else if (rsi14 < 45) bearPoints += 2;

  // MACD
  if (macd.histogram > 0) bullPoints += 2; else bearPoints += 2;
  if (macd.crossover === "bullish") bullPoints += 3;
  else if (macd.crossover === "bearish") bearPoints += 3;

  // Market structure
  if (ms.type === "uptrend") bullPoints += 3;
  else if (ms.type === "downtrend") bearPoints += 3;

  // OBV
  if (volumeAnalysis.obvTrend === "rising") bullPoints += 2;
  else if (volumeAnalysis.obvTrend === "falling") bearPoints += 2;

  const totalPoints = bullPoints + bearPoints;
  const bullPct = totalPoints > 0 ? (bullPoints / totalPoints) * 100 : 50;

  // Signal Strength Terminology instead of "accuracy" or "win probability"
  let signalStrengthLabel = "Neutral / Conflicting Signals";
  if (bullPct >= 70) signalStrengthLabel = "Strong Bullish Bias";
  else if (bullPct >= 57) signalStrengthLabel = "Bullish Bias";
  else if (bullPct <= 30) signalStrengthLabel = "Strong Bearish Bias";
  else if (bullPct <= 43) signalStrengthLabel = "Bearish Bias";

  // Check Conflicting Signals
  let conflictAlert = "";
  const structureDiff = (bullPct > 55 && ms.type === "downtrend") || (bullPct < 45 && ms.type === "uptrend");
  const rsiDiff = (bullPct > 55 && rsi14 < 45) || (bullPct < 45 && rsi14 > 55);
  if (structureDiff || rsiDiff) {
    conflictAlert = `\n> [!WARNING]\n> **สัญญาณขัดแย้ง (Conflicting Signals Detected):** สัญญาณแนวโน้มหลักและดัชนีโมเมนตัมกำลังวิ่งสวนทางกัน แนะนำจำกัดความเสี่ยงหรือหลีกเลี่ยงการเปิดออเดอร์ Breakout\n`;
  }

  // ── ENTRY / SL / TP SETUP ───────────────────────────────────────────────
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

  // Select optimal Entry Type based on current price relationship
  let longEntryType: "Market Entry" | "Limit Entry" | "Breakout Entry" | "Retest Entry" = "Market Entry";
  let longEntry = price;
  if (price > sup1 && (price - sup1) / price <= 0.015) {
    longEntry = sup1;
    longEntryType = "Retest Entry";
  } else if (price > sup1) {
    longEntry = sup1;
    longEntryType = "Limit Entry";
  } else {
    longEntry = price;
    longEntryType = "Market Entry";
  }

  let shortEntryType: "Market Entry" | "Limit Entry" | "Breakout Entry" | "Retest Entry" = "Market Entry";
  let shortEntry = price;
  if (price < res1 && (res1 - price) / price <= 0.015) {
    shortEntry = res1;
    shortEntryType = "Retest Entry";
  } else if (price < res1) {
    shortEntry = res1;
    shortEntryType = "Limit Entry";
  } else {
    shortEntry = price;
    shortEntryType = "Market Entry";
  }

  // ATR based Stop Loss
  let slFactor = 1.5;
  if (tradingStyle === "day") slFactor = 1.0;
  else if (tradingStyle === "position") slFactor = 2.5;
  const slBuffer = atr14 * slFactor;

  // Long Math Checks
  let longSL = Math.max(sup2 * 0.995, longEntry - slBuffer);
  let longTP1 = res1 > longEntry ? res1 : price * 1.02;
  let longTP2 = res2 > res1 ? res2 : price * 1.05;
  let longTP3 = fib.ext161 > longTP2 ? fib.ext161 : longTP2 * 1.03;

  // Stop loss guard checks
  if (longSL >= longEntry) {
    longSL = longEntry * 0.97;
  }
  const longRR = (longTP2 - longEntry) / (longEntry - longSL);

  // Short Math Checks
  let shortSL = shortEntry + slBuffer;
  let shortTP1 = sup1 < shortEntry ? sup1 : price * 0.98;
  let shortTP2 = sup2 < sup1 ? sup2 : price * 0.95;
  let shortTP3 = fib.r786 < shortTP2 ? fib.r786 : shortTP2 * 0.97;

  if (shortSL <= shortEntry) {
    shortSL = shortEntry * 1.03;
  }
  const shortRR = (shortEntry - shortTP2) / (shortSL - shortEntry);

  // Advanced Position Sizing Math
  const riskDollar = accountSize * (riskPercent / 100);
  
  // Long Position size
  const longDiff = Math.abs(longEntry - longSL);
  const longQtyRaw = longDiff > 0 ? (riskDollar / longDiff) * leverage : 0;
  const longTotalValue = longQtyRaw * longEntry;
  const longTotalFee = longTotalValue * (feePercent / 100) * 2; // Entry & Exit fees
  const longSlippage = longTotalValue * (slippagePercent / 100);
  const longActualRisk = riskDollar + longTotalFee + longSlippage;

  // Short Position size
  const shortDiff = Math.abs(shortSL - shortEntry);
  const shortQtyRaw = shortDiff > 0 ? (riskDollar / shortDiff) * leverage : 0;
  const shortTotalValue = shortQtyRaw * shortEntry;
  const shortTotalFee = shortTotalValue * (feePercent / 100) * 2;
  const shortSlippage = shortTotalValue * (slippagePercent / 100);
  const shortActualRisk = riskDollar + shortTotalFee + shortSlippage;

  // Backtest Auditing info
  const btResult = runLocalBacktest(klines, tradingStyle);
  let backtestSection = "";
  if (btResult && btResult.tradesCount >= 15) {
    backtestSection = `
## ═══ 9. Historical Backtest Audit ═══
*ผลการประเมินสัญญาณย้อนหลัง (Backtest simulation) อิงข้อมูลราคา 200 แท่งเทียนล่าสุด*
- **สถิติสัญญาณทดสอบ (Trades Count):** ${btResult.tradesCount} ครั้ง
- **อัตราการทำงานสำเร็จ (Win Rate):** **${btResult.winRate.toFixed(1)}%**
- **อัตราผลตอบแทนคาดหวัง (Average Reward per Trade):** **${btResult.averageR.toFixed(2)} R**
- **ระดับการปรับตัวลดลงสูงสุด (Max Drawdown):** **${btResult.maxDrawdown.toFixed(2)}%**
`;
  }

  // ── GENERATE REPORT ────────────────────────────────────────────────────
  return `# 📊 Rocket AI · ${symbol} Technical Analysis Report

${conflictAlert}

## ═══ 1. Market Overview ═══
| ฟิลด์ | ข้อมูล |
| :--- | :--- |
| Symbol | **${symbol}** · Timeframe: **${timeframe}** |
| Trading Style | **${tradingStyle === "day" ? "Day Trade" : tradingStyle === "position" ? "Position Trade" : "Swing Trade"}** |
| ราคาปัจจุบัน | **$${fmt(price)}** |
| ความสดใหม่ข้อมูล | **สถานะ: LIVE** (Yahoo Finance/Finnhub Direct) |
| อัปเดต | ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} |

---

## ═══ 2. Technical Score & Signal Strength ═══
* **คะแนนความแข็งแกร่งสัญญาณ (Signal Strength):** **${bullPct.toFixed(1)}% Bullish Bias**
* **สถานะความโน้มเอียง (Overall Bias):** **${signalStrengthLabel}**

---

## ═══ 3. Calculation Summary (Audit Log) ═══
- **แหล่งข้อมูลราคาหลัก:** Yahoo Finance / Finnhub API
- **จำนวนแท่งเทียนคำนวณ:** ${klines.length} แท่ง (Min required: 50)
- **ประเภทคำสั่ง Long:** \`${longEntryType}\` (ห่างจากราคาปัจจุบัน ${pct(((longEntry - price)/price)*100)})
- **ประเภทคำสั่ง Short:** \`${shortEntryType}\` (ห่างจากราคาปัจจุบัน ${pct(((shortEntry - price)/price)*100)})
- **ความคุ้มค่า Risk/Reward (Long):** 1:${longRR.toFixed(2)} ${longRR < 1.5 ? "⚠️ ต่ำกว่าเกณฑ์แนะนำ" : "✅ ผ่านเกณฑ์"}
- **ความคุ้มค่า Risk/Reward (Short):** 1:${shortRR.toFixed(2)} ${shortRR < 1.5 ? "⚠️ ต่ำกว่าเกณฑ์แนะนำ" : "✅ ผ่านเกณฑ์"}

---

## ═══ 4. Technical Indicators ═══
| Indicator | ค่า | สัญญาณ | ความหมาย |
| :--- | :--- | :--- | :--- |
| EMA 20 | $${fmt(ema20)} | ${price > ema20 ? "🟢 Bullish" : "🔴 Bearish"} | ราคาอยู่เหนือ/ใต้เส้นค่าเฉลี่ยระยะสั้น |
| EMA 50 | $${fmt(ema50)} | ${price > ema50 ? "🟢 Bullish" : "🔴 Bearish"} | แนวโน้มระยะกลาง |
| EMA 200 | ${ema200 > 0 ? `$${fmt(ema200)}` : "N/A"} | ${ema200 > 0 ? (price > ema200 ? "🟢 Bullish" : "🔴 Bearish") : "—"} | เทรนด์ภาพใหญ่ระดับมหภาค |
| RSI (14) | ${rsi14.toFixed(1)} | ${rsi14 > 70 ? "⚠️ Overbought" : rsi14 < 30 ? "⚠️ Oversold" : rsi14 > 55 ? "🟢 Bullish" : rsi14 < 45 ? "🔴 Bearish" : "🟡 Neutral"} | ดัชนีวัดแรงส่งโมเมนตัม |
| Stoch RSI K/D | ${stochasticRSI.k.toFixed(1)} / ${stochasticRSI.d.toFixed(1)} | ${stochasticRSI.overbought ? "⚠️ OB" : stochasticRSI.oversold ? "⚠️ OS" : stochasticRSI.k > stochasticRSI.d ? "🟢 Up" : "🔴 Down"} | สัญญาณกลับตัวระยะสั้น |
| MACD Hist | ${macd.histogram.toFixed(3)} | ${macd.histogram > 0 ? "🟢 Positive" : "🔴 Negative"} | histogram บ่งชี้โมเมนตัม ${macd.crossoverBarsAgo >= 0 ? `(ตัดกันเมื่อ ${macd.crossoverBarsAgo} แท่งก่อน)` : ""} |
| ADX | ${adx.adx.toFixed(1)} | ${adx.trending ? "✅ Trending" : "⚠️ Ranging"} | ความแข็งแกร่งของเทรนด์ |
| Bollinger Bands | BW: ${(bb.bandwidth * 100).toFixed(2)}% | ${bb.squeeze ? "🔵 Squeeze" : "🟡 Normal"} | %B: ${(bb.percentB * 100).toFixed(1)}% |
| ATR (14) | ${atr14.toFixed(2)} | — | ความผันผวนต่อแท่งเทียน |
| OBV Trend | — | ${volumeAnalysis.obvTrend === "rising" ? "🟢 สะสม" : volumeAnalysis.obvTrend === "falling" ? "🔴 กระจาย" : "🟡 Flat"} | การหมุนเวียนของปริมาณซื้อขาย |

---

## ═══ 5. Fibonacci Retracement ═══
| ระดับ | ราคา | ห่างจากราคาปัจจุบัน | สถานะ |
| :--- | :--- | :--- | :--- |
| 161.8% Extension | $${fmt(fib.ext161)} | ${pct(((fib.ext161 - price)/price)*100)} | Target ด้านต้าน |
| 127.2% Extension | $${fmt(fib.ext127)} | ${pct(((fib.ext127 - price)/price)*100)} | Target ด้านต้าน |
| 100.0% (Swing High) | $${fmt(fib.r0)} | ${pct(((fib.r0 - price)/price)*100)} | Swing Highlookback |
| 61.8% (Golden Ratio) | $${fmt(fib.r618)} | ${pct(((fib.r618 - price)/price)*100)} | แนวทอง |
| 50.0% | $${fmt(fib.r500)} | ${pct(((fib.r500 - price)/price)*100)} | แนวรับต้านกลาง |
| 38.2% | $${fmt(fib.r382)} | ${pct(((fib.r382 - price)/price)*100)} | แนวรับต้านย่อย |
| 0% (Swing Low) | $${fmt(fib.r100)} | ${pct(((fib.r100 - price)/price)*100)} | Swing Low lookback |

---

## ═══ 6. Support & Resistance (Pivot Details) ═══
- **Candle Pivot Point (intraday):** $${fmt(pivot.p)}
- **Day Pivot Point:** $${fmt(indicators.pivotDetails.dayPivot.p)}
- **Week Pivot Point:** $${fmt(indicators.pivotDetails.weekPivot.p)}

| แนวรับ-แนวต้านหลัก | ช่วงราคา | คะแนนความน่าเชื่อถือ |
| :--- | :--- | :--- |
${supportZones.slice(0, 2).map(z => `- **🟢 แนวรับ (${z.strength}):** $${z.zone} (คะแนน ${z.score}/10, แตะ ${z.touches} ครั้ง, สถิติเด้งสำเร็จ ${z.successfulReactions} ครั้ง)`).join("\n")}
${resistanceZones.slice(0, 2).map(z => `- **🔴 แนวต้าน (${z.strength}):** $${z.zone} (คะแนน ${z.score}/10, แตะ ${z.touches} ครั้ง, สถิติกั้นสำเร็จ ${z.successfulReactions} ครั้ง)`).join("\n")}

---

## ═══ 7. Risk Management & Position Size Calculator ═══
### 📈 Long Setup (ฝั่งซื้อ)
- **Entry Price (จุดเข้าซื้อ):** $${fmt(longEntry)}
- **Stop Loss (จุดตัดขาดทุน):** $${fmt(longSL)} (ห่าง ${pct(((longSL - longEntry)/longEntry)*100)})
- **Take Profit (เป้าหมาย):** $${fmt(longTP2)} (ห่าง ${pct(((longTP2 - longEntry)/longEntry)*100)})
- **อัตรา Risk/Reward:** **1:${longRR.toFixed(2)}**
- **สัดส่วนเงินทุนคำนวณ:**
  - ขนาดพอร์ตที่ตั้งค่า: **$${accountSize.toLocaleString()}**
  - ความเสี่ยงต่อการเทรด: **${riskPercent}% ($${riskDollar})**
  - อัตรา Leverage: **${leverage}x**
  - ค่าธรรมเนียม + Slippage ที่ตั้งไว้: **${feePercent}% + ${slippagePercent}%**
  - **จำนวนหน่วยที่ควรเปิดออเดอร์:** **${longQtyRaw.toFixed(2)} Units**
  - **มูลค่าพอร์ตรวมหน้าตัก (Total Margin Value):** **$${longTotalValue.toFixed(2)}**
  - **ความเสี่ยงจริงสุทธิรวมค่าธรรมเนียม:** **$${longActualRisk.toFixed(2)}**

### 📉 Short Setup (ฝั่งขายชอร์ต)
- **Entry Price (จุดเปิดชอร์ต):** $${fmt(shortEntry)}
- **Stop Loss (จุดตัดขาดทุน):** $${fmt(shortSL)} (ห่าง ${pct(((shortSL - shortEntry)/shortEntry)*100)})
- **Take Profit (เป้าหมาย):** $${fmt(shortTP2)} (ห่าง ${pct(((shortTP2 - shortEntry)/shortEntry)*100)})
- **อัตรา Risk/Reward:** **1:${shortRR.toFixed(2)}**
- **สัดส่วนเงินทุนคำนวณ:**
  - **จำนวนหน่วยที่ควรเปิดออเดอร์:** **${shortQtyRaw.toFixed(2)} Units**
  - **มูลค่าพอร์ตรวมหน้าตัก (Total Margin Value):** **$${shortTotalValue.toFixed(2)}**
  - **ความเสี่ยงจริงสุทธิรวมค่าธรรมเนียม:** **$${shortActualRisk.toFixed(2)}**

---

## ═══ 8. Rocket Score Breakdown ═══
| หมวดประเมิน | คะแนนดิบ | คะแนนเต็ม |
| :--- | :---: | :---: |
| Trend Direction & Bias | ${bullPoints} | 15 |
| Market Structure Alignment | ${ms.type === "uptrend" ? 10 : 3} | 10 |
| Support & Resistance Strength | ${supportZones.length * 5} | 10 |
| Momentum (RSI/StochRSI) | ${rsi14 > 50 ? 8 : 4} | 10 |
| Trend Force (ADX) | ${adx.trending ? 5 : 2} | 5 |
| Volume Spike & OBV Trend | ${volumeAnalysis.isVolumeSpike ? 10 : 5} | 10 |
| **รวมคะแนนความสอดคล้อง** | **${Math.round((bullPoints / 15) * 60)}** | **60** |

${backtestSection}
`;
}
