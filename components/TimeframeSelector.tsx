"use client";

import React from "react";
import { Clock } from "lucide-react";

interface TimeframeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const timeframes = [
  { value: "5m", label: "5 นาที (5m)" },
  { value: "15m", label: "15 นาที (15m)" },
  { value: "1H", label: "1 ชั่วโมง (1H)" },
  { value: "4H", label: "4 ชั่วโมง (4H)" },
  { value: "1D", label: "1 วัน (1D)" },
];

export default function TimeframeSelector({ value, onChange }: TimeframeSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
        <Clock size={12} className="text-purple-400" />
        กรอบเวลา (Timeframe)
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 outline-none hover:border-slate-500 focus:border-purple-500 cursor-pointer appearance-none transition-all duration-200"
        >
          {timeframes.map((tf) => (
            <option key={tf.value} value={tf.value} className="bg-slate-900 text-slate-100">
              {tf.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
          <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
