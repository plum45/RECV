/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Circle } from "lucide-react";

interface LoadingStateProps {
  isLoading: boolean;
}

const steps = [
  { id: 1, text: "ดึงราคาและสถิติตลาดล่าสุดจาก Binance API" },
  { id: 2, text: "คำนวณตัวชี้วัดทางเทคนิค (EMA, RSI, MACD, ATR)" },
  { id: 3, text: "คำนวณ Pivot Points และสแกนโซนแนวรับแนวต้าน" },
  { id: 4, text: "ดึงข้อมูลข่าวสารและคำนวณ Sentiment ดัชนีความกลัว/โลภ" },
  { id: 5, text: "ประสานข้อมูลและเรียกใช้โมเดล Rocket AI เพื่อจัดทำแผนเทรด" },
];

export default function LoadingState({ isLoading }: LoadingStateProps) {
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (!isLoading) {
      setCurrentStep(1);
      return;
    }

    // Simulate progress sequence through steps to give the user a high-fidelity loading experience
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length) {
          return prev + 1;
        }
        return prev;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-all duration-300">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl flex flex-col items-center space-y-6 relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Spinner */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          <Loader2 size={44} className="text-indigo-500 animate-spin" />
          <div className="absolute w-8 h-8 rounded-full bg-indigo-500/10 animate-pulse" />
        </div>

        {/* Header */}
        <div className="text-center space-y-1">
          <h4 className="text-lg font-bold text-slate-100 uppercase tracking-wide">
            กำลังประมวลผลข้อมูลตลาด
          </h4>
          <p className="text-xs text-slate-400">
            ระบบกำลังคำนวณและวิเคราะห์พฤติกรรมราคาด้วยปัญญาประดิษฐ์...
          </p>
        </div>

        {/* Steps List */}
        <div className="w-full space-y-3.5 pt-2">
          {steps.map((step) => {
            const isCompleted = currentStep > step.id;
            const isActive = currentStep === step.id;

            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 text-xs transition-all duration-300 ${
                  isActive ? "text-slate-100 font-semibold" : isCompleted ? "text-slate-400" : "text-slate-600"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 size={15} className="text-emerald-400 fill-emerald-950/20" />
                  ) : isActive ? (
                    <Loader2 size={15} className="text-indigo-400 animate-spin" />
                  ) : (
                    <Circle size={15} className="text-slate-700" />
                  )}
                </div>
                <span>{step.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
