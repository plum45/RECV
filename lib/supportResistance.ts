import { KlineData, IndicatorData, SupportResistanceZone, SupportResistanceData } from "../types/market";

interface CandidatePoint {
  price: number;
  type: "swing_high" | "swing_low" | "fvg" | "orderblock" | "round_number";
  name: string;
  volume?: number;
}

function calculateGroupScore(
  nearby: CandidatePoint[],
  indicators: IndicatorData,
  currentPrice: number,
  threshold: number,
  avgVolume: number
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  let swingHighs = 0;
  let swingLows = 0;
  let roundNumber = false;
  let fvgs = 0;
  let obs = 0;

  nearby.forEach((c) => {
    if (c.type === "swing_high") {
      swingHighs++;
      let ptScore = 1.8;
      if (c.volume && c.volume > avgVolume) {
        const ratio = Math.min(2.0, c.volume / avgVolume);
        ptScore += 1.2 * (ratio - 1);
      }
      score += ptScore;
    } else if (c.type === "swing_low") {
      swingLows++;
      let ptScore = 1.8;
      if (c.volume && c.volume > avgVolume) {
        const ratio = Math.min(2.0, c.volume / avgVolume);
        ptScore += 1.2 * (ratio - 1);
      }
      score += ptScore;
    } else if (c.type === "round_number") {
      roundNumber = true;
      score += 0.5;
    } else if (c.type === "fvg") {
      fvgs++;
      score += 2.0;
    } else if (c.type === "orderblock") {
      obs++;
      score += 2.5;
    }
  });

  // Midpoint of this local group
  const mid = nearby.reduce((sum, o) => sum + o.price, 0) / nearby.length;

  // Check EMA Confluences dynamically
  const emas: string[] = [];
  if (indicators.ema20 > 0 && Math.abs(indicators.ema20 - mid) <= threshold) {
    emas.push("EMA 20");
    score += 1.5;
  }
  if (indicators.ema50 > 0 && Math.abs(indicators.ema50 - mid) <= threshold) {
    emas.push("EMA 50");
    score += 1.5;
  }
  if (indicators.ema200 > 0 && Math.abs(indicators.ema200 - mid) <= threshold) {
    emas.push("EMA 200");
    score += 2.0;
  }

  // Check Pivot Point Confluences dynamically
  const pivots: string[] = [];
  const p = indicators.pivot;
  if (Math.abs(p.r1 - mid) <= threshold) { pivots.push("Pivot R1"); score += 1.0; }
  if (Math.abs(p.r2 - mid) <= threshold) { pivots.push("Pivot R2"); score += 1.0; }
  if (Math.abs(p.r3 - mid) <= threshold) { pivots.push("Pivot R3"); score += 1.0; }
  if (Math.abs(p.s1 - mid) <= threshold) { pivots.push("Pivot S1"); score += 1.0; }
  if (Math.abs(p.s2 - mid) <= threshold) { pivots.push("Pivot S2"); score += 1.0; }
  if (Math.abs(p.s3 - mid) <= threshold) { pivots.push("Pivot S3"); score += 1.0; }

  // Build reasons array
  if (swingHighs > 0) reasons.push(`ทดสอบ Swing High ${swingHighs} ครั้ง`);
  if (swingLows > 0) reasons.push(`ทดสอบ Swing Low ${swingLows} ครั้ง`);
  if (fvgs > 0) reasons.push(`มีช่องว่างราคา Fair Value Gap (FVG)`);
  if (obs > 0) reasons.push(`มีบล็อกออเดอร์สำคัญ (Order Block)`);
  if (emas.length > 0) reasons.push(`แนว EMA Confluence: ${emas.join(", ")}`);
  if (pivots.length > 0) reasons.push(`ระดับ Pivot: ${pivots.join(", ")}`);
  if (roundNumber) reasons.push("แนวระดับราคาจิตวิทยา (เลขกลม)");

  const zoneType = mid < currentPrice ? "support" : "resistance";

  // S/R Flip detection
  let adjustedScore = score;
  if (zoneType === "support" && swingHighs > 0) {
    reasons.push("แนวต้านเก่าเปลี่ยนเป็นแนวรับ (S/R Flip)");
    adjustedScore += 0.5;
  } else if (zoneType === "resistance" && swingLows > 0) {
    reasons.push("แนวรับเก่าเปลี่ยนเป็นแนวต้าน (S/R Flip)");
    adjustedScore += 0.5;
  }

  const finalScore = Math.min(10, Math.max(1, Math.round(adjustedScore)));
  return { score: finalScore, reasons };
}

