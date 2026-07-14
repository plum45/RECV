import { NextResponse } from "next/server";
import { getMergedCalendarEvents } from "../../../../lib/liveCalendarService";
import { normalizeSymbol, SYMBOL_ALIAS_MAP } from "../../../../lib/symbolMapping";
import type { EarningsEvent, GeneralCalendarEvent } from "../../../../types/calendar";

export const runtime = "nodejs";

/**
 * GET /api/calendar/impact?symbol=NVDA
 * Returns upcoming events for a symbol with countdown, forecast, event risk, and sector impact.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawSymbol = searchParams.get("symbol");

  if (!rawSymbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const symbol = normalizeSymbol(rawSymbol);
  const now = new Date();
  const future30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  try {
    const { events, status, sourceInfo } = await getMergedCalendarEvents(
      now,
      future30d,
      [symbol],
      "all"
    );

    const enriched = events
      .sort((a, b) => new Date(a.announcedAt).getTime() - new Date(b.announcedAt).getTime())
      .map((event) => {
        const eventDate = new Date(event.announcedAt);
        const hoursUntil = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        const daysUntil = hoursUntil / 24;

        let proximity: "danger" | "warning" | "notice" = "notice";
        if (hoursUntil <= 24) proximity = "danger";
        else if (daysUntil <= 3) proximity = "warning";

        // Calculate Event Risk level
        let eventRisk: "HIGH" | "MODERATE" | "LOW" = "LOW";
        if (event.importance === "high") {
          eventRisk = hoursUntil <= 48 ? "HIGH" : "MODERATE";
        } else if (event.importance === "medium") {
          eventRisk = hoursUntil <= 24 ? "MODERATE" : "LOW";
        }

        // Determine specific stock & sector impact notes
        const isSemiconductor = ["NVDA", "AMD", "AVGO", "INTC", "TSM", "ASML", "QCOM", "MU", "SMH"].includes(symbol);
        const sectorName = isSemiconductor ? "Semiconductors & AI Hardware" : "Technology & Cloud Computing";

        const stockImpactDescription =
          event.type === "earnings"
            ? `ผลประกอบการไตรมาสของ ${symbol} เป็นตัวเร่งราคา (Catalyst) โดยตรง หาก EPS หรือ Guidance สูงกว่าความคาดหมาย อาจหนุนให้ราคา Breakout แนวต้านสำคัญ`
            : `รายงานเศรษฐกิจมหภาค (${event.title}) มีผลกระทบต่อ Bond Yield และความน่าสนใจของหุ้นเติบโตสูง (High-Growth Tech) เช่น ${symbol}`;

        const sectorImpactDescription =
          event.type === "earnings"
            ? `ผลการดำเนินงานและ Guidance ของ ${symbol} ส่งผลชี้นำความมั่นใจในกลุ่ม ${sectorName} ทั่วโลก และ Supply Chain ที่เกี่ยวข้อง`
            : `ข้อมูลเศรษฐกิจ ${event.title} จะส่งผลต่อการคาดการณ์ทิศทางดอกเบี้ย Fed และสภาวะสภาพคล่องของทั้งภาคอุตสาหกรรมเทคโนโลยี`;

        const epsForecast = event.type === "earnings" ? (event as EarningsEvent).epsForecast || "N/A" : null;
        const revForecast = event.type === "earnings" ? (event as EarningsEvent).revenueForecast || "N/A" : null;

        return {
          ...event,
          hoursUntil: Math.round(hoursUntil * 10) / 10,
          daysUntil: Math.round(daysUntil * 10) / 10,
          countdownText:
            daysUntil >= 1
              ? `อีก ${Math.floor(daysUntil)} วัน ${Math.round((daysUntil % 1) * 24)} ชั่วโมง`
              : `อีก ${Math.max(1, Math.round(hoursUntil))} ชั่วโมง`,
          proximity,
          eventRisk,
          epsForecast,
          revenueForecast: revForecast,
          sectorName,
          stockImpactDescription,
          sectorImpactDescription,
        };
      });

    const nextEvent = enriched.length > 0 ? enriched[0] : null;
    const hasHighImpact = enriched.some((e) => e.eventRisk === "HIGH" || e.proximity === "danger");

    return NextResponse.json({
      symbol,
      alias: SYMBOL_ALIAS_MAP[rawSymbol.toUpperCase()] || symbol,
      hasHighImpact,
      nextEvent,
      eventCount: enriched.length,
      status,
      sourceInfo,
      events: enriched,
    });
  } catch (err: any) {
    console.error("Calendar Impact route error:", err.message);
    return NextResponse.json(
      { error: `Failed to evaluate calendar impact: ${err.message}` },
      { status: 500 }
    );
  }
}
