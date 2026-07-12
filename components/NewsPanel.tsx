"use client";

import React from "react";
import { NewsArticle } from "../types/news";
import { Newspaper, ExternalLink, HelpCircle } from "lucide-react";

interface NewsPanelProps {
  news: NewsArticle[];
  loading: boolean;
  symbol?: string;
}

export default function NewsPanel({ news, loading, symbol }: NewsPanelProps) {
  if (loading) {
    return (
      <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl animate-pulse space-y-4">
        <div className="h-6 bg-slate-800 rounded w-1/3"></div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-slate-800 rounded-xl"></div>
        ))}
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl text-center">
        <p className="text-slate-500 text-sm">ไม่พบข่าวสารล่าสุดในขณะนี้</p>
      </div>
    );
  }

  const getSentimentBadge = (sent: NewsArticle["sentiment"]) => {
    switch (sent) {
      case "positive":
        return <span className="bg-emerald-950/80 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-800/30">Bullish</span>;
      case "negative":
        return <span className="bg-rose-950/80 text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-800/30">Bearish</span>;
      case "neutral":
        return <span className="bg-slate-900 text-slate-400 text-[10px] font-medium px-2 py-0.5 rounded border border-slate-800">Neutral</span>;
      case "uncertain":
        return <span className="bg-amber-950/80 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-800/30">Uncertain</span>;
      default:
        return null;
    }
  };

  const getImpactBadge = (impact: NewsArticle["impact"]) => {
    switch (impact) {
      case "long-term":
        return <span className="bg-indigo-950 text-indigo-300 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-indigo-800/20">ระยะยาว (Long-Term)</span>;
      case "short-term":
        return <span className="bg-cyan-950 text-cyan-300 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-cyan-800/20">ระยะสั้น (Short-Term)</span>;
      case "catalyst":
        return <span className="bg-violet-950 text-violet-300 text-[9px] font-bold px-1.5 py-0.5 rounded border border-violet-800/20">ตัวเร่งราคา (Catalyst)</span>;
      case "noise":
        return <span className="bg-slate-900/60 text-slate-400 text-[9px] px-1.5 py-0.5 rounded border border-slate-800/40">สัญญาณรบกวน (Noise)</span>;
      default:
        return null;
    }
  };

  const getPriceInBadge = (priceIn: NewsArticle["isPriceIn"]) => {
    if (priceIn === true) {
      return <span className="bg-slate-950 text-slate-400 text-[9px] px-1.5 py-0.5 rounded border border-slate-800">Price In แล้ว</span>;
    }
    if (priceIn === false) {
      return <span className="bg-amber-950/50 text-amber-300 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-amber-800/20">ยังไม่ Price In</span>;
    }
    return <span className="bg-slate-950 text-slate-500 text-[9px] px-1.5 py-0.5 rounded border border-slate-900">รอประเมิน (Price-in?)</span>;
  };

  // Check if it's the free/RSS or fallback notice
  const hasNewsApiKey = process.env.NEXT_PUBLIC_HAS_NEWS_API === "true" || true;

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Newspaper size={18} className="text-indigo-400" />
          ข่าวสารล่าสุด & ปัจจัยข่าว {symbol && `(${symbol})`}
        </h3>
        {!hasNewsApiKey && (
          <span className="text-[10px] text-amber-400 font-semibold bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/30 flex items-center gap-1">
            <HelpCircle size={10} />
            RSS Mode
          </span>
        )}
      </div>

      <div className="space-y-3.5">
        {news.map((item, idx) => {
          const date = new Date(item.publishedAt);
          const formattedDate = date.toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
          }) + " | " + date.toLocaleDateString("th-TH", {
            day: "2-digit",
            month: "short",
          });

          return (
            <div
              key={idx}
              className="bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 transition-all duration-200 space-y-2.5"
            >
              <div className="flex justify-between items-start gap-4">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-slate-100 hover:text-indigo-400 leading-snug transition-colors flex items-start gap-1 group"
                >
                  <span className="flex-1">{item.title}</span>
                  <ExternalLink size={12} className="text-slate-500 group-hover:text-indigo-400 mt-1 shrink-0 transition-colors" />
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 border-t border-slate-900/80 text-[10px] text-slate-400">
                <span className="font-semibold text-slate-300">{item.source}</span>
                <span>•</span>
                <span>{formattedDate}</span>
                <span className="flex items-center gap-1 flex-wrap mt-0.5 sm:mt-0 sm:ml-auto">
                  {getSentimentBadge(item.sentiment)}
                  {getImpactBadge(item.impact)}
                  {getPriceInBadge(item.isPriceIn)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
