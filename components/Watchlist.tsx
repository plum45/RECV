"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import {
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  Star,
  Search,
  AlertTriangle,
  Loader2,
  WifiOff,
  CheckCircle2,
  Info,
} from "lucide-react";
import type { SearchResult, QuoteResult } from "../types/watchlist";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

// ─── Helpers ──────────────────────────────────────────────────
const STORAGE_KEY = "rocket_watchlist";

function loadSymbolsFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function saveSymbolsToStorage(symbols: string[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  }
}

// ─── Component ────────────────────────────────────────────────
export default function Watchlist() {
  const router = useRouter();
  const { user } = useAuth();

  // ── State ───
  const [symbols, setSymbols] = useState<string[]>(() => loadSymbolsFromStorage());
  const [quotes, setQuotes] = useState<Map<string, QuoteResult>>(new Map());
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Search / Autocomplete ───
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Firebase Sync ───
  const firebaseSyncedRef = useRef(false);

  useEffect(() => {
    if (!user || firebaseSyncedRef.current) return;
    firebaseSyncedRef.current = true;

    const syncFirebase = async () => {
      try {
        const docRef = doc(db, "users", user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.watchlist) && data.watchlist.length > 0) {
            // Merge Firebase watchlist with local (union, no duplicates)
            setSymbols((prev) => {
              const merged = Array.from(new Set([...prev, ...data.watchlist]));
              saveSymbolsToStorage(merged);
              return merged;
            });
          }
        }
      } catch (err) {
        console.warn("Firebase watchlist sync failed:", err);
      }
    };
    syncFirebase();
  }, [user]);

  // Save to Firebase whenever symbols change (debounced)
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(async () => {
      try {
        await setDoc(doc(db, "users", user.uid), { watchlist: symbols }, { merge: true });
      } catch (err) {
        console.warn("Firebase watchlist save failed:", err);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [symbols, user]);

  // ── Fetch Quotes ───
  const fetchQuotes = useCallback(async (syms: string[]) => {
    if (syms.length === 0) {
      setQuotes(new Map());
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post<QuoteResult[]>("/api/quote", { symbols: syms });

      const newQuotes = new Map<string, QuoteResult>();
      if (Array.isArray(data)) {
        for (const q of data) {
          newQuotes.set(q.symbol, q);
        }
      }

      // For symbols not in the response, set as unavailable
      for (const sym of syms) {
        const normalized = sym.toUpperCase();
        if (!newQuotes.has(normalized)) {
          newQuotes.set(normalized, {
            symbol: normalized,
            status: "unavailable",
            name: normalized,
            error: "ไม่ได้รับข้อมูลจาก API",
          });
        }
      }

      setQuotes(newQuotes);
    } catch (err: any) {
      console.error("Watchlist quote fetch error:", err.message);
      // Don't clear existing quotes — just mark all as stale
      setErrorMsg("ไม่สามารถดึงข้อมูลราคาได้ ระบบจะลองใหม่อัตโนมัติ");
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on symbols change
  useEffect(() => {
    fetchQuotes(symbols);
    const interval = setInterval(() => fetchQuotes(symbols), 30000);
    return () => clearInterval(interval);
  }, [symbols, fetchQuotes]);

  // ── Autocomplete Search ───
  const performSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearchLoading(true);
    try {
      const { data } = await axios.get(`/api/search-symbol?q=${encodeURIComponent(query)}&limit=8`);
      setSearchResults(data.results || []);
      setShowDropdown(true);
      setHighlightIndex(-1);
    } catch {
      // Search API failed — still allow manual entry
      setSearchResults([]);
      setShowDropdown(false);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(() => performSearch(searchQuery), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, performSearch]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Add Symbol ───
  const addSymbol = (sym: string) => {
    const cleaned = sym.toUpperCase().trim();
    if (!cleaned) return;

    if (symbols.includes(cleaned)) {
      setErrorMsg(`${cleaned} อยู่ในรายการโปรดแล้ว`);
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    // Optimistic: add immediately, then price will load in background
    const updated = [...symbols, cleaned];
    setSymbols(updated);
    saveSymbolsToStorage(updated);

    setSuccessMsg(`เพิ่ม ${cleaned} ลงรายการโปรดแล้ว`);
    setTimeout(() => setSuccessMsg(null), 3000);

    setSearchQuery("");
    setSearchResults([]);
    setShowDropdown(false);
    setHighlightIndex(-1);
  };

  // ── Remove Symbol ───
  const removeSymbol = (e: React.MouseEvent, symToRemove: string) => {
    e.stopPropagation();
    const updated = symbols.filter((s) => s !== symToRemove);
    setSymbols(updated);
    saveSymbolsToStorage(updated);

    // Also remove from quotes map
    setQuotes((prev) => {
      const next = new Map(prev);
      next.delete(symToRemove);
      return next;
    });
  };

  // ── Keyboard Navigation ───
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setShowDropdown(false);
      setHighlightIndex(-1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < searchResults.length) {
        addSymbol(searchResults[highlightIndex].symbol);
      } else if (searchResults.length > 0) {
        addSymbol(searchResults[0].symbol);
      } else if (searchQuery.trim().length >= 1) {
        // API might be down — allow manual entry of ticker
        addSymbol(searchQuery.trim());
      }
      return;
    }
  };

  const handleCardClick = (symbol: string) => {
    if (!symbol) return;
    router.push(`/dashboard/analyze?symbol=${encodeURIComponent(symbol.toUpperCase())}`);
  };

  // ── Render Card ───
  const renderStockCard = (sym: string) => {
    const q = quotes.get(sym);
    const logoDomain = `${sym.toLowerCase().replace(/-USD$/i, "")}.com`;

    // No quote data yet (loading or not fetched)
    if (!q) {
      return (
        <div
          key={sym}
          className="group relative p-5 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-700/30 transition-all"
        >
          <button
            onClick={(e) => removeSymbol(e, sym)}
            className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/60 p-1 rounded-full cursor-pointer"
          >
            <X size={14} />
          </button>
          <div className="flex items-center gap-3 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://ui-avatars.com/api/?name=${sym}&background=random&color=fff&rounded=true&bold=true`}
              alt={sym}
              className="w-10 h-10 rounded-full bg-slate-700/50"
            />
            <div>
              <div className="font-bold text-slate-100 text-lg tracking-tight">{sym}</div>
              <div className="text-xs text-slate-500">กำลังโหลดข้อมูล...</div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Loader2 size={14} className="animate-spin text-slate-500" />
            <span className="text-xs text-slate-500">รอข้อมูลราคา</span>
          </div>
        </div>
      );
    }

    // Invalid symbol
    if (q.status === "invalid") {
      return (
        <div
          key={sym}
          className="group relative p-5 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-amber-500/20 transition-all"
        >
          <button
            onClick={(e) => removeSymbol(e, sym)}
            className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/60 p-1 rounded-full cursor-pointer"
          >
            <X size={14} />
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-900/30 border border-amber-700/30 flex items-center justify-center">
              <AlertTriangle size={18} className="text-amber-400" />
            </div>
            <div>
              <div className="font-bold text-slate-100 text-lg tracking-tight">{sym}</div>
              <div className="text-xs text-amber-400">ไม่พบ Symbol นี้</div>
            </div>
          </div>
          <p className="text-[11px] text-amber-400/70 mt-1">{q.error}</p>
        </div>
      );
    }

    // Unavailable (API down but symbol might be valid)
    if (q.status === "unavailable") {
      return (
        <div
          key={sym}
          onClick={() => handleCardClick(sym)}
          className="group relative p-5 bg-slate-800/40 hover:bg-slate-800/80 backdrop-blur-sm rounded-xl border border-slate-600/30 transition-all cursor-pointer"
        >
          <button
            onClick={(e) => removeSymbol(e, sym)}
            className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/60 p-1 rounded-full cursor-pointer"
          >
            <X size={14} />
          </button>
          <div className="flex items-center gap-3 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://logo.clearbit.com/${logoDomain}`}
              alt={sym}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${sym}&background=random&color=fff&rounded=true&bold=true`;
              }}
              className="w-10 h-10 rounded-full bg-slate-700/50 object-cover shadow-sm"
            />
            <div>
              <div className="font-bold text-slate-100 text-lg tracking-tight">{q.name || sym}</div>
              <div className="text-xs text-slate-500 truncate max-w-[120px]">{sym}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
            <WifiOff size={12} />
            <span>ไม่สามารถดึงราคาได้</span>
          </div>
        </div>
      );
    }

    // Valid quote — normal card
    const isUp = (q.change ?? 0) >= 0;
    const color = isUp ? "text-emerald-400" : "text-rose-400";
    const bgBadge = isUp ? "bg-emerald-400/10" : "bg-rose-400/10";
    const border = isUp ? "border-emerald-500/20" : "border-rose-500/20";

    return (
      <div
        key={sym}
        onClick={() => handleCardClick(sym)}
        className={`group relative p-5 bg-slate-800/40 hover:bg-slate-800/80 backdrop-blur-sm rounded-xl border ${border} transition-all cursor-pointer hover:shadow-lg hover:shadow-indigo-500/5`}
      >
        <button
          onClick={(e) => removeSymbol(e, sym)}
          className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/60 p-1 rounded-full cursor-pointer"
        >
          <X size={14} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://logo.clearbit.com/${logoDomain}`}
            alt={sym}
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${sym}&background=random&color=fff&rounded=true&bold=true`;
            }}
            className="w-10 h-10 rounded-full bg-slate-700/50 object-cover shadow-sm"
          />
          <div className="overflow-hidden">
            <div className="font-bold text-slate-100 text-lg tracking-tight">{sym}</div>
            <div className="text-xs text-slate-400 truncate max-w-[120px]">{q.name}</div>
          </div>
        </div>

        <div className="flex items-end justify-between mt-2">
          <div className="text-2xl font-semibold text-slate-100 tabular-nums">
            ${(q.price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-md ${color} ${bgBadge}`}>
            {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {isUp ? "+" : ""}
            {(q.changePercent ?? 0).toFixed(2)}%
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 rounded-2xl border border-slate-800/60 p-4 sm:p-6 overflow-hidden">
      {/* Header & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Star className="text-amber-400" size={20} fill="currentColor" />
          หุ้นตัวโปรด (Watchlist)
          <span className="text-sm font-normal text-slate-500">({symbols.length})</span>
        </h2>

        {/* Autocomplete Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 z-10 pointer-events-none" size={16} />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (searchResults.length > 0) setShowDropdown(true);
            }}
            placeholder="ค้นหาหุ้น เช่น AAPL, Apple, BTC..."
            className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 text-sm rounded-full pl-9 pr-10 py-2.5 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
          />
          {searchLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 animate-spin" size={16} />
          )}
          {!searchLoading && searchQuery.length > 0 && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
                setShowDropdown(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              <X size={16} />
            </button>
          )}

          {/* Dropdown Results */}
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden max-h-80 overflow-y-auto"
            >
              {searchResults.length > 0 ? (
                searchResults.map((result, idx) => {
                  const alreadyAdded = symbols.includes(result.symbol.toUpperCase());
                  return (
                    <button
                      key={`${result.symbol}-${idx}`}
                      onClick={() => addSymbol(result.symbol)}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      disabled={alreadyAdded}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors cursor-pointer ${
                        idx === highlightIndex
                          ? "bg-indigo-950/50"
                          : "hover:bg-slate-800/80"
                      } ${alreadyAdded ? "opacity-50 cursor-not-allowed" : ""} ${
                        idx < searchResults.length - 1 ? "border-b border-slate-800/50" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-bold text-indigo-400 text-sm w-16 shrink-0">
                          {result.symbol}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm text-slate-200 truncate">{result.name}</p>
                          <p className="text-[10px] text-slate-500">{result.exchange} · {result.type}</p>
                        </div>
                      </div>
                      {alreadyAdded ? (
                        <span className="text-[10px] text-slate-500 shrink-0 ml-2">เพิ่มแล้ว</span>
                      ) : (
                        <Plus size={14} className="text-slate-500 shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })
              ) : searchQuery.length >= 2 && !searchLoading ? (
                <div className="px-4 py-6 text-center">
                  <Search size={20} className="text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">ไม่พบหุ้นที่ตรงกับ &quot;{searchQuery}&quot;</p>
                  <button
                    onClick={() => addSymbol(searchQuery.trim())}
                    className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                  >
                    เพิ่ม {searchQuery.toUpperCase().trim()} โดยตรง
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Success Toast */}
      {successMsg && (
        <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 animate-[fadeIn_0.3s_ease-out]">
          <CheckCircle2 size={14} />
          {successMsg}
        </div>
      )}

      {/* Error Toast */}
      {errorMsg && (
        <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 animate-[fadeIn_0.3s_ease-out]">
          <AlertTriangle size={14} />
          {errorMsg}
        </div>
      )}

      {/* Stock Cards Grid */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-10">
        {symbols.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500">
            <Star className="opacity-20 mb-3" size={48} />
            <p className="font-medium">ไม่มีหุ้นในรายการโปรด</p>
            <p className="text-xs text-slate-600 mt-1">ค้นหาและเพิ่มหุ้นที่ต้องการติดตามด้านบน</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {symbols.map((sym) => renderStockCard(sym))}
          </div>
        )}

        {/* Info: number of symbols with price issues */}
        {symbols.length > 0 && (() => {
          const unavailCount = symbols.filter((s) => {
            const q = quotes.get(s);
            return q && (q.status === "unavailable" || q.status === "invalid");
          }).length;
          if (unavailCount === 0) return null;
          return (
            <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-500">
              <Info size={12} />
              <span>
                {unavailCount} หุ้นไม่สามารถดึงราคาได้ในขณะนี้ · ระบบจะลองใหม่อัตโนมัติทุก 30 วินาที
              </span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
