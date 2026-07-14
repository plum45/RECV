"use client";

import React, { useMemo, useState } from "react";
import { 
  ShieldAlert, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  Play, 
  Target, 
  Shield, 
  Info,
  RefreshCw,
  HelpCircle,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function RiskCalculatorPage() {
  // Inputs state
  const [capital, setCapital] = useState<number>(100000);
  const [riskPercent, setRiskPercent] = useState<number>(1);
  const [entryPrice, setEntryPrice] = useState<number>(100);
  const [stopLoss, setStopLoss] = useState<number>(95);
  const [takeProfit, setTakeProfit] = useState<number>(115);
  const [maxSlPercent, setMaxSlPercent] = useState<number>(10); // Warning threshold for Stop Loss %
  const [tradeType, setTradeType] = useState<"long" | "short">("long");
  
  // Quick asset presets
  const [presetType, setPresetType] = useState<"custom" | "stock" | "crypto">("stock");

  const calculations = useMemo(() => {
    const riskAmt = capital * (riskPercent / 100);
    let slDistance = 0;
    let tpDistance = 0;

    if (tradeType === "long") {
      slDistance = Math.max(0, entryPrice - stopLoss);
      tpDistance = Math.max(0, takeProfit - entryPrice);
    } else {
      slDistance = Math.max(0, stopLoss - entryPrice);
      tpDistance = Math.max(0, entryPrice - takeProfit);
    }

    const slPct = entryPrice > 0 ? (slDistance / entryPrice) * 100 : 0;
    const tpPct = entryPrice > 0 ? (tpDistance / entryPrice) * 100 : 0;
    const positionUnits = slDistance > 0 ? riskAmt / slDistance : 0;
    const rr = slDistance > 0 ? tpDistance / slDistance : 0;
    return {
      actualRiskAmount: riskAmt,
      slDiff: slDistance,
      slPercent: slPct,
      tpDiff: tpDistance,
      tpPercent: tpPct,
      positionUnits,
      positionValue: positionUnits * entryPrice,
      riskRewardRatio: rr,
      targetProfit: positionUnits * tpDistance,
      targetLoss: positionUnits * slDistance,
      isSlTooWide: slPct > maxSlPercent,
    };
  }, [capital, riskPercent, entryPrice, stopLoss, takeProfit, tradeType, maxSlPercent]);

  const {
    actualRiskAmount,
    slDiff,
    slPercent,
    tpDiff,
    tpPercent,
    positionUnits,
    positionValue,
    riskRewardRatio,
    targetProfit,
    targetLoss,
    isSlTooWide,
  } = calculations;

  const applyPreset = (type: "custom" | "stock" | "crypto") => {
    setPresetType(type);
    if (type === "stock") {
      setRiskPercent(1);
      setMaxSlPercent(8);
    } else if (type === "crypto") {
      setRiskPercent(2);
      setMaxSlPercent(15);
    }
  };

  // Reset helper
  const handleReset = () => {
    setCapital(100000);
    setRiskPercent(1);
    setEntryPrice(100);
    setStopLoss(95);
    setTakeProfit(115);
    setMaxSlPercent(10);
    setTradeType("long");
    setPresetType("stock");
  };

  // Helper to format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  // Helper to format number
  const formatNumber = (val: number, decimals: number = 2) => {
    return new Intl.NumberFormat("th-TH", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(val);
  };

  // Quick percent adjustments
  const adjustValue = (type: "entry" | "sl" | "tp", percent: number) => {
    if (type === "entry") {
      const newVal = entryPrice * (1 + percent / 100);
      setEntryPrice(Number(newVal.toFixed(4)));
    } else if (type === "sl") {
      const direction = tradeType === "long" ? -1 : 1;
      const newVal = entryPrice * (1 + (direction * percent) / 100);
      setStopLoss(Number(newVal.toFixed(4)));
    } else if (type === "tp") {
      const direction = tradeType === "long" ? 1 : -1;
      const newVal = entryPrice * (1 + (direction * percent) / 100);
      setTakeProfit(Number(newVal.toFixed(4)));
    }
  };

  return (
    <div className="flex-1 min-w-0 h-full p-4 sm:p-6 xl:p-8 pb-24 lg:pb-8 overflow-y-auto custom-scrollbar text-slate-200">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/[0.08] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-300">
            Risk Management Tool
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
            เครื่องมือคำนวณความเสี่ยง (Risk Calculator)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            คำนวณขนาดไม้ที่เหมาะสม (Position Sizing) อัตราส่วน Risk/Reward และวิเคราะห์ความคุ้มค่าก่อนเปิดออเดอร์
          </p>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={handleReset} 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <RefreshCw size={14} />
            รีเซ็ตค่าเริ่มต้น
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Column 1 & 2: Inputs & Interactive Visualizer */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Main Card: Controls & Settings */}
          <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-[24px] p-5 sm:p-6 shadow-xl relative overflow-hidden">
            <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />
            
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
              {/* Trade Type Selector */}
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                <button
                  onClick={() => {
                    setTradeType("long");
                    setStopLoss(95);
                    setTakeProfit(115);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tradeType === "long"
                      ? "bg-emerald-500 text-white shadow-lg"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <TrendingUp size={14} />
                  Long (ซื้อขึ้น)
                </button>
                <button
                  onClick={() => {
                    setTradeType("short");
                    setStopLoss(105);
                    setTakeProfit(85);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tradeType === "short"
                      ? "bg-rose-500 text-white shadow-lg"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <TrendingDown size={14} />
                  Short (ขายลง)
                </button>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 px-2">Preset:</span>
                <button
                  onClick={() => applyPreset("stock")}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    presetType === "stock"
                      ? "bg-slate-800 text-indigo-300 font-bold border border-slate-700/50"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  หุ้นไทย/เทศ (1% Risk)
                </button>
                <button
                  onClick={() => applyPreset("crypto")}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    presetType === "crypto"
                      ? "bg-slate-800 text-indigo-300 font-bold border border-slate-700/50"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  Crypto (2% Risk)
                </button>
                <button
                  onClick={() => applyPreset("custom")}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    presetType === "custom"
                      ? "bg-slate-800 text-indigo-300 font-bold border border-slate-700/50"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  กำหนดเอง
                </button>
              </div>
            </div>

            {/* Grid Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              {/* Capital */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-slate-500" />
                  เงินทุนในพอร์ตทั้งหมด (Capital)
                </label>
                <div className="relative rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 flex items-center focus-within:border-indigo-500 transition-colors">
                  <input
                    type="number"
                    value={capital}
                    onChange={(e) => setCapital(Math.max(0, Number(e.target.value)))}
                    className="bg-transparent border-0 outline-none text-white text-base font-bold w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="ระบุจำนวนเงินทุน"
                  />
                  <span className="text-xs font-bold text-slate-500 shrink-0">บาท (THB)</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto py-0.5">
                  {[10000, 50000, 100000, 500000, 1000000].map((val) => (
                    <button
                      key={val}
                      onClick={() => setCapital(val)}
                      className="text-[10px] font-semibold px-2 py-1 bg-slate-850 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded-md transition cursor-pointer"
                    >
                      {formatNumber(val, 0)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Risk Percentage */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 flex items-center justify-between gap-1.5">
                  <span className="flex items-center gap-1.5">
                    <Percent size={14} className="text-slate-500" />
                    % ความเสี่ยงต่อการเทรดครั้งนี้
                  </span>
                  <span className="text-[11px] text-slate-500 font-bold bg-slate-800 px-2 py-0.5 rounded">
                    = {formatCurrency(actualRiskAmount)}
                  </span>
                </label>
                <div className="relative rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 flex items-center focus-within:border-indigo-500 transition-colors">
                  <input
                    type="number"
                    step="0.1"
                    value={riskPercent}
                    onChange={(e) => {
                      setPresetType("custom");
                      setRiskPercent(Math.max(0, Number(e.target.value)));
                    }}
                    className="bg-transparent border-0 outline-none text-white text-base font-bold w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="เช่น 1"
                  />
                  <span className="text-xs font-bold text-slate-500 shrink-0">% ของพอร์ต</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto py-0.5">
                  {[0.5, 1, 2, 3, 5].map((val) => (
                    <button
                      key={val}
                      onClick={() => {
                        setPresetType("custom");
                        setRiskPercent(val);
                      }}
                      className="text-[10px] font-semibold px-2.5 py-1 bg-slate-850 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded-md transition cursor-pointer"
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Entry Price */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <Play size={14} className="text-indigo-400" />
                  จุดเข้าซื้อ (Entry Price)
                </label>
                <div className="relative rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 flex items-center focus-within:border-indigo-500 transition-colors">
                  <input
                    type="number"
                    step="any"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(Math.max(0, Number(e.target.value)))}
                    className="bg-transparent border-0 outline-none text-white text-base font-bold w-full"
                    placeholder="เช่น 100"
                  />
                  <span className="text-xs font-bold text-slate-500 shrink-0">บาท / หน่วย</span>
                </div>
                <div className="flex gap-1.5">
                  {[-1, -0.5, 0.5, 1].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => adjustValue("entry", pct)}
                      className="text-[10px] font-semibold px-2 py-1 bg-slate-850 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded-md transition cursor-pointer"
                    >
                      {pct > 0 ? `+${pct}%` : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Stop Loss Alert Threshold */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <Info size={14} className="text-slate-500" />
                  เกณฑ์เตือน Stop Loss กว้างเกินไป
                </label>
                <div className="relative rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 flex items-center focus-within:border-indigo-500 transition-colors">
                  <input
                    type="number"
                    value={maxSlPercent}
                    onChange={(e) => {
                      setPresetType("custom");
                      setMaxSlPercent(Math.max(0, Number(e.target.value)));
                    }}
                    className="bg-transparent border-0 outline-none text-white text-base font-bold w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="เช่น 10"
                  />
                  <span className="text-xs font-bold text-slate-500 shrink-0">% ห่างจาก Entry</span>
                </div>
                <div className="flex gap-1.5">
                  {[5, 8, 10, 15, 20].map((val) => (
                    <button
                      key={val}
                      onClick={() => {
                        setPresetType("custom");
                        setMaxSlPercent(val);
                      }}
                      className="text-[10px] font-semibold px-2.5 py-1 bg-slate-850 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded-md transition cursor-pointer"
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Stop Loss (SL) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 flex items-center justify-between gap-1.5">
                  <span className="flex items-center gap-1.5">
                    <Shield size={14} className="text-rose-400" />
                    Stop Loss (จุดยอมแพ้)
                  </span>
                  <span className={`text-[11px] font-bold ${isSlTooWide ? "text-amber-400" : "text-slate-500"}`}>
                    ระยะ: {formatNumber(slPercent, 2)}%
                  </span>
                </label>
                <div className={`relative rounded-xl border px-4 py-3 flex items-center transition-colors bg-slate-950 ${
                  isSlTooWide 
                    ? "border-amber-500/50 focus-within:border-amber-500" 
                    : "border-slate-800 focus-within:border-indigo-500"
                }`}>
                  <input
                    type="number"
                    step="any"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(Math.max(0, Number(e.target.value)))}
                    className="bg-transparent border-0 outline-none text-white text-base font-bold w-full"
                    placeholder="เช่น 95"
                  />
                  <span className="text-xs font-bold text-slate-500 shrink-0">บาท</span>
                </div>
                <div className="flex gap-1.5">
                  {[2, 3, 5, 8, 10].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => adjustValue("sl", pct)}
                      className="text-[10px] font-semibold px-2 py-1 bg-slate-850 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded-md transition cursor-pointer"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Take Profit (TP) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 flex items-center justify-between gap-1.5">
                  <span className="flex items-center gap-1.5">
                    <Target size={14} className="text-emerald-400" />
                    Take Profit (จุดทำกำไร)
                  </span>
                  <span className="text-[11px] text-slate-500 font-bold">
                    ระยะ: {formatNumber(tpPercent, 2)}%
                  </span>
                </label>
                <div className="relative rounded-xl border border-slate-805 bg-slate-950 px-4 py-3 flex items-center focus-within:border-indigo-500 transition-colors">
                  <input
                    type="number"
                    step="any"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(Math.max(0, Number(e.target.value)))}
                    className="bg-transparent border-0 outline-none text-white text-base font-bold w-full"
                    placeholder="เช่น 115"
                  />
                  <span className="text-xs font-bold text-slate-500 shrink-0">บาท</span>
                </div>
                <div className="flex gap-1.5">
                  {[5, 10, 15, 20, 30].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => adjustValue("tp", pct)}
                      className="text-[10px] font-semibold px-2 py-1 bg-slate-850 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded-md transition cursor-pointer"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Warning Stop Loss alert block */}
            <AnimatePresence>
              {isSlTooWide && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 relative overflow-hidden"
                >
                  <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
                    <AlertTriangle size={90} className="text-amber-500" />
                  </div>
                  <AlertTriangle className="text-amber-400 shrink-0 mt-0.5 animate-bounce" size={20} />
                  <div>
                    <h5 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                      คำเตือน: Stop Loss กว้างเกินไป ({formatNumber(slPercent, 2)}% &gt; เกณฑ์ {maxSlPercent}%)
                    </h5>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      การวางจุดยอมแพ้ห่างจากจุดเข้าซื้อมากเกินไป อาจส่งผลให้จำนวนเงินที่ลงทุนในไม้นี้มีสัดส่วนน้อยเกินไป 
                      แนะนำให้วางจุดยอมแพ้ตามแนวรับเชิงเทคนิคที่แคบลง หรือเพิ่มเกณฑ์เตือนความเสี่ยงหากเป็นทรัพย์สินที่มีความผันผวนสูง
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Trade Visualizer Block */}
          <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-[24px] p-5 sm:p-6 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-3 bg-indigo-500 rounded-full" />
              ภาพจำลองสัดส่วนราคา (Trade Setup Visualizer)
            </h3>

            <div className="space-y-4 py-2">
              {/* Vertical Stack Visualizer */}
              <div className="relative flex flex-col gap-2 bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-6 overflow-hidden">
                
                {/* Take Profit Bar */}
                <div className="flex items-center justify-between gap-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500" />
                  <div className="flex items-center gap-2 pl-2">
                    <Target className="text-emerald-400" size={16} />
                    <span className="text-xs font-bold text-emerald-400">Take Profit (เป้าหมายกำไร)</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-white">{formatNumber(takeProfit)} THB</div>
                    <div className="text-[10px] font-bold text-emerald-400">+{formatNumber(tpPercent, 2)}%</div>
                  </div>
                </div>

                {/* Arrow connectors */}
                <div className="flex justify-between items-center px-6 text-slate-600">
                  <div className="h-4 border-l border-dashed border-slate-700" />
                  <span className="text-[10.5px] font-semibold text-slate-500 bg-slate-900/80 px-2 py-0.5 rounded-full border border-slate-800">
                    ระยะกำไร: {formatNumber(tpDiff)} บาท
                  </span>
                  <div className="h-4 border-r border-dashed border-slate-700" />
                </div>

                {/* Entry Bar */}
                <div className="flex items-center justify-between gap-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500" />
                  <div className="flex items-center gap-2 pl-2">
                    <Play className="text-indigo-400" size={16} />
                    <span className="text-xs font-bold text-indigo-300">Entry Price (ราคาจุดเข้าซื้อ)</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-white">{formatNumber(entryPrice)} THB</div>
                    <div className="text-[10px] font-bold text-indigo-400">ฐานอ้างอิง</div>
                  </div>
                </div>

                {/* Arrow connectors */}
                <div className="flex justify-between items-center px-6 text-slate-600">
                  <div className="h-4 border-l border-dashed border-slate-700" />
                  <span className="text-[10.5px] font-semibold text-slate-500 bg-slate-900/80 px-2 py-0.5 rounded-full border border-slate-800">
                    ระยะขาดทุน: {formatNumber(slDiff)} บาท
                  </span>
                  <div className="h-4 border-r border-dashed border-slate-700" />
                </div>

                {/* Stop Loss Bar */}
                <div className={`flex items-center justify-between gap-4 p-3 rounded-xl border relative overflow-hidden ${
                  isSlTooWide 
                    ? "bg-amber-500/10 border-amber-500/30" 
                    : "bg-rose-500/10 border-rose-500/20"
                }`}>
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isSlTooWide ? "bg-amber-500 animate-pulse" : "bg-rose-500"}`} />
                  <div className="flex items-center gap-2 pl-2">
                    <Shield className={isSlTooWide ? "text-amber-400" : "text-rose-400"} size={16} />
                    <span className={`text-xs font-bold ${isSlTooWide ? "text-amber-400" : "text-rose-400"}`}>
                      Stop Loss (จุดยอมแพ้) {isSlTooWide && "(กว้างเกินเกณฑ์)"}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-white">{formatNumber(stopLoss)} THB</div>
                    <div className={`text-[10px] font-bold ${isSlTooWide ? "text-amber-400" : "text-rose-400"}`}>
                      -{formatNumber(slPercent, 2)}%
                    </div>
                  </div>
                </div>

              </div>

              {/* R:R Rating Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950 border border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center font-black text-indigo-400 text-lg border border-indigo-500/20">
                    {formatNumber(riskRewardRatio, 1)}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">อัตราส่วน Risk / Reward Ratio</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {riskRewardRatio >= 2.0 
                        ? "สัดส่วนดีมาก (R:R คุ้มค่าแก่การลงทุน)" 
                        : riskRewardRatio >= 1.0 
                        ? "สัดส่วนปานกลาง (R:R พอรับได้)" 
                        : "สัดส่วนมีความเสี่ยงสูงกว่ากำไรที่ได้ (ไม่แนะนำ)"}
                    </p>
                  </div>
                </div>
                
                {/* Visual meter */}
                <div className="w-full sm:w-48 h-2 bg-slate-800 rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-rose-500 transition-all duration-300" 
                    style={{ width: `${100 / (1 + riskRewardRatio)}%` }} 
                  />
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300" 
                    style={{ width: `${(riskRewardRatio * 100) / (1 + riskRewardRatio)}%` }} 
                  />
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Column 3: Output Metrics Card */}
        <div className="space-y-6">
          
          {/* Main Results Card */}
          <div className="bg-slate-905 bg-slate-900 border border-slate-800 rounded-[28px] p-6 shadow-2xl relative overflow-hidden">
            <div className="pointer-events-none absolute -right-24 -bottom-24 h-52 w-52 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <h2 className="text-base font-bold text-white mb-6 uppercase tracking-wider flex items-center justify-between">
              ผลลัพธ์การคำนวณ
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </h2>

            <div className="space-y-6">
              
              {/* Quantity to buy */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                  จำนวนหน่วยที่ควรซื้อ (Position Size)
                </span>
                <strong className="text-3xl font-black text-emerald-400 mt-1 tracking-tight">
                  {formatNumber(positionUnits, 2)}
                </strong>
                <span className="text-[11px] text-slate-400 mt-1 font-semibold">
                  หุ้น / เหรียญ (Units)
                </span>
              </div>

              {/* Actual risk amount */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                  <span>เงินเสี่ยงจริง (Actual Risk)</span>
                  <span className="text-rose-400">{formatCurrency(actualRiskAmount)}</span>
                </div>
                <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-rose-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, (actualRiskAmount / capital) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 block">
                  เป็นจำนวนความเสี่ยงที่ระบุไว้ ({riskPercent}% ของเงินทุน)
                </span>
              </div>

              <div className="border-t border-slate-800/80 my-4" />

              {/* Grid with other metrics */}
              <div className="space-y-4">
                
                {/* Cost of position */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-bold">มูลค่าไม้ที่ลงทุน (Position Value)</span>
                  <div className="text-right">
                    <strong className="text-sm font-bold text-white">{formatCurrency(positionValue)}</strong>
                    <span className="block text-[10px] text-slate-500 font-bold">
                      = {formatNumber((positionValue / capital) * 100, 1)}% ของเงินทุนทั้งหมด
                    </span>
                  </div>
                </div>

                {/* Profit at Target */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-bold">กำไรเมื่อถึงเป้าหมาย (Take Profit)</span>
                  <div className="text-right">
                    <strong className="text-sm font-bold text-emerald-400">+{formatCurrency(targetProfit)}</strong>
                    <span className="block text-[10px] text-slate-500 font-bold">
                      +{formatNumber((targetProfit / capital) * 100, 2)}% ของเงินทุน
                    </span>
                  </div>
                </div>

                {/* Loss at SL */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-bold">ขาดทุนเมื่อถึง Stop Loss</span>
                  <div className="text-right">
                    <strong className="text-sm font-bold text-rose-500">-{formatCurrency(targetLoss)}</strong>
                    <span className="block text-[10px] text-slate-500 font-bold">
                      -{formatNumber((targetLoss / capital) * 100, 2)}% ของเงินทุน
                    </span>
                  </div>
                </div>

                {/* Risk / Reward ratio */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-bold">อัตราส่วน Risk : Reward</span>
                  <strong className="text-sm font-bold text-indigo-400">
                    1 : {formatNumber(riskRewardRatio, 2)}
                  </strong>
                </div>

              </div>

              {/* Warning/Notification Badge if capital is insufficient */}
              {positionValue > capital && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5">
                  <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={16} />
                  <div>
                    <h6 className="text-[11px] font-bold text-rose-300">เงินลงทุนไม่เพียงพอสำหรับไม้นี้</h6>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                      มูลค่าไม้ที่ใช้ซื้อ ({formatCurrency(positionValue)}) สูงกว่าเงินทุนทั้งหมดที่มี ({formatCurrency(capital)}) 
                      แนะนำให้ลด % ความเสี่ยง หรือวาง Stop Loss ให้แคบลง
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Education Card on Position Sizing */}
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Info size={14} className="text-indigo-400" />
              ความรู้เกี่ยวกับ Position Sizing
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              สูตรการคำนวณขนาดไม้คือ: 
              <code className="block bg-slate-950 p-2 rounded-lg my-1.5 text-indigo-300 font-mono text-[10px]">
                จำนวนหน่วย = เงินที่รับความเสี่ยงได้ / (ราคาซื้อ - ราคาตัดขาดทุน)
              </code>
              วิธีนี้จะช่วยป้องกันไม่ให้บัญชีเสียหายหนัก แม้จะเดาทิศทางผิดพลาดหลายครั้งติดต่อกันก็ตาม เพราะจำนวนเงินที่สูญเสียจริงจะจำกัดอยู่ตามที่กำหนดไว้เสมอ
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
