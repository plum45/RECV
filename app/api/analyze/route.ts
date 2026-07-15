import { NextResponse } from "next/server";
import { getTicker, getKlines, normalizeSymbol } from "../../../lib/binance";
import { calculateIndicators } from "../../../lib/indicators";
import { calculateSupportResistance } from "../../../lib/supportResistance";
import { fetchNews } from "../../../lib/news";
import { fetchSentiment } from "../../../lib/sentiment";
import { generateLocalReport } from "../../../lib/localAnalysis";
import { generateAnalysisReport } from "../../../lib/openai";
import { buildAnalysisPrompt } from "../../../lib/prompt";
import { checkRateLimit, getAiCache, setAiCache } from "../../../lib/aiCache";
import { verifyFirebaseIdTokenDetailed } from "../../../lib/firebaseAdmin";
import { calculatePriceProjection } from "../../../lib/priceProjection";
import { getMergedCalendarEvents } from "../../../lib/liveCalendarService";
import { getAssetProfile } from "../../../lib/assetProfile";
import type { IndicatorData } from "../../../types/market";
import type { MultiTimeframeAnalysis, MultiTimeframeBias, MultiTimeframeSnapshot } from "../../../types/analysis";

import { z } from "zod";

export const runtime = "nodejs";

const analyzeInputSchema = z.object({
  symbol: z.string().default("NVDA"),
  timeframe: z.string().default("1H"),
  tradingStyle: z.enum(["scalping", "day", "swing", "position"])
    .or(z.string().transform((val) => {
      const lower = val.toLowerCase();
      if (lower.includes("scalp")) return "scalping" as const;
      if (lower.includes("day")) return "day" as const;
      if (lower.includes("position")) return "position" as const;
      return "swing" as const;
    }))
    .default("swing"),
  risk: z.string().default("1%"),
  accountSize: z.number().optional(),
  riskPercent: z.number().optional(),
  leverage: z.number().optional(),
  feePercent: z.number().optional(),
  slippagePercent: z.number().optional(),
});

const styleMeta = {
  scalping: {
    holdingPeriod: "1–30 นาที (Scalping)",
    recommendedTimeframes: ["5m", "15m", "1H"],
    styleReason: "ใช้ 1H กรองทิศทาง, 15m ดูโครงสร้างและ Session VWAP, 5m รอ liquidity sweep พร้อมแท่งยืนยัน; ปิดความเสี่ยงก่อนข่าวแรงและไม่ถือข้ามช่วงข่าว",
  },
  day: {
    holdingPeriod: "นาทีถึงภายในวัน (Minutes to Intraday)",
    recommendedTimeframes: ["5m", "15m", "1H"],
    styleReason: "เน้นการเก็งกำไรเร็วในรอบวันโดยคำนวณ RSI, MACD, Volume และแนวรับ/แนวต้านระยะสั้นเพื่อหาจุดตัดขาดทุนแคบ"
  },
  swing: {
    holdingPeriod: "หลายวันถึงหลายสัปดาห์ (3–20 วันโดยประมาณ)",
    recommendedTimeframes: ["4H", "1D"],
    styleReason: "เน้นการเกาะแนวโน้มรอบราคากลาง ค้นหาจุดเสี่ยงคุ้มค่าอ้างอิงเส้น EMA 20/50 และความผันผวน ATR"
  },
  position: {
    holdingPeriod: "หลายสัปดาห์ถึงหลายเดือน (Weeks to Months)",
    recommendedTimeframes: ["1D"],
    styleReason: "เน้นทิศทางตามเทรนด์ภาพใหญ่ระดับมหภาคด้วยเส้น EMA 50/200, Fibonacci และแนวรับ/แนวต้านระยะยาว"
  }
};

function getMultiTimeframeBias(indicators: IndicatorData, price: number): MultiTimeframeBias {
  const structure = indicators.marketStructure.type;
  const priceAction = indicators.priceAction?.bias || "neutral";
  const smartMoneyBias = indicators.smartMoney?.bos || "none";

  if (smartMoneyBias === "bullish" || (structure === "uptrend" && priceAction === "bullish" && price >= indicators.vwap)) return "bullish";
  if (smartMoneyBias === "bearish" || (structure === "downtrend" && priceAction === "bearish" && price <= indicators.vwap)) return "bearish";
  return "neutral";
}

