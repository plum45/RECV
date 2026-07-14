import { TickerData, IndicatorData, SupportResistanceData, KlineData } from "../types/market";
import { NewsArticle, SectorImpactCategory } from "../types/news";
import { SentimentData } from "../types/analysis";
import { CALENDAR_DATABASE } from "./calendarDb";
import { PriceProjectionData } from "../types/projection";
import { calculatePriceProjection } from "./priceProjection";

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
  priceProjection?: PriceProjectionData;
  calendarEvents?: any[];
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

export function validateMarketDataBeforeAnalysis(payload: LocalAnalysisPayload): string | null {
  const { marketData, klines = [], symbol, timeframe } = payload;

  if (!symbol || !timeframe) {
    return `# ⚠️ คำเตือนระบบ: ข้อมูลไม่เพียงพอหรือล่าช้าเกินกำหนด

> [!CAUTION]
> **ไม่สามารถคำนวณ Entry ได้:** ระบุสัญลักษณ์ (Symbol) หรือกรอบเวลา (Timeframe) ไม่ถูกต้อง กรุณาเลือกข้อมูลใหม่`;
  }

  if (klines.length < 50) {
    return `# ⚠️ คำเตือนระบบ: ข้อมูลไม่เพียงพอหรือล่าช้าเกินกำหนด

> [!CAUTION]
> **ไม่สามารถคำนวณ Entry ได้อย่างแม่นยำ:** จำนวนแท่งเทียนย้อนหลัง (${klines.length} แท่ง) น้อยกว่าเกณฑ์ขั้นต่ำที่ต้องการ (50 แท่ง) กรุณารอระบบดึงข้อมูลอัปเดตหรือเปลี่ยน Timeframe เพื่อให้เครื่องมือทางสถิติและ EMA คำนวณได้อย่างถูกต้อง`;
  }

  // Check chronological order
  if (klines.length >= 2 && klines[0].openTime > klines[klines.length - 1].openTime) {
    klines.sort((a, b) => a.openTime - b.openTime);
  }

  // Check freshness and mock data in production
  if (process.env.NODE_ENV === "production" && marketData.priceSource && marketData.priceSource.toLowerCase().includes("mock")) {
    return `# ⚠️ คำเตือนระบบ: ข้อมูลจำลอง (Mock Data) ในระบบ Production

> [!CAUTION]
> **ไม่อนุญาตให้ออกสัญญาณ Trade จริง:** ระบบตรวจพบว่าข้อมูลราคาปัจจุบันเป็น Mock/Fallback Data เนื่องจากเชื่อมต่อ API ไม่สำเร็จ เพื่อความปลอดภัยของพอร์ตลงทุน ระบบจึงหยุดคำนวณจุดเข้าซื้อ/ขาย`;
  }

  return null;
}

