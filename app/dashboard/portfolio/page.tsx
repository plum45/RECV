"use client";

import React from "react";
import PortfolioView from "../../../components/PortfolioView";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PortfolioPage() {
  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-[#090d16] text-slate-200">
      {/* Header Mobile Only */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-slate-800/60 bg-slate-900/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-semibold text-white">พอร์ตจำลอง</h1>
        </div>
      </div>

      <div className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6 overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="hidden lg:block mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">พอร์ตจำลองการลงทุน</h1>
            <p className="text-slate-400">ทดสอบระบบเทรดและจัดการพอร์ตโฟลิโอจำลองด้วยข้อมูลตลาดจริง</p>
          </div>
          
          <PortfolioView />
        </div>
      </div>
    </div>
  );
}
