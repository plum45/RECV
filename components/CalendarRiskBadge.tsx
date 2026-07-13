"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Calendar, Clock, ChevronDown, ChevronRight } from "lucide-react";

interface CalendarImpactEvent {
  id: string;
  type: "economic" | "earnings" | "crypto";
  title?: string;
  symbol?: string;
  announcedAt: string;
  importance: "low" | "medium" | "high";
  hoursUntil: number;
  daysUntil: number;
  proximity: "danger" | "warning" | "notice";
  epsForecast?: string | null;
  revenueForecast?: string | null;
  forecast?: string | null;
  eventTypeName?: string;
}

interface CalendarRiskBadgeProps {
  symbol: string;
}

const proximityConfig = {
  danger: {
    bg: "bg-rose-500/10 border-rose-500/30",
    text: "text-rose-400",
    icon: "text-rose-500",
    label: "⚠️ เหตุการณ์สำคัญ",
    dot: "bg-rose-500",
  },
  warning: {
    bg: "bg-amber-500/10 border-amber-500/30",
    text: "text-amber-400",
    icon: "text-amber-400",
    label: "📅 ใกล้ถึงเหตุการณ์",
    dot: "bg-amber-400",
  },
  notice: {
    bg: "bg-blue-500/10 border-blue-500/20",
    text: "text-blue-400",
    icon: "text-blue-400",
    label: "🗓 มีเหตุการณ์ในอนาคต",
    dot: "bg-blue-400",
  },
};

function formatCountdown(hoursUntil: number): string {
  if (hoursUntil < 1) return `${Math.round(hoursUntil * 60)} นาที`;
  if (hoursUntil < 24) return `${hoursUntil.toFixed(1)} ชั่วโมง`;
  return `${(hoursUntil / 24).toFixed(1)} วัน`;
}

function getEventTitle(event: CalendarImpactEvent): string {
  if (event.type === "earnings") {
    return `${event.symbol} ${event.eventTypeName || "Earnings"}`;
  }
  return event.title || event.symbol || "Economic Event";
}

export default function CalendarRiskBadge({ symbol }: CalendarRiskBadgeProps) {
  const [events, setEvents] = useState<CalendarImpactEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    fetch(`/api/calendar/impact?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events || []);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [symbol]);

  if (loading || events.length === 0) return null;

  // Use highest severity event for badge color
  const topProximity = events.find((e) => e.proximity === "danger")
    ? "danger"
    : events.find((e) => e.proximity === "warning")
    ? "warning"
    : "notice";

  const cfg = proximityConfig[topProximity];
  const topEvent = events[0];

  return (
    <div className={`rounded-xl border ${cfg.bg} overflow-hidden`}>
      {/* Header row */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/5 transition-colors cursor-pointer`}
      >
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center`}>
          <AlertTriangle size={13} className={cfg.icon} />
        </span>
        <span className={`flex-1 text-xs font-bold ${cfg.text}`}>
          {cfg.label} ก่อน Trade
        </span>
        <span className={`text-[10px] font-mono ${cfg.text} bg-black/20 px-2 py-0.5 rounded-full`}>
          ใน {formatCountdown(topEvent.hoursUntil)}
        </span>
        {expanded ? (
          <ChevronDown size={13} className={cfg.text} />
        ) : (
          <ChevronRight size={13} className={cfg.text} />
        )}
      </button>

      {/* Expanded event list */}
      {expanded && (
        <div className="border-t border-white/5 divide-y divide-white/5">
          {events.map((event) => {
            const eCfg = proximityConfig[event.proximity];
            return (
              <div key={event.id} className="px-3 py-2.5 flex items-start gap-3">
                <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${eCfg.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold ${eCfg.text} truncate`}>
                    {getEventTitle(event)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock size={9} className="text-slate-500 shrink-0" />
                    <span className="text-[10px] text-slate-500">
                      อีก {formatCountdown(event.hoursUntil)}
                    </span>
                    {event.importance === "high" && (
                      <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded uppercase">
                        High Impact
                      </span>
                    )}
                  </div>
                  {(event.epsForecast || event.revenueForecast || event.forecast) && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {event.type === "earnings"
                        ? `EPS Forecast: ${event.epsForecast ?? "—"}  |  Revenue: ${event.revenueForecast ?? "—"}`
                        : `Forecast: ${event.forecast ?? "—"}`}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          {/* Disclaimer */}
          {topProximity === "danger" && (
            <div className="px-3 py-2 bg-rose-500/5">
              <p className="text-[10px] text-rose-400/80 leading-relaxed">
                ⚠️ มีข่าวสำคัญภายใน 24 ชม. อาจทำให้ราคาผันผวนสูงและ Spread กว้างขึ้น
                พิจารณา Position Size ให้เหมาะสม
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
