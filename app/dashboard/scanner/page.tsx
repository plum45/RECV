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
  Sparkles,
  ExternalLink,
  LogOut,
  CheckCircle2,
  ShieldCheck,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../../contexts/AuthContext";

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
  const { user, getIdToken } = useAuth();
  const [symbol, setSymbol] = useState("BTC-USD");
  const [searchInput, setSearchInput] = useState("");
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Multi-user Telegram Auth & Alert states
  const [telegramStatus, setTelegramStatus] = useState<{
    enabled: boolean;
    chatId: string | null;
    username?: string;
    connectedAt?: number;
  } | null>(null);
  const [telegramAlertSettings, setTelegramAlertSettings] = useState<{
    enabled: boolean;
    symbols: string[];
    rsiEnabled: boolean;
    macdEnabled: boolean;
    srFlipEnabled: boolean;
    supportEnabled: boolean;
    cooldownMinutes: number;
  } | null>(null);
  const [loadingTelegramSettings, setLoadingTelegramSettings] = useState(false);
  const [showAlertConfigModal, setShowAlertConfigModal] = useState(false);
  const [savingAlertConfig, setSavingAlertConfig] = useState(false);

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
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    fetchNearSupport();
    const interval = setInterval(fetchNearSupport, 120 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Alerts configuration states (initialized from localStorage)
  const [lineToken, setLineToken] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("line_notify_token") || "" : ""
  );
  const [lineTargetId, setLineTargetId] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("line_target_id") || "" : ""
  );
  const [tgToken, setTgToken] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("tg_bot_token") || "" : ""
  );
  const [tgChatId, setTgChatId] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("tg_chat_id") || "" : ""
  );
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

  // Alert settings are now initialized via useState lazy initializers above

  // Save settings helpers
  const saveLineSettings = () => {
    localStorage.setItem("line_notify_token", lineToken);
    localStorage.setItem("line_target_id", lineTargetId);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    if (!lineToken.trim() || !lineTargetId.trim()) {
      setAlertStatus({ type: "error", text: "กรุณากรอก LINE Channel Access Token และ User ID" });
      return;
    }
    setTestingLine(true);
    setAlertStatus(null);
    try {
      const res = await axios.post("/api/alerts/test", {
        type: "line",
        token: lineToken,
        targetId: lineTargetId,
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

  const fetchTelegramStatus = async () => {
    if (!user) {
      setTelegramStatus(null);
      setTelegramAlertSettings(null);
      return;
    }
    setLoadingTelegramSettings(true);
    try {
      const token = await getIdToken();
      const res = await axios.get("/api/telegram/settings", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setTelegramStatus(res.data.telegram);
        setTelegramAlertSettings(res.data.alertSettings);
      }
    } catch (err) {
      console.error("Failed to fetch Telegram settings:", err);
    } finally {
      setLoadingTelegramSettings(false);
    }
  };

  useEffect(() => {
    fetchTelegramStatus();
  }, [user]);

  const testTelegramAlert = async () => {
    if (!user) {
      // Fallback if testing without login using local tgToken/tgChatId
      if (!tgToken.trim() || !tgChatId.trim()) {
        setAlertStatus({ type: "error", text: "กรุณาเข้าสู่ระบบ หรือระบุ Bot Token และ Chat ID" });
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
      return;
    }

    setTestingTg(true);
    setAlertStatus(null);
    try {
      const token = await getIdToken();
      const res = await axios.post("/api/telegram/test", {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setAlertStatus({ type: "success", text: "ส่งข้อความทดสอบเข้า Telegram ของคุณสำเร็จ!" });
      } else {
        throw new Error(res.data.message || "Failed");
      }
    } catch (err: any) {
      setAlertStatus({ type: "error", text: `ทดสอบ Telegram ล้มเหลว: ${err.response?.data?.message || err.message}` });
    } finally {
      setTestingTg(false);
    }
  };

  const disconnectTelegram = async () => {
    if (!user) return;
    if (!window.confirm("ต้องการตัดการเชื่อมต่อ Telegram หรือไม่? คุณจะไม่ได้รับแจ้งเตือนอัตโนมัติจนกว่าจะเชื่อมต่อใหม่")) return;
    try {
      const token = await getIdToken();
      const res = await axios.post("/api/telegram/settings", {
        action: "disconnect"
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setTelegramStatus({ enabled: false, chatId: null });
        setAlertStatus({ type: "success", text: "ตัดการเชื่อมต่อ Telegram เรียบร้อยแล้ว" });
      }
    } catch (err: any) {
      setAlertStatus({ type: "error", text: `ตัดการเชื่อมต่อไม่สำเร็จ: ${err.message}` });
    }
  };

  const saveTelegramAlertConfig = async () => {
    if (!user || !telegramAlertSettings) return;
    setSavingAlertConfig(true);
    try {
      const token = await getIdToken();
      const res = await axios.post("/api/telegram/settings", {
        action: "update_alerts",
        alertSettings: telegramAlertSettings
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setTelegramAlertSettings(res.data.alertSettings);
        setAlertStatus({ type: "success", text: "บันทึกเงื่อนไขแจ้งเตือน Telegram สำเร็จ!" });
        setShowAlertConfigModal(false);
      }
    } catch (err: any) {
      setAlertStatus({ type: "error", text: `บันทึกไม่สำเร็จ: ${err.message}` });
    } finally {
      setSavingAlertConfig(false);
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
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)] shrink-0">
            <span>Strong Bullish</span>
            <span className="inline-flex gap-0.5 shrink-0">🟢🟢</span>
          </span>
        );
      case "Bullish":
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 text-xs font-bold rounded-full bg-emerald-500/5 text-emerald-300 border border-emerald-500/20 shrink-0">
            <span>Bullish</span>
            <span className="shrink-0">🟢</span>
          </span>
        );
      case "Bearish":
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 text-xs font-bold rounded-full bg-rose-500/5 text-rose-300 border border-rose-500/20 shrink-0">
            <span>Bearish</span>
            <span className="shrink-0">🔴</span>
          </span>
        );
      case "Strong Bearish":
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 text-xs font-bold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.15)] shrink-0">
            <span>Strong Bearish</span>
            <span className="inline-flex gap-0.5 shrink-0">🔴🔴</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 text-xs font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700/60 shrink-0">
            <span>Neutral</span>
            <span className="shrink-0">🟡</span>
          </span>
        );
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
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${symbol === item.value
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
          เฝ้าระวัง: ใกล้แนวรับสำคัญ (Crypto: 4H, หุ้น: 1D)
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

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-800/80 text-xs text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4 whitespace-nowrap">กรอบเวลา</th>
                      <th className="py-3 px-4 whitespace-nowrap">แนวโน้ม (Bias)</th>
                      <th className="py-3 px-4 whitespace-nowrap">ความแรง (Score)</th>
                      <th className="py-3 px-4 whitespace-nowrap min-w-[150px]">RSI (14)</th>
                      <th className="py-3 px-4 whitespace-nowrap">MACD Crossover</th>
                      <th className="py-3 px-4 whitespace-nowrap">โครงสร้าง (Trend)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanData.results.map((r) => {
                      const timeframeColor = getScoreColor(r.score);
                      return (
                        <tr key={r.timeframe} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors text-sm">
                          <td className="py-3.5 px-4 font-black text-slate-200 whitespace-nowrap align-middle">{r.timeframe}</td>
                          <td className="py-3.5 px-4 whitespace-nowrap align-middle">{getBiasBadge(r.bias)}</td>
                          <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap align-middle">
                            <span className={timeframeColor.text}>{r.score}%</span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-300 w-8">{r.rsi}</span>
                              <div className="w-14 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${r.rsi < 30 ? "bg-amber-400" : r.rsi > 70 ? "bg-rose-500" : "bg-indigo-500"}`}
                                  style={{ width: `${Math.min(100, r.rsi)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                            {r.macdCrossover === "bullish" ? (
                              <span className="text-emerald-400 font-bold text-xs bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 inline-flex items-center gap-1">Bullish 🚀</span>
                            ) : r.macdCrossover === "bearish" ? (
                              <span className="text-rose-400 font-bold text-xs bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20 inline-flex items-center gap-1">Bearish 📉</span>
                            ) : (
                              <span className="text-slate-500 text-xs">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                            <span className={`text-xs uppercase font-bold px-2 py-0.5 rounded ${r.structure === "uptrend" ? "text-emerald-400 bg-emerald-500/10" : r.structure === "downtrend" ? "text-rose-400 bg-rose-500/10" : "text-slate-400 bg-slate-800/50"
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
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${f.type === "support" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
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
                LINE Messaging API
              </h2>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              เชื่อม LINE Official Account เพื่อรับสัญญาณผ่าน Messaging API (LINE Notify ยุติบริการแล้ว)
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
                  Channel Access Token
                </label>
                <input
                  type="password"
                  placeholder="Channel access token..."
                  value={lineToken}
                  onChange={(e) => setLineToken(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
                  LINE User ID
                </label>
                <input
                  type="text"
                  placeholder="เช่น U1234..."
                  value={lineTargetId}
                  onChange={(e) => setLineTargetId(e.target.value)}
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
              ทดลองส่งข้อความ LINE
            </button>
          </div>
        </div>

        {/* Telegram Bot Settings (Multi-User Auto Alert System) */}
        <div className="p-6 bg-slate-900/40 border border-slate-800/60 rounded-2xl shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
                  <Send size={18} />
                </div>
                <h2 className="text-lg font-bold text-slate-100">
                  Telegram Bot Alert (24 ชั่วโมง แม้ปิดเว็บ)
                </h2>
              </div>
              {telegramStatus?.enabled && telegramStatus?.chatId ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 size={12} /> เชื่อมต่อแล้ว
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-slate-800 text-slate-400 border border-slate-700">
                  ⚪ ยังไม่ได้เชื่อมต่อ
                </span>
              )}
            </div>

            {loadingTelegramSettings ? (
              <div className="py-8 flex items-center justify-center gap-2 text-slate-400 text-xs">
                <Loader2 className="animate-spin text-sky-400" size={16} /> กำลังโหลดสถานะ Telegram ของคุณ...
              </div>
            ) : !user ? (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center my-4">
                <p className="text-xs text-slate-300 font-bold mb-1">กรุณาเข้าสู่ระบบ (Log in)</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  เพื่อเชื่อมต่อ Telegram ส่วนบุคคล ระบบจะทำการส่งแจ้งเตือน Confluence & S/R Flip ให้คุณอัตโนมัติตลอด 24 ชั่วโมง โดยไม่ต้องเปิดหน้าเว็บทิ้งไว้
                </p>
              </div>
            ) : telegramStatus?.enabled && telegramStatus?.chatId ? (
              <div className="space-y-4 my-3">
                <div className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">สถานะระบบ:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <ShieldCheck size={14} /> แจ้งเตือน Cloud 24 ชม. ทำงานอยู่
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">บัญชี Telegram:</span>
                    <span className="text-slate-200 font-mono font-bold">
                      {telegramStatus.username ? `@${telegramStatus.username}` : `ID: ${telegramStatus.chatId}`}
                    </span>
                  </div>
                  {telegramAlertSettings && (
                    <div className="flex justify-between text-xs border-t border-slate-900 pt-2">
                      <span className="text-slate-500">เงื่อนไขที่แจ้งเตือน:</span>
                      <span className="text-indigo-400 font-bold">
                        {telegramAlertSettings.symbols.length} สัญลักษณ์ ({telegramAlertSettings.cooldownMinutes} นาที Cooldown)
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => setShowAlertConfigModal(true)}
                    className="flex-1 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <SlidersHorizontal size={14} />
                    ตั้งค่าเงื่อนไขแจ้งเตือน
                  </button>
                  <button
                    onClick={disconnectTelegram}
                    className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    title="ตัดการเชื่อมต่อ Telegram"
                  >
                    <LogOut size={14} />
                    ยกเลิกเชื่อมต่อ
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 my-3">
                <div className="p-4 bg-sky-950/20 border border-sky-500/20 rounded-xl space-y-2.5">
                  <p className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                    <Sparkles size={14} /> วิธีเชื่อมต่อ Telegram Bot อัตโนมัติ:
                  </p>
                  <ol className="text-xs text-slate-300 space-y-1.5 list-decimal pl-4 leading-relaxed">
                    <li>เปิดแอป Telegram และค้นหาบ็อต หรือกดลิงก์เพิ่มบ็อต</li>
                    <li>พิมพ์คำสั่ง <code className="bg-slate-900 px-1.5 py-0.5 rounded text-sky-400 font-mono font-bold">/start</code> ในห้องแช็ตของบ็อต</li>
                    <li>บ็อตจะผูกบัญชีกับระบบ Rocket AI อัตโนมัติทันที และแจ้งเตือนสัญญาณเทรด 24 ชม. แม้ปิดเว็บ</li>
                  </ol>
                  <div className="pt-1">
                    <a
                      href="https://t.me/RocketAiAlertBot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black rounded-lg shadow-lg transition-all"
                    >
                      <span>เปิด Telegram Bot เพื่อเชื่อมต่อ</span>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>

                {/* Fallback manual input for testing */}
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer hover:text-slate-400 font-semibold py-1">
                    ตัวเลือกเสริม: ทดสอบด้วย Custom Bot Token & Chat ID ชั่วคราว (แบบ Manual)
                  </summary>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 pt-2 border-t border-slate-800">
                    <div>
                      <input
                        type="password"
                        placeholder="Bot Token..."
                        value={tgToken}
                        onChange={(e) => setTgToken(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 text-xs"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Chat ID..."
                        value={tgChatId}
                        onChange={(e) => setTgChatId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 text-xs"
                      />
                    </div>
                  </div>
                </details>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap justify-between items-center gap-3 pt-4 border-t border-slate-800/40">
            <button
              onClick={testTelegramAlert}
              disabled={testingTg || (!user && (!tgToken.trim() || !tgChatId.trim()))}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-[0_0_15px_rgba(14,165,233,0.2)]"
            >
              {testingTg ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
              ทดลองส่งข้อความ Telegram
            </button>
            {user && telegramStatus?.enabled && (
              <span className="text-[11px] text-slate-500 font-medium">
                * ระบบตรวจสอบความเคลื่อนไหวทุกชั่วโมงบน Cloud
              </span>
            )}
          </div>
        </div>

      </section>

      {/* Info Notice card */}
      <section className="mt-6 p-5 bg-indigo-950/20 border border-indigo-900/30 rounded-2xl flex items-start gap-4">
        <Info className="text-indigo-400 shrink-0 mt-0.5" size={20} />
        <div>
          <h3 className="text-sm font-bold text-slate-200">
            ระบบแจ้งเตือนอัตโนมัติ 24 ชั่วโมง (Multi-User Cloud Alert)
          </h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            ผู้ใช้แต่ละท่านสามารถเชื่อมต่อ Telegram ได้อย่างเป็นส่วนตัวผ่านบัญชี Firebase Auth ระบบจะรัน Cron Job บน Render (<code className="text-indigo-300 font-mono">app/api/alerts/trigger</code>) เพื่อสแกนตลาดทุกชั่วโมงและแจ้งเตือนเข้าห้องแช็ต Telegram ของคุณทันทีเมื่อพบคอนฟลูเอนซ์สำคัญ ไม่ต้องเปิดหน้าเว็บทิ้งไว้
          </p>
        </div>
      </section>

      {/* Alert Config Modal */}
      <AnimatePresence>
        {showAlertConfigModal && telegramAlertSettings && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                  <SlidersHorizontal size={18} className="text-indigo-400" />
                  ตั้งค่าเงื่อนไขแจ้งเตือน Telegram
                </h3>
                <button
                  onClick={() => setShowAlertConfigModal(false)}
                  className="text-slate-400 hover:text-slate-200 text-sm font-bold px-2 py-1"
                >
                  ✕
                </button>
              </div>

              {/* Toggle Master */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-200">เปิดใช้งานแจ้งเตือน (Master Switch)</div>
                  <div className="text-[11px] text-slate-500">รับหรือหยุดชั่วคราวสำหรับทุกข้อความแจ้งเตือน</div>
                </div>
                <button
                  onClick={() => setTelegramAlertSettings({ ...telegramAlertSettings, enabled: !telegramAlertSettings.enabled })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                    telegramAlertSettings.enabled ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {telegramAlertSettings.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  {telegramAlertSettings.enabled ? "เปิดอยู่" : "ปิด"}
                </button>
              </div>

              {/* Symbols */}
              <div>
                <label className="text-xs text-slate-400 font-bold block mb-2">สัญลักษณ์ที่เฝ้าระวัง (Symbols)</label>
                <div className="flex flex-wrap gap-2">
                  {["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "NVDA", "TSLA", "AAPL", "MSFT"].map((sym) => {
                    const isSelected = telegramAlertSettings.symbols.includes(sym);
                    return (
                      <button
                        key={sym}
                        onClick={() => {
                          const updated = isSelected
                            ? telegramAlertSettings.symbols.filter((s) => s !== sym)
                            : [...telegramAlertSettings.symbols, sym];
                          setTelegramAlertSettings({ ...telegramAlertSettings, symbols: updated });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {sym} {isSelected ? "✓" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conditions */}
              <div className="space-y-3 border-t border-slate-800/80 pt-4">
                <label className="text-xs text-slate-400 font-bold block">ตัวกรองสัญญาณเทคนิค (Technical Filters)</label>

                {[
                  { key: "rsiEnabled", label: "RSI สุดโต่ง (Overbought ≥ 70 / Oversold ≤ 30)", desc: "แจ้งเตือนเมื่อภาวะซื้อหรือขายมากเกินไปในกรอบ 4H / 1D" },
                  { key: "macdEnabled", label: "MACD Crossover", desc: "แจ้งเตือนเมื่อเส้น MACD ตัด Signal Line ขึ้นหรือลงในกรอบใหญ่" },
                  { key: "srFlipEnabled", label: "S/R Flip (เปลี่ยนแนวต้านเป็นแนวรับ / แนวรับเป็นต้าน)", desc: "แจ้งเตือนเมื่อราคาทะลุและย่อกลับมาทดสอบแนวสำคัญพอดี" },
                  { key: "supportEnabled", label: "เข้าใกล้โซนแนวรับ/แนวต้าน (Support & Resistance Zone)", desc: "แจ้งเตือนเมื่อราคาเข้าใกล้กรอบที่ระบบวิเคราะห์ไว้ ≤ 1.5%" },
                ].map((item) => {
                  const val = (telegramAlertSettings as any)[item.key];
                  return (
                    <div key={item.key} className="flex items-start justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800/60">
                      <div className="pr-2">
                        <div className="text-xs font-bold text-slate-200">{item.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{item.desc}</div>
                      </div>
                      <button
                        onClick={() => setTelegramAlertSettings({ ...telegramAlertSettings, [item.key]: !val })}
                        className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-bold ${
                          val ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "bg-slate-800 text-slate-500"
                        }`}
                      >
                        {val ? "เปิด" : "ปิด"}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Cooldown */}
              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">ระยะเวลาพักแจ้งเตือนซ้ำ (Cooldown - นาที)</label>
                <div className="flex gap-2">
                  {[60, 120, 240, 360].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setTelegramAlertSettings({ ...telegramAlertSettings, cooldownMinutes: mins })}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${
                        telegramAlertSettings.cooldownMinutes === mins
                          ? "bg-indigo-600 text-white border-indigo-500"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {mins / 60} ชั่วโมง ({mins} น.)
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setShowAlertConfigModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={saveTelegramAlertConfig}
                  disabled={savingAlertConfig}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-lg shadow-indigo-500/25"
                >
                  {savingAlertConfig ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                  บันทึกการตั้งค่า
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Status Toast */}
      <AnimatePresence>
        {alertStatus && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-20 right-6 z-[100] px-4 py-3 rounded-xl border text-sm font-bold shadow-lg flex items-center gap-2 ${alertStatus.type === "success"
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
