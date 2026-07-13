import { NextResponse } from "next/server";
import { CALENDAR_DATABASE } from "../../../lib/calendarDb";
import type { GeneralCalendarEvent, EventImportance } from "../../../types/calendar";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const type = searchParams.get("type"); // economic | earnings | crypto | all
  const importance = searchParams.get("importance") as EventImportance | null; // low | medium | high
  const symbol = searchParams.get("symbol"); // e.g. NVDA,AAPL
  const from = searchParams.get("from"); // ISO date string
  const to = searchParams.get("to"); // ISO date string
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const now = new Date();
  // Default: next 30 days if no range specified
  const fromDate = from ? new Date(from) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const toDate = to ? new Date(to) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const symbols = symbol ? symbol.split(",").map((s) => s.trim().toUpperCase()) : null;

  let results: GeneralCalendarEvent[] = CALENDAR_DATABASE.filter((event) => {
    const eventDate = new Date(event.announcedAt);

    // Date range filter
    if (eventDate < fromDate || eventDate > toDate) return false;

    // Type filter
    if (type && type !== "all" && event.type !== type) return false;

    // Importance filter
    if (importance && event.importance !== importance) return false;

    // Symbol filter (for earnings and crypto)
    if (symbols) {
      if (event.type === "earnings" && !symbols.includes(event.symbol.toUpperCase())) return false;
      if (event.type === "crypto" && !symbols.some((s) => event.symbol.toUpperCase().includes(s))) return false;
      if (event.type === "economic") return true; // Economic events always included when filtering by symbol
    }

    return true;
  });

  // Sort by date ascending
  results = results.sort(
    (a, b) => new Date(a.announcedAt).getTime() - new Date(b.announcedAt).getTime()
  );

  // Apply limit
  results = results.slice(0, limit);

  return NextResponse.json({
    total: results.length,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    events: results,
  });
}
