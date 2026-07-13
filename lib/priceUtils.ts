import { TickerData, MarketState } from "../types/market";

/**
 * Returns the resolved display price details based on the current market session state.
 * PRE -> Pre-market
 * REGULAR -> Regular Market
 * POST -> After-hours (Post-market)
 * CLOSED -> Latest Close price
 * UNKNOWN -> Regular Market fallback (if exists)
 */
export function getDisplayPrice(ticker: TickerData) {
  const state = ticker.marketState || "UNKNOWN";
  
  let price: number = ticker.currentPrice || 0;
  let change: number = ticker.change24h || 0;
  let changePercent: number = ticker.change24h || 0;
  let sessionName = "Regular";

  if (state === "PRE") {
    if (ticker.preMarketPrice !== null) {
      price = ticker.preMarketPrice;
      change = ticker.preMarketChange ?? 0;
      changePercent = ticker.preMarketChangePercent ?? 0;
    }
    sessionName = "Pre-market";
  } else if (state === "REGULAR") {
    if (ticker.regularPrice !== null) {
      price = ticker.regularPrice;
      change = ticker.regularChange ?? 0;
      changePercent = ticker.regularChangePercent ?? 0;
    }
    sessionName = "Regular";
  } else if (state === "POST") {
    if (ticker.postMarketPrice !== null) {
      price = ticker.postMarketPrice;
      change = ticker.postMarketChange ?? 0;
      changePercent = ticker.postMarketChangePercent ?? 0;
    }
    sessionName = "After-hours";
  } else if (state === "CLOSED") {
    if (ticker.regularPrice !== null) {
      price = ticker.regularPrice;
      change = ticker.regularChange ?? 0;
      changePercent = ticker.regularChangePercent ?? 0;
    } else if (ticker.previousClose !== null) {
      price = ticker.previousClose;
      change = 0;
      changePercent = 0;
    }
    sessionName = "ราคาปิดล่าสุด";
  } else {
    // UNKNOWN state
    if (ticker.regularPrice !== null) {
      price = ticker.regularPrice;
      change = ticker.regularChange ?? 0;
      changePercent = ticker.regularChangePercent ?? 0;
    }
    sessionName = "Regular";
  }

  return {
    price,
    change,
    changePercent,
    sessionName,
    source: ticker.priceSource,
    timestamp: ticker.priceTimestamp,
  };
}
