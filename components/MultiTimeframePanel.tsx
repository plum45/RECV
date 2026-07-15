"use client";

import { Layers3, CheckCircle2, AlertTriangle, Minus } from "lucide-react";
import type { MultiTimeframeAnalysis } from "../types/analysis";

export default function MultiTimeframePanel({ data }: { data: MultiTimeframeAnalysis | null }) {
  if (!data) return null;

  const isScalping = data.mode === "scalping";

  const alignmentLabel = data.alignment === "aligned"
    ? "สัญญาณสอดคล้อง"
    : data.alignment === "mixed" ? "สัญญาณต่างกรอบขัดกัน" : "ข้อมูลหลายกรอบยังไม่พอ";
  const alignmentStyle = data.alignment === "aligned"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : data.alignment === "mixed" ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-slate-700 bg-slate-900 text-slate-300";

  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-slate-950/80 p-4 shadow-lg shadow-cyan-950/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-cyan-400/10 p-2 text-cyan-300"><Layers3 size={16} /></div>
          <div>
            <h2 className="text-sm font-black text-slate-100">{isScalping ? "Gold / Silver Scalping Flow" : "Gold / Silver Multi-Timeframe"}</h2>
            <p className="text-[11px] text-slate-400">
              {isScalping
                ? "1H กรองทิศทาง · 15m โครงสร้างและ VWAP · 5m รอจุดเข้า — ไม่เข้าเมื่อทิศทางขัดกัน"
                : "1D ทิศทางใหญ่ · 4H โครงสร้าง · 1H จุดเข้า — ใช้กรอบที่เลือกเป็นกราฟหลัก"}
            </p>
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${alignmentStyle}`}>{alignmentLabel}</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {data.snapshots.map((snapshot) => {
          const isBullish = snapshot.bias === "bullish";
          const isBearish = snapshot.bias === "bearish";
          const label = isBullish ? "Bullish" : isBearish ? "Bearish" : "Neutral";
          return (
            <div key={snapshot.timeframe} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-black text-white">{snapshot.timeframe}</span>
                {snapshot.status === "available" ? (
                  isBullish ? <CheckCircle2 size={15} className="text-emerald-400" /> : isBearish ? <AlertTriangle size={15} className="text-rose-400" /> : <Minus size={15} className="text-slate-500" />
                ) : <span className="text-[10px] text-slate-500">รอข้อมูล</span>}
              </div>
              {snapshot.status === "available" ? <>
                <p className={`mt-2 text-xs font-black ${isBullish ? "text-emerald-300" : isBearish ? "text-rose-300" : "text-slate-300"}`}>{label}</p>
                <p className="mt-1 text-[11px] text-slate-400">Structure: {snapshot.structure} · BOS: {snapshot.bos}</p>
                <p className="text-[11px] text-slate-500">PA: {snapshot.priceAction} · RSI {snapshot.rsi}</p>
              </> : <p className="mt-2 text-[11px] text-slate-500">กรอบนี้ไม่พร้อม จึงไม่ใช้เป็นสัญญาณยืนยัน</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
