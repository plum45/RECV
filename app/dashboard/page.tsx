"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "../../contexts/AuthContext";
import { ArrowUpRight, BarChart3, Radar, Search, ShieldCheck, Sparkles } from "lucide-react";
import MarketIndices from "../../components/MarketIndices";
import Watchlist from "../../components/Watchlist";
import NewsMarquee from "../../components/NewsMarquee";
import LoadingState from "../../components/LoadingState";

export default function DashboardHome() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingState isLoading={true} />;
  }

  return (
    <div className="flex h-full overflow-hidden text-slate-200">
      <div className="flex-1 flex flex-col min-w-0 h-full p-4 sm:p-6 xl:p-8 pb-24 lg:pb-8 gap-6 overflow-y-auto custom-scrollbar">

        <header className="dashboard-hero relative overflow-hidden rounded-[28px] p-5 sm:p-7 lg:p-9">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-64 bg-cyan-400/10 blur-3xl" />
          <div className="relative grid gap-7 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Investment workspace
              </div>
              <h1 className="max-w-2xl text-3xl font-black leading-tight tracking-[-0.035em] text-white sm:text-4xl lg:text-5xl">
                สวัสดี, {user?.displayName || "นักลงทุน"}
                <span className="block bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">
                  มองตลาดให้ชัดก่อนตัดสินใจ
                </span>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                วิเคราะห์พื้นฐานก่อน จับจังหวะด้วยกราฟ และวางแผนความเสี่ยงเป็นขั้นตอนในพื้นที่เดียว
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="hero-stat">
                <ShieldCheck size={18} className="text-emerald-300" />
                <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Strategy</span>
                <strong className="text-sm text-white">พื้นฐาน → กราฟ</strong>
              </div>
              <div className="hero-stat">
                <Sparkles size={18} className="text-violet-300" />
                <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Horizon</span>
                <strong className="text-sm text-white">กลาง–ยาว</strong>
              </div>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link href="/dashboard/invest" className="quick-action group">
            <span className="quick-action-icon bg-cyan-400/10 text-cyan-300"><Search size={19} /></span>
            <span><strong>ค้นหาหุ้น</strong><small>เริ่มจากบริษัทที่สนใจ</small></span>
            <ArrowUpRight className="ml-auto text-slate-600 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-300" size={18} />
          </Link>
          <Link href="/dashboard/analyze" className="quick-action group">
            <span className="quick-action-icon bg-violet-400/10 text-violet-300"><BarChart3 size={19} /></span>
            <span><strong>วิเคราะห์เชิงลึก</strong><small>Bull / Base / Bear case</small></span>
            <ArrowUpRight className="ml-auto text-slate-600 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-violet-300" size={18} />
          </Link>
          <Link href="/dashboard/scanner" className="quick-action group">
            <span className="quick-action-icon bg-amber-400/10 text-amber-300"><Radar size={19} /></span>
            <span><strong>สแกนโอกาส</strong><small>ค้นหาหุ้นใกล้แนวรับ</small></span>
            <ArrowUpRight className="ml-auto text-slate-600 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-amber-300" size={18} />
          </Link>
        </section>

        {/* Market Indices */}
        <section className="space-y-3">
          <div className="section-kicker">Market pulse</div>
          <MarketIndices />
        </section>

        {/* Watchlist */}
        <section className="flex-1 flex flex-col min-h-[400px] space-y-3">
          <div className="section-kicker">Your watchlist</div>
          <Watchlist />
        </section>

        {/* News Marquee */}
        <section className="mt-2">
          <NewsMarquee />
        </section>

      </div>
    </div>
  );
}
