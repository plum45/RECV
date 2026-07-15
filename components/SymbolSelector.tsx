"use client";

import React from "react";
import { Landmark } from "lucide-react";

interface SymbolSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const symbolGroups = [
  {
    group: "🏆 Mega Cap Tech (หุ้นเทคใหญ่)",
    stocks: [
      { value: "AAPL", label: "Apple (AAPL)" },
      { value: "MSFT", label: "Microsoft (MSFT)" },
      { value: "GOOGL", label: "Alphabet (GOOGL)" },
      { value: "AMZN", label: "Amazon (AMZN)" },
      { value: "META", label: "Meta Platforms (META)" },
      { value: "NFLX", label: "Netflix (NFLX)" },
      { value: "ORCL", label: "Oracle (ORCL)" },
      { value: "CRM", label: "Salesforce (CRM)" },
    ],
  },
  {
    group: "🤖 AI & Semiconductors (ชิปและ AI)",
    stocks: [
      { value: "NVDA", label: "NVIDIA (NVDA)" },
      { value: "AMD", label: "Advanced Micro Devices (AMD)" },
      { value: "INTC", label: "Intel (INTC)" },
      { value: "QCOM", label: "Qualcomm (QCOM)" },
      { value: "AVGO", label: "Broadcom (AVGO)" },
      { value: "MU", label: "Micron Technology (MU)" },
      { value: "ARM", label: "Arm Holdings (ARM)" },
      { value: "SMCI", label: "Super Micro Computer (SMCI)" },
      { value: "MRVL", label: "Marvell Technology (MRVL)" },
      { value: "MCHP", label: "Microchip Technology (MCHP)" },
      { value: "VRT", label: "Vertiv Holdings (VRT)" },
      { value: "PLTR", label: "Palantir Technologies (PLTR)" },
    ],
  },
  {
    group: "🚀 High-Growth Tech (หุ้นเติบโตสูง)",
    stocks: [
      { value: "TSLA", label: "Tesla (TSLA)" },
      { value: "SHOP", label: "Shopify (SHOP)" },
      { value: "SNOW", label: "Snowflake (SNOW)" },
      { value: "DDOG", label: "Datadog (DDOG)" },
      { value: "NET", label: "Cloudflare (NET)" },
      { value: "CRWD", label: "CrowdStrike (CRWD)" },
      { value: "ZS", label: "Zscaler (ZS)" },
      { value: "MNDY", label: "Monday.com (MNDY)" },
      { value: "BILL", label: "Bill Holdings (BILL)" },
      { value: "GTLB", label: "GitLab (GTLB)" },
      { value: "PATH", label: "UiPath (PATH)" },
      { value: "AI", label: "C3.ai (AI)" },
    ],
  },
  {
    group: "⚡ EV & Clean Energy (รถไฟฟ้า/พลังงาน)",
    stocks: [
      { value: "RIVN", label: "Rivian Automotive (RIVN)" },
      { value: "LCID", label: "Lucid Group (LCID)" },
      { value: "NIO", label: "NIO Inc. (NIO)" },
      { value: "XPEV", label: "XPeng (XPEV)" },
      { value: "LI", label: "Li Auto (LI)" },
      { value: "PLUG", label: "Plug Power (PLUG)" },
      { value: "FSLR", label: "First Solar (FSLR)" },
      { value: "ENPH", label: "Enphase Energy (ENPH)" },
    ],
  },
  {
    group: "🏦 Finance & Fintech (การเงิน)",
    stocks: [
      { value: "JPM", label: "JPMorgan Chase (JPM)" },
      { value: "GS", label: "Goldman Sachs (GS)" },
      { value: "V", label: "Visa (V)" },
      { value: "MA", label: "Mastercard (MA)" },
      { value: "SQ", label: "Block Inc. (SQ)" },
      { value: "PYPL", label: "PayPal (PYPL)" },
      { value: "COIN", label: "Coinbase Global (COIN)" },
      { value: "HOOD", label: "Robinhood (HOOD)" },
      { value: "SOFI", label: "SoFi Technologies (SOFI)" },
    ],
  },
  {
    group: "💊 Healthcare & Biotech (สุขภาพ/ชีวการแพทย์)",
    stocks: [
      { value: "LLY", label: "Eli Lilly (LLY)" },
      { value: "MRNA", label: "Moderna (MRNA)" },
      { value: "BNTX", label: "BioNTech (BNTX)" },
      { value: "ABBV", label: "AbbVie (ABBV)" },
      { value: "UNH", label: "UnitedHealth Group (UNH)" },
      { value: "ISRG", label: "Intuitive Surgical (ISRG)" },
      { value: "DXCM", label: "Dexcom (DXCM)" },
    ],
  },
  {
    group: "🛍️ Consumer & Media (ผู้บริโภค/สื่อ)",
    stocks: [
      { value: "DIS", label: "Walt Disney (DIS)" },
      { value: "RBLX", label: "Roblox (RBLX)" },
      { value: "SPOT", label: "Spotify (SPOT)" },
      { value: "UBER", label: "Uber Technologies (UBER)" },
      { value: "LYFT", label: "Lyft (LYFT)" },
      { value: "ABNB", label: "Airbnb (ABNB)" },
      { value: "DASH", label: "DoorDash (DASH)" },
    ],
  },
  {
    group: "📦 ETF (กองทุนซื้อขายในตลาด)",
    stocks: [
      { value: "QQQ", label: "Invesco QQQ (Nasdaq-100)" },
      { value: "SPY", label: "SPDR S&P 500 ETF (SPY)" },
      { value: "ARKK", label: "ARK Innovation ETF (ARKK)" },
      { value: "SOXL", label: "Direxion Semis 3x Bull (SOXL)" },
      { value: "TQQQ", label: "ProShares UltraPro QQQ 3x (TQQQ)" },
    ],
  },
  {
    group: "Precious Metals (ทองและเงิน)",
    stocks: [
      { value: "XAUUSD=X", label: "Gold Spot / ทองคำ (XAUUSD)" },
      { value: "SI=F", label: "Silver Futures / เงิน (SI=F)" },
    ],
  },
];

export default function SymbolSelector({ value, onChange }: SymbolSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
        <Landmark size={12} className="text-indigo-400" />
        หุ้นสหรัฐฯ (US Stock / ETF)
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700/80 hover:border-slate-500 text-xs text-slate-100 rounded-xl px-3 py-2.5 outline-none cursor-pointer focus:border-indigo-500 appearance-none transition-all duration-300"
        >
          {symbolGroups.map((group) => (
            <optgroup key={group.group} label={group.group} className="bg-slate-950 text-slate-400 text-[10px]">
              {group.stocks.map((sym) => (
                <option key={sym.value} value={sym.value} className="bg-slate-950 text-slate-100 text-xs">
                  {sym.label}
                </option>
              ))}
            </optgroup>
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
