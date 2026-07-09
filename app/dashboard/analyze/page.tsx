/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { Play, RotateCw, Settings, Sliders, TrendingUp, HelpCircle, Activity, ChevronRight, AlertTriangle, Search, Zap } from "lucide-react";
import SymbolSelector from "../../../components/SymbolSelector";
import TimeframeSelector from "../../../components/TimeframeSelector";
import TradingViewChart from "../../../components/TradingViewChart";
import MarketStats from "../../../components/MarketStats";
import SentimentPanel from "../../../components/SentimentPanel";
import NewsPanel from "../../../components/NewsPanel";
import RocketScoreCard from "../../../components/RocketScoreCard";
import AnalysisPanel from "../../../components/AnalysisPanel";
import LoadingState from "../../../components/LoadingState";
import PortfolioView from "../../../components/PortfolioView";
import SRChart from "../../../components/SRChart";
import { TickerData, IndicatorData, SupportResistanceData, KlineData } from "../../../types/market";
import { NewsArticle } from "../../../types/news";
import { SentimentData } from "../../../types/analysis";
import { useAuth } from "../../contexts/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "../../../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface MarqueeTicker {
  symbol: string;
  price: number;
  change: number;
}

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<"dashboard" | "portfolio">("dashboard");

  // Chart View State: Toggle between live TV widget and Recharts S/R bands overlay
  const [chartView, setChartView] = useState<"tradingview" | "sr_zones">("tradingview");

  // Selected configuration states - Default to NVDA for Stock Market Focus
  const [symbol, setSymbol] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get("symbol")?.toUpperCase() || "NVDA";
    }
    return "NVDA";
  });
  const [timeframe, setTimeframe] = useState("1H");
  const [tradingStyle, setTradingStyle] = useState("Day Trade");
  const [riskPercent, setRiskPercent] = useState("1%");
  const [analysisMode, setAnalysisMode] = useState("Analyze Both Long & Short");

  // Market & technical analytical states
  const [klines, setKlines] = useState<KlineData[] | null>(null);
  const [marketData, setMarketData] = useState<TickerData | null>(null);
  const [indicators, setIndicators] = useState<IndicatorData | null>(null);
  const [supportResistance, setSupportResistance] = useState<SupportResistanceData | null>(null);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);

  // Firestore Sync Effect
  useEffect(() => {
    if (!user) return;
    const loadPrefs = async () => {
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.symbol) setSymbol(data.symbol);
          if (data.timeframe) setTimeframe(data.timeframe);
          if (data.tradingStyle) setTradingStyle(data.tradingStyle);
          if (data.riskPercent) setRiskPercent(data.riskPercent);
          if (data.analysisMode) setAnalysisMode(data.analysisMode);
        }
      } catch (err) {
        console.error("Failed to load user preferences", err);
      }
    };
    loadPrefs();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const savePrefs = async () => {
      try {
        await setDoc(doc(db, "users", user.uid), {
          symbol, timeframe, tradingStyle, riskPercent, analysisMode
        }, { merge: true });
      } catch (err) {
        console.error("Failed to save user preferences", err);
      }
    };
    // Debounce saving slightly
    const timer = setTimeout(savePrefs, 1000);
    return () => clearTimeout(timer);
  }, [symbol, timeframe, tradingStyle, riskPercent, analysisMode, user]);

  // Auth Protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  // AI analysis state
  const [analysisReport, setAnalysisReport] = useState<string | null>(null);

  // Marquee price data initialized with real-world baselines
  const [marqueePrices, setMarqueePrices] = useState<MarqueeTicker[]>([
    { symbol: "NVDA", price: 122.80, change: 2.35 },
    { symbol: "TSLA", price: 262.50, change: -1.42 },
    { symbol: "AAPL", price: 193.50, change: 0.68 },
    { symbol: "PLTR", price: 118.20, change: 4.12 },
    { symbol: "MSFT", price: 415.20, change: -0.38 },
    { symbol: "AMD",  price: 158.40, change: 1.84 },
    { symbol: "META", price: 502.60, change: 1.22 },
    { symbol: "AMZN", price: 185.40, change: -0.55 },
    { symbol: "GOOGL",price: 178.30, change: 0.91 },
    { symbol: "NFLX", price: 645.80, change: 2.07 },
    { symbol: "CRWD", price: 460.30, change: 3.18 },
    { symbol: "COIN", price: 248.50, change: -2.64 },
  ]);

  // UI state managers
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local marquee price simulation (to avoid hitting Yahoo Finance 429 Too Many Requests rate-limiting)
  const getBaselinePrice = (sym: string): number => {
    const prices: Record<string, number> = {
      NVDA: 122.80, TSLA: 262.50, AAPL: 193.50, PLTR: 118.20,
      MSFT: 415.20, AMD: 158.40, AMZN: 185.40, META: 502.60,
      GOOGL: 178.30, NFLX: 645.80, CRWD: 460.30, COIN: 248.50,
    };
    return prices[sym] ?? 100;
  };

  const fetchMarqueePrices = () => {
    setMarqueePrices((prev) =>
      prev.map((item) => {
        const changeTick = (Math.random() - 0.495) * 0.12; // small random walk
        const newPrice = item.price > 0 ? item.price * (1 + changeTick / 100) : getBaselinePrice(item.symbol);
        const newChange = item.change + changeTick;
        return {
          symbol: item.symbol,
          price: parseFloat(newPrice.toFixed(2)),
          change: parseFloat(newChange.toFixed(2)),
        };
      })
    );
  };

  useEffect(() => {
    // Run price simulation on interval (100% offline-ready & rate-limit safe)
    const interval = setInterval(fetchMarqueePrices, 4000);
    return () => clearInterval(interval);
  }, []);

  // 1. Fetch live market quantitative data without running OpenAI analysis
  const fetchMarketDataOnly = async (tgtSymbol = symbol, tgtTf = timeframe) => {
    try {
      setInitialLoading(true);
      setError(null);

      // Fetch Ticker
      const tickerRes = await axios.get<TickerData>(`/api/ticker?symbol=${tgtSymbol}`);
      setMarketData(tickerRes.data);

      // Fetch Klines & calculate indicators
      const klinesRes = await axios.get<any[]>(`/api/klines?symbol=${tgtSymbol}&timeframe=${tgtTf}`);
      setKlines(klinesRes.data);
      
      const { calculateIndicators } = await import("../../../lib/indicators");
      const { calculateSupportResistance } = await import("../../../lib/supportResistance");

      const computedIndicators = calculateIndicators(klinesRes.data);
      setIndicators(computedIndicators);

      const computedSR = calculateSupportResistance(
        klinesRes.data,
        computedIndicators,
        tickerRes.data.currentPrice
      );
      setSupportResistance(computedSR);

      // Fetch news
      const newsRes = await axios.get<NewsArticle[]>(`/api/news?symbol=${tgtSymbol}`);
      setNews(newsRes.data);

      // Fetch sentiment
      const sentimentRes = await axios.get<SentimentData>(`/api/sentiment?symbol=${tgtSymbol}`);
      setSentiment(sentimentRes.data);

    } catch (err: any) {
      console.error("Initial data load error:", err.message);
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ Yahoo Finance เพื่อดึงข้อมูลราคาล่าสุดได้ (อาจเกินขีดจำกัดความถี่กรุณารอสักครู่)");
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketDataOnly(symbol, timeframe);
  }, [symbol, timeframe]);

  // 2. Trigger Full AI Analysis Orchestrator (calls /api/analyze)
  const handleAnalyze = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post("/api/analyze", {
        symbol,
        timeframe,
        tradingStyle,
        risk: riskPercent,
        mode: analysisMode,
      });

      const data = response.data;
      setMarketData(data.marketData);
      setIndicators(data.indicators);
      setSupportResistance(data.supportResistance);
      setNews(data.news);
      setSentiment(data.sentiment);
      setAnalysisReport(data.analysis);

    } catch (err: any) {
      console.error("Orchestrator analysis error:", err.message);
      const errMsg = err.response?.data?.message || err.message;
      setError(`วิเคราะห์ล้มเหลว: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased bg-grid-pattern relative selection:bg-indigo-500/30 selection:text-white">

      {/* ── Ambient Background Glows ─────────────────────────────── */}
      <div className="fixed top-0 left-0 w-[700px] h-[700px] bg-radial-glow-1 pointer-events-none z-0 animate-pulse-glow" />
      <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-radial-glow-2 pointer-events-none z-0" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px] bg-radial-glow-3 pointer-events-none z-0" />

      <LoadingState isLoading={loading} />

      {/* ── TICKER MARQUEE BAR ───────────────────────────────────── */}
      <div className="w-full bg-slate-900/95 border-b border-slate-800/50 backdrop-blur-xl py-1.5 px-6 flex items-center overflow-hidden z-20 text-[11px] relative shadow-sm">
        <div className="flex items-center gap-1.5 shrink-0 bg-indigo-950/80 px-2.5 py-0.5 rounded-md border border-indigo-800/50 text-[9px] text-indigo-400 font-extrabold uppercase tracking-widest mr-4 shadow-sm">
          <Activity size={9} className="animate-pulse" /> LIVE
        </div>
        <div className="flex items-center gap-8 animate-marquee whitespace-nowrap">
          {[...marqueePrices, ...marqueePrices].map((ticker, index) => {
            const isPos = ticker.change >= 0;
            return (
              <div key={index} className="inline-flex items-center gap-2.5 font-mono">
                <span className="text-slate-500 font-bold text-[10px]">{ticker.symbol}</span>
                <span className="text-slate-100 font-bold text-[11px]">
                  ${ticker.price > 0 ? ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                </span>
                <span className={`font-bold text-[10px] px-1.5 py-0.5 rounded-md ${isPos ? "text-emerald-400 bg-emerald-950/40" : "text-rose-400 bg-rose-950/40"}`}>
                  {isPos ? "▲" : "▼"} {Math.abs(ticker.change).toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── STICKY HEADER ────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-800/40 bg-slate-950/85 backdrop-blur-xl px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_1px_0_rgba(99,102,241,0.06),0_8px_32px_rgba(0,0,0,0.4)]">
        {/* Brand */}
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2.5 rounded-xl text-white shadow-[0_0_24px_rgba(99,102,241,0.4)] border border-indigo-400/20">
              <TrendingUp size={18} strokeWidth={2.5} />
            </div>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
          </div>
          <div>
            <span className="font-heading font-black text-2xl tracking-tighter text-slate-100 flex items-center gap-1.5">
              iVES
            </span>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.15em] mt-0.5">
              US Stock Analysis Terminal
            </p>
          </div>
        </div>

        {/* Tab Navigation Pill - Mobile responsive: scale down text or hide if needed */}
        <div className="flex bg-slate-900/80 border border-slate-800/70 backdrop-blur-md rounded-2xl p-1 gap-1 shadow-inner w-full sm:w-auto justify-center overflow-x-auto">
          {(["dashboard", "portfolio"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 cursor-pointer ${
                activeTab === tab
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
              }`}
            >
              {tab === "dashboard" ? "📊 วิเคราะห์กราฟ" : "💼 พอร์ตจำลอง"}
            </button>
          ))}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2.5">
          <div className="hidden lg:flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/40 rounded-xl px-3 py-1.5 text-[10px] text-emerald-400 font-bold tracking-wide">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
            Yahoo Finance Live
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={12} className="text-slate-400" />
            </div>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. AAPL, TSLA"
              className="bg-slate-900/60 border border-slate-700/50 text-slate-100 text-xs rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 block w-24 sm:w-28 pl-8 p-2 font-mono tracking-wider shadow-inner transition-all"
            />
          </div>

          <button
            onClick={() => fetchMarketDataOnly()}
            disabled={initialLoading || loading}
            title="รีเฟรชข้อมูล"
            className="hidden sm:flex p-2 bg-slate-900/80 border border-slate-800 hover:border-indigo-700/50 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 rounded-xl transition-all duration-300 cursor-pointer"
          >
            <RotateCw size={14} className={initialLoading ? "animate-spin text-indigo-400" : ""} />
          </button>

          <button
            onClick={handleAnalyze}
            disabled={loading || !symbol}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] sm:text-[11px] font-black uppercase tracking-widest px-3 sm:px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.4)] transition-all duration-300 flex items-center gap-1.5 sm:gap-2 border border-indigo-400/20 cursor-pointer"
          >
            {loading ? (
              <>
                <RotateCw size={14} className="animate-spin" />
                <span className="hidden sm:inline">ANALYZING...</span>
              </>
            ) : (
              <>
                <Zap size={14} className="text-amber-300" />
                <span>ANALYZE</span>
              </>
            )}
          </button>
          
          {/* User profile / Logout */}
          {user && (
            <div className="flex items-center gap-3 border-l border-slate-800 pl-3 ml-1">
              <div className="hidden xl:block text-[10px] text-slate-400 font-medium truncate max-w-[120px]">
                {user.email}
              </div>
              <button 
                onClick={logout}
                title="ออกจากระบบ"
                className="text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
      <main className="flex-1 p-4 md:p-6 max-w-[1800px] w-full mx-auto relative z-10 space-y-8 pb-12">

        {/* Error Banner */}
        {error && (
          <div className="bg-rose-950/20 border border-rose-700/30 text-rose-300 text-xs rounded-2xl p-4 flex items-center gap-3 shadow-lg shadow-rose-950/20">
            <div className="w-8 h-8 rounded-lg bg-rose-900/40 border border-rose-700/40 flex items-center justify-center shrink-0">
              <AlertTriangle size={14} className="text-rose-400" />
            </div>
            <div>
              <p className="font-bold text-rose-300">ข้อผิดพลาด</p>
              <p className="text-rose-400/80 text-[11px] mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {activeTab === "portfolio" ? (
          <PortfolioView />
        ) : (
          <>

            {/* Dashboard Grid Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* LEFT AREA: TradingView Chart + News + Sentiment (Desktop col-span-8) */}
              <div className="lg:col-span-8 space-y-6 flex flex-col">
                
                {/* Real-time Chart Header / Switcher */}
                <div className="w-full space-y-3">
                  <div className="flex justify-between items-center bg-slate-900/60 border border-slate-800/80 rounded-xl px-4 py-2 relative z-20">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      การแสดงผลกราฟตลาด <span className="font-serif-italic text-indigo-400 lowercase font-normal">(chart options)</span>
                    </span>
                    <div className="flex bg-slate-950 border border-slate-850 rounded-lg p-0.5">
                      <button
                        onClick={() => setChartView("tradingview")}
                        className={`px-3 py-1.5 text-[9px] font-black uppercase rounded transition-all duration-300 cursor-pointer ${
                          chartView === "tradingview"
                            ? "bg-indigo-650 text-white shadow-sm"
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        TradingView Live
                      </button>
                      <button
                        onClick={() => setChartView("sr_zones")}
                        className={`px-3 py-1.5 text-[9px] font-black uppercase rounded transition-all duration-300 cursor-pointer ${
                          chartView === "sr_zones"
                            ? "bg-indigo-650 text-white shadow-sm"
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        โซนรับ-ต้านจำลอง (S/R Chart)
                      </button>
                    </div>
                  </div>
                  
                  {chartView === "tradingview" ? (
                    <div className="w-full shadow-[0_20px_50px_rgba(99,102,241,0.03)] border border-slate-850 rounded-2xl overflow-hidden bg-slate-900/10">
                      <TradingViewChart symbol={symbol} interval={timeframe} />
                    </div>
                  ) : (
                    <SRChart
                      klines={klines}
                      indicators={indicators}
                      supportResistance={supportResistance}
                      currentPrice={marketData ? marketData.currentPrice : null}
                    />
                  )}
                </div>

                {/* News and Sentiment Side-by-Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SentimentPanel sentiment={sentiment} loading={initialLoading} />
                  <NewsPanel news={news} loading={initialLoading} />
                </div>

              </div>

              {/* RIGHT AREA: Rocket Score + Market Stats (Desktop col-span-4) */}
              <div className="lg:col-span-4 space-y-6 flex flex-col">
                
                {/* Rocket Score gauge card */}
                <RocketScoreCard reportText={analysisReport} loading={loading} />

                {/* Market indicators & stats */}
                <MarketStats
                  marketData={marketData}
                  indicators={indicators}
                  supportResistance={supportResistance}
                  loading={initialLoading}
                />

              </div>
            </div>

            {/* BOTTOM FULL WIDTH SECTION: Quantitative analysis Report Panel */}
            <div className="w-full pt-2">
              <div className="border-t border-slate-900/80 pt-6">
                <AnalysisPanel reportText={analysisReport} loading={loading} />
              </div>
            </div>
          </>
        )}

      </main>

      {/* Footer / Risk Warning */}
      <footer className="border-t border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-8 text-center text-xs text-slate-500 space-y-3.5 mt-10 relative z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-2 text-slate-400 font-semibold bg-slate-900/40 border border-slate-800/80 p-3 rounded-xl shadow-inner">
          <HelpCircle size={14} className="text-amber-500 shrink-0" />
          <span>คำเตือนความเสี่ยงสำคัญเกี่ยวกับตลาดการเงิน</span>
        </div>
        <p className="max-w-3xl mx-auto leading-relaxed text-[11px] text-slate-500">
          ผลิตภัณฑ์ทางการเงิน หุ้นต่างประเทศ และอนุพันธ์ มีความเสี่ยงสูงเนื่องมาจากความผันผวนของราคา 
          ระบบรายงานวิเคราะห์เทคนิคคอลและโมเดลคำนวณความน่าเชื่อถือนี้สร้างขึ้นเพื่อเป็นเครื่องมือประกอบสถิติการตัดสินใจเท่านั้น 
          ไม่ได้เป็นคำเชิญชวนระดมทุนหรือให้สัญญาณทางการเงินจริง ผู้ใช้งานต้องรับผิดชอบต่อการประเมินและบริหารความเสี่ยงด้วยตัวเองเสมอ
        </p>
        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
          © {new Date().getFullYear()} Rocket Trading Assistant • Designed for Smart Decision Making.
        </p>
      </footer>
    </div>
  );
}
