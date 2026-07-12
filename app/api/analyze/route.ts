import { NextResponse } from "next/server";
import { getTicker, getKlines } from "../../../lib/binance";
import { calculateIndicators } from "../../../lib/indicators";
import { calculateSupportResistance } from "../../../lib/supportResistance";
import { fetchNews } from "../../../lib/news";
import { fetchSentiment } from "../../../lib/sentiment";
import { generateLocalReport } from "../../../lib/localAnalysis";
import { generateAnalysisReport } from "../../../lib/openai";
import { buildAnalysisPrompt } from "../../../lib/prompt";
import { checkRateLimit, getAiCache, setAiCache } from "../../../lib/aiCache";

export async function POST(request: Request) {
  try {
    const clientIp = request.headers.get("x-forwarded-for") || "local-client";
    const rateCheck = checkRateLimit(`analyze:${clientIp}`, 12, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "ระบบถูกเรียกวิเคราะห์บ่อยเกินไป กรุณารอประมาณ 1 นาทีก่อนกดวิเคราะห์อีกครั้งเพื่อป้องกันโควต้า AI เต็ม",
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));

    // Validate inputs — default to NVDA (US stock, not BTCUSDT)
    const symbol = (body.symbol || "NVDA").toUpperCase();
    const timeframe = body.timeframe || "1H";
    const tradingStyle = body.tradingStyle || "Day Trade";
    const risk = body.risk || "1%";

    // 1. Fetch live market price and ticker details
    const marketData = await getTicker(symbol);

    // 2. Fetch recent OHLCV klines (request 450 to get a deeper history for swing levels)
    const klines = await getKlines(symbol, timeframe, 450);

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

    // 7. Generate report (OpenAI GPT-4o-mini with fallback to Local Quant Engine)
    let reportText = "";
    let analysisSource = "Local Quant Engine";

    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "your_openai_api_key") {
      const cacheKey = `analyze:${symbol}:${timeframe}:${tradingStyle}:${risk}`;
      const cachedAi = getAiCache(cacheKey);

      if (cachedAi) {
        reportText = cachedAi;
        analysisSource = "OpenAI GPT-4o-mini (Cached 3m)";
      } else {
        try {
          const prompt = buildAnalysisPrompt({
            symbol,
            timeframe,
            tradingStyle,
            marketData,
            indicators,
            supportResistance,
            news,
            sentiment,
          });
          reportText = await generateAnalysisReport(prompt);
          setAiCache(cacheKey, reportText, 180); // Cache for 3 minutes to save tokens & speed up requests
          analysisSource = "OpenAI GPT-4o-mini (Live Analysis)";
        } catch (openaiErr: any) {
          console.error("OpenAI Analysis Error, falling back to local quant rules:", openaiErr.message);
          reportText = generateLocalReport({
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
          analysisSource = "Local Quant Engine (Fallback)";
        }
      }
    } else {
      reportText = generateLocalReport({
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
    }

    // 8. Construct unified response payload
    const responsePayload = {
      symbol,
      timeframe,
      tradingStyle,
      source: {
        price: "Yahoo Finance API",
        chart: "TradingView Widget",
        analysis: analysisSource,
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
        error: "Failed to perform analysis",
        message: error.message,
      },
      { status: 500 }
    );
  }
}

