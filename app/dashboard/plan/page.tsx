"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../../contexts/AuthContext";
import { 
  Rocket, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Zap, 
  Check, 
  Copy, 
  Trash2, 
  Send, 
  Activity, 
  HelpCircle, 
  AlertTriangle,
  Play,
  RotateCw,
  Plus,
  Sliders
} from "lucide-react";
import LoadingState from "../../../components/LoadingState";
import CalendarRiskBadge from "../../../components/CalendarRiskBadge";
import { db } from "../../../lib/firebase";
import { collection, query, orderBy, getDocs, addDoc, deleteDoc, doc, updateDoc, setDoc } from "firebase/firestore";
import { getRecommendedTimeframe, getStoredTradingStyle, storeTradingStyle, type TradingStyle } from "../../../lib/tradingStyle";

interface TradingPlan {
  id?: string;
  symbol: string;
  tradingStyle: TradingStyle;
  direction: "long" | "short" | "wait";
  timeframe: string;
  entryApproach?: string;
  vwapContext?: string;
  entryLow?: number;
  entryHigh?: number;
  stopLoss?: number;
  takeProfit1?: number;
  takeProfit2?: number;
  takeProfit3?: number;
  riskReward?: number;
  positionSize?: number;
  holdingPeriod: string;
  invalidation: string;
  confidence: number;
  status: "Active" | "Hit Entry" | "TP1 Hit" | "TP2 Hit" | "Stopped Out" | "Invalidated" | "Expired";
  createdAt: string;
  updatedAt: string;
  dataSource: string;
  reasoning: string;
}

