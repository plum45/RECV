/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Play, RotateCw, Settings, Sliders, TrendingUp, HelpCircle, Activity, ChevronRight, AlertTriangle, Search, Zap, Heart } from "lucide-react";
import SymbolSelector from "../../../components/SymbolSelector";
import TimeframeSelector from "../../../components/TimeframeSelector";
import TradingViewChart from "../../../components/TradingViewChart";
import MarketStats, { SupportResistanceZonesPanel } from "../../../components/MarketStats";
import SentimentPanel from "../../../components/SentimentPanel";
import NewsPanel from "../../../components/NewsPanel";
import RocketScoreCard from "../../../components/RocketScoreCard";
import AnalysisPanel from "../../../components/AnalysisPanel";
import LoadingState from "../../../components/LoadingState";

import SRChart from "../../../components/SRChart";
import SummaryPanel from "../../../components/SummaryPanel";
import MultiTimeframePanel from "../../../components/MultiTimeframePanel";
import GoldPlaybookPanel from "../../../components/GoldPlaybookPanel";
import { TickerData, IndicatorData, SupportResistanceData, KlineData } from "../../../types/market";
import { NewsArticle } from "../../../types/news";
import { SentimentData, MultiTimeframeAnalysis, GoldPlaybookData } from "../../../types/analysis";
import { useAuth } from "../../../contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { db, auth } from "../../../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getRecommendedTimeframe, getStoredTradingStyle, isTradingStyle, storeTradingStyle, type TradingStyle } from "../../../lib/tradingStyle";

interface MarqueeTicker {
  symbol: string;
  price: number;
  change: number;
}

