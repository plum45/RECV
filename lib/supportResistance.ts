import { KlineData, IndicatorData, SupportResistanceZone, SupportResistanceData } from "../types/market";

interface CandidatePoint {
  price: number;
  type: "swing_high" | "swing_low" | "ema" | "pivot" | "round_number" | "fvg" | "orderblock";
  name: string;
  volume?: number;
}

export function calculateSupportResistance(
  klines: KlineData[],
  indicators: IndicatorData,
  currentPrice: number
): SupportResistanceData {
  const len = klines.length;
  const candidates: CandidatePoint[] = [];

  // Find Min and Max prices in the range to determine psychological levels
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  const historyLookback = Math.max(0, len - 450);
  for (let i = historyLookback; i < len; i++) {
    if (klines[i].low < minPrice) minPrice = klines[i].low;
    if (klines[i].high > maxPrice) maxPrice = klines[i].high;
  }

  // 1. Detect Swing Highs and Swing Lows (Window W = 5)
  const W = 5;
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

  // 2. Add EMA Confluences
  if (indicators.ema20 > 0) candidates.push({ price: indicators.ema20, type: "ema", name: "EMA 20" });
  if (indicators.ema50 > 0) candidates.push({ price: indicators.ema50, type: "ema", name: "EMA 50" });
  if (indicators.ema200 > 0) candidates.push({ price: indicators.ema200, type: "ema", name: "EMA 200" });

  // 3. Add Pivot Points (R1, R2, R3, S1, S2, S3)
  const p = indicators.pivot;
  candidates.push({ price: p.r1, type: "pivot", name: "Pivot R1" });
  candidates.push({ price: p.r2, type: "pivot", name: "Pivot R2" });
  candidates.push({ price: p.r3, type: "pivot", name: "Pivot R3" });
  candidates.push({ price: p.s1, type: "pivot", name: "Pivot S1" });
  candidates.push({ price: p.s2, type: "pivot", name: "Pivot S2" });
  candidates.push({ price: p.s3, type: "pivot", name: "Pivot S3" });

  // 3.5 Smart Money Concepts (FVG & Order Blocks)
  for (let i = Math.max(2, len - 300); i < len; i++) {
    const c1 = klines[i - 2];
    const c2 = klines[i - 1];
    const c3 = klines[i];

    // Bullish FVG: c1 high < c3 low
    if (c1.high < c3.low && c2.close > c2.open) {
      const fvgMid = (c1.high + c3.low) / 2;
      candidates.push({ price: fvgMid, type: "fvg", name: "Bullish FVG (Demand)" });
      if (c1.close < c1.open) {
        candidates.push({ price: (c1.open + c1.close)/2, type: "orderblock", name: "Bullish OB" });
      }
    }
    
    // Bearish FVG: c1 low > c3 high
    if (c1.low > c3.high && c2.close < c2.open) {
      const fvgMid = (c1.low + c3.high) / 2;
      candidates.push({ price: fvgMid, type: "fvg", name: "Bearish FVG (Supply)" });
      if (c1.close > c1.open) {
        candidates.push({ price: (c1.open + c1.close)/2, type: "orderblock", name: "Bearish OB" });
      }
    }
  }

  // 4. Add Psychological round numbers
  // Determine step size based on price magnitude
  let step = 1000;
  if (currentPrice > 30000) step = 1000; // BTC range
  else if (currentPrice > 1000) step = 100; // ETH range
  else if (currentPrice > 100) step = 10;   // SOL/BNB range
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

  // Clustering Algorithm
  // Threshold is 0.75% of current price
  const threshold = currentPrice * 0.0075;
  const sortedCandidates = [...candidates].sort((a, b) => a.price - b.price);

  const clusters: CandidatePoint[][] = [];
  if (sortedCandidates.length > 0) {
    let currentCluster: CandidatePoint[] = [sortedCandidates[0]];
    for (let i = 1; i < sortedCandidates.length; i++) {
      const pt = sortedCandidates[i];
      const prev = currentCluster[currentCluster.length - 1];
      if (pt.price - prev.price <= threshold) {
        currentCluster.push(pt);
      } else {
        clusters.push(currentCluster);
        currentCluster = [pt];
      }
    }
    clusters.push(currentCluster);
  }

  const rawZones = clusters.map((cluster) => {
    const prices = cluster.map((c) => c.price);
    const minVal = Math.min(...prices);
    const maxVal = Math.max(...prices);

    // If cluster has 1 item, expand it slightly to create a zone
    let lower = minVal;
    let upper = maxVal;
    if (minVal === maxVal) {
      lower = minVal * 0.9975;
      upper = maxVal * 1.0025;
    }

    // Rounding to make the zone representation clean
    let zoneStr = "";
    if (currentPrice > 1000) {
      zoneStr = `${Math.round(lower).toLocaleString()}-${Math.round(upper).toLocaleString()}`;
    } else {
      zoneStr = `${lower.toFixed(2)}-${upper.toFixed(2)}`;
    }

    // Scoring formula:
    // Base score from candidates types
    let score = 0;
    const reasons: string[] = [];
    let swingHighs = 0;
    let swingLows = 0;
    const emas: string[] = [];
    const pivots: string[] = [];
    let roundNumber = false;

    cluster.forEach((c) => {
      if (c.type === "swing_high") {
        swingHighs++;
        score += 1.8;
      } else if (c.type === "swing_low") {
        swingLows++;
        score += 1.8;
      } else if (c.type === "ema") {
        emas.push(c.name);
        score += 1.5;
      } else if (c.type === "pivot") {
        pivots.push(c.name);
        score += 1.0;
      } else if (c.type === "round_number") {
        roundNumber = true;
        score += 0.5;
      } else if (c.type === "fvg") {
        reasons.push(c.name);
        score += 2.0; // High weight for Fair Value Gaps
      } else if (c.type === "orderblock") {
        reasons.push(c.name);
        score += 2.5; // Highest weight for Order Blocks
      }
    });

    // Build descriptive reasons
    if (swingHighs > 0) reasons.push(`ทดสอบ Swing High ${swingHighs} ครั้ง`);
    if (swingLows > 0) reasons.push(`ทดสอบ Swing Low ${swingLows} ครั้ง`);
    if (emas.length > 0) reasons.push(`แนว EMA Confluence: ${emas.join(", ")}`);
    if (pivots.length > 0) reasons.push(`ระดับ Pivot: ${pivots.join(", ")}`);
    if (roundNumber) reasons.push("แนวระดับราคาจิตวิทยา (เลขกลม)");

    // Mid point to categorize type
    const mid = (lower + upper) / 2;
    const zoneType = mid < currentPrice ? "support" : "resistance";

    // Detect S/R Flip (Support/Resistance Role Reversal)
    let adjustedScore = score;
    if (zoneType === "support" && swingHighs > 0) {
      reasons.push("แนวต้านเก่าเปลี่ยนเป็นแนวรับ (S/R Flip)");
      adjustedScore += 0.5;
    } else if (zoneType === "resistance" && swingLows > 0) {
      reasons.push("แนวรับเก่าเปลี่ยนเป็นแนวต้าน (S/R Flip)");
      adjustedScore += 0.5;
    }

    // Cap score at 10
    const finalScore = Math.min(10, Math.max(1, Math.round(adjustedScore)));

    return {
      zone: zoneStr,
      type: zoneType,
      score: finalScore,
      reasons,
      // Internal midpoint for sorting / filtering
      _mid: mid,
    } as any;
  });

  // Filter and split into support & resistance
  const supportZonesRaw = rawZones.filter((z) => z.type === "support");
  const resistanceZonesRaw = rawZones.filter((z) => z.type === "resistance");

  // Sort supports descending by price (closest to current price first, then by score)
  // But we want strong levels! So let's sort by score descending, then take top 3
  const supportZones = supportZonesRaw
    .sort((a, b) => b.score - a.score || b._mid - a._mid)
    .slice(0, 3)
    .map(({ zone, type, score, reasons }) => ({ zone, type, score, reasons }));

  // Sort resistances by score descending, then take top 3
  const resistanceZones = resistanceZonesRaw
    .sort((a, b) => b.score - a.score || a._mid - b._mid)
    .slice(0, 3)
    .map(({ zone, type, score, reasons }) => ({ zone, type, score, reasons }));

  return {
    supportZones,
    resistanceZones,
  };
}
