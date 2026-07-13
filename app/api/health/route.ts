import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const isServiceAccountConfigured = !!(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL)
  );

  return NextResponse.json(
    {
      status: "ok",
      version: "v2-standalone-auth-fix",
      commit: "latest-auth-resilience",
      firebaseServiceAccountConfigured: isServiceAccountConfigured,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "not-set",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    }
  );
}
