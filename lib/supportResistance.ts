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

interface CandidatePoint {
  price: number;
  type: "swing_high" | "swing_low" | "fvg" | "orderblock" | "round_number";
  name: string;
  volume?: number;
  index?: number;
  age?: number;
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
  timeframe = "1H"
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
  if (avgAgeBars <= 80) {
    freshness = "fresh";
    freshnessScore = 1.0;
    reasons.push(`โซนสดใหม่ (เฉลี่ย ${ageString} ที่ผ่านมา)`);
  } else if (avgAgeBars <= 200) {
    freshness = "recent";
    freshnessScore = 0.0;
    reasons.push(`โซนระยะกลาง (เฉลี่ย ${ageString})`);
  } else if (avgAgeBars <= 350) {
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
  if (emas.length > 0) reasons.push(`แนว EMA Confluence: ${emas.join(", ")}`);
  if (pivots.length > 0) reasons.push(`ระดับ Pivot: ${pivots.join(", ")}`);
  if (roundNumber) reasons.push("แนวระดับราคาจิตวิทยา (เลขกลม)");

  const zoneType = mid < currentPrice ? "support" : "resistance";

  // 3. Reaction History Backtesting
  let touches = 0;
  let successfulReactions = 0;
  let failedReactions = 0;
  let lastTouchAge: number | null = null;

  const touchLower = Math.min(minVal, mid * 0.9985);
  const touchUpper = Math.max(maxVal, mid * 1.0015);
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
        } else if (bar.close < touchLower * 0.998) {
          failedReactions++;
        }
      } else {
        if (bar.close <= touchUpper && nextBar && nextBar.close < bar.close) {
          successfulReactions++;
        } else if (bar.close > touchUpper * 1.002) {
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
    _mid: mid,
    _minVal: minVal,
    _maxVal: maxVal,
  };
}

export function calculateSupportResistance(
  klines: KlineData[],
  indicators: IndicatorData,
  currentPrice: number,
  timeframe = "1H"
): SupportResistanceData {
  if (!klines || klines.length < 20) {
    throw new Error("ข้อมูลแท่งเทียนไม่เพียงพอสำหรับการคำนวณแนวรับแนวต้าน (ต้องการอย่างน้อย 20 แท่ง)");
  }

  const len = klines.length;
  const candidates: CandidatePoint[] = [];

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  const historyLookback = Math.max(0, len - 450);
  for (let i = historyLookback; i < len; i++) {
    if (klines[i].low < minPrice) minPrice = klines[i].low;
    if (klines[i].high > maxPrice) maxPrice = klines[i].high;
  }

  const avgVolume = klines.reduce((sum, k) => sum + k.volume, 0) / len;

  // 1. Detect Swing Highs and Swing Lows (W = 12)
  const W = 12;
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
  for (let i = Math.max(2, len - 300); i < len; i++) {
    const c1 = klines[i - 2];
    const c2 = klines[i - 1];
    const c3 = klines[i];

    if (c1.high < c3.low && c2.close > c2.open) {
      const fvgMid = (c1.high + c3.low) / 2;
      candidates.push({
        price: fvgMid,
        type: "fvg",
        name: "Bullish FVG (Demand)",
        index: i,
        age: len - 1 - i,
      });
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
      const fvgMid = (c1.low + c3.high) / 2;
      candidates.push({
        price: fvgMid,
        type: "fvg",
        name: "Bearish FVG (Supply)",
        index: i,
        age: len - 1 - i,
      });
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
    ? Math.min(currentPrice * 0.015, Math.max(currentPrice * 0.006, indicators.atr14 * 0.75))
    : currentPrice * 0.010;
  const threshold = atrThreshold;

  const rawZones = candidates.map((c) => {
    const nearby = candidates.filter((other) => Math.abs(other.price - c.price) <= threshold);
    const groupRes = calculateGroupScore(nearby, klines, indicators, currentPrice, threshold, avgVolume, timeframe);

    let lower = groupRes._minVal;
    let upper = groupRes._maxVal;
    if (lower === upper) {
      lower = lower * 0.995;
      upper = upper * 1.005;
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
      distancePercent: Number(distancePercent.toFixed(2)),
      _mid: groupRes._mid,
    };

    return zoneObj;
  });

  // 5. Non-Maximum Suppression (NMS)
  const minSeparation = currentPrice * 0.018;
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

  // 6. Proximity filter: Filter out zones that are closer than 0.5% to the current price
  const filteredZones = selectedZones.filter((z) => {
    return z.distancePercent !== undefined && z.distancePercent >= 0.5;
  });

  const supportZonesRaw = filteredZones.filter((z) => z.type === "support");
  const resistanceZonesRaw = filteredZones.filter((z) => z.type === "resistance");

  const topSupports = supportZonesRaw
    .sort((a, b) => {
      const aBonus = (a.freshness === "fresh" ? 1.5 : 0) + (a.status === "active" ? 1 : 0);
      const bBonus = (b.freshness === "fresh" ? 1.5 : 0) + (b.status === "active" ? 1 : 0);
      return (b.score + bBonus) - (a.score + aBonus) || b._mid - a._mid;
    })
    .slice(0, 3);

  const supportZones: SupportResistanceZone[] = topSupports
    .sort((a, b) => b._mid - a._mid)
    .map(({ _mid, ...rest }) => rest);

  const topResistances = resistanceZonesRaw
    .sort((a, b) => {
      const aBonus = (a.freshness === "fresh" ? 1.5 : 0) + (a.status === "active" ? 1 : 0);
      const bBonus = (b.freshness === "fresh" ? 1.5 : 0) + (b.status === "active" ? 1 : 0);
      return (b.score + bBonus) - (a.score + aBonus) || a._mid - b._mid;
    })
    .slice(0, 3);

  const resistanceZones: SupportResistanceZone[] = topResistances
    .sort((a, b) => a._mid - b._mid)
    .map(({ _mid, ...rest }) => rest);

  return {
    supportZones,
    resistanceZones,
  };
}