async function getPreciousMetalsMultiTimeframe(
  symbol: string,
  currentPrice: number,
  selectedTimeframe: string,
  tradingStyle: string,
  primaryKlines: Awaited<ReturnType<typeof getKlines>>,
  primaryIndicators: IndicatorData,
  assetProfile: ReturnType<typeof getAssetProfile>
): Promise<MultiTimeframeAnalysis> {
  const isScalping = tradingStyle === "scalping";
  const frames: Array<"1D" | "4H" | "1H" | "15m" | "5m"> = isScalping
    ? ["1H", "15m", "5m"]
    : ["1D", "4H", "1H"];
  const selected = selectedTimeframe.toUpperCase();
  const results = await Promise.allSettled(frames.map(async (frame) => {
    const isPrimary = frame === selected;
    const klines = isPrimary ? primaryKlines : await getKlines(symbol, frame, 450);
    const indicators = isPrimary ? primaryIndicators : calculateIndicators(klines, assetProfile);
    const snapshot: MultiTimeframeSnapshot = {
      timeframe: frame,
      status: "available",
      bias: getMultiTimeframeBias(indicators, currentPrice),
      structure: indicators.marketStructure.type,
      priceAction: indicators.priceAction?.confirmation || "none",
      bos: indicators.smartMoney?.bos || "none",
      rsi: Number(indicators.rsi14.toFixed(1)),
    };
    return snapshot;
  }));

  const snapshots = results.map((result, index): MultiTimeframeSnapshot => (
    result.status === "fulfilled"
      ? result.value
      : { timeframe: frames[index], status: "unavailable" }
  ));
  const available = snapshots.filter((snapshot) => snapshot.status === "available" && snapshot.bias !== "neutral");
  const bullish = available.filter((snapshot) => snapshot.bias === "bullish").length;
  const bearish = available.filter((snapshot) => snapshot.bias === "bearish").length;
  const directionalBias: MultiTimeframeBias = bullish === bearish ? "neutral" : bullish > bearish ? "bullish" : "bearish";
  const alignment = available.length < 2
    ? "insufficient"
    : (bullish === available.length || bearish === available.length) ? "aligned" : "mixed";

  return { mode: isScalping ? "scalping" : "top_down", alignment, directionalBias, executionTimeframe: selectedTimeframe, snapshots };
}

export async function POST(request: Request) {
  try {
    // Enforce Firebase Auth
    const { decoded, error: authErr } = await verifyFirebaseIdTokenDetailed(request);
    if (!decoded || !decoded.uid) {
      return NextResponse.json(
        { 
          error: "Unauthorized", 
          message: `กรุณาเข้าสู่ระบบก่อนใช้งาน: ${authErr || "Token verification failed"}` 
        }, 
        { status: 401 }
      );
    }

    const rateCheck = checkRateLimit(`analyze:${decoded.uid}`, 12, 60 * 1000);
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

    // Validate with Zod schema
    const parsedInput = analyzeInputSchema.parse(body);
    const symbol = normalizeSymbol(parsedInput.symbol);
    const assetProfile = getAssetProfile(symbol);
    const timeframe = parsedInput.timeframe;
    const tradingStyle = parsedInput.tradingStyle;
    const risk = parsedInput.risk;

    // 1. Fetch live market price and ticker details
    const marketData = await getTicker(symbol);

    // 2. Fetch recent OHLCV klines (request 450 to get a deeper history for swing levels)
    const klines = await getKlines(symbol, timeframe, 450);

    // 3. Compute technical indicators
    const indicators = calculateIndicators(klines, assetProfile);

    // 4. Calculate support and resistance zones
    const supportResistance = calculateSupportResistance(
      klines,
      indicators,
      marketData.currentPrice,
      timeframe,
      assetProfile.assetClass
    );

    // Metals use a top-down decision gate: 1D establishes the broader bias,
    // 4H confirms market structure, and 1H validates the entry context. A
    // missing secondary feed never invalidates the primary chart analysis.
    const multiTimeframe = assetProfile.isPreciousMetal
      ? await getPreciousMetalsMultiTimeframe(symbol, marketData.currentPrice, timeframe, tradingStyle, klines, indicators, assetProfile)
      : undefined;

    // 5. Gather news
    const news = await fetchNews(symbol);

    // 6. Gather market sentiment metrics
    const sentiment = await fetchSentiment(symbol);

    // 6.2 Fetch merged live calendar events (Finnhub + fallback) for accurate event risk & schedule
    const now = new Date();
    const { events: mergedCalendarEvents } = await getMergedCalendarEvents(
      new Date(now.getTime() - 2 * 24 * 3600 * 1000),
      new Date(now.getTime() + 14 * 24 * 3600 * 1000),
      symbol ? [symbol] : null
    );

    // 6.5 Calculate Price Projection Matrix (Quant Engine)
    const priceProjection = calculatePriceProjection(
      symbol,
      marketData.currentPrice,
      klines,
      indicators,
      supportResistance,
      news,
      mergedCalendarEvents,
      tradingStyle,
      timeframe,
      marketData.priceSource || "Finnhub API",
      marketData
    );

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
            priceProjection,
            calendarEvents: mergedCalendarEvents,
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
            klines,
            accountSize: parsedInput.accountSize,
            riskPercent: parsedInput.riskPercent,
            leverage: parsedInput.leverage,
            feePercent: parsedInput.feePercent,
            slippagePercent: parsedInput.slippagePercent,
            priceProjection,
            calendarEvents: mergedCalendarEvents,
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
        klines,
        accountSize: parsedInput.accountSize,
        riskPercent: parsedInput.riskPercent,
        leverage: parsedInput.leverage,
        feePercent: parsedInput.feePercent,
        slippagePercent: parsedInput.slippagePercent,
        priceProjection,
        calendarEvents: mergedCalendarEvents,
      });
    }

    // 8. Construct unified response payload
    const responsePayload = {
      symbol,
      timeframe,
      tradingStyle,
      holdingPeriod: styleMeta[tradingStyle].holdingPeriod,
      recommendedTimeframes: styleMeta[tradingStyle].recommendedTimeframes,
      styleReason: styleMeta[tradingStyle].styleReason,
      source: {
        price: process.env.FINNHUB_API_KEY ? "Finnhub API" : "Market Data API",
        chart: "TradingView Widget",
        analysis: analysisSource,
      },
      updatedAt: new Date().toISOString(),
      marketData,
      indicators,
      supportResistance,
      news,
      sentiment,
      priceProjection,
      multiTimeframe,
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
