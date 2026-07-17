"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Activity, BarChart3, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import TradingViewChart from "../../../components/TradingViewChart";
import MarketStats, { SupportResistanceZonesPanel } from "../../../components/MarketStats";
import { calculateIndicators } from "../../../lib/indicators";
import { calculateSupportResistance } from "../../../lib/supportResistance";
import { getAssetProfile } from "../../../lib/assetProfile";
import type { IndicatorData, KlineData, SupportResistanceData, TickerData } from "../../../types/market";

const ALLOWED_TIMEFRAMES = new Set(["5m", "15m", "1H", "4H", "1D"]);

function normalizePublicSymbol(value: string | null) {
  const symbol = (value || "QQQ").toUpperCase().trim();
  return /^[A-Z0-9.^=_-]{1,20}$/.test(symbol) ? symbol : "QQQ";
}

function PublicAnalyzeContent() {
  const searchParams = useSearchParams();
  const symbol = useMemo(() => normalizePublicSymbol(searchParams.get("symbol")), [searchParams]);
  const requestedTimeframe = searchParams.get("timeframe") || "1H";
  const timeframe = ALLOWED_TIMEFRAMES.has(requestedTimeframe) ? requestedTimeframe : "1H";
  const [marketData, setMarketData] = useState<TickerData | null>(null);
  const [indicators, setIndicators] = useState<IndicatorData | null>(null);
  const [supportResistance, setSupportResistance] = useState<SupportResistanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tickerResponse, klinesResponse] = await Promise.all([
        axios.get<TickerData>(`/api/ticker?symbol=${encodeURIComponent(symbol)}`),
        axios.get<KlineData[]>(`/api/klines?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=250`),
      ]);
      const profile = getAssetProfile(symbol);
      const nextIndicators = calculateIndicators(klinesResponse.data, profile);
      const nextSupportResistance = calculateSupportResistance(klinesResponse.data, nextIndicators, tickerResponse.data.currentPrice, timeframe, profile.assetClass);
      setMarketData(tickerResponse.data);
      setIndicators(nextIndicators);
      setSupportResistance(nextSupportResistance);
    } catch {
      setMarketData(null);
      setIndicators(null);
      setSupportResistance(null);
      setError("ยังโหลดข้อมูลสาธารณะของสัญลักษณ์นี้ไม่ได้ โปรดลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    const initialFetch = window.setTimeout(() => void loadSnapshot(), 0);
    return () => window.clearTimeout(initialFetch);
  }, [loadSnapshot]);

  return (
    <main className="min-h-screen bg-[#070b13] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-[#070b13]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/public" className="flex items-center gap-2 font-black tracking-tight text-white"><Activity size={20} className="text-cyan-300" /> iVES <span className="rounded bg-cyan-400/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-cyan-200">Read-only</span></Link>
          <div className="flex items-center gap-2"><Link href="/auth/login" className="rounded-lg px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-900">เข้าสู่ระบบ</Link><Link href="/auth/register" className="rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-950 hover:bg-slate-200">เริ่มใช้งานฟรี</Link></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8">
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Public analysis snapshot</p><h1 className="mt-1 text-3xl font-black">{symbol} <span className="font-mono text-base text-slate-500">· {timeframe}</span></h1><p className="mt-2 text-sm text-slate-400">กราฟและข้อมูลเทคนิคแบบอ่านอย่างเดียว ไม่มีคำสั่งซื้อขาย, Alert หรือการบันทึกข้อมูล</p></div>
          <button type="button" onClick={() => void loadSnapshot()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-200 hover:border-slate-500 disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> รีเฟรช</button>
        </section>

        {error && <p className="mt-5 rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)]">
          <section><TradingViewChart symbol={symbol} interval={timeframe} /><p className="mt-2 text-center text-[11px] text-slate-600">TradingView chart · Symbol และ timeframe ระบุผ่านลิงก์สาธารณะ</p></section>
          <section className="space-y-5"><PublicSummary marketData={marketData} indicators={indicators} loading={loading} /><div className="rounded-2xl border border-slate-800 bg-slate-950 p-5"><h2 className="flex items-center gap-2 text-sm font-black"><LockKeyhole size={16} className="text-slate-400" /> ต้องการใช้เครื่องมือเต็ม?</h2><p className="mt-2 text-sm leading-6 text-slate-400">เข้าสู่ระบบเพื่อใช้ AI Analysis, Gold Playbook, Watchlist, แผนเทรด และแจ้งเตือน Telegram</p><Link href="/auth/register" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-cyan-200"><ShieldCheck size={15} /> สร้างบัญชี</Link></div></section>
        </div>

        <section className="mt-6"><MarketStats marketData={marketData} indicators={indicators} supportResistance={supportResistance} loading={loading} symbol={symbol} /></section>
        <section className="mt-6"><SupportResistanceZonesPanel supportResistance={supportResistance} /></section>
      </div>
    </main>
  );
}

export default function PublicAnalyzePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#070b13]" aria-label="Loading public analysis" />}>
      <PublicAnalyzeContent />
    </Suspense>
  );
}

function PublicSummary({ marketData, indicators, loading }: { marketData: TickerData | null; indicators: IndicatorData | null; loading: boolean }) {
  const data = [
    ["ราคา", marketData ? `$${marketData.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"],
    ["RSI (14)", indicators ? indicators.rsi14.toFixed(1) : "—"],
    ["EMA 20", indicators ? indicators.ema20.toFixed(2) : "—"],
    ["Structure", indicators?.marketStructure.type || "—"],
  ];
  return <section className="rounded-2xl border border-slate-800 bg-slate-950 p-5"><h2 className="flex items-center gap-2 text-sm font-black"><BarChart3 size={16} className="text-cyan-300" /> สรุปข้อมูลเทคนิค</h2><div className="mt-4 grid grid-cols-2 gap-3">{data.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 truncate font-mono text-sm font-black text-white">{loading ? "…" : value}</p></div>)}</div></section>;
}
