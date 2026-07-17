"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, BarChart3, Clock3, Gem, LockKeyhole, RefreshCw, Search, ShieldCheck, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

type PublicQuote = {
  symbol: string;
  status: "valid" | "invalid" | "unavailable";
  price?: number;
  changePercent?: number;
  priceSource?: string;
  priceTimestamp?: string;
};

const symbols = ["XAUUSD", "NVDA", "AAPL", "TSLA", "BTC-USD"];

export default function PublicMarketPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<PublicQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [symbolQuery, setSymbolQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.post<PublicQuote[]>("/api/quote", { symbols });
      setQuotes(Array.isArray(data) ? data : []);
      setUpdatedAt(new Date());
    } catch {
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialFetch = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(interval);
    };
  }, [refresh]);

  const gold = quotes.find((quote) => quote.symbol === "XAUUSD");

  const openSymbol = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const symbol = symbolQuery.toUpperCase().trim();
    if (!/^[A-Z0-9.^=_-]{1,20}$/.test(symbol)) return;
    router.push(`/public/analyze?symbol=${encodeURIComponent(symbol)}`);
  };

  return (
    <main className="min-h-screen bg-[#070b13] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-[#070b13]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2 font-black tracking-tight text-white"><Activity size={20} className="text-cyan-300" /> iVES <span className="rounded bg-cyan-400/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-cyan-200">Public</span></Link>
          <div className="flex items-center gap-2">
            <Link href="/auth/login" className="rounded-lg px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-900">เข้าสู่ระบบ</Link>
            <Link href="/auth/register" className="rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-950 hover:bg-slate-200">เริ่มใช้งานฟรี</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-slate-800/80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(6,182,212,.16),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(245,158,11,.12),transparent_30%)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="max-w-3xl">
            <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300"><Sparkles size={14} /> Public market view</p>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">ติดตามตลาดได้ทันที<br /><span className="text-slate-400">โดยไม่ต้องเข้าสู่ระบบ</span></h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">ดูราคาตลาดและภาพรวมเบื้องต้นแบบอ่านอย่างเดียว ส่วนวิเคราะห์ AI, แผนเทรด, Watchlist ส่วนตัว และการแจ้งเตือน จะเปิดให้ใช้หลังเข้าสู่ระบบ</p>
            <form onSubmit={openSymbol} className="relative mt-7 max-w-md">
              <Search size={17} className="pointer-events-none absolute left-4 top-3.5 text-slate-500" />
              <input value={symbolQuery} onChange={(event) => setSymbolQuery(event.target.value)} placeholder="Enter a ticker, e.g. ASML or QQQ" className="w-full rounded-xl border border-slate-700 bg-slate-950/90 py-3 pl-11 pr-28 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300" aria-label="Open a symbol chart" />
              <button type="submit" className="absolute right-1.5 top-1.5 rounded-lg bg-cyan-300 px-3.5 py-2 text-xs font-black text-slate-950 hover:bg-cyan-200">View chart</button>
            </form>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200"><BarChart3 size={17} className="text-cyan-300" /> Market snapshot</div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500"><span className="flex items-center gap-1"><Clock3 size={12} />{updatedAt ? `อัปเดต ${updatedAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}` : "กำลังโหลด"}</span><button type="button" onClick={() => void refresh()} disabled={loading} aria-label="รีเฟรชราคา" className="rounded-md border border-slate-700 p-1.5 text-slate-300 hover:border-slate-500 disabled:opacity-50"><RefreshCw size={13} className={loading ? "animate-spin" : ""} /></button></div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {symbols.map((symbol) => <PublicQuoteLink key={symbol} symbol={symbol} quote={quotes.find((item) => item.symbol === symbol)} loading={loading} />)}
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-slate-950 p-5 sm:p-6">
            <div className="flex items-start gap-3"><div className="rounded-xl bg-amber-400/10 p-2.5 text-amber-300"><Gem size={20} /></div><div><p className="text-xs font-bold uppercase tracking-wider text-amber-200">Gold spot / XAUUSD</p><h2 className="mt-1 text-xl font-black">ทองคำ — Public snapshot</h2></div></div>
            <p className="mt-5 font-mono text-4xl font-black text-white">{gold?.status === "valid" && gold.price ? `$${gold.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "รอข้อมูลราคา"}</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">หน้า Public แสดงราคาเท่านั้น ไม่ให้สัญญาณซื้อขาย, จุดเข้า, แผน หรือการแจ้งเตือน เพื่อให้ข้อมูลเป็นกลางและอ่านอย่างเดียว</p>
          </section>
          <section className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6"><div className="flex items-center gap-2 text-sm font-black text-white"><LockKeyhole size={17} className="text-slate-400" /> ฟีเจอร์สำหรับสมาชิก</div><ul className="mt-4 space-y-3 text-sm text-slate-400"><li>• วิเคราะห์หลาย Timeframe และ Gold Playbook</li><li>• Watchlist ส่วนตัวและแผนเทรด</li><li>• แจ้งเตือน Telegram อัตโนมัติ</li></ul><Link href="/auth/register" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-cyan-200"><ShieldCheck size={15} /> สร้างบัญชีเพื่อใช้งานเต็ม</Link></section>
        </div>
      </section>
      <footer className="border-t border-slate-800 px-5 py-6 text-center text-xs text-slate-600">ข้อมูลราคาใช้เพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน</footer>
    </main>
  );
}

function PublicQuoteLink({ symbol, quote, loading }: { symbol: string; quote?: PublicQuote; loading: boolean }) {
  return <Link href={`/public/analyze?symbol=${encodeURIComponent(symbol)}`} className="group block rounded-2xl transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-950/30" aria-label={`View ${symbol} chart`}><QuoteCard symbol={symbol} quote={quote} loading={loading} /><span className="-mt-8 mb-3 block px-4 text-[10px] font-bold uppercase tracking-wider text-cyan-300 opacity-0 transition group-hover:opacity-100">View chart →</span></Link>;
}

function QuoteCard({ symbol, quote, loading }: { symbol: string; quote?: PublicQuote; loading: boolean }) {
  const change = quote?.changePercent ?? 0;
  const positive = change >= 0;
  return <article className="rounded-2xl border border-slate-800 bg-slate-950 p-4"><div className="flex items-start justify-between gap-2"><p className="font-mono text-xs font-black text-slate-300">{symbol}</p>{quote?.status === "valid" && <span className={`flex items-center gap-0.5 text-[11px] font-bold ${positive ? "text-emerald-400" : "text-rose-400"}`}>{positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{positive ? "+" : ""}{change.toFixed(2)}%</span>}</div><p className="mt-5 font-mono text-xl font-black text-white">{quote?.status === "valid" && quote.price ? `$${quote.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : loading ? "…" : "ไม่มีข้อมูล"}</p><p className="mt-2 text-[10px] text-slate-600">{quote?.priceSource || "Market data"}</p></article>;
}
