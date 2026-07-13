export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: "stock" | "etf" | "crypto" | "unknown";
}

export interface QuoteResult {
  symbol: string;
  status: "valid" | "invalid" | "unavailable";
  name?: string;
  price?: number;
  change?: number;
  changePercent?: number;
  error?: string;
}
