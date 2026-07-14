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
  analysis: string; // Markdown text in Thai
}
