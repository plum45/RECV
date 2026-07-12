"use client";

import React from "react";
import { TickerData, IndicatorData, SupportResistanceData } from "../types/market";
import { Activity, Flame, ShieldAlert, Compass } from "lucide-react";

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

  const isPositive = marketData.change24h >= 0;
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

  const compactNumber = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });

  const priceFormatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="w-full space-y-6">
      {/* 24h Ticker Stats */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/95 p-4 shadow-xl sm:p-5 lg:p-6">
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
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            Live market snapshot
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
          <div className="min-h-[118px] rounded-xl border border-slate-800/80 bg-slate-900/80 p-4">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">ราคาปัจจุบัน</span>
            <span className="mt-2 block break-words text-2xl font-black leading-tight text-slate-50">
              ${priceFormatter.format(marketData.currentPrice)}
            </span>
            {marketData.prePostPrice && (
              <span className={`text-[10px] font-bold block mt-1.5 ${
                marketData.marketState === "PRE" ? "text-amber-400" : "text-purple-400"
              }`}>
                {marketData.marketState === "PRE" ? "Pre-Market" : "After-Hours"}: 
                ${priceFormatter.format(marketData.prePostPrice)} 
                ({marketData.prePostChange && marketData.prePostChange >= 0 ? "+" : ""}
                {marketData.prePostChange?.toFixed(2)}%)
              </span>
            )}
          </div>

          <div className="min-h-[118px] rounded-xl border border-slate-800/80 bg-slate-900/80 p-4">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">เปลี่ยนแปลง 24h</span>
            <span className={`mt-2 block text-2xl font-black leading-tight ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
              {isPositive ? "+" : ""}
              {marketData.change24h.toFixed(2)}%
            </span>
            <span className="mt-2 block text-xs text-slate-500">
              เทียบกับ 24 ชั่วโมงก่อนหน้า
            </span>
          </div>

          <div className="min-h-[118px] rounded-xl border border-slate-800/80 bg-slate-900/80 p-4">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">High / Low 24h</span>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">H</span>
                <span className="min-w-0 break-words text-right font-bold text-slate-100">
                  ${priceFormatter.format(marketData.high24h)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">L</span>
                <span className="min-w-0 break-words text-right font-bold text-slate-400">
                  ${priceFormatter.format(marketData.low24h)}
                </span>
              </div>
            </div>
          </div>

          <div className="min-h-[118px] rounded-xl border border-slate-800/80 bg-slate-900/80 p-4">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Volume 24h</span>
            <span className="mt-2 block break-words text-2xl font-black leading-tight text-slate-100">
              {compactNumber.format(marketData.volume24h)}
            </span>
            <span className="mt-2 block text-xs text-slate-500">
              {marketData.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* Technical Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Moving Averages & Oscillators */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
            <Compass size={18} className="text-emerald-400" />
            ตัวบ่งชี้ทางเทคนิค (Technical Indicators)
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                <span className="text-slate-400 block mb-0.5">EMA 20</span>
                <span className="font-semibold text-indigo-300">
                  ${Math.round(indicators.ema20).toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                <span className="text-slate-400 block mb-0.5">EMA 50</span>
                <span className="font-semibold text-purple-300">
                  ${Math.round(indicators.ema50).toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                <span className="text-slate-400 block mb-0.5">EMA 200</span>
                <span className="font-semibold text-pink-300">
                  ${Math.round(indicators.ema200).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3.5 text-sm">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400">RSI (14)</span>
                <div className="text-right">
                  <span className="text-slate-100 font-bold mr-2">{indicators.rsi14.toFixed(1)}</span>
                  <span className={rsiColor}>{rsiLabel}</span>
                </div>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400">MACD</span>
                <div className="text-right font-semibold text-slate-200">
                  Hist:{" "}
                  <span className={indicators.macd.histogram >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    {indicators.macd.histogram.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400">ATR (14)</span>
                <span className="text-slate-100 font-semibold">{indicators.atr14.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Volume Analysis</span>
                <span className={volumeColor}>{volumeSpikeLabel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pivot Points */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
            <Flame size={18} className="text-rose-400" />
            Pivot Points (รายวัน)
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Resistance (ต้าน)</span>
              <div className="bg-slate-900/50 border border-red-950/40 rounded-xl p-2.5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-rose-400 font-bold">R3</span>
                  <span className="text-slate-200">${Math.round(indicators.pivot.r3).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-400/80 font-semibold">R2</span>
                  <span className="text-slate-200">${Math.round(indicators.pivot.r2).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-400/60">R1</span>
                  <span className="text-slate-200">${Math.round(indicators.pivot.r1).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Support (รับ)</span>
              <div className="bg-slate-900/50 border border-emerald-950/40 rounded-xl p-2.5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-emerald-400/60">S1</span>
                  <span className="text-slate-200">${Math.round(indicators.pivot.s1).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-400/80 font-semibold">S2</span>
                  <span className="text-slate-200">${Math.round(indicators.pivot.s2).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-400 font-bold">S3</span>
                  <span className="text-slate-200">${Math.round(indicators.pivot.s3).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 bg-slate-900 border border-slate-800 rounded-xl p-3 text-center text-sm">
            <span className="text-slate-400 mr-2">Pivot Point (P):</span>
            <span className="font-bold text-slate-100">${Math.round(indicators.pivot.p).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Support & Resistance Zones */}
      {supportResistance && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
            <ShieldAlert size={18} className="text-indigo-400" />
            โซนรับ-ต้านสำคัญ (Quantitative Price Zones)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Support Zones */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest block">Support Zones (โซนแนวรับ)</span>
              <div className="space-y-2.5">
                {supportResistance.supportZones.map((sz, idx) => (
                  <div key={idx} className="bg-slate-900/40 border border-emerald-950/30 rounded-xl p-3 flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <span className="text-sm font-bold text-emerald-300 block">${sz.zone}</span>
                      <div className="flex flex-wrap gap-1">
                        {sz.reasons.map((r, rIdx) => (
                          <span key={rIdx} className="bg-slate-950 text-[10px] text-slate-400 px-1.5 py-0.5 rounded border border-slate-800">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="bg-emerald-950/80 text-emerald-400 text-xs font-bold px-2 py-1 rounded-lg border border-emerald-800/40 shrink-0">
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
            <div className="space-y-3">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-widest block">Resistance Zones (โซนแนวต้าน)</span>
              <div className="space-y-2.5">
                {supportResistance.resistanceZones.map((rz, idx) => (
                  <div key={idx} className="bg-slate-900/40 border border-rose-950/30 rounded-xl p-3 flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <span className="text-sm font-bold text-rose-300 block">${rz.zone}</span>
                      <div className="flex flex-wrap gap-1">
                        {rz.reasons.map((r, rIdx) => (
                          <span key={rIdx} className="bg-slate-950 text-[10px] text-slate-400 px-1.5 py-0.5 rounded border border-slate-800">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="bg-rose-950/80 text-rose-400 text-xs font-bold px-2 py-1 rounded-lg border border-rose-800/40 shrink-0">
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
      )}
    </div>
  );
}
