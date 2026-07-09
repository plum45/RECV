"use client";

import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import MarketIndices from "../../components/MarketIndices";
import Watchlist from "../../components/Watchlist";
import LoadingState from "../../components/LoadingState";

export default function DashboardHome() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingState message="กำลังตรวจสอบสิทธิ์..." />;
  }

  return (
    <div className="flex h-screen bg-[#090d16] overflow-hidden text-slate-200">
      <div className="flex-1 flex flex-col min-w-0 h-full p-4 lg:p-6 pb-20 lg:pb-6 gap-6 overflow-y-auto custom-scrollbar">
        
        {/* Header */}
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
              สวัสดี, {user?.displayName || "นักลงทุน"}
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              ภาพรวมตลาดและหุ้นที่คุณติดตามวันนี้
            </p>
          </div>
        </header>

        {/* Market Indices */}
        <section>
          <MarketIndices />
        </section>

        {/* Watchlist */}
        <section className="flex-1 flex flex-col min-h-[400px]">
          <Watchlist />
        </section>

      </div>
    </div>
  );
}
