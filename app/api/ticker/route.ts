import { NextResponse } from "next/server";
import { getTicker } from "../../../lib/binance";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol") || "BTCUSDT";

    const tickerData = await getTicker(symbol);
    return NextResponse.json(tickerData);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch ticker data", message: error.message },
      { status: 500 }
    );
  }
}
