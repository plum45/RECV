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

export interface GoldPlaybookData {
  activeSession: "asia" | "london" | "new_york" | "london_new_york_overlap" | "off_peak";
  marketRegime: "trend" | "range";
  tradeState: "ready" | "wait" | "avoid";
  directionalBias: MultiTimeframeBias;
  setup: "asia_high_sweep_reclaim" | "asia_low_sweep_reclaim" | "vwap_continuation" | "range_no_trade" | "wait_for_confirmation";
  qualityScore: number;
  asiaRange?: { low: number; high: number; date: string };
  londonRange?: { low: number; high: number; date: string };
  macroRisk: boolean;
  checklist: Array<{ label: string; passed: boolean }>;
  guidance: string;
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
  goldPlaybook?: GoldPlaybookData;
  analysis: string; // Markdown text in Thai
}
