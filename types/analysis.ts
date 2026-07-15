import { TickerData, IndicatorData, SupportResistanceData } from "./market";
import { NewsArticle } from "./news";
import { PriceProjectionData } from "./projection";

export interface SentimentData {
  fearAndGreed: {
    value: number;
    label: string;
  };
  fundingRate: number | null;
  openInterest: number | null;
  longShortRatio: number | null;
  overallSentiment: "Extreme Bullish" | "Bullish" | "Neutral" | "Bearish" | "Extreme Bearish";
  reasons: string[];
}

export type MultiTimeframeBias = "bullish" | "bearish" | "neutral";

export interface MultiTimeframeSnapshot {
  timeframe: "1D" | "4H" | "1H" | "15m" | "5m";
  status: "available" | "unavailable";
  bias?: MultiTimeframeBias;
  structure?: "uptrend" | "downtrend" | "sideways";
  priceAction?: "confirmed" | "watch" | "none";
  bos?: "bullish" | "bearish" | "none";
  rsi?: number;
}

/**
 * Top-down context for precious metals. The execution timeframe remains the
 * user-selected chart; these snapshots only gate its direction and quality.
 */
export interface MultiTimeframeAnalysis {
  mode: "top_down" | "scalping";
  alignment: "aligned" | "mixed" | "insufficient";
  directionalBias: MultiTimeframeBias;
  executionTimeframe: string;
  snapshots: MultiTimeframeSnapshot[];
}

export interface AnalyzeResponse {
  symbol: string;
  timeframe: string;
  tradingStyle: string;
  source: {
    price: string;
    chart: string;
    analysis: string;
  };
  updatedAt: string;
  marketData: TickerData;
  indicators: IndicatorData;
  supportResistance: SupportResistanceData;
  news: NewsArticle[];
  sentiment: SentimentData;
  priceProjection?: PriceProjectionData;
  multiTimeframe?: MultiTimeframeAnalysis;
  analysis: string; // Markdown text in Thai
}
