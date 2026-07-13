import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { normalizeSymbol } from "../../../lib/binance";
const yahooFinance = new YahooFinance();

export async function POST(request: Request) {
  try {
    const { symbols } = await request.json();
    if (!symbols || !Array.isArray(symbols)) {
      return NextResponse.json({ error: "Invalid symbols array" }, { status: 400 });
    }

    const finnhubKey = process.env.FINNHUB_API_KEY;

    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const upperSymbol = normalizeSymbol(symbol);
        try {
          if (finnhubKey) {
            // Use Finnhub API if key is provided
            const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${upperSymbol}&token=${finnhubKey}`);
            const data = await res.json();
            
            if (data && data.c !== 0) {
              return {
                symbol: upperSymbol,
                name: upperSymbol,
                price: data.c, // Current price
                change: data.d, // Change
                changePercent: data.dp, // Percent change
              };
            }
          }

          // Fallback to Yahoo Finance (Localhost)
          const quote = (await yahooFinance.quote(symbol)) as any;
          return {
            symbol: upperSymbol,
            name: quote.shortName || quote.longName || upperSymbol,
            price: quote.regularMarketPrice || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
          };
        } catch (e: any) {
          console.error(`Failed to fetch quote for ${symbol}:`, e.message || e);
          if (process.env.NODE_ENV === "production") {
            throw new Error(`Failed to fetch real-world quote for ${symbol} in production`);
          }
          
          // Fallback if APIs fail (e.g. on Render without Finnhub key)
          const basePrices: Record<string, number> = {
            "NVDA": 130.50,
            "AAPL": 220.15,
            "TSLA": 250.00,
            "MSFT": 430.20,
            "SPY": 545.00,
            "BTC-USD": 65000.00,
            "ETH-USD": 3500.00,
          };
          
          const basePrice = basePrices[upperSymbol] || (100 + Math.random() * 50);
          const changePercent = (Math.random() * 6) - 3; // -3% to +3%
          const change = (basePrice * changePercent) / 100;
          
          return {
            symbol: upperSymbol,
            name: `${upperSymbol} (รอใส่ API Key)`, 
            price: basePrice + change,
            change: change,
            changePercent: changePercent,
          };
        }
      })
    );

    // Filter out nulls
    return NextResponse.json(results.filter(Boolean));
  } catch (error) {
    console.error("Quote API Error:", error);
    return NextResponse.json({ error: "Failed to fetch quotes" }, { status: 500 });
  }
}
