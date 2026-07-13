import { NextResponse } from "next/server";
import { fetchSentiment } from "../../../lib/sentiment";
import { normalizeSymbol } from "../../../lib/binance";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawSymbol = searchParams.get("symbol") || "BTC-USD";
    const symbol = normalizeSymbol(rawSymbol);

    const sentimentData = await fetchSentiment(symbol);
    return NextResponse.json(sentimentData);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch sentiment data", message: error.message },
      { status: 500 }
    );
  }
}
