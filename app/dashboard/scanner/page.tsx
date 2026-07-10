"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Settings, 
  AlertTriangle, 
  Zap, 
  Check, 
  Send, 
  Bell, 
  Loader2, 
  Activity, 
  Info,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TimeframeResult {
  timeframe: string;
  score: number;
  bias: "Strong Bullish" | "Bullish" | "Neutral" | "Bearish" | "Strong Bearish";
  rsi: number;
  macdCrossover: "bullish" | "bearish" | "none";
  emaTrend: "bullish" | "bearish";
  structure: "uptrend" | "downtrend" | "sideways";
  closestSupport: { zone: string; score: number; reasons: string[] } | null;
  closestResistance: { zone: string; score: number; reasons: string[] } | null;
  srFlips: { zone: string; type: string; reasons: string[] }[];
}

interface ScanData {
  symbol: string;
  currentPrice: number;
  change24h: number;
  high24h: number;
  low24h: number;
  overallScore: number;
  results: TimeframeResult[];
  aiSummary: string;
  updatedAt: string;
}

export default function ScannerPage() {
  const [symbol, setSymbol] = useState("BTC-USD");
  const [searchInput, setSearchInput] = useState("");
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // States for assets near support
  const [nearSupportData, setNearSupportData] = useState<any[]>([]);
  const [loadingSupport, setLoadingSupport] = useState(true);

  // Fetch near support assets based on Watchlist
  const fetchNearSupport = async () => {
    setLoadingSupport(true);
    try {
      let symbolsToScan = ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "NVDA", "AAPL", "TSLA", "MSFT"];
      if (typeof window !== "undefined") {
        const savedWatchlist = localStorage.getItem("rocket_watchlist");
        if (savedWatchlist) {
          const parsed = JSON.parse(savedWatchlist);
          if (Array.isArray(parsed) && parsed.length > 0) {
            symbolsToScan = parsed;
          }
        }
      }
      const response = await axios.post("/api/scanner/near-support", {
        symbols: symbolsToScan
      });
      setNearSupportData(response.data);
    } catch (err) {
      console.error("Failed to fetch near support assets:", err);
    } finally {
      setLoadingSupport(false);
    }
  };

  useEffect(() => {
    fetchNearSupport();
    const interval = setInterval(fetchNearSupport, 120 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Alerts configuration states (saved in localStorage)
  const [lineToken, setLineToken] = useState("");
  const [tgToken, setTgToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [testingLine, setTestingLine] = useState(false);
  const [testingTg, setTestingTg] = useState(false);
  const [alertStatus, setAlertStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Predefined popular symbols
  const popularSymbols = [
    { label: "Bitcoin", value: "BTC-USD" },
    { label: "Ethereum", value: "ETH-USD" },
    { label: "Solana", value: "SOL-USD" },
    { label: "NVIDIA", value: "NVDA" },
    { label: "Tesla", value: "TSLA" },
    { label: "Apple", value: "AAPL" },
  ];

  // Load alert settings from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      setLineToken(localStorage.getItem("line_notify_token") || "");
      setTgToken(localStorage.getItem("tg_bot_token") || "");
      setTgChatId(localStorage.getItem("tg_chat_id") || "");
    }
  }, []);

  // Save settings helpers
  const saveLineSettings = () => {
    localStorage.setItem("line_notify_token", lineToken);
    setAlertStatus({ type: "success", text: "บันทึก Line Notify Token สำเร็จ!" });
    setTimeout(() => setAlertStatus(null), 3000);
  };

  const saveTgSettings = () => {
    localStorage.setItem("tg_bot_token", tgToken);
    localStorage.setItem("tg_chat_id", tgChatId);
    setAlertStatus({ type: "success", text: "บันทึก Telegram Bot Settings สำเร็จ!" });
    setTimeout(() => setAlertStatus(null), 3000);
  };

  // Perform Scan function
  const performScan = async (targetSymbol: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await axios.post("/api/scanner", { symbol: targetSymbol });
      setScanData(response.data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("ไม่สามารถดึงข้อมูลสแกนเนอร์ได้ กรุณาตรวจสอบสัญลักษณ์หรือลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    performScan(symbol);
  }, [symbol]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    const cleanSym = searchInput.trim().toUpperCase();
    setSymbol(cleanSym);
    setSearchInput("");
  };

  // Test Alerts helpers
  const testLineAlert = async () => {
    if (!lineToken.trim()) {
      setAlertStatus({ type: "error", text: "กรุณากรอก Line Notify Token" });
      return;
    }
    setTestingLine(true);
    setAlertStatus(null);
    try {
      const res = await axios.post("/api/alerts/test", {
        type: "line",
        token: lineToken,
      });
      if (res.data.success) {
        setAlertStatus({ type: "success", text: "ส่งข้อความทดสอบเข้า Line สำเร็จ!" });
      } else {
        throw new Error(res.data.error || "Failed");
      }
    } catch (err: any) {
      setAlertStatus({ type: "error", text: `ทดสอบ Line ล้มเหลว: ${err.message}` });
    } finally {
      setTestingLine(false);
    }
  };

  const testTelegramAlert = async () => {
    if (!tgToken.trim() || !tgChatId.trim()) {
      setAlertStatus({ type: "error", text: "กรุณากรอก Bot Token และ Chat ID" });
      return;
    }
    setTestingTg(true);
    setAlertStatus(null);
    try {
      const res = await axios.post("/api/alerts/test", {
        type: "telegram",
        token: tgToken,
        chatId: tgChatId,
      });
      if (res.data.success) {
        setAlertStatus({ type: "success", text: "ส่งข้อความทดสอบเข้า Telegram สำเร็จ!" });
      } else {
        throw new Error(res.data.error || "Failed");
      }
    } catch (err: any) {
      setAlertStatus({ type: "error", text: `ทดสอบ Telegram ล้มเหลว: ${err.message}` });
    } finally {
      setTestingTg(false);
    }
  };

  // Score styling helper
  const getScoreColor = (score: number) => {
    if (score >= 70) return { border: "border-emerald-500/30", text: "text-emerald-400", bg: "bg-emerald-400/10", shadow: "shadow-emerald-500/20" };
    if (score >= 55) return { border: "border-teal-500/30", text: "text-teal-400", bg: "bg-teal-400/10", shadow: "shadow-teal-500/20" };
    if (score >= 45) return { border: "border-slate-500/30", text: "text-slate-400", bg: "bg-slate-400/10", shadow: "shadow-slate-500/20" };
    if (score >= 30) return { border: "border-rose-500/30", text: "text-rose-400", bg: "bg-rose-400/10", shadow: "shadow-rose-500/20" };
    return { border: "border-red-500/30", text: "text-red-400", bg: "bg-red-400/10", shadow: "shadow-red-500/20" };
  };

  const getBiasBadge = (bias: string) => {
    switch (bias) {
      case "Strong Bullish":
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">Strong Bullish 🟢🟢</span>;
      case "Bullish":
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-500/5 text-emerald-300 border border-emerald-500/10">Bullish 🟢</span>;
      case "Bearish":
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-500/5 text-rose-300 border border-rose-500/10">Bearish 🔴</span>;
      case "Strong Bearish":
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]">Strong Bearish 🔴🔴</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700/50">Neutral 🟡</span>;
    }
  };

  const currentMeta = getScoreColor(scanData?.overallScore || 50);

  return (
    <div className="flex flex-col min-h-screen bg-[#090d16] text-slate-200 p-4 lg:p-6 pb-24">
      {/* Header and Ticker Picker */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-100 flex items-center gap-2 tracking-tight">
            <Zap className="text-indigo-400" size={24} />
            สแกนเนอร์สัญญาณร่วม (Confluence Scanner)
          </h1>
          <p className="text-xs lg:text-sm text-slate-400 mt-1">
            ตรวจจับสัญญาณเทคนิคคัลข้าม 5 กรอบเวลาพร้อมวิเคราะห์ฉันทามติความน่าจะเป็น
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="ค้นหาสัญลักษณ์ เช่น ETH-USD, TSLA..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800/80 focus:border-indigo-500/50 text-slate-200 text-sm rounded-full pl-10 pr-4 py-2.5 focus:outline-none transition-all uppercase"
          />
        </form>
      </header>

      {/* Popular Assets bar */}
      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider mr-2">สินทรัพย์ยอดนิยม:</span>
        {popularSymbols.map((item) => (
          <button
            key={item.value}
            onClick={() => setSymbol(item.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              symbol === item.value
                ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                : "bg-slate-900/40 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
          >
            {item.label} ({item.value})
          </button>
        ))}
      </div>

      {/* Assets Approaching Support Section */}
      <section className="mb-8 relative z-20">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <Activity size={14} className="text-emerald-400 animate-pulse" />
          เฝ้าระวัง: ใกล้แนวรับสำคัญ (1H Timeframe)
        </h2>
        {loadingSupport ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-24 bg-slate-900/40 border border-slate-800/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : nearSupportData.length === 0 ? (
          <div className="p-4 bg-slate-900/20 border border-slate-800/40 rounded-xl text-center text-slate-500 text-xs">
            ไม่พบคอนฟลูเอนซ์ระดับราคาใกล้แนวรับในขอบเขตเฝ้าระวัง
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {nearSupportData.map((asset) => {
              const isNear = asset.status === "near";
              const isBroken = asset.status === "broken";
              const isUp = asset.change24h >= 0;
              
              let cardBg = "bg-slate-900/30 border-slate-800/60 hover:border-slate-700/60 hover:bg-slate-800/10 text-slate-400";
              let badgeColor = "bg-slate-800/60 text-slate-500";
              let badgeText = "ปกติ";
              
              if (isNear) {
                cardBg = "bg-emerald-950/20 border-emerald-500/20 hover:border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.03)]";
                badgeColor = "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20";
                badgeText = "ใกล้แนวรับ 🟢";
              } else if (isBroken) {
                cardBg = "bg-rose-950/20 border-rose-500/25 hover:border-rose-500/45 text-rose-300";
                badgeColor = "bg-rose-500/15 text-rose-400 border border-rose-500/20";
                badgeText = "หลุดแนวรับ 🔴";
              }

              const formattedPrice = asset.currentPrice >= 1.0 
                ? asset.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : asset.currentPrice.toFixed(4);

              const formattedSupport = asset.supportPrice >= 1.0
                ? asset.supportPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })
                : asset.supportPrice.toFixed(4);

              return (
                <button
                  key={asset.symbol}
                  onClick={() => setSymbol(asset.symbol)}
                  className={`p-3.5 border rounded-xl flex flex-col justify-between text-left transition-all duration-300 hover:translate-y-[-2px] cursor-pointer ${cardBg}`}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="font-black text-xs text-slate-200 tracking-tight">{asset.symbol.split("-")[0]}</span>
                    <span className={`text-[9px] font-bold ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                      {isUp ? "+" : ""}{asset.change24h.toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="my-2">
                    <div className="text-sm font-black font-mono text-slate-100">
                      ${formattedPrice}
                    </div>
                    {asset.closestSupport && (
                      <div className="text-[9px] text-slate-500 font-bold mt-0.5 truncate">
                        รับ: ${formattedSupport}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center w-full mt-0.5">
                    <span className="text-[9px] font-black font-mono text-slate-400">
                      {asset.distancePercent > 0 ? "+" : ""}{asset.distancePercent.toFixed(1)}%
                    </span>
                    <span className={`text-[8px] font-bold px-1 py-0.5 rounded leading-none ${badgeColor}`}>
                      {badgeText}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {errorMsg && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl flex items-center gap-2">
          <AlertTriangle size={18} />
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-indigo-500 mb-4" size={48} />
          <p className="text-slate-400 text-sm">กำลังสแกนสัญญาณเทคนิคคัลข้ามกรอบเวลา...</p>
        </div>
      ) : scanData ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT/MAIN: Score & AI Analysis */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            
            {/* Score Card */}
            <div className={`p-6 bg-slate-900/40 backdrop-blur-md rounded-2xl border ${currentMeta.border} shadow-lg relative overflow-hidden flex flex-col items-center justify-center text-center h-[260px]`}>
              <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
              
              <h2 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">
                ฉันทามติทิศทางรวม (Consensus)
              </h2>

              <div className="relative w-32 h-32 flex items-center justify-center mb-3">
                {/* SVG Ring */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="54"
                    className="stroke-slate-800"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <motion.circle
                    cx="64"
                    cy="64"
                    r="54"
                    className={`stroke-current ${currentMeta.text}`}
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={339.2}
                    initial={{ strokeDashoffset: 339.2 }}
                    animate={{ strokeDashoffset: 339.2 - (339.2 * scanData.overallScore) / 100 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </svg>
                {/* Score Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-black ${currentMeta.text}`}>
                    {scanData.overallScore}%
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">
                    Bullish
                  </span>
                </div>
              </div>

              <div className="mt-1">
                <span className="text-sm font-bold text-slate-300">
                  {scanData.symbol} ณ ราคา ${scanData.currentPrice.toLocaleString()}
                </span>
                <span className={`text-xs ml-2 font-bold ${scanData.change24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  ({scanData.change24h >= 0 ? "+" : ""}{scanData.change24h.toFixed(2)}%)
                </span>
              </div>
            </div>

            {/* AI Summary Card */}
            <div className="p-6 bg-gradient-to-tr from-slate-900/60 to-slate-900/30 border border-slate-800/80 rounded-2xl shadow-lg relative overflow-hidden flex-1 flex flex-col">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <Sparkles size={60} className="text-indigo-400" />
              </div>
              <h2 className="text-md font-bold text-slate-100 flex items-center gap-2 mb-4">
                <Sparkles size={16} className="text-indigo-400 animate-pulse" />
                บทวิเคราะห์ความสอดคล้อง AI
              </h2>
              <div className="flex-1 flex flex-col justify-between">
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line italic">
                  "{scanData.aiSummary}"
                </p>
                <div className="mt-6 pt-4 border-t border-slate-800/60 flex justify-between items-center text-xs text-slate-500">
                  <span>ประมวลผลด้วย GPT-4o-mini</span>
                  <span>อัปเดต: {new Date(scanData.updatedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT: Confluence Matrix */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Table Matrix */}
            <div className="p-6 bg-slate-900/30 border border-slate-800/60 rounded-2xl shadow-xl overflow-hidden">
              <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                <Activity size={18} className="text-indigo-400" />
                ตารางสัญญาณร่วม 5 กรอบเวลา (Confluence Matrix)
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 text-xs text-slate-500 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">กรอบเวลา</th>
                      <th className="py-3 px-4">แนวโน้ม (Bias)</th>
                      <th className="py-3 px-4">ความแรง (Score)</th>
                      <th className="py-3 px-4">RSI (14)</th>
                      <th className="py-3 px-4">MACD Crossover</th>
                      <th className="py-3 px-4">โครงสร้าง (Trend)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanData.results.map((r) => {
                      const timeframeColor = getScoreColor(r.score);
                      return (
                        <tr key={r.timeframe} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors text-sm">
                          <td className="py-3.5 px-4 font-black text-slate-300">{r.timeframe}</td>
                          <td className="py-3.5 px-4">{getBiasBadge(r.bias)}</td>
                          <td className="py-3.5 px-4 font-mono font-bold">
                            <span className={timeframeColor.text}>{r.score}%</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-300">{r.rsi}</span>
                              <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${r.rsi < 30 ? "bg-amber-400" : r.rsi > 70 ? "bg-rose-500" : "bg-indigo-500"}`}
                                  style={{ width: `${Math.min(100, r.rsi)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {r.macdCrossover === "bullish" ? (
                              <span className="text-emerald-400 font-bold text-xs bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Bullish 🚀</span>
                            ) : r.macdCrossover === "bearish" ? (
                              <span className="text-rose-400 font-bold text-xs bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">Bearish 📉</span>
                            ) : (
                              <span className="text-slate-500 text-xs">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`text-xs uppercase font-bold ${
                              r.structure === "uptrend" ? "text-emerald-400" : r.structure === "downtrend" ? "text-rose-400" : "text-slate-400"
                            }`}>
                              {r.structure}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Support/Resistance Flip Zones Card */}
            <div className="p-6 bg-slate-900/30 border border-slate-800/60 rounded-2xl shadow-xl">
              <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                <Info size={18} className="text-amber-400" />
                โซนกลับบทบาทแนวรับ-แนวต้านสำคัญ (S/R Flip Zones)
              </h2>
              
              {/* Extract all S/R Flips across all timeframes */}
              {(() => {
                const allFlips: { timeframe: string; zone: string; type: string; reasons: string[] }[] = [];
                scanData.results.forEach((r) => {
                  r.srFlips.forEach((f) => {
                    allFlips.push({ timeframe: r.timeframe, ...f });
                  });
                });

                if (allFlips.length === 0) {
                  return (
                    <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800/80 text-center text-slate-500 text-sm">
                      ไม่พบประวัติการเกิด S/R Flip ที่มีนัยสำคัญจากการตรวจจับชุดราคาย้อนหลังในขณะนี้
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allFlips.slice(0, 4).map((f, i) => (
                      <div key={i} className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col justify-between hover:border-slate-700/80 transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold uppercase px-2 py-0.5 bg-slate-800 text-slate-400 rounded">
                            กรอบเวลา {f.timeframe}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            f.type === "support" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                          }`}>
                            {f.type === "support" ? "กลายเป็นแนวรับ" : "กลายเป็นแนวต้าน"}
                          </span>
                        </div>
                        <div className="text-lg font-mono font-bold text-slate-200 mt-1">
                          $ {f.zone}
                        </div>
                        <div className="text-xs text-amber-400/90 font-medium mt-2 flex items-center gap-1">
                          <Check size={12} />
                          {f.reasons.find(r => r.includes("Flip")) || "ตรวจพบลักษณะราคาเปลี่ยนบทบาท"}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

          </div>

        </div>
      ) : null}

      {/* ALERT CONFIGURATION SECTION */}
      <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Line Notify Settings */}
        <div className="p-6 bg-slate-900/40 border border-slate-800/60 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Bell size={18} />
              </div>
              <h2 className="text-lg font-bold text-slate-100">
                Line Notify Alert Settings
              </h2>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              กรอก LINE Notify Token เพื่อเปิดการใช้งานแจ้งเตือนแผนเทรดและจุดกลับตัวทาง Line ทันทีที่เกิดสัญญาณในกราฟรายชั่วโมง
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
                  LINE Notify Access Token
                </label>
                <input
                  type="password"
                  placeholder="Paste your LINE Token here..."
                  value={lineToken}
                  onChange={(e) => setLineToken(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 pt-4 border-t border-slate-800/40">
            <button
              onClick={saveLineSettings}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors"
            >
              บันทึกการตั้งค่า
            </button>
            <button
              onClick={testLineAlert}
              disabled={testingLine}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-50 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
            >
              {testingLine ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
              ทดลองส่งข้อความ Line
            </button>
          </div>
        </div>

        {/* Telegram Bot Settings */}
        <div className="p-6 bg-slate-900/40 border border-slate-800/60 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
                <Send size={18} />
              </div>
              <h2 className="text-lg font-bold text-slate-100">
                Telegram Bot Alert Settings
              </h2>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              เชื่อมโยงบ็อตเข้ากับห้องแช็ต Telegram เพื่อส่งแผนเทรดวิเคราะห์ AI รายชั่วโมง
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
                    Telegram Bot Token
                  </label>
                  <input
                    type="password"
                    placeholder="e.g. 123456:ABC-DEF..."
                    value={tgToken}
                    onChange={(e) => setTgToken(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
                    Telegram Chat ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. -1001234567"
                    value={tgChatId}
                    onChange={(e) => setTgChatId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 pt-4 border-t border-slate-800/40">
            <button
              onClick={saveTgSettings}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors"
            >
              บันทึกการตั้งค่า
            </button>
            <button
              onClick={testTelegramAlert}
              disabled={testingTg}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-50 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
            >
              {testingTg ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
              ทดลองส่งข้อความ Telegram
            </button>
          </div>
        </div>

      </section>

      {/* Info Notice card */}
      <section className="mt-6 p-5 bg-indigo-950/20 border border-indigo-900/30 rounded-2xl flex items-start gap-4">
        <Info className="text-indigo-400 shrink-0 mt-0.5" size={20} />
        <div>
          <h3 className="text-sm font-bold text-slate-200">
            คำแนะนำสำหรับการแจ้งเตือนอัตโนมัติ 24 ชั่วโมง
          </h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            การกรอกข้อมูลและทดสอบในหน้านี้จะเก็บข้อมูลไว้ที่เครื่องของคุณชั่วคราวเพื่อวัตถุประสงค์ในการทดลอง
            หากต้องการให้เซิร์ฟเวอร์รันระบบแจ้งเตือนแบบออฟไลน์ตลอด 24 ชั่วโมง 
            ให้คุณนำค่าโทเค็นไปตั้งค่าเป็น **Environment Variables** บน Render Dashboard ได้แก่: 
            <code className="text-indigo-300 font-mono mx-1">LINE_NOTIFY_TOKEN</code>, 
            <code className="text-indigo-300 font-mono mx-1">TELEGRAM_BOT_TOKEN</code>, และ 
            <code className="text-indigo-300 font-mono mx-1">TELEGRAM_CHAT_ID</code>
          </p>
        </div>
      </section>

      {/* Global Status Toast */}
      <AnimatePresence>
        {alertStatus && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-20 right-6 z-[100] px-4 py-3 rounded-xl border text-sm font-bold shadow-lg flex items-center gap-2 ${
              alertStatus.type === "success" 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            }`}
          >
            {alertStatus.type === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}
            {alertStatus.text}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
