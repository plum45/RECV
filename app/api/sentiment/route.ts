import { NextResponse } from "next/server";
import { fetchSentiment } from "../../../lib/sentiment";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol") || "BTCUSDT";

    const sentimentData = await fetchSentiment(symbol);
    return NextResponse.json(sentimentData);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch sentiment data", message: error.message },
      { status: 500 }
    );
  }
}
