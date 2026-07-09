import { NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";

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
          const quote = await yahooFinance.quote(symbol);
          return {
            symbol: symbol.toUpperCase(),
            name: quote.shortName || quote.longName || symbol.toUpperCase(),
            price: quote.regularMarketPrice || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
          };
        } catch (e) {
          return null; // Return null if invalid or failed
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
