import { NextResponse } from "next/server";
import axios from "axios";
import { getFirebaseAdminDb } from "../../../../lib/firebaseAdmin";
import { getTelegramBotToken } from "../../../../lib/telegramConfig";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    // Verify Telegram webhook secret if configured
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
      const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token");
      if (receivedSecret !== webhookSecret) {
        console.warn("Invalid Telegram webhook secret token");
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const message = body?.message || body?.edited_message;

    if (!message || !message.text || !message.chat?.id) {
      return NextResponse.json({ status: "ignored" });
    }

    const chatId = String(message.chat.id);
    const text = String(message.text).trim();

    // Check if command is /start conn_...
    if (text.startsWith("/start conn_")) {
      const tokenStr = text.split(" ")[1]?.trim();
      if (!tokenStr) {
        return NextResponse.json({ status: "missing_token" });
      }

      const db = getFirebaseAdminDb();
      if (!db) {
        console.error("Database not initialized in Telegram webhook");
        return NextResponse.json({ status: "db_error" }, { status: 500 });
      }

      const tokenRef = db.collection("telegramConnectionTokens").doc(tokenStr);
      const tokenDoc = await tokenRef.get();

      if (!tokenDoc.exists) {
        await sendTelegramMessage(chatId, "❌ ลิงก์เชื่อมต่อไม่ถูกต้อง หรือหมดอายุแล้ว กรุณาสร้างลิงก์ใหม่จากหน้าเว็บ Rocket AI");
        return NextResponse.json({ status: "invalid_token" });
      }

      const tokenData = tokenDoc.data();
      const now = Date.now();

      if (tokenData?.used || (tokenData?.expiresAt && now > tokenData.expiresAt)) {
        await sendTelegramMessage(chatId, "❌ ลิงก์เชื่อมต่อนี้ถูกใช้งานไปแล้ว หรือหมดอายุแล้ว กรุณาสร้างลิงก์ใหม่จากหน้าเว็บ");
        return NextResponse.json({ status: "expired_token" });
      }

      const uid = tokenData?.uid;
      if (!uid) {
        return NextResponse.json({ status: "invalid_uid" });
      }

      // Mark token as used
      await tokenRef.update({ used: true, usedAt: now });

      // Save user telegram settings in Firestore
      await db.collection("users").doc(uid).collection("settings").doc("telegram").set({
        chatId,
        connectedAt: now,
        enabled: true,
        username: message.from?.username || "",
        firstName: message.from?.first_name || "",
      }, { merge: true });

      // Also ensure default alertSettings exist if not already created
      const alertSettingsRef = db.collection("users").doc(uid).collection("settings").doc("alertSettings");
      const alertSettingsDoc = await alertSettingsRef.get();
      let alertSettingsData = alertSettingsDoc.exists ? alertSettingsDoc.data() : null;
      if (!alertSettingsData) {
        alertSettingsData = {
          enabled: true,
          symbols: ["BTC-USD", "ETH-USD", "SOL-USD"],
          rsiEnabled: true,
          macdEnabled: true,
          srFlipEnabled: true,
          supportEnabled: true,
          cooldownMinutes: 120,
        };
        await alertSettingsRef.set(alertSettingsData);
      }

      // Sync active subscription for Cron multi-user scanning
      await db.collection("activeAlertSubscriptions").doc(uid).set({
        uid,
        chatId,
        enabled: Boolean(alertSettingsData.enabled),
        symbols: Array.isArray(alertSettingsData.symbols) ? alertSettingsData.symbols : ["BTC-USD", "ETH-USD", "SOL-USD"],
        rsiEnabled: alertSettingsData.rsiEnabled !== undefined ? Boolean(alertSettingsData.rsiEnabled) : true,
        macdEnabled: alertSettingsData.macdEnabled !== undefined ? Boolean(alertSettingsData.macdEnabled) : true,
        srFlipEnabled: alertSettingsData.srFlipEnabled !== undefined ? Boolean(alertSettingsData.srFlipEnabled) : true,
        supportEnabled: alertSettingsData.supportEnabled !== undefined ? Boolean(alertSettingsData.supportEnabled) : true,
        cooldownMinutes: typeof alertSettingsData.cooldownMinutes === "number" ? alertSettingsData.cooldownMinutes : 120,
        updatedAt: now,
      }, { merge: true });

      await sendTelegramMessage(
        chatId,
        "✅ เชื่อมต่อการแจ้งเตือน Rocket AI เรียบร้อยแล้ว!\n\n🤖 บัญชี Telegram ของคุณได้รับการผูกเข้ากับระบบเรียบร้อย จากนี้คุณจะได้รับสัญญาณเตือนอัตโนมัติ 24 ชม. ตามการตั้งค่าบนหน้าเว็บ แม้จะปิดเบราว์เซอร์ไปแล้วก็ตามครับ 🚀"
      );

      return NextResponse.json({ status: "connected", uid, chatId });
    }

    return NextResponse.json({ status: "ok" });
  } catch (error: any) {
    console.error("Telegram webhook error:", error.message);
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}

async function sendTelegramMessage(chatId: string, text: string) {
  const token = getTelegramBotToken();
  if (!token) return;
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await axios.post(url, { chat_id: chatId, text }, { timeout: 8000 });
  } catch (err: any) {
    console.error("Failed to send Telegram message in webhook:", err?.response?.data || err.message);
  }
}
