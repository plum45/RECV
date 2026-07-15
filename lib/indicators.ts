import { EMA, RSI, MACD, ATR, BollingerBands, ADX, StochasticRSI } from "technicalindicators";
import { KlineData, IndicatorData } from "../types/market";

export interface IndicatorOptions {
  sessionTimeZone?: string;
  sessionStartHour?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function safeDiv(num: number, den: number, fallback = 0): number {
  if (!den || isNaN(den) || !isFinite(den)) return fallback;
  const res = num / den;
  return isNaN(res) || !isFinite(res) ? fallback : res;
}

function safeNum(val: any, fallback = 0): number {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return fallback;
  return Number(val);
}

function getTradingSessionKey(
  openTime: number,
  timeZone: string,
  sessionStartHour: number
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(openTime));
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  const year = read("year");
  const month = read("month");
  const day = read("day");
  const hour = read("hour");
  const sessionDate = new Date(Date.UTC(year, month - 1, day));
  if (hour < sessionStartHour) sessionDate.setUTCDate(sessionDate.getUTCDate() - 1);
  return sessionDate.toISOString().slice(0, 10);
}

// ── Main Export ─────────────────────────────────────────────────────────────

export function calculateIndicators(klines: KlineData[], options: IndicatorOptions = {}): IndicatorData {
  const MIN_CANDLES = 50;
  if (klines.length < MIN_CANDLES) {
    throw new Error(
      `Insufficient data for calculation. Need at least ${MIN_CANDLES} candles, got ${klines.length}`
    );
  }

  // Data Validation checks
  for (let i = 0; i < klines.length; i++) {
    const k = klines[i];
    if (k.open < 0 || k.high < 0 || k.low < 0 || k.close < 0 || k.volume < 0) {
      throw new Error(`Data Validation Error: Negative values detected in candle OHLC or volume.`);
    }
    if (k.low > k.high || k.low > k.open || k.low > k.close || k.high < k.open || k.high < k.close) {
      throw new Error(`Data Validation Error: Invalid candle bounds. High must be >= Low/Open/Close.`);
    }
  }

  const closes  = klines.map((k) => safeNum(k.close));
  const highs   = klines.map((k) => safeNum(k.high));
  const lows    = klines.map((k) => safeNum(k.low));
  const volumes = klines.map((k) => safeNum(k.volume));
  const len     = klines.length;

  // ── 1. EMAs ───────────────────────────────────────────────────────────
  const ema20P   = Math.min(20, len - 1);
  const ema50P   = Math.min(50, len - 1);
  const ema200P  = Math.min(200, len - 1);

  const ema20Arr  = EMA.calculate({ period: ema20P, values: closes });
  const ema50Arr  = EMA.calculate({ period: ema50P, values: closes });
  const ema200Arr = len >= 200 ? EMA.calculate({ period: ema200P, values: closes }) : [];

  const ema20  = safeNum(ema20Arr[ema20Arr.length - 1]);
  const ema50  = safeNum(ema50Arr[ema50Arr.length - 1]);
  const ema200 = ema200Arr.length > 0 ? safeNum(ema200Arr[ema200Arr.length - 1]) : 0;

  // ── 2. RSI ───────────────────────────────────────────────────────────
  const rsiP    = Math.min(14, len - 2);
  const rsiArr  = RSI.calculate({ period: rsiP, values: closes });
  const rsi14   = safeNum(rsiArr[rsiArr.length - 1], 50);

  // ── 3. MACD + crossover detection ─────────────────────────────────────
  let macdData = { macdLine: 0, signalLine: 0, histogram: 0, crossover: "none" as "bullish" | "bearish" | "none", crossoverBarsAgo: -1 };
  if (len >= 35) {
    const macdArr = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    
    let crossover: "bullish" | "bearish" | "none" = "none";
    let crossoverBarsAgo = -1;
    for (let i = macdArr.length - 1; i >= 1; i--) {
      const cur = macdArr[i];
      const prev = macdArr[i - 1];
      if (cur && prev) {
        const curHist  = safeNum(cur.histogram);
        const prevHist = safeNum(prev.histogram);
        if (prevHist < 0 && curHist >= 0) {
          crossover = "bullish";
          crossoverBarsAgo = macdArr.length - 1 - i;
          break;
        } else if (prevHist > 0 && curHist <= 0) {
          crossover = "bearish";
          crossoverBarsAgo = macdArr.length - 1 - i;
          break;
        }
      }
    }
    
    const cur = macdArr[macdArr.length - 1];
    macdData = {
      macdLine:   safeNum(cur?.MACD),
      signalLine: safeNum(cur?.signal),
      histogram:  safeNum(cur?.histogram),
      crossover,
      crossoverBarsAgo,
    };
  }

  // ── 4. ATR ───────────────────────────────────────────────────────────
  const atrP   = Math.min(14, len - 2);
  const atrArr = ATR.calculate({ period: atrP, high: highs, low: lows, close: closes });
  const atr14  = safeNum(atrArr[atrArr.length - 1], 0);

  // ── 5. Pivot Points (Previous Candle, Day, Week) ─────────────────────
  const prevCandle = klines[len - 2];
  const P  = (prevCandle.high + prevCandle.low + prevCandle.close) / 3;
  const R1 = 2 * P - prevCandle.low;
  const S1 = 2 * P - prevCandle.high;
  const R2 = P + (prevCandle.high - prevCandle.low);
  const S2 = P - (prevCandle.high - prevCandle.low);
  const R3 = prevCandle.high + 2 * (P - prevCandle.low);
  const S3 = prevCandle.low  - 2 * (prevCandle.high - P);
  const pivot = { p: P, r1: R1, s1: S1, r2: R2, s2: S2, r3: R3, s3: S3 };

  // Calculate previous day aggregates
  const dayBuckets: Record<number, KlineData[]> = {};
  klines.forEach(k => {
    const day = Math.floor(k.openTime / (24 * 60 * 60 * 1000));
    if (!dayBuckets[day]) dayBuckets[day] = [];
    dayBuckets[day].push(k);
  });
  const sortedDays = Object.keys(dayBuckets).map(Number).sort((a,b)=>a-b);
  let dayPivot = { p: P, r1: R1, s1: S1, r2: R2, s2: S2 };
  if (sortedDays.length >= 2) {
    const prevDayKey = sortedDays[sortedDays.length - 2];
    const prevDayGroup = dayBuckets[prevDayKey];
    const dh = Math.max(...prevDayGroup.map(g => g.high));
    const dl = Math.min(...prevDayGroup.map(g => g.low));
    const dc = prevDayGroup[prevDayGroup.length - 1].close;
    const dp = (dh + dl + dc) / 3;
    dayPivot = {
      p: dp,
      r1: 2 * dp - dl,
      s1: 2 * dp - dh,
      r2: dp + (dh - dl),
      s2: dp - (dh - dl),
    };
  }

  // Calculate previous week aggregates
  const weekBuckets: Record<number, KlineData[]> = {};
  klines.forEach(k => {
    const week = Math.floor(k.openTime / 604800000);
    if (!weekBuckets[week]) weekBuckets[week] = [];
    weekBuckets[week].push(k);
  });
  const sortedWeeks = Object.keys(weekBuckets).map(Number).sort((a,b)=>a-b);
  let weekPivot = { p: P, r1: R1, s1: S1, r2: R2, s2: S2 };
  if (sortedWeeks.length >= 2) {
    const prevWeekKey = sortedWeeks[sortedWeeks.length - 2];
    const prevWeekGroup = weekBuckets[prevWeekKey];
    const wh = Math.max(...prevWeekGroup.map(g => g.high));
    const wl = Math.min(...prevWeekGroup.map(g => g.low));
    const wc = prevWeekGroup[prevWeekGroup.length - 1].close;
    const wp = (wh + wl + wc) / 3;
    weekPivot = {
      p: wp,
      r1: 2 * wp - wl,
      s1: 2 * wp - wh,
      r2: wp + (wh - wl),
      s2: wp - (wh - wl),
    };
  }

  const pivotDetails = {
    candlePivot: { p: P, r1: R1, s1: S1, r2: R2, s2: S2 },
    dayPivot,
    weekPivot,
  };

  // ── 6. Volume + OBV ──────────────────────────────────────────────────
  const volW  = Math.min(20, len - 2);
  const lastVols = volumes.slice(len - volW - 1, len - 1);
  const avgVolume20 = safeNum(lastVols.reduce((s, v) => s + v, 0) / Math.max(1, lastVols.length));
  const currentVolume = safeNum(klines[len - 1].volume);
  const volumeRatio   = safeDiv(currentVolume, avgVolume20, 1);
  const isVolumeSpike = volumeRatio >= 1.8;

  let obv = 0;
  const obvSeries = [0];
  const obvWindow = Math.min(20, len);
  const obvSlice = klines.slice(len - obvWindow);
  for (let i = 1; i < obvSlice.length; i++) {
    if (obvSlice[i].close > obvSlice[i - 1].close) obv += obvSlice[i].volume;
    else if (obvSlice[i].close < obvSlice[i - 1].close) obv -= obvSlice[i].volume;
    obvSeries.push(obv);
  }
  const recentStart = Math.max(0, obvSeries.length - 6);
  const recentChange = obvSeries[obvSeries.length - 1] - obvSeries[recentStart];
  const noiseFloor = Math.max(avgVolume20 * 0.5, 1);
  const obvTrend: "rising" | "falling" | "flat" = recentChange > noiseFloor
    ? "rising"
    : recentChange < -noiseFloor ? "falling" : "flat";

  const volumeAnalysis = { avgVolume20, isVolumeSpike, currentVolume, volumeRatio, obv, obvTrend };

  // ── 7. Bollinger Bands (20, 2) ───────────────────────────────────────
  const bbP = Math.min(20, len - 1);
  const bbArr = BollingerBands.calculate({ period: bbP, stdDev: 2, values: closes });
  const bb = bbArr[bbArr.length - 1];
  const bbUpper     = safeNum(bb?.upper, closes[len - 1] * 1.02);
  const bbMiddle    = safeNum(bb?.middle, closes[len - 1]);
  const bbLower     = safeNum(bb?.lower, closes[len - 1] * 0.98);
  const bandwidth   = safeDiv(bbUpper - bbLower, bbMiddle, 0);
  const percentB    = safeDiv(closes[len - 1] - bbLower, bbUpper - bbLower, 0.5);

  const bwHistory   = bbArr.map((b) => b ? safeDiv(b.upper - b.lower, b.middle, 0) : 0);
  const avgBw       = bwHistory.length > 0 ? bwHistory.reduce((a, b) => a + b, 0) / bwHistory.length : bandwidth;
  const bbSqueeze   = bandwidth < avgBw * 0.8;

  const bollingerBands = { upper: bbUpper, middle: bbMiddle, lower: bbLower, bandwidth, percentB, squeeze: bbSqueeze };

  // ── 8. ADX (14) ────────────────────────────────────────────────────
  const adxP = Math.min(14, len - 2);
  let adxData = { adx: 0, plusDI: 0, minusDI: 0, trending: false, direction: "neutral" as "up" | "down" | "neutral" };
  if (len >= adxP * 2) {
    const adxArr = ADX.calculate({ period: adxP, high: highs, low: lows, close: closes });
    const adxLast = adxArr[adxArr.length - 1];
    if (adxLast) {
      const adxVal = safeNum(adxLast.adx);
      const pdi    = safeNum(adxLast.pdi);
      const mdi    = safeNum(adxLast.mdi);
      adxData = {
        adx: adxVal,
        plusDI: pdi,
        minusDI: mdi,
        trending: adxVal > 25,
        direction: (pdi > mdi ? "up" : mdi > mdi ? "down" : "neutral"),
      };
    }
  }

  // ── 9. Stochastic RSI (14,3,3) ───────────────────────────────────────
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
        k: safeNum(stochLast.k, 50),
        d: safeNum(stochLast.d, 50),
        overbought: safeNum(stochLast.k) > 80,
        oversold:   safeNum(stochLast.k) < 20,
      };
    }
  }

  // ── 10. Fibonacci Retracement (lookback: 60 candles) ─────────────────
  const lookbackBars = Math.min(60, len);
  const fibWindow = klines.slice(len - lookbackBars);
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
  const fibonacciDetails = {
    lookbackBars,
    periodName: `Last ${lookbackBars} Bars`,
  };

  // ── 11. VWAP ─────────────────────────────────────────────────────────
  // Intraday VWAP must reset at the start of the latest session. A fixed
  // "last 50 bars" calculation mixes sessions and is not a true VWAP.
  const intervalMs = len >= 2
    ? Math.max(0, klines[len - 1].openTime - klines[len - 2].openTime)
    : 0;
  // Session VWAP is meaningful on 5m/15m/1h execution charts. 4h and higher
  // use a rolling VWAP while Anchored VWAP carries the swing context.
  const isIntraday = intervalMs > 0 && intervalMs <= 60 * 60 * 1000;
  const sessionTimeZone = options.sessionTimeZone || "UTC";
  const sessionStartHour = options.sessionStartHour ?? 0;
  const latestSessionKey = getTradingSessionKey(klines[len - 1].openTime, sessionTimeZone, sessionStartHour);
  const vwapSlice = isIntraday
    ? klines.filter((k) => getTradingSessionKey(k.openTime, sessionTimeZone, sessionStartHour) === latestSessionKey)
    : klines.slice(Math.max(0, len - 50));

  const calculateVwap = (candles: KlineData[], fallback: number) => {
    let totalPriceVolume = 0;
    let totalVolume = 0;
    for (const candle of candles) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      const volume = Math.max(0, candle.volume);
      totalPriceVolume += typicalPrice * volume;
      totalVolume += volume;
    }
    return safeDiv(totalPriceVolume, totalVolume, fallback);
  };

  const vwap = calculateVwap(vwapSlice, closes[len - 1]);
  const vwapDetails = {
    type: (isIntraday ? "session" : "rolling") as "session" | "rolling",
    value: vwap,
    length: vwapSlice.length,
    sessionStart: isIntraday ? vwapSlice[0]?.openTime ?? null : null,
  };

  // ── 12. Market Structure (HH/HL/LH/LL + Break of Structure) ──────────
  const strWindow = klines.slice(Math.max(0, len - 40));
  const W = 3;
  const structHighs: number[] = [];
  const structLows:  number[] = [];

  for (let i = W; i < strWindow.length - W; i++) {
    let isHigh = true, isLow = true;
    for (let j = i - W; j <= i + W; j++) {
      if (j !== i) {
        if (strWindow[j].high >= strWindow[i].high) isHigh = false;
        if (strWindow[j].low  <= strWindow[i].low)  isLow  = false;
      }
    }
    if (isHigh) structHighs.push(strWindow[i].high);
    if (isLow)  structLows.push(strWindow[i].low);
  }

  const lastSwingHigh = structHighs[structHighs.length - 1] || highs[len - 1];
  const lastSwingLow  = structLows[structLows.length  - 1]  || lows[len - 1];
  const prevSwingHigh = structHighs[structHighs.length - 2] || lastSwingHigh;
  const prevSwingLow  = structLows[structLows.length  - 2]  || lastSwingLow;

  const higherHighs = lastSwingHigh > prevSwingHigh;
  const higherLows  = lastSwingLow  > prevSwingLow;
  const lowerHighs  = lastSwingHigh < prevSwingHigh;
  const lowerLows   = lastSwingLow  < prevSwingLow;

  let structType: "uptrend" | "downtrend" | "sideways" =
    higherHighs && higherLows ? "uptrend" :
    lowerHighs  && lowerLows  ? "downtrend" : "sideways";

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

  // Anchored VWAP: use the most recent confirmed swing in the direction that
  // matters now. It is useful for swing/position context without pretending
  // that a daily VWAP has the same meaning on a daily chart.
  const anchorWindow = Math.min(120, len);
  const anchorStart = Math.max(0, len - anchorWindow);
  const anchorSwingWindow = 3;
  const preferredAnchorType = curPrice >= vwap ? "swing_low" : "swing_high";
  let anchorIndex = Math.max(anchorStart, len - 50);
  let anchorType: "swing_low" | "swing_high" | "rolling" = "rolling";

  const findLatestSwing = (kind: "swing_low" | "swing_high") => {
    for (let i = len - 1 - anchorSwingWindow; i >= anchorStart + anchorSwingWindow; i--) {
      let isSwing = true;
      for (let j = i - anchorSwingWindow; j <= i + anchorSwingWindow; j++) {
        if (j === i) continue;
        if (kind === "swing_low" && klines[j].low <= klines[i].low) {
          isSwing = false;
          break;
        }
        if (kind === "swing_high" && klines[j].high >= klines[i].high) {
          isSwing = false;
          break;
        }
      }
      if (isSwing) return i;
    }
    return -1;
  };

  const preferredAnchor = findLatestSwing(preferredAnchorType);
  const alternativeType = preferredAnchorType === "swing_low" ? "swing_high" : "swing_low";
  const alternativeAnchor = preferredAnchor === -1 ? findLatestSwing(alternativeType) : -1;
  if (preferredAnchor >= 0) {
    anchorIndex = preferredAnchor;
    anchorType = preferredAnchorType;
  } else if (alternativeAnchor >= 0) {
    anchorIndex = alternativeAnchor;
    anchorType = alternativeType;
  }

  const anchoredSlice = klines.slice(anchorIndex);
  const anchoredVwap = {
    value: calculateVwap(anchoredSlice, vwap),
    anchorOpenTime: klines[anchorIndex].openTime,
    anchorType,
    length: anchoredSlice.length,
  };

  // Price Action: use a closed candle only. This is intentionally a
  // confirmation layer, especially for metals after a liquidity sweep, not a
  // prediction based on the currently-forming candle.
  const inferredBarMs = Math.max(1, klines[len - 1].openTime - klines[len - 2].openTime);
  const lastBarIsStillOpen = Date.now() < klines[len - 1].openTime + inferredBarMs;
  const priceActionIndex = lastBarIsStillOpen ? len - 2 : len - 1;
  const last = klines[priceActionIndex];
  const previous = klines[priceActionIndex - 1];
  const candleRange = Math.max(last.high - last.low, Number.EPSILON);
  const candleBody = Math.abs(last.close - last.open);
  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;
  const bodyPercent = candleBody / candleRange;
  const upperWickPercent = upperWick / candleRange;
  const lowerWickPercent = lowerWick / candleRange;
  const closeLocation = (last.close - last.low) / candleRange;
  const patterns: string[] = [];
  let bullishPriceAction = 0;
  let bearishPriceAction = 0;

  const bullishEngulfing = previous.close < previous.open &&
    last.close > last.open && last.open <= previous.close && last.close >= previous.open;
  const bearishEngulfing = previous.close > previous.open &&
    last.close < last.open && last.open >= previous.close && last.close <= previous.open;
  const bullishRejection = lowerWickPercent >= 0.45 && lowerWick >= candleBody * 1.5 && closeLocation >= 0.6;
  const bearishRejection = upperWickPercent >= 0.45 && upperWick >= candleBody * 1.5 && closeLocation <= 0.4;
  const insideBar = last.high <= previous.high && last.low >= previous.low;

  if (bullishEngulfing) { patterns.push("Bullish engulfing"); bullishPriceAction += 2; }
  if (bearishEngulfing) { patterns.push("Bearish engulfing"); bearishPriceAction += 2; }
  if (bullishRejection) { patterns.push("Bullish rejection wick"); bullishPriceAction += 1; }
  if (bearishRejection) { patterns.push("Bearish rejection wick"); bearishPriceAction += 1; }
  if (insideBar) patterns.push("Inside bar / compression");

  const sweepLookback = klines.slice(Math.max(0, priceActionIndex - 12), priceActionIndex);
  const recentHigh = Math.max(...sweepLookback.map((bar) => bar.high));
  const recentLow = Math.min(...sweepLookback.map((bar) => bar.low));
  let liquiditySweep: "buy_side" | "sell_side" | "none" = "none";
  if (last.low < recentLow && closeLocation >= 0.6) {
    liquiditySweep = "sell_side";
    patterns.push("Sell-side sweep reclaimed");
    bullishPriceAction += 2;
  } else if (last.high > recentHigh && closeLocation <= 0.4) {
    liquiditySweep = "buy_side";
    patterns.push("Buy-side sweep rejected");
    bearishPriceAction += 2;
  }

  const priceActionBias = bullishPriceAction > bearishPriceAction
    ? "bullish" as const
    : bearishPriceAction > bullishPriceAction
      ? "bearish" as const
      : "neutral" as const;
  const priceAction = {
    bias: priceActionBias,
    confirmation: Math.max(bullishPriceAction, bearishPriceAction) >= 2
      ? "confirmed" as const
      : patterns.length > 0 ? "watch" as const : "none" as const,
    patterns,
    liquiditySweep,
    lastCandle: {
      bodyPercent: Number(bodyPercent.toFixed(3)),
      upperWickPercent: Number(upperWickPercent.toFixed(3)),
      lowerWickPercent: Number(lowerWickPercent.toFixed(3)),
      closeLocation: Number(closeLocation.toFixed(3)),
    },
  };

  // Smart Money Concepts: a BOS requires a closed candle beyond a confirmed
  // swing. MSS is an opposite-side BOS against the preceding structure. The
  // origin candle of that impulse becomes the fresh Demand/Supply zone.
  const structureWindow = 3;
  const findLatestConfirmedSwing = (kind: "high" | "low") => {
    for (let i = priceActionIndex - structureWindow; i >= structureWindow; i--) {
      let isSwing = true;
      for (let j = i - structureWindow; j <= i + structureWindow; j++) {
        if (j === i || j > priceActionIndex) continue;
        if (kind === "high" && klines[j].high >= klines[i].high) {
          isSwing = false;
          break;
        }
        if (kind === "low" && klines[j].low <= klines[i].low) {
          isSwing = false;
          break;
        }
      }
      if (isSwing) return { price: kind === "high" ? klines[i].high : klines[i].low, index: i };
    }
    return null;
  };

  const lastConfirmedHigh = findLatestConfirmedSwing("high");
  const lastConfirmedLow = findLatestConfirmedSwing("low");
  const structureBreakBuffer = Math.max(atr14 * 0.08, last.close * 0.0002);
  const smartBos = lastConfirmedHigh && last.close > lastConfirmedHigh.price + structureBreakBuffer
    ? "bullish" as const
    : lastConfirmedLow && last.close < lastConfirmedLow.price - structureBreakBuffer
      ? "bearish" as const
      : "none" as const;
  const smartMss = smartBos === "bullish" && structType === "downtrend"
    ? "bullish" as const
    : smartBos === "bearish" && structType === "uptrend"
      ? "bearish" as const
      : "none" as const;

  const findOriginZone = (direction: "bullish" | "bearish") => {
    for (let i = priceActionIndex - 1; i >= Math.max(0, priceActionIndex - 14); i--) {
      const candle = klines[i];
      const isOpposingCandle = direction === "bullish"
        ? candle.close < candle.open
        : candle.close > candle.open;
      if (isOpposingCandle) {
        return direction === "bullish"
          ? {
              low: Number(candle.low.toFixed(4)),
              high: Number(Math.max(candle.open, candle.close).toFixed(4)),
              sourceIndex: i,
              status: "fresh" as const,
            }
          : {
              low: Number(Math.min(candle.open, candle.close).toFixed(4)),
              high: Number(candle.high.toFixed(4)),
              sourceIndex: i,
              status: "fresh" as const,
            };
      }
    }
    return undefined;
  };

  const smartMoney = {
    bos: smartBos,
    mss: smartMss,
    setup: smartMss === "bullish"
      ? "bullish_reversal" as const
      : smartMss === "bearish"
        ? "bearish_reversal" as const
        : smartBos === "bullish"
          ? "bullish_continuation" as const
          : smartBos === "bearish"
            ? "bearish_continuation" as const
            : "none" as const,
    demandZone: smartBos === "bullish" ? findOriginZone("bullish") : undefined,
    supplyZone: smartBos === "bearish" ? findOriginZone("bearish") : undefined,
  };

  return {
    ema20, ema50, ema200,
    rsi14,
    macd: macdData,
    atr14,
    pivot,
    pivotDetails,
    volumeAnalysis,
    bollingerBands,
    adx: adxData,
    stochasticRSI: stochRSI,
    fibonacci,
    fibonacciDetails,
    vwap,
    vwapDetails,
    anchoredVwap,
    priceAction,
    smartMoney,
    marketStructure,
  };
}
