import { NextResponse } from "next/server";
import { CALENDAR_DATABASE } from "../../../../lib/calendarDb";

export const runtime = "nodejs";

// Simple in-memory sent-alert tracking (resets on redeploy — use DB for production persistence)
const sentAlertIds = new Set<string>();

/**
 * GET /api/calendar/alerts?symbols=NVDA,AAPL&importance=high
 * Returns events that are about to trigger (within the lead time windows).
 * Deduplicates alerts that have already been "sent" in this process session.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get("symbols")?.split(",").map((s) => s.trim().toUpperCase()) ?? [];
  const importance = searchParams.get("importance"); // high | medium | low
  const leadTimeHours = parseInt(searchParams.get("leadTimeHours") || "24", 10); // default 24h

  const now = new Date();
  const windowEnd = new Date(now.getTime() + leadTimeHours * 60 * 60 * 1000);

  const triggerable = CALENDAR_DATABASE.filter((event) => {
    const eventDate = new Date(event.announcedAt);
    if (eventDate < now || eventDate > windowEnd) return false;
    if (importance && event.importance !== importance) return false;

    // Symbol scope
    if (symbols.length > 0) {
      if (event.type === "earnings") {
        if (!symbols.includes(event.symbol.toUpperCase())) {
          return false;
        }
      } else if (event.type === "economic") {
        // Always include high-importance economic events even if symbols are filtered
        if (event.importance !== "high") {
          return false;
        }
      } else if (event.type === "crypto") {
        if (!symbols.includes(event.symbol.toUpperCase())) {
          return false;
        }
      }
    }

    return true;
  });

  // Deduplicate: filter out alerts already emitted this session
  const newAlerts = triggerable.filter((e) => !sentAlertIds.has(e.id));

  // Mark all current alerts as sent
  newAlerts.forEach((e) => sentAlertIds.add(e.id));

  const enriched = newAlerts
    .sort((a, b) => new Date(a.announcedAt).getTime() - new Date(b.announcedAt).getTime())
    .map((event) => {
      const hoursUntil =
        (new Date(event.announcedAt).getTime() - now.getTime()) / (1000 * 60 * 60);
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

  return NextResponse.json({
    newAlertsCount: enriched.length,
    leadTimeHours,
    checkedAt: now.toISOString(),
    alerts: enriched,
  });
}
