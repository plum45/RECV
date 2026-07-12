"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface IndexData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export default function MarketIndices() {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const { data } = await axios.get("/api/market");
        setIndices(data);
      } catch (err) {
        console.error("Failed to fetch market indices", err);
      } finally {
        setLoading(false);
      }
    };
    fetchIndices();
    const interval = setInterval(fetchIndices, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 py-3 opacity-50 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 w-full bg-slate-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-2 xl:grid-cols-3">
      {indices.map((idx) => {
        const isUp = idx.change > 0;
        const isDown = idx.change < 0;
        const color = isUp ? "text-emerald-400" : isDown ? "text-rose-400" : "text-slate-400";
        const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

        return (
          <div
            key={idx.symbol}
            className="min-w-0 px-4 py-3.5 bg-slate-800/40 backdrop-blur-md rounded-2xl border border-slate-700/50 flex flex-col justify-between"
          >
            <div className="text-xs font-semibold text-slate-400 tracking-wider">
              {idx.name}
            </div>
            <div className="flex items-end justify-between mt-1">
              <span className="text-lg font-bold text-slate-100">
                {idx.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <div className={`flex items-center text-xs font-semibold ${color}`}>
                <Icon size={14} className="mr-1" />
                {idx.changePercent > 0 ? "+" : ""}
                {idx.changePercent.toFixed(2)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
