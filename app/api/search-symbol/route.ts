import { NextResponse } from "next/server";
import type { SearchResult } from "../../../types/watchlist";

export const runtime = "nodejs";

// Built-in stock catalog (from SymbolSelector) for offline/fallback search
const BUILTIN_STOCKS: SearchResult[] = [
  // Mega Cap Tech
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", type: "stock" },
  { symbol: "GOOGL", name: "Alphabet Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "AMZN", name: "Amazon.com Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "META", name: "Meta Platforms Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "NFLX", name: "Netflix Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "ORCL", name: "Oracle Corporation", exchange: "NYSE", type: "stock" },
  { symbol: "CRM", name: "Salesforce Inc.", exchange: "NYSE", type: "stock" },
  // AI & Semiconductors
  { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", type: "stock" },
  { symbol: "AMD", name: "Advanced Micro Devices Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "INTC", name: "Intel Corporation", exchange: "NASDAQ", type: "stock" },
  { symbol: "QCOM", name: "Qualcomm Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "AVGO", name: "Broadcom Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "MU", name: "Micron Technology Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "ARM", name: "Arm Holdings plc", exchange: "NASDAQ", type: "stock" },
  { symbol: "SMCI", name: "Super Micro Computer Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "MRVL", name: "Marvell Technology Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "PLTR", name: "Palantir Technologies Inc.", exchange: "NYSE", type: "stock" },
  // High-Growth Tech
  { symbol: "TSLA", name: "Tesla Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "SHOP", name: "Shopify Inc.", exchange: "NYSE", type: "stock" },
  { symbol: "SNOW", name: "Snowflake Inc.", exchange: "NYSE", type: "stock" },
  { symbol: "DDOG", name: "Datadog Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "NET", name: "Cloudflare Inc.", exchange: "NYSE", type: "stock" },
  { symbol: "CRWD", name: "CrowdStrike Holdings Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "ZS", name: "Zscaler Inc.", exchange: "NASDAQ", type: "stock" },
  // EV & Clean Energy
  { symbol: "RIVN", name: "Rivian Automotive Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "LCID", name: "Lucid Group Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "NIO", name: "NIO Inc.", exchange: "NYSE", type: "stock" },
  { symbol: "FSLR", name: "First Solar Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "ENPH", name: "Enphase Energy Inc.", exchange: "NASDAQ", type: "stock" },
  // Finance & Fintech
  { symbol: "JPM", name: "JPMorgan Chase & Co.", exchange: "NYSE", type: "stock" },
  { symbol: "GS", name: "Goldman Sachs Group Inc.", exchange: "NYSE", type: "stock" },
  { symbol: "V", name: "Visa Inc.", exchange: "NYSE", type: "stock" },
  { symbol: "MA", name: "Mastercard Inc.", exchange: "NYSE", type: "stock" },
  { symbol: "SQ", name: "Block Inc.", exchange: "NYSE", type: "stock" },
  { symbol: "PYPL", name: "PayPal Holdings Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "COIN", name: "Coinbase Global Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "HOOD", name: "Robinhood Markets Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "SOFI", name: "SoFi Technologies Inc.", exchange: "NASDAQ", type: "stock" },
  // Healthcare & Biotech
  { symbol: "LLY", name: "Eli Lilly and Company", exchange: "NYSE", type: "stock" },
  { symbol: "MRNA", name: "Moderna Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "ABBV", name: "AbbVie Inc.", exchange: "NYSE", type: "stock" },
  { symbol: "UNH", name: "UnitedHealth Group Inc.", exchange: "NYSE", type: "stock" },
  { symbol: "ISRG", name: "Intuitive Surgical Inc.", exchange: "NASDAQ", type: "stock" },
  // Consumer & Media
  { symbol: "DIS", name: "The Walt Disney Company", exchange: "NYSE", type: "stock" },
  { symbol: "RBLX", name: "Roblox Corporation", exchange: "NYSE", type: "stock" },
  { symbol: "SPOT", name: "Spotify Technology S.A.", exchange: "NYSE", type: "stock" },
  { symbol: "UBER", name: "Uber Technologies Inc.", exchange: "NYSE", type: "stock" },
  { symbol: "ABNB", name: "Airbnb Inc.", exchange: "NASDAQ", type: "stock" },
  // ETFs
  { symbol: "QQQ", name: "Invesco QQQ Trust (Nasdaq-100)", exchange: "NASDAQ", type: "etf" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", exchange: "NYSE", type: "etf" },
  { symbol: "ARKK", name: "ARK Innovation ETF", exchange: "NYSE", type: "etf" },
  { symbol: "SOXL", name: "Direxion Semiconductors 3x Bull", exchange: "NYSE", type: "etf" },
  { symbol: "TQQQ", name: "ProShares UltraPro QQQ 3x", exchange: "NASDAQ", type: "etf" },
  // Precious metals
  { symbol: "GC=F", name: "Gold Futures (ทองคำ)", exchange: "COMEX", type: "commodity" },
  { symbol: "SI=F", name: "Silver Futures (เงิน)", exchange: "COMEX", type: "commodity" },
  // Crypto
  { symbol: "BTC-USD", name: "Bitcoin USD", exchange: "Crypto", type: "crypto" },
  { symbol: "ETH-USD", name: "Ethereum USD", exchange: "Crypto", type: "crypto" },
  { symbol: "SOL-USD", name: "Solana USD", exchange: "Crypto", type: "crypto" },
  { symbol: "BNB-USD", name: "Binance Coin USD", exchange: "Crypto", type: "crypto" },
  { symbol: "XRP-USD", name: "Ripple USD", exchange: "Crypto", type: "crypto" },
  { symbol: "DOGE-USD", name: "Dogecoin USD", exchange: "Crypto", type: "crypto" },
];

function searchBuiltIn(query: string, limit: number): SearchResult[] {
  const q = query.toUpperCase();
  const qLower = query.toLowerCase();

  return BUILTIN_STOCKS.filter((s) => {
    return (
      s.symbol.includes(q) ||
      s.name.toLowerCase().includes(qLower)
    );
  })
    // Exact symbol match first, then prefix match, then contains
    .sort((a, b) => {
      const aExact = a.symbol === q ? 0 : 1;
      const bExact = b.symbol === q ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;

      const aPrefix = a.symbol.startsWith(q) ? 0 : 1;
      const bPrefix = b.symbol.startsWith(q) ? 0 : 1;
      return aPrefix - bPrefix;
    })
    .slice(0, limit);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 20);

    if (query.length < 2) {
      return NextResponse.json(
        { error: "คำค้นต้องมีอย่างน้อย 2 ตัวอักษร", results: [] },
        { status: 400 }
      );
    }

    // Try Yahoo Finance search first
    let yahooResults: SearchResult[] = [];
    try {
      const YahooFinance = (await import("yahoo-finance2")).default;
      const yahooFinance = new YahooFinance();
      const searchResult = await yahooFinance.search(query, { newsCount: 0, quotesCount: limit });

      if (searchResult?.quotes && Array.isArray(searchResult.quotes)) {
        yahooResults = searchResult.quotes
          .filter((q: any) => q.symbol && q.quoteType !== "OPTION")
          .map((q: any) => ({
            symbol: q.symbol,
            name: q.shortname || q.longname || q.symbol,
            exchange: q.exchange || q.exchDisp || "Unknown",
            type: (q.quoteType === "ETF"
              ? "etf"
              : q.quoteType === "CRYPTOCURRENCY"
                ? "crypto"
                : q.quoteType === "FUTURE"
                  ? "commodity"
                  : "stock") as SearchResult["type"],
          }))
          .slice(0, limit);
      }
    } catch (yahooErr: any) {
      console.warn("Yahoo Finance search failed, using built-in catalog:", yahooErr.message);
    }

    // If Yahoo returned results, use those; otherwise fallback to built-in
    const results = yahooResults.length > 0
      ? yahooResults
      : searchBuiltIn(query, limit);

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("Search Symbol API Error:", error.message);
    return NextResponse.json(
      { error: "ไม่สามารถค้นหาได้ในขณะนี้", results: [] },
      { status: 500 }
    );
  }
}
