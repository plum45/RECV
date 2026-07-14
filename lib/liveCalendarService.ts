import axios from "axios";
import YahooFinance from "yahoo-finance2";
import { CALENDAR_DATABASE } from "./calendarDb";
import { normalizeSymbol, matchesAnySymbol } from "./symbolMapping";
import type { EconomicEvent, GeneralCalendarEvent, EarningsEvent, EventImportance, EventStatus } from "../types/calendar";

// Cache structure for Finnhub earnings responses
interface CachedEarnings {
  events: EarningsEvent[];
  fetchedAt: number;
  from: string;
  to: string;
}

let earningsCache: CachedEarnings | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache to respect Finnhub rate limits

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const YAHOO_EARNINGS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface CachedYahooEarnings {
  events: EarningsEvent[];
  fetchedAt: number;
  from: string;
  to: string;
}

let yahooEarningsCache: CachedYahooEarnings | null = null;

// Yahoo returns a company-level next earnings date without requiring an API
// key. This targeted list fills the international and major-tech gaps in the
// aggregate Finnhub calendar while keeping requests low enough to avoid abuse.
const YAHOO_EARNINGS_SYMBOLS = [
  { symbol: "ASML", yahooSymbol: "ASML" },
  { symbol: "TSM", yahooSymbol: "TSM" },
  { symbol: "NVDA", yahooSymbol: "NVDA" },
  { symbol: "AAPL", yahooSymbol: "AAPL" },
  { symbol: "MSFT", yahooSymbol: "MSFT" },
  { symbol: "AMD", yahooSymbol: "AMD" },
  { symbol: "GOOGL", yahooSymbol: "GOOGL" },
  { symbol: "META", yahooSymbol: "META" },
  { symbol: "AMZN", yahooSymbol: "AMZN" },
  { symbol: "AVGO", yahooSymbol: "AVGO" },
  { symbol: "QCOM", yahooSymbol: "QCOM" },
  { symbol: "MU", yahooSymbol: "MU" },
  { symbol: "ARM", yahooSymbol: "ARM" },
  { symbol: "SMCI", yahooSymbol: "SMCI" },
  { symbol: "PLTR", yahooSymbol: "PLTR" },
  { symbol: "CRWD", yahooSymbol: "CRWD" },
  { symbol: "SAP", yahooSymbol: "SAP" },
  { symbol: "SIE", yahooSymbol: "SIE.DE" },
  { symbol: "005930", yahooSymbol: "005930.KS" },
  { symbol: "000660", yahooSymbol: "000660.KS" },
] as const;

interface ForexFactoryCalendarEvent {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  actual?: string | number | null;
  forecast?: string | number | null;
  previous?: string | number | null;
}

interface CachedEconomicEvents {
  events: EconomicEvent[];
  fetchedAt: number;
}

let economicCache: CachedEconomicEvents | null = null;
const ECONOMIC_CACHE_TTL_MS = 15 * 60 * 1000;
const FOREX_FACTORY_WEEKLY_CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const TECH_RELEVANT_MACRO_CURRENCIES = new Set(["USD", "CNY", "EUR", "JPY", "GBP", "CAD"]);

function newYorkTimeToUtc(dateStr: string, hour: number, minute: number): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const wallClockAsUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const zoneName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
  }).formatToParts(wallClockAsUtc).find((part) => part.type === "timeZoneName")?.value || "GMT-5";
  const match = zoneName.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return wallClockAsUtc;

  const offsetMinutes = (Number(match[2]) * 60 + Number(match[3] || 0)) * (match[1] === "+" ? 1 : -1);
  return new Date(wallClockAsUtc.getTime() - offsetMinutes * 60 * 1000);
}

// Tech & International target symbols scope
const RELEVANT_TECH_SYMBOLS = new Set([
  // US Major Tech
  "NVDA", "AAPL", "MSFT", "AMD", "GOOGL", "META", "TSLA", "AMZN", "INTC", "AVGO",
  "QCOM", "ORCL", "MU", "MRVL", "SMCI", "PLTR", "ARM", "CRWD", "SNOW", "CRM",
  "ADBE", "NOW", "PANW", "ZS", "DDOG", "NET", "SHOP", "UBER", "LYFT", "ABNB",
  // International Tech (Semis & AI drivers)
  "ASML", "TSM", "005930", "000660", "SAP", "SIE",
]);

/**
 * Checks if a symbol (or any of its normalized forms/aliases) is part of our Tech/Semis coverage scope.
 */