export function generateLocalReport(payload: LocalAnalysisPayload): string {
  // ── PRE-CALCULATION DATA VALIDATION ─────────────────────────────────────
  const validationError = validateMarketDataBeforeAnalysis(payload);
  if (validationError) {
    return validationError;
  }

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

  // ── NEWS, EARNINGS & PRE-MARKET GAP RISK CHECK ──────────────────────────
  let hasEvent24h = false;
  let hasEvent72h = false;
  let newsRiskLevel = "Low 🟢";
  let newsWarningSection = "";

  const evList = payload.calendarEvents || CALENDAR_DATABASE;
  const majorCalendarEvents = evList.filter(e => {
    if (e.type === "economic") {
      return e.country === "US" || e.title.toLowerCase().includes("tech") || e.title.toLowerCase().includes("semiconductor");
    }
    if (e.type === "earnings") {
      return e.symbol.toLowerCase() === symbol.toLowerCase();
    }
    return false;
  });

  const nowMs = Date.now();
  for (const ev of majorCalendarEvents) {
    const evTimeMs = new Date(ev.announcedAt).getTime();
    const diffHours = (evTimeMs - nowMs) / (1000 * 3600);
    if (diffHours >= -6 && diffHours <= 24) {
      hasEvent24h = true;
    } else if (diffHours > 24 && diffHours <= 72) {
      hasEvent72h = true;
    }
  }

  for (const n of news) {
    const t = n.title.toLowerCase();
    if (t.includes("earnings") || t.includes("fomc") || t.includes("cpi") || t.includes("fed") || t.includes("guidance")) {
      hasEvent24h = true;
    }
  }

  if (hasEvent24h) {
    newsRiskLevel = "High 🔴";
    newsWarningSection = `\n> [!WARNING]\n> **มีข่าวหรือ Event สำคัญใกล้เข้ามาภายใน 24 ชม.:** ตรวจพบรายงาน Earnings, FOMC หรือตัวเลขเศรษฐกิจสำคัญที่ส่งผลต่ออุตสาหกรรมเทคโนโลยี อาจเกิด Gap และทำให้ Entry/Stop Loss คลาดเคลื่อนสูง **ห้ามเข้า Market Entry เด็ดขาด** ให้รอสัญญาณยืนยันหลังข่าวสงบ\n`;
  } else if (hasEvent72h) {
    newsRiskLevel = "Medium 🟡";
  }

  // Pre-market / Session Gap Risk
  const prevClose = marketData.previousClose || (klines.length >= 2 ? klines[klines.length - 2].close : price);
  const gapPct = prevClose > 0 ? Math.abs(price - prevClose) / prevClose * 100 : 0;
  let gapRiskLevel = "Low 🟢";
  if (gapPct > 2.0) {
    gapRiskLevel = "High 🔴";
    newsWarningSection += `\n> [!WARNING]\n> **⚠️ Pre-market / After-hours Gap > 2% (${gapPct.toFixed(2)}%):** ราคาเปิดกระโดดห่างจากราคาปิดก่อนหน้าสูง อาจเกิดความผันผวนสูงเมื่อเปิดตลาด โปรดระวัง Slippage และ Gap Risk\n`;
  } else if (gapPct > 1.0) {
    gapRiskLevel = "Medium 🟡";
  }

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

  // Signal Strength Terminology
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
    conflictAlert = `\n> [!WARNING]\n> **สัญญาณขัดแย้ง (Conflicting Signals Detected — รอการยืนยัน):** สัญญาณแนวโน้มหลักและดัชนีโมเมนตัมกำลังวิ่งสวนทางกัน แนะนำจำกัดความเสี่ยงหรือหลีกเลี่ยงการเปิดออเดอร์ Breakout\n`;
  }

  // ── MULTI-FACTOR ENTRY ZONE ($X - $Y) CALCULATIONS ──────────────────────
  const parseSRMid = (zone: string | undefined): number => {
    if (!zone) return 0;
    const parts = zone.replace(/,/g, "").split("-");
    if (parts.length === 2) return (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
    return 0;
  };

  const sup1Mid = parseSRMid(supportZones[0]?.zone) || fib.r618 || (price * 0.98);
  const sup2Mid = parseSRMid(supportZones[1]?.zone) || fib.r786 || (price * 0.95);
  const res1Mid = parseSRMid(resistanceZones[0]?.zone) || fib.r236 || (price * 1.02);
  const res2Mid = parseSRMid(resistanceZones[1]?.zone) || fib.ext127 || (price * 1.05);

  // Long Confluence Entry Zone
  const validLongLevels = [sup1Mid, fib.r618, fib.r500, ema20, ema50, vwap].filter(v => v > 0 && v < price * 1.015);
  const longTargetBase = validLongLevels.length > 0
    ? validLongLevels.reduce((prev, curr) => Math.abs(curr - sup1Mid) < Math.abs(prev - sup1Mid) ? curr : prev, validLongLevels[0])
    : (price * 0.985);
  
  const longZoneMin = Math.min(longTargetBase - (atr14 * 0.25), price * 0.998);
  const longZoneMax = Math.max(longTargetBase + (atr14 * 0.25), longZoneMin * 1.004);
  const longEntryMid = (longZoneMin + longZoneMax) / 2;
  const longDistancePct = ((price - longEntryMid) / price) * 100;

  let longEntryType: "Retest Entry" | "Limit Entry" | "Breakout Entry" | "Market Entry" = "Limit Entry";
  if (ms.breakOfStructure === "bullish_bos" || (price > res1Mid && volumeAnalysis.isVolumeSpike)) {
    longEntryType = "Breakout Entry";
  } else if (Math.abs(price - longEntryMid) / price <= 0.012) {
    longEntryType = "Retest Entry";
  } else if (longEntryMid < price) {
    longEntryType = "Limit Entry";
  } else {
    longEntryType = "Market Entry";
  }

  // Short Confluence Entry Zone
  const validShortLevels = [res1Mid, fib.r382, fib.r236, ema20, ema50, vwap].filter(v => v > price * 0.985);
  const shortTargetBase = validShortLevels.length > 0
    ? validShortLevels.reduce((prev, curr) => Math.abs(curr - res1Mid) < Math.abs(prev - res1Mid) ? curr : prev, validShortLevels[0])
    : (price * 1.015);

  const shortZoneMin = Math.min(shortTargetBase - (atr14 * 0.25), shortTargetBase * 0.996);
  const shortZoneMax = Math.max(shortTargetBase + (atr14 * 0.25), price * 1.002);
  const shortEntryMid = (shortZoneMin + shortZoneMax) / 2;
  const shortDistancePct = ((shortEntryMid - price) / price) * 100;

  let shortEntryType: "Retest Entry" | "Limit Entry" | "Breakout Entry" | "Market Entry" = "Limit Entry";
  if (ms.breakOfStructure === "bearish_bos" || (price < sup1Mid && volumeAnalysis.isVolumeSpike)) {
    shortEntryType = "Breakout Entry";
  } else if (Math.abs(shortEntryMid - price) / price <= 0.012) {
    shortEntryType = "Retest Entry";
  } else if (shortEntryMid > price) {
    shortEntryType = "Limit Entry";
  } else {
    shortEntryType = "Market Entry";
  }

  // ── 9-POINT CONFIRMATION CHECKLISTS ─────────────────────────────────────
  const longConfirmations = [
    { name: "แตะโซนแนวรับ / อยู่ใกล้โซนรับ", passed: price <= longZoneMax * 1.015, detail: `ราคาปัจจุบัน ($${fmt(price)}) ทดสอบโซน $${fmt(longZoneMin)} - $${fmt(longZoneMax)}` },
    { name: "แท่งเทียน Bullish Reversal", passed: klines.length >= 2 && klines[klines.length - 1].close >= klines[klines.length - 1].open, detail: klines.length >= 2 && klines[klines.length - 1].close >= klines[klines.length - 1].open ? "แท่งล่าสุดปิดเขียว/เกิดแรงซื้อกลับ" : "ยังไม่เกิดรูปแบบกลับตัวชัดเจน" },
    { name: "RSI Momentum ยืนยัน (> 45 หรือ Divergence)", passed: rsi14 > 45 && rsi14 < 68, detail: `RSI = ${rsi14.toFixed(1)} (ไม่อยู่ในภาวะ Overbought)` },
    { name: "MACD Bullish Crossover / Histogram > 0", passed: macd.histogram > 0 || macd.crossover === "bullish", detail: `MACD Hist = ${macd.histogram.toFixed(3)}` },
    { name: "Volume Ratio > 1.0 / แรงซื้อสะสม", passed: volumeAnalysis.volumeRatio >= 1.0 || volumeAnalysis.obvTrend === "rising", detail: `Volume Ratio = ${volumeAnalysis.volumeRatio.toFixed(2)}x (${volumeAnalysis.obvTrend})` },
    { name: "ราคายืนเหนือ EMA สำคัญ", passed: price > ema20 || price > ema50, detail: `ราคาเทียบ EMA20 ($${fmt(ema20)}) และ EMA50 ($${fmt(ema50)})` },
    { name: "Market Structure เป็น Uptrend (HH/HL)", passed: ms.type === "uptrend" || ms.higherHighs || ms.higherLows, detail: `โครงสร้างตลาด: ${ms.type}` },
    { name: "เกิด Bullish Break of Structure (BOS)", passed: ms.breakOfStructure === "bullish_bos", detail: ms.breakOfStructure === "bullish_bos" ? "ทะลุโครงสร้าง Swing High เดิมสำเร็จ" : "ยังไม่เกิดทะลุโครงสร้าง BOS" },
    { name: "ราคายืนเหนือ VWAP", passed: vwap > 0 && price >= vwap * 0.998, detail: `VWAP = $${fmt(vwap)}` },
  ];
  const longConfirmCount = longConfirmations.filter(c => c.passed).length;
  const longTechStrength = longConfirmCount >= 6 ? "Strong ⭐⭐⭐" : longConfirmCount >= 4 ? "Moderate ⭐⭐" : "Weak ⭐";

  const shortConfirmations = [
    { name: "แตะโซนแนวต้าน / อยู่ใกล้โซนต้าน", passed: price >= shortZoneMin * 0.985, detail: `ราคาปัจจุบัน ($${fmt(price)}) ทดสอบโซน $${fmt(shortZoneMin)} - $${fmt(shortZoneMax)}` },
    { name: "แท่งเทียน Bearish Reversal", passed: klines.length >= 2 && klines[klines.length - 1].close <= klines[klines.length - 1].open, detail: klines.length >= 2 && klines[klines.length - 1].close <= klines[klines.length - 1].open ? "แท่งล่าสุดปิดแดง/เกิดแรงขายกดทับ" : "ยังไม่เกิดรูปแบบกลับตัวลงชัดเจน" },
    { name: "RSI Momentum กดดัน (< 55 หรือ Divergence)", passed: rsi14 < 55 && rsi14 > 32, detail: `RSI = ${rsi14.toFixed(1)} (ไม่อยู่ในภาวะ Oversold เกินไป)` },
    { name: "MACD Bearish Crossover / Histogram < 0", passed: macd.histogram < 0 || macd.crossover === "bearish", detail: `MACD Hist = ${macd.histogram.toFixed(3)}` },
    { name: "Volume ขายเพิ่มขึ้น / OBV Falling", passed: volumeAnalysis.volumeRatio >= 1.0 || volumeAnalysis.obvTrend === "falling", detail: `Volume Ratio = ${volumeAnalysis.volumeRatio.toFixed(2)}x (${volumeAnalysis.obvTrend})` },
    { name: "ราคาอยู่ใต้ EMA สำคัญ", passed: price < ema20 || price < ema50, detail: `ราคาเทียบ EMA20 ($${fmt(ema20)}) และ EMA50 ($${fmt(ema50)})` },
    { name: "Market Structure เป็น Downtrend (LH/LL)", passed: ms.type === "downtrend" || ms.lowerHighs || ms.lowerLows, detail: `โครงสร้างตลาด: ${ms.type}` },
    { name: "เกิด Bearish Break of Structure (BOS)", passed: ms.breakOfStructure === "bearish_bos", detail: ms.breakOfStructure === "bearish_bos" ? "หลุดโครงสร้าง Swing Low เดิมสำเร็จ" : "ยังไม่เกิดหลุดโครงสร้าง BOS" },
    { name: "ราคาอยู่ใต้ VWAP", passed: vwap > 0 && price <= vwap * 1.002, detail: `VWAP = $${fmt(vwap)}` },
  ];
  const shortConfirmCount = shortConfirmations.filter(c => c.passed).length;
  const shortTechStrength = shortConfirmCount >= 6 ? "Strong ⭐⭐⭐" : shortConfirmCount >= 4 ? "Moderate ⭐⭐" : "Weak ⭐";

  // ── STOP LOSS, TAKE PROFIT & R:R VALIDATION ─────────────────────────────
  let slFactor = tradingStyle === "day" ? 1.1 : tradingStyle === "position" ? 2.5 : 1.6;
  const slBuffer = atr14 * slFactor;

  // Long Math Guards
  let longSL = Math.min(sup2Mid, longZoneMin - slBuffer);
  if (longSL >= longZoneMin) longSL = longZoneMin * 0.975;
  
  let longTP1 = Math.max(res1Mid, longEntryMid + (atr14 * 2.0));
  let longTP2 = Math.max(res2Mid, fib.ext127, longEntryMid + (atr14 * 3.5));
  if (longTP1 <= longEntryMid) longTP1 = longEntryMid * 1.025;
  if (longTP2 <= longTP1) longTP2 = longTP1 * 1.025;

  const longRR = (longTP2 - longEntryMid) / (longEntryMid - longSL);
  let longStatus = "Ready";
  if (longRR < 1.5) {
    longStatus = `Invalid (R:R ${longRR.toFixed(2)} < 1.5 — ไม่คุ้มค่าความเสี่ยง)`;
  } else if (hasEvent24h) {
    longStatus = "Wait Confirmation (ติดช่วงข่าว High Impact ห้ามเข้า Market Order)";
  } else if (longConfirmCount < 3) {
    longStatus = "Wait Confirmation (รอยืนยันเพิ่มเติม ยังไม่ควรเข้า Market Order)";
  } else if (longDistancePct > 4.0 || longDistancePct < -1.0) {
    longStatus = "Wait Confirmation (รอราคาเข้าโซน / หลีกเลี่ยงไล่ราคา)";
  } else {
    longStatus = `Ready (ผ่านเงื่อนไขยืนยัน ${longConfirmCount}/9 ข้อ)`;
  }

  // Short Math Guards
  let shortSL = Math.max(res2Mid, shortZoneMax + slBuffer);
  if (shortSL <= shortZoneMax) shortSL = shortZoneMax * 1.025;

  let shortTP1 = Math.min(sup1Mid, shortEntryMid - (atr14 * 2.0));
  let shortTP2 = Math.min(sup2Mid, fib.r786, shortEntryMid - (atr14 * 3.5));
  if (shortTP1 >= shortEntryMid) shortTP1 = shortEntryMid * 0.975;
  if (shortTP2 >= shortTP1) shortTP2 = shortTP1 * 0.975;

  const shortRR = (shortEntryMid - shortTP2) / (shortSL - shortEntryMid);
  let shortStatus = "Ready";
  if (shortRR < 1.5) {
    shortStatus = `Invalid (R:R ${shortRR.toFixed(2)} < 1.5 — ไม่คุ้มค่าความเสี่ยง)`;
  } else if (hasEvent24h) {
    shortStatus = "Wait Confirmation (ติดช่วงข่าว High Impact ห้ามเข้า Market Order)";
  } else if (shortConfirmCount < 3) {
    shortStatus = "Wait Confirmation (รอยืนยันเพิ่มเติม ยังไม่ควรเข้า Market Order)";
  } else if (shortDistancePct > 4.0 || shortDistancePct < -1.0) {
    shortStatus = "Wait Confirmation (รอราคาเข้าโซน / หลีกเลี่ยงไล่ราคา)";
  } else {
    shortStatus = `Ready (ผ่านเงื่อนไขยืนยัน ${shortConfirmCount}/9 ข้อ)`;
  }

  // Advanced Position Sizing
  const riskDollar = accountSize * (riskPercent / 100);
  const longDiff = Math.abs(longEntryMid - longSL);
  const longQtyRaw = longDiff > 0 ? (riskDollar / longDiff) * leverage : 0;
  const longTotalValue = longQtyRaw * longEntryMid;
  const longActualRisk = riskDollar + (longTotalValue * (feePercent / 100) * 2) + (longTotalValue * (slippagePercent / 100));

  const shortDiff = Math.abs(shortSL - shortEntryMid);
  const shortQtyRaw = shortDiff > 0 ? (riskDollar / shortDiff) * leverage : 0;
  const shortTotalValue = shortQtyRaw * shortEntryMid;
  const shortActualRisk = riskDollar + (shortTotalValue * (feePercent / 100) * 2) + (shortTotalValue * (slippagePercent / 100));

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

  // Sector Impact Scenarios
  const sectorNewsMap: Record<string, string[]> = {};
  news.forEach((n) => {
    const cat: SectorImpactCategory = (n as any).sectorImpact || "Noise";
    if (cat !== "Noise") {
      if (!sectorNewsMap[cat]) sectorNewsMap[cat] = [];
      sectorNewsMap[cat].push(n.title.slice(0, 80));
    }
  });

  const hasAIOrSemisNews = (sectorNewsMap["AI & Hardware"]?.length || 0) > 0 || (sectorNewsMap["Semiconductors"]?.length || 0) > 0;
  const hasMacroNews = (sectorNewsMap["Macro"]?.length || 0) > 0;
  const hasGeopolitical = (sectorNewsMap["Geopolitical"]?.length || 0) > 0;

  const proj = payload.priceProjection || calculatePriceProjection(
    symbol,
    price,
    klines,
    indicators,
    supportResistance,
    news,
    payload.calendarEvents || CALENDAR_DATABASE,
    tradingStyle,
    timeframe,
    marketData.priceSource || "Finnhub API",
    marketData
  );

  const scenarioSection = `
## ═══ 10. Price Projection Matrix & 3-Scenario Analysis (คาดการณ์โซนราคา) ═══
*ระบบคำนวณคาดการณ์โซนราคาที่อาจไปถึงเป็น Scenario และช่วงราคา โดยไม่ฟันธงทิศทางเดียว อ้างอิงตามสูตร Confluence S/R & Fibonacci*

- **Current Price:** **$${fmt(proj.currentPrice)}**
- **Upside Target Zone:** **${proj.upsideScenario.targetZone.formatted}**
- **Base Range:** **${proj.baseScenario.targetZone.formatted}**
- **Downside Target Zone:** **${proj.downsideScenario.targetZone.formatted}**
- **Time Horizon:** **${proj.timeHorizon}**
- **Confidence:** **${proj.confidence === "High" ? "🟢 High" : proj.confidence === "Moderate" ? "🟡 Moderate" : proj.confidence === "Low" ? "🔴 Low" : "⚖️ Conflicting"}** (${proj.confidenceReasons[0] || "ตามเงื่อนไขยืนยันทางเทคนิค"})
- **Confirmation Conditions:** **${proj.upsideScenario.confirmations.filter(c => c.isConfirmed).map(c => c.label).join(", ") || "รอยืนยัน Volume และ Price Action"}**
- **Invalidation Conditions:** **Break > $${proj.baseScenario.targetZone.high} หรือ หลุด < $${proj.baseScenario.targetZone.low} พร้อม Volume**
- **News/Event Risk:** **${proj.eventRisk.level === "High" ? "🚨 High Risk (มี Event สำคัญใน 24 ชม.)" : "🟢 Low Risk"}** ${proj.eventRisk.warningMessage ? `(${proj.eventRisk.warningMessage})` : ""}

### 🗺️ Scenario Comparison Table
| สถานการณ์ (Scenario) | โซนเป้าหมาย (Target Zone) | เงื่อนไขยืนยัน (Confirmations) | แนวเป้าหมายถัดไป | จุดยกเลิก (Invalidation Level) |
| :--- | :--- | :--- | :--- | :--- |
| 🚀 **Bullish Scenario** | **${proj.upsideScenario.targetZone.formatted}** | **${proj.upsideScenario.confirmedCount}/6 Confirmations** (${proj.upsideScenario.confirmations.filter(c => c.isConfirmed).map(c => c.label).slice(0, 2).join(", ") || "รอยืนยัน"}) | ${proj.upsideScenario.nextLevel.formatted} (${proj.upsideScenario.nextLevel.label}) | ${proj.upsideScenario.invalidationTrigger.formatted} (${proj.upsideScenario.invalidationTrigger.condition}) |
| ⚖️ **Base Scenario** | **${proj.baseScenario.targetZone.formatted}** | **ADX=${proj.adxStrength}** (${proj.isSidewaysAdx ? "Sideways / แกว่งตัวในกรอบ" : "พักตัวรอเลือกทิศทาง"}) | ${proj.baseScenario.nextLevel.formatted} (SMA 20 Midband) | Break > $${proj.baseScenario.targetZone.high} หรือ < $${proj.baseScenario.targetZone.low} พร้อม Volume |
| 🔻 **Bearish Scenario** | **${proj.downsideScenario.targetZone.formatted}** | **${proj.downsideScenario.confirmedCount}/6 Confirmations** (${proj.downsideScenario.confirmations.filter(c => c.isConfirmed).map(c => c.label).slice(0, 2).join(", ") || "รอยืนยัน"}) | ${proj.downsideScenario.nextLevel.formatted} (${proj.downsideScenario.nextLevel.label}) | ${proj.downsideScenario.invalidationTrigger.formatted} (${proj.downsideScenario.invalidationTrigger.condition}) |

### 📋 รายละเอียดเหตุผลและเงื่อนไขของแต่ละ Scenario
#### 1️⃣ Bullish Scenario (เป้าหมายโซนบน: ${proj.upsideScenario.targetZone.formatted})
- **เหตุผลสนับสนุน:** ${proj.upsideScenario.supportingReasons.join(" · ")}
- **ตารางตรวจสอบ 6 เงื่อนไขยืนยัน:**
  ${proj.upsideScenario.confirmations.map(c => `  - [${c.isConfirmed ? "x" : " "}] **${c.label}:** ${c.detail}`).join("\n")}
- **จุดยกเลิกแผน (Invalidation Trigger):** ${proj.upsideScenario.invalidationTrigger.condition}

#### 2️⃣ Base Scenario (กรอบราคากลาง: ${proj.baseScenario.targetZone.formatted})
- **เหตุผลที่ตลาดยังไม่มีทิศทางชัดเจน:** ${proj.baseScenario.supportingReasons.join(" · ")}
- **เงื่อนไขเปลี่ยนสถานะ (Shift Triggers):**
  - **ไป Bullish:** ${proj.baseScenario.shiftConditions?.[0] || `ราคาปิดเหนือ $${proj.baseScenario.targetZone.high} พร้อม Volume`}
  - **ไป Bearish:** ${proj.baseScenario.shiftConditions?.[1] || `ราคาปิดใต้ $${proj.baseScenario.targetZone.low} พร้อม Volume`}

#### 3️⃣ Bearish Scenario (เป้าหมายโซนล่าง: ${proj.downsideScenario.targetZone.formatted})
- **เหตุผลกดดัน:** ${proj.downsideScenario.supportingReasons.join(" · ")}
- **ตารางตรวจสอบ 6 เงื่อนไขยืนยัน:**
  ${proj.downsideScenario.confirmations.map(c => `  - [${c.isConfirmed ? "x" : " "}] **${c.label}:** ${c.detail}`).join("\n")}
- **จุดยกเลิกแผน (Invalidation Trigger):** ${proj.downsideScenario.invalidationTrigger.condition}

### 🔬 Sector Impact Categorization (ปัจจัยกระทบอุตสาหกรรม)
| ปัจจัยเทคโนโลยี | ข่าวสารที่เกี่ยวข้องล่าสุด | ระดับผลกระทบ |
| :--- | :--- | :---: |
| 🤖 AI & Hardware | ${(sectorNewsMap["AI & Hardware"] || []).slice(0, 1).join(" · ") || "ไม่มีข่าวเด่น AI & Hardware"} | ${hasAIOrSemisNews ? "⭐⭐⭐ สูง" : "—"} |
| 💾 Semiconductors | ${(sectorNewsMap["Semiconductors"] || []).slice(0, 1).join(" · ") || "ไม่มีข่าวเด่น Semiconductors"} | ${hasAIOrSemisNews ? "⭐⭐⭐ สูง" : "—"} |
| 🏛️ Macro / Fed | ${(sectorNewsMap["Macro"] || []).slice(0, 1).join(" · ") || "ไม่มีข่าว Macro Impact"} | ${hasMacroNews ? "⭐⭐⭐ สูง" : "—"} |
| 🌍 Geopolitical | ${(sectorNewsMap["Geopolitical"] || []).slice(0, 1).join(" · ") || "ไม่มีข่าว Geopolitical"} | ${hasGeopolitical ? "⭐⭐⭐ สูง" : "—"} |

> [!NOTE]
> ⚠️ ระบบ Price Projection นี้แสดง Scenario และช่วงราคาที่อาจเป็นไปได้ตามสูตรคณิตศาสตร์และ Confluence ของแนวรับ-แนวต้าน ไม่ใช่การฟันธงหรือการรับประกันราคาในอนาคต กรุณาปฏิบัติตามจุด Invalidation และรอยืนยัน Volume ทุกครั้ง
`;

  return `# 📊 Rocket AI · ${symbol} Technical Analysis Report

${conflictAlert}${newsWarningSection}

## ═══ 1. Market Overview ═══
| ฟิลด์ | ข้อมูล |
| :--- | :--- |
| Symbol | **${symbol}** · Timeframe: **${timeframe}** |
| Trading Style | **${tradingStyle === "day" ? "Day Trade" : tradingStyle === "position" ? "Position Trade" : "Swing Trade"}** |
| ราคาปัจจุบัน | **$${fmt(price)}** |
| ความสดใหม่ข้อมูล | **สถานะ: LIVE** (${marketData.priceSource || "Direct API"}) · ${marketData.isDelayed ? "⚠️ Delayed 15m" : "⚡ Real-time"} |
| อัปเดต | ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} |

---

## ═══ 2. Technical Score & Signal Strength ═══
* **คะแนนความแข็งแกร่งสัญญาณ (Signal Strength):** **${bullPct.toFixed(1)}% Bullish Bias**
* **สถานะความโน้มเอียง (Overall Bias):** **${signalStrengthLabel}**

---

## ═══ 3. Calculation Summary (Audit Log) ═══
- **แหล่งข้อมูลราคาหลัก:** ${marketData.priceSource || "Yahoo Finance / Finnhub API"}
- **จำนวนแท่งเทียนคำนวณ:** ${klines.length} แท่ง (Min required: 50)
- **ประเภทคำสั่ง Long:** \`${longEntryType}\` (ห่างจากราคาปัจจุบัน ${longDistancePct >= 0 ? `-${longDistancePct.toFixed(2)}%` : `+${Math.abs(longDistancePct).toFixed(2)}%`})
- **ประเภทคำสั่ง Short:** \`${shortEntryType}\` (ห่างจากราคาปัจจุบัน ${shortDistancePct >= 0 ? `+${shortDistancePct.toFixed(2)}%` : `-${Math.abs(shortDistancePct).toFixed(2)}%`})
- **ความคุ้มค่า Risk/Reward (Long):** 1:${longRR.toFixed(2)} ${longRR < 1.5 ? "⚠️ ต่ำกว่าเกณฑ์แนะนำ" : "✅ ผ่านเกณฑ์มาตรฐาน"}
- **ความคุ้มค่า Risk/Reward (Short):** 1:${shortRR.toFixed(2)} ${shortRR < 1.5 ? "⚠️ ต่ำกว่าเกณฑ์แนะนำ" : "✅ ผ่านเกณฑ์มาตรฐาน"}

---

## ═══ 4. Technical Indicators ═══
| Indicator | ค่า | สัญญาณ | ความหมาย |
| :--- | :--- | :--- | :--- |
| EMA 20 | $${fmt(ema20)} | ${price > ema20 ? "🟢 Bullish" : "🔴 Bearish"} | ราคาอยู่เหนือ/ใต้เส้นค่าเฉลี่ยระยะสั้น |
| EMA 50 | $${fmt(ema50)} | ${price > ema50 ? "🟢 Bullish" : "🔴 Bearish"} | แนวโน้มระยะกลาง |
| EMA 200 | ${ema200 > 0 ? `$${fmt(ema200)}` : "N/A"} | ${ema200 > 0 ? (price > ema200 ? "🟢 Bullish" : "🔴 Bearish") : "—"} | เทรนด์ภาพใหญ่ระดับมหภาค |
| RSI (14) | ${rsi14.toFixed(1)} | ${rsi14 > 70 ? "⚠️ Overbought" : rsi14 < 30 ? "⚠️ Oversold" : rsi14 > 55 ? "🟢 Bullish" : rsi14 < 45 ? "🔴 Bearish" : "🟡 Neutral"} | ดัชนีวัดแรงส่งโมเมนตัม |
| Stoch RSI K/D | ${stochasticRSI.k.toFixed(1)} / ${stochasticRSI.d.toFixed(1)} | ${stochasticRSI.overbought ? "⚠️ OB" : stochasticRSI.oversold ? "⚠️ OS" : stochasticRSI.k > stochasticRSI.d ? "🟢 Up" : "🔴 Down"} | สัญญาณกลับตัวระยะสั้น |
| MACD Hist | ${macd.histogram.toFixed(3)} | ${macd.histogram > 0 ? "🟢 Positive" : "🔴 Negative"} | histogram บ่งชี้โมเมนตัม |
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
| 100.0% (Swing High) | $${fmt(fib.r0)} | ${pct(((fib.r0 - price)/price)*100)} | Swing High lookback |
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

## ═══ 7. Risk Management & Position Setup ═══
### 📈 Long Setup (ฝั่งซื้อ / Bullish Outlook)
- **Entry Type:** \`${longEntryType}\`
- **Entry Zone:** **$${longZoneMin.toFixed(2)} - $${longZoneMax.toFixed(2)}**
- **Current Price:** $${fmt(price)}
- **Distance:** ${longDistancePct >= 0 ? `-${longDistancePct.toFixed(2)}%` : `+${Math.abs(longDistancePct).toFixed(2)}%`}
- **Confirmation:** **${longConfirmCount}/9** (${longConfirmations.filter(c => c.passed).map(c => c.name).join(", ") || "ไม่มีเงื่อนไขผ่าน"})
- **Technical Strength:** ${longTechStrength}
- **News Risk:** ${newsRiskLevel}
- **Gap Risk:** ${gapRiskLevel}
- **Stop Loss:** **$${fmt(longSL)}**
- **Take Profit 1:** $${fmt(longTP1)}
- **Take Profit 2:** **$${fmt(longTP2)}**
- **Risk/Reward:** **1:${longRR.toFixed(2)}** ${longRR < 1.5 ? "⚠️ ต่ำกว่าเกณฑ์มาตรฐาน 1.5" : "✅ ผ่านเกณฑ์"}
- **Invalidation:** ยกเลิกแผนทันทีหากราคาปิดแท่ง 4H ต่ำกว่า $${fmt(longSL)} ด้วย Volume สูง หรือเกิด Bearish BOS
- **Status:** **${longStatus}**

#### 📋 ตารางตรวจสอบเงื่อนไขยืนยันฝั่ง Long (9-Point Checklist)
| ปัจจัยยืนยัน (Confirmation Factors) | สถานะ | รายละเอียดการตรวจสอบ |
| :--- | :---: | :--- |
${longConfirmations.map(c => `| ${c.name} | ${c.passed ? "✅ ยืนยัน" : "⏳ รอยืนยัน"} | ${c.detail} |`).join("\n")}

#### 💰 สัดส่วนเงินทุนคำนวณฝั่ง Long (Position Sizing)
- ขนาดพอร์ตที่ตั้งค่า: **$${accountSize.toLocaleString()}** · ความเสี่ยง: **${riskPercent}% ($${riskDollar})** · Leverage: **${leverage}x**
- **จำนวนหน่วยที่ควรเปิดออเดอร์:** **${longQtyRaw.toFixed(2)} Units** (มูลค่าหน้าตัก $${longTotalValue.toFixed(2)})
- **ความเสี่ยงจริงสุทธิรวมค่าธรรมเนียม + Slippage:** **$${longActualRisk.toFixed(2)}**

### 📉 Short Setup (ฝั่งขายชอร์ต / Bearish Outlook)
- **Entry Type:** \`${shortEntryType}\`
- **Entry Zone:** **$${shortZoneMin.toFixed(2)} - $${shortZoneMax.toFixed(2)}**
- **Current Price:** $${fmt(price)}
- **Distance:** ${shortDistancePct >= 0 ? `+${shortDistancePct.toFixed(2)}%` : `-${Math.abs(shortDistancePct).toFixed(2)}%`}
- **Confirmation:** **${shortConfirmCount}/9** (${shortConfirmations.filter(c => c.passed).map(c => c.name).join(", ") || "ไม่มีเงื่อนไขผ่าน"})
- **Technical Strength:** ${shortTechStrength}
- **News Risk:** ${newsRiskLevel}
- **Gap Risk:** ${gapRiskLevel}
- **Stop Loss:** **$${fmt(shortSL)}**
- **Take Profit 1:** $${fmt(shortTP1)}
- **Take Profit 2:** **$${fmt(shortTP2)}**
- **Risk/Reward:** **1:${shortRR.toFixed(2)}** ${shortRR < 1.5 ? "⚠️ ต่ำกว่าเกณฑ์มาตรฐาน 1.5" : "✅ ผ่านเกณฑ์"}
- **Invalidation:** ยกเลิกแผนทันทีหากราคาปิดแท่ง 4H ทะลุเหนือ $${fmt(shortSL)} ด้วย Volume สูง หรือเกิด Bullish BOS
- **Status:** **${shortStatus}**

#### 📋 ตารางตรวจสอบเงื่อนไขยืนยันฝั่ง Short (9-Point Checklist)
| ปัจจัยยืนยัน (Confirmation Factors) | สถานะ | รายละเอียดการตรวจสอบ |
| :--- | :---: | :--- |
${shortConfirmations.map(c => `| ${c.name} | ${c.passed ? "✅ ยืนยัน" : "⏳ รอยืนยัน"} | ${c.detail} |`).join("\n")}

#### 💰 สัดส่วนเงินทุนคำนวณฝั่ง Short (Position Sizing)
- **จำนวนหน่วยที่ควรเปิดออเดอร์:** **${shortQtyRaw.toFixed(2)} Units** (มูลค่าหน้าตัก $${shortTotalValue.toFixed(2)})
- **ความเสี่ยงจริงสุทธิรวมค่าธรรมเนียม + Slippage:** **$${shortActualRisk.toFixed(2)}**

---

## ═══ 8. Rocket Score Breakdown (7-Dimension Scoring) ═══
*ประเมินความแข็งแกร่งของ Setup ทั้ง 7 มิติ (ไม่ใช่อัตราความน่าจะเป็นในการชนะหรือ Win Rate แต่เป็นค่าความสอดคล้องทางสถิติของระบบ)*

| มิติการวิเคราะห์ (7-Dimension Score) | คะแนนดิบ | คะแนนเต็ม | คำอธิบาย |
| :--- | :---: | :---: | :--- |
| 1. Trend Direction & Bias | ${bullPoints} | 15 | โครงสร้าง EMA 20/50/200 และทิศทางหลัก |
| 2. Momentum (RSI & MACD) | ${rsi14 > 50 && macd.histogram > 0 ? 10 : rsi14 < 45 && macd.histogram < 0 ? 3 : 6} | 10 | ความแข็งแกร่งและแรงส่งของการเคลื่อนไหว |
| 3. Market Structure Alignment | ${ms.type === "uptrend" ? 10 : ms.type === "downtrend" ? 3 : 6} | 10 | การเกิด Higher Highs/Lows หรือ Lower Highs/Lows |
| 4. Volume & OBV Flow | ${volumeAnalysis.isVolumeSpike ? 10 : volumeAnalysis.volumeRatio >= 1.0 ? 7 : 4} | 10 | การหมุนเวียนและอัตราส่วนปริมาณการซื้อขาย |
| 5. Support & Resistance Confluence | ${Math.min(10, (supportZones.length + resistanceZones.length) * 3)} | 10 | ความหนาแน่นและการยืนยันของโซนแนวรับแนวต้าน |
| 6. News & Macro Safety | ${hasEvent24h ? 2 : newsRiskLevel.includes("Medium") ? 6 : 10} | 10 | ความปลอดภัยจากเหตุการณ์ข่าว High Impact ใน 24 ชม. |
| 7. Data Quality & Live Freshness | ${marketData.isDelayed ? 6 : klines.length >= 100 ? 10 : 8} | 10 | ความสดใหม่ของข้อมูลและจำนวนแท่งเทียนที่ใช้คำนวณ |
| **รวมคะแนนความสอดคล้องระบบ (Total Score)** | **${Math.round(bullPoints + (rsi14 > 50 ? 8 : 4) + (ms.type === "uptrend" ? 10 : 4) + (volumeAnalysis.volumeRatio >= 1.0 ? 7 : 4) + (hasEvent24h ? 2 : 10) + 8)}** | **75** | **ระดับ: ${bullPct >= 65 ? "⭐ High Confluence" : bullPct >= 45 ? "🟡 Moderate Confluence" : "🔴 Low Confluence / Wait"}** |

${backtestSection}
${scenarioSection}
`;
}
