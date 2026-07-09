import { NextResponse } from "next/server";
import { fetchNews } from "../../../lib/news";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol") || "BTCUSDT";

    const newsData = await fetchNews(symbol);
    return NextResponse.json(newsData);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch news data", message: error.message },
      { status: 500 }
    );
  }
}
