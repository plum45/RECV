"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { ArrowUpRight, BarChart3, Gem, RefreshCw, ShieldAlert } from "lucide-react";
import type { TickerData } from "../../../types/market";
import { getAssetProfile } from "../../../lib/assetProfile";

const metals = [
  { symbol: "XAUUSD", name: "XAUUSD", thaiName: "ทองคำ Spot", accent: "amber" },
  { symbol: "SI=F", name: "Silver", thaiName: "เงิน", accent: "slate" },
] as const;

export default function PreciousMetalsPage() {
  const [quotes, setQuotes] = useState<Record<string, TickerData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        metals.map(async ({ symbol }) => {
          const { data } = await axios.get<TickerData>(`/api/ticker?symbol=${encodeURIComponent(symbol)}`);
          return [symbol, data] as const;
        })
      );
      setQuotes(Object.fromEntries(results));
    } catch (err: any) {
      setError(err.response?.data?.message || "ไม่สามารถดึงราคาทองและเงินได้ในขณะนี้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const profile = getAssetProfile("XAUUSD");

  return (
    <div className="min-h-full bg-[#090d16] p-4 pb-24 text-slate-100 sm:p-6 lg:p-8">
      <section className="mx-auto max-w-6xl space-y-6">
        <header className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-slate-950 to-slate-950 p-6 sm:p-8">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-amber-300">
                <Gem size={20} />
                <span className="text-xs font-black uppercase tracking-[0.2em]">Precious Metals Desk</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">ทองคำและเงิน</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                พื้นที่วิเคราะห์เฉพาะสำหรับ Gold และ Silver: ใช้ session ของตลาดโลหะ, VWAP ตามรอบ CME,
                โซน S/R ที่เผื่อความผันผวน และติดตามข่าวเศรษฐกิจสหรัฐที่มีผลต่อโลหะมีค่า
              </p>
            </div>
            <button
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-xs font-bold text-amber-200 transition hover:bg-amber-400/20 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> รีเฟรชราคา
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          {metals.map(({ symbol, name, thaiName, accent }) => {
            const quote = quotes[symbol];
            const change = quote?.change24h || 0;
            const positive = change >= 0;
            const accentClass = accent === "amber" ? "border-amber-500/25 bg-amber-500/5" : "border-slate-500/30 bg-slate-500/5";
            return (
              <article key={symbol} className={`rounded-3xl border p-5 shadow-xl ${accentClass}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{symbol}</p>
                    <h2 className="mt-1 text-xl font-black">{name} <span className="text-sm font-semibold text-slate-400">/ {thaiName}</span></h2>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${positive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                    {positive ? "+" : ""}{change.toFixed(2)}%
                  </span>
                </div>
                <p className="mt-6 font-mono text-3xl font-black text-white">
                  {quote ? `$${quote.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
                </p>
                <p className="mt-1 text-xs text-slate-500">{quote?.priceSource || (loading ? "กำลังดึงราคา" : "รอข้อมูลราคา")}</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <Link href={`/dashboard/analyze?symbol=${encodeURIComponent(symbol)}&timeframe=1D`} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-xs font-black text-slate-950 transition hover:bg-slate-200">
                    <BarChart3 size={14} /> วิเคราะห์
                  </Link>
                  <Link href={`/dashboard/plan?symbol=${encodeURIComponent(symbol)}`} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-bold text-slate-200 transition hover:border-slate-500">
                    แผนเทรด <ArrowUpRight size={14} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
            <h2 className="flex items-center gap-2 text-base font-black"><BarChart3 size={17} className="text-cyan-300" /> วิธีคำนวณสำหรับโลหะมีค่า</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-400">
              <li><b className="text-slate-200">Session VWAP:</b> เริ่มรอบใหม่เวลา 18:00 New York ตามรอบ CME ไม่ปนข้อมูลข้าม session</li>
              <li><b className="text-slate-200">Anchored VWAP:</b> ยึดจาก swing ล่าสุดเพื่อดูต้นทุนเฉลี่ยของรอบราคา</li>
              <li><b className="text-slate-200">S/R:</b> ขยายความกว้างโซนและระยะห่างด้วย ATR สำหรับการ sweep ของทองและเงิน</li>
              <li><b className="text-slate-200">Liquidity:</b> หา Equal High/Equal Low ที่ยังไม่ถูกกวาดเป็น Buy-side / Sell-side liquidity; รอ sweep และสัญญาณกลับตัวก่อนเข้า ไม่ไล่ราคา</li>
              <li><b className="text-slate-200">Price Action:</b> ยืนยันการเข้าด้วย rejection wick, engulfing, inside bar และการปิดกลับเข้าโซนหลัง liquidity sweep</li>
              <li><b className="text-slate-200">Smart Money:</b> BOS ใช้ยืนยันทิศทางต่อเนื่อง, MSS ใช้จับจุดเปลี่ยนโครงสร้าง และใช้ Demand/Supply zone สดเป็นพื้นที่รอเข้า</li>
              <li><b className="text-slate-200">Alert:</b> ใช้ 15m สำหรับ RSI/MACD; แจ้งใกล้แนวรับในกรอบ +{profile.supportAlert.upperPercent}% ถึง {profile.supportAlert.lowerPercent}%</li>
            </ul>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
            <h2 className="flex items-center gap-2 text-base font-black"><ShieldAlert size={17} className="text-amber-300" /> ข่าวที่ต้องดูเป็นพิเศษ</h2>
            <p className="mt-3 text-sm text-slate-400">ก่อนเข้าเทรด ให้เปิดปฏิทินข่าวและระวังการแกว่งแรงในช่วงประกาศ:</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.macroDrivers.map((driver) => (
                <span key={driver} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-200">{driver}</span>
              ))}
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
