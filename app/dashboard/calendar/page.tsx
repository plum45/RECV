"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import {
  Calendar,
  RefreshCw,
  Filter,
  ChevronDown,
  Clock,
  AlertTriangle,
  TrendingUp,
  BarChart2,
  Zap,
  Globe,
  DollarSign,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type EventType = "all" | "economic" | "earnings" | "crypto";
type Importance = "all" | "high" | "medium" | "low";

interface CalEvent {
  id: string;
  type: "economic" | "earnings" | "crypto";
  title?: string;
  symbol?: string;
  announcedAt: string;
  timeThai: string;
  importance: "high" | "medium" | "low";
  status: "confirmed" | "estimated" | "delayed";
  // economic
  actual?: string | null;
  forecast?: string | null;
  previous?: string | null;
  country?: string;
  // earnings
  eventTypeName?: string;
  epsForecast?: string | null;
  epsActual?: string | null;
  revenueForecast?: string | null;
  revenueActual?: string | null;
  guidance?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const importanceCfg = {
  high: {
    dot: "bg-rose-500",
    badge: "text-rose-400 bg-rose-500/10 border-rose-500/25",
    label: "High",
  },
  medium: {
    dot: "bg-amber-400",
    badge: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    label: "Medium",
  },
  low: {
    dot: "bg-slate-500",
    badge: "text-slate-400 bg-slate-700/40 border-slate-600/20",
    label: "Low",
  },
};

const typeCfg = {
  economic: { icon: Globe, label: "เศรษฐกิจ", color: "text-blue-400" },
  earnings: { icon: DollarSign, label: "ผลประกอบการ", color: "text-emerald-400" },
  crypto: { icon: Zap, label: "Crypto", color: "text-amber-400" },
};

function formatThaiDate(isoOrThai: string) {
  if (!isoOrThai) return "—";
  const d = new Date(isoOrThai);
  if (isNaN(d.getTime())) return isoOrThai;
  return d.toLocaleString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }) + " น.";
}

function groupByDay(events: CalEvent[]): Record<string, CalEvent[]> {
  return events.reduce<Record<string, CalEvent[]>>((acc, e) => {
    const d = new Date(e.announcedAt);
    const key = d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD
    (acc[key] ||= []).push(e);
    return acc;
  }, {});
}

function dayLabel(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00+07:00");
  const now = new Date();
  const nowKey = now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  if (dateKey === nowKey) return "วันนี้";
  const diff = Math.round(
    (d.getTime() - new Date(nowKey + "T12:00:00+07:00").getTime()) / 86400000
  );
  if (diff === 1) return "พรุ่งนี้";
  if (diff === -1) return "เมื่อวาน";
  return d.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "short" });
}

function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3600000;
}

