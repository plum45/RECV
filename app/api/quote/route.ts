import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const symbols = body.symbols;
    
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ error: "Please provide an array of symbols" }, { status: 400 });
    }

    const results = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const quote = (await yahooFinance.quote(symbol)) as any;
          return {
            symbol: symbol.toUpperCase(),
            name: quote.shortName || quote.longName || symbol.toUpperCase(),
            price: quote.regularMarketPrice || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
          };
        } catch (e) {
          console.error(`Failed to fetch quote for ${symbol}, using mock data:`, e);
          
          // Fallback if Yahoo Finance blocks the IP (e.g. on Render/Vercel)
          const basePrices: Record<string, number> = {
            "NVDA": 130.50,
            "AAPL": 220.15,
            "TSLA": 250.00,
            "MSFT": 430.20,
            "SPY": 545.00,
            "BTC-USD": 65000.00,
            "ETH-USD": 3500.00,
          };
          
          const upperSymbol = symbol.toUpperCase();
          const basePrice = basePrices[upperSymbol] || (100 + Math.random() * 50);
          const changePercent = (Math.random() * 6) - 3; // -3% to +3%
          const change = (basePrice * changePercent) / 100;
          
          return {
            symbol: upperSymbol,
            name: `${upperSymbol} (จำลองข้อมูล)`, // Indicator that it's simulated
            price: basePrice + change,
            change: change,
            changePercent: changePercent,
          };
        }
      })
    );

    // Filter out nulls
    const validResults = results.filter((r) => r !== null);
    return NextResponse.json(validResults);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch quotes" }, { status: 500 });
  }
}
