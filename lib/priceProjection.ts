import { IndicatorData, SupportResistanceData, KlineData, TickerData } from "../types/market";
import { NewsArticle } from "../types/news";
import { PriceProjectionData, PriceZone, ScenarioInfo, ConfirmationItem, EventRiskAssessment } from "../types/projection";

export function calculatePriceProjection(
  symbol: string,
  currentPrice: number,
  klines: KlineData[] | null,
  indicators: IndicatorData | null,
  supportResistance: SupportResistanceData | null,
  news: NewsArticle[] = [],
  calendarEvents: any[] = [],
  tradingStyle: string = "swing",
  timeframe: string = "1H",
  dataSource: string = "Finnhub / Binance Realtime API",
  tickerData?: TickerData | null
): PriceProjectionData {
  const now = new Date();
  const projectionId = `proj_${symbol.toUpperCase()}_${Date.now()}`;

  // 1. Check Data Quantity & Quality
  if (!klines || klines.length < 15 || !indicators || !supportResistance || !currentPrice || currentPrice <= 0) {
    return createDefaultFallbackProjection(symbol, currentPrice || 100, tradingStyle, dataSource, projectionId);
  }

  const atr = indicators.atr14 || currentPrice * 0.02;
  const adxVal = indicators.adx?.adx || 20;
  const isSidewaysAdx = adxVal < 25;

  // 2. Determine Time Horizon (#7)
  let timeHorizon = "1-20 วัน (Swing Trade)";
  let atrScale = 2.0;
  let zoneBufferPct = 0.008; // 0.8%

  const styleLower = (tradingStyle || "").toLowerCase();
  const tfLower = (timeframe || "").toLowerCase();

  if (styleLower.includes("scalp")) {
    timeHorizon = "5–60 นาที (Scalping)";
    atrScale = 0.8;
    zoneBufferPct = 0.002;
  } else if (styleLower.includes("day") || ["1m", "5m", "15m", "30m", "1h"].includes(tfLower)) {
    timeHorizon = "1-3 วัน (Day Trade / Intraday)";
    atrScale = 1.2;
    zoneBufferPct = 0.004; // 0.4%
  } else if (styleLower.includes("position") || styleLower.includes("invest") || ["1w", "1m"].includes(tfLower)) {
    timeHorizon = "1-3 เดือน (Position Trade)";
    atrScale = 3.2;
    zoneBufferPct = 0.015; // 1.5%
  }

  // 3. News & Event Risk Inspection (#9)
  const eventRisk = assessEventRisk(symbol, currentPrice, news, calendarEvents, tickerData);

  // 4. Calculate Target Zones (#2, #3, #4)
  // --- Upside Target Zone ---
  const upsideCandidates: { price: number; source: string }[] = [];
  if (indicators.pivot.r1 > currentPrice) upsideCandidates.push({ price: indicators.pivot.r1, source: "Pivot R1" });
  if (indicators.pivot.r2 > currentPrice) upsideCandidates.push({ price: indicators.pivot.r2, source: "Pivot R2" });
  if (indicators.pivot.r3 > currentPrice) upsideCandidates.push({ price: indicators.pivot.r3, source: "Pivot R3" });
  if (indicators.fibonacci.ext127 > currentPrice) upsideCandidates.push({ price: indicators.fibonacci.ext127, source: "Fib 127.2% Ext" });
  if (indicators.fibonacci.ext161 > currentPrice) upsideCandidates.push({ price: indicators.fibonacci.ext161, source: "Fib 161.8% Ext" });
  if (indicators.fibonacci.r0 > currentPrice) upsideCandidates.push({ price: indicators.fibonacci.r0, source: "Swing High (Fib 100%)" });
  if (indicators.bollingerBands.upper > currentPrice) upsideCandidates.push({ price: indicators.bollingerBands.upper, source: "Bollinger Upper Band" });
  upsideCandidates.push({ price: currentPrice + atr * atrScale, source: `ATR Projection (+${atrScale} ATR)` });

  (supportResistance.resistanceZones || []).forEach(rz => {
    const p = parseFloat(rz.zone);
    if (!isNaN(p) && p > currentPrice) {
      upsideCandidates.push({ price: p, source: `Resistance Zone ($${rz.zone})` });
    }
  });

  const upsideZone = buildTargetZone(currentPrice, upsideCandidates, true, zoneBufferPct);

  // --- Downside Target Zone ---
  const downsideCandidates: { price: number; source: string }[] = [];
  if (indicators.pivot.s1 < currentPrice && indicators.pivot.s1 > 0) downsideCandidates.push({ price: indicators.pivot.s1, source: "Pivot S1" });
  if (indicators.pivot.s2 < currentPrice && indicators.pivot.s2 > 0) downsideCandidates.push({ price: indicators.pivot.s2, source: "Pivot S2" });
  if (indicators.pivot.s3 < currentPrice && indicators.pivot.s3 > 0) downsideCandidates.push({ price: indicators.pivot.s3, source: "Pivot S3" });
  if (indicators.fibonacci.r382 < currentPrice && indicators.fibonacci.r382 > 0) downsideCandidates.push({ price: indicators.fibonacci.r382, source: "Fib 38.2% Retracement" });
  if (indicators.fibonacci.r500 < currentPrice && indicators.fibonacci.r500 > 0) downsideCandidates.push({ price: indicators.fibonacci.r500, source: "Fib 50.0% Retracement" });
  if (indicators.fibonacci.r618 < currentPrice && indicators.fibonacci.r618 > 0) downsideCandidates.push({ price: indicators.fibonacci.r618, source: "Fib 61.8% Retracement" });
  if (indicators.fibonacci.r100 < currentPrice && indicators.fibonacci.r100 > 0) downsideCandidates.push({ price: indicators.fibonacci.r100, source: "Swing Low (Fib 0%)" });
  if (indicators.bollingerBands.lower < currentPrice && indicators.bollingerBands.lower > 0) downsideCandidates.push({ price: indicators.bollingerBands.lower, source: "Bollinger Lower Band" });
  downsideCandidates.push({ price: Math.max(currentPrice * 0.1, currentPrice - atr * atrScale), source: `ATR Downside (-${atrScale} ATR)` });

  (supportResistance.supportZones || []).forEach(sz => {
    const p = parseFloat(sz.zone);
    if (!isNaN(p) && p < currentPrice && p > 0) {
      downsideCandidates.push({ price: p, source: `Support Zone ($${sz.zone})` });
    }
  });

  const downsideZone = buildTargetZone(currentPrice, downsideCandidates, false, zoneBufferPct);

  // --- Base Range (#4) ---
  const baseLow = Math.max(currentPrice * 0.5, Math.min(
    indicators.bollingerBands.middle - atr * 0.6,
    downsideZone.high > currentPrice * 0.9 ? downsideZone.high : currentPrice - atr * 0.8
  ));
  const baseHigh = Math.max(baseLow * 1.01, Math.min(
    indicators.bollingerBands.middle + atr * 0.6,
    upsideZone.low < currentPrice * 1.1 ? upsideZone.low : currentPrice + atr * 0.8
  ));

  const baseZone: PriceZone = {
    low: Number(baseLow.toFixed(2)),
    high: Number(baseHigh.toFixed(2)),
    formatted: `$${baseLow.toFixed(2)} – $${baseHigh.toFixed(2)}`,
    reason: isSidewaysAdx
      ? `ตลาด Sideways (ADX=${adxVal.toFixed(1)}) กรอบสะสมพลังแกว่งตัวรอบ SMA20 ($${indicators.bollingerBands.middle.toFixed(2)})`
      : `กรอบแนวรับ-ต้านระยะประชิดรอบราคาปัจจุบัน (+/- ${atr.toFixed(2)} ATR)`,
    sources: ["SMA 20 (Bollinger Mid)", "Near-term S/R", "ATR Volatility Band"]
  };

  // 5. Confirmation Checklist (#6)
  const bullishConfirmations: ConfirmationItem[] = [
    {
      label: "ราคาปิดเหนือ Pivot / EMA20",
      isConfirmed: currentPrice > indicators.pivot.p || currentPrice > indicators.ema20,
      detail: `ราคาปิดปัจจุบัน $${currentPrice.toFixed(2)} ${currentPrice > indicators.pivot.p ? "ยืนเหนือ" : "ต่ำกว่า"} Pivot ($${indicators.pivot.p.toFixed(2)})`
    },
    {
      label: "Volume สนับสนุน (สูงกว่าค่าเฉลี่ย)",
      isConfirmed: indicators.volumeAnalysis.volumeRatio >= 1.03 || indicators.volumeAnalysis.isVolumeSpike,
      detail: `Volume Ratio ${(indicators.volumeAnalysis.volumeRatio || 1.0).toFixed(2)}x ของค่าเฉลี่ย 20 วัน`
    },
    {
      label: "MACD Bullish Momentum",
      isConfirmed: indicators.macd.macdLine > indicators.macd.signalLine,
      detail: `MACD Line (${indicators.macd.macdLine.toFixed(3)}) ${indicators.macd.macdLine > indicators.macd.signalLine ? "ตัดเหนือ" : "อยู่ใต้"} Signal Line (${indicators.macd.signalLine.toFixed(3)})`
    },
    {
      label: "RSI อยู่ในโซนมีกำลังซื้อ (ไม่อิ่มตัวเกินไป)",
      isConfirmed: indicators.rsi14 > 48 && indicators.rsi14 < 73,
      detail: `RSI-14 อยู่ที่ ${indicators.rsi14.toFixed(1)} ${indicators.rsi14 > 73 ? "(Overbought เกินไป อาจย่อ)" : indicators.rsi14 < 48 ? "(แรงซื้อยังน้อย)" : "(มีโมเมนตัมที่ดี)"}`
    },
    {
      label: "Market Structure ยก High / ยก Low",
      isConfirmed: indicators.marketStructure.higherHighs || indicators.marketStructure.higherLows || indicators.marketStructure.type === "uptrend",
      detail: `โครงสร้างตลาด: ${indicators.marketStructure.type.toUpperCase()} (${indicators.marketStructure.higherHighs ? "HH" : ""} ${indicators.marketStructure.higherLows ? "HL" : ""})`
    },
    {
      label: "ราคายืนเหนือ VWAP (Volume Weighted Avg)",
      isConfirmed: currentPrice >= (indicators.vwap || indicators.ema20),
      detail: `VWAP $${(indicators.vwap || indicators.ema20).toFixed(2)} ${currentPrice >= (indicators.vwap || indicators.ema20) ? "(แรงซื้อคุมรอบวัน)" : "(แรงขายกดดันใต้ VWAP)"}`
    }
  ];

  const bearishConfirmations: ConfirmationItem[] = [
    {
      label: "ราคาปิดต่ำกว่า Pivot / EMA20",
      isConfirmed: currentPrice < indicators.pivot.p || currentPrice < indicators.ema20,
      detail: `ราคาปิด $${currentPrice.toFixed(2)} ${currentPrice < indicators.pivot.p ? "หลุดใต้" : "ยังอยู่เหนือ"} Pivot ($${indicators.pivot.p.toFixed(2)})`
    },
    {
      label: "Volume ขายกดดันเพิ่มขึ้น",
      isConfirmed: indicators.volumeAnalysis.obvTrend === "falling" || (indicators.volumeAnalysis.volumeRatio >= 1.03 && currentPrice < indicators.ema20),
      detail: `OBV Trend: ${indicators.volumeAnalysis.obvTrend.toUpperCase()} (Volume Ratio: ${(indicators.volumeAnalysis.volumeRatio || 1.0).toFixed(2)}x)`
    },
    {
      label: "MACD Bearish Momentum",
      isConfirmed: indicators.macd.macdLine < indicators.macd.signalLine,
      detail: `MACD Line (${indicators.macd.macdLine.toFixed(3)}) อยู่ต่ำกว่า Signal Line (${indicators.macd.signalLine.toFixed(3)})`
    },
    {
      label: "RSI อ่อนแรง (ต่ำกว่า 46)",
      isConfirmed: indicators.rsi14 <= 46,
      detail: `RSI-14 อยู่ที่ ${indicators.rsi14.toFixed(1)} ${indicators.rsi14 <= 46 ? "(อยู่ในโซนอ่อนแรง/มีแรงขาย)" : "(ยังทรงตัวเหนือโซนอ่อนแรง)"}`
    },
    {
      label: "Market Structure ทำ Lower High / Lower Low",
      isConfirmed: indicators.marketStructure.lowerHighs || indicators.marketStructure.lowerLows || indicators.marketStructure.type === "downtrend",
      detail: `โครงสร้างตลาด: ${indicators.marketStructure.type.toUpperCase()} (${indicators.marketStructure.lowerHighs ? "LH" : ""} ${indicators.marketStructure.lowerLows ? "LL" : ""})`
    },
    {
      label: "ราคาซื้อขายต่ำกว่า VWAP",
      isConfirmed: currentPrice < (indicators.vwap || indicators.ema20),
      detail: `ราคา $${currentPrice.toFixed(2)} อยู่ใต้ VWAP $${(indicators.vwap || indicators.ema20).toFixed(2)}`
    }
  ];

  const bullishConfirmedCount = bullishConfirmations.filter(c => c.isConfirmed).length;
  const bearishConfirmedCount = bearishConfirmations.filter(c => c.isConfirmed).length;

  // 6. Confidence Ranking (#8)
  let confidenceScore = 50 + (bullishConfirmedCount - bearishConfirmedCount) * 8;
  if (isSidewaysAdx) confidenceScore -= 10;
  if (indicators.volumeAnalysis.volumeRatio > 1.2) confidenceScore += 8;
  if (eventRisk.hasEventWithin24h) confidenceScore -= 15;

  confidenceScore = Math.max(10, Math.min(95, confidenceScore));

  let confidence: "High" | "Moderate" | "Low" | "Conflicting" = "Moderate";
  const confidenceReasons: string[] = [];

  if (Math.abs(bullishConfirmedCount - bearishConfirmedCount) <= 1 && bullishConfirmedCount >= 2 && bearishConfirmedCount >= 2) {
    confidence = "Conflicting";
    confidenceReasons.push("สัญญาณทางเทคนิคมีความขัดแย้งกัน (Bullish & Bearish Confirmations ใกล้เคียงกัน)");
    if (indicators.rsi14 > 65 && indicators.macd.macdLine < indicators.macd.signalLine) {
      confidenceReasons.push("RSI อยู่สูงแต่ MACD เริ่มอ่อนแรง (Divergence Risk)");
    }
  } else if (confidenceScore >= 75 && !eventRisk.hasEventWithin24h && !isSidewaysAdx) {
    confidence = "High";
    confidenceReasons.push(`มีการยืนยันทางเทคนิคสูง (${bullishConfirmedCount > bearishConfirmedCount ? bullishConfirmedCount : bearishConfirmedCount}/6 confirm) พร้อม Volume สนับสนุน`);
    confidenceReasons.push(`ADX = ${adxVal.toFixed(1)} แสดงถึงเทรนด์ที่ชัดเจน`);
  } else if (confidenceScore >= 45) {
    confidence = "Moderate";
    confidenceReasons.push(`สัญญาณยืนยันอยู่ในระดับปานกลาง (${bullishConfirmedCount} Bull vs ${bearishConfirmedCount} Bear)`);
    if (isSidewaysAdx) confidenceReasons.push("ตลาดมีลักษณะ Sideway/พักตัว (ADX < 25) ทำให้โอกาส Breakout รุนแรงลดลง");
  } else {
    confidence = "Low";
    confidenceReasons.push("โมเมนตัมและ Volume อ่อนแรง ไม่สนับสนุนการทะลุแนวสำคัญ");
  }

  if (eventRisk.hasEventWithin24h) {
    if (confidence === "High") confidence = "Moderate";
    else if (confidence === "Moderate") confidence = "Low";
    confidenceReasons.push(`[Event Risk] ${eventRisk.warningMessage || "มีอีเวนต์สำคัญใน 24 ชั่วโมง ความผันผวนสูง"}`);
  }

  // 7. Scenarios (#5)
  const nextUpsideLevel = upsideCandidates.find(c => c.price > upsideZone.high) || { price: upsideZone.high * 1.05, source: "Extension Target" };
  const nextDownsideLevel = downsideCandidates.find(c => c.price < downsideZone.low && c.price > 0) || { price: downsideZone.low * 0.95, source: "Downside Extension" };

  const upsideScenario: ScenarioInfo = {
    scenarioType: "bullish",
    targetZone: upsideZone,
    confirmations: bullishConfirmations,
    confirmedCount: bullishConfirmedCount,
    totalConfirmations: 6,
    nextLevel: {
      label: nextUpsideLevel.source,
      price: Number(nextUpsideLevel.price.toFixed(2)),
      formatted: `$${nextUpsideLevel.price.toFixed(2)}`
    },
    supportingReasons: [
      `เป้าหมายคำนวณจาก Confluence ของ ${upsideZone.sources.join(", ")}`,
      bullishConfirmedCount >= 4 ? `ผ่านเกณฑ์ยืนยันโมเมนตัมเชิงบวกถึง ${bullishConfirmedCount}/6 สัญญาณ` : `ต้องรอ Volume ยืนยันและการปิดเหนือ $${indicators.pivot.r1.toFixed(2)}`,
      `แนวโน้ม ADX: ${isSidewaysAdx ? "สะสมพลังรอบโซน Base Range" : "มีแรงส่งตามเทรนด์"}`
    ],
    invalidationTrigger: {
      price: Number(baseLow.toFixed(2)),
      formatted: `$${baseLow.toFixed(2)}`,
      condition: `ถ้าราคาหลุดใต้ Base Range Low ($${baseLow.toFixed(2)}) หรือ S1 ($${indicators.pivot.s1.toFixed(2)}) พร้อม Volume ขาย Scenario ฝั่งขึ้นจะถูกยกเลิก (Invalidated)`
    }
  };

  const baseScenario: ScenarioInfo = {
    scenarioType: "base",
    targetZone: baseZone,
    confirmations: [],
    confirmedCount: 0,
    totalConfirmations: 0,
    nextLevel: {
      label: "SMA 20 Midband",
      price: Number(indicators.bollingerBands.middle.toFixed(2)),
      formatted: `$${indicators.bollingerBands.middle.toFixed(2)}`
    },
    supportingReasons: [
      `กรอบราคากลางที่ตลาดคาดการณ์ว่าจะเคลื่อนไหวพักตัวรอบ SMA 20 ($${indicators.bollingerBands.middle.toFixed(2)})`,
      isSidewaysAdx ? `ADX = ${adxVal.toFixed(1)} (< 25) ยืนยันภาวะตลาดยังไม่มีทิศทาง Breakout ที่ชัดเจน จึงให้น้ำหนัก Base Range สูงสุด` : `เป็นกรอบสมดุลก่อนเลือกทิศทางตามโมเมนตัม`,
      `แนวรับใต้กรอบ $${baseLow.toFixed(2)} และแนวต้านบนกรอบ $${baseHigh.toFixed(2)}`
    ],
    invalidationTrigger: {
      price: Number(baseHigh.toFixed(2)),
      formatted: `Break > $${baseHigh.toFixed(2)} หรือ Break < $${baseLow.toFixed(2)}`,
      condition: `หากเกิด Breakout ทะลุกรอบบน ($${baseHigh.toFixed(2)}) พร้อม Volume จะเปลี่ยนเป็น Bullish Scenario ทันที หรือหากหลุดใต้กรอบล่างจะเปลี่ยนเป็น Bearish Scenario`
    },
    shiftConditions: [
      `เปลี่ยนเป็น Bullish: ราคาปิดยืนเหนือ $${baseHigh.toFixed(2)} พร้อม Volume Ratio > 1.2x และ MACD ตัดขึ้น`,
      `เปลี่ยนเป็น Bearish: ราคาหลุดใต้ $${baseLow.toFixed(2)} พร้อม Volume ขายหนาแน่น และ RSI ต่ำกว่า 45`
    ]
  };

  const downsideScenario: ScenarioInfo = {
    scenarioType: "bearish",
    targetZone: downsideZone,
    confirmations: bearishConfirmations,
    confirmedCount: bearishConfirmedCount,
    totalConfirmations: 6,
    nextLevel: {
      label: nextDownsideLevel.source,
      price: Number(nextDownsideLevel.price.toFixed(2)),
      formatted: `$${nextDownsideLevel.price.toFixed(2)}`
    },
    supportingReasons: [
      `เป้าหมายขาลงคำนวณจาก Confluence ของ ${downsideZone.sources.join(", ")}`,
      bearishConfirmedCount >= 4 ? `สัญญาณเตือนแรงขายยืนยันถึง ${bearishConfirmedCount}/6 สัญญาณ` : `เป็นแนวย่อพักตัวตามธรรมชาติหากไม่สามารถทะลุ $${upsideZone.low.toFixed(2)} ได้`,
      `แนวรับสำคัญ R1/S1 Pivot: $${indicators.pivot.s1.toFixed(2)}`
    ],
    invalidationTrigger: {
      price: Number(baseHigh.toFixed(2)),
      formatted: `$${baseHigh.toFixed(2)}`,
      condition: `ถ้าราคากลับขึ้นมายืนเหนือ Base Range High ($${baseHigh.toFixed(2)}) หรือ R1 ($${indicators.pivot.r1.toFixed(2)}) ได้สำเร็จ Scenario ฝั่งลงจะถูกยกเลิก`
    }
  };

  // 8. Stale Check (#10)
  const isStaleProjection = false; // Fresh upon calculation

  return {
    projectionId,
    symbol: symbol.toUpperCase(),
    currentPrice: Number(currentPrice.toFixed(2)),
    timeHorizon,
    confidence,
    confidenceScore,
    confidenceReasons,
    adxStrength: Number(adxVal.toFixed(1)),
    isSidewaysAdx,
    eventRisk,
    upsideScenario,
    baseScenario,
    downsideScenario,
    isStaleProjection,
    atrValue: Number(atr.toFixed(2)),
    updatedAt: now.toISOString(),
    dataSource
  };
}

