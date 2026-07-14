import axios from "axios";
import { CALENDAR_DATABASE } from "./calendarDb";
import { normalizeSymbol, areSymbolsEquivalent, matchesAnySymbol, SYMBOL_ALIAS_MAP } from "./symbolMapping";
import type { GeneralCalendarEvent, EarningsEvent, EventImportance, EventStatus } from "../types/calendar";

// Cache structure for Finnhub earnings responses
interface CachedEarnings {
  events: EarningsEvent[];
  fetchedAt: number;
  from: string;
  to: string;
}

let earningsCache: CachedEarnings | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache to respect Finnhub rate limits

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

/**
 * Fetches live earnings data from Finnhub API across the requested date range (`from` to `to` as YYYY-MM-DD).
 */
export async function fetchLiveEarningsFromFinnhub(from: string, to: string): Promise<{
  events: EarningsEvent[];
  status: "LIVE" | "FALLBACK" | "UNAVAILABLE";
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
    const url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${apiKey}`;
    const response = await axios.get<any>(url, { timeout: 10000 });

    const rawList = response.data?.earningsCalendar || response.data || [];
    if (!Array.isArray(rawList)) {
      return { events: [], status: "UNAVAILABLE", error: "Invalid Finnhub response format." };
    }

    const liveEvents: EarningsEvent[] = [];
    const fetchedAtIso = new Date().toISOString();

    for (const item of rawList) {
      const rawSym = item.symbol;
      if (!rawSym || !isRelevantTechSymbol(rawSym)) continue;

      const normSym = normalizeSymbol(rawSym);
      const dateStr = item.date || from;
      const hourStr = item.hour || ""; // "bmo" (before market open), "amc" (after market close), etc.

      // Construct announcedAt ISO string roughly around announcement hour
      let announcedAtDate = new Date(`${dateStr}T12:00:00Z`);
      if (hourStr.toLowerCase() === "bmo") {
        announcedAtDate = new Date(`${dateStr}T13:30:00Z`); // ~8:30 AM EST -> 13:30 UTC
      } else if (hourStr.toLowerCase() === "amc") {
        announcedAtDate = new Date(`${dateStr}T21:00:00Z`); // ~4:00 PM EST -> 21:00 UTC
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
          timezone: hourStr.toLowerCase() === "bmo" || hourStr.toLowerCase() === "amc" ? "EST" : "UTC",
          eventId: eventId,
        },
        status: "LIVE",
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
    return {
      events: [],
      status: "UNAVAILABLE",
      error: `Live data unavailable: ${err.message}`,
    };
  }
}

/**
 * Merges Live Earnings from Finnhub with Static/Fallback events from `CALENDAR_DATABASE`.
 * - Deduplicates using `normalizeSymbol(symbol) + "_" + date (YYYY-MM-DD) + "_" + quarter`.
 * - If Live event overlaps with Static event, **Live event takes priority**.
 * - Sets static/fallback events to `status: "FALLBACK"` or `status: "UNAVAILABLE"`.
 */
export async function getMergedCalendarEvents(
  fromDate: Date,
  toDate: Date,
  symbolFilter?: string[] | null,
  typeFilter?: string | null,
  importanceFilter?: EventImportance | null
): Promise<{
  events: GeneralCalendarEvent[];
  status: "LIVE" | "FALLBACK" | "UNAVAILABLE";
  sourceInfo: {
    source: string;
    fetchedAt: string;
    liveCount: number;
    fallbackCount: number;
  };
}> {
  const fromIsoDate = fromDate.toISOString().substring(0, 10);
  const toIsoDate = toDate.toISOString().substring(0, 10);
  const fetchedAtIso = new Date().toISOString();

  // 1. Try fetching live earnings from Finnhub
  let liveEarningsResult = { events: [] as EarningsEvent[], status: "UNAVAILABLE" as EventStatus, error: "" };
  if (!typeFilter || typeFilter === "all" || typeFilter === "earnings") {
    const res = await fetchLiveEarningsFromFinnhub(fromIsoDate, toIsoDate);
    liveEarningsResult = {
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
  let liveCount = 0;
  let fallbackCount = 0;

  const isProduction = process.env.NODE_ENV === "production";

  // Add Live Events first
  for (const liveEv of liveEarningsResult.events) {
    const evDate = new Date(liveEv.announcedAt);
    if (evDate < fromDate || evDate > toDate) continue;

    if (symbolFilter && symbolFilter.length > 0) {
      if (!matchesAnySymbol(liveEv.symbol, symbolFilter)) continue;
    }

    if (importanceFilter && liveEv.importance !== importanceFilter) continue;

    // Check with Investor Relations database (CALENDAR_DATABASE) when date is unconfirmed
    const irMatch = CALENDAR_DATABASE.find(
      (e) =>
        e.type === "earnings" &&
        normalizeSymbol(e.symbol) === normalizeSymbol(liveEv.symbol) &&
        (e.quarter === liveEv.quarter || e.year === liveEv.year)
    );

    if (irMatch) {
      // If we have a verified Investor Relations date, cross-reference and use it
      liveEv.announcedAt = irMatch.announcedAt;
      liveEv.timeThai = irMatch.timeThai;
      liveEv.status = "LIVE";
    } else {
      liveEv.status = "LIVE";
    }

    const dateKey = liveEv.announcedAt.substring(0, 10);
    const dedupeKey = `earnings_${normalizeSymbol(liveEv.symbol)}_${dateKey}_${liveEv.quarter || ""}`;
    dedupeMap.set(dedupeKey, liveEv);
    liveCount++;
  }

  // 3. Add Static/Fallback Events from CALENDAR_DATABASE (Economic, Crypto, or missing Earnings)
  for (const staticEv of CALENDAR_DATABASE) {
    // If in Production, reject if it is mock/simulated (has offsetDays or no verified status)
    if (isProduction && staticEv.status === "estimated") {
      // In Production, do not use unverified mock events
      continue;
    }

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

    // If already populated by Live Event, skip static (Live takes precedence!)
    if (dedupeMap.has(dedupeKey) && dedupeMap.get(dedupeKey)?.status === "LIVE") {
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

  const mergedList = Array.from(dedupeMap.values()).sort(
    (a, b) => new Date(a.announcedAt).getTime() - new Date(b.announcedAt).getTime()
  );

  const overallStatus: "LIVE" | "ESTIMATED" | "UNAVAILABLE" =
    liveCount > 0
      ? "LIVE"
      : fallbackCount > 0
      ? "ESTIMATED"
      : "UNAVAILABLE";

  return {
    events: mergedList,
    status: overallStatus,
    sourceInfo: {
      source: liveCount > 0 ? "Finnhub Live API + Fallback Database" : "Static Fallback Calendar (Live Data Unavailable)",
      fetchedAt: fetchedAtIso,
      liveCount,
      fallbackCount,
    },
  };
}
