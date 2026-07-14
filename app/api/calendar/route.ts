import { NextResponse } from "next/server";
import { getMergedCalendarEvents } from "../../../lib/liveCalendarService";
import { normalizeSymbol } from "../../../lib/symbolMapping";
import type { EventImportance } from "../../../types/calendar";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const type = searchParams.get("type"); // economic | earnings | crypto | all
  const importance = searchParams.get("importance") as EventImportance | null; // low | medium | high
  const symbol = searchParams.get("symbol"); // e.g. NVDA,AAPL,ASML.AS
  const from = searchParams.get("from"); // ISO date string
  const to = searchParams.get("to"); // ISO date string
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const now = new Date();
  // Default to upcoming events. Users opening the calendar need the next
  // catalyst first, not releases that have already passed.
  const fromDate = from ? new Date(from) : now;
  const toDate = to ? new Date(to) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const symbols = symbol ? symbol.split(",").map((s) => normalizeSymbol(s.trim())) : null;

  try {
    const { events, status, sourceInfo } = await getMergedCalendarEvents(
      fromDate,
      toDate,
      symbols,
      type,
      importance
    );

    // If live API failed and no events available or production safety triggered
    if (status === "UNAVAILABLE") {
      const providerDetail = sourceInfo.issues.join(" ");
      const unavailableMessage = type === "earnings"
        ? `Earnings calendar unavailable. ${providerDetail || "Verify FINNHUB_API_KEY on the server."}`
        : `Live data unavailable at this time. ${providerDetail}`.trim();
      return NextResponse.json(
        {
          success: false,
          message: unavailableMessage,
          total: 0,
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
          status,
          sourceInfo,
          events: [],
        },
        { status: 503 }
      );
    }

    // Apply limit
    const limitedEvents = events.slice(0, limit);

    return NextResponse.json({
      success: true,
      total: limitedEvents.length,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      status,
      sourceInfo,
      events: limitedEvents,
    });
  } catch (err: any) {
    console.error("Calendar API route error:", err.message);
    return NextResponse.json(
      {
        success: false,
        message: `Live data unavailable: ${err.message}`,
        status: "UNAVAILABLE",
        events: [],
      },
      { status: 500 }
    );
  }
}