function buildTargetZone(
  currentPrice: number,
  candidates: { price: number; source: string }[],
  isUpside: boolean,
  bufferPct: number
): PriceZone {
  const filtered = candidates
    .filter(c => !isNaN(c.price) && c.price > 0 && (isUpside ? c.price > currentPrice * 1.002 : c.price < currentPrice * 0.998))
    .sort((a, b) => isUpside ? a.price - b.price : b.price - a.price);

  if (filtered.length === 0) {
    const fallbackLow = isUpside ? currentPrice * 1.015 : currentPrice * 0.965;
    const fallbackHigh = isUpside ? currentPrice * 1.035 : currentPrice * 0.985;
    return {
      low: Number(Math.min(fallbackLow, fallbackHigh).toFixed(2)),
      high: Number(Math.max(fallbackLow, fallbackHigh).toFixed(2)),
      formatted: `$${Math.min(fallbackLow, fallbackHigh).toFixed(2)} – $${Math.max(fallbackLow, fallbackHigh).toFixed(2)}`,
      reason: isUpside ? "Estimated ATR & Resistance Projection" : "Estimated ATR & Support Projection",
      sources: ["ATR Projection", "Pivot Estimation"]
    };
  }

  // Find tightest cluster of targets (within 2% of each other)
  let bestCluster = [filtered[0]];
  for (let i = 0; i < filtered.length; i++) {
    const cluster = [filtered[i]];
    for (let j = i + 1; j < filtered.length; j++) {
      const diffPct = Math.abs(filtered[j].price - filtered[i].price) / filtered[i].price;
      if (diffPct <= 0.025) { // 2.5% clustering
        cluster.push(filtered[j]);
      }
    }
    if (cluster.length > bestCluster.length) {
      bestCluster = cluster;
    }
  }

  let minP = Math.min(...bestCluster.map(c => c.price));
  let maxP = Math.max(...bestCluster.map(c => c.price));

  if (maxP - minP < currentPrice * bufferPct) {
    minP = minP * (1 - bufferPct / 2);
    maxP = maxP * (1 + bufferPct / 2);
  }

  const sources = Array.from(new Set(bestCluster.map(c => c.source)));

  return {
    low: Number(minP.toFixed(2)),
    high: Number(maxP.toFixed(2)),
    formatted: `$${minP.toFixed(2)} – $${maxP.toFixed(2)}`,
    reason: `Confluence ระหว่าง ${sources.slice(0, 3).join(", ")}`,
    sources
  };
}

