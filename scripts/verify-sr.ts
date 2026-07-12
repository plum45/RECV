import { calculateSupportResistance } from "../lib/supportResistance";
import { KlineData, IndicatorData } from "../types/market";

function createMockIndicators(overrides?: Partial<IndicatorData>): IndicatorData {
  return {
    ema20: 0,
    ema50: 0,
    ema200: 0,
    rsi14: 50,
    macd: { macdLine: 0, signalLine: 0, histogram: 0, crossover: "none" },
    atr14: 1.5,
    pivot: { p: 0, r1: 0, s1: 0, r2: 0, s2: 0, r3: 0, s3: 0 },
    volumeAnalysis: {
      avgVolume20: 1000,
      isVolumeSpike: false,
      currentVolume: 1000,
      volumeRatio: 1.0,
      obv: 0,
      obvTrend: "flat",
    },
    bollingerBands: { upper: 110, middle: 100, lower: 90, bandwidth: 0.2, percentB: 0.5, squeeze: false },
    adx: { adx: 20, plusDI: 15, minusDI: 15, trending: false, direction: "neutral" },
    stochasticRSI: { k: 50, d: 50, overbought: false, oversold: false },
    fibonacci: { swing_high: 120, swing_low: 80, r0: 120, r236: 110, r382: 105, r500: 100, r618: 95, r786: 90, r100: 80, ext127: 130, ext161: 140 },
    vwap: 100,
    marketStructure: {
      type: "sideways",
      higherHighs: false,
      higherLows: false,
      lowerHighs: false,
      lowerLows: false,
      lastSwingHigh: 120,
      lastSwingLow: 80,
      breakOfStructure: "none",
    },
    ...overrides,
  };
}

function createMockKlines(count: number, basePrice = 100): KlineData[] {
  const klines: KlineData[] = [];
  for (let i = 0; i < count; i++) {
    klines.push({
      openTime: 1000 + i * 60,
      open: basePrice,
      high: basePrice + 1,
      low: basePrice - 1,
      close: basePrice,
      volume: 1000,
      closeTime: 1000 + (i + 1) * 60,
    });
  }
  return klines;
}

async function runTests() {
  console.log("=== Running Support & Resistance Upgrade Verification Tests ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (details) console.error(`       Details: ${details}`);
      failed++;
    }
  }

  // Test 1: Error when data < minimum (20 bars)
  try {
    const shortKlines = createMockKlines(15, 100);
    calculateSupportResistance(shortKlines, createMockIndicators(), 100);
    assert(false, "Test 1: Error thrown on < 20 klines");
  } catch (err: any) {
    assert(err.message.includes("ไม่เพียงพอ"), "Test 1: Error thrown on < 20 klines");
  }

  // Test 2: Fresh swing low gets freshness: 'fresh'
  {
    const klines = createMockKlines(100, 100);
    // Create a swing low near the end (index 80 -> age 19 bars -> <= 80 bars = fresh)
    klines[80] = { ...klines[80], low: 85, high: 87, close: 86 };
    // Make surrounding bars higher so index 80 is clearly a swing low
    for (let j = 68; j <= 92; j++) {
      if (j !== 80) {
        klines[j] = { ...klines[j], low: 90, high: 95 };
      }
    }
    const res = calculateSupportResistance(klines, createMockIndicators(), 100);
    const sz = res.supportZones.find((z) => z.zone.includes("85") || Math.abs(Number(z.zone.split("-")[0]) - 85) < 3);
    assert(
      sz?.freshness === "fresh",
      "Test 2: Fresh swing low (age 19 bars) gets freshness = 'fresh'",
      `Got freshness: ${sz?.freshness}, reasons: ${sz?.reasons?.join(", ")}`
    );
  }

  // Test 3: Old swing low gets freshness: 'historical' or 'aged'
  {
    const klines = createMockKlines(400, 100);
    klines[20] = { ...klines[20], low: 70, high: 72, close: 71 };
    for (let j = 8; j <= 32; j++) {
      if (j !== 20) {
        klines[j] = { ...klines[j], low: 78, high: 80 };
      }
    }
    // Use currentPrice = 75 so the level at 70 is in the top 3 closest support zones
    const res = calculateSupportResistance(klines, createMockIndicators(), 75);
    const sz = res.supportZones.find((z) => Math.abs(Number(z.zone.split("-")[0]) - 70) < 3);
    assert(
      sz?.freshness === "historical" || sz?.freshness === "aged",
      "Test 3: Old swing low (age 379 bars) gets freshness = 'historical' or 'aged'",
      `Got freshness: ${sz?.freshness}, reasons: ${sz?.reasons?.join(", ")}`
    );
  }

  // Test 4: Confluence zone gets higher score than single zone
  {
    const klines = createMockKlines(150, 100);
    // Single swing low at index 60 -> price 80
    klines[60] = { ...klines[60], low: 80, high: 82, close: 81 };
    for (let j = 48; j <= 72; j++) if (j !== 60) klines[j] = { ...klines[j], low: 85, high: 87 };

    // Confluence swing low at index 100 -> price 90 + EMA Confluence at 90 + Pivot S1 at 90
    klines[100] = { ...klines[100], low: 90, high: 92, close: 91 };
    for (let j = 88; j <= 112; j++) if (j !== 100) klines[j] = { ...klines[j], low: 95, high: 97 };

    const ind = createMockIndicators({
      ema200: 90,
      pivot: { p: 100, r1: 105, r2: 110, r3: 115, s1: 90, s2: 85, s3: 80 },
    });

    const res = calculateSupportResistance(klines, ind, 100);
    const singleZone = res.supportZones.find((z) => Math.abs(Number(z.zone.split("-")[0]) - 80) < 3);
    const confluenceZone = res.supportZones.find((z) => Math.abs(Number(z.zone.split("-")[0]) - 90) < 3);

    assert(
      (confluenceZone?.score ?? 0) > (singleZone?.score ?? 0),
      "Test 4: Zone with EMA & Pivot confluences gets significantly higher score",
      `Confluence score: ${confluenceZone?.score}, Single score: ${singleZone?.score}`
    );
  }

  // Test 5: Broken support / S/R flip gets marked flipped/broken
  {
    const klines = createMockKlines(150, 100);
    // Swing low formed at index 50 -> price 105 (formed when price was above 105)
    klines[50] = { ...klines[50], low: 105, high: 107, close: 106 };
    for (let j = 38; j <= 62; j++) if (j !== 50) klines[j] = { ...klines[j], low: 110, high: 112 };

    // Price later broke down below 100/105, and currentPrice is now 95
    const res = calculateSupportResistance(klines, createMockIndicators(), 95);
    const rz = res.resistanceZones.find((z) => z.status === "flipped" || Math.abs(Number(z.zone.split("-")[0]) - 99) < 3);
    assert(
      rz?.status === "flipped",
      "Test 5: Broken old support (swing low with currentPrice at 95) is marked as 'flipped'",
      `Got status: ${rz?.status}, reasons: ${rz?.reasons?.join(", ")}`
    );
  }

  console.log(`\nVerification Summary: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
