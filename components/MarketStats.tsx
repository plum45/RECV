"use client";

import React from "react";
import { TickerData, IndicatorData, SupportResistanceData } from "../types/market";
import { Activity, Flame, ShieldAlert, Compass, Sun, Moon, Sunrise } from "lucide-react";
import { getDisplayPrice } from "../lib/priceUtils";

interface MarketStatsProps {
  marketData: TickerData | null;
  indicators: IndicatorData | null;
  supportResistance: SupportResistanceData | null;
  loading: boolean;
  symbol?: string;
}

export default function MarketStats({
  marketData,
  indicators,
  supportResistance,
  loading,
  symbol,
}: MarketStatsProps) {
  if (loading) {
    return (
      <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl animate-pulse space-y-6">
        <div className="h-6 bg-slate-800 rounded w-1/3"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-800 rounded-xl"></div>
          ))}
        </div>
        <div className="h-40 bg-slate-800 rounded-xl"></div>
      </div>
    );
  }

  if (!marketData || !indicators) {
    return (
      <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center text-slate-500 shadow-xl">
        กดปุ่ม "Analyze" เพื่อดึงข้อมูลตลาดทางเทคนิค
      </div>
    );
  }

  // Resolve display price using session-aware logic
  const displayPrice = getDisplayPrice(marketData);
  const isPositive = displayPrice.changePercent >= 0;
  const rsiVal = indicators.rsi14;
  let rsiLabel = "Neutral";
  let rsiColor = "text-slate-300";
  if (rsiVal >= 70) {
    rsiLabel = "Overbought (ซื้อมากเกินไป)";
    rsiColor = "text-rose-400 font-semibold";
  } else if (rsiVal <= 30) {
    rsiLabel = "Oversold (ขายมากเกินไป)";
    rsiColor = "text-emerald-400 font-semibold";
  }

  const volumeRatio = indicators.volumeAnalysis.volumeRatio;
  let volumeSpikeLabel = "ปกติ";
  let volumeColor = "text-slate-400";
  if (indicators.volumeAnalysis.isVolumeSpike) {
    volumeSpikeLabel = `Spike! (${volumeRatio.toFixed(1)}x)`;
    volumeColor = "text-amber-400 font-bold animate-pulse";
  }

  const vwapLabel = indicators.vwapDetails.type === "session" ? "Session VWAP" : "Rolling VWAP";
  const vwapIsBullish = indicators.vwap > 0 && displayPrice.price >= indicators.vwap;
  const priceAction = indicators.priceAction ?? {
    bias: "neutral" as const,
    confirmation: "none" as const,
    patterns: [],
    liquiditySweep: "none" as const,
  };
  const priceActionColor = priceAction.bias === "bullish"
    ? "text-emerald-400"
    : priceAction.bias === "bearish" ? "text-rose-400" : "text-slate-300";
  const smartMoney = indicators.smartMoney;
  const smartMoneyColor = smartMoney?.mss === "bullish" || smartMoney?.bos === "bullish"
    ? "text-emerald-400"
    : smartMoney?.mss === "bearish" || smartMoney?.bos === "bearish" ? "text-rose-400" : "text-slate-300";

  const compactNumber = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });

  const priceFormatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Session badge config
  const sessionBadge = (() => {
    const ms = marketData.marketState ?? "UNKNOWN";
    if (ms === "PRE")
      return { label: "Pre-Market", icon: Sunrise, cls: "text-amber-400 bg-amber-500/10 border-amber-500/25" };
    if (ms === "POST")
      return { label: "After-Hours", icon: Moon, cls: "text-purple-400 bg-purple-500/10 border-purple-500/25" };
    if (ms === "REGULAR")
      return { label: "Regular", icon: Sun, cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" };
    if (ms === "CLOSED")
      return { label: "ตลาดปิด", icon: Moon, cls: "text-slate-400 bg-slate-700/40 border-slate-600/30" };
    return { label: "Regular", icon: Sun, cls: "text-slate-400 bg-slate-700/40 border-slate-600/30" };
  })();

  return (
    <div className="w-full space-y-6 @container/stats">
      {/* 24h Ticker Stats */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/95 p-4 sm:p-5 lg:p-6 shadow-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-indigo-500/0 via-indigo-400/70 to-cyan-400/0" />
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-100 sm:text-lg">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-500/10 text-indigo-300">
              <Activity size={17} />
            </span>
            <span className="leading-tight">
              สถิติตลาด 24 ชั่วโมง
              {symbol && <span className="ml-1 text-slate-400">({symbol})</span>}
            </span>
          </h3>
          {/* Session Badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${sessionBadge.cls}`}>
            <sessionBadge.icon size={10} />
            {sessionBadge.label}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 @[680px]/stats:grid-cols-4">
          <div className="min-w-0 min-h-[118px] rounded-xl border border-slate-800/80 bg-slate-900/80 p-4 flex flex-col justify-between">
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                ราคา ({displayPrice.sessionName})
              </span>
              <span
                className="mt-1.5 block text-xl sm:text-2xl font-black leading-tight text-slate-50 truncate min-w-0"
                title={`$${priceFormatter.format(displayPrice.price)}`}
              >
                ${priceFormatter.format(displayPrice.price)}
              </span>
            </div>
            {/* Show alt session prices when not in REGULAR */}
            {marketData.marketState === "PRE" && marketData.preMarketPrice && (
              <span className="text-[10px] font-bold block mt-2 truncate min-w-0 text-amber-400">
                Pre: ${priceFormatter.format(marketData.preMarketPrice)}
                {" "}({marketData.preMarketChangePercent != null
                  ? (marketData.preMarketChangePercent >= 0 ? "+" : "") +
                    marketData.preMarketChangePercent.toFixed(2) + "%"
                  : ""})
              </span>
            )}
            {marketData.marketState === "POST" && marketData.postMarketPrice && (
              <span className="text-[10px] font-bold block mt-2 truncate min-w-0 text-purple-400">
                AH: ${priceFormatter.format(marketData.postMarketPrice)}
                {" "}({marketData.postMarketChangePercent != null
                  ? (marketData.postMarketChangePercent >= 0 ? "+" : "") +
                    marketData.postMarketChangePercent.toFixed(2) + "%"
                  : ""})
              </span>
            )}
          </div>

          <div className="min-w-0 min-h-[118px] rounded-xl border border-slate-800/80 bg-slate-900/80 p-4 flex flex-col justify-between">
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">เปลี่ยนแปลง</span>
              <span className={`mt-1.5 block text-xl sm:text-2xl font-black leading-tight truncate min-w-0 ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                {isPositive ? "+" : ""}
                {displayPrice.changePercent.toFixed(2)}%
              </span>
            </div>
            <span className="mt-2 block text-xs text-slate-500 truncate min-w-0">
              vs Previous Close
            </span>
          </div>

          <div className="min-w-0 min-h-[118px] rounded-xl border border-slate-800/80 bg-slate-900/80 p-4 flex flex-col justify-between">
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">High / Low 24h</span>
              <div className="mt-2 space-y-1.5 text-sm min-w-0">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-slate-500 shrink-0">H</span>
                  <span className="min-w-0 truncate text-right font-bold text-slate-100">
                    ${priceFormatter.format(marketData.high24h)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-slate-500 shrink-0">L</span>
                  <span className="min-w-0 truncate text-right font-bold text-slate-400">
                    ${priceFormatter.format(marketData.low24h)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 min-h-[118px] rounded-xl border border-slate-800/80 bg-slate-900/80 p-4 flex flex-col justify-between">
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Volume 24h</span>
              <span className="mt-1.5 block text-xl sm:text-2xl font-black leading-tight text-slate-100 truncate min-w-0" title={compactNumber.format(marketData.volume24h)}>
                {compactNumber.format(marketData.volume24h)}
              </span>
            </div>
            <span className="mt-2 block text-xs text-slate-500 truncate min-w-0">
              {marketData.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* Technical Indicators */}
      <div className="grid grid-cols-1 @[680px]/stats:grid-cols-2 gap-6">
        {/* Moving Averages & Oscillators */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl min-w-0 flex flex-col justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
              <Compass size={18} className="text-emerald-400 shrink-0" />
              <span className="truncate">ตัวบ่งชี้ทางเทคนิค</span>
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 sm:p-2.5 min-w-0">
                  <span className="text-slate-400 block mb-0.5 text-[11px] sm:text-xs">EMA 20</span>
                  <span className="font-semibold text-indigo-300 block truncate min-w-0">
                    ${Math.round(indicators.ema20).toLocaleString()}
                  </span>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 sm:p-2.5 min-w-0">
                  <span className="text-slate-400 block mb-0.5 text-[11px] sm:text-xs">EMA 50</span>
                  <span className="font-semibold text-purple-300 block truncate min-w-0">
                    ${Math.round(indicators.ema50).toLocaleString()}
                  </span>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 sm:p-2.5 min-w-0">
                  <span className="text-slate-400 block mb-0.5 text-[11px] sm:text-xs">EMA 200</span>
                  <span className="font-semibold text-pink-300 block truncate min-w-0">
                    ${Math.round(indicators.ema200).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3.5 text-sm">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-800 pb-2.5 gap-1.5 min-w-0">
                  <span className="text-slate-400 shrink-0 text-xs sm:text-sm">RSI (14)</span>
                  <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap min-w-0">
                    <span className="text-slate-100 font-bold shrink-0">{indicators.rsi14.toFixed(1)}</span>
                    <span className={`text-[11px] sm:text-xs font-semibold ${rsiColor} shrink-0`}>{rsiLabel}</span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-800 pb-2.5 gap-1 min-w-0">
                  <span className="text-slate-400 text-xs sm:text-sm">MACD</span>
                  <div className="flex items-center justify-between sm:justify-end gap-2 min-w-0 font-semibold text-slate-200">
                    <span className="text-xs text-slate-500">Hist:</span>
                    <span className={indicators.macd.histogram >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {indicators.macd.histogram.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-2.5 min-w-0">
                  <span className="text-slate-400 text-xs sm:text-sm">ATR (14)</span>
                  <span className="text-slate-100 font-semibold">{indicators.atr14.toFixed(2)}</span>
                </div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-800 pb-2.5 gap-1 min-w-0">
                  <span className="text-slate-400 text-xs sm:text-sm">{vwapLabel}</span>
                  <span className={`text-xs sm:text-sm font-semibold ${vwapIsBullish ? "text-emerald-400" : "text-rose-400"}`}>
                    ${indicators.vwap.toFixed(2)} · {vwapIsBullish ? "Above" : "Below"}
                  </span>
                </div>
                {indicators.anchoredVwap && (
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-800 pb-2.5 gap-1 min-w-0">
                    <span className="text-slate-400 text-xs sm:text-sm">Anchored VWAP</span>
                    <span className={`text-xs sm:text-sm font-semibold ${displayPrice.price >= indicators.anchoredVwap.value ? "text-cyan-300" : "text-amber-300"}`}>
                      ${indicators.anchoredVwap.value.toFixed(2)} · {indicators.anchoredVwap.anchorType.replace("_", " ")}
                    </span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-800 pb-2.5 gap-1 min-w-0">
                  <span className="text-slate-400 text-xs sm:text-sm">Price Action</span>
                  <span className={`text-xs sm:text-sm font-semibold ${priceActionColor}`} title={priceAction.patterns.join(", ")}>
                    {priceAction.bias} · {priceAction.confirmation}
                    {priceAction.liquiditySweep !== "none" ? ` · ${priceAction.liquiditySweep} sweep` : ""}
                  </span>
                </div>
                {smartMoney && (
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-800 pb-2.5 gap-1 min-w-0">
                    <span className="text-slate-400 text-xs sm:text-sm">Smart Money</span>
                    <span className={`text-xs sm:text-sm font-semibold ${smartMoneyColor}`}>
                      BOS {smartMoney.bos} · MSS {smartMoney.mss}
                    </span>
                  </div>
                )}
                {smartMoney && (smartMoney.demandZone || smartMoney.supplyZone) && (
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-800 pb-2.5 gap-1 min-w-0">
                    <span className="text-slate-400 text-xs sm:text-sm">Demand / Supply</span>
                    <span className="text-xs sm:text-sm font-semibold text-amber-300">
                      {smartMoney.demandZone
                        ? `Demand ${smartMoney.demandZone.low.toFixed(2)}-${smartMoney.demandZone.high.toFixed(2)}`
                        : `Supply ${smartMoney.supplyZone!.low.toFixed(2)}-${smartMoney.supplyZone!.high.toFixed(2)}`}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center min-w-0">
                  <span className="text-slate-400 text-xs sm:text-sm">Volume Analysis</span>
                  <span className={`text-xs sm:text-sm font-semibold ${volumeColor}`}>{volumeSpikeLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pivot Points */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl min-w-0 flex flex-col justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
              <Flame size={18} className="text-rose-400 shrink-0" />
              <span className="truncate">Pivot Points (รายวัน)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 min-w-0">
                <span className="text-[11px] sm:text-xs text-slate-400 font-bold uppercase tracking-wide block truncate">Resistance (ต้าน)</span>
                <div className="bg-slate-900/50 border border-red-950/40 rounded-xl p-2.5 space-y-1.5 text-xs min-w-0">
                  <div className="flex items-center justify-between gap-1 min-w-0">
                    <span className="text-rose-400 font-bold shrink-0">R3</span>
                    <span className="text-slate-200 truncate font-semibold">${Math.round(indicators.pivot.r3).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1 min-w-0 border-t border-slate-800/60 pt-1.5">
                    <span className="text-rose-400 font-bold shrink-0">R2</span>
                    <span className="text-slate-200 truncate font-semibold">${Math.round(indicators.pivot.r2).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1 min-w-0 border-t border-slate-800/60 pt-1.5">
                    <span className="text-rose-400 font-bold shrink-0">R1</span>
                    <span className="text-slate-200 truncate font-semibold">${Math.round(indicators.pivot.r1).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 min-w-0">
                <span className="text-[11px] sm:text-xs text-slate-400 font-bold uppercase tracking-wide block truncate">Support (รับ)</span>
                <div className="bg-slate-900/50 border border-emerald-950/40 rounded-xl p-2.5 space-y-1.5 text-xs min-w-0">
                  <div className="flex items-center justify-between gap-1 min-w-0">
                    <span className="text-emerald-400/60 font-bold shrink-0">S1</span>
                    <span className="text-slate-200 truncate font-semibold">${Math.round(indicators.pivot.s1).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1 min-w-0 border-t border-slate-800/60 pt-1.5">
                    <span className="text-emerald-400/80 font-bold shrink-0">S2</span>
                    <span className="text-slate-200 truncate font-semibold">${Math.round(indicators.pivot.s2).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1 min-w-0 border-t border-slate-800/60 pt-1.5">
                    <span className="text-emerald-400 font-bold shrink-0">S3</span>
                    <span className="text-slate-200 truncate font-semibold">${Math.round(indicators.pivot.s3).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 bg-slate-900 border border-slate-800 rounded-xl p-3 text-center text-xs sm:text-sm flex items-center justify-center gap-2 min-w-0">
            <span className="text-slate-400 shrink-0">Pivot Point (P):</span>
            <span className="font-bold text-slate-100 truncate">${Math.round(indicators.pivot.p).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SupportResistanceZonesPanel({ supportResistance }: { supportResistance: any }) {
  if (!supportResistance) return null;

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl min-w-0">
      <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
        <span className="text-indigo-400 shrink-0">🛡️</span>
        <span className="truncate">โซนรับ-ต้านสำคัญ</span>
      </h3>
      <div className="grid grid-cols-1 @[680px]/stats:grid-cols-2 gap-6 min-w-0">
        {/* Support Zones */}
        <div className="space-y-3 min-w-0">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest block truncate">Support Zones (โซนแนวรับ)</span>
          <div className="space-y-2.5 min-w-0">
            {supportResistance.supportZones.map((sz: any, idx: number) => (
              <div key={idx} className="bg-slate-900/40 border border-emerald-950/30 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2.5 sm:gap-4 min-w-0">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap min-w-0">
                    <span className="text-sm font-bold text-emerald-300 block truncate">${sz.zone}</span>
                    <span className="sm:hidden bg-emerald-950/80 text-emerald-400 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-emerald-800/40 shrink-0">
                      Score: {sz.score}/10
                    </span>
                  </div>
                  {/* Status & Quant Badges */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {sz.role === "nearest" && (
                      <span className="bg-cyan-950/90 text-cyan-300 border border-cyan-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        Nearest / จุดเฝ้าดู
                      </span>
                    )}
                    {sz.role === "structural" && (
                      <span className="bg-violet-950/90 text-violet-300 border border-violet-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        Structural / แนวหลัก
                      </span>
                    )}
                    {sz.freshness === "fresh" && (
                      <span className="bg-emerald-950/90 text-emerald-300 border border-emerald-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        ⚡ Fresh
                      </span>
                    )}
                    {sz.freshness === "historical" && (
                      <span className="bg-slate-900 text-slate-400 border border-slate-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        📜 Historical
                      </span>
                    )}
                    {sz.strength === "major" && (
                      <span className="bg-purple-950/90 text-purple-300 border border-purple-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        🔥 Major
                      </span>
                    )}
                    {sz.status === "flipped" && (
                      <span className="bg-indigo-950/90 text-indigo-300 border border-indigo-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        🔄 Flipped
                      </span>
                    )}
                    {sz.status === "tested" && (
                      <span className="bg-amber-950/90 text-amber-300 border border-amber-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        🎯 Tested
                      </span>
                    )}
                    {sz.status === "weakened" && (
                      <span className="bg-orange-950/90 text-orange-300 border border-orange-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        📉 Weakened
                      </span>
                    )}
                    {sz.status === "broken" && (
                      <span className="bg-rose-950/90 text-rose-300 border border-rose-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        💥 Broken
                      </span>
                    )}
                    {typeof sz.touches === "number" && sz.touches > 0 && (
                      <span className="bg-slate-900 text-slate-300 border border-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        👆 {sz.touches} Touches
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {sz.reasons.map((r: string, rIdx: number) => (
                      <span key={rIdx} className="bg-slate-950 text-[10px] text-slate-300 px-2 py-1 rounded-md border border-slate-800/80 leading-normal break-words">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="hidden sm:inline-block bg-emerald-950/80 text-emerald-400 text-xs font-bold px-2.5 py-1 rounded-lg border border-emerald-800/40 shrink-0 self-start">
                  Score: {sz.score}/10
                </span>
              </div>
            ))}
            {supportResistance.supportZones.length === 0 && (
              <div className="text-slate-500 text-sm">ไม่มีโซนแนวรับที่คำนวณได้</div>
            )}
          </div>
        </div>

        {/* Resistance Zones */}
        <div className="space-y-3 min-w-0">
          <span className="text-xs font-bold text-rose-400 uppercase tracking-widest block truncate">Resistance Zones (โซนแนวต้าน)</span>
          <div className="space-y-2.5 min-w-0">
            {supportResistance.resistanceZones.map((rz: any, idx: number) => (
              <div key={idx} className="bg-slate-900/40 border border-rose-950/30 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2.5 sm:gap-4 min-w-0">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap min-w-0">
                    <span className="text-sm font-bold text-rose-300 block truncate">${rz.zone}</span>
                    <span className="sm:hidden bg-rose-950/80 text-rose-400 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-rose-800/40 shrink-0">
                      Score: {rz.score}/10
                    </span>
                  </div>
                  {/* Status & Quant Badges */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {rz.role === "nearest" && (
                      <span className="bg-cyan-950/90 text-cyan-300 border border-cyan-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        Nearest / จุดเฝ้าดู
                      </span>
                    )}
                    {rz.role === "structural" && (
                      <span className="bg-violet-950/90 text-violet-300 border border-violet-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        Structural / แนวหลัก
                      </span>
                    )}
                    {rz.freshness === "fresh" && (
                      <span className="bg-emerald-950/90 text-emerald-300 border border-emerald-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        ⚡ Fresh
                      </span>
                    )}
                    {rz.freshness === "historical" && (
                      <span className="bg-slate-900 text-slate-400 border border-slate-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        📜 Historical
                      </span>
                    )}
                    {rz.strength === "major" && (
                      <span className="bg-purple-950/90 text-purple-300 border border-purple-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        🔥 Major
                      </span>
                    )}
                    {rz.status === "flipped" && (
                      <span className="bg-indigo-950/90 text-indigo-300 border border-indigo-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        🔄 Flipped
                      </span>
                    )}
                    {rz.status === "tested" && (
                      <span className="bg-amber-950/90 text-amber-300 border border-amber-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        🎯 Tested
                      </span>
                    )}
                    {rz.status === "weakened" && (
                      <span className="bg-orange-950/90 text-orange-300 border border-orange-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        📉 Weakened
                      </span>
                    )}
                    {rz.status === "broken" && (
                      <span className="bg-rose-950/90 text-rose-300 border border-rose-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        💥 Broken
                      </span>
                    )}
                    {typeof rz.touches === "number" && rz.touches > 0 && (
                      <span className="bg-slate-900 text-slate-300 border border-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        👆 {rz.touches} Touches
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {rz.reasons.map((r: string, rIdx: number) => (
                      <span key={rIdx} className="bg-slate-950 text-[10px] text-slate-300 px-2 py-1 rounded-md border border-slate-800/80 leading-normal break-words">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="hidden sm:inline-block bg-rose-950/80 text-rose-400 text-xs font-bold px-2.5 py-1 rounded-lg border border-rose-800/40 shrink-0 self-start">
                  Score: {rz.score}/10
                </span>
              </div>
            ))}
            {supportResistance.resistanceZones.length === 0 && (
              <div className="text-slate-500 text-sm">ไม่มีโซนแนวต้านที่คำนวณได้</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
