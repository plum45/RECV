import type { IndicatorData, KlineData } from "../types/market";
import type { GoldPlaybookData, MultiTimeframeBias } from "../types/analysis";

type SessionName = GoldPlaybookData["activeSession"];

const MACRO_RISK_PATTERN = /\b(FOMC|Federal Reserve|Fed Chair|Powell|CPI|PPI|nonfarm|NFP|payroll|employment report|jobless claims|inflation|Treasury yield|rate decision)\b/i;

function datePart(time: number, timeZone: string): { key: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(time));
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "0";
  return { key: `${value("year")}-${value("month")}-${value("day")}`, hour: Number(value("hour")) };
}

function latestSessionRange(klines: KlineData[], timeZone: string, startHour: number, endHour: number) {
  const grouped = new Map<string, KlineData[]>();
  for (const candle of klines) {
    const { key, hour } = datePart(candle.openTime, timeZone);
    if (hour < startHour || hour >= endHour) continue;
    const group = grouped.get(key) || [];
    group.push(candle);
    grouped.set(key, group);
  }
  const key = [...grouped.keys()].sort().at(-1);
  const candles = key ? grouped.get(key) || [] : [];
  if (!key || candles.length < 2) return undefined;
  return {
    low: Math.min(...candles.map((candle) => candle.low)),
    high: Math.max(...candles.map((candle) => candle.high)),
    date: key,
  };
}

function getActiveSession(now = Date.now()): SessionName {
  const asia = datePart(now, "Asia/Tokyo").hour >= 8 && datePart(now, "Asia/Tokyo").hour < 15;
  const london = datePart(now, "Europe/London").hour >= 8 && datePart(now, "Europe/London").hour < 12;
  const newYork = datePart(now, "America/New_York").hour >= 8 && datePart(now, "America/New_York").hour < 12;
  if (london && newYork) return "london_new_york_overlap";
  if (newYork) return "new_york";
  if (london) return "london";
  if (asia) return "asia";
  return "off_peak";
}

function deriveBias(indicators: IndicatorData, price: number): MultiTimeframeBias {
  const structure = indicators.marketStructure.type;
  const priceAction = indicators.priceAction?.bias || "neutral";
  const bos = indicators.smartMoney?.bos || "none";
  if (bos === "bullish" || (structure === "uptrend" && priceAction === "bullish" && price >= indicators.vwap)) return "bullish";
  if (bos === "bearish" || (structure === "downtrend" && priceAction === "bearish" && price <= indicators.vwap)) return "bearish";
  return "neutral";
}

/**
 * A conservative, rule-based gold execution filter. It deliberately does not
 * predict price: it checks whether structure, session liquidity, VWAP and the
 * latest closed candle agree before a setup can be marked ready.
 */
export function buildGoldPlaybook(
  klines: KlineData[],
  indicators: IndicatorData,
  price: number,
  newsTitles: string[] = [],
  calendarTitles: string[] = []
): GoldPlaybookData {
  const activeSession = getActiveSession();
  const asiaRange = latestSessionRange(klines, "Asia/Tokyo", 8, 15);
  const londonRange = latestSessionRange(klines, "Europe/London", 8, 12);
  const closedCandle = klines[Math.max(0, klines.length - 2)];
  const bias = deriveBias(indicators, price);
  const priceAction = indicators.priceAction;
  const isTrend = indicators.adx.adx >= 20 && indicators.marketStructure.type !== "sideways";
  const aboveVwap = indicators.vwap > 0 && price >= indicators.vwap;
  const belowVwap = indicators.vwap > 0 && price <= indicators.vwap;
  const sessionActive = activeSession !== "off_peak";
  const macroRisk = MACRO_RISK_PATTERN.test([...newsTitles, ...calendarTitles].join(" | "));

  const sweptAsiaHigh = Boolean(asiaRange && closedCandle && closedCandle.high > asiaRange.high && closedCandle.close < asiaRange.high);
  const sweptAsiaLow = Boolean(asiaRange && closedCandle && closedCandle.low < asiaRange.low && closedCandle.close > asiaRange.low);
  const bullishConfirmation = bias === "bullish" && priceAction?.confirmation === "confirmed" && aboveVwap;
  const bearishConfirmation = bias === "bearish" && priceAction?.confirmation === "confirmed" && belowVwap;
  const inCompression = !isTrend && indicators.vwap > 0 && Math.abs(price - indicators.vwap) / price < 0.001;

  let setup: GoldPlaybookData["setup"] = "wait_for_confirmation";
  if (sweptAsiaHigh && bearishConfirmation) setup = "asia_high_sweep_reclaim";
  else if (sweptAsiaLow && bullishConfirmation) setup = "asia_low_sweep_reclaim";
  else if (isTrend && (bullishConfirmation || bearishConfirmation)) setup = "vwap_continuation";
  else if (inCompression) setup = "range_no_trade";

  const checklist = [
    { label: "อยู่ในช่วง Asia, London หรือ New York ที่กำหนด", passed: sessionActive },
    { label: "โครงสร้างราคาและ BOS/MSS ไม่ขัดกับทิศทาง", passed: bias !== "neutral" },
    { label: "แท่งที่ปิดแล้วมี Price Action ยืนยัน", passed: priceAction?.confirmation === "confirmed" },
    { label: "ราคาอยู่ด้านเดียวกับ Session VWAP", passed: (bias === "bullish" && aboveVwap) || (bias === "bearish" && belowVwap) },
    { label: "ไม่มีข่าวมหภาคความเสี่ยงสูงที่ตรวจพบ", passed: !macroRisk },
  ];
  const qualityScore = Math.round(Math.max(0, Math.min(100,
    20 + checklist.filter((item) => item.passed).length * 15 + (setup.includes("sweep") ? 10 : 0) - (inCompression ? 15 : 0)
  )));

  const tradeState: GoldPlaybookData["tradeState"] = macroRisk || inCompression
    ? "avoid"
    : sessionActive && (setup === "asia_high_sweep_reclaim" || setup === "asia_low_sweep_reclaim" || setup === "vwap_continuation") && qualityScore >= 75
      ? "ready"
      : "wait";

  const guidance = tradeState === "avoid"
    ? macroRisk ? "งดเปิดใหม่หรือรอให้ข่าวผ่านและแท่งราคาปิดยืนยันก่อน" : "ตลาดกำลังแคบใกล้ VWAP; รอ liquidity sweep หรือ BOS ที่ชัดเจนก่อน"
    : tradeState === "ready"
      ? "มี confluence เพียงพอสำหรับพิจารณาแผนตามทิศทาง แต่ยังต้องยึด Stop Loss และขนาดความเสี่ยง"
      : "รอให้โครงสร้าง, VWAP และแท่งยืนยันไปทางเดียวกัน; ไม่ไล่ราคา";

  return { activeSession, marketRegime: isTrend ? "trend" : "range", tradeState, directionalBias: bias, setup, qualityScore, asiaRange, londonRange, macroRisk, checklist, guidance };
}
