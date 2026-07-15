"use client";

import { CheckCircle2, CircleAlert, ShieldAlert, Target } from "lucide-react";
import type { GoldPlaybookData } from "../types/analysis";

const sessionLabel: Record<GoldPlaybookData["activeSession"], string> = {
  asia: "Asia",
  london: "London",
  new_york: "New York",
  london_new_york_overlap: "London–New York Overlap",
  off_peak: "Off-peak",
};

const setupLabel: Record<GoldPlaybookData["setup"], string> = {
  asia_high_sweep_reclaim: "Sweep Asia High แล้วกลับลง",
  asia_low_sweep_reclaim: "Sweep Asia Low แล้วกลับขึ้น",
  vwap_continuation: "Trend ต่อเนื่องผ่าน VWAP",
  range_no_trade: "กรอบแคบ — งดเทรด",
  wait_for_confirmation: "รอสัญญาณยืนยัน",
};

export default function GoldPlaybookPanel({ data }: { data: GoldPlaybookData | null }) {
  if (!data) return null;

  const stateStyle = data.tradeState === "ready"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : data.tradeState === "avoid" ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-amber-500/30 bg-amber-500/10 text-amber-200";
  const stateLabel = data.tradeState === "ready" ? "พร้อมพิจารณาแผน" : data.tradeState === "avoid" ? "งดเทรดตอนนี้" : "รอยืนยัน";

  return (
    <section className="rounded-2xl border border-amber-500/20 bg-slate-950/80 p-4 shadow-lg shadow-amber-950/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-2">
          <div className="rounded-lg bg-amber-400/10 p-2 text-amber-300"><Target size={16} /></div>
          <div>
            <h2 className="text-sm font-black text-slate-100">Gold Playbook</h2>
            <p className="text-[11px] text-slate-400">Session liquidity · VWAP · Price Action · BOS/MSS · Macro-risk guard</p>
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${stateStyle}`}>{stateLabel} · {data.qualityScore}/100</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Session" value={sessionLabel[data.activeSession]} />
        <Metric label="Market regime" value={data.marketRegime === "trend" ? "Trend" : "Range"} />
        <Metric label="Bias" value={data.directionalBias} />
        <Metric label="Setup" value={setupLabel[data.setup]} />
      </div>

      {(data.asiaRange || data.londonRange) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {data.asiaRange && <RangeCard title="Asia range" value={data.asiaRange} />}
          {data.londonRange && <RangeCard title="London range" value={data.londonRange} />}
        </div>
      )}

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {data.checklist.map((item) => (
          <div key={item.label} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-300">
            {item.passed ? <CheckCircle2 size={14} className="shrink-0 text-emerald-400" /> : <CircleAlert size={14} className="shrink-0 text-amber-400" />}
            {item.label}
          </div>
        ))}
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-300"><ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber-300" />{data.guidance}</p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xs font-bold text-slate-100">{value}</p></div>;
}

function RangeCard({ title, value }: { title: string; value: { low: number; high: number; date: string } }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-[11px]"><span className="font-bold text-slate-200">{title}</span><span className="ml-2 text-slate-500">{value.date}</span><p className="mt-1 font-mono text-slate-300">${value.low.toFixed(2)} – ${value.high.toFixed(2)}</p></div>;
}
