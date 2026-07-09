"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Globe, Clock } from "lucide-react";
import { NewsArticle } from "../types/news";

export default function NewsMarquee() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        // Fetch news for general market (using SPY as a proxy for US Market)
        const { data } = await axios.get("/api/news?symbol=SPY");
        if (data && Array.isArray(data)) {
          setNews(data.slice(0, 10)); // Take top 10 news
        }
      } catch (err) {
        console.error("Failed to fetch marquee news", err);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  if (loading || news.length === 0) return null;

  return (
    <div className="w-full bg-slate-900/40 border-y border-slate-800/60 py-3 flex items-center overflow-hidden relative">
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-slate-950 to-transparent z-10 flex items-center pl-4">
        <Globe size={18} className="text-indigo-400" />
      </div>
      
      {/* Marquee Container */}
      <div className="flex whitespace-nowrap animate-marquee hover:pause pl-14">
        {[...news, ...news].map((article, idx) => (
          <a
            key={`${article.url}-${idx}`}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center mx-4 gap-2 text-sm text-slate-300 hover:text-indigo-300 transition-colors"
          >
            <span className="font-semibold text-slate-400">[{article.source}]</span>
            <span>{article.title}</span>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700 mx-2" />
          </a>
        ))}
      </div>

      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-slate-950 to-transparent z-10" />
    </div>
  );
}