function AnalyzePageContent() {
  const { user, loading: authLoading, logout, getIdToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSymbol = searchParams.get("symbol");
  const urlTimeframe = searchParams.get("timeframe");
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRequestSymbolRef = useRef("");

  const getSafeIdToken = async (forceRefresh = false): Promise<string | null> => {
    if (typeof getIdToken === "function") {
      try {
        const t = await getIdToken(forceRefresh);
        if (typeof t === "string" && t.length > 0) return t;
      } catch (e) {}
    }
    const currentUser = auth?.currentUser || user;
    if (currentUser && typeof currentUser.getIdToken === "function") {
      try {
        const t = await currentUser.getIdToken(forceRefresh);
        if (typeof t === "string" && t.length > 0) return t;
      } catch (e) {}
    }
    return null;
  };

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<"dashboard" | "portfolio">("dashboard");

  // Chart View State: Toggle between live TV widget and Recharts S/R bands overlay
  const [chartView, setChartView] = useState<"tradingview" | "sr_zones">("tradingview");

  // Selected configuration states - Do not default to NVDA until URL/Firestore initialization has finished
  const [symbol, setSymbol] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get("symbol")?.toUpperCase() || "";
    }
    return "";
  });
  const [analyzedSymbol, setAnalyzedSymbol] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get("symbol")?.toUpperCase() || "";
    }
    return "";
  });
  const [tradingStyle, setTradingStyle] = useState<TradingStyle>(() => getStoredTradingStyle());
  const [timeframe, setTimeframe] = useState(() => urlTimeframe || getRecommendedTimeframe(getStoredTradingStyle()));
  const [riskPercent, setRiskPercent] = useState("1%");
  const [analysisMode, setAnalysisMode] = useState("Analyze Both Long & Short");
  const [accountSize, setAccountSize] = useState(10000);
  const [leverage, setLeverage] = useState(1);
  const [feePercent, setFeePercent] = useState(0.1);
  const [slippagePercent, setSlippagePercent] = useState(0.2);
  const [showAdvancedCalculator, setShowAdvancedCalculator] = useState(false);

  const [isSymbolInitialized, setIsSymbolInitialized] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return !!params.get("symbol");
    }
    return false;
  });

  // เมื่อ urlSymbol เปลี่ยน ให้ยึดค่า URL เป็นหลักเสมอ
  useEffect(() => {
    if (urlSymbol) {
      setSymbol(urlSymbol.toUpperCase());
      setAnalyzedSymbol(urlSymbol.toUpperCase());
      setIsSymbolInitialized(true);
    }
  }, [urlSymbol]);

  useEffect(() => {
    if (["5m", "15m", "1H", "4H", "1D"].includes(urlTimeframe || "")) {
      setTimeframe(urlTimeframe as string);
    }
  }, [urlTimeframe]);

  // ซิงค์สเตทกลับไปยัง URL คิวรีพารามิเตอร์ (เฉพาะหลัง Initialize แล้วและ symbol ไม่เป็นค่าว่าง)
  useEffect(() => {
    if (!isSymbolInitialized || !symbol) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("symbol")?.toUpperCase() !== symbol.toUpperCase()) {
      params.set("symbol", symbol.toUpperCase());
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, "", newUrl);
    }
  }, [symbol, isSymbolInitialized]);

  // Market & technical analytical states
  const [klines, setKlines] = useState<KlineData[] | null>(null);
  const [marketData, setMarketData] = useState<TickerData | null>(null);
  const [indicators, setIndicators] = useState<IndicatorData | null>(null);
  const [supportResistance, setSupportResistance] = useState<SupportResistanceData | null>(null);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [multiTimeframe, setMultiTimeframe] = useState<MultiTimeframeAnalysis | null>(null);
  const [goldPlaybook, setGoldPlaybook] = useState<GoldPlaybookData | null>(null);

  // Watchlist State
  const [isInWatchlist, setIsInWatchlist] = useState(false);

  // Check if current symbol is in Watchlist
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("rocket_watchlist");
        if (saved) {
          const parsed = JSON.parse(saved);
          setIsInWatchlist(parsed.includes(symbol.toUpperCase()));
        }
      } catch (e) {
        // ignore
      }
    }
  }, [symbol]);

  const toggleWatchlist = () => {
    if (typeof window !== "undefined") {
      try {
        const sym = symbol.toUpperCase();
        const saved = localStorage.getItem("rocket_watchlist");
        let list: string[] = saved ? JSON.parse(saved) : ["NVDA", "AAPL", "TSLA", "MSFT"];
        
        if (list.includes(sym)) {
          list = list.filter((s) => s !== sym);
          setIsInWatchlist(false);
        } else {
          list.push(sym);
          setIsInWatchlist(true);
        }
        localStorage.setItem("rocket_watchlist", JSON.stringify(list));
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Firestore Sync Effect
  useEffect(() => {
    if (authLoading) return;

    const loadPrefsAndInit = async () => {
      const params = new URLSearchParams(window.location.search);
      const hasUrlSymbol = params.get("symbol") || urlSymbol;

      // 1. URL is primary source of truth
      if (hasUrlSymbol) {
        setSymbol(hasUrlSymbol.toUpperCase());
        setAnalyzedSymbol(hasUrlSymbol.toUpperCase());
        setIsSymbolInitialized(true);
        return;
      }

      // 2. If no URL symbol, fall back to Firestore
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.symbol) {
              setSymbol(data.symbol.toUpperCase());
              setAnalyzedSymbol(data.symbol.toUpperCase());
            } else {
              setSymbol("NVDA"); // 3. Tertiary fallback
              setAnalyzedSymbol("NVDA");
            }
            const storedStyle = getStoredTradingStyle();
            const hasStoredStyle = typeof window !== "undefined" && window.localStorage.getItem("rocket_trading_style") !== null;
            const savedStyle = isTradingStyle(data.tradingStyle) ? data.tradingStyle : null;
            const activeStyle = hasStoredStyle ? storedStyle : (savedStyle || storedStyle);
            setTradingStyle(activeStyle);
            setTimeframe(hasStoredStyle ? getRecommendedTimeframe(activeStyle) : (data.timeframe || getRecommendedTimeframe(activeStyle)));
            if (!hasStoredStyle && savedStyle) storeTradingStyle(savedStyle);
            if (data.riskPercent) setRiskPercent(data.riskPercent);
            if (data.analysisMode) setAnalysisMode(data.analysisMode);
          } else {
            setSymbol("NVDA"); // 3. Tertiary fallback
            setAnalyzedSymbol("NVDA");
          }
        } catch (err) {
          console.error("Failed to load user preferences", err);
          setSymbol("NVDA"); // 3. Tertiary fallback
          setAnalyzedSymbol("NVDA");
        }
      } else {
        setSymbol("NVDA"); // 3. Tertiary fallback
        setAnalyzedSymbol("NVDA");
      }
      setIsSymbolInitialized(true);
    };

    loadPrefsAndInit();
  }, [user, authLoading, urlSymbol]);

  useEffect(() => {
    if (!user || !isSymbolInitialized || !symbol) return;
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
  }, [symbol, timeframe, tradingStyle, riskPercent, analysisMode, user, isSymbolInitialized]);

  const handleTradingStyleChange = (style: TradingStyle) => {
    storeTradingStyle(style);
    setTradingStyle(style);
    setTimeframe(getRecommendedTimeframe(style));
  };

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

  // Granular loading & error states
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [errorPrice, setErrorPrice] = useState<string | null>(null);
  const [isPriceStale, setIsPriceStale] = useState(false);

  const [loadingNews, setLoadingNews] = useState(false);
  const [errorNews, setErrorNews] = useState<string | null>(null);
  const [isNewsStale, setIsNewsStale] = useState(false);

  const [loadingSentiment, setLoadingSentiment] = useState(false);
  const [errorSentiment, setErrorSentiment] = useState<string | null>(null);
  const [isSentimentStale, setIsSentimentStale] = useState(false);

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
    if (!tgtSymbol) return;

    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    activeRequestSymbolRef.current = tgtSymbol;
    const currentRequestedSymbol = tgtSymbol;
    
    // Clear global error
    setError(null);
    setInitialLoading(true);

    // Block 1: Fetch Ticker, Klines & Indicators
    setLoadingPrice(true);
    setErrorPrice(null);
    try {
      const tickerRes = await axios.get<TickerData>(`/api/ticker?symbol=${encodeURIComponent(tgtSymbol)}`, { signal });
      if (activeRequestSymbolRef.current === currentRequestedSymbol) {
        setMarketData(tickerRes.data);
        setIsPriceStale(false);
        setAnalyzedSymbol(tgtSymbol);
      }

      const klinesRes = await axios.get<any[]>(`/api/klines?symbol=${encodeURIComponent(tgtSymbol)}&timeframe=${tgtTf}&limit=450`, { signal });
      if (activeRequestSymbolRef.current === currentRequestedSymbol) {
        setKlines(klinesRes.data);
        
        const { calculateIndicators } = await import("../../../lib/indicators");
        const { calculateSupportResistance } = await import("../../../lib/supportResistance");
        const { getAssetProfile } = await import("../../../lib/assetProfile");
        const assetProfile = getAssetProfile(tgtSymbol);

        const computedIndicators = calculateIndicators(klinesRes.data, assetProfile);
        setIndicators(computedIndicators);

        const computedSR = calculateSupportResistance(
          klinesRes.data,
          computedIndicators,
          tickerRes.data.currentPrice,
          tgtTf,
          assetProfile.assetClass
        );
        setSupportResistance(computedSR);
      }
    } catch (err: any) {
      if (axios.isCancel(err)) {
        console.log("Price fetch cancelled for symbol:", tgtSymbol);
        return;
      }
      console.error("Price data load error:", err.message);
      if (activeRequestSymbolRef.current === currentRequestedSymbol) {
        setErrorPrice("ไม่สามารถดึงข้อมูลราคาล่าสุดได้");
        setIsPriceStale(true);
      }
    } finally {
      if (activeRequestSymbolRef.current === currentRequestedSymbol) {
        setLoadingPrice(false);
      }
    }

    // Block 2: Fetch News
    setLoadingNews(true);
    setErrorNews(null);
    try {
      const newsRes = await axios.get<NewsArticle[]>(`/api/news?symbol=${encodeURIComponent(tgtSymbol)}`, { signal });
      if (activeRequestSymbolRef.current === currentRequestedSymbol) {
        setNews(newsRes.data);
        setIsNewsStale(false);
      }
    } catch (err: any) {
      if (axios.isCancel(err)) {
        console.log("News fetch cancelled for symbol:", tgtSymbol);
        return;
      }
      console.error("News load error:", err.message);
      if (activeRequestSymbolRef.current === currentRequestedSymbol) {
        setErrorNews("ไม่สามารถดึงข้อมูลข่าวสารได้");
        setIsNewsStale(true);
      }
    } finally {
      if (activeRequestSymbolRef.current === currentRequestedSymbol) {
        setLoadingNews(false);
      }
    }

    // Block 3: Fetch Sentiment
    setLoadingSentiment(true);
    setErrorSentiment(null);
    try {
      const sentimentRes = await axios.get<SentimentData>(`/api/sentiment?symbol=${encodeURIComponent(tgtSymbol)}`, { signal });
      if (activeRequestSymbolRef.current === currentRequestedSymbol) {
        setSentiment(sentimentRes.data);
        setIsSentimentStale(false);
      }
    } catch (err: any) {
      if (axios.isCancel(err)) {
        console.log("Sentiment fetch cancelled for symbol:", tgtSymbol);
        return;
      }
      console.error("Sentiment load error:", err.message);
      if (activeRequestSymbolRef.current === currentRequestedSymbol) {
        setErrorSentiment("ไม่สามารถดึงข้อมูล Sentiment ได้");
        setIsSentimentStale(true);
      }
    } finally {
      if (activeRequestSymbolRef.current === currentRequestedSymbol) {
        setLoadingSentiment(false);
        setInitialLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!isSymbolInitialized || !symbol) return;
    fetchMarketDataOnly(symbol, timeframe);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [symbol, timeframe, isSymbolInitialized]);

  // 2. Trigger Full AI Analysis Orchestrator (calls /api/analyze)
  const handleAnalyze = async () => {
    const currentUser = auth?.currentUser || user;
    if (!currentUser) {
      alert("กรุณาเข้าสู่ระบบใหม่เพื่อใช้งานการวิเคราะห์");
      return;
    }
    try {
      setLoading(true);
      setError(null);

      let token = await getSafeIdToken();
      if (!token) {
        try {
          if (auth?.currentUser) {
            token = await auth.currentUser.getIdToken(true);
          }
        } catch (_e) {}
      }

      if (!token || typeof token !== "string" || token.length === 0) {
        alert("ไม่สามารถรับ Token ยืนยันตัวตนได้ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่");
        setLoading(false);
        return;
      }

      const makeRequest = async (idToken: string) => {
        const parsedRiskPercentVal = parseFloat(riskPercent.replace("%", "")) || 1.0;
        return axios.post("/api/analyze", {
          symbol,
          timeframe,
          tradingStyle,
          risk: riskPercent,
          mode: analysisMode,
          accountSize,
          riskPercent: parsedRiskPercentVal,
          leverage,
          feePercent,
          slippagePercent,
        }, {
          headers: { Authorization: `Bearer ${idToken}` }
        });
      };

      let response;
      try {
        response = await makeRequest(token);
      } catch (err: any) {
        if (err.response?.status === 401) {
          token = await getSafeIdToken(true);
          if (!token && auth?.currentUser) {
            try { token = await auth.currentUser.getIdToken(true); } catch (_e) {}
          }
          if (token) {
            response = await makeRequest(token);
          } else {
            alert("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
            setLoading(false);
            return;
          }
        } else {
          throw err;
        }
      }

      const data = response.data;
      setMarketData(data.marketData);
      setIndicators(data.indicators);
      setSupportResistance(data.supportResistance);
      setNews(data.news);
      setSentiment(data.sentiment);
      setMultiTimeframe(data.multiTimeframe || null);
      setGoldPlaybook(data.goldPlaybook || null);
      setAnalysisReport(data.analysis);
      setAnalyzedSymbol(symbol);

    } catch (err: any) {
      console.error("Orchestrator analysis error:", err.message);
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      setError(`ไม่สามารถติดต่อกับเซิร์ฟเวอร์วิเคราะห์ AI ได้: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-950 text-slate-100 flex flex-col antialiased bg-grid-pattern relative selection:bg-indigo-500/30 selection:text-white">

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
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-xl px-3 sm:px-6 py-2 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 shadow-[0_1px_0_rgba(255,255,255,0.04),0_8px_32px_rgba(0,0,0,0.5)]">
        {/* Brand (Hidden on mobile because top bar already has iVES) */}
        <div className="hidden lg:flex items-center gap-3.5">
          <div className="relative">
            <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-sm border border-slate-800">
              <TrendingUp size={18} strokeWidth={2.5} />
            </div>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
          </div>
          <div>
            <span className="font-heading font-black text-2xl tracking-tighter text-slate-100 flex items-center gap-1.5">
              iVES
            </span>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] mt-0.5">
              US Stock Analysis Terminal
            </p>
          </div>
        </div>

        {/* Tab Navigation Pill - Monochromatic Gray/White Tone */}
        <div className="flex bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-1 gap-1 shadow-inner w-full sm:w-auto justify-center sm:justify-start overflow-x-auto">
          {(["dashboard", "portfolio"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-300 cursor-pointer ${
                activeTab === tab
                  ? "bg-white text-slate-950 shadow-md font-extrabold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 font-semibold"
              }`}
            >
              {tab === "dashboard" ? "📊 วิเคราะห์กราฟ" : "💼 พอร์ตจำลอง"}
            </button>
          ))}
        </div>

        {/* Action Controls: Search + Refresh + Analyze + Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          <div className="hidden xl:flex items-center gap-2 bg-emerald-950/30 border border-emerald-800/40 rounded-xl px-3 py-1.5 text-[10px] text-emerald-400 font-bold tracking-wide">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
            Live Market
          </div>

          <div className="relative flex-1 sm:flex-initial">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={12} className="text-slate-400" />
            </div>
            <input
              type="text"
              value={symbol}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setSymbol(val);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = (e.target as HTMLInputElement).value.toUpperCase();
                  if (val) {
                    setSymbol(val);
                    setAnalyzedSymbol(val);
                    setIsSymbolInitialized(true);
                    fetchMarketDataOnly(val, timeframe);
                  }
                }
              }}
              placeholder="AAPL, TSLA..."
              className="bg-slate-900/80 border border-slate-800 text-slate-100 text-xs rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 block w-full sm:w-32 pl-8 pr-9 py-2 font-mono tracking-wider shadow-inner transition-all"
            />
            <button
              onClick={toggleWatchlist}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center hover:scale-110 transition-transform cursor-pointer"
              title={isInWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
            >
              <Heart size={14} className={isInWatchlist ? "text-rose-500 fill-rose-500" : "text-slate-400"} />
            </button>
          </div>

          <button
            onClick={() => fetchMarketDataOnly()}
            disabled={initialLoading || loading}
            title="รีเฟรชข้อมูล"
            className="p-2 bg-slate-900/90 border border-slate-800 hover:border-slate-600 hover:bg-slate-800 text-slate-400 hover:text-slate-100 rounded-xl transition-all duration-300 cursor-pointer shrink-0"
          >
            <RotateCw size={14} className={initialLoading ? "animate-spin text-slate-200" : ""} />
          </button>

          <button
            onClick={handleAnalyze}
            disabled={loading || !symbol}
            className="bg-white hover:bg-slate-100 dark:bg-white dark:hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-[10px] sm:text-xs font-black uppercase tracking-wider px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl shadow-md transition-all duration-300 flex items-center gap-1.5 sm:gap-2 border border-slate-200 cursor-pointer shrink-0"
          >
            {loading ? (
              <>
                <RotateCw size={14} className="animate-spin" />
                <span className="hidden sm:inline">ANALYZING...</span>
              </>
            ) : (
              <>
                <Zap size={14} className="text-slate-900 fill-slate-900" />
                <span>ANALYZE</span>
              </>
            )}
          </button>
          
          {/* User profile / Logout */}
          {user && (
            <div className="hidden sm:flex items-center gap-3 border-l border-slate-800 pl-3 ml-1">
              <div className="hidden xl:block text-[10px] text-slate-400 font-medium truncate max-w-[120px]">
                {user.email}
              </div>
              <button 
                onClick={logout}
                title="ออกจากระบบ"
                className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-semibold"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
      <main className="flex-1 p-1.5 sm:p-4 md:p-6 max-w-[1800px] w-full mx-auto relative z-10 space-y-8 pb-28 sm:pb-16 lg:pb-12">

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

        {/* สรุปก่อนตัดสินใจ (Decision Summary Panel) */}
        {symbol && (
          <SummaryPanel
            symbol={analyzedSymbol || symbol}
            marketData={marketData}
            supportResistance={supportResistance}
            indicators={indicators}
            isInWatchlist={isInWatchlist}
            toggleWatchlist={toggleWatchlist}
            reportText={analysisReport}
            loading={loading}
            loadingPrice={loadingPrice}
            errorPrice={errorPrice}
            isPriceStale={isPriceStale}
          />
        )}
        <MultiTimeframePanel data={multiTimeframe} />
        <GoldPlaybookPanel data={goldPlaybook} />
        {/* Configuration Selectors Bar */}
        {symbol && (
          <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-md rounded-3xl p-4 lg:p-5 shadow-xl flex flex-col gap-4 relative z-20">
            <div className="flex flex-col md:flex-row gap-5">
              {/* Trading Style Selector */}
              <div className="flex-1 space-y-1.5">
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  สไตล์การเทรด (Trading Style)
                </label>
                <select
                  value={tradingStyle}
                  onChange={(e) => handleTradingStyleChange(e.target.value as TradingStyle)}
                  aria-label="เลือกสไตล์การเทรด"
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="scalping">Scalping (1–30 นาที / 1H → 15m → 5m)</option>
                  <option value="day">Day Trade (เก็งกำไรระยะสั้น / Minutes to Intraday)</option>
                  <option value="swing">Swing Trade (แนะนำ / เก็งกำไรส่วนต่างรอบ / Days to Weeks)</option>
                  <option value="position">Position Trade (เก็งกำไรตามทิศทางแนวโน้มใหญ่ / Weeks to Months)</option>
                </select>
                <p className="text-[10px] text-slate-500 font-medium">
                  {tradingStyle === "scalping" && "Scalping: 1–30 นาที • แนะนำ: 5m • ใช้ 1H กรองทิศทาง, 15m ดู VWAP/โครงสร้าง, 5m รอ sweep และแท่งยืนยัน • หลีกเลี่ยงช่วงข่าวแรง"}
                  {tradingStyle === "day" && "ระยะถือครอง: นาทีถึงภายในวัน • แนะนำ: 5m, 15m, 1H • เน้น RSI/MACD/Vol และรับ-ต้านระยะสั้น"}
                  {tradingStyle === "swing" && "ระยะถือครอง: 3–20 วันโดยประมาณ • แนะนำ: 4H, 1D • เน้น EMA 20/50, โครงสร้าง และ ATR"}
                  {tradingStyle === "position" && "ระยะถือครอง: หลายสัปดาห์ถึงหลายเดือน • แนะนำ: 1D • เน้น EMA 50/200, Fibonacci และเทรนด์หลัก"}
                </p>
              </div>

              {/* Timeframe Selector */}
              <div className="md:w-44 space-y-1.5">
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  กรอบเวลา (Timeframe)
                </label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  aria-label="เลือกกรอบเวลา"
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="5m">5 Minutes (5m)</option>
                  <option value="15m">15 Minutes (15m)</option>
                  <option value="1H">1 Hour (1H)</option>
                  <option value="4H">4 Hours (4H)</option>
                  <option value="1D">1 Day (1D)</option>
                </select>
                <p className="text-[10px] text-slate-500 font-medium">
                  กรอบเวลากราฟสำหรับวิเคราะห์
                </p>
              </div>

              {/* Risk Selection */}
              <div className="md:w-36 space-y-1.5">
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  ความเสี่ยงต่อไม้ (Risk %)
                </label>
                <select
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(e.target.value)}
                  aria-label="เลือกความเสี่ยงต่อครั้ง"
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="1%">1% Risk</option>
                  <option value="2%">2% Risk</option>
                  <option value="3%">3% Risk</option>
                  <option value="5%">5% Risk</option>
                </select>
                <p className="text-[10px] text-slate-500 font-medium">
                  ใช้คำนวณขนาดไม้เหมาะสม
                </p>
              </div>

              {/* Analysis Mode Selector */}
              <div className="md:w-64 space-y-1.5">
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  โหมดการวิเคราะห์ (Analysis Mode)
                </label>
                <select
                  value={analysisMode}
                  onChange={(e) => setAnalysisMode(e.target.value)}
                  aria-label="เลือกโหมดวิเคราะห์ของบอต AI"
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="Analyze Both Long & Short">Analyze Both Long & Short</option>
                  <option value="Long Positions Only">Long Positions Only</option>
                  <option value="Short Positions Only">Short Positions Only</option>
                </select>
                <p className="text-[10px] text-slate-500 font-medium">
                  แผนภาพและกรณีการเทรดที่แนะนำ
                </p>
              </div>
            </div>

            {/* Advanced Calculator Collapsible Control */}
            <div className="border-t border-slate-800/60 pt-3 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setShowAdvancedCalculator(!showAdvancedCalculator)}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {showAdvancedCalculator ? "▲ ซ่อนการคำนวณความเสี่ยงขั้นสูง" : "▼ แสดงเครื่องคำนวณความเสี่ยง & ขนาดไม้ขั้นสูง (Advanced Calculator)"}
              </button>
            </div>

            {showAdvancedCalculator && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-2xl border border-indigo-900/30 shadow-inner">
                {/* Live position size preview */}
                <div className="col-span-2 md:col-span-4 flex items-center gap-2 text-[10px] text-indigo-300 font-semibold bg-indigo-950/30 border border-indigo-800/30 rounded-xl px-3 py-2">
                  <Sliders size={10} />
                  <span>ผลลัพธ์การคำนวณไม้จะรวมอยู่ในรายงาน AI โดยอัตโนมัติเมื่อกด ANALYZE</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">💰 Account Size ($)</label>
                  <input
                    type="number"
                    min={100}
                    max={10000000}
                    value={accountSize}
                    onChange={(e) => setAccountSize(Math.max(100, Number(e.target.value)))}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-600 text-slate-200 text-xs font-mono font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                  <p className="text-[9px] text-slate-600">ขนาดบัญชีรวม</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">⚡ Leverage (x)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={leverage}
                    onChange={(e) => setLeverage(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-600 text-slate-200 text-xs font-mono font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                  <p className="text-[9px] text-slate-600">1x = ไม่ใช้ Leverage</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">📊 Fee (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    step={0.01}
                    value={feePercent}
                    onChange={(e) => setFeePercent(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-600 text-slate-200 text-xs font-mono font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                  <p className="text-[9px] text-slate-600">ค่าธรรมเนียมต่อไม้</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">🎯 Slippage (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    step={0.01}
                    value={slippagePercent}
                    onChange={(e) => setSlippagePercent(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-600 text-slate-200 text-xs font-mono font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                  <p className="text-[9px] text-slate-600">Slippage ต่อไม้</p>
                </div>

                {/* Inline calculator result preview */}
                <div className="col-span-2 md:col-span-4 grid grid-cols-3 gap-2 pt-1">
                  {[{
                    label: "ทุนเสี่ยงต่อไม้",
                    value: `$${((accountSize * (parseFloat(riskPercent.replace("%","")) || 1)) / 100).toFixed(2)}`,
                    color: "text-amber-400"
                  }, {
                    label: "ต้นทุนรวม (Levered)",
                    value: `$${(accountSize * leverage).toLocaleString()}`,
                    color: "text-indigo-400"
                  }, {
                    label: "ค่าต้นทุนรวมต่อรอบ",
                    value: `${(feePercent * 2 + slippagePercent * 2).toFixed(3)}%`,
                    color: "text-cyan-400"
                  }].map(stat => (
                    <div key={stat.label} className="bg-slate-900/60 border border-slate-800/50 rounded-xl px-3 py-2 text-center">
                      <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wide mb-1">{stat.label}</p>
                      <p className={`text-sm font-black font-mono ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
                      <TradingViewChart symbol={analyzedSymbol || symbol} interval={timeframe} />
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

                {/* Support & Resistance Zones right below chart */}
                <SupportResistanceZonesPanel supportResistance={supportResistance} />

                {/* News and Sentiment Side-by-Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SentimentPanel 
                    sentiment={sentiment} 
                    loading={loadingSentiment} 
                    symbol={analyzedSymbol || symbol} 
                    error={errorSentiment}
                    isStale={isSentimentStale}
                  />
                  <NewsPanel 
                    news={news} 
                    loading={loadingNews} 
                    symbol={analyzedSymbol || symbol} 
                    error={errorNews}
                    isStale={isNewsStale}
                  />
                </div>

              </div>

              {/* RIGHT AREA: Rocket Score + Market Stats (Desktop col-span-4) */}
              <div className="lg:col-span-4 space-y-6 flex flex-col">
                
                {/* Rocket Score gauge card */}
                <RocketScoreCard reportText={analysisReport} loading={loading} symbol={analyzedSymbol || symbol} />

                {/* Market indicators & stats */}
                <MarketStats
                  marketData={marketData}
                  indicators={indicators}
                  supportResistance={supportResistance}
                  loading={loadingPrice}
                  symbol={symbol}
                />

              </div>
            </div>

            {/* BOTTOM FULL WIDTH SECTION: Quantitative analysis Report Panel */}
            <div id="trading-analysis-panel" className="w-full pt-2">
              <div className="border-t border-slate-900/80 pt-6">
                <AnalysisPanel reportText={analysisReport} loading={loading} />
              </div>
            </div>
          </>

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

export default function Dashboard() {
  return (
    <React.Suspense fallback={
      <div className="flex min-h-screen bg-[#090d16] text-slate-200 items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-400">กำลังโหลดระบบวิเคราะห์...</p>
        </div>
      </div>
    }>
      <AnalyzePageContent />
    </React.Suspense>
  );
}
