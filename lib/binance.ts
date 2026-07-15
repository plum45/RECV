import axios from "axios";
import { TickerData, KlineData, MarketState } from "../types/market";

export function normalizeSymbol(symbol: string): string {
  if (!symbol || typeof symbol !== "string") return "NVDA";
  let clean = symbol.toUpperCase().trim();

  // Support Thai stock suffix mapping or clean up double dots
  clean = clean.replace(/\.+/g, ".");

  // Check if it's a known crypto ticker and normalize to BASE-USD
  // e.g. BTCUSDT -> BTC-USD, btc-usd -> BTC-USD, BTC -> BTC-USD
  const cryptoMatch = clean.match(/^(BTC|ETH|SOL|BNB|ADA|XRP|DOT|DOGE|LTC|LINK)(USDT|-USD|USD)?$/);
  if (cryptoMatch) {
    return `${cryptoMatch[1]}-USD`;
  }

  return clean;
}

// Windows Chrome User-Agent to match standard browser requests
const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache"
};

function getBaselinePrice(symbol: string): number {
  const sym = symbol.toUpperCase().trim();
  const prices: Record<string, number> = {
    // Mega Cap Tech
    AAPL: 193.50, MSFT: 415.20, GOOGL: 178.30, AMZN: 185.40,
    META: 502.60, NFLX: 645.80, ORCL: 128.70, CRM: 267.40,
    // AI & Semiconductors
    NVDA: 122.80, AMD: 158.40, INTC: 21.50, QCOM: 162.30,
    AVGO: 230.50, MU: 118.60, ARM: 132.40, SMCI: 38.90,
    MRVL: 67.80, MCHP: 68.40, VRT: 148.20, PLTR: 118.20,
    // High-Growth Tech
    TSLA: 262.50, SHOP: 118.30, SNOW: 148.20, DDOG: 128.50,
    NET: 112.40, CRWD: 460.30, ZS: 238.70, MNDY: 298.40,
    BILL: 52.80, GTLB: 54.20, PATH: 14.80, AI: 28.50,
    // EV & Clean Energy
    RIVN: 14.20, LCID: 2.85, NIO: 4.65, XPEV: 16.80,
    LI: 22.40, PLUG: 2.15, FSLR: 168.30, ENPH: 68.90,
    // Finance & Fintech
    JPM: 248.60, GS: 582.40, V: 288.30, MA: 498.70,
    SQ: 68.40, PYPL: 71.20, COIN: 248.50, HOOD: 42.30, SOFI: 13.20,
    // Healthcare & Biotech
    LLY: 842.30, MRNA: 35.60, BNTX: 98.40, ABBV: 192.80,
    UNH: 298.60, ISRG: 524.30, DXCM: 72.40,
    // Consumer & Media
    DIS: 98.40, RBLX: 48.20, SPOT: 528.40, UBER: 82.60,
    LYFT: 14.80, ABNB: 128.50, DASH: 185.20,
    // ETFs
    QQQ: 524.30, SPY: 572.80, ARKK: 52.40, SOXL: 28.60, TQQQ: 72.80,
  };
  return prices[sym] ?? 100.00;
}

function getMockTicker(symbol: string): TickerData {
  const cleanSymbol = symbol.toUpperCase().trim();
  const baseline = getBaselinePrice(cleanSymbol);
  const isStock = !cleanSymbol.endsWith("-USD");
  const previousClose = baseline * 0.99;
  return {
    symbol: cleanSymbol,
    currentPrice: baseline,
    high24h: baseline * 1.025,
    low24h: baseline * 0.978,
    volume24h: 35000000,
    change24h: 1.45,
    regularPrice: baseline,
    regularChange: baseline - previousClose,
    regularChangePercent: ((baseline - previousClose) / previousClose) * 100,
    preMarketPrice: isStock ? baseline * 1.008 : null,
    preMarketChange: isStock ? baseline * 1.008 - previousClose : null,
    preMarketChangePercent: isStock ? ((baseline * 1.008 - previousClose) / previousClose) * 100 : null,
    postMarketPrice: isStock ? baseline * 1.015 : null,
    postMarketChange: isStock ? baseline * 1.015 - previousClose : null,
    postMarketChangePercent: isStock ? ((baseline * 1.015 - previousClose) / previousClose) * 100 : null,
    previousClose: previousClose,
    marketState: isStock ? "POST" : "REGULAR",
    priceSource: "Mock Provider",
    priceTimestamp: new Date().toISOString(),
    isDelayed: false,
  };
}

