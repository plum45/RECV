import { NextResponse } from "next/server";
import { z } from "zod";
import { getTicker, getKlines, normalizeSymbol } from "../../../lib/binance";
import { calculateIndicators } from "../../../lib/indicators";
import { calculateSupportResistance } from "../../../lib/supportResistance";
import { fetchNews } from "../../../lib/news";
import { fetchSentiment } from "../../../lib/sentiment";
import { verifyFirebaseIdTokenDetailed } from "../../../lib/firebaseAdmin";
import { generateAnalysisReport } from "../../../lib/openai";

export const runtime = "nodejs";

const planRequestSchema = z.object({
  symbol: z.string().min(1),
  tradingStyle: z.enum(["day", "swing", "position"]),
  timeframe: z.string().min(1),
  direction: z.enum(["long", "short", "wait"]),
  capital: z.number().positive(),
  risk: z.number().min(0.1).max(20),
});

const styleMeta = {
  day: {
    holdingPeriod: "ภายในวัน (Intraday)",
    slFactor: 1.0,
    desc: "Day Trade: เก็งกำไรความผันผวนระหว่างวัน ถือครองเป็นหลักนาทีถึงชั่วโมง และปิดจบภายในวัน",
  },
  swing: {
    holdingPeriod: "3–20 วัน (Swing)",
    slFactor: 1.5,
    desc: "Swing Trade: เกาะรอบแนวโน้มระยะสั้นถึงกลาง ถือครองเป็นเวลาหลายวันถึงหลายสัปดาห์",
  },
  position: {
    holdingPeriod: "หลายสัปดาห์ถึงหลายเดือน (Position)",
    slFactor: 2.5,
    desc: "Position Trade: ถือยาวตามโครงสร้างแนวโน้มใหญ่ระดับสัปดาห์/เดือน หลีกเลี่ยงสัญญาณหลอกระยะสั้น",
  },
};

