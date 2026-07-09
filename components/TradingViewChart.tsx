"use client";

import React, { useEffect, useRef } from "react";

interface TradingViewChartProps {
  symbol: string;
  interval: string;
  theme?: "dark" | "light";
}

declare global {
  interface Window {
    TradingView: any;
  }
}

function mapIntervalToTv(interval: string): string {
  const norm = interval.toLowerCase();
  if (norm === "5m") return "5";
  if (norm === "15m") return "15";
  if (norm === "1h") return "60";
  if (norm === "4h") return "240";
  if (norm === "1d") return "D";
  return "60";
}

function resolveTvSymbol(symbol: string): string {
  const sym = symbol.toUpperCase();
  // NYSE-listed stocks
  const nyseStocks = new Set([
    "V", "MA", "JPM", "GS", "BAC", "C", "WFC", "MS",
    "ABBV", "LLY", "UNH", "JNJ", "PFE", "MRK",
    "XOM", "CVX", "COP", "SLB",
    "DIS", "UBER", "LYFT",
    "NIO", "XPEV", "LI",
    "COIN", "HOOD", "SQ", "PYPL",
    "PLTR", "SOFI", "HOOD",
    "FSLR", "ENPH", "PLUG", "VRT",
    "SPY", "QQQ", "ARKK", "SOXL", "TQQQ",
  ]);
  if (nyseStocks.has(sym)) return `NYSE:${sym}`;
  // Default to NASDAQ
  return `NASDAQ:${sym}`;
}

export default function TradingViewChart({
  symbol,
  interval,
  theme = "dark",
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    const containerId = "tradingview-widget-container-id";
    if (containerRef.current) {
      containerRef.current.innerHTML = `<div id="${containerId}" class="w-full h-full" />`;
    }

    const initWidget = () => {
      if (typeof window !== "undefined" && window.TradingView) {
        widgetRef.current = new window.TradingView.widget({
          autosize: true,
          symbol: resolveTvSymbol(symbol),
          interval: mapIntervalToTv(interval),
          timezone: "Asia/Bangkok",
          theme: theme,
          style: "1",
          locale: "th",
          toolbar_bg: theme === "dark" ? "#131722" : "#f1f3f6",
          enable_publishing: false,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          container_id: containerId,
          // Hide top bar or custom layouts if needed, but defaults are good
          studies: [
            "RSI@tv-basicstudies",
            "MASimple@tv-basicstudies"
          ],
        });
      }
    };

    // Load TradingView script if not already present
    const existingScript = document.getElementById("tradingview-widget-script");
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "tradingview-widget-script";
      script.type = "text/javascript";
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = initWidget;
      document.head.appendChild(script);
    } else {
      // Script is loaded, check if TV is ready or wait briefly
      if (window.TradingView) {
        initWidget();
      } else {
        const intervalId = setInterval(() => {
          if (window.TradingView) {
            initWidget();
            clearInterval(intervalId);
          }
        }, 100);
        return () => clearInterval(intervalId);
      }
    }
  }, [symbol, interval, theme]);

  return (
    <div className="relative w-full h-[600px] md:h-[650px] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
