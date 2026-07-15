import { NextResponse } from "next/server";
import { getTicker, getKlines } from "../../../../lib/binance";
import { calculateIndicators } from "../../../../lib/indicators";
import { calculateSupportResistance } from "../../../../lib/supportResistance";
import { checkRateLimit } from "../../../../lib/aiCache";
import { verifyFirebaseIdTokenDetailed } from "../../../../lib/firebaseAdmin";
import { getAssetProfile } from "../../../../lib/assetProfile";

export const runtime = "nodejs";

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
        const isCrypto = symbol.toUpperCase().endsWith("-USD");
        const assetProfile = getAssetProfile(symbol);
        const timeframe = assetProfile.isPreciousMetal ? "4H" : isCrypto ? "4H" : "1D";
        const klines = await getKlines(symbol, timeframe, 450);
        const indicators = calculateIndicators(klines, assetProfile);
        const supportResistance = calculateSupportResistance(
          klines,
          indicators,
          ticker.currentPrice,
          timeframe,
          assetProfile.assetClass
        );

        // Filter for high-impact support zones (score >= 3)
        const strongSupports = supportResistance.supportZones.filter(z => z.score >= 3);
        const closestSupport = strongSupports.length > 0 ? strongSupports[0] : (supportResistance.supportZones[0] || null);
        let distancePercent = 999;
        let supportMid = 0;

        if (closestSupport) {
          supportMid = parseZoneMid(closestSupport.zone);
          if (supportMid > 0) {
            distancePercent = ((ticker.currentPrice - supportMid) / supportMid) * 100;
          }
        }

        const threshold = assetProfile.isPreciousMetal
          ? assetProfile.supportAlert.upperPercent
          : isCrypto ? 2.5 : 3.0;
        const brokenThreshold = assetProfile.isPreciousMetal
          ? assetProfile.supportAlert.lowerPercent
          : isCrypto ? -0.75 : -1.0;

        return {
          symbol,
          timeframe,
          currentPrice: ticker.currentPrice,
          change24h: ticker.change24h,
          closestSupport,
          supportPrice: supportMid,
          distancePercent,
          status: distancePercent <= threshold && distancePercent >= brokenThreshold 
            ? "near" 
            : distancePercent < brokenThreshold 
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

async function authorizeNearSupportRequest(request: Request) {
  const { decoded, error: authErr } = await verifyFirebaseIdTokenDetailed(request);
  if (!decoded?.uid) {
    return {
      uid: null,
      response: NextResponse.json(
        { error: "Unauthorized", message: authErr || "Token verification failed" },
        { status: 401 }
      ),
    };
  }

  const rateCheck = checkRateLimit(`near-support:${decoded.uid}`, 30, 60 * 1000);
  if (!rateCheck.allowed) {
    return {
      uid: decoded.uid,
      response: NextResponse.json(
        { error: "Rate limit exceeded", message: "Please wait before scanning support zones again." },
        { status: 429 }
      ),
    };
  }

  return { uid: decoded.uid, response: null };
}

export async function GET(request: Request) {
  try {
    const auth = await authorizeNearSupportRequest(request);
    if (auth.response) return auth.response;

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
    const auth = await authorizeNearSupportRequest(request);
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const symbols = body.symbols && Array.isArray(body.symbols) && body.symbols.length > 0
      ? body.symbols
          .filter((s: unknown): s is string => typeof s === "string")
          .map((s: string) => s.trim().toUpperCase())
          .filter((s: string) => /^[A-Z0-9.^=-]{1,15}$/.test(s))
          .slice(0, 20)
      : DEFAULT_SYMBOLS;

    if (symbols.length === 0) {
      return NextResponse.json({ error: "No valid symbols provided" }, { status: 400 });
    }

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
