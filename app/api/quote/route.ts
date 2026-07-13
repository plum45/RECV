import { NextResponse } from "next/server";
import { getTicker, normalizeSymbol } from "../../../lib/binance";
import type { QuoteResult } from "../../../types/watchlist";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { symbols } = await request.json();
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ error: "Invalid symbols array" }, { status: 400 });
    }

    const limitedSymbols = symbols.slice(0, 30);

    const settled = await Promise.allSettled(
      limitedSymbols.map(async (rawSymbol: string): Promise<QuoteResult> => {
        const upperSymbol = normalizeSymbol(rawSymbol);
        try {
          const ticker = await getTicker(upperSymbol);
          
          return {
            symbol: upperSymbol,
            status: "valid",
            name: upperSymbol,
            price: ticker.currentPrice,
            change: ticker.change24h,
            changePercent: ticker.change24h,
            
            // Extended session pricing
            regularPrice: ticker.regularPrice,
            regularChange: ticker.regularChange,
            regularChangePercent: ticker.regularChangePercent,
            
            preMarketPrice: ticker.preMarketPrice,
            preMarketChange: ticker.preMarketChange,
            preMarketChangePercent: ticker.preMarketChangePercent,
            
            postMarketPrice: ticker.postMarketPrice,
            postMarketChange: ticker.postMarketChange,
            postMarketChangePercent: ticker.postMarketChangePercent,
            
            previousClose: ticker.previousClose,
            marketState: ticker.marketState,
            priceSource: ticker.priceSource,
            priceTimestamp: ticker.priceTimestamp,
            isDelayed: ticker.isDelayed,
          };
        } catch (err: any) {
          console.error(`Quote error for ${upperSymbol}:`, err.message);
          
          if (err.message && err.message.includes("ไม่พบข้อมูล")) {
            return {
              symbol: upperSymbol,
              status: "invalid",
              error: `ไม่พบข้อมูลของ ${upperSymbol}`,
              errorReason: "Symbol not found or invalid",
            };
          }
          
          return {
            symbol: upperSymbol,
            status: "unavailable",
            name: upperSymbol,
            error: `ดึงราคาล่าช้า/ล้มเหลว`,
            errorReason: err.message || "Network error",
            priceSource: "Unavailable",
          };
        }
      })
    );

    const results: QuoteResult[] = settled.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      const sym = normalizeSymbol(limitedSymbols[index]);
      return {
        symbol: sym,
        status: "unavailable" as const,
        name: sym,
        error: "เกิดข้อผิดพลาดที่ไม่คาดคิด",
        errorReason: "Unexpected Promise rejection",
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
