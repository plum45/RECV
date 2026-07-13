import { NextResponse } from "next/server";
import { normalizeSymbol } from "../../../lib/binance";
import type { QuoteResult } from "../../../types/watchlist";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { symbols } = await request.json();
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ error: "Invalid symbols array" }, { status: 400 });
    }

    // Cap at 30 symbols per request
    const limitedSymbols = symbols.slice(0, 30);
    const finnhubKey = process.env.FINNHUB_API_KEY;

    const settled = await Promise.allSettled(
      limitedSymbols.map(async (rawSymbol: string): Promise<QuoteResult> => {
        const upperSymbol = normalizeSymbol(rawSymbol);

        // --- Try Finnhub first ---
        if (finnhubKey) {
          try {
            const res = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(upperSymbol)}&token=${finnhubKey}`,
              { signal: AbortSignal.timeout(8000) }
            );
            const data = await res.json();

            if (data && typeof data.c === "number" && data.c !== 0) {
              return {
                symbol: upperSymbol,
                status: "valid",
                name: upperSymbol,
                price: data.c,
                change: data.d ?? 0,
                changePercent: data.dp ?? 0,
              };
            }
          } catch (finnhubErr: any) {
            console.warn(`Finnhub failed for ${upperSymbol}:`, finnhubErr.message);
          }
        }

        // --- Fallback: Yahoo Finance ---
        try {
          const YahooFinance = (await import("yahoo-finance2")).default;
          const yahooFinance = new YahooFinance();
          const quote = (await yahooFinance.quote(rawSymbol)) as any;

          if (quote && (quote.regularMarketPrice || quote.regularMarketPrice === 0)) {
            return {
              symbol: upperSymbol,
              status: "valid",
              name: quote.shortName || quote.longName || upperSymbol,
              price: quote.regularMarketPrice || 0,
              change: quote.regularMarketChange || 0,
              changePercent: quote.regularMarketChangePercent || 0,
            };
          }

          // Yahoo returned but no price data → symbol probably doesn't exist
          return {
            symbol: upperSymbol,
            status: "invalid",
            error: `ไม่พบข้อมูลราคาของ ${upperSymbol}`,
          };
        } catch (yahooErr: any) {
          console.warn(`Yahoo Finance failed for ${upperSymbol}:`, yahooErr.message);

          // Both APIs failed — symbol might be valid but we can't reach data
          return {
            symbol: upperSymbol,
            status: "unavailable",
            name: upperSymbol,
            error: `ไม่สามารถเชื่อมต่อแหล่งข้อมูลราคาของ ${upperSymbol} ได้ในขณะนี้`,
          };
        }
      })
    );

    // Extract results from settled promises
    const results: QuoteResult[] = settled.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      // Promise rejected (unexpected) — treat as unavailable
      const sym = normalizeSymbol(limitedSymbols[index]);
      return {
        symbol: sym,
        status: "unavailable" as const,
        name: sym,
        error: "เกิดข้อผิดพลาดที่ไม่คาดคิด",
      };
    });

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("Quote API Error:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch quotes", message: error.message },
      { status: 500 }
    );
  }
}
