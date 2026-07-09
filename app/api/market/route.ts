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

    const results = await Promise.all(
      indices.map(async (idx) => {
        try {
          const quote = await yahooFinance.quote(idx.symbol);
          return {
            symbol: idx.symbol,
            name: idx.name,
            price: quote.regularMarketPrice || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
          };
        } catch (e) {
          return {
            symbol: idx.symbol,
            name: idx.name,
            price: 0,
            change: 0,
            changePercent: 0,
          };
        }
      })
    );

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch indices" }, { status: 500 });
  }
}