function getMockKlines(symbol: string, interval: string, limit: number): KlineData[] {
  const cleanSymbol = symbol.toUpperCase().trim();
  const baseline = getBaselinePrice(cleanSymbol);
  const klines: KlineData[] = [];
  const now = Date.now();
  
  let intervalMs = 60 * 60 * 1000; // 1H default
  const norm = interval.toLowerCase();
  if (norm === "5m") intervalMs = 5 * 60 * 1000;
  else if (norm === "15m") intervalMs = 15 * 60 * 1000;
  else if (norm === "1d") intervalMs = 24 * 60 * 60 * 1000;

  for (let i = limit; i > 0; i--) {
    const time = now - i * intervalMs;
    // Generate a realistic random walk price wave for chart overlay
    const angle = (limit - i) / 8;
    const trend = Math.sin(angle) * 0.04 + (Math.sin(angle / 3) * 0.02) + ((limit - i) * 0.0003);
    const close = baseline * (0.95 + trend);
    const open = close * (1 + (Math.random() - 0.5) * 0.006);
    const high = Math.max(open, close) * (1 + Math.random() * 0.004);
    const low = Math.min(open, close) * (1 - Math.random() * 0.004);

    klines.push({
      openTime: time,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(250000 + Math.random() * 850000),
      closeTime: time + intervalMs,
    });
  }
  return klines;
}

// Map Next.js interval selections to Yahoo Finance intervals and historical ranges
function mapTimeframeToYf(interval: string): { yfInterval: string; range: string } {
  const norm = interval.toLowerCase();
  switch (norm) {
    case "5m":
      return { yfInterval: "5m", range: "5d" };
    case "15m":
      return { yfInterval: "15m", range: "10d" };
    case "1h":
    case "4h":
      return { yfInterval: "60m", range: "3mo" };
    case "1d":
      return { yfInterval: "1d", range: "2y" };
    default:
      return { yfInterval: "1d", range: "2y" };
  }
}

function aggregateCandles(klines: KlineData[], hours: number): KlineData[] {
  const bucketMs = hours * 60 * 60 * 1000;
  const buckets = new Map<number, KlineData[]>();
  for (const candle of klines) {
    const bucket = Math.floor(candle.openTime / bucketMs) * bucketMs;
    const group = buckets.get(bucket) || [];
    group.push(candle);
    buckets.set(bucket, group);
  }
  return [...buckets.entries()].sort(([a], [b]) => a - b).map(([openTime, group]) => ({
    openTime,
    open: group[0].open,
    high: Math.max(...group.map((c) => c.high)),
    low: Math.min(...group.map((c) => c.low)),
    close: group[group.length - 1].close,
    volume: group.reduce((sum, c) => sum + c.volume, 0),
    closeTime: openTime + bucketMs,
  }));
}

// Helper to map symbol for Finnhub
function getFinnhubSymbolInfo(symbol: string): { symbol: string; isCrypto: boolean } {
  const clean = symbol.toUpperCase().trim();
  if (clean.includes("-USD") || clean.includes("USDT") || ["BTC", "ETH", "SOL", "BNB"].includes(clean)) {
    const base = clean.replace("-USD", "").replace("USDT", "");
    return { symbol: `BINANCE:${base}USDT`, isCrypto: true };
  }
  return { symbol: clean, isCrypto: false };
}

// Map Next.js interval selections to Finnhub resolutions
function mapTimeframeToFinnhub(interval: string): { res: string; daysBack: number } {
  const norm = interval.toLowerCase();
  switch (norm) {
    case "5m": return { res: "5", daysBack: 5 };
    case "15m": return { res: "15", daysBack: 10 };
    case "1h":
    case "4h": return { res: "60", daysBack: 35 };
    case "1d": return { res: "D", daysBack: 365 };
    default: return { res: "D", daysBack: 365 };
  }
}