// ─── Event Card ───────────────────────────────────────────────────────────────
function EventCard({ event }: { event: CalEvent }) {
  const imp = importanceCfg[event.importance];
  const typInfo = typeCfg[event.type];
  const TypeIcon = typInfo.icon;
  const hrs = hoursUntil(event.announcedAt);
  const isPast = hrs < 0;
  const isDanger = !isPast && hrs <= 24;
  const isWarning = !isPast && hrs > 24 && hrs <= 72;

  return (
    <div
      className={`relative rounded-xl border bg-slate-900/80 p-4 flex flex-col gap-3 transition-all ${
        isPast
          ? "border-slate-800/60 opacity-60"
          : isDanger
          ? "border-rose-500/30 ring-1 ring-rose-500/10"
          : isWarning
          ? "border-amber-500/25"
          : "border-slate-800"
      }`}
    >
      {/* Importance dot */}
      <span className={`absolute top-3 right-3 h-2 w-2 rounded-full ${imp.dot}`} />

      {/* Header */}
      <div className="flex items-start gap-2.5 min-w-0">
        <span
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
            event.type === "economic"
              ? "bg-blue-500/10"
              : event.type === "earnings"
              ? "bg-emerald-500/10"
              : "bg-amber-500/10"
          }`}
        >
          <TypeIcon size={14} className={typInfo.color} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-100 leading-tight truncate">
            {event.type === "earnings"
              ? `${event.symbol} — ${event.eventTypeName || "Earnings"}`
              : event.title}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${imp.badge}`}>
              {imp.label}
            </span>
            {event.status !== "confirmed" && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border text-slate-500 border-slate-700">
                {event.status}
              </span>
            )}
            {event.country && (
              <span className="text-[10px] text-slate-500">{event.country}</span>
            )}
          </div>
        </div>
      </div>

      {/* Data rows */}
      {event.type === "economic" && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Actual", val: event.actual ?? "—", color: event.actual ? "text-emerald-400" : "text-slate-500" },
            { label: "Forecast", val: event.forecast ?? "—", color: "text-slate-300" },
            { label: "Previous", val: event.previous ?? "—", color: "text-slate-400" },
          ].map((d) => (
            <div key={d.label} className="bg-slate-800/60 rounded-lg p-2 text-center">
              <p className="text-[9px] text-slate-500 uppercase tracking-wide mb-0.5">{d.label}</p>
              <p className={`text-xs font-bold ${d.color}`}>{d.val}</p>
            </div>
          ))}
        </div>
      )}

      {event.type === "earnings" && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "EPS (Forecast)", val: event.epsForecast ?? "—" },
            { label: "Revenue (Forecast)", val: event.revenueForecast ?? "—" },
          ].map((d) => (
            <div key={d.label} className="bg-slate-800/60 rounded-lg p-2">
              <p className="text-[9px] text-slate-500 mb-0.5">{d.label}</p>
              <p className="text-xs font-bold text-slate-200">{d.val}</p>
            </div>
          ))}
          {event.guidance && (
            <div className="col-span-2 bg-slate-800/40 rounded-lg p-2">
              <p className="text-[9px] text-slate-500 mb-0.5">Guidance</p>
              <p className="text-xs text-amber-400">{event.guidance}</p>
            </div>
          )}
        </div>
      )}

      {/* Countdown footer */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] text-slate-500">
          <Clock size={9} />
          {formatThaiDate(event.announcedAt)}
        </span>
        {!isPast ? (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isDanger
                ? "bg-rose-500/15 text-rose-400"
                : isWarning
                ? "bg-amber-500/10 text-amber-400"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            {hrs < 1 ? `${Math.round(hrs * 60)} นาที` : hrs < 24 ? `${hrs.toFixed(0)} ชม.` : `${(hrs / 24).toFixed(1)} วัน`}
          </span>
        ) : (
          <span className="text-[10px] text-slate-600">ผ่านแล้ว</span>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<EventType>("all");
  const [impFilter, setImpFilter] = useState<Importance>("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (impFilter !== "all") params.set("importance", impFilter);
      params.set("limit", "80");
      const res = await fetch(`/api/calendar?${params.toString()}`);
      const data = await res.json();
      setEvents(data.events || []);
      setLastUpdated(new Date());
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, impFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const grouped = groupByDay(events);
  const sortedDays = Object.keys(grouped).sort();

  const totalHigh = events.filter((e) => e.importance === "high" && hoursUntil(e.announcedAt) > 0).length;
  const totalDanger = events.filter((e) => !!(hoursUntil(e.announcedAt) > 0 && hoursUntil(e.announcedAt) <= 24)).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10">
              <Calendar size={18} className="text-indigo-400" />
            </span>
            <div>
              <h1 className="text-lg font-black text-white">ปฏิทินข่าว & ผลประกอบการ</h1>
              <p className="text-xs text-slate-500">
                {lastUpdated
                  ? `อัปเดตเมื่อ ${lastUpdated.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`
                  : "กำลังโหลด..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchEvents}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
            >
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Calendar, label: "เหตุการณ์ทั้งหมด", val: events.length, color: "text-indigo-400", bg: "bg-indigo-500/10" },
            { icon: AlertTriangle, label: "High Impact", val: totalHigh, color: "text-rose-400", bg: "bg-rose-500/10" },
            { icon: Clock, label: "ใน 24 ชม.", val: totalDanger, color: "text-amber-400", bg: "bg-amber-500/10" },
            { icon: BarChart2, label: "ผลประกอบการ", val: events.filter((e) => e.type === "earnings").length, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 flex items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.bg}`}>
                <s.icon size={16} className={s.color} />
              </span>
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-500 font-bold flex items-center gap-1">
            <Filter size={11} /> ตัวกรอง:
          </span>

          {/* Type */}
          <div className="flex gap-1">
            {(["all", "economic", "earnings", "crypto"] as EventType[]).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                  typeFilter === t
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                    : "bg-slate-800 text-slate-400 border-transparent hover:border-slate-600"
                }`}
              >
                {t === "all" ? "ทั้งหมด" : t === "economic" ? "เศรษฐกิจ" : t === "earnings" ? "ผลประกอบการ" : "Crypto"}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-slate-700" />

          {/* Importance */}
          <div className="flex gap-1">
            {(["all", "high", "medium", "low"] as Importance[]).map((imp) => (
              <button
                key={imp}
                onClick={() => setImpFilter(imp)}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                  impFilter === imp
                    ? imp === "high"
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      : imp === "medium"
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-slate-700 text-slate-300 border-slate-600"
                    : "bg-slate-800 text-slate-400 border-transparent hover:border-slate-600"
                }`}
              >
                {imp === "all" ? "ทุกระดับ" : imp === "high" ? "🔴 High" : imp === "medium" ? "🟡 Medium" : "⚪ Low"}
              </button>
            ))}
          </div>
        </div>

        {/* Event List grouped by day */}
        {loading ? (
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-3 animate-pulse">
                <div className="h-5 w-32 bg-slate-800 rounded" />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-40 bg-slate-900 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : sortedDays.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Calendar size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">ไม่พบเหตุการณ์ตามเงื่อนไขที่เลือก</p>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedDays.map((day) => {
              const dayEvents = grouped[day];
              const label = dayLabel(day);
              const nowKey = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
              const isToday = day === nowKey;

              return (
                <div key={day}>
                  {/* Day header */}
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className={`text-sm font-black uppercase tracking-wider ${isToday ? "text-indigo-400" : "text-slate-400"}`}>
                      {label}
                    </h2>
                    <span className="text-xs text-slate-600">{day}</span>
                    <div className="flex-1 h-px bg-slate-800" />
                    <span className="text-xs text-slate-500 font-bold">{dayEvents.length} รายการ</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {dayEvents.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
