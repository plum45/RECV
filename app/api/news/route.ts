import { NextResponse } from "next/server";
import { fetchNews } from "../../../lib/news";
import { normalizeSymbol } from "../../../lib/binance";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawSymbol = searchParams.get("symbol") || "BTC-USD";
    const symbol = normalizeSymbol(rawSymbol);

    const newsData = await fetchNews(symbol);
    return NextResponse.json(newsData);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch news data", message: error.message },
      { status: 500 }
    );
  }
}
