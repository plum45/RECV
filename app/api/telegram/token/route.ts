import { NextResponse } from "next/server";
import crypto from "crypto";
import { verifyFirebaseIdTokenDetailed, getFirebaseAdminDb } from "../../../../lib/firebaseAdmin";
import { getTelegramBotUsername } from "../../../../lib/telegramConfig";

export async function POST(request: Request) {
  try {
    const { decoded, error: authErr } = await verifyFirebaseIdTokenDetailed(request);
    if (!decoded || !decoded.uid) {
      return NextResponse.json({ 
        success: false, 
        message: `Unauthorized: Invalid Firebase ID token (${authErr || "Token verification failed"})` 
      }, { status: 401 });
    }

    const uid = decoded.uid;
    const db = getFirebaseAdminDb();
    if (!db) {
      return NextResponse.json({ success: false, message: "Database not initialized" }, { status: 500 });
    }

    // Generate secure one-time connection token
    const tokenStr = `conn_${uid}_${crypto.randomBytes(12).toString("hex")}`;
    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000; // 15 minutes expiry

    await db.collection("telegramConnectionTokens").doc(tokenStr).set({
      uid,
      createdAt: now,
      expiresAt,
      used: false,
    });

    const botUsername = getTelegramBotUsername();

    return NextResponse.json({
      success: true,
      token: tokenStr,
      botUsername,
      startUrl: `https://t.me/${botUsername}?start=${tokenStr}`,
      expiresAt,
    });
  } catch (error: any) {
    console.error("Generate telegram token error:", error.message);
    return NextResponse.json({ success: false, message: "Internal server error generating token" }, { status: 500 });
  }
}
