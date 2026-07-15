import {
  KlineData,
  IndicatorData,
  SupportResistanceZone,
  SupportResistanceData,
  ZoneFreshness,
  ZoneStrength,
  ZoneStatus,
  ZoneComponents,
} from "../types/market";
import type { AssetClass } from "./assetProfile";

interface CandidatePoint {
  price: number;
  type: "swing_high" | "swing_low" | "fvg" | "orderblock" | "round_number" | "buy_side_liquidity" | "sell_side_liquidity";
  name: string;
  volume?: number;
  index?: number;
  age?: number;
}

interface TimeframeProfile {
  historyBars: number;
  swingWindow: number;
  clusterAtrMultiplier: number;
  minClusterPercent: number;
  maxClusterPercent: number;
  minZoneHalfWidthPercent: number;
  minSeparationAtrMultiplier: number;
  minSeparationPercent: number;
  freshBars: number;
  recentBars: number;
  agedBars: number;
}

function getTimeframeProfile(
  timeframe: string,
  availableBars: number,
  assetClass: AssetClass = "equity"
): TimeframeProfile {
  const profiles: Record<string, TimeframeProfile> = {
    "5m": { historyBars: 360, swingWindow: 6, clusterAtrMultiplier: 0.55, minClusterPercent: 0.0015, maxClusterPercent: 0.006, minZoneHalfWidthPercent: 0.001, minSeparationAtrMultiplier: 1.0, minSeparationPercent: 0.003, freshBars: 96, recentBars: 216, agedBars: 360 },
    "15m": { historyBars: 480, swingWindow: 8, clusterAtrMultiplier: 0.6, minClusterPercent: 0.002, maxClusterPercent: 0.008, minZoneHalfWidthPercent: 0.0015, minSeparationAtrMultiplier: 1.05, minSeparationPercent: 0.004, freshBars: 80, recentBars: 192, agedBars: 360 },
    "1h": { historyBars: 420, swingWindow: 10, clusterAtrMultiplier: 0.65, minClusterPercent: 0.003, maxClusterPercent: 0.012, minZoneHalfWidthPercent: 0.002, minSeparationAtrMultiplier: 1.1, minSeparationPercent: 0.005, freshBars: 72, recentBars: 168, agedBars: 300 },
    "4h": { historyBars: 360, swingWindow: 12, clusterAtrMultiplier: 0.7, minClusterPercent: 0.004, maxClusterPercent: 0.018, minZoneHalfWidthPercent: 0.003, minSeparationAtrMultiplier: 1.2, minSeparationPercent: 0.007, freshBars: 60, recentBars: 140, agedBars: 260 },
    "1d": { historyBars: 300, swingWindow: 14, clusterAtrMultiplier: 0.75, minClusterPercent: 0.006, maxClusterPercent: 0.03, minZoneHalfWidthPercent: 0.004, minSeparationAtrMultiplier: 1.3, minSeparationPercent: 0.01, freshBars: 45, recentBars: 120, agedBars: 220 },
    "1w": { historyBars: 208, swingWindow: 10, clusterAtrMultiplier: 0.8, minClusterPercent: 0.012, maxClusterPercent: 0.05, minZoneHalfWidthPercent: 0.008, minSeparationAtrMultiplier: 1.4, minSeparationPercent: 0.018, freshBars: 12, recentBars: 36, agedBars: 96 },
  };

  const profile = profiles[timeframe.toLowerCase()] || profiles["1h"];
  const metalAdjusted = assetClass === "precious_metal"
    ? {
        ...profile,
        // Metals routinely sweep a narrow level before reacting. Use a wider
        // ATR-based cluster and require a slightly more meaningful separation.
        swingWindow: profile.swingWindow + 2,
        clusterAtrMultiplier: profile.clusterAtrMultiplier * 1.15,
        maxClusterPercent: profile.maxClusterPercent * 1.2,
        minZoneHalfWidthPercent: profile.minZoneHalfWidthPercent * 1.15,
        minSeparationAtrMultiplier: profile.minSeparationAtrMultiplier * 1.15,
        minSeparationPercent: profile.minSeparationPercent * 1.15,
      }
    : profile;
  return { ...metalAdjusted, historyBars: Math.min(metalAdjusted.historyBars, availableBars) };
}