export function isRelevantTechSymbol(rawSymbol: string): boolean {
  if (!rawSymbol) return false;
  const norm = normalizeSymbol(rawSymbol);
  return RELEVANT_TECH_SYMBOLS.has(norm);
}

function macroImportance(impact?: string): EventImportance {
  const normalized = impact?.trim().toLowerCase();
  if (normalized === "high") return "high";
  if (normalized === "medium" || normalized === "med") return "medium";
  return "low";
}

function valueOrNull(value: string | number | null | undefined): string | null {
  return value === null || value === undefined || value === "" ? null : String(value);
}

/**
 * Fetches this week's published macro calendar. Finnhub's economic-calendar
 * endpoint is premium-only, so this uses Forex Factory's public weekly JSON
 * export for upcoming releases such as CPI, PPI, retail sales, and Fed events.
 */
export async function fetchLiveEconomicCalendar(): Promise<{
  events: EconomicEvent[];
  status: "LIVE" | "UNAVAILABLE";
  error?: string;
}> {
  const now = Date.now();
  if (economicCache && now - economicCache.fetchedAt < ECONOMIC_CACHE_TTL_MS) {
    return { events: economicCache.events, status: "LIVE" };
  }

  try {
    const response = await axios.get<ForexFactoryCalendarEvent[]>(FOREX_FACTORY_WEEKLY_CALENDAR_URL, {
      timeout: 10_000,
      headers: { Accept: "application/json" },
    });
    if (!Array.isArray(response.data)) {
      return { events: [], status: "UNAVAILABLE", error: "Invalid economic calendar response." };
    }

    const fetchedAt = new Date().toISOString();
    const events = response.data.flatMap((item) => {
      const country = item.country?.toUpperCase();
      const title = item.title?.trim();
      const announcedAt = item.date ? new Date(item.date) : null;
      const importance = macroImportance(item.impact);

      // Limit the general calendar to macro releases likely to move US tech,
      // while keeping the page readable instead of listing every low-impact release.
      if (!country || !title || !announcedAt || Number.isNaN(announcedAt.getTime()) || importance === "low") {
        return [];
      }
      if (!TECH_RELEVANT_MACRO_CURRENCIES.has(country)) return [];

      const announcedAtIso = announcedAt.toISOString();
      const id = `ff-economic-${country}-${announcedAtIso}-${title}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      return [{
        id,
        eventId: id,
        type: "economic" as const,
        title,
        importance,
        announcedAt: announcedAtIso,
        timeThai: announcedAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
        actual: valueOrNull(item.actual),
        forecast: valueOrNull(item.forecast),
        previous: valueOrNull(item.previous),
        revision: null,
        country,
        source: {
          source: "Forex Factory Weekly Calendar",
          sourceUrl: FOREX_FACTORY_WEEKLY_CALENDAR_URL,
          fetchedAt,
          timezone: "UTC offset supplied by source",
          eventId: id,
        },
        // The feed warns that scheduled times can change, so do not present
        // them as confirmed to the minute.
        status: "ESTIMATED" as const,
      } satisfies EconomicEvent];
    });

    economicCache = { events, fetchedAt: now };
    return { events, status: "LIVE" };
  } catch (err: any) {
    console.error("Live economic calendar fetch failed:", err.message);
    return { events: [], status: "UNAVAILABLE", error: `Economic calendar unavailable: ${err.message}` };
  }
}

/**
 * Fetches live earnings data from Finnhub API across the requested date range (`from` to `to` as YYYY-MM-DD).
 */
export async function fetchLiveEarningsFromFinnhub(from: string, to: string): Promise<{
  events: EarningsEvent[];
  status: "LIVE" | "UNAVAILABLE";
  error?: string;
}> {
  const apiKey = process.env.FINNHUB_API_KEY;

  // If no valid API key, return immediately so caller uses fallback
  if (!apiKey || apiKey === "your_finnhub_api_key_optional" || apiKey.includes("your_")) {
    return {
      events: [],
      status: "UNAVAILABLE",
      error: "Finnhub API key not configured.",
    };
  }

  const now = Date.now();
  if (
    earningsCache &&
    now - earningsCache.fetchedAt < CACHE_TTL_MS &&
    earningsCache.from <= from &&
    earningsCache.to >= to
  ) {
    return { events: earningsCache.events, status: "LIVE" };
  }

  try {
    const baseUrl = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${apiKey}`;
    // US earnings are available on Finnhub's free tier. Fetch them first so an
    // unavailable international add-on never hides the whole earnings calendar.
    const usResponse = await axios.get<any>(baseUrl, { timeout: 10000 });
    if (usResponse.data?.error) {
      throw new Error(`Finnhub earnings API: ${usResponse.data.error}`);
    }

    const usList = usResponse.data?.earningsCalendar || usResponse.data || [];
    if (!Array.isArray(usList)) {
      return { events: [], status: "UNAVAILABLE", error: "Invalid Finnhub response format." };
    }

    let rawList = usList;
    // International results are helpful for ASML and other semiconductor
    // bellwethers, but they can require a higher Finnhub entitlement. Keep the
    // already-successful US result when this optional request is rejected.
    try {
      const internationalResponse = await axios.get<any>(`${baseUrl}&international=true`, { timeout: 10000 });
      const internationalList = internationalResponse.data?.earningsCalendar || internationalResponse.data || [];
      if (Array.isArray(internationalList)) {
        rawList = [...usList, ...internationalList];
      }
    } catch (internationalError: any) {
      console.warn("Finnhub international earnings unavailable; continuing with US earnings:", internationalError.message);
    }

    const liveEvents: EarningsEvent[] = [];
    const fetchedAtIso = new Date().toISOString();

    for (const item of rawList) {
      const rawSym = item.symbol;
      if (!rawSym || !isRelevantTechSymbol(rawSym)) continue;

      const normSym = normalizeSymbol(rawSym);
      const dateStr = item.date || from;
      const hourStr = item.hour || ""; // "bmo" (before market open), "amc" (after market close), etc.

      // Finnhub supplies a date and sometimes BMO/AMC. Unknown times must be
      // marked estimated rather than displayed as a confirmed local time.
      let announcedAtDate = new Date(`${dateStr}T12:00:00Z`);
      let timeIsEstimated = true;
      if (hourStr.toLowerCase() === "bmo") {
        announcedAtDate = newYorkTimeToUtc(dateStr, 8, 30);
        timeIsEstimated = false;
      } else if (hourStr.toLowerCase() === "amc") {
        announcedAtDate = newYorkTimeToUtc(dateStr, 16, 0);
        timeIsEstimated = false;
      }

      const announcedAtIso = announcedAtDate.toISOString();
      const timeThai = announcedAtDate.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

      // Determine importance based on market cap / key tech bellwether status
      const majorBellwethers = new Set(["NVDA", "AAPL", "MSFT", "GOOGL", "META", "AMZN", "TSM", "ASML"]);
      const importance: EventImportance = majorBellwethers.has(normSym) ? "high" : "medium";

      const eventId = `finnhub-earnings-${normSym}-${dateStr}-${item.quarter || "0"}`;

      liveEvents.push({
        id: eventId,
        eventId: eventId,
        symbol: normSym,
        type: "earnings",
        announcedAt: announcedAtIso,
        timeThai: timeThai,
        importance: importance,
        revenueActual: item.revenueActual !== null && item.revenueActual !== undefined ? String(item.revenueActual) : null,
        revenueForecast: item.revenueEstimate !== null && item.revenueEstimate !== undefined ? String(item.revenueEstimate) : null,
        revenuePrevious: null,
        epsActual: item.epsActual !== null && item.epsActual !== undefined ? String(item.epsActual) : null,
        epsForecast: item.epsEstimate !== null && item.epsEstimate !== undefined ? String(item.epsEstimate) : null,
        epsPrevious: null,
        guidance: null,
        eventTypeName: "Earnings",
        quarter: item.quarter ? Number(item.quarter) : undefined,
        year: item.year ? Number(item.year) : undefined,
        exchange: item.symbol?.includes(".") ? item.symbol.split(".")[1] : "US",
        source: {
          source: "Finnhub Earnings API",
          sourceUrl: `https://finnhub.io/api/v1/calendar/earnings?symbol=${normSym}`,
          fetchedAt: fetchedAtIso,
          timezone: timeIsEstimated ? "UTC (announcement time not supplied)" : "America/New_York",
          eventId: eventId,
        },
        status: timeIsEstimated ? "ESTIMATED" : "LIVE",
      });
    }

    // Save to cache
    earningsCache = {
      events: liveEvents,
      fetchedAt: now,
      from,
      to,
    };

    return { events: liveEvents, status: "LIVE" };
  } catch (err: any) {
    console.error("Finnhub Live Earnings fetch failed:", err.message);
    const statusCode = err.response?.status;
    const providerMessage = err.response?.data?.error || err.message;
    return {
      events: [],
      status: "UNAVAILABLE",
      error: `Finnhub earnings unavailable${statusCode ? ` (HTTP ${statusCode})` : ""}: ${String(providerMessage).slice(0, 180)}`,
    };
  }
}

/**
 * Fetches a focused global earnings calendar from Yahoo Finance. Unlike the
 * aggregate Finnhub endpoint, Yahoo exposes the next known date per company,
 * which is especially useful for ASML, TSM, Samsung, and SK Hynix.
 */
export async function fetchYahooEarningsCalendar(from: string, to: string): Promise<{
  events: EarningsEvent[];
  status: "LIVE" | "UNAVAILABLE";
  error?: string;
}> {
  const now = Date.now();
  if (
    yahooEarningsCache &&
    now - yahooEarningsCache.fetchedAt < YAHOO_EARNINGS_CACHE_TTL_MS &&
    yahooEarningsCache.from <= from &&
    yahooEarningsCache.to >= to
  ) {
    return { events: yahooEarningsCache.events, status: "LIVE" };
  }

  const fromTime = new Date(`${from}T00:00:00.000Z`).getTime();
  const toTime = new Date(`${to}T23:59:59.999Z`).getTime();
  const fetchedAt = new Date().toISOString();

  try {
    const settled = await Promise.allSettled(
      YAHOO_EARNINGS_SYMBOLS.map(async ({ symbol, yahooSymbol }) => {
        const result = await yahooFinance.quoteSummary(yahooSymbol, {
          modules: ["calendarEvents"],
        });
        const earnings = result.calendarEvents?.earnings;
        const earningsDate = earnings?.earningsDate?.find((date) => {
          const timestamp = date.getTime();
          return timestamp >= fromTime && timestamp <= toTime;
        });

        if (!earningsDate) return null;

        const isEstimated = earnings?.isEarningsDateEstimate !== false;
        const dateKey = earningsDate.toISOString().slice(0, 10);
        const id = `yahoo-earnings-${symbol}-${dateKey}`.toLowerCase();
        const isMajorBellwether = new Set(["NVDA", "AAPL", "MSFT", "GOOGL", "META", "AMZN", "TSM", "ASML"]).has(symbol);

        return {
          id,
          eventId: id,
          symbol,
          type: "earnings" as const,
          announcedAt: earningsDate.toISOString(),
          timeThai: earningsDate.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
          importance: isMajorBellwether ? "high" : "medium",
          revenueActual: null,
          revenueForecast: earnings?.revenueAverage !== undefined ? String(earnings.revenueAverage) : null,
          revenuePrevious: null,
          epsActual: null,
          epsForecast: earnings?.earningsAverage !== undefined ? String(earnings.earningsAverage) : null,
          epsPrevious: null,
          guidance: null,
          eventTypeName: "Earnings",
          exchange: yahooSymbol.includes(".") ? yahooSymbol.split(".").at(-1) || "Global" : "US",
          source: {
            source: "Yahoo Finance Calendar Events",
            sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(yahooSymbol)}`,
            fetchedAt,
            timezone: "Timestamp supplied by Yahoo Finance",
            eventId: id,
          },
          status: isEstimated ? "ESTIMATED" : "LIVE",
        } satisfies EarningsEvent;
      })
    );

    const events = settled.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
    const failedCount = settled.filter((result) => result.status === "rejected").length;
    if (events.length === 0 && failedCount === YAHOO_EARNINGS_SYMBOLS.length) {
      const firstFailure = settled.find((result) => result.status === "rejected");
      const message = firstFailure && firstFailure.status === "rejected"
        ? String(firstFailure.reason?.message || firstFailure.reason)
        : "All Yahoo earnings requests failed.";
      return { events: [], status: "UNAVAILABLE", error: `Yahoo earnings unavailable: ${message.slice(0, 180)}` };
    }

    yahooEarningsCache = { events, fetchedAt: now, from, to };
    return { events, status: "LIVE" };
  } catch (err: any) {
    return {
      events: [],
      status: "UNAVAILABLE",
      error: `Yahoo earnings unavailable: ${String(err.message || err).slice(0, 180)}`,
    };
  }
}

/**
 * Merges live earnings with a live macro-event feed. Fixture data must never
 * be presented as a real schedule because its date can be stale.
 */
export async function getMergedCalendarEvents(
  fromDate: Date,
  toDate: Date,
  symbolFilter?: string[] | null,
  typeFilter?: string | null,
  importanceFilter?: EventImportance | null
): Promise<{
  events: GeneralCalendarEvent[];
  status: "LIVE" | "ESTIMATED" | "UNAVAILABLE";
  sourceInfo: {
    source: string;
    fetchedAt: string;
    liveCount: number;
    fallbackCount: number;
    issues: string[];
  };
}> {
  const fromIsoDate = fromDate.toISOString().substring(0, 10);
  const toIsoDate = toDate.toISOString().substring(0, 10);
  const fetchedAtIso = new Date().toISOString();

  // 1. Try fetching live earnings from Finnhub
  let liveEarningsResult = { events: [] as EarningsEvent[], status: "UNAVAILABLE" as EventStatus, error: "" };
  let yahooEarningsResult = { events: [] as EarningsEvent[], status: "UNAVAILABLE" as EventStatus, error: "" };
  if (!typeFilter || typeFilter === "all" || typeFilter === "earnings") {
    const [res, yahooRes] = await Promise.all([
      fetchLiveEarningsFromFinnhub(fromIsoDate, toIsoDate),
      fetchYahooEarningsCalendar(fromIsoDate, toIsoDate),
    ]);
    liveEarningsResult = {
      events: res.events,
      status: res.status,
      error: res.error || "",
    };
    yahooEarningsResult = {
      events: yahooRes.events,
      status: yahooRes.status,
      error: yahooRes.error || "",
    };
  }

  let liveEconomicResult = { events: [] as EconomicEvent[], status: "UNAVAILABLE" as EventStatus, error: "" };
  if (!typeFilter || typeFilter === "all" || typeFilter === "economic") {
    const res = await fetchLiveEconomicCalendar();
    liveEconomicResult = {
      events: res.events,
      status: res.status,
      error: res.error || "",
    };
  }

  // 2. Map and deduplicate keys
  // Key format: `type_symbolOrId_date`
  // 2. Map and deduplicate keys
  // Key format: `type_symbolOrId_date`
  const dedupeMap = new Map<string, GeneralCalendarEvent>();
  let finnhubEarningsCount = 0;
  let yahooEarningsCount = 0;
  let economicCount = 0;
  let fallbackCount = 0;

  // Add Live Events first
  const addEarningsEvent = (liveEv: EarningsEvent, source: "finnhub" | "yahoo") => {
    const evDate = new Date(liveEv.announcedAt);
    if (evDate < fromDate || evDate > toDate) return;

    if (symbolFilter && symbolFilter.length > 0) {
      if (!matchesAnySymbol(liveEv.symbol, symbolFilter)) return;
    }

    if (importanceFilter && liveEv.importance !== importanceFilter) return;

    const dateKey = liveEv.announcedAt.substring(0, 10);
    const dedupeKey = `earnings_${normalizeSymbol(liveEv.symbol)}_${dateKey}`;
    if (dedupeMap.has(dedupeKey)) return;
    dedupeMap.set(dedupeKey, liveEv);
    if (source === "finnhub") finnhubEarningsCount++;
    else yahooEarningsCount++;
  };

  // Finnhub has priority for actual earnings figures. Yahoo fills dates that
  // Finnhub Free does not cover, notably global semiconductor bellwethers.
  for (const liveEv of liveEarningsResult.events) {
    addEarningsEvent(liveEv, "finnhub");
  }
  for (const yahooEv of yahooEarningsResult.events) {
    addEarningsEvent(yahooEv, "yahoo");
  }

  // Macro events remain relevant when a symbol filter is active: CPI, PPI,
  // Fed and China data can move the entire technology sector, not one ticker.
  for (const economicEvent of liveEconomicResult.events) {
    const eventDate = new Date(economicEvent.announcedAt);
    if (eventDate < fromDate || eventDate > toDate) continue;
    if (importanceFilter && economicEvent.importance !== importanceFilter) continue;

    const dedupeKey = `economic_${economicEvent.country}_${economicEvent.announcedAt}_${economicEvent.title}`;
    dedupeMap.set(dedupeKey, economicEvent);
    economicCount++;
  }

  // 3. Static entries use offsetDays() fixtures. They are useful while
  // developing the UI, but never represent a verified production schedule.
  if (process.env.NODE_ENV !== "production" && process.env.CALENDAR_ALLOW_FIXTURES === "true") {
    for (const staticEv of CALENDAR_DATABASE) {

    const evDate = new Date(staticEv.announcedAt);
    if (evDate < fromDate || evDate > toDate) continue;

    // Apply type filter
    if (typeFilter && typeFilter !== "all" && staticEv.type !== typeFilter) continue;

    // Apply symbol filter
    if (symbolFilter && symbolFilter.length > 0) {
      if (staticEv.type === "earnings") {
        if (!matchesAnySymbol(staticEv.symbol, symbolFilter)) continue;
      } else if (staticEv.type === "crypto") {
        if (!symbolFilter.some((s) => normalizeSymbol(staticEv.symbol).includes(normalizeSymbol(s)))) continue;
      } else if (staticEv.type === "economic") {
        // High importance economic events included
        if (staticEv.importance !== "high") continue;
      }
    }

    // Apply importance filter
    if (importanceFilter && staticEv.importance !== importanceFilter) continue;

    // Check overlap with live event
    const dateKey = staticEv.announcedAt.substring(0, 10);
    let dedupeKey = `${staticEv.type}_${staticEv.id}`;
    if (staticEv.type === "earnings") {
      const normSym = normalizeSymbol((staticEv as EarningsEvent).symbol);
      dedupeKey = `earnings_${normSym}_${dateKey}_${(staticEv as EarningsEvent).quarter || ""}`;
    }

    // A live date must win even when Finnhub did not supply BMO/AMC.
    if (dedupeMap.has(dedupeKey)) {
      continue;
    }

    // Static/Fallback events are categorized as ESTIMATED if live API is working, otherwise FALLBACK or ESTIMATED
    const fallbackStatus: EventStatus = "ESTIMATED";
    const stDate = new Date(staticEv.announcedAt);
    const cleanTimeThai =
      typeof staticEv.timeThai === "string" && staticEv.timeThai.includes("T") && !isNaN(stDate.getTime())
        ? stDate.toLocaleString("th-TH", {
            timeZone: "Asia/Bangkok",
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }) + " น."
        : staticEv.timeThai;

    const enrichedStatic: GeneralCalendarEvent = {
      ...staticEv,
      timeThai: cleanTimeThai,
      status: fallbackStatus,
      source: {
        ...staticEv.source,
        fetchedAt: fetchedAtIso,
        source: staticEv.source?.source || "Static Verified Database",
      },
    };

    if (enrichedStatic.type === "earnings") {
      (enrichedStatic as EarningsEvent).symbol = normalizeSymbol((enrichedStatic as EarningsEvent).symbol);
    }

    dedupeMap.set(dedupeKey, enrichedStatic);
    fallbackCount++;
    }
  }

  const mergedList = Array.from(dedupeMap.values()).sort(
    (a, b) => new Date(a.announcedAt).getTime() - new Date(b.announcedAt).getTime()
  );

  const earningsCount = finnhubEarningsCount + yahooEarningsCount;
  const overallStatus: "LIVE" | "ESTIMATED" | "UNAVAILABLE" =
    earningsCount + economicCount > 0
      ? "LIVE"
      : fallbackCount > 0
      ? "ESTIMATED"
      : "UNAVAILABLE";

  return {
    events: mergedList,
    status: overallStatus,
    sourceInfo: {
      source: earningsCount > 0 && economicCount > 0
        ? "Finnhub/Yahoo Earnings Calendar + Forex Factory Weekly Calendar"
        : finnhubEarningsCount > 0 && yahooEarningsCount > 0
        ? "Finnhub Live Earnings API + Yahoo Finance Calendar Events"
        : finnhubEarningsCount > 0
        ? "Finnhub Live Earnings API"
        : yahooEarningsCount > 0
        ? "Yahoo Finance Calendar Events"
        : economicCount > 0
        ? "Forex Factory Weekly Calendar"
        : fallbackCount > 0
        ? "Development fixture calendar"
        : "Live calendar unavailable",
      fetchedAt: fetchedAtIso,
      liveCount: earningsCount + economicCount,
      fallbackCount,
      issues: [
        liveEarningsResult.status === "UNAVAILABLE" ? liveEarningsResult.error : "",
        yahooEarningsResult.status === "UNAVAILABLE" ? yahooEarningsResult.error : "",
        liveEconomicResult.status === "UNAVAILABLE" ? liveEconomicResult.error : "",
      ].filter(Boolean),
    },
  };
}
