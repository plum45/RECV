import { NextResponse } from "next/server";
import { getTicker, getKlines } from "../../../lib/binance";
import { calculateIndicators } from "../../../lib/indicators";
import { calculateSupportResistance } from "../../../lib/supportResistance";
import { fetchNews } from "../../../lib/news";
import { fetchSentiment } from "../../../lib/sentiment";
import { generateLocalReport } from "../../../lib/localAnalysis";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    // Validate inputs — default to NVDA (US stock, not BTCUSDT)
    const symbol = (body.symbol || "NVDA").toUpperCase();
    const timeframe = body.timeframe || "1H";
    const tradingStyle = body.tradingStyle || "Day Trade";
    const risk = body.risk || "1%";

    // 1. Fetch live market price and ticker details
    const marketData = await getTicker(symbol);

    // 2. Fetch recent OHLCV klines (request 300 so we always get at least 200 valid rows)
    const klines = await getKlines(symbol, timeframe, 300);

    // 3. Compute technical indicators
    const indicators = calculateIndicators(klines);

    // 4. Calculate support and resistance zones
    const supportResistance = calculateSupportResistance(
      klines,
      indicators,
      marketData.currentPrice
    );

    // 5. Gather news
    const news = await fetchNews(symbol);

    // 6. Gather market sentiment metrics
    const sentiment = await fetchSentiment(symbol);

    // 7. Compile report locally using deterministic quant rules
    const reportText = generateLocalReport({
      symbol,
      timeframe,
      tradingStyle,
      risk,
      marketData,
      indicators,
      supportResistance,
      news,
      sentiment,
    });

    // 8. Construct unified response payload
    const responsePayload = {
      symbol,
      timeframe,
      tradingStyle,
      source: {
        price: "Yahoo Finance API",
        chart: "TradingView Widget",
        analysis: "Local Quant Engine",
      },
      updatedAt: new Date().toISOString(),
      marketData,
      indicators,
      supportResistance,
      news,
      sentiment,
      analysis: reportText,
    };

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error("Local Analysis Orchestrator Error:", error.message);
    return NextResponse.json(
      {
        error: "Failed to perform local analysis",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
