import { NextResponse } from "next/server";
import { getTicker, getKlines } from "../../../lib/binance";
import { calculateIndicators } from "../../../lib/indicators";
import { calculateSupportResistance } from "../../../lib/supportResistance";
import { generateAnalysisReport } from "../../../lib/openai";
import { checkRateLimit, getAiCache, setAiCache } from "../../../lib/aiCache";

export async function POST(request: Request) {
  try {
    const clientIp = request.headers.get("x-forwarded-for") || "local-client";
    const rateCheck = checkRateLimit(`scanner:${clientIp}`, 20, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", message: "ระบบถูกสแกนบ่อยเกินไป กรุณารอสักครู่เพื่อป้องกันโควต้าเต็ม" },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const symbol = (body.symbol || "BTC-USD").toUpperCase();

    // 1. Fetch live ticker details
    const ticker = await getTicker(symbol);

    // 2. Fetch klines for 5 timeframes in parallel
    const timeframes = ["5m", "15m", "1H", "4H", "1D"] as const;
    const klinesPromises = timeframes.map((tf) => getKlines(symbol, tf, 450));
    const klinesList = await Promise.all(klinesPromises);

    // 3. Calculate indicators and scores for each timeframe
    const results = timeframes.map((tf, index) => {
      const klines = klinesList[index];
      const indicators = calculateIndicators(klines);
      const supportResistance = calculateSupportResistance(
        klines,
        indicators,
        ticker.currentPrice
      );

      const price = ticker.currentPrice;
      const {
        ema20,
        ema50,
        ema200,
        rsi14,
        macd,
        adx,
        marketStructure,
        vwap,
        bollingerBands,
        stochasticRSI,
        volumeAnalysis,
      } = indicators;

      // Scoring formula (aligned with lib/localAnalysis.ts)
      let bullPoints = 0;
      let bearPoints = 0;

      // EMA stacking
      if (price > ema20) bullPoints += 2; else bearPoints += 2;
      if (price > ema50) bullPoints += 2; else bearPoints += 2;
      if (ema200 > 0 && price > ema200) bullPoints += 3; else if (ema200 > 0) bearPoints += 3;
      if (ema20 > ema50) bullPoints += 1; else bearPoints += 1;

      // RSI
      if (rsi14 > 55) bullPoints += 2;
      else if (rsi14 < 45) bearPoints += 2;

      // MACD
      if (macd.histogram > 0) bullPoints += 2; else bearPoints += 2;
      if (macd.crossover === "bullish") bullPoints += 3;
      else if (macd.crossover === "bearish") bearPoints += 3;

      // ADX direction
      if (adx.direction === "up" && adx.trending) bullPoints += 3;
      else if (adx.direction === "down" && adx.trending) bearPoints += 3;

      // Market structure
      if (marketStructure.type === "uptrend") bullPoints += 3;
      else if (marketStructure.type === "downtrend") bearPoints += 3;
      if (marketStructure.breakOfStructure === "bullish_bos") bullPoints += 4;
      else if (marketStructure.breakOfStructure === "bearish_bos") bearPoints += 4;

      // VWAP
      if (price > vwap) bullPoints += 1; else bearPoints += 1;

      // Bollinger
      if (bollingerBands.percentB > 0.6) bullPoints += 1;
      else if (bollingerBands.percentB < 0.4) bearPoints += 1;

      // StochRSI
      if (stochasticRSI.k > stochasticRSI.d && !stochasticRSI.overbought) bullPoints += 1;
      else if (stochasticRSI.k < stochasticRSI.d && !stochasticRSI.oversold) bearPoints += 1;

      // OBV trend
      if (volumeAnalysis.obvTrend === "rising") bullPoints += 2;
      else if (volumeAnalysis.obvTrend === "falling") bearPoints += 2;

      const totalPoints = bullPoints + bearPoints;
      const score = totalPoints > 0 ? Math.round((bullPoints / totalPoints) * 100) : 50;

      // Determine bias
      let bias: "Strong Bullish" | "Bullish" | "Neutral" | "Bearish" | "Strong Bearish" = "Neutral";
      if (score >= 70) bias = "Strong Bullish";
      else if (score >= 55) bias = "Bullish";
      else if (score >= 45) bias = "Neutral";
      else if (score >= 30) bias = "Bearish";
      else bias = "Strong Bearish";

      // Find closest support/resistance zones
      const closestSupport = supportResistance.supportZones[0] || null;
      const closestResistance = supportResistance.resistanceZones[0] || null;

      // Check if there are any S/R Flips in S/R reasons
      const srFlips = [
        ...supportResistance.supportZones,
        ...supportResistance.resistanceZones,
      ].filter((z) => z.reasons.some((r) => r.includes("S/R Flip")));

      return {
        timeframe: tf,
        score,
        bias,
        rsi: Math.round(rsi14),
        macdCrossover: macd.crossover,
        emaTrend: price > ema50 ? "bullish" : "bearish",
        structure: marketStructure.type,
        closestSupport,
        closestResistance,
        srFlips: srFlips.map((z) => ({ zone: z.zone, type: z.type, reasons: z.reasons })),
      };
    });

    // 4. Calculate weighted Consensus Score
    // 5m: 10%, 15m: 15%, 1H: 20%, 4H: 30%, 1D: 25%
    const weights: Record<string, number> = {
      "5m": 0.1,
      "15m": 0.15,
      "1H": 0.2,
      "4H": 0.3,
      "1D": 0.25,
    };

    let overallScore = 0;
    results.forEach((r) => {
      overallScore += r.score * (weights[r.timeframe] || 0.2);
    });
    overallScore = Math.round(overallScore);

    // 5. Generate AI Confluence Summary
    let aiSummary = "";
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "your_openai_api_key") {
      const cacheKey = `scanner:${symbol}`;
      const cachedSummary = getAiCache(cacheKey);

      if (cachedSummary) {
        aiSummary = cachedSummary;
      } else {
        try {
          const resultsJsonString = JSON.stringify(results, null, 2);
          const prompt = `
Please analyze this multi-timeframe technical confluence data for ${symbol} at current price of $${ticker.currentPrice.toLocaleString()}.

Data:
${resultsJsonString}

Overall Bullish Consensus Score: ${overallScore}/100

Write a short, sharp and professional trading summary in Thai (3-4 sentences max).
Include:
1. Current multi-timeframe bias (e.g. alignment between long term and short term).
2. Key levels to watch (especially if any S/R Flip zones are nearby).
3. Clear short-term action recommendation (e.g., Buy/Long, Sell/Short, or Wait/Neutral).
Do not output any markdown formatting other than plain text, and keep it extremely concise.
`;
          aiSummary = await generateAnalysisReport(prompt);
          setAiCache(cacheKey, aiSummary, 120); // Cache for 2 minutes
        } catch (err: any) {
          console.error("Failed to generate AI summary in scanner:", err.message);
          aiSummary = `สแกนเนอร์พบคะแนนฉันทามติที่ ${overallScore}/100. ระบบเอไอไม่สามารถสรุปความได้ในขณะนี้เนื่องจากปัญหาทางเทคนิค.`;
        }
      }
    } else {
      // Rule-based fallback summary
      let recommendation = "ถือเงินสด / รอดูสถานการณ์ (Wait)";
      if (overallScore >= 70) recommendation = "หาจังหวะเปิดสถานะ ซื้อ / Long";
      else if (overallScore >= 55) recommendation = "เน้นเปิดสถานะ ซื้อ / Long เมื่อย่อตัว";
      else if (overallScore <= 30) recommendation = "หาจังหวะเปิดสถานะ ขาย / Short";
      else if (overallScore <= 45) recommendation = "เน้นเปิดสถานะ ขาย / Short เมื่อราคาเด้งตัว";

      aiSummary = `${symbol} มีคะแนนความกระทิงสุทธิที่ ${overallScore}/100 บ่งชี้สภาวะ ${overallScore >= 55 ? "แนวโน้มขาขึ้น (Bullish)" : overallScore <= 45 ? "แนวโน้มขาลง (Bearish)" : "แกว่งตัวออกข้าง (Sideways)"} แนะนำให้${recommendation} โดยประเมินระดับแนวรับ-แนวต้านหลักข้ามกรอบเวลาเพื่ออ้างอิงจุดตัดขาดทุน`;
    }

    return NextResponse.json({
      symbol,
      currentPrice: ticker.currentPrice,
      change24h: ticker.change24h,
      high24h: ticker.high24h,
      low24h: ticker.low24h,
      overallScore,
      results,
      aiSummary,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Scanner API Error:", error.message);
    return NextResponse.json(
      { error: "Failed to perform multi-timeframe scan", message: error.message },
      { status: 500 }
    );
  }
}
