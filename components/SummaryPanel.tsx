"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  Shield,
  Star,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  Clock,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Database
} from "lucide-react";
import { TickerData, SupportResistanceData, IndicatorData } from "../types/market";
import { useRouter } from "next/navigation";

interface SummaryPanelProps {
  symbol: string;
  marketData: TickerData | null;
  supportResistance: SupportResistanceData | null;
  indicators: IndicatorData | null;
  isInWatchlist: boolean;
  toggleWatchlist: () => void;
  reportText: string | null;
  loading: boolean;
  loadingPrice: boolean;
  errorPrice: string | null;
  isPriceStale: boolean;
}

// Score parser utility
function parseRocketScore(report: string | null): number | null {
  if (!report) return null;
  const matchTotal = report.match(/รวม:\s*(\d+)\s*\/100/);
  if (matchTotal && matchTotal[1]) return parseInt(matchTotal[1], 10);
  const matchSum = report.match(/รวม:\s*(\d+)/);
  if (matchSum && matchSum[1]) return parseInt(matchSum[1], 10);
  
  const sectionSplit = report.split(/##\s*12\.\s*Rocket\s*Score/i);
  if (sectionSplit.length > 1) {
    const scoreSection = sectionSplit[1];
    const matchAny = scoreSection.match(/(\d+)\s*\/100/);
    if (matchAny && matchAny[1]) return parseInt(matchAny[1], 10);
  }
  return null;
}

export default function SummaryPanel({
  symbol,
  marketData,
  supportResistance,
  indicators,
  isInWatchlist,
  toggleWatchlist,
  reportText,
  loading,
  loadingPrice,
  errorPrice,
  isPriceStale
}: SummaryPanelProps) {
  const router = useRouter();
  const [minutesElapsed, setMinutesElapsed] = useState(0);
  const [fetchTimestamp, setFetchTimestamp] = useState<number | null>(null);

  // Set timestamp on data load
  useEffect(() => {
    if (marketData && !loadingPrice) {
      setFetchTimestamp(Date.now());
      setMinutesElapsed(0);
    }
  }, [marketData, loadingPrice]);

  // Tick minutes elapsed
  useEffect(() => {
    if (!fetchTimestamp) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - fetchTimestamp) / 60000);
      setMinutesElapsed(elapsed);
    }, 30000); // Check every 30 sec
    return () => clearInterval(interval);
  }, [fetchTimestamp]);

  if (loadingPrice && !marketData) {
    return (
      <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl animate-pulse space-y-4">
        <div className="h-8 bg-slate-800 rounded w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="h-16 bg-slate-800 rounded-xl"></div>
          <div className="h-16 bg-slate-800 rounded-xl"></div>
          <div className="h-16 bg-slate-800 rounded-xl"></div>
          <div className="h-16 bg-slate-800 rounded-xl"></div>
        </div>
      </div>
    );
  }

  const price = marketData?.currentPrice || 0;
  const change24h = marketData?.change24h || 0;

  // 1. Calculate Closest Support
  const supports = supportResistance?.supportZones || [];
  let closestSupport: any = null;
  let minSupportDiff = Infinity;
  let supportMidVal = 0;

  for (const s of supports) {
    const [lowStr, highStr] = s.zone.replace(/,/g, "").split("-");
    const low = parseFloat(lowStr);
    const high = parseFloat(highStr);
    const mid = !isNaN(low) && !isNaN(high) ? (low + high) / 2 : (parseFloat(s.zone.replace(/,/g, "")) || 0);
    if (mid > 0 && mid < price) {
      const diff = price - mid;
      if (diff < minSupportDiff) {
        minSupportDiff = diff;
        closestSupport = s;
        supportMidVal = mid;
      }
    }
  }
  if (!closestSupport && supports.length > 0) {
    closestSupport = supports[0];
    const [lowStr, highStr] = closestSupport.zone.replace(/,/g, "").split("-");
    const low = parseFloat(lowStr);
    const high = parseFloat(highStr);
    supportMidVal = !isNaN(low) && !isNaN(high) ? (low + high) / 2 : (parseFloat(closestSupport.zone.replace(/,/g, "")) || 0);
  }

  // 2. Calculate Closest Resistance
  const resistances = supportResistance?.resistanceZones || [];
  let closestResistance: any = null;
  let minResistanceDiff = Infinity;
  let resistanceMidVal = 0;

  for (const r of resistances) {
    const [lowStr, highStr] = r.zone.replace(/,/g, "").split("-");
    const low = parseFloat(lowStr);
    const high = parseFloat(highStr);
    const mid = !isNaN(low) && !isNaN(high) ? (low + high) / 2 : (parseFloat(r.zone.replace(/,/g, "")) || 0);
    if (mid > 0 && mid > price) {
      const diff = mid - price;
      if (diff < minResistanceDiff) {
        minResistanceDiff = diff;
        closestResistance = r;
        resistanceMidVal = mid;
      }
    }
  }
  if (!closestResistance && resistances.length > 0) {
    closestResistance = resistances[0];
    const [lowStr, highStr] = closestResistance.zone.replace(/,/g, "").split("-");
    const low = parseFloat(lowStr);
    const high = parseFloat(highStr);
    resistanceMidVal = !isNaN(low) && !isNaN(high) ? (low + high) / 2 : (parseFloat(closestResistance.zone.replace(/,/g, "")) || 0);
  }

  // 3. Trend / Bias Calculation
  const rsi = indicators?.rsi14 || 50;
  const macdHist = indicators?.macd?.histogram || 0;

  let trendBias: "Bullish" | "Bearish" | "Neutral" = "Neutral";
  let trendColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
  let trendLabel = "Neutral (ไซด์เวย์)";

  if (rsi > 55 && macdHist > 0 && change24h > 0) {
    trendBias = "Bullish";
    trendColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    trendLabel = "Bullish (ขาขึ้น)";
  } else if (rsi < 45 && macdHist < 0 && change24h < 0) {
    trendBias = "Bearish";
    trendColor = "text-rose-400 bg-rose-500/10 border-rose-500/20";
    trendLabel = "Bearish (ขาลง)";
  }

  // 4. Zone Freshness Evaluation
  const maxTouches = Math.max(closestSupport?.touches || 0, closestResistance?.touches || 0);
  let freshnessLabel = "Recent (ปานกลาง)";
  let freshnessColor = "text-slate-300 bg-slate-800/80 border-slate-750/50";
  
  if (maxTouches <= 1) {
    freshnessLabel = "Fresh (ใหม่/รับอยู่สูง)";
    freshnessColor = "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
  } else if (maxTouches >= 5) {
    freshnessLabel = "Aged (เก่า/มีโอกาสทะลุ)";
    freshnessColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
  }

  // Parse Rocket Score
  const score = parseRocketScore(reportText);

  // MACD description
  const macdVal = indicators?.macd?.macdLine?.toFixed(2) || "—";
  const signalVal = indicators?.macd?.signalLine?.toFixed(2) || "—";
  const macdText = macdHist > 0 ? "Bullish Crossover" : macdHist < 0 ? "Bearish Crossover" : "Neutral";

  // Data Freshness Badge Logic (Requirement 6)
  // Green: < 1 min, Yellow: 1-5 mins, Red: > 5 mins, Gray: Market Closed
  let freshnessBadgeColor = "bg-slate-800 text-slate-400 border-slate-700/50";
  let freshnessBadgeText = "กำลังตรวจสอบ...";
  const now = new Date();
  const isMarketClosed = typeof window !== "undefined" && (now.getDay() === 0 || now.getDay() === 6 || now.getHours() < 9 || now.getHours() >= 17);

  if (isMarketClosed) {
    freshnessBadgeColor = "bg-slate-800/80 text-slate-400 border-slate-700/40";
    freshnessBadgeText = "ตลาดปิด (Market Closed) • Yahoo Finance";
  } else if (isPriceStale || minutesElapsed > 5) {
    freshnessBadgeColor = "bg-rose-500/10 text-rose-455 border-rose-500/20";
    freshnessBadgeText = `เกิน 5 นาที (${minutesElapsed} นาทีที่แล้ว) • Yahoo Finance`;
  } else if (minutesElapsed >= 1) {
    freshnessBadgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
    freshnessBadgeText = `1–5 นาที (${minutesElapsed} นาทีที่แล้ว) • Finnhub API`;
  } else {
    freshnessBadgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    freshnessBadgeText = "สดภายใน 1 นาที • Finnhub API";
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 lg:p-6 shadow-2xl relative overflow-hidden">
      {/* Glow background accent */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Warning Block if API failed but displaying cached data */}
      {errorPrice && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-2.5 text-xs text-amber-400 font-bold">
          <AlertTriangle size={15} />
          <span>ดึงข้อมูลราคาล่าสุดไม่สำเร็จ กำลังแสดงข้อมูลสำรองจากการวิเคราะห์ครั้งก่อนหน้า</span>
        </div>
      )}

      {/* Main Unified Header & Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
        
        {/* Box 1: Stock Name and Price */}
        <div className="flex items-center gap-4 border-r-0 lg:border-r border-slate-800 pr-0 lg:pr-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black text-white tracking-tight uppercase">
                {symbol}
              </h1>
              <button
                onClick={toggleWatchlist}
                aria-label={isInWatchlist ? "นำออกจากหุ้นโปรด" : "เพิ่มเข้าหุ้นโปรด"}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isInWatchlist
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-slate-800 hover:bg-slate-750 text-slate-500 border-transparent"
                }`}
                title={isInWatchlist ? "Remove from watchlist" : "Add to watchlist"}
              >
                <Star size={13} className={isInWatchlist ? "fill-amber-400" : ""} />
              </button>
            </div>
            
            {price > 0 ? (
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">
                  ${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className={`text-xs font-extrabold px-2 py-0.5 rounded-md flex items-center gap-0.5 ${
                  change24h >= 0 
                    ? "text-emerald-400 bg-emerald-500/10" 
                    : "text-rose-400 bg-rose-500/10"
                }`}>
                  {change24h >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {change24h >= 0 ? "+" : ""}
                  {change24h.toFixed(2)}%
                </span>
              </div>
            ) : (
              <span className="text-slate-500 text-xs font-bold py-1">กำลังโหลดข้อมูลราคา...</span>
            )}
            
            {/* Standardized Data Freshness Badge */}
            <div className={`mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${freshnessBadgeColor}`}>
              <Database size={10} />
              <span>{freshnessBadgeText}</span>
            </div>
          </div>
        </div>

        {/* Box 2: Core Trends & Score */}
        <div className="grid grid-cols-2 gap-4 col-span-1 lg:col-span-2 border-r-0 lg:border-r border-slate-800 pr-0 lg:pr-6">
          
          {/* Trend & Bias */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              แนวโน้มหลัก (Bias)
            </span>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${trendColor}`}>
              {trendBias === "Bullish" && <TrendingUp size={13} />}
              {trendBias === "Bearish" && <TrendingDown size={13} />}
              {trendBias === "Neutral" && <Minus size={13} />}
              {trendLabel}
            </div>
          </div>

          {/* Rocket Score */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block flex items-center gap-1">
              Rocket Quant Score
              <Sparkles size={11} className="text-purple-400 animate-pulse" />
            </span>
            <div className="flex items-center gap-2">
              <strong className={`text-xl font-black ${
                score === null ? "text-slate-500" : score >= 70 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-rose-400"
              }`}>
                {loading ? (
                  <span className="text-xs font-bold text-slate-400 animate-pulse">คำนวณอยู่...</span>
                ) : score !== null ? (
                  `${score}/100`
                ) : (
                  "—"
                )}
              </strong>
              {score !== null && !loading && (
                <span className="text-[9px] text-slate-400 bg-purple-950/40 border border-purple-800/30 px-2 py-0.5 rounded font-extrabold">
                  {score >= 70 ? "Strong Buy" : score >= 60 ? "Buy" : score >= 40 ? "Hold" : "Sell"}
                </span>
              )}
            </div>
          </div>

          {/* Closest Support */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              แนวรับใกล้ที่สุด
            </span>
            <span className="text-sm font-bold text-slate-200 font-mono">
              {closestSupport ? `$${closestSupport.zone}` : "—"}
            </span>
          </div>

          {/* Closest Resistance */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              แนวต้านใกล้ที่สุด
            </span>
            <span className="text-sm font-bold text-slate-200 font-mono">
              {closestResistance ? `$${closestResistance.zone}` : "—"}
            </span>
          </div>

        </div>

        {/* Box 3: Technical Indicators & Actions */}
        <div className="flex flex-col justify-between gap-4">
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5">
            {/* RSI/MACD info */}
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                RSI & MACD Status
              </span>
              <div className="text-[11px] font-semibold text-slate-350 mt-0.5">
                RSI: {Math.round(rsi)}{" "}
                <span className={rsi > 70 ? "text-rose-400" : rsi < 30 ? "text-emerald-400" : "text-slate-500"}>
                  ({rsi > 70 ? "Overbought" : rsi < 30 ? "Oversold" : "Neutral"})
                </span>
                <span className="block text-slate-500 text-[10px] font-medium mt-0.5">
                  MACD: {macdText}
                </span>
              </div>
            </div>

            {/* Support/Resistance Freshness */}
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                ความตึงตัวโซนรับ-ต้าน
              </span>
              <span className={`px-2.5 py-0.5 rounded-lg border text-[9px] font-bold inline-block mt-0.5 ${freshnessColor}`}>
                {freshnessLabel}
              </span>
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={() => router.push(`/dashboard/alerts?symbol=${symbol}`)}
            aria-label="ตั้งค่าระบบแจ้งเตือนหุ้นตัวนี้"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-white text-slate-950 hover:bg-slate-200 transition duration-150 cursor-pointer shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Bell size={13} className="fill-slate-950" />
            ตั้งค่าแจ้งเตือน
          </button>
        </div>

      </div>
    </div>
  );
}
