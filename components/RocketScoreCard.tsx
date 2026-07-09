"use client";

import React from "react";
import { Rocket, Shield } from "lucide-react";

interface RocketScoreCardProps {
  reportText: string | null;
  loading: boolean;
}

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

export default function RocketScoreCard({ reportText, loading }: RocketScoreCardProps) {
  const score = parseRocketScore(reportText);

  // Loading / Placeholder state
  if (score === null || loading) {
    return (
      <div className="w-full bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 shadow-2xl flex flex-col items-center justify-center h-[260px] text-center relative overflow-hidden group">
        {/* Subtle grid backdrop for card */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:14px_14px]" />
        
        {/* Animated radar/scanner effect */}
        <div className="relative w-28 h-28 flex items-center justify-center mb-2">
          {/* Pulsing circles */}
          <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-ping opacity-75" />
          <div className="absolute w-20 h-20 rounded-full border border-purple-500/10 animate-pulse" />
          <div className="absolute w-12 h-12 rounded-full bg-indigo-500/5 flex items-center justify-center border border-indigo-500/10">
            <Rocket size={22} className="text-indigo-400/60 group-hover:text-indigo-400 group-hover:scale-110 transition-all duration-300 animate-bounce" />
          </div>
        </div>

        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest relative z-10">
          {loading ? "กำลังวิเคราะห์ข้อมูล..." : "Rocket Quant Score"}
        </span>
        <p className="text-[10px] text-slate-500 max-w-[200px] mt-1.5 relative z-10 leading-relaxed">
          {loading 
            ? "กำลังคำนวณน้ำหนักแนวโน้มและโมเมนตัมปัจจุบัน..." 
            : "สัดส่วนคะแนนความเชื่อมั่นจะถูกจัดทำทันทีหลังวิเคราะห์ข้อมูลตลาด"}
        </p>
      </div>
    );
  }

  // Determine colors based on score value
  let scoreColor = "text-indigo-400";
  let glowColor = "shadow-[0_0_30px_rgba(99,102,241,0.15)] border-indigo-500/30 bg-slate-900/25";
  let ringColor = "stroke-indigo-500";
  let scoreLabel = "Neutral Bias";
  let scoreDesc = "ตลาดเคลื่อนตัวไร้ทิศทางชัดเจน แนะนำรอสัญญาณคอนเฟิร์ม";

  if (score >= 70) {
    scoreColor = "text-emerald-400";
    glowColor = "shadow-[0_0_35px_rgba(16,185,129,0.2)] border-emerald-500/30 bg-slate-900/25";
    ringColor = "stroke-emerald-400";
    scoreLabel = "Strong Bullish Bias";
    scoreDesc = "ทิศทางกระทิงหนาแน่น แรงซื้อมีแรงผลักดันและได้เปรียบสูง";
  } else if (score >= 60) {
    scoreColor = "text-green-400";
    glowColor = "shadow-[0_0_30px_rgba(34,197,94,0.15)] border-green-500/25 bg-slate-900/25";
    ringColor = "stroke-green-450";
    scoreLabel = "Moderate Bullish";
    scoreDesc = "แนวโน้มเชิงบวกเริ่มฟอร์มตัว แต่ควรกำหนดจุดเสี่ยงแคบๆ";
  } else if (score >= 40) {
    scoreColor = "text-amber-400";
    glowColor = "shadow-[0_0_30px_rgba(245,158,11,0.15)] border-amber-500/25 bg-slate-900/25";
    ringColor = "stroke-amber-450";
    scoreLabel = "Neutral Market State";
    scoreDesc = "ตลาดเคลื่อนตัวไซด์เวย์ในกรอบแคบ รอเบรกเอาท์เลือกทาง";
  } else if (score >= 25) {
    scoreColor = "text-rose-400";
    glowColor = "shadow-[0_0_30px_rgba(244,63,94,0.15)] border-rose-500/25 bg-slate-900/25";
    ringColor = "stroke-rose-450";
    scoreLabel = "Moderate Bearish";
    scoreDesc = "เริ่มมีความเห็นพ้องฝั่งแรงขายกดดันระมัดระวังรอบ Long";
  } else {
    scoreColor = "text-red-400";
    glowColor = "shadow-[0_0_35px_rgba(239,68,68,0.2)] border-red-500/30 bg-slate-900/25";
    ringColor = "stroke-red-400";
    scoreLabel = "Strong Bearish Bias";
    scoreDesc = "ทิศทางหมีหนาแน่น แรงขายคุมตลาดอย่างเบ็ดเสร็จ ได้เปรียบฝั่ง Short";
  }

  // Circle SVG math
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className={`backdrop-blur-md border rounded-2xl p-6 shadow-2xl flex flex-col items-center justify-center h-[260px] transition-all duration-500 relative overflow-hidden group hover:scale-[1.01] ${glowColor}`}>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:14px_14px]" />
      
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5 relative z-10">
        <Rocket size={12} className={`${scoreColor} animate-bounce`} />
        Rocket Quant Confidence
      </span>

      {/* Radial Gauge */}
      <div className="relative w-28 h-28 flex items-center justify-center z-10">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="56"
            cy="56"
            r={radius}
            className="stroke-slate-800 fill-none"
            strokeWidth="7"
          />
          <circle
            cx="56"
            cy="56"
            r={radius}
            className={`fill-none transition-all duration-1000 ease-out ${ringColor}`}
            strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        {/* Score Text */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className={`text-3xl font-black tracking-tighter ${scoreColor} animate-pulse`}>
            {score}
          </span>
          <span className="text-[8px] text-slate-500 font-extrabold tracking-widest uppercase">/ 100</span>
        </div>
      </div>

      <span className={`text-xs font-black uppercase tracking-wider mt-3 relative z-10 ${scoreColor}`}>
        {scoreLabel}
      </span>
      <span className="text-[10px] text-slate-400 mt-0.5 text-center px-4 max-w-[240px] truncate relative z-10">
        {scoreDesc}
      </span>
    </div>
  );
}
