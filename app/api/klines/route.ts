import { NextResponse } from "next/server";
import { getKlines, normalizeSymbol } from "../../../lib/binance";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawSymbol = searchParams.get("symbol") || "BTC-USD";
    const symbol = normalizeSymbol(rawSymbol);
    const timeframe = searchParams.get("timeframe") || "1H";
    const limitStr = searchParams.get("limit") || "200";
    const limit = parseInt(limitStr, 10);

    const klines = await getKlines(symbol, timeframe, limit);
    return NextResponse.json(klines);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch kline data", message: error.message },
      { status: 500 }
    );
  }
}
