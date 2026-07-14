import { NextResponse } from "next/server";
import { getMergedCalendarEvents } from "../../../../lib/liveCalendarService";
import { normalizeSymbol } from "../../../../lib/symbolMapping";
import { getFirebaseAdminDb } from "../../../../lib/firebaseAdmin";
import type { EarningsEvent, GeneralCalendarEvent } from "../../../../types/calendar";

export const runtime = "nodejs";

// Fallback in-memory set ONLY used if Firebase Admin DB is unavailable in local dev environment
const localFallbackSentSet = new Set<string>();

/**
 * Checks if an alert has already been sent using Firebase Firestore `calendarAlertStates`.
 */
async function isAlertAlreadySent(alertKey: string, db: any): Promise<boolean> {
  if (!db) {
    return localFallbackSentSet.has(alertKey);
  }
  try {
    const docRef = db.collection("calendarAlertStates").doc(alertKey);
    const docSnap = await docRef.get();
    return docSnap.exists;
  } catch (err: any) {
    console.warn("Failed to check calendarAlertStates from Firebase, using fallback:", err.message);
    return localFallbackSentSet.has(alertKey);
  }
}

/**
 * Marks an alert as sent in Firebase Firestore `calendarAlertStates`.
 */
async function markAlertAsSent(alertKey: string, eventId: string, leadTimeLabel: string, db: any): Promise<void> {
  if (!db) {
    localFallbackSentSet.add(alertKey);
    return;
  }
  try {
    const docRef = db.collection("calendarAlertStates").doc(alertKey);
    await docRef.set({
      sentAt: new Date().toISOString(),
      timestamp: Date.now(),
      eventId,
      leadTimeLabel,
    });
    localFallbackSentSet.add(alertKey);
  } catch (err: any) {
    console.warn("Failed to set calendarAlertStates in Firebase:", err.message);
    localFallbackSentSet.add(alertKey);
  }
}

/**
 * GET /api/calendar/alerts?symbols=NVDA,AAPL&importance=high
 * Evaluates both upcoming lead-time alerts (7d, 24h, 1h) and actual post-announcement alerts (Beat/Miss/Guidance).
 * Persists sent state to Firebase Firestore (`calendarAlertStates`) to survive Render restarts.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get("symbols")?.split(",").map((s) => normalizeSymbol(s.trim())) ?? [];
  const importance = searchParams.get("importance"); // high | medium | low

  const now = new Date();
  const nowMs = now.getTime();
  const future7d = new Date(nowMs + 7 * 24 * 60 * 60 * 1000 + 3600 * 1000); // 7d + 1h buffer
  const past6h = new Date(nowMs - 6 * 60 * 60 * 1000); // Look back 6 hours for recently released actuals

  const db = getFirebaseAdminDb();

  try {
    const { events, status, sourceInfo } = await getMergedCalendarEvents(
      past6h,
      future7d,
      symbols.length > 0 ? symbols : null,
      "all"
    );

    const triggeredAlerts: any[] = [];
    const leadTimes = [
      { label: "7d", ms: 7 * 24 * 60 * 60 * 1000, toleranceMs: 60 * 60 * 1000 },
      { label: "24h", ms: 24 * 60 * 60 * 1000, toleranceMs: 30 * 60 * 1000 },
      { label: "1h", ms: 60 * 60 * 1000, toleranceMs: 15 * 60 * 1000 },
    ];

    for (const event of events) {
      if (importance && event.importance !== importance) continue;

      const eventMs = new Date(event.announcedAt).getTime();
      const msUntil = eventMs - nowMs;
      const msSince = nowMs - eventMs;
      const eventId = event.eventId || event.id;

      // ── 1. Upcoming Event Lead Time Alerts (7d, 24h, 1h) ─────────────────────────
      if (msUntil > 0) {
        for (const lt of leadTimes) {
          if (Math.abs(msUntil - lt.ms) <= lt.toleranceMs) {
            const alertKey = `upcoming_${eventId}_${lt.label}`;
            const alreadySent = await isAlertAlreadySent(alertKey, db);

            if (!alreadySent) {
              await markAlertAsSent(alertKey, eventId, lt.label, db);

              let proximity: "danger" | "warning" | "notice" = "notice";
              if (lt.label === "1h" || lt.label === "24h") proximity = "danger";
              else if (lt.label === "7d") proximity = "warning";

              triggeredAlerts.push({
                ...event,
                alertType: "upcoming",
                leadTimeLabel: lt.label,
                proximity,
                message: `📢 [Upcoming ${event.type === "earnings" ? "Earnings" : "Event"}] ${(event as any).title || (event as any).symbol} will be announced in ~${lt.label}.`,
              });
            }
          }
        }
      }

      // ── 2. Post-Announcement Actuals & Beat / Miss / Guidance Alerts ─────────────
      if (msSince >= 0 && msSince <= 6 * 60 * 60 * 1000) {
        if (event.type === "earnings" && ((event as EarningsEvent).epsActual !== null || (event as EarningsEvent).revenueActual !== null || (event as EarningsEvent).guidance !== null)) {
          const earnings = event as EarningsEvent;
          const alertKey = `actual_${eventId}_released`;
          const alreadySent = await isAlertAlreadySent(alertKey, db);

          if (!alreadySent && (earnings.epsActual || earnings.revenueActual || earnings.guidance)) {
            await markAlertAsSent(alertKey, eventId, "actual", db);

            const epsActual = parseFloat(earnings.epsActual || "0");
            const epsForecast = parseFloat(earnings.epsForecast || "0");
            const revActual = parseFloat((earnings.revenueActual || "0").replace(/[^0-9.]/g, ""));
            const revForecast = parseFloat((earnings.revenueForecast || "0").replace(/[^0-9.]/g, ""));

            let epsStatus = "In-line";
            if (epsForecast > 0 && epsActual > epsForecast * 1.01) epsStatus = "Beat 🚀";
            else if (epsForecast > 0 && epsActual < epsForecast * 0.99) epsStatus = "Miss ⚠️";

            let revStatus = "In-line";
            if (revForecast > 0 && revActual > revForecast * 1.01) revStatus = "Beat 🚀";
            else if (revForecast > 0 && revActual < revForecast * 0.99) revStatus = "Miss ⚠️";

            triggeredAlerts.push({
              ...event,
              alertType: "actual_released",
              epsStatus,
              revenueStatus: revStatus,
              guidanceChanged: Boolean(earnings.guidance),
              proximity: epsStatus.includes("Miss") || revStatus.includes("Miss") ? "danger" : "notice",
              message: `🔔 [Earnings Results] ${earnings.symbol}: EPS ${epsStatus} (${earnings.epsActual} vs ${earnings.epsForecast}), Revenue ${revStatus} (${earnings.revenueActual} vs ${earnings.revenueForecast}).${earnings.guidance ? ` Guidance: ${earnings.guidance}` : ""}`,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      newAlertsCount: triggeredAlerts.length,
      checkedAt: now.toISOString(),
      status,
      sourceInfo,
      alerts: triggeredAlerts,
    });
  } catch (err: any) {
    console.error("Calendar Alerts route error:", err.message);
    return NextResponse.json(
      { success: false, error: `Failed to check calendar alerts: ${err.message}`, alerts: [] },
      { status: 500 }
    );
  }
}