export async function POST(request: Request) {
  try {
    const { decoded, error: authErr } = await verifyFirebaseIdTokenDetailed(request);
    if (!decoded || !decoded.uid) {
      return NextResponse.json(
        { error: "Unauthorized", message: `กรุณาเข้าสู่ระบบก่อนใช้งาน: ${authErr || "Token verification failed"}` },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = planRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Bad Request", message: "ข้อมูลที่ส่งมาไม่ถูกต้องตามข้อกำหนด", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { symbol: rawSymbol, tradingStyle, timeframe, direction, capital, risk } = parsed.data;
    const symbol = normalizeSymbol(rawSymbol);

    // Fetch Live Market Data
    const marketData = await getTicker(symbol);
    if (!marketData || !marketData.currentPrice) {
      return NextResponse.json(
        { error: "Not Found", message: `ไม่พบข้อมูลราคาล่าสุดสำหรับสัญลักษณ์ ${symbol}` },
        { status: 404 }
      );
    }

    // Fetch historical data for indicators (450 bars)
    const klines = await getKlines(symbol, timeframe, 450);
    if (!klines || klines.length === 0) {
      return NextResponse.json(
        { error: "Internal Server Error", message: `ไม่มีข้อมูลกราฟราคาของ ${symbol} ในกรอบเวลา ${timeframe}` },
        { status: 500 }
      );
    }

    const indicators = calculateIndicators(klines);
    const supportResistance = calculateSupportResistance(klines, indicators, marketData.currentPrice, timeframe);
    const news = await fetchNews(symbol);
    const sentiment = await fetchSentiment(symbol);

    const price = marketData.currentPrice;
    const atr = indicators.atr14 || price * 0.02;
    const slBuffer = atr * styleMeta[tradingStyle].slFactor;

    const parseSRRange = (zone: string | undefined): { low: number; high: number; mid: number } | null => {
      if (!zone) return null;
      const parts = zone.replace(/,/g, "").split("-");
      if (parts.length !== 2) return null;
      const low = parseFloat(parts[0]);
      const high = parseFloat(parts[1]);
      if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high <= 0) return null;
      return { low: Math.min(low, high), high: Math.max(low, high), mid: (low + high) / 2 };
    };

    const { supportZones, resistanceZones } = supportResistance;
    const { fibonacci: fib } = indicators;

    const nearestSupport = supportZones.find((zone) => zone.role === "nearest") || supportZones[0];
    const structuralSupport = supportZones.find((zone) => zone.role === "structural") || supportZones[1];
    const nearestResistance = resistanceZones.find((zone) => zone.role === "nearest") || resistanceZones[0];
    const structuralResistance = resistanceZones.find((zone) => zone.role === "structural") || resistanceZones[1];
    const supportEntryZone = parseSRRange(nearestSupport?.zone);
    const structuralSupportZone = parseSRRange(structuralSupport?.zone);
    const resistanceEntryZone = parseSRRange(nearestResistance?.zone);
    const structuralResistanceZone = parseSRRange(structuralResistance?.zone);

    let entryLow = 0;
    let entryHigh = 0;
    let stopLoss = 0;
    let takeProfit1 = 0;
    let takeProfit2 = 0;
    let takeProfit3 = 0;
    let riskReward = 0;
    let positionSize = 0;
    let entryApproach = "Adaptive ATR entry band";
    const fallbackEntryHalfWidth = Math.max(
      atr * 0.35,
      price * (tradingStyle === "day" ? 0.0015 : tradingStyle === "position" ? 0.005 : 0.003)
    );
    const technicalStopBuffer = Math.max(atr * 0.35, price * 0.0015);

    if (direction === "long") {
      if (supportEntryZone) {
        entryLow = supportEntryZone.low;
        entryHigh = supportEntryZone.high;
        entryApproach = `Wait for nearest support zone ${nearestSupport?.zone}${nearestSupport?.distancePercent !== undefined ? ` (${nearestSupport.distancePercent}% away)` : ""}`;
      } else {
        entryLow = price - fallbackEntryHalfWidth;
        entryHigh = price + fallbackEntryHalfWidth;
      }
      const entryMid = (entryLow + entryHigh) / 2;
      stopLoss = supportEntryZone ? supportEntryZone.low - technicalStopBuffer : entryMid - slBuffer;
      takeProfit1 = resistanceEntryZone && resistanceEntryZone.low > entryMid ? resistanceEntryZone.low : entryMid + Math.max(atr, slBuffer * 1.5);
      takeProfit2 = structuralResistanceZone && structuralResistanceZone.low > takeProfit1 ? structuralResistanceZone.low : entryMid + Math.max(atr * 2, slBuffer * 2.5);
      takeProfit3 = fib.ext161 > takeProfit2 ? fib.ext161 : takeProfit2 + slBuffer * 1.5;

      const riskPerUnit = entryMid - stopLoss;
      riskReward = riskPerUnit > 0 ? (takeProfit2 - entryMid) / riskPerUnit : 0;
      positionSize = riskPerUnit > 0 ? (capital * (risk / 100)) / riskPerUnit : 0;
    } else if (direction === "short") {
      if (resistanceEntryZone) {
        entryLow = resistanceEntryZone.low;
        entryHigh = resistanceEntryZone.high;
        entryApproach = `Wait for nearest resistance zone ${nearestResistance?.zone}${nearestResistance?.distancePercent !== undefined ? ` (${nearestResistance.distancePercent}% away)` : ""}`;
      } else {
        entryLow = price - fallbackEntryHalfWidth;
        entryHigh = price + fallbackEntryHalfWidth;
      }
      const entryMid = (entryLow + entryHigh) / 2;
      stopLoss = resistanceEntryZone ? resistanceEntryZone.high + technicalStopBuffer : entryMid + slBuffer;
      takeProfit1 = supportEntryZone && supportEntryZone.high < entryMid ? supportEntryZone.high : entryMid - Math.max(atr, slBuffer * 1.5);
      takeProfit2 = structuralSupportZone && structuralSupportZone.high < takeProfit1 ? structuralSupportZone.high : entryMid - Math.max(atr * 2, slBuffer * 2.5);
      takeProfit3 = fib.r786 < takeProfit2 ? fib.r786 : takeProfit2 - slBuffer * 1.5;

      const riskPerUnit = stopLoss - entryMid;
      riskReward = riskPerUnit > 0 ? (entryMid - takeProfit2) / riskPerUnit : 0;
      positionSize = riskPerUnit > 0 ? (capital * (risk / 100)) / riskPerUnit : 0;
    }

    // Call AI to generate professional reasons, invalidation criteria and confidence score
    let holdingPeriod = styleMeta[tradingStyle].holdingPeriod;
    let invalidation = direction === "long" ? `ราคาปิดต่ำกว่าแนวรับ Stop Loss ที่ $${stopLoss.toFixed(2)}` : direction === "short" ? `ราคาทะลุผ่านกรอบ Stop Loss ด้านบนที่ $${stopLoss.toFixed(2)}` : "สัญญาณไม่ชัดเจน ไม่ควรเปิดออเดอร์";
    let confidence = 50;
    let reasoning = `${entryApproach}. วิเคราะห์ตามเงื่อนไขเทคนิคัลเครื่องมือดัชนีชี้วัด EMA, RSI, MACD และวอลุ่มหนาแน่นสอดคล้องกัน`;

    const hasApiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "your_openai_api_key";
    if (hasApiKey && direction !== "wait") {
      try {
        const prompt = `You are a professional quant trader. Create a detailed trading plan based on the following indicators for ${symbol}:
Price: ${price}
Style: ${tradingStyle}
Direction: ${direction}
Entry: $${entryLow.toFixed(2)} - $${entryHigh.toFixed(2)}
Entry approach: ${entryApproach}
Stop Loss: $${stopLoss.toFixed(2)}
Take Profit 1: $${takeProfit1.toFixed(2)}
Take Profit 2: $${takeProfit2.toFixed(2)}
Take Profit 3: $${takeProfit3.toFixed(2)}
RSI: ${indicators.rsi14.toFixed(1)}
MACD: Histogram=${indicators.macd.histogram.toFixed(2)}, Crossover=${indicators.macd.crossover}
Market Structure: ${indicators.marketStructure.type}

Respond ONLY with a JSON object in this exact format:
{
  "holdingPeriod": "Holding period explanation in Thai",
  "invalidation": "Invalidation condition in Thai",
  "confidence": number from 10 to 100,
  "reasoning": "Detailed technical explanation why this plan makes sense based on indicators in Thai"
}`;
        const aiResponse = await generateAnalysisReport(prompt);
        const aiJson = JSON.parse(aiResponse.replace(/```json|```/gi, "").trim());
        if (aiJson.holdingPeriod) holdingPeriod = aiJson.holdingPeriod;
        if (aiJson.invalidation) invalidation = aiJson.invalidation;
        if (aiJson.confidence) confidence = aiJson.confidence;
        if (aiJson.reasoning) reasoning = aiJson.reasoning;
      } catch (err: any) {
        console.error("AI Trading Plan generator failed, falling back:", err.message);
      }
    }

    const payload = {
      symbol,
      tradingStyle,
      direction,
      timeframe,
      entryApproach: direction === "wait" ? undefined : entryApproach,
      entryLow: direction === "wait" ? undefined : parseFloat(entryLow.toFixed(4)),
      entryHigh: direction === "wait" ? undefined : parseFloat(entryHigh.toFixed(4)),
      stopLoss: direction === "wait" ? undefined : parseFloat(stopLoss.toFixed(4)),
      takeProfit1: direction === "wait" ? undefined : parseFloat(takeProfit1.toFixed(4)),
      takeProfit2: direction === "wait" ? undefined : parseFloat(takeProfit2.toFixed(4)),
      takeProfit3: direction === "wait" ? undefined : parseFloat(takeProfit3.toFixed(4)),
      riskReward: direction === "wait" ? undefined : parseFloat(riskReward.toFixed(2)),
      positionSize: direction === "wait" ? undefined : parseFloat(positionSize.toFixed(4)),
      holdingPeriod,
      invalidation,
      confidence,
      status: "Active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dataSource: process.env.FINNHUB_API_KEY ? "Finnhub API" : "Binance API",
      reasoning,
    };

    return NextResponse.json({ success: true, plan: payload });
  } catch (error: any) {
    console.error("Trading Plan orchestrator error:", error.message);
    return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