function assessEventRisk(
  symbol: string,
  currentPrice: number,
  news: NewsArticle[],
  calendarEvents: any[],
  tickerData?: TickerData | null
): EventRiskAssessment {
  const nowMs = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  // 1. Check Pre-market / After-hours gap > 2% (#9)
  if (tickerData && tickerData.previousClose && tickerData.previousClose > 0) {
    const gapPct = Math.abs(currentPrice - tickerData.previousClose) / tickerData.previousClose;
    if (gapPct >= 0.02) {
      return {
        level: "High",
        hasEventWithin24h: true,
        eventTitle: `Pre-market / Price Gap ${(gapPct * 100).toFixed(1)}%`,
        warningMessage: `พบการกระโดดของราคา (Gap ${(gapPct * 100).toFixed(1)}%) จากราคาปิดวันก่อน ความผันผวนสูงมาก ห้ามเข้าเทรดแบบ Market Entry โดยไม่มีการยืนยัน`
      };
    }
  }

  // 2. Check Calendar Events within 24 hours (#9)
  for (const ev of calendarEvents) {
    if (!ev || !ev.announcedAt) continue;
    const evMs = new Date(ev.announcedAt).getTime();
    if (!isNaN(evMs) && Math.abs(evMs - nowMs) <= oneDayMs) {
      const isHigh = ev.importance === "high" || ev.type === "earnings";
      if (isHigh || (ev.symbol && ev.symbol.toUpperCase() === symbol.toUpperCase())) {
        return {
          level: "High",
          hasEventWithin24h: true,
          eventTitle: ev.title || `${ev.type.toUpperCase()} Announcement (${ev.timeThai || "วันนี้"})`,
          eventTime: ev.timeThai,
          warningMessage: `มี Event สำคัญภายใน 24 ชั่วโมง: "${ev.title || ev.type}" (${ev.timeThai}) เป้าหมายอาจมีความคลาดเคลื่อนสูง หรือแกว่งตัวรุนแรง ห้ามเข้าซื้อขายแบบ Market Entry โดยไม่มี Volume ยืนยัน`
        };
      }
    }
  }

  // 3. Check high impact / earnings / guidance / FOMC / CPI / AI capex news (#9)
  for (const item of news) {
    if (!item || !item.title) continue;
    const titleLower = item.title.toLowerCase();
    const isHighImpactKeyword =
      titleLower.includes("fomc") ||
      titleLower.includes("cpi") ||
      titleLower.includes("ppi") ||
      titleLower.includes("earnings") ||
      titleLower.includes("guidance") ||
      titleLower.includes("interest rate") ||
      titleLower.includes("ai capex") ||
      titleLower.includes("export control") ||
      titleLower.includes("tariff") ||
      titleLower.includes("investigation") ||
      item.impact === "catalyst";

    if (isHighImpactKeyword) {
      const pubMs = new Date(item.publishedAt).getTime();
      if (!isNaN(pubMs) && nowMs - pubMs <= oneDayMs) {
        return {
          level: "High",
          hasEventWithin24h: true,
          eventTitle: item.title.slice(0, 50) + "...",
          warningMessage: `มีปัจจัยข่าว High Impact ในรอบ 24 ชม.: "${item.title.slice(0, 55)}..." ความเสี่ยงความผันผวนสูง กรุณารอสัญญาณยืนยันก่อนเข้าเทรด`
        };
      }
    }
  }

  return {
    level: "Low",
    hasEventWithin24h: false,
    warningMessage: "ไม่พบข่าวหรือ Event สำคัญระดับ High Impact ในรอบ 24 ชั่วโมงนี้"
  };
}