interface GroupScoreResult {
  score: number;
  reasons: string[];
  freshness: ZoneFreshness;
  strength: ZoneStrength;
  status: ZoneStatus;
  touches: number;
  successfulReactions: number;
  failedReactions: number;
  lastTouchAge: number | null;
  components: ZoneComponents;
  ageString: string;
  liquidity?: "buy_side" | "sell_side" | "mixed";
  _mid: number;
  _minVal: number;
  _maxVal: number;
}

function calculateGroupScore(
  nearby: CandidatePoint[],
  klines: KlineData[],
  indicators: IndicatorData,
  currentPrice: number,
  threshold: number,
  avgVolume: number,
  timeframe = "1H",
  profile = getTimeframeProfile(timeframe, klines.length)
): GroupScoreResult {
  const reasons: string[] = [];
  let baseScore = 0;
  let volumeScore = 0;
  let confluenceScore = 0;
  let freshnessScore = 0;
  let reactionScore = 0;
  let flipScore = 0;

  let swingHighs = 0;
  let swingLows = 0;
  let roundNumber = false;
  let fvgs = 0;
  let obs = 0;
  let buySideLiquidity = 0;
  let sellSideLiquidity = 0;

  nearby.forEach((c) => {
    if (c.type === "swing_high") {
      swingHighs++;
      baseScore += 1.8;
      if (c.volume && c.volume > avgVolume) {
        const ratio = Math.min(2.0, c.volume / avgVolume);
        volumeScore += 1.0 * (ratio - 1);
      }
    } else if (c.type === "swing_low") {
      swingLows++;
      baseScore += 1.8;
      if (c.volume && c.volume > avgVolume) {
        const ratio = Math.min(2.0, c.volume / avgVolume);
        volumeScore += 1.0 * (ratio - 1);
      }
    } else if (c.type === "round_number") {
      roundNumber = true;
      baseScore += 0.5;
    } else if (c.type === "fvg") {
      fvgs++;
      baseScore += 2.0;
    } else if (c.type === "orderblock") {
      obs++;
      baseScore += 2.5;
    } else if (c.type === "buy_side_liquidity") {
      buySideLiquidity++;
      baseScore += 2.25;
    } else if (c.type === "sell_side_liquidity") {
      sellSideLiquidity++;
      baseScore += 2.25;
    }
  });

  // Midpoint and bounds
  const mid = nearby.reduce((sum, o) => sum + o.price, 0) / nearby.length;
  const minVal = Math.min(...nearby.map((o) => o.price));
  const maxVal = Math.max(...nearby.map((o) => o.price));

  // 1. Freshness & Age penalty calculation using mean age of all candidates
  const ages = nearby
    .map((c) => c.age)
    .filter((age): age is number => age !== undefined);
  const avgAgeBars = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 400;

  // Real time estimation based on timeframe
  let barDurationMinutes = 60;
  const tf = timeframe.toLowerCase();
  if (tf === "5m") barDurationMinutes = 5;
  else if (tf === "15m") barDurationMinutes = 15;
  else if (tf === "4h") barDurationMinutes = 240;
  else if (tf === "1d") barDurationMinutes = 1440;
  else if (tf === "1w") barDurationMinutes = 10080;

  const avgAgeMinutes = avgAgeBars * barDurationMinutes;
  let ageString = "";
  if (avgAgeMinutes < 60) {
    ageString = `${Math.round(avgAgeMinutes)} นาที`;
  } else if (avgAgeMinutes < 1440) {
    ageString = `${Math.round(avgAgeMinutes / 60)} ชั่วโมง`;
  } else {
    ageString = `${Math.round(avgAgeMinutes / 1440)} วัน`;
  }

  let freshness: ZoneFreshness = "historical";
  if (avgAgeBars <= profile.freshBars) {
    freshness = "fresh";
    freshnessScore = 1.0;
    reasons.push(`โซนสดใหม่ (เฉลี่ย ${ageString} ที่ผ่านมา)`);
  } else if (avgAgeBars <= profile.recentBars) {
    freshness = "recent";
    freshnessScore = 0.0;
    reasons.push(`โซนระยะกลาง (เฉลี่ย ${ageString})`);
  } else if (avgAgeBars <= profile.agedBars) {
    freshness = "aged";
    freshnessScore = -1.0;
    reasons.push(`โซนเก่า (เฉลี่ย ${ageString})`);
  } else {
    freshness = "historical";
    freshnessScore = -2.0;
    reasons.push(`โซนประวัติศาสตร์ (เฉลี่ย ${ageString})`);
  }

  // 2. Confluence Checks (EMA & Pivot Points & Structural variety)
  const emas: string[] = [];
  if (indicators.ema20 > 0 && Math.abs(indicators.ema20 - mid) <= threshold) {
    emas.push("EMA 20");
    confluenceScore += 1.5;
  }
  if (indicators.ema50 > 0 && Math.abs(indicators.ema50 - mid) <= threshold) {
    emas.push("EMA 50");
    confluenceScore += 1.5;
  }
  if (indicators.ema200 > 0 && Math.abs(indicators.ema200 - mid) <= threshold) {
    emas.push("EMA 200");
    confluenceScore += 2.0;
  }

  const vwapLevels: string[] = [];
  if (indicators.vwap > 0 && Math.abs(indicators.vwap - mid) <= threshold) {
    vwapLevels.push("Session VWAP");
    confluenceScore += 1.25;
  }
  if (indicators.anchoredVwap?.value && Math.abs(indicators.anchoredVwap.value - mid) <= threshold) {
    vwapLevels.push(`Anchored VWAP (${indicators.anchoredVwap.anchorType.replace("_", " ")})`);
    confluenceScore += 1.5;
  }

  const pivots: string[] = [];
  const p = indicators.pivot;
  if (Math.abs(p.r1 - mid) <= threshold) { pivots.push("Pivot R1"); confluenceScore += 1.0; }
  if (Math.abs(p.r2 - mid) <= threshold) { pivots.push("Pivot R2"); confluenceScore += 1.0; }
  if (Math.abs(p.r3 - mid) <= threshold) { pivots.push("Pivot R3"); confluenceScore += 1.0; }
  if (Math.abs(p.s1 - mid) <= threshold) { pivots.push("Pivot S1"); confluenceScore += 1.0; }
  if (Math.abs(p.s2 - mid) <= threshold) { pivots.push("Pivot S2"); confluenceScore += 1.0; }
  if (Math.abs(p.s3 - mid) <= threshold) { pivots.push("Pivot S3"); confluenceScore += 1.0; }

  if (swingHighs + swingLows > 0 && (fvgs > 0 || obs > 0)) {
    confluenceScore += 1.0;
  }

  if (swingHighs > 0) reasons.push(`ทดสอบ Swing High ${swingHighs} จุด`);
  if (swingLows > 0) reasons.push(`ทดสอบ Swing Low ${swingLows} จุด`);
  if (fvgs > 0) reasons.push(`มีช่องว่างราคา Fair Value Gap (FVG)`);
  if (obs > 0) reasons.push(`มีบล็อกออเดอร์สำคัญ (Order Block)`);
  if (buySideLiquidity > 0) reasons.push(`Buy-side liquidity: Equal High ที่ยังไม่ถูกกวาด`);
  if (sellSideLiquidity > 0) reasons.push(`Sell-side liquidity: Equal Low ที่ยังไม่ถูกกวาด`);
  if (emas.length > 0) reasons.push(`แนว EMA Confluence: ${emas.join(", ")}`);
  if (vwapLevels.length > 0) reasons.push(`แนว VWAP Confluence: ${vwapLevels.join(", ")}`);
  if (pivots.length > 0) reasons.push(`ระดับ Pivot: ${pivots.join(", ")}`);
  if (roundNumber) reasons.push("แนวระดับราคาจิตวิทยา (เลขกลม)");

  const zoneType = mid < currentPrice ? "support" : "resistance";

  // 3. Reaction History Backtesting
  let touches = 0;
  let successfulReactions = 0;
  let failedReactions = 0;
  let lastTouchAge: number | null = null;

  const reactionPadding = Math.max(threshold * 0.25, indicators.atr14 * 0.15);
  const touchLower = Math.min(minVal, mid - reactionPadding);
  const touchUpper = Math.max(maxVal, mid + reactionPadding);
  const searchStartIndex = nearby.reduce((minIdx, c) => Math.min(minIdx, c.index ?? 0), klines.length - 1);

  let lastTouchIdx = -10;
  for (let i = Math.max(1, searchStartIndex); i < klines.length - 1; i++) {
    const bar = klines[i];
    const touched = bar.low <= touchUpper && bar.high >= touchLower;

    if (touched && i - lastTouchIdx >= 3) {
      touches++;
      lastTouchIdx = i;
      lastTouchAge = klines.length - 1 - i;

      const nextBar = klines[i + 1];
      if (zoneType === "support") {
        if (bar.close >= touchLower && nextBar && nextBar.close > bar.close) {
          successfulReactions++;
        } else if (bar.close < touchLower - reactionPadding * 0.5) {
          failedReactions++;
        }
      } else {
        if (bar.close <= touchUpper && nextBar && nextBar.close < bar.close) {
          successfulReactions++;
        } else if (bar.close > touchUpper + reactionPadding * 0.5) {
          failedReactions++;
        }
      }
    }
  }

  // 4. Status Determination & S/R Flip detection
  // S/R Flip must verify: Breach -> Close confirm -> Retest -> Swap
  let isFlipped = false;
  let firstBreachIdx = -1;
  let retestCount = 0;
  for (let i = Math.max(1, searchStartIndex); i < klines.length; i++) {
    const bar = klines[i];
    if (firstBreachIdx === -1) {
      if (zoneType === "support" && bar.close < mid) {
        firstBreachIdx = i;
      } else if (zoneType === "resistance" && bar.close > mid) {
        firstBreachIdx = i;
      }
    } else {
      const touchesAgain = bar.low <= touchUpper && bar.high >= touchLower;
      if (touchesAgain) {
        if (zoneType === "support" && bar.close < mid * 1.002) {
          retestCount++;
        } else if (zoneType === "resistance" && bar.close > mid * 0.998) {
          retestCount++;
        }
      }
    }
  }
  if (firstBreachIdx !== -1 && retestCount >= 1) {
    isFlipped = true;
  }

  let status: ZoneStatus = "active";
  if (isFlipped) {
    status = "flipped";
    flipScore += 2.0;
    reasons.push(`แนวกลับสลับขั้วสำเร็จ (S/R Flip Confirmed: Retest ${retestCount} ครั้ง)`);
  } else if (failedReactions > 0 && lastTouchAge !== null && lastTouchAge <= 25) {
    status = "broken";
    reasons.push("เพิ่งถูกทะลุผ่านในระยะหลัง (Broken Level)");
  } else if (touches >= 3 && successfulReactions / touches <= 0.45) {
    status = "weakened";
    reasons.push("ถูกทดสอบบ่อยครั้งจนแรงเด้งลดลง (Weakened Level)");
  } else if (touches > 0) {
    status = "tested";
  }

  if (touches > 0) {
    reactionScore += Math.min(2.0, successfulReactions * 0.5);
    reactionScore -= Math.min(2.5, failedReactions * 0.8);
    const winRate = Math.round((successfulReactions / touches) * 100);
    reasons.push(`สถิติทดสอบ: แตะ ${touches} ครั้ง, เด้งสำเร็จ ${successfulReactions} ครั้ง, อัตราความสำเร็จ ${winRate}%`);
  }

  // 5. Final Score & Strength Classification
  const rawTotal = baseScore + volumeScore + confluenceScore + freshnessScore + reactionScore + flipScore;
  const finalScore = Math.min(10, Math.max(1, Math.round(rawTotal)));

  let strength: ZoneStrength = "weak";
  if ((finalScore >= 8 && (freshness === "fresh" || freshness === "recent")) || (finalScore >= 7 && (confluenceScore >= 2.5 || flipScore > 0))) {
    strength = "major";
  } else if (finalScore >= 6 || (finalScore >= 5 && freshness === "fresh")) {
    strength = "strong";
  } else if (finalScore >= 4 || status === "tested") {
    strength = "moderate";
  } else {
    strength = "weak";
  }

  const components: ZoneComponents = {
    baseScore: Number(baseScore.toFixed(2)),
    volumeScore: Number(volumeScore.toFixed(2)),
    confluenceScore: Number(confluenceScore.toFixed(2)),
    freshnessScore: Number(freshnessScore.toFixed(2)),
    reactionScore: Number(reactionScore.toFixed(2)),
    flipScore: Number(flipScore.toFixed(2)),
    finalScore,
  };

  return {
    score: finalScore,
    reasons,
    freshness,
    strength,
    status,
    touches,
    successfulReactions,
    failedReactions,
    lastTouchAge,
    components,
    ageString,
    liquidity: buySideLiquidity > 0 && sellSideLiquidity > 0
      ? "mixed"
      : buySideLiquidity > 0
        ? "buy_side"
        : sellSideLiquidity > 0
          ? "sell_side"
          : undefined,
    _mid: mid,
    _minVal: minVal,
    _maxVal: maxVal,
  };
}

