import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();

export async function GET() {
  try {
    const indices = [
      { symbol: "^GSPC", name: "S&P 500" },
      { symbol: "^IXIC", name: "NASDAQ" },
      { symbol: "^DJI", name: "DOW JONES" },
    ];

    const finnhubKey = process.env.FINNHUB_API_KEY;

    const results = await Promise.all(
      indices.map(async (idx) => {
        try {
          if (finnhubKey) {
            // Note: Finnhub uses different symbols for indices sometimes, but let's try mapping common ones
            const finnhubSymbol = idx.symbol === "^GSPC" ? "SPY" : idx.symbol === "^IXIC" ? "QQQ" : idx.symbol === "^DJI" ? "DIA" : idx.symbol;
            const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${finnhubSymbol}&token=${finnhubKey}`);
            const data = await res.json();
            
            if (data && data.c !== 0) {
              return {
                symbol: idx.symbol,
                name: idx.name,
                price: data.c,
                change: data.d,
                changePercent: data.dp,
              };
            }
          }

          // Fallback to Yahoo
          const quote = await yahooFinance.quote(idx.symbol);
          return {
            symbol: idx.symbol,
            name: idx.name,
            price: quote.regularMarketPrice || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
          };
        } catch (e: any) {
          console.error(`Failed to fetch index ${idx.symbol}:`, e.message || e);
          if (process.env.NODE_ENV === "production") {
            throw new Error(`Failed to fetch real-world quote for ${idx.symbol} in production`);
          }
          
          // Fallback if APIs fail (e.g. on Render without Finnhub key)
          const basePrices: Record<string, number> = {
            "^GSPC": 5450.00,
            "^IXIC": 17800.00,
            "^DJI": 39500.00,
          };
          const basePrice = basePrices[idx.symbol] || 1000;
          const changePercent = (Math.random() * 2) - 1; // -1% to +1%
          const change = (basePrice * changePercent) / 100;
          
          return {
            symbol: idx.symbol,
            name: idx.name,
            price: basePrice + change,
            change: change,
            changePercent: changePercent,
          };
        }
      })
    );

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch indices" }, { status: 500 });
  }
}
