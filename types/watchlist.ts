export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: "stock" | "etf" | "crypto" | "commodity" | "unknown";
}

import type { MarketState } from "./market";

export interface QuoteResult {
  symbol: string;
  status: "valid" | "invalid" | "unavailable";
  name?: string;
  price?: number;
  change?: number;
  changePercent?: number;
  
  // Extended pricing fields
  regularPrice?: number | null;
  regularChange?: number | null;
  regularChangePercent?: number | null;
  
  preMarketPrice?: number | null;
  preMarketChange?: number | null;
  preMarketChangePercent?: number | null;
  
  postMarketPrice?: number | null;
  postMarketChange?: number | null;
  postMarketChangePercent?: number | null;
  
  previousClose?: number | null;
  marketState?: MarketState;
  priceSource?: string;
  priceTimestamp?: string;
  isDelayed?: boolean;
  error?: string;
  errorReason?: string;
}
