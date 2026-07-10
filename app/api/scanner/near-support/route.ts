import { NextResponse } from "next/server";
import { getTicker, getKlines } from "../../../../lib/binance";
import { calculateIndicators } from "../../../../lib/indicators";
import { calculateSupportResistance } from "../../../../lib/supportResistance";

// Helper to parse zone string (e.g. "92,100-92,500" or "180.50")
function parseZoneMid(zoneStr: string): number {
  try {
    const clean = zoneStr.replace(/,/g, "");
    const parts = clean.split("-");
    if (parts.length === 2) {
      const low = parseFloat(parts[0]);
      const high = parseFloat(parts[1]);
      return (low + high) / 2;
    }
    return parseFloat(clean) || 0;
  } catch {
    return 0;
  }
}

async function scanSupport(symbols: string[]) {
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const ticker = await getTicker(symbol);
        const klines = await getKlines(symbol, "1H", 200);
        const indicators = calculateIndicators(klines);
        const supportResistance = calculateSupportResistance(
          klines,
          indicators,
          ticker.currentPrice
        );

        const closestSupport = supportResistance.supportZones[0] || null;
        let distancePercent = 999;
        let supportMid = 0;

        if (closestSupport) {
          supportMid = parseZoneMid(closestSupport.zone);
          if (supportMid > 0) {
            distancePercent = ((ticker.currentPrice - supportMid) / supportMid) * 100;
          }
        }

        return {
          symbol,
          currentPrice: ticker.currentPrice,
          change24h: ticker.change24h,
          closestSupport,
          supportPrice: supportMid,
          distancePercent,
          status: distancePercent <= 1.5 && distancePercent >= -0.5 
            ? "near" 
            : distancePercent < -0.5 
              ? "broken" 
              : "normal",
        };
      } catch (err: any) {
        console.warn(`Failed to scan support for ${symbol}:`, err.message);
        return null;
      }
    })
  );

  const sortedResults = results
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => {
      const scoreA = Math.abs(a.distancePercent);
      const scoreB = Math.abs(b.distancePercent);
      return scoreA - scoreB;
    });

  return sortedResults;
}

const DEFAULT_SYMBOLS = ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "NVDA", "AAPL", "TSLA", "MSFT"];

export async function GET() {
  try {
    const data = await scanSupport(DEFAULT_SYMBOLS);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Near Support Scanner GET error:", error.message);
    return NextResponse.json(
      { error: "Failed to scan assets near support", message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const symbols = body.symbols && Array.isArray(body.symbols) && body.symbols.length > 0
      ? body.symbols.map((s: string) => s.trim().toUpperCase())
      : DEFAULT_SYMBOLS;

    const data = await scanSupport(symbols);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Near Support Scanner POST error:", error.message);
    return NextResponse.json(
      { error: "Failed to scan custom assets near support", message: error.message },
      { status: 500 }
    );
  }
}