export default function TradingPlanPage() {
  const { user, loading: authLoading } = useAuth();
  
  // Form Inputs
  const [symbol, setSymbol] = useState(() => {
    if (typeof window === "undefined") return "NVDA";
    return new URLSearchParams(window.location.search).get("symbol")?.toUpperCase() || "NVDA";
  });
  const [tradingStyle, setTradingStyle] = useState<TradingStyle>(() => getStoredTradingStyle());
  const [timeframe, setTimeframe] = useState(() => getRecommendedTimeframe(getStoredTradingStyle()));
  const [direction, setDirection] = useState<"long" | "short" | "wait">("long");
  const [capital, setCapital] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(1);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<TradingPlan | null>(null);
  const [savedPlans, setSavedPlans] = useState<TradingPlan[]>([]);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [telegramSuccess, setTelegramSuccess] = useState<string | null>(null);

  const handleTradingStyleChange = (style: TradingStyle) => {
    const recommendedTimeframe = getRecommendedTimeframe(style);
    storeTradingStyle(style);
    setTradingStyle(style);
    setTimeframe(recommendedTimeframe);
    if (user) {
      void setDoc(doc(db, "users", user.uid), {
        tradingStyle: style,
        timeframe: recommendedTimeframe,
      }, { merge: true });
    }
  };

  // Fetch saved plans
  const fetchPlans = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, "users", user.uid, "trading_plans"),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const plansList: TradingPlan[] = [];
      querySnapshot.forEach((docSnap) => {
        plansList.push({ id: docSnap.id, ...docSnap.data() } as TradingPlan);
      });
      setSavedPlans(plansList);
    } catch (err: any) {
      console.error("Failed to load saved plans:", err.message);
    }
  };

  useEffect(() => {
    if (user && !authLoading) {
      const timer = window.setTimeout(() => {
        void fetchPlans();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [user, authLoading]);

  // Generate Plan
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol) {
      setError("กรุณากรอกสัญลักษณ์หุ้น/เหรียญ");
      return;
    }
    setLoading(true);
    setError(null);
    setGeneratedPlan(null);

    try {
      const token = await user?.getIdToken();
      const response = await axios.post(
        "/api/trading-plan",
        {
          symbol,
          tradingStyle,
          timeframe,
          direction,
          capital,
          risk: riskPercent,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data?.success) {
        setGeneratedPlan(response.data.plan);
      } else {
        setError(response.data?.message || "ล้มเหลวในการสร้างแผนการเทรด");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setLoading(false);
    }
  };

  // Save Plan
  const handleSave = async () => {
    if (!user || !generatedPlan) return;
    try {
      const docRef = await addDoc(
        collection(db, "users", user.uid, "trading_plans"),
        generatedPlan
      );
      setSavedPlans([{ id: docRef.id, ...generatedPlan }, ...savedPlans]);
      setGeneratedPlan(null);
    } catch (err: any) {
      setError(`ไม่สามารถบันทึกแผนได้: ${err.message}`);
    }
  };

  // Delete Plan
  const handleDelete = async (id: string) => {
    if (!user || !confirm("คุณต้องการลบแผนการเทรดนี้ใช่หรือไม่?")) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "trading_plans", id));
      setSavedPlans(savedPlans.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(`ลบแผนไม่สำเร็จ: ${err.message}`);
    }
  };

  // Update Status
  const handleUpdateStatus = async (id: string, newStatus: TradingPlan["status"]) => {
    if (!user) return;
    try {
      const docRef = doc(db, "users", user.uid, "trading_plans", id);
      await updateDoc(docRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      setSavedPlans(
        savedPlans.map((p) => (p.id === id ? { ...p, status: newStatus, updatedAt: new Date().toISOString() } : p))
      );
    } catch (err: any) {
      alert(`อัปเดตสถานะไม่สำเร็จ: ${err.message}`);
    }
  };

  // Copy Markdown Clipboard
  const handleCopy = (plan: TradingPlan) => {
    const text = `📋 **Trading Plan: ${plan.symbol}** (${plan.tradingStyle.toUpperCase()})
-----------------------------------------
ทิศทาง: ${plan.direction.toUpperCase()}
กรอบเวลา: ${plan.timeframe}
จุดเข้าซื้อ: ${plan.entryLow ? `$${plan.entryLow} - $${plan.entryHigh}` : "N/A"}
วิธีเข้า: ${plan.entryApproach || "N/A"}
VWAP: ${plan.vwapContext || "N/A"}
Stop Loss: ${plan.stopLoss ? `$${plan.stopLoss}` : "N/A"}
Take Profit: ${plan.takeProfit1 ? `TP1: $${plan.takeProfit1} | TP2: $${plan.takeProfit2} | TP3: $${plan.takeProfit3}` : "N/A"}
Risk/Reward Ratio: 1:${plan.riskReward || 0}
ระยะเวลาถือครอง: ${plan.holdingPeriod}
เงื่อนไขยกเลิกแผน: ${plan.invalidation}
ระดับความมั่นใจ: ${plan.confidence}%
เหตุผล: ${plan.reasoning}
-----------------------------------------
(คำเตือน: นี่ไม่ใช่คำแนะนำในการลงทุน)`;

    navigator.clipboard.writeText(text);
    setCopySuccess(plan.id || "gen");
    setTimeout(() => setCopySuccess(null), 2000);
  };

  // Send to Telegram
  const handleSendTelegram = async (plan: TradingPlan) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await axios.post(
        "/api/telegram/send-plan",
        { plan },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data?.success) {
        setTelegramSuccess(plan.id || "gen");
        setTimeout(() => setTelegramSuccess(null), 3000);
      } else {
        alert(response.data?.message || "ส่งห้องแชทโทรเลขไม่สำเร็จ");
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col gap-8 relative z-10">
      <LoadingState isLoading={loading} />
      
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
            <Sliders className="text-indigo-500" /> แผนการเทรด (Trading Plan)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            สร้าง จัดเก็บข้อมูล และซิงค์แผนเก็งกำไรด้วยระบบ AI ควบคู่กับเงื่อนไขบริหารความเสี่ยงระดับสากล
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Create Plan Form */}
        <div className="xl:col-span-4 bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 md:p-6 shadow-xl backdrop-blur-md space-y-5">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Plus size={16} className="text-indigo-400" /> สร้างแผนการเทรดใหม่
          </h2>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                สัญลักษณ์สินทรัพย์ (Symbol)
              </label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="เช่น AAPL, TSLA, BTC"
                className="w-full bg-slate-950 border border-slate-850 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                สไตล์การเทรด (Trading Style)
              </label>
              <select
                value={tradingStyle}
                onChange={(e) => handleTradingStyleChange(e.target.value as TradingStyle)}
                className="w-full bg-slate-950 border border-slate-850 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="scalping">Scalping (1–30 นาที / 1H → 15m → 5m)</option>
                <option value="day">Day Trade (ถอยเร็ว / เทรดระยะสั้น)</option>
                <option value="swing">Swing Trade (เก็งกำไรในกรอบแนวโน้ม)</option>
                <option value="position">Position Trade (เก็งกำไรโครงสร้างใหญ่)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                กรอบเวลา (Timeframe)
              </label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="5m">5 Minutes (5m)</option>
                <option value="15m">15 Minutes (15m)</option>
                <option value="1H">1 Hour (1H)</option>
                <option value="4H">4 Hours (4H)</option>
                <option value="1D">1 Day (1D)</option>
                <option value="1W">1 Week (1W)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                มุมมองทิศทาง (Direction)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["long", "short", "wait"] as const).map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => setDirection(dir)}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      direction === dir
                        ? dir === "long"
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                          : dir === "short"
                          ? "bg-rose-500/20 border-rose-500 text-rose-400"
                          : "bg-slate-800 border-slate-600 text-slate-300"
                        : "bg-slate-950 border-slate-850 text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {dir === "long" ? "LONG" : dir === "short" ? "SHORT" : "WAIT"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  เงินทุน ($ Capital)
                </label>
                <input
                  type="number"
                  value={capital}
                  onChange={(e) => setCapital(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-850 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  ความเสี่ยงต่อไม้ (% Risk)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-850 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-white hover:bg-slate-100 text-slate-950 text-xs font-black uppercase tracking-wider py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play size={12} className="fill-slate-950 text-slate-950" /> สร้างแผนการเทรด (Generate)
            </button>
          </form>

          {error && (
            <div className="bg-rose-950/20 border border-rose-700/30 text-rose-300 text-xs rounded-2xl p-4 flex items-start gap-2.5">
              <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Right Side: Generated Result Card or Active List */}
        <div className="xl:col-span-8 space-y-6">
          
          {/* 1. Generated Plan Review */}
          {generatedPlan && (
            <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-3xl p-5 md:p-6 shadow-xl relative z-10 backdrop-blur-md space-y-5 animate-pulse-glow">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wider">
                    แผนการเทรดที่ประมวลผลได้ล่าสุด
                  </span>
                  <h3 className="text-2xl font-black text-white mt-1">
                    {generatedPlan.symbol} <span className="text-sm font-normal text-slate-400">({generatedPlan.tradingStyle.toUpperCase()})</span>
                  </h3>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(generatedPlan)}
                    className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-xl cursor-pointer text-slate-400 hover:text-white transition-all"
                    title="คัดลอกแผน"
                  >
                    {copySuccess === "gen" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                  <button
                    onClick={() => handleSendTelegram(generatedPlan)}
                    className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-xl cursor-pointer text-slate-400 hover:text-white transition-all"
                    title="ส่งเข้า Telegram"
                  >
                    {telegramSuccess === "gen" ? <Check size={14} className="text-emerald-400" /> : <Send size={14} />}
                  </button>
                </div>
              </div>

              {/* R:R warning banner */}
              {generatedPlan.riskReward && generatedPlan.riskReward < 1.5 && (
                <div className="bg-amber-950/20 border border-amber-700/30 text-amber-300 text-xs rounded-2xl p-4 flex items-start gap-2.5">
                  <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    ⚠️ **อัตรา Risk/Reward ต่ำกว่า 1:1.5** (อยู่ที่ 1:{generatedPlan.riskReward}) ซึ่งไม่สอดคล้องกับระเบียบวินัยบริหารหน้าตักที่ดี โปรดพิจารณาจังหวะเข้าทำรายการใหม่อย่างระมัดระวัง
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-2xl space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">ทิศทางออเดอร์</span>
                  <span className={`text-base font-black ${
                    generatedPlan.direction === "long" ? "text-emerald-400" : generatedPlan.direction === "short" ? "text-rose-400" : "text-slate-400"
                  }`}>
                    {generatedPlan.direction.toUpperCase()}
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-2xl space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">โซนเข้าซื้อ (Entry)</span>
                  <span className="text-base font-black text-white font-mono">
                    {generatedPlan.entryLow ? `$${generatedPlan.entryLow} - $${generatedPlan.entryHigh}` : "N/A"}
                  </span>
                  {generatedPlan.entryApproach && (
                    <span className="block text-[10px] text-cyan-300 leading-relaxed">{generatedPlan.entryApproach}</span>
                  )}
                  {generatedPlan.vwapContext && (
                    <span className="block text-[10px] text-amber-300 leading-relaxed">{generatedPlan.vwapContext}</span>
                  )}
                </div>

                <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-2xl space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Stop Loss</span>
                  <span className="text-base font-black text-rose-400 font-mono">
                    {generatedPlan.stopLoss ? `$${generatedPlan.stopLoss}` : "N/A"}
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-2xl space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">เป้าหมาย (TP2)</span>
                  <span className="text-base font-black text-emerald-400 font-mono">
                    {generatedPlan.takeProfit2 ? `$${generatedPlan.takeProfit2}` : "N/A"}
                  </span>
                </div>
              </div>

              {generatedPlan.direction !== "wait" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950 border border-slate-850 p-4 rounded-2xl text-xs font-mono">
                  <div>*เป้าหมายเก็บกำไร:* TP1: ${generatedPlan.takeProfit1} | TP3: ${generatedPlan.takeProfit3}</div>
                  <div>*ขนาด Position แนะนำ:* {generatedPlan.positionSize} หุ้น</div>
                  <div>*Risk/Reward:* 1:{generatedPlan.riskReward}</div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">เหตุผลประกอบการตัดสินใจของระบบ</h4>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/80 p-3 rounded-xl border border-slate-850">
                  {generatedPlan.reasoning}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-850">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">เงื่อนไขยกเลิกแผน (Invalidation)</span>
                  <span className="text-rose-300 font-medium">{generatedPlan.invalidation}</span>
                </div>
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-850">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">ระยะเวลาถือครองโดยประมาณ</span>
                  <span className="text-slate-200 font-medium">{generatedPlan.holdingPeriod}</span>
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-3 border-t border-slate-900">
                <span className="text-[10px] text-slate-500 font-medium">
                  อ้างอิงข้อมูล: {generatedPlan.dataSource} • ความมั่นใจ: {generatedPlan.confidence}%
                </span>
                <button
                  onClick={handleSave}
                  className="bg-indigo-650 hover:bg-indigo-750 text-white text-xs font-black uppercase tracking-wider px-6 py-2.5 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={12} /> บันทึกแผนการเทรดนี้
                </button>
              </div>
            </div>
          )}

          {/* 2. List of Saved Plans */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Activity size={16} className="text-indigo-400" /> แผนการเทรดที่บันทึกไว้ ({savedPlans.length})
            </h2>

            {savedPlans.length === 0 ? (
              <div className="bg-slate-900/20 border border-slate-800/80 rounded-3xl p-8 text-center text-slate-500">
                ไม่มีแผนการเทรดที่บันทึกไว้ กรุณากรอกแบบฟอร์มด้านซ้ายเพื่อประเมินและเซฟแผน
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {savedPlans.map((plan) => {
                  const isPos = plan.direction === "long";
                  const isWait = plan.direction === "wait";
                  return (
                    <div
                      key={plan.id}
                      className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4.5 space-y-4 relative flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                              isWait 
                                ? "bg-slate-800 border-slate-600 text-slate-400" 
                                : isPos 
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                            }`}>
                              {plan.direction.toUpperCase()}
                            </span>
                            <h4 className="text-lg font-black text-white mt-1.5 flex items-center gap-1.5 font-mono">
                              {plan.symbol}
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded-md">
                                {plan.tradingStyle}
                              </span>
                            </h4>
                            <CalendarRiskBadge symbol={plan.symbol} />
                          </div>

                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleCopy(plan)}
                              className="p-1.5 bg-slate-950 border border-slate-850 hover:border-slate-700 rounded-lg cursor-pointer text-slate-400 hover:text-white transition-all"
                            >
                              {copySuccess === plan.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                            <button
                              onClick={() => handleSendTelegram(plan)}
                              className="p-1.5 bg-slate-950 border border-slate-850 hover:border-slate-700 rounded-lg cursor-pointer text-slate-400 hover:text-white transition-all"
                            >
                              {telegramSuccess === plan.id ? <Check size={12} className="text-emerald-400" /> : <Send size={12} />}
                            </button>
                            <button
                              onClick={() => plan.id && handleDelete(plan.id)}
                              className="p-1.5 bg-slate-950 border border-slate-850 hover:border-rose-900/50 hover:bg-rose-950/20 rounded-lg cursor-pointer text-slate-400 hover:text-rose-400 transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Interactive Status Selector */}
                        <div className="flex items-center justify-between gap-4 bg-slate-950 border border-slate-850 px-3 py-1.5 rounded-xl">
                          <span className="text-[9px] text-slate-500 font-bold uppercase">สถานะ (Status)</span>
                          <select
                            value={plan.status}
                            onChange={(e) => plan.id && handleUpdateStatus(plan.id, e.target.value as any)}
                            className="bg-transparent text-xs font-bold text-slate-200 border-none outline-none focus:ring-0 cursor-pointer"
                          >
                            <option value="Active">Active</option>
                            <option value="Hit Entry">Hit Entry</option>
                            <option value="TP1 Hit">TP1 Hit</option>
                            <option value="TP2 Hit">TP2 Hit</option>
                            <option value="Stopped Out">Stopped Out</option>
                            <option value="Invalidated">Invalidated</option>
                            <option value="Expired">Expired</option>
                          </select>
                        </div>

                        {!isWait && (
                          <div className="grid grid-cols-3 gap-2 text-[11px] font-mono bg-slate-950/60 p-2.5 rounded-xl border border-slate-850/40">
                            <div>
                              <span className="text-[8px] text-slate-500 uppercase block">Entry</span>
                              <span className="text-white font-bold">${plan.entryLow}</span>
                            </div>
                            <div>
                              <span className="text-[8px] text-slate-500 uppercase block">Stop Loss</span>
                              <span className="text-rose-400 font-bold">${plan.stopLoss}</span>
                            </div>
                            <div>
                              <span className="text-[8px] text-slate-500 uppercase block">Target TP2</span>
                              <span className="text-emerald-400 font-bold">${plan.takeProfit2}</span>
                            </div>
                          </div>
                        )}

                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed bg-slate-950/30 p-2 rounded-lg border border-slate-850/20">
                          {plan.reasoning}
                        </p>
                      </div>

                      <div className="text-[8px] text-slate-500 font-semibold uppercase flex justify-between pt-3 border-t border-slate-850/40 mt-3">
                        <span>มั่นใจ: {plan.confidence}% | RR: 1:{plan.riskReward || 0}</span>
                        <span>{new Date(plan.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
      
      {/* Footer warning */}
      <footer className="border-t border-slate-900 pt-6 text-center text-[10px] text-slate-500 space-y-2 mt-8">
        <div className="flex items-center justify-center gap-1 text-slate-400 font-semibold">
          <HelpCircle size={12} className="text-amber-500" />
          <span>ข้อสงวนสิทธิ์การลงทุนและบริหารหน้าตัก</span>
        </div>
        <p className="max-w-2xl mx-auto leading-relaxed">
          แผนการเทรดนี้ประมวลผลตามระดับเทคนิคคอลและเงื่อนไขตัวคูณความผันผวน ATR เท่านั้น 
          ผู้เทรดจำเป็นต้องพิจารณาภาวะตลาดและปฏิบัติตามวินัย Stop Loss อย่างเคร่งครัด ระบบนี้ไม่ใช่เครื่องมือระดมทุนหรือใบอนุญาตชี้แนะทางการเงินจริง
        </p>
      </footer>
    </div>
  );
}
