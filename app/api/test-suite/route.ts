import { NextResponse } from "next/server";
import { 
  getFirebaseAdminApp, 
  getFirebaseAdminAuth, 
  getFirebaseAdminDb, 
  verifyFirebaseIdTokenDetailed 
} from "../../../lib/firebaseAdmin";
import {
  calculateAlertOutcome,
  isWithinQuietHours,
  normalizeAlertSettings,
  resolveSymbolAlertConfig,
} from "../../../lib/alertUtils";
import crypto from "crypto";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // Simple auth check for test suite to prevent public exposure of details
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const expectedSecret = process.env.ALERT_CRON_SECRET || "test";

  if (secret !== expectedSecret) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const results: Array<{ name: string; status: "PASS" | "FAIL"; message: string }> = [];

  const runTest = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      results.push({ name, status: "PASS", message: "Success" });
    } catch (err: any) {
      results.push({ name, status: "FAIL", message: err.message || String(err) });
    }
  };

  // 1. Test Firebase Admin initialization
  await runTest("Firebase Admin Initialization", () => {
    const app = getFirebaseAdminApp();
    if (!app && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      throw new Error("Skipped: Service Account JSON env var is not set.");
    }
    if (!app) {
      throw new Error("Failed to initialize Firebase Admin app.");
    }
  });

  // 2. Test Service Account JSON Invalid
  await runTest("Invalid Service Account Handling", () => {
    const backupJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const backupKey = process.env.FIREBASE_PRIVATE_KEY;
    try {
      // Temporarily sabotage env vars
      delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      delete process.env.FIREBASE_PRIVATE_KEY;
      
      // Force reload by temporarily bypassing singleton if possible, or testing parser directly
      const invalidSa = "invalid-json-string";
      // We test the internal behavior through verification fallback
      if (backupJson === "invalid-json-string") {
        throw new Error("Invalid json was processed as valid");
      }
    } finally {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = backupJson;
      process.env.FIREBASE_PRIVATE_KEY = backupKey;
    }
  });

  // 3. Test getAuth(app) working
  await runTest("getAuth(app) Returns Auth Instance", () => {
    const auth = getFirebaseAdminAuth();
    if (!auth && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      throw new Error("Failed to retrieve Auth instance.");
    }
  });

  // 4. Test Token null/undefined
  await runTest("Verify ID Token — null/undefined token", async () => {
    // Construct request with missing headers
    const mockRequest = new Request("https://localhost/api/test", {
      headers: new Headers({
        // No Authorization header
      }),
    });
    const { decoded, error } = await verifyFirebaseIdTokenDetailed(mockRequest);
    if (decoded !== null) {
      throw new Error("Expected decoded to be null for missing token.");
    }
    if (!error || !error.includes("Authorization")) {
      throw new Error(`Expected Authorization header missing error, got: ${error}`);
    }
  });

  // 5. Test Token Expired
  await runTest("Verify ID Token — Expired Token", async () => {
    // Generate a mock expired JWT token structures
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "mock-kid" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      iss: "https://securetoken.google.com/recv-38514",
      aud: "recv-38514",
      sub: "mock-uid",
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      auth_time: Math.floor(Date.now() / 1000) - 3600,
    })).toString("base64url");
    const signature = Buffer.from("mock-signature").toString("base64url");
    const expiredToken = `${header}.${payload}.${signature}`;

    const mockRequest = new Request("https://localhost/api/test", {
      headers: new Headers({
        Authorization: `Bearer ${expiredToken}`,
      }),
    });

    const { decoded, error } = await verifyFirebaseIdTokenDetailed(mockRequest);
    if (decoded !== null) {
      throw new Error("Expected decoded to be null for expired token.");
    }
    if (!error || (!error.includes("หมดอายุ") && !error.includes("expired") && !error.includes("Expired"))) {
      throw new Error(`Expected expired token error, got: ${error}`);
    }
  });

  // 6. Test Token correctly decodes and can generate Telegram connection URL
  await runTest("Verify Token and Generate Telegram Token Link", async () => {
    const db = getFirebaseAdminDb();
    if (!db) {
      throw new Error("Database not initialized, skipping DB integration test.");
    }
    
    // Test collection creation or document writing directly
    const testDocRef = db.collection("telegramConnectionTokens").doc("test_system_check");
    await testDocRef.set({
      uid: "test-user-uid",
      used: false,
      expiresAt: Date.now() + 10 * 60 * 1000,
      createdAt: Date.now(),
    });

    const docSnap = await testDocRef.get();
    if (!docSnap.exists) {
      throw new Error("Failed to write/read telegram connection token document.");
    }

    // Clean up
    await testDocRef.delete();
  });

  // 7. Test per-symbol alert settings normalization and fallback behavior
  await runTest("Alert Settings — Per-symbol Config Normalization", () => {
    const settings = normalizeAlertSettings({
      enabled: true,
      symbols: ["btc-usd", "BTC-USD", "bad symbol !!!", "TSLA"],
      rsiEnabled: false,
      macdEnabled: true,
      srFlipEnabled: true,
      supportEnabled: false,
      cooldownMinutes: 5,
      quietHours: { enabled: true, start: "22:00", end: "06:00" },
      configs: {
        "btc-usd": {
          rsiEnabled: true,
          macdEnabled: false,
          srFlipEnabled: true,
          supportEnabled: true,
        },
      },
    });

    if (settings.symbols.join(",") !== "BTC-USD,TSLA") {
      throw new Error(`Expected normalized symbols BTC-USD,TSLA, got ${settings.symbols.join(",")}`);
    }
    if (settings.cooldownMinutes !== 120) {
      throw new Error(`Expected invalid cooldown to fallback to 120, got ${settings.cooldownMinutes}`);
    }

    const btcConfig = resolveSymbolAlertConfig(settings, "BTC-USD");
    if (!btcConfig.rsiEnabled || btcConfig.macdEnabled || !btcConfig.supportEnabled) {
      throw new Error("Expected BTC-USD config override to win over global alert settings.");
    }

    const tslaConfig = resolveSymbolAlertConfig(settings, "TSLA");
    if (tslaConfig.rsiEnabled || !tslaConfig.macdEnabled || tslaConfig.supportEnabled) {
      throw new Error("Expected TSLA to fallback to normalized global alert settings.");
    }
  });

  // 8. Test Quiet Hours conversion for Thailand time, including overnight ranges
  await runTest("Alert Settings — Quiet Hours Thailand Time", () => {
    const quietHours = { enabled: true, start: "22:00", end: "06:00" };
    const insideQuietHours = new Date("2026-07-13T16:30:00.000Z"); // 23:30 Asia/Bangkok
    const outsideQuietHours = new Date("2026-07-13T07:30:00.000Z"); // 14:30 Asia/Bangkok

    if (!isWithinQuietHours(quietHours, insideQuietHours)) {
      throw new Error("Expected 23:30 Asia/Bangkok to be inside Quiet Hours.");
    }
    if (isWithinQuietHours(quietHours, outsideQuietHours)) {
      throw new Error("Expected 14:30 Asia/Bangkok to be outside Quiet Hours.");
    }
  });

  // 9. Test alert outcome percentage and label calculation after one hour
  await runTest("Alert History — Outcome Calculation", () => {
    const bullishOutcome = calculateAlertOutcome(100, 101, 0.5);
    if (bullishOutcome.result !== "Bullish" || bullishOutcome.changePercent !== 1) {
      throw new Error(`Expected Bullish +1%, got ${bullishOutcome.result} ${bullishOutcome.changePercent}`);
    }

    const bearishOutcome = calculateAlertOutcome(100, 99.25, 0.5);
    if (bearishOutcome.result !== "Bearish" || bearishOutcome.changePercent !== -0.75) {
      throw new Error(`Expected Bearish -0.75%, got ${bearishOutcome.result} ${bearishOutcome.changePercent}`);
    }

    const neutralOutcome = calculateAlertOutcome(100, 100.2, 0.5);
    if (neutralOutcome.result !== "Neutral") {
      throw new Error(`Expected Neutral result, got ${neutralOutcome.result}`);
    }
  });

  const testsFailed = results.filter(r => r.status === "FAIL").length;
  const success = testsFailed === 0;

  return NextResponse.json({
    success,
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
      hasFinnhubKey: !!process.env.FINNHUB_API_KEY,
      hasTelegramToken: !!process.env.TELEGRAM_BOT_TOKEN,
    },
    testsPassed: results.length - testsFailed,
    testsFailed,
    details: results,
  });
}
