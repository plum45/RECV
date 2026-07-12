"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { Plus, X, TrendingUp, TrendingDown, Star, Search, AlertTriangle } from "lucide-react";

interface WatchlistQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export default function Watchlist() {
  const router = useRouter();
  const [symbols, setSymbols] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rocket_watchlist");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const validSymbols = Array.isArray(parsed)
            ? parsed.filter((symbol): symbol is string => typeof symbol === "string" && symbol.trim().length > 0)
            : [];
          return validSymbols.length > 0 ? validSymbols : ["NVDA", "AAPL", "TSLA", "MSFT"];
        } catch {
          return ["NVDA", "AAPL", "TSLA", "MSFT"];
        }
      }
    }
    return ["NVDA", "AAPL", "TSLA", "MSFT"];
  });
  const [quotes, setQuotes] = useState<WatchlistQuote[]>([]);
  const [newSymbol, setNewSymbol] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch quotes when symbols change
  useEffect(() => {
    const fetchQuotes = async () => {
      if (symbols.length === 0) {
        setQuotes([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data } = await axios.post("/api/quote", { symbols });
        setQuotes(data);

        // Check if any symbols are invalid (returned null and were filtered out by API)
        if (data.length < symbols.length) {
          const validSymbols = data.map((q: any) => q.symbol);
          const invalidSymbols = symbols.filter(s => !validSymbols.includes(s));
          
          if (invalidSymbols.length > 0) {
            setErrorMsg(`ไม่พบข้อมูลของหุ้น: ${invalidSymbols.join(", ")} (อาจต้องเติม .BK สำหรับหุ้นไทย)`);
            setTimeout(() => setErrorMsg(null), 5000);
            
            // Remove invalid symbols from state and localStorage
            const updatedSymbols = symbols.filter(s => validSymbols.includes(s));
            setSymbols(updatedSymbols);
            localStorage.setItem("rocket_watchlist", JSON.stringify(updatedSymbols));
          }
        }

      } catch (error) {
        console.error("Error fetching watchlist quotes:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuotes();
    const interval = setInterval(fetchQuotes, 30000); // 30 sec update
    return () => clearInterval(interval);
  }, [symbols]);

  const addSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;
    const sym = newSymbol.trim().toUpperCase();
    if (!symbols.includes(sym)) {
      const updated = [...symbols, sym];
      setSymbols(updated);
      localStorage.setItem("rocket_watchlist", JSON.stringify(updated));
    }
    setNewSymbol("");
  };

  const removeSymbol = (e: React.MouseEvent, symToRemove: string) => {
    e.stopPropagation(); // prevent navigation
    const updated = symbols.filter((s) => s !== symToRemove);
    setSymbols(updated);
    localStorage.setItem("rocket_watchlist", JSON.stringify(updated));
  };

  const handleCardClick = (symbol: string) => {
    router.push(`/dashboard/analyze?symbol=${symbol}`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 rounded-2xl border border-slate-800/60 p-4 sm:p-6 overflow-hidden">
      {/* Header & Add */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Star className="text-amber-400" size={20} fill="currentColor" />
          หุ้นตัวโปรด (Watchlist)
        </h2>
        <form onSubmit={addSymbol} className="flex relative items-center w-full sm:w-64">
          <Search className="absolute left-3 text-slate-500" size={16} />
          <input
            type="text"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            placeholder="เพิ่มหุ้น เช่น AAPL..."
            className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 text-sm rounded-full pl-9 pr-10 py-2 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all uppercase"
          />
          <button
            type="submit"
            disabled={!newSymbol.trim()}
            className="absolute right-2 p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50 rounded-full transition-colors disabled:opacity-50"
          >
            <Plus size={16} />
          </button>
        </form>
      </div>

      {errorMsg && (
        <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs px-4 py-2.5 rounded-lg flex items-center gap-2">
          <AlertTriangle size={14} />
          {errorMsg}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-10">
        {loading && quotes.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-slate-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : quotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500">
            <Star className="opacity-20 mb-3" size={48} />
            <p>ไม่มีหุ้นในรายการโปรด</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {quotes.map((q) => {
              const isUp = q.change >= 0;
              const color = isUp ? "text-emerald-400" : "text-rose-400";
              const bgBadge = isUp ? "bg-emerald-400/10" : "bg-rose-400/10";
              const border = isUp ? "border-emerald-500/20" : "border-rose-500/20";
              
              // Try to generate a company domain for clearbit
              const logoDomain = `${q.symbol.toLowerCase()}.com`;

              return (
                <div
                  key={q.symbol}
                  onClick={() => handleCardClick(q.symbol)}
                  className={`group relative p-5 bg-slate-800/40 hover:bg-slate-800/80 backdrop-blur-sm rounded-xl border ${border} transition-all cursor-pointer hover:shadow-lg hover:shadow-indigo-500/5`}
                >
                  <button
                    onClick={(e) => removeSymbol(e, q.symbol)}
                    className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/60 p-1 rounded-full"
                  >
                    <X size={14} />
                  </button>

                  <div className="flex items-center gap-3 mb-4">
                    {/* Remote logos use a fallback chain that next/image cannot preserve. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://logo.clearbit.com/${logoDomain}`}
                      alt={q.symbol}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${q.symbol}&background=random&color=fff&rounded=true&bold=true`;
                      }}
                      className="w-10 h-10 rounded-full bg-slate-700/50 object-cover shadow-sm"
                    />
                    <div className="overflow-hidden">
                      <div className="font-bold text-slate-100 text-lg tracking-tight">
                        {q.symbol}
                      </div>
                      <div className="text-xs text-slate-400 truncate max-w-[120px]">
                        {q.name}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-end justify-between mt-2">
                    <div className="text-2xl font-semibold text-slate-100 tabular-nums">
                      ${q.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={`flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-md ${color} ${bgBadge}`}>
                      {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {isUp ? "+" : ""}
                      {q.changePercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
