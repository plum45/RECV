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

  return (
    <div className="w-full space-y-6">
      {/* 24h Ticker Stats */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
          <Activity size={18} className="text-indigo-400" />
          สถิติตลาด 24 ชั่วโมง {symbol && `(${symbol})`}
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3.5 relative">
            <span className="text-xs text-slate-400 block mb-1">ราคาปัจจุบัน</span>
            <span className="text-xl font-bold text-slate-50">
              ${marketData.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            {marketData.prePostPrice && (
              <span className={`text-[10px] font-bold block mt-1.5 truncate ${
                marketData.marketState === "PRE" ? "text-amber-400" : "text-purple-400"
              }`}>
                {marketData.marketState === "PRE" ? "Pre" : "AH"}: 
                ${marketData.prePostPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} 
                ({marketData.prePostChange && marketData.prePostChange >= 0 ? "+" : ""}
                {marketData.prePostChange?.toFixed(2)}%)
              </span>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-xs text-slate-400 block mb-1">การเปลี่ยนแปลง 24h</span>
            <span className={`text-xl font-bold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
              {isPositive ? "+" : ""}
              {marketData.change24h.toFixed(2)}%
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-xs text-slate-400 block mb-1">สูงสุด / ต่ำสุด 24h</span>
            <span className="text-sm font-semibold text-slate-200 block">
              H: ${marketData.high24h.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-sm font-semibold text-slate-400 block">
              L: ${marketData.low24h.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-xs text-slate-400 block mb-1">Volume 24h</span>
            <span className="text-lg font-bold text-slate-200 block truncate">
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
              <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-800 pb-2 gap-1">
                <span className="text-slate-400 shrink-0">RSI (14)</span>
                <div className="text-right">
                  <span className="text-slate-100 font-bold mr-2">{indicators.rsi14.toFixed(1)}</span>
                  <span className={`text-xs ${rsiColor}`}>{rsiLabel}</span>
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
