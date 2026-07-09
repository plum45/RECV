import { EMA, RSI, MACD, ATR, BollingerBands, ADX, StochasticRSI } from "technicalindicators";
import { KlineData, IndicatorData } from "../types/market";

// ── Helpers ────────────────────────────────────────────────────────────────

function sma(arr: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < arr.length; i++) {
    const slice = arr.slice(i - period + 1, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

// ── Main Export ─────────────────────────────────────────────────────────────

export function calculateIndicators(klines: KlineData[]): IndicatorData {
  const MIN_CANDLES = 50;
  if (klines.length < MIN_CANDLES) {
    throw new Error(
      `Insufficient data for calculation. Need at least ${MIN_CANDLES} candles, got ${klines.length}`
    );
  }

  const closes  = klines.map((k) => k.close);
  const highs   = klines.map((k) => k.high);
  const lows    = klines.map((k) => k.low);
  const volumes = klines.map((k) => k.volume);
  const opens   = klines.map((k) => k.open);
  const len     = klines.length;

  // ── 1. EMAs ────────────────────────────────────────────────────────────
  const ema20P   = Math.min(20, len - 1);
  const ema50P   = Math.min(50, len - 1);
  const ema200P  = Math.min(200, len - 1);

  const ema20Arr  = EMA.calculate({ period: ema20P, values: closes });
  const ema50Arr  = EMA.calculate({ period: ema50P, values: closes });
  const ema200Arr = len >= 200 ? EMA.calculate({ period: ema200P, values: closes }) : [];

  const ema20  = ema20Arr[ema20Arr.length - 1]   || 0;
  const ema50  = ema50Arr[ema50Arr.length - 1]   || 0;
  const ema200 = ema200Arr.length > 0 ? ema200Arr[ema200Arr.length - 1] : 0;

  // ── 2. RSI ─────────────────────────────────────────────────────────────
  const rsiP    = Math.min(14, len - 2);
  const rsiArr  = RSI.calculate({ period: rsiP, values: closes });
  const rsi14   = rsiArr[rsiArr.length - 1] || 50;

  // ── 3. MACD + crossover detection ──────────────────────────────────────
  let macdData: { macdLine: number; signalLine: number; histogram: number; crossover: "bullish" | "bearish" | "none" } = { macdLine: 0, signalLine: 0, histogram: 0, crossover: "none" };
  if (len >= 35) {
    const macdArr = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    const cur = macdArr[macdArr.length - 1];
    const prev = macdArr[macdArr.length - 2];
    let crossover: "bullish" | "bearish" | "none" = "none" as "bullish" | "bearish" | "none";
    if (cur && prev) {
      const curHist  = cur.histogram  || 0;
      const prevHist = prev.histogram || 0;
      if (prevHist < 0 && curHist >= 0) crossover = "bullish" as const;
      else if (prevHist > 0 && curHist <= 0) crossover = "bearish" as const;
    }
    macdData = {
      macdLine:   cur?.MACD      || 0,
      signalLine: cur?.signal    || 0,
      histogram:  cur?.histogram || 0,
      crossover,
    };
  }

  // ── 4. ATR ────────────────────────────────────────────────────────────
  const atrP   = Math.min(14, len - 2);
  const atrArr = ATR.calculate({ period: atrP, high: highs, low: lows, close: closes });
  const atr14  = atrArr[atrArr.length - 1] || 0;

  // ── 5. Pivot Points ───────────────────────────────────────────────────
  const prev = klines[len - 2];
  const P  = (prev.high + prev.low + prev.close) / 3;
  const R1 = 2 * P - prev.low;
  const S1 = 2 * P - prev.high;
  const R2 = P + (prev.high - prev.low);
  const S2 = P - (prev.high - prev.low);
  const R3 = prev.high + 2 * (P - prev.low);
  const S3 = prev.low  - 2 * (prev.high - P);
  const pivot = { p: P, r1: R1, s1: S1, r2: R2, s2: S2, r3: R3, s3: S3 };

  // ── 6. Volume + OBV ──────────────────────────────────────────────────
  const volW  = Math.min(20, len - 2);
  const lastVols = volumes.slice(len - volW - 1, len - 1);
  const avgVolume20 = lastVols.reduce((s, v) => s + v, 0) / lastVols.length;
  const currentVolume = klines[len - 1].volume;
  const volumeRatio   = avgVolume20 > 0 ? currentVolume / avgVolume20 : 1;
  const isVolumeSpike = volumeRatio >= 1.8;

  // OBV: sum of volume * sign(close - prevClose) over last 20 candles
  let obv = 0;
  const obvWindow = Math.min(20, len);
  const obvSlice = klines.slice(len - obvWindow);
  for (let i = 1; i < obvSlice.length; i++) {
    if (obvSlice[i].close > obvSlice[i - 1].close) obv += obvSlice[i].volume;
    else if (obvSlice[i].close < obvSlice[i - 1].close) obv -= obvSlice[i].volume;
  }
  // OBV trend: compare last 5 vs prior 5 within the window
  let obvRecent = 0, obvEarly = 0;
  for (let i = obvSlice.length - 5; i < obvSlice.length; i++) {
    if (obvSlice[i].close > obvSlice[i - 1].close) obvRecent += obvSlice[i].volume;
    else if (obvSlice[i].close < obvSlice[i - 1].close) obvRecent -= obvSlice[i].volume;
  }
  for (let i = Math.max(1, obvSlice.length - 10); i < obvSlice.length - 5; i++) {
    if (obvSlice[i].close > obvSlice[i - 1].close) obvEarly += obvSlice[i].volume;
    else if (obvSlice[i].close < obvSlice[i - 1].close) obvEarly -= obvSlice[i].volume;
  }
  const obvTrend: "rising" | "falling" | "flat" = obvRecent > obvEarly * 1.1 ? "rising" : obvRecent < obvEarly * 0.9 ? "falling" : "flat";

  const volumeAnalysis = { avgVolume20, isVolumeSpike, currentVolume, volumeRatio, obv, obvTrend };

  // ── 7. Bollinger Bands (20, 2) ────────────────────────────────────────
  const bbP = Math.min(20, len - 1);
  const bbArr = BollingerBands.calculate({ period: bbP, stdDev: 2, values: closes });
  const bb = bbArr[bbArr.length - 1];
  const bbUpper     = bb?.upper  || closes[len - 1] * 1.02;
  const bbMiddle    = bb?.middle || closes[len - 1];
  const bbLower     = bb?.lower  || closes[len - 1] * 0.98;
  const bandwidth   = bbMiddle > 0 ? (bbUpper - bbLower) / bbMiddle : 0;
  const percentB    = bbUpper !== bbLower ? (closes[len - 1] - bbLower) / (bbUpper - bbLower) : 0.5;

  // Squeeze: bandwidth < 20-period avg bandwidth
  const bwHistory   = bbArr.map((b) => b ? (b.upper - b.lower) / b.middle : 0);
  const avgBw       = bwHistory.length > 0 ? bwHistory.reduce((a, b) => a + b, 0) / bwHistory.length : bandwidth;
  const bbSqueeze   = bandwidth < avgBw * 0.8;

  const bollingerBands = { upper: bbUpper, middle: bbMiddle, lower: bbLower, bandwidth, percentB, squeeze: bbSqueeze };

  // ── 8. ADX (14) ───────────────────────────────────────────────────────
  const adxP = Math.min(14, len - 2);
  let adxData: { adx: number; plusDI: number; minusDI: number; trending: boolean; direction: "up" | "down" | "neutral" } = { adx: 0, plusDI: 0, minusDI: 0, trending: false, direction: "neutral" };
  if (len >= adxP * 2) {
    const adxArr = ADX.calculate({ period: adxP, high: highs, low: lows, close: closes });
    const adxLast = adxArr[adxArr.length - 1];
    if (adxLast) {
      const adxVal = adxLast.adx || 0;
      const pdi    = adxLast.pdi || 0;
      const mdi    = adxLast.mdi || 0;
      adxData = {
        adx: adxVal,
        plusDI: pdi,
        minusDI: mdi,
        trending: adxVal > 25,
        direction: (pdi > mdi ? "up" : mdi > pdi ? "down" : "neutral") as "up" | "down" | "neutral",
      };
    }
  }

  // ── 9. Stochastic RSI (14,3,3) ────────────────────────────────────────
  let stochRSI = { k: 50, d: 50, overbought: false, oversold: false };
  if (len >= 30) {
    const stochArr = StochasticRSI.calculate({
      values: closes,
      rsiPeriod: 14,
      stochasticPeriod: 14,
      kPeriod: 3,
      dPeriod: 3,
    });
    const stochLast = stochArr[stochArr.length - 1];
    if (stochLast) {
      stochRSI = {
        k: stochLast.k || 50,
        d: stochLast.d || 50,
        overbought: (stochLast.k || 0) > 80,
        oversold:   (stochLast.k || 0) < 20,
      };
    }
  }

  // ── 10. Fibonacci Retracement (swing over last 60 candles) ───────────
  const fibWindow = klines.slice(Math.max(0, len - 60));
  const swingHigh = Math.max(...fibWindow.map((k) => k.high));
  const swingLow  = Math.min(...fibWindow.map((k) => k.low));
  const fibRange  = swingHigh - swingLow;
  const fibonacci = {
    swing_high: swingHigh,
    swing_low:  swingLow,
    r0:    swingHigh,
    r236:  swingHigh - fibRange * 0.236,
    r382:  swingHigh - fibRange * 0.382,
    r500:  swingHigh - fibRange * 0.500,
    r618:  swingHigh - fibRange * 0.618,
    r786:  swingHigh - fibRange * 0.786,
    r100:  swingLow,
    ext127: swingHigh + fibRange * 0.272,
    ext161: swingHigh + fibRange * 0.618,
  };

  // ── 11. VWAP (intraday — last 50 candles) ────────────────────────────
  const vwapSlice = klines.slice(Math.max(0, len - 50));
  let cumTPV = 0, cumVol = 0;
  for (const k of vwapSlice) {
    const tp = (k.high + k.low + k.close) / 3;
    cumTPV += tp * k.volume;
    cumVol += k.volume;
  }
  const vwap = cumVol > 0 ? cumTPV / cumVol : closes[len - 1];

  // ── 12. Market Structure (HH/HL/LH/LL + Break of Structure) ──────────
  // Detect swing points over last 30 candles with window 3
  const strWindow = klines.slice(Math.max(0, len - 40));
  const W = 3;
  const swingHighs: number[] = [];
  const swingLows:  number[] = [];

  for (let i = W; i < strWindow.length - W; i++) {
    let isHigh = true, isLow = true;
    for (let j = i - W; j <= i + W; j++) {
      if (j !== i) {
        if (strWindow[j].high >= strWindow[i].high) isHigh = false;
        if (strWindow[j].low  <= strWindow[i].low)  isLow  = false;
      }
    }
    if (isHigh) swingHighs.push(strWindow[i].high);
    if (isLow)  swingLows.push(strWindow[i].low);
  }

  const lastSwingHigh = swingHighs[swingHighs.length - 1] || highs[len - 1];
  const lastSwingLow  = swingLows[swingLows.length  - 1]  || lows[len - 1];
  const prevSwingHigh = swingHighs[swingHighs.length - 2] || lastSwingHigh;
  const prevSwingLow  = swingLows[swingLows.length  - 2]  || lastSwingLow;

  const higherHighs = lastSwingHigh > prevSwingHigh;
  const higherLows  = lastSwingLow  > prevSwingLow;
  const lowerHighs  = lastSwingHigh < prevSwingHigh;
  const lowerLows   = lastSwingLow  < prevSwingLow;

  let structType: "uptrend" | "downtrend" | "sideways" =
    higherHighs && higherLows ? "uptrend" :
    lowerHighs  && lowerLows  ? "downtrend" : "sideways";

  // Break of Structure: price breaks last swing high (bullish BOS) or last swing low (bearish BOS)
  const curPrice = closes[len - 1];
  let breakOfStructure: "bullish_bos" | "bearish_bos" | "none" = "none";
  if (curPrice > prevSwingHigh && prevSwingHigh > 0) breakOfStructure = "bullish_bos";
  else if (curPrice < prevSwingLow && prevSwingLow > 0) breakOfStructure = "bearish_bos";

  const marketStructure = {
    type: structType,
    higherHighs, higherLows, lowerHighs, lowerLows,
    lastSwingHigh, lastSwingLow,
    breakOfStructure,
  };

  return {
    ema20, ema50, ema200,
    rsi14,
    macd: macdData,
    atr14,
    pivot,
    volumeAnalysis,
    bollingerBands,
    adx: adxData,
    stochasticRSI: stochRSI,
    fibonacci,
    vwap,
    marketStructure,
  };
}
