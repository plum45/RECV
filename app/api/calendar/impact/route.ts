import { NextResponse } from "next/server";
import { CALENDAR_DATABASE } from "../../../../lib/calendarDb";
import type { GeneralCalendarEvent } from "../../../../types/calendar";

export const runtime = "nodejs";

/**
 * GET /api/calendar/impact?symbol=NVDA
 * Returns upcoming events for a symbol with proximity alerts:
 * - within 24h → "danger"
 * - within 3 days → "warning"
 * - within 7 days → "notice"
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const now = new Date();
  const future7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const relevantEvents = CALENDAR_DATABASE.filter((event) => {
    const eventDate = new Date(event.announcedAt);
    if (eventDate < now || eventDate > future7d) return false;

    // Match earnings/crypto by symbol
    if (event.type === "earnings" && event.symbol.toUpperCase() === symbol) return true;
    if (event.type === "crypto" && event.symbol.toUpperCase().includes(symbol)) return true;
    // Include all high-importance economic events regardless of symbol
    if (event.type === "economic" && event.importance === "high") return true;

    return false;
  });

  const enriched = relevantEvents
    .sort((a, b) => new Date(a.announcedAt).getTime() - new Date(b.announcedAt).getTime())
    .map((event) => {
      const eventDate = new Date(event.announcedAt);
      const hoursUntil = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      const daysUntil = hoursUntil / 24;

      let proximity: "danger" | "warning" | "notice" = "notice";
      if (hoursUntil <= 24) proximity = "danger";
      else if (daysUntil <= 3) proximity = "warning";

      return {
        ...event,
        hoursUntil: Math.round(hoursUntil * 10) / 10,
        daysUntil: Math.round(daysUntil * 10) / 10,
        proximity,
      };
    });

  const hasHighImpact = enriched.some(
    (e) => e.importance === "high" && e.proximity !== "notice"
  );

  return NextResponse.json({
    symbol,
    hasHighImpact,
    eventCount: enriched.length,
    events: enriched,
  });
}
