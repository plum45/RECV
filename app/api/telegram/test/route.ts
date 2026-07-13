import { NextResponse } from "next/server";
import axios from "axios";
import { verifyFirebaseIdTokenDetailed, getFirebaseAdminDb } from "../../../../lib/firebaseAdmin";
import { getTelegramBotToken } from "../../../../lib/telegramConfig";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { decoded, error: authErr } = await verifyFirebaseIdTokenDetailed(request);
    if (!decoded || !decoded.uid) {
      return NextResponse.json({ success: false, message: `Unauthorized (${authErr || "Invalid token"})` }, { status: 401 });
    }

    const uid = decoded.uid;
    const db = getFirebaseAdminDb();
    if (!db) {
      return NextResponse.json({ success: false, message: "Database not initialized" }, { status: 500 });
    }

    const telegramDoc = await db.collection("users").doc(uid).collection("settings").doc("telegram").get();
    if (!telegramDoc.exists) {
      return NextResponse.json({ success: false, message: "ยังไม่ได้ทำการเชื่อมต่อ Telegram บ็อต" }, { status: 400 });
    }

    const { chatId, enabled } = telegramDoc.data() || {};
    if (!chatId) {
      return NextResponse.json({ success: false, message: "ไม่พบ Chat ID กรุณาทำการเชื่อมต่อ Telegram ใหม่" }, { status: 400 });
    }

    const token = getTelegramBotToken();
    if (!token) {
      return NextResponse.json({ success: false, message: "Server configuration missing TELEGRAM_BOT_TOKEN" }, { status: 500 });
    }

    const messageText = `🔔 [Rocket AI Test Alert]\n\nสวัสดีครับ! นี่คือข้อความทดสอบจากระบบ Rocket AI\nหากคุณได้รับข้อความนี้ แสดงว่าระบบแจ้งเตือนอัตโนมัติของคุณพร้อมทำงานเรียบร้อยแล้วครับ 🚀`;

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      await axios.post(url, {
        chat_id: chatId,
        text: messageText,
      }, { timeout: 8000 });
    } catch (err: any) {
      const errMsg = err?.response?.data?.description || err.message;
      console.error(`Failed to send test alert to user ${uid} (${chatId}):`, errMsg);

      // Check if user blocked the bot
      if (typeof errMsg === "string" && (errMsg.includes("bot was blocked") || errMsg.includes("user is deactivated") || errMsg.includes("chat not found"))) {
        await db.collection("users").doc(uid).collection("settings").doc("telegram").update({
          enabled: false,
          error: "Bot was blocked or chat not found",
        });
      }

      return NextResponse.json({ success: false, message: `ส่งข้อความทดสอบล้มเหลว: ${errMsg}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "ส่งข้อความทดสอบสำเร็จ!" });
  } catch (error: any) {
    console.error("Test telegram alert error:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
