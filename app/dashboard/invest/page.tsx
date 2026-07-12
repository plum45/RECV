"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, TrendingUp, Star, Activity, BarChart2 } from "lucide-react";
import MobileNavBar from "../../../components/MobileNavBar";

export default function InvestPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const popularStocks = [
    { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Technology" },
    { symbol: "AAPL", name: "Apple Inc.", sector: "Technology" },
    { symbol: "TSLA", name: "Tesla Inc.", sector: "Automotive" },
    { symbol: "MSFT", name: "Microsoft", sector: "Technology" },
    { symbol: "GULF.BK", name: "GULF Energy", sector: "Energy" },
    { symbol: "PTT.BK", name: "PTT PCL", sector: "Energy" },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    // Basic formatting: if user types ptt, we uppercase it.
    // If they want Thai stocks they should type .BK, or we can assume it later.
    const symbol = searchQuery.trim().toUpperCase();
    router.push(`/dashboard/analyze?symbol=${symbol}`);
  };

  const handleCardClick = (symbol: string) => {
    router.push(`/dashboard/analyze?symbol=${symbol}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0E14] text-slate-900 dark:text-slate-100 pb-24">
      {/* Top Banner Area */}
      <div className="w-full bg-gradient-to-b from-indigo-900/40 to-[#0B0E14] pt-12 pb-8 px-6 border-b border-slate-800/60">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-black text-slate-100 tracking-tight mb-4 flex items-center justify-center gap-3">
            <BarChart2 size={36} className="text-indigo-400" />
            ค้นหาหุ้นน่าลงทุน
          </h1>
          <p className="text-slate-400 font-medium mb-8 max-w-xl mx-auto">
            ค้นหาและวิเคราะห์หุ้นทั่วโลกด้วยระบบ AI ชั้นนำ เพื่อค้นหาจุดเข้าซื้อที่ดีที่สุด
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative w-full max-w-2xl mx-auto">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="h-6 w-6 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full bg-slate-900/80 border-2 border-slate-700 hover:border-indigo-500/50 focus:border-indigo-500 rounded-2xl py-4 pl-12 pr-24 text-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all uppercase"
              placeholder="ค้นหาชื่อหุ้น เช่น AAPL, TSLA, PTT.BK..."
            />
            <div className="absolute inset-y-0 right-2 flex items-center">
              <button
                type="submit"
                disabled={!searchQuery.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)]"
              >
                วิเคราะห์
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-10 space-y-10">
        
        {/* Popular Stocks Section */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="text-emerald-400" size={24} />
            <h2 className="text-2xl font-bold text-slate-100 tracking-tight">หุ้นยอดนิยม (Popular)</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {popularStocks.map((stock) => {
              const logoDomain = `${stock.symbol.split(".")[0].toLowerCase()}.com`;
              
              return (
                <div
                  key={stock.symbol}
                  onClick={() => handleCardClick(stock.symbol)}
                  className="group p-5 bg-slate-900/40 hover:bg-slate-800/80 backdrop-blur-sm border border-slate-800 hover:border-indigo-500/30 rounded-2xl cursor-pointer transition-all hover:shadow-lg hover:shadow-indigo-500/10 flex items-center gap-4"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://logo.clearbit.com/${logoDomain}`}
                    alt={stock.symbol}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${stock.symbol}&background=random&color=fff&rounded=true&bold=true`;
                    }}
                    className="w-12 h-12 rounded-full bg-slate-800 object-cover shadow-sm"
                  />
                  <div>
                    <h3 className="font-extrabold text-slate-100 text-lg group-hover:text-indigo-400 transition-colors">
                      {stock.symbol}
                    </h3>
                    <p className="text-sm text-slate-400 truncate">{stock.name}</p>
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1 block">
                      {stock.sector}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
