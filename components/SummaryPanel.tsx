"use client";

import React from "react";
import {
  TrendingUp,
  TrendingDown,
  Info,
  Shield,
  Star,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle
} from "lucide-react";
import { TickerData, SupportResistanceData, IndicatorData } from "../types/market";
import { useRouter } from "next/navigation";

interface SummaryPanelProps {
  symbol: string;
  marketData: TickerData;
  supportResistance: SupportResistanceData;
  indicators: IndicatorData;
  isInWatchlist: boolean;
  toggleWatchlist: () => void;
}

export default function SummaryPanel({
  symbol,
  marketData,
  supportResistance,
  indicators,
  isInWatchlist,
  toggleWatchlist
}: SummaryPanelProps) {
  const router = useRouter();
  const price = marketData.currentPrice;

  // 1. Calculate Closest Support
  const supports = supportResistance.supportZones || [];
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
  const resistances = supportResistance.resistanceZones || [];
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
  const change24h = marketData.change24h;
  const rsi = indicators.rsi14;
  const macdHist = indicators.macd?.histogram || 0;

  let trendBias: "Bullish" | "Bearish" | "Neutral" = "Neutral";
  let trendColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
  let trendLabel = "Neutral (ไซด์เวย์)";

  if (rsi > 55 && macdHist > 0 && change24h > 0) {
    trendBias = "Bullish";
    trendColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    trendLabel = "Bullish (แนวโน้มขาขึ้น)";
  } else if (rsi < 45 && macdHist < 0 && change24h < 0) {
    trendBias = "Bearish";
    trendColor = "text-rose-400 bg-rose-500/10 border-rose-500/20";
    trendLabel = "Bearish (แนวโน้มขาลง)";
  }

  // 4. Zone Freshness Evaluation
  // If either closest support or resistance touches is high, it's Aged. If low, it's Fresh.
  const maxTouches = Math.max(closestSupport?.touches || 0, closestResistance?.touches || 0);
  let freshnessLabel = "Recent (ปานกลาง)";
  let freshnessColor = "text-slate-300 bg-slate-800/80 border-slate-700/50";
  
  if (maxTouches <= 1) {
    freshnessLabel = "Fresh (ใหม่/มีโอกาสรับอยู่สูง)";
    freshnessColor = "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
  } else if (maxTouches >= 5) {
    freshnessLabel = "Aged (เก่า/มีโอกาสทะลุสูง)";
    freshnessColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
  }

  // 5. Risk Level Calculation
  // Close to support = Low risk for Long. Close to resistance = High risk for Long.
  let riskLabel = "ปานกลาง (Medium)";
  let riskColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";

  if (supportMidVal > 0) {
    const distToSupport = (price - supportMidVal) / price;
    if (distToSupport < 0.025) {
      riskLabel = "ต่ำ (Low Risk for Long)";
      riskColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    }
  }
  if (resistanceMidVal > 0) {
    const distToResistance = (resistanceMidVal - price) / price;
    if (distToResistance < 0.025) {
      riskLabel = "สูง (High Risk for Long)";
      riskColor = "text-rose-400 bg-rose-500/10 border-rose-500/20";
    }
  }

  // 6. Action handlers
  const handleScrollToPlan = (planType: "long" | "short") => {
    const targetId = planType === "long" ? "long-trading-setup" : "short-trading-setup";
    const el = document.getElementById(targetId) || document.getElementById("trading-analysis-panel");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-md rounded-2xl p-5 lg:p-6 space-y-4 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
      {/* Upper Summary Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 items-center">
        
        {/* Trend/Bias */}
        <div className="space-y-1 col-span-2 sm:col-span-2">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
            แนวโน้มตลาด (Bias)
            <Info size={10} title="แนวโน้มระยะสั้นวิเคราะห์ตาม Confluence ของ RSI, MACD และ 24h Change" />
          </div>
          <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold text-center ${trendColor}`}>
            {trendLabel}
          </div>
        </div>

        {/* Current Price */}
        <div className="space-y-1">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ราคาปัจจุบัน</div>
          <div className="text-sm font-black text-slate-100 font-mono flex items-center gap-1.5">
            ${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            <span className={`text-[10px] font-bold ${change24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Closest Support */}
        <div className="space-y-1">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">แนวรับใกล้สุด</div>
          <div className="text-xs font-bold text-slate-300 font-mono">
            {closestSupport ? `$${closestSupport.zone}` : "—"}
            {closestSupport && <span className="text-[10px] text-slate-500 ml-1">({closestSupport.score}pt)</span>}
          </div>
        </div>

        {/* Closest Resistance */}
        <div className="space-y-1">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">แนวต้านใกล้สุด</div>
          <div className="text-xs font-bold text-slate-300 font-mono">
            {closestResistance ? `$${closestResistance.zone}` : "—"}
            {closestResistance && <span className="text-[10px] text-slate-500 ml-1">({closestResistance.score}pt)</span>}
          </div>
        </div>

        {/* RSI */}
        <div className="space-y-1">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">RSI (14)</div>
          <div className="text-xs font-bold text-slate-300">
            {Math.round(rsi)}
            <span className={`text-[10px] ml-1 ${rsi > 70 ? "text-rose-400 font-semibold" : rsi < 30 ? "text-emerald-400 font-semibold" : "text-slate-500"}`}>
              ({rsi > 70 ? "Overbought" : rsi < 30 ? "Oversold" : "Neutral"})
            </span>
          </div>
        </div>

        {/* Zone Freshness */}
        <div className="space-y-1">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ความสดใหม่โซน</div>
          <div className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold inline-block ${freshnessColor}`}>
            {freshnessLabel}
          </div>
        </div>

        {/* Risk Level */}
        <div className="space-y-1">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
            ความเสี่ยง Long
            <HelpCircle size={10} className="text-slate-500 cursor-help" title="ประเมินความคุ้มค่าความเสี่ยง (R:R Ratio) หากเปิดแผน Long ณ ราคาปัจจุบัน ยิ่งใกล้แนวรับ ความเสี่ยงยิ่งต่ำ" />
          </div>
          <div className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold inline-block ${riskColor}`}>
            {riskLabel}
          </div>
        </div>
      </div>

      {/* Lower Actions Section */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3.5 mt-2">
        <div className="flex flex-wrap gap-2.5">
          {/* View Long Plan */}
          <button
            onClick={() => handleScrollToPlan("long")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all cursor-pointer"
          >
            <ArrowUpRight size={14} />
            ดูแผนเทรด Long
          </button>

          {/* View Short Plan */}
          <button
            onClick={() => handleScrollToPlan("short")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
          >
            <ArrowDownRight size={14} />
            ดูแผนเทรด Short
          </button>

          {/* Setup Alert */}
          <button
            onClick={() => router.push(`/dashboard/alerts?symbol=${symbol}`)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-all cursor-pointer"
          >
            <Bell size={13} />
            ตั้งค่าระบบแจ้งเตือน
          </button>
        </div>

        {/* Favorite Star */}
        <button
          onClick={toggleWatchlist}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            isInWatchlist
              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
              : "bg-slate-800 hover:bg-slate-750 text-slate-400 border-transparent"
          }`}
        >
          <Star size={13} className={isInWatchlist ? "fill-amber-400" : ""} />
          {isInWatchlist ? "หุ้นโปรดแล้ว" : "เพิ่มเข้าหุ้นโปรด"}
        </button>
      </div>
    </div>
  );
}