function createDefaultFallbackProjection(
  symbol: string,
  price: number,
  tradingStyle: string,
  dataSource: string,
  projectionId: string
): PriceProjectionData {
  const lowP = Number((price * 0.98).toFixed(2));
  const highP = Number((price * 1.02).toFixed(2));
  const baseP1 = Number((price * 0.99).toFixed(2));
  const baseP2 = Number((price * 1.01).toFixed(2));

  return {
    projectionId,
    symbol: symbol.toUpperCase(),
    currentPrice: Number(price.toFixed(2)),
    timeHorizon: "1-20 วัน (Swing Trade)",
    confidence: "Conflicting",
    confidenceScore: 30,
    confidenceReasons: ["Insufficient Data: ข้อมูลกราฟหรือแท่งเทียนไม่เพียงพอสำหรับการคำนวณทางเทคนิคเต็มรูปแบบ (< 15 แท่ง)"],
    adxStrength: 15,
    isSidewaysAdx: true,
    eventRisk: {
      level: "Low",
      hasEventWithin24h: false,
      warningMessage: "ข้อมูลไม่เพียงพอในการประเมิน Event Risk"
    },
    upsideScenario: {
      scenarioType: "bullish",
      targetZone: { low: Number((price * 1.02).toFixed(2)), high: Number((price * 1.04).toFixed(2)), formatted: `$${(price * 1.02).toFixed(2)} – $${(price * 1.04).toFixed(2)}`, reason: "Estimated +2% to +4% Buffer", sources: ["Fallback Estimation"] },
      confirmations: [],
      confirmedCount: 0,
      totalConfirmations: 6,
      nextLevel: { label: "Est R2", price: Number((price * 1.05).toFixed(2)), formatted: `$${(price * 1.05).toFixed(2)}` },
      supportingReasons: ["รอข้อมูลแท่งเทียนเพิ่มเติม"],
      invalidationTrigger: { price: baseP1, formatted: `$${baseP1}`, condition: "หลุดใต้กรอบพักตัว" }
    },
    baseScenario: {
      scenarioType: "base",
      targetZone: { low: baseP1, high: baseP2, formatted: `$${baseP1} – $${baseP2}`, reason: "Estimated +/- 1% Base Range", sources: ["Fallback Estimation"] },
      confirmations: [],
      confirmedCount: 0,
      totalConfirmations: 0,
      nextLevel: { label: "Current Price", price: Number(price.toFixed(2)), formatted: `$${price.toFixed(2)}` },
      supportingReasons: ["ข้อมูลแท่งเทียนยังไม่ครบถ้วนพอในการคำนวณโครงสร้างตลาด"],
      invalidationTrigger: { price: baseP2, formatted: `$${baseP2}`, condition: "Breakout กรอบ" }
    },
    downsideScenario: {
      scenarioType: "bearish",
      targetZone: { low: Number((price * 0.96).toFixed(2)), high: lowP, formatted: `$${(price * 0.96).toFixed(2)} – $${lowP}`, reason: "Estimated -2% to -4% Buffer", sources: ["Fallback Estimation"] },
      confirmations: [],
      confirmedCount: 0,
      totalConfirmations: 6,
      nextLevel: { label: "Est S2", price: Number((price * 0.95).toFixed(2)), formatted: `$${(price * 0.95).toFixed(2)}` },
      supportingReasons: ["รอข้อมูลแท่งเทียนเพิ่มเติม"],
      invalidationTrigger: { price: baseP2, formatted: `$${baseP2}`, condition: "กลับขึ้นเหนือกรับพักตัว" }
    },
    isStaleProjection: false,
    atrValue: Number((price * 0.02).toFixed(2)),
    updatedAt: new Date().toISOString(),
    dataSource
  };
}
