import axios from "axios";
import { TickerData, KlineData } from "../types/market";

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
  return {
    symbol: cleanSymbol,
    currentPrice: baseline,
    high24h: baseline * 1.025,
    low24h: baseline * 0.978,
    volume24h: 35000000 + Math.floor(Math.random() * 20000000),
    change24h: 1.45,
    marketState: isStock ? "POST" : "REGULAR",
    prePostPrice: isStock ? baseline * 1.008 : undefined,
    prePostChange: isStock ? 0.8 : undefined,
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

export async function getKlines(
  symbol: string,
  interval: string,
  limit: number = 200
): Promise<KlineData[]> {
  try {
    const cleanSymbol = symbol.toUpperCase().trim();
    const { yfInterval, range } = mapTimeframeToYf(interval);
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanSymbol}?interval=${yfInterval}&range=${range}`;
    const response = await axios.get<any>(url, { headers: YF_HEADERS, timeout: 5000 });

    const result = response.data?.chart?.result?.[0];
    if (!result) {
      throw new Error(`No data found for symbol: ${cleanSymbol}`);
    }

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0];
    if (!quote || !quote.close) {
      throw new Error(`Invalid quote structure from Yahoo Finance for ${cleanSymbol}`);
    }

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

    const slicedKlines = klines.slice(-limit);
    if (slicedKlines.length === 0) {
      throw new Error(`No valid price data returned for ${cleanSymbol}`);
    }

    return slicedKlines;
  } catch (error: any) {
    console.warn(`Yahoo Finance chart fetch failed for ${symbol}, falling back to mock data:`, error.message);
    return getMockKlines(symbol, interval, limit);
  }
}

export async function getTicker(symbol: string): Promise<TickerData> {
  try {
    const cleanSymbol = symbol.toUpperCase().trim();
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanSymbol}?interval=1d&range=5d`;
    const response = await axios.get<any>(url, { headers: YF_HEADERS, timeout: 4000 });

    const result = response.data?.chart?.result?.[0];
    if (!result || !result.meta) {
      throw new Error(`No ticker meta found for symbol: ${cleanSymbol}`);
    }

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];

    const closeArray = quote?.close || [];
    const lastValidClose = closeArray.filter((c: any) => c !== null).pop();

    const currentPrice = meta.regularMarketPrice || lastValidClose || 0;
    const prevClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
    const change24h = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0;
    
    const marketState = meta.currentMarketState || "REGULAR";
    const preMarketPrice = meta.preMarketPrice || null;
    const postMarketPrice = meta.postMarketPrice || null;
    
    let prePostPrice = undefined;
    let prePostChange = undefined;
    
    if (marketState === "PRE" && preMarketPrice) {
      prePostPrice = preMarketPrice;
      prePostChange = currentPrice > 0 ? ((preMarketPrice - currentPrice) / currentPrice) * 100 : 0;
    } else if ((marketState === "POST" || marketState === "CLOSED") && postMarketPrice) {
      prePostPrice = postMarketPrice;
      prePostChange = currentPrice > 0 ? ((postMarketPrice - currentPrice) / currentPrice) * 100 : 0;
    }

    return {
      symbol: cleanSymbol,
      currentPrice: currentPrice,
      high24h: meta.regularMarketDayHigh || currentPrice,
      low24h: meta.regularMarketDayLow || currentPrice,
      volume24h: meta.regularMarketVolume || 0,
      change24h: change24h,
      marketState,
      prePostPrice: prePostPrice || undefined,
      prePostChange: prePostChange || undefined,
    };
  } catch (error: any) {
    console.warn(`Yahoo Finance quote fetch failed for ${symbol}, falling back to mock data:`, error.message);
    return getMockTicker(symbol);
  }
}

export async function getFundingRate(symbol: string): Promise<number | null> {
  return null;
}

export async function getOpenInterest(symbol: string): Promise<number | null> {
  return null;
}