export function calculateSupportResistance(
  klines: KlineData[],
  indicators: IndicatorData,
  currentPrice: number,
  timeframe = "1H",
  assetClass: AssetClass = "equity"
): SupportResistanceData {
  if (!klines || klines.length < 20) {
    throw new Error("ข้อมูลแท่งเทียนไม่เพียงพอสำหรับการคำนวณแนวรับแนวต้าน (ต้องการอย่างน้อย 20 แท่ง)");
  }

  const len = klines.length;
  const candidates: CandidatePoint[] = [];
  const profile = getTimeframeProfile(timeframe, len, assetClass);

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  const historyLookback = Math.max(0, len - profile.historyBars);
  for (let i = historyLookback; i < len; i++) {
    if (klines[i].low < minPrice) minPrice = klines[i].low;
    if (klines[i].high > maxPrice) maxPrice = klines[i].high;
  }

  const avgVolume = klines.reduce((sum, k) => sum + k.volume, 0) / len;

  // 1. Detect swing points using a window calibrated to the selected timeframe.
  const W = profile.swingWindow;
  for (let i = Math.max(W, historyLookback); i < len - W; i++) {
    const currentHigh = klines[i].high;
    const currentLow = klines[i].low;

    let isSwingHigh = true;
    for (let j = i - W; j <= i + W; j++) {
      if (j !== i && klines[j].high > currentHigh) {
        isSwingHigh = false;
        break;
      }
    }
    if (isSwingHigh) {
      candidates.push({
        price: currentHigh,
        type: "swing_high",
        name: `Swing High (#${i})`,
        volume: klines[i].volume,
        index: i,
        age: len - 1 - i,
      });
    }

    let isSwingLow = true;
    for (let j = i - W; j <= i + W; j++) {
      if (j !== i && klines[j].low < currentLow) {
        isSwingLow = false;
        break;
      }
    }
    if (isSwingLow) {
      candidates.push({
        price: currentLow,
        type: "swing_low",
        name: `Swing Low (#${i})`,
        volume: klines[i].volume,
        index: i,
        age: len - 1 - i,
      });
    }
  }

  // 2. Smart Money Concepts (FVG & Order Blocks)
  // FVGs are actionable only while price has never traded back into their gap.
  // Keep one: the newest untouched bullish gap and the newest untouched bearish
  // gap. This prevents old or already-mitigated imbalances from influencing S/R.
  const fvgStart = Math.max(2, Math.max(historyLookback, len - 300));
  const minimumFvgSize = Math.max(
    indicators.atr14 * 0.12,
    currentPrice * profile.minZoneHalfWidthPercent * 0.5
  );
  let latestBullishFvg: CandidatePoint | null = null;
  let latestBearishFvg: CandidatePoint | null = null;

  const isFvgMitigated = (gapLow: number, gapHigh: number, formedAt: number) => {
    for (let barIndex = formedAt + 1; barIndex < len; barIndex++) {
      const bar = klines[barIndex];
      // Any subsequent candle that enters the imbalance marks it as mitigated.
      if (bar.low <= gapHigh && bar.high >= gapLow) return true;
    }
    return false;
  };

  for (let i = fvgStart; i < len; i++) {
    const c1 = klines[i - 2];
    const c2 = klines[i - 1];
    const c3 = klines[i];

    if (c1.high < c3.low && c2.close > c2.open) {
      const gapLow = c1.high;
      const gapHigh = c3.low;
      if (
        gapHigh - gapLow >= minimumFvgSize &&
        !isFvgMitigated(gapLow, gapHigh, i)
      ) {
        latestBullishFvg = {
          price: (gapLow + gapHigh) / 2,
          type: "fvg",
          name: "Latest unmitigated Bullish FVG (Demand)",
          index: i,
          age: len - 1 - i,
        };
      }
      if (c1.close < c1.open) {
        candidates.push({
          price: (c1.open + c1.close) / 2,
          type: "orderblock",
          name: "Bullish OB",
          index: i,
          age: len - 1 - i,
        });
      }
    }

    if (c1.low > c3.high && c2.close < c2.open) {
      const gapLow = c3.high;
      const gapHigh = c1.low;
      if (
        gapHigh - gapLow >= minimumFvgSize &&
        !isFvgMitigated(gapLow, gapHigh, i)
      ) {
        latestBearishFvg = {
          price: (gapLow + gapHigh) / 2,
          type: "fvg",
          name: "Latest unmitigated Bearish FVG (Supply)",
          index: i,
          age: len - 1 - i,
        };
      }
      if (c1.close > c1.open) {
        candidates.push({
          price: (c1.open + c1.close) / 2,
          type: "orderblock",
          name: "Bearish OB",
          index: i,
          age: len - 1 - i,
        });
      }
    }
  }

  if (latestBullishFvg) candidates.push(latestBullishFvg);
  if (latestBearishFvg) candidates.push(latestBearishFvg);

  // Gold and silver frequently run resting stops around equal highs/lows before
  // choosing direction. Surface only the newest unswept pool on each side.
  if (assetClass === "precious_metal") {
    const liquidityTolerance = Math.max(indicators.atr14 * 0.28, currentPrice * 0.0008);
    const sweepBuffer = Math.max(indicators.atr14 * 0.12, currentPrice * 0.0003);

    const findLatestLiquidityPool = (
      swingType: "swing_high" | "swing_low",
      liquidityType: "buy_side_liquidity" | "sell_side_liquidity",
      name: string
    ): CandidatePoint | null => {
      const swings = candidates.filter(
        (candidate) => candidate.type === swingType && candidate.index !== undefined
      );
      let latestPool: CandidatePoint | null = null;

      for (let laterIndex = 1; laterIndex < swings.length; laterIndex++) {
        const later = swings[laterIndex];
        for (let earlierIndex = laterIndex - 1; earlierIndex >= 0; earlierIndex--) {
          const earlier = swings[earlierIndex];
          if ((later.index! - earlier.index!) < W * 2) continue;
          if (Math.abs(later.price - earlier.price) > liquidityTolerance) continue;

          const poolPrice = (later.price + earlier.price) / 2;
          let swept = false;
          for (let barIndex = later.index! + 1; barIndex < len; barIndex++) {
            const bar = klines[barIndex];
            if (
              (liquidityType === "buy_side_liquidity" && bar.high >= poolPrice + sweepBuffer) ||
              (liquidityType === "sell_side_liquidity" && bar.low <= poolPrice - sweepBuffer)
            ) {
              swept = true;
              break;
            }
          }

          if (!swept) {
            latestPool = {
              price: poolPrice,
              type: liquidityType,
              name,
              index: later.index,
              age: len - 1 - later.index!,
            };
          }
          break;
        }
      }

      return latestPool;
    };

    const buySideLiquidity = findLatestLiquidityPool(
      "swing_high",
      "buy_side_liquidity",
      "Buy-side Liquidity (Equal High)"
    );
    const sellSideLiquidity = findLatestLiquidityPool(
      "swing_low",
      "sell_side_liquidity",
      "Sell-side Liquidity (Equal Low)"
    );
    if (buySideLiquidity) candidates.push(buySideLiquidity);
    if (sellSideLiquidity) candidates.push(sellSideLiquidity);
  }

  // 3. Add Psychological round numbers
  let step = 1000;
  if (currentPrice > 30000) step = 1000;
  else if (currentPrice > 1000) step = 100;
  else if (currentPrice > 100) step = 10;
  else if (currentPrice > 10) step = 1;
  else step = 0.1;

  const startRound = Math.ceil(minPrice / step) * step;
  const endRound = Math.floor(maxPrice / step) * step;
  for (let pr = startRound; pr <= endRound; pr += step) {
    candidates.push({
      price: pr,
      type: "round_number",
      name: `เลขกลม ${pr.toLocaleString()}`,
    });
  }

  // 4. Neighborhood density assessment
  const atrThreshold = indicators.atr14 > 0
    ? Math.min(
      currentPrice * profile.maxClusterPercent,
      Math.max(currentPrice * profile.minClusterPercent, indicators.atr14 * profile.clusterAtrMultiplier)
    )
    : currentPrice * ((profile.minClusterPercent + profile.maxClusterPercent) / 2);
  const threshold = atrThreshold;

  const rawZones = candidates.map((c) => {
    const nearby = candidates.filter((other) => Math.abs(other.price - c.price) <= threshold);
    const groupRes = calculateGroupScore(nearby, klines, indicators, currentPrice, threshold, avgVolume, timeframe, profile);

    let lower = groupRes._minVal;
    let upper = groupRes._maxVal;
    if (lower === upper) {
      const halfWidth = Math.max(currentPrice * profile.minZoneHalfWidthPercent, indicators.atr14 * 0.3);
      lower = Math.max(0, lower - halfWidth);
      upper = upper + halfWidth;
    }

    const type: "support" | "resistance" = groupRes._mid < currentPrice ? "support" : "resistance";

    let zoneStr = "";
    if (currentPrice > 1000) {
      zoneStr = `${Math.round(lower).toLocaleString()}-${Math.round(upper).toLocaleString()}`;
    } else {
      zoneStr = `${lower.toFixed(2)}-${upper.toFixed(2)}`;
    }

    const distancePercent = (Math.abs(groupRes._mid - currentPrice) / currentPrice) * 100;

    const zoneObj: SupportResistanceZone & { _mid: number } = {
      zone: zoneStr,
      type,
      score: groupRes.score,
      reasons: groupRes.reasons,
      freshness: groupRes.freshness,
      strength: groupRes.strength,
      status: groupRes.status,
      touches: groupRes.touches,
      successfulReactions: groupRes.successfulReactions,
      failedReactions: groupRes.failedReactions,
      lastTouchAge: groupRes.lastTouchAge,
      components: groupRes.components,
      ageString: groupRes.ageString,
      liquidity: groupRes.liquidity,
      distancePercent: Number(distancePercent.toFixed(2)),
      timeframe,
      _mid: groupRes._mid,
    };

    return zoneObj;
  });

  // 5. Non-Maximum Suppression (NMS)
  const minSeparation = Math.max(
    currentPrice * profile.minSeparationPercent,
    indicators.atr14 * profile.minSeparationAtrMultiplier
  );
  const selectedZones: typeof rawZones = [];
  const sortedRawZones = [...rawZones].sort((a, b) => b.score - a.score);

  for (const zone of sortedRawZones) {
    const isTooClose = selectedZones.some(
      (sel) => sel.type === zone.type && Math.abs(sel._mid - zone._mid) < minSeparation
    );
    if (!isTooClose) {
      selectedZones.push(zone);
    }
  }

  const selectZones = (zones: typeof rawZones) => {
    const viable = zones.filter((zone) => zone.status !== "broken");
    const pool = viable.length > 0 ? viable : zones;
    const byDistance = [...pool].sort((a, b) => (a.distancePercent || 0) - (b.distancePercent || 0));
    const byStructure = [...pool].sort((a, b) => {
      const aBonus = (a.strength === "major" ? 2 : a.strength === "strong" ? 1 : 0) + (a.freshness === "fresh" ? 1 : 0);
      const bBonus = (b.strength === "major" ? 2 : b.strength === "strong" ? 1 : 0) + (b.freshness === "fresh" ? 1 : 0);
      return (b.score + bBonus) - (a.score + aBonus);
    });

    const selected: Array<(typeof rawZones)[number] & { role: "nearest" | "structural" | "secondary" }> = [];
    const add = (zone: (typeof rawZones)[number] | undefined, role: "nearest" | "structural" | "secondary") => {
      if (zone && !selected.some((item) => Math.abs(item._mid - zone._mid) < minSeparation / 2)) {
        selected.push({ ...zone, role });
      }
    };

    add(byDistance[0], "nearest");
    add(byStructure[0], "structural");
    for (const zone of byStructure) {
      if (selected.length >= 3) break;
      add(zone, "secondary");
    }

    return selected;
  };

  const topSupports = selectZones(selectedZones.filter((z) => z.type === "support"));
  const topResistances = selectZones(selectedZones.filter((z) => z.type === "resistance"));

  const supportZones: SupportResistanceZone[] = topSupports.map(({ _mid, ...rest }) => rest);
  const resistanceZones: SupportResistanceZone[] = topResistances.map(({ _mid, ...rest }) => rest);

  return {
    supportZones,
    resistanceZones,
  };
}