export async function getKlines(
  symbol: string,
  interval: string,
  limit: number = 200
): Promise<KlineData[]> {
  const cleanSymbol = symbol.toUpperCase().trim();
  const finnhubKey = process.env.FINNHUB_API_KEY;
  const yahooOnlySymbol = ["XAUUSD=X", "XAGUSD=X"].includes(cleanSymbol);

  // 1. Try Finnhub first if API key is configured
  if (finnhubKey && !yahooOnlySymbol) {
    try {
      const { symbol: fhSymbol, isCrypto } = getFinnhubSymbolInfo(cleanSymbol);
      const { res, daysBack } = mapTimeframeToFinnhub(interval);
      const toTs = Math.floor(Date.now() / 1000);
      const fromTs = toTs - daysBack * 24 * 60 * 60;

      const endpoint = isCrypto ? "crypto/candle" : "stock/candle";
      const url = `https://finnhub.io/api/v1/${endpoint}?symbol=${encodeURIComponent(fhSymbol)}&resolution=${res}&from=${fromTs}&to=${toTs}&token=${finnhubKey}`;
      
      const response = await axios.get<any>(url, { timeout: 4500 });
      const data = response.data;

      if (data && data.s === "ok" && Array.isArray(data.t) && data.t.length > 0) {
        const klines: KlineData[] = [];
        for (let i = 0; i < data.t.length; i++) {
          if (data.o[i] !== null && data.c[i] !== null) {
            klines.push({
              openTime: data.t[i] * 1000,
              open: parseFloat(data.o[i]),
              high: parseFloat(data.h[i]),
              low: parseFloat(data.l[i]),
              close: parseFloat(data.c[i]),
              volume: parseFloat(data.v?.[i] || "100000"),
              closeTime: (data.t[i] + 60) * 1000,
            });
          }
        }

        if (klines.length > 0) {
          const normalizedKlines = interval.toLowerCase() === "4h" ? aggregateCandles(klines, 4) : klines;
          return normalizedKlines.slice(-limit);
        }
      }
    } catch (err: any) {
      console.warn(`Finnhub kline fetch failed for ${cleanSymbol}, falling back to Yahoo Finance:`, err.message);
    }
  }

  // 2. Fallback to Yahoo Finance
  try {
    const { yfInterval, range } = mapTimeframeToYf(interval);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanSymbol}?interval=${yfInterval}&range=${range}`;
    const response = await axios.get<any>(url, { headers: YF_HEADERS, timeout: 4500 });

    const result = response.data?.chart?.result?.[0];
    if (!result) throw new Error(`No data found from Yahoo Finance for ${cleanSymbol}`);

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0];
    if (!quote || !quote.close) throw new Error(`Invalid quote structure from Yahoo Finance for ${cleanSymbol}`);

    const klines: KlineData[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (
        quote.open?.[i] !== null &&
        quote.high?.[i] !== null &&
        quote.low?.[i] !== null &&
        quote.close?.[i] !== null
      ) {
        klines.push({
          openTime: timestamps[i] * 1000,
          open: parseFloat(quote.open[i]),
          high: parseFloat(quote.high[i]),
          low: parseFloat(quote.low[i]),
          close: parseFloat(quote.close[i]),
          volume: parseFloat(quote.volume?.[i] || "0"),
          closeTime: (timestamps[i] + 60) * 1000,
        });
      }
    }

    const normalizedKlines = interval.toLowerCase() === "4h" ? aggregateCandles(klines, 4) : klines;
    const slicedKlines = normalizedKlines.slice(-limit);
    if (slicedKlines.length > 0) return slicedKlines;
    throw new Error(`No valid klines returned from Yahoo Finance for ${cleanSymbol}`);
  } catch (error: any) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ไม่สามารถดึงข้อมูลตลาดล่าสุดได้ (All API fetches failed for historical charts)");
    }
    console.warn(`All API chart fetches failed for ${cleanSymbol}; using simulated realistic market data:`, error.message);
    return getMockKlines(cleanSymbol, interval, limit);
  }
}

export async function getTicker(symbol: string): Promise<TickerData> {
  const cleanSymbol = symbol.toUpperCase().trim();
  const finnhubKey = process.env.FINNHUB_API_KEY;
  const yahooOnlySymbol = ["XAUUSD=X", "XAGUSD=X"].includes(cleanSymbol);

  // 1. Try Finnhub first if API key is configured
  if (finnhubKey && !yahooOnlySymbol) {
    try {
      const { symbol: fhSymbol } = getFinnhubSymbolInfo(cleanSymbol);
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(fhSymbol)}&token=${finnhubKey}`;
      const response = await axios.get<any>(url, { timeout: 3500 });
      const data = response.data;

      if (data && typeof data.c === "number" && data.c > 0) {
        const currentPrice = data.c;
        const prevClose = data.pc > 0 ? data.pc : currentPrice;
        const change24h = data.dp ?? ((currentPrice - prevClose) / prevClose) * 100;
        
        return {
          symbol: cleanSymbol,
          currentPrice: currentPrice,
          high24h: data.h || currentPrice * 1.02,
          low24h: data.l || currentPrice * 0.98,
          volume24h: 5000000,
          change24h: change24h,
          
          regularPrice: currentPrice,
          regularChange: currentPrice - prevClose,
          regularChangePercent: change24h,
          
          preMarketPrice: null,
          preMarketChange: null,
          preMarketChangePercent: null,
          
          postMarketPrice: null,
          postMarketChange: null,
          postMarketChangePercent: null,
          
          previousClose: prevClose,
          marketState: cleanSymbol.includes("-USD") ? "REGULAR" : "REGULAR",
          priceSource: "Finnhub API",
          priceTimestamp: new Date().toISOString(),
          isDelayed: false,
        };
      }
    } catch (err: any) {
      console.warn(`Finnhub quote fetch failed for ${cleanSymbol}, falling back to Yahoo Finance:`, err.message);
    }
  }

  // 2. Fallback to Yahoo Finance
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanSymbol}?interval=1d&range=5d`;
    const response = await axios.get<any>(url, { headers: YF_HEADERS, timeout: 4000 });

    const result = response.data?.chart?.result?.[0];
    if (!result || !result.meta) throw new Error(`No ticker meta found for symbol: ${cleanSymbol}`);

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];
    const closeArray = quote?.close || [];
    const lastValidClose = closeArray.filter((c: any) => c !== null).pop();

    const previousClose = meta.chartPreviousClose || meta.previousClose || lastValidClose || 0;
    const regularPrice = meta.regularMarketPrice || lastValidClose || 0;
    const regularChange = regularPrice - previousClose;
    const regularChangePercent = previousClose > 0 ? (regularChange / previousClose) * 100 : 0;
    
    // Parse marketState cleanly to match target states
    let marketState: MarketState = "UNKNOWN";
    const rawState = (meta.currentMarketState || "").toUpperCase();
    if (rawState.includes("PRE")) marketState = "PRE";
    else if (rawState.includes("REGULAR") || rawState.includes("LIVE") || rawState.includes("OPEN")) marketState = "REGULAR";
    else if (rawState.includes("POST")) marketState = "POST";
    else if (rawState.includes("CLOSED")) marketState = "CLOSED";
    
    // Extract Pre / Post market values
    const preMarketPrice = meta.preMarketPrice || null;
    const preMarketChange = preMarketPrice && previousClose ? preMarketPrice - previousClose : null;
    const preMarketChangePercent = preMarketChange && previousClose ? (preMarketChange / previousClose) * 100 : null;

    const postMarketPrice = meta.postMarketPrice || null;
    const postMarketChange = postMarketPrice && previousClose ? postMarketPrice - previousClose : null;
    const postMarketChangePercent = postMarketChange && previousClose ? (postMarketChange / previousClose) * 100 : null;

    // Determine currentPrice based on resolved state
    let currentPrice = regularPrice;
    if (marketState === "PRE" && preMarketPrice !== null) currentPrice = preMarketPrice;
    else if (marketState === "POST" && postMarketPrice !== null) currentPrice = postMarketPrice;

    return {
      symbol: cleanSymbol,
      currentPrice: currentPrice,
      high24h: meta.regularMarketDayHigh || currentPrice,
      low24h: meta.regularMarketDayLow || currentPrice,
      volume24h: meta.regularMarketVolume || 0,
      change24h: regularChangePercent,
      
      regularPrice,
      regularChange,
      regularChangePercent,
      
      preMarketPrice,
      preMarketChange,
      preMarketChangePercent,
      
      postMarketPrice,
      postMarketChange,
      postMarketChangePercent,
      
      previousClose,
      marketState,
      priceSource: "Yahoo Finance",
      priceTimestamp: new Date().toISOString(),
      isDelayed: meta.dataGranularity === "1d",
    };
  } catch (error: any) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ไม่สามารถดึงข้อมูลตลาดล่าสุดได้ (All API fetches failed for ticker quotes)");
    }
    console.warn(`All API quote fetches failed for ${cleanSymbol}; using simulated realistic market data:`, error.message);
    return getMockTicker(cleanSymbol);
  }
}

export async function getFundingRate(symbol: string): Promise<number | null> {
  return null;
}

export async function getOpenInterest(symbol: string): Promise<number | null> {
  return null;
}