export function calculateSupportResistance(
  klines: KlineData[],
  indicators: IndicatorData,
  currentPrice: number
): SupportResistanceData {
  const len = klines.length;
  const candidates: CandidatePoint[] = [];

  // Find Min and Max prices in the range
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  const historyLookback = Math.max(0, len - 450);
  for (let i = historyLookback; i < len; i++) {
    if (klines[i].low < minPrice) minPrice = klines[i].low;
    if (klines[i].high > maxPrice) maxPrice = klines[i].high;
  }

  const avgVolume = klines.reduce((sum, k) => sum + k.volume, 0) / len;

  // 1. Detect Swing Highs and Swing Lows (W = 12 for high-impact swing levels)
  const W = 12;
  for (let i = Math.max(W, historyLookback); i < len - W; i++) {
    const currentHigh = klines[i].high;
    const currentLow = klines[i].low;

    // Check Swing High
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
      });
    }

    // Check Swing Low
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
      });
    }
  }

  // 2. Smart Money Concepts (FVG & Order Blocks)
  for (let i = Math.max(2, len - 300); i < len; i++) {
    const c1 = klines[i - 2];
    const c2 = klines[i - 1];
    const c3 = klines[i];

    // Bullish FVG
    if (c1.high < c3.low && c2.close > c2.open) {
      const fvgMid = (c1.high + c3.low) / 2;
      candidates.push({ price: fvgMid, type: "fvg", name: "Bullish FVG (Demand)" });
      if (c1.close < c1.open) {
        candidates.push({ price: (c1.open + c1.close)/2, type: "orderblock", name: "Bullish OB" });
      }
    }
    
    // Bearish FVG
    if (c1.low > c3.high && c2.close < c2.open) {
      const fvgMid = (c1.low + c3.high) / 2;
      candidates.push({ price: fvgMid, type: "fvg", name: "Bearish FVG (Supply)" });
      if (c1.close > c1.open) {
        candidates.push({ price: (c1.open + c1.close)/2, type: "orderblock", name: "Bearish OB" });
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
  const threshold = currentPrice * 0.010; // 1.0% radius for local grouping
  
  const rawZones = candidates.map((c) => {
    const nearby = candidates.filter((other) => Math.abs(other.price - c.price) <= threshold);
    const minVal = Math.min(...nearby.map(o => o.price));
    const maxVal = Math.max(...nearby.map(o => o.price));
    const mid = nearby.reduce((sum, o) => sum + o.price, 0) / nearby.length;

    let lower = minVal;
    let upper = maxVal;
    if (minVal === maxVal) {
      lower = minVal * 0.995;
      upper = maxVal * 1.005;
    }

    const { score, reasons } = calculateGroupScore(nearby, indicators, currentPrice, threshold, avgVolume);
    const type = mid < currentPrice ? "support" : "resistance";

    let zoneStr = "";
    if (currentPrice > 1000) {
      zoneStr = `${Math.round(lower).toLocaleString()}-${Math.round(upper).toLocaleString()}`;
    } else {
      zoneStr = `${lower.toFixed(2)}-${upper.toFixed(2)}`;
    }

    return {
      zone: zoneStr,
      type,
      score,
      reasons,
      _mid: mid,
    };
  });

  // 5. Non-Maximum Suppression (NMS) to eliminate overlapping zones
  // Spacing separation of at least 1.8% of current price to guarantee distinct levels
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

  // 6. Immediate price guard filter (exclude levels within 0.6% of current price)
  const immediateZoneGuard = currentPrice * 0.006;
  const filteredZones = selectedZones.filter(
    (z) => Math.abs(z._mid - currentPrice) >= immediateZoneGuard
  );

  const supportZonesRaw = filteredZones.filter((z) => z.type === "support");
  const resistanceZonesRaw = filteredZones.filter((z) => z.type === "resistance");

  // Select top 3 support zones by score descending, then order by price descending
  const topSupports = supportZonesRaw
    .sort((a, b) => b.score - a.score || b._mid - a._mid)
    .slice(0, 3);
  const supportZones = topSupports
    .sort((a, b) => b._mid - a._mid)
    .map(({ zone, type, score, reasons }) => ({ zone, type, score, reasons }));

  // Select top 3 resistance zones by score descending, then order by price ascending
  const topResistances = resistanceZonesRaw
    .sort((a, b) => b.score - a.score || a._mid - b._mid)
    .slice(0, 3);
  const resistanceZones = topResistances
    .sort((a, b) => a._mid - b._mid)
    .map(({ zone, type, score, reasons }) => ({ zone, type, score, reasons }));

  return {
    supportZones,
    resistanceZones,
  };
}
