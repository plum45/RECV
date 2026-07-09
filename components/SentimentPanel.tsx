"use client";

import React from "react";
import { SentimentData } from "../types/analysis";
import { Smile, DollarSign, BarChart2, TrendingUp } from "lucide-react";

interface SentimentPanelProps {
  sentiment: SentimentData | null;
  loading: boolean;
}

export default function SentimentPanel({ sentiment, loading }: SentimentPanelProps) {
  if (loading) {
    return (
      <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl animate-pulse space-y-4">
        <div className="h-6 bg-slate-800 rounded w-1/3"></div>
        <div className="h-24 bg-slate-800 rounded-xl"></div>
        <div className="h-20 bg-slate-800 rounded-xl"></div>
      </div>
    );
  }

  if (!sentiment) {
    return (
      <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center text-slate-500 shadow-xl">
        กดปุ่ม "Analyze" เพื่อดึงข้อมูล Sentiment ตลาด
      </div>
    );
  }

  // Get color for overall sentiment
  const getSentimentStyles = (s: SentimentData["overallSentiment"]) => {
    switch (s) {
      case "Extreme Bullish":
        return { text: "text-emerald-400 font-extrabold", bg: "bg-emerald-950/60 border-emerald-800/60" };
      case "Bullish":
        return { text: "text-green-400 font-bold", bg: "bg-green-950/40 border-green-800/40" };
      case "Neutral":
        return { text: "text-slate-300 font-medium", bg: "bg-slate-900 border-slate-800" };
      case "Bearish":
        return { text: "text-rose-400 font-bold", bg: "bg-rose-950/40 border-rose-800/40" };
      case "Extreme Bearish":
        return { text: "text-red-400 font-extrabold", bg: "bg-red-950/60 border-red-800/60" };
      default:
        return { text: "text-slate-300", bg: "bg-slate-900 border-slate-800" };
    }
  };

  const sentimentStyles = getSentimentStyles(sentiment.overallSentiment);

  // Fear & greed progress color
  const getFngColor = (val: number) => {
    if (val >= 75) return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";
    if (val >= 55) return "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]";
    if (val >= 45) return "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]";
    if (val >= 25) return "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]";
    return "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]";
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
        <Smile size={18} className="text-amber-400" />
        จิตวิทยาตลาด (Market Sentiment)
      </h3>

      {/* Overall Sentiment Badge */}
      <div className={`border rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all ${sentimentStyles.bg}`}>
        <span className="text-xs text-slate-400 uppercase tracking-wider mb-1">ความเห็นพ้องของ Sentiment (Overall)</span>
        <span className={`text-2xl uppercase tracking-widest ${sentimentStyles.text}`}>
          {sentiment.overallSentiment}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Fear & Greed Index */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>ดัชนี Fear & Greed</span>
            <span className="font-bold text-slate-200">{sentiment.fearAndGreed.value}/100</span>
          </div>
          <div className="text-lg font-bold text-slate-100">{sentiment.fearAndGreed.label}</div>
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getFngColor(sentiment.fearAndGreed.value)}`}
              style={{ width: `${sentiment.fearAndGreed.value}%` }}
            />
          </div>
        </div>

        {/* Long/Short Ratio */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Long / Short Account Ratio</span>
            <span>รายชั่วโมง</span>
          </div>
          <div className="text-xl font-bold text-slate-100 flex items-center gap-1.5">
            <TrendingUp size={16} className="text-purple-400" />
            {sentiment.longShortRatio !== null ? sentiment.longShortRatio.toFixed(3) : "N/A"}
          </div>
          <p className="text-[11px] text-slate-400">
            สัดส่วนผู้เปิดสถานะ Long เทียบกับ Short บนตลาดฟิวเจอร์ส
          </p>
        </div>

        {/* Funding Rate */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 space-y-1">
          <span className="text-xs text-slate-400 block">Funding Rate</span>
          <div className="text-lg font-bold text-slate-100 flex items-center gap-1">
            <DollarSign size={16} className="text-emerald-400" />
            {sentiment.fundingRate !== null 
              ? `${(sentiment.fundingRate * 100).toFixed(4)}%` 
              : "N/A"}
          </div>
          <p className="text-[11px] text-slate-400">
            ค่าปรับสมดุลสัญญาฟิวเจอร์ส (บวก: ฝั่ง Long จ่าย, ลบ: ฝั่ง Short จ่าย)
          </p>
        </div>

        {/* Open Interest */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 space-y-1">
          <span className="text-xs text-slate-400 block">Open Interest (สัญญาคงค้าง)</span>
          <div className="text-lg font-bold text-slate-100 flex items-center gap-1 truncate">
            <BarChart2 size={16} className="text-indigo-400 shrink-0" />
            {sentiment.openInterest !== null 
              ? sentiment.openInterest.toLocaleString(undefined, { maximumFractionDigits: 0 }) 
              : "N/A"}
          </div>
          <p className="text-[11px] text-slate-400">
            ปริมาณสัญญาที่ยังเปิดคาค้างอยู่เพื่อวัดกระแสสภาพคล่อง
          </p>
        </div>
      </div>

      {/* Sentiment Drivers */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">ปัจจัยที่ขับเคลื่อน Sentiment:</span>
        <div className="space-y-1.5 bg-slate-900/40 border border-slate-800/60 rounded-xl p-3.5">
          {sentiment.reasons.map((reason, index) => (
            <div key={index} className="text-xs text-slate-300 leading-relaxed flex items-start gap-1.5">
              <span className="text-indigo-400 mt-0.5">•</span>
              <span>{reason}</span>
            </div>
          ))}
          {sentiment.reasons.length === 0 && (
            <div className="text-xs text-slate-500">ไม่มีข้อมูลวิเคราะห์ Sentiment เพิ่มเติม</div>
          )}
        </div>
      </div>
    </div>
  );
}
