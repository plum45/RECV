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
      return NextResponse.json({ success: false, message: "กรุณาเชื่อมต่อบ็อต Telegram ในหน้าตั้งค่าหรือสแกนเนอร์ก่อนส่ง" }, { status: 400 });
    }

    const { chatId, enabled } = telegramDoc.data() || {};
    if (!chatId || !enabled) {
      return NextResponse.json({ success: false, message: "บ็อต Telegram ปิดใช้งานอยู่ หรือเชื่อมต่อไม่ถูกต้อง" }, { status: 400 });
    }

    const token = getTelegramBotToken();
    if (!token) {
      return NextResponse.json({ success: false, message: "Server configuration missing TELEGRAM_BOT_TOKEN" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const { plan } = body;
    if (!plan) {
      return NextResponse.json({ success: false, message: "ข้อมูลแผนการเทรดไม่สมบูรณ์" }, { status: 400 });
    }

    // Format neat Telegram Markdown
    const isWait = plan.direction === "wait";
    const dirIcon = plan.direction === "long" ? "🟢 [LONG SETUP]" : plan.direction === "short" ? "🔴 [SHORT SETUP]" : "🟡 [WAITING SIGNAL]";
    
    let messageText = `📋 *Trading Plan: ${plan.symbol}* (${plan.tradingStyle.toUpperCase()})\n`;
    messageText += `━━━━━━━━━━━━━━━━━━━━━\n`;
    messageText += `*ทิศทาง:* ${dirIcon}\n`;
    messageText += `*กรอบเวลา (TF):* ${plan.timeframe}\n`;
    
    if (!isWait) {
      messageText += `*จุดเข้าซื้อ (Entry):* $${plan.entryLow} - $${plan.entryHigh}\n`;
      messageText += `*จุดตัดขาดทุน (SL):* $${plan.stopLoss}\n`;
      messageText += `*เป้าหมายทำกำไร (TP):*\n`;
      messageText += `  🔹 TP1: $${plan.takeProfit1}\n`;
      messageText += `  🔹 TP2: $${plan.takeProfit2}\n`;
      messageText += `  🔹 TP3: $${plan.takeProfit3}\n`;
      messageText += `*Risk/Reward Ratio:* 1:${plan.riskReward}\n`;
      if (plan.positionSize) {
        messageText += `*ขนาด Position แนะนำ:* ${plan.positionSize} หุ้น\n`;
      }
    }
    
    messageText += `*ระยะเวลาถือครอง:* ${plan.holdingPeriod}\n`;
    messageText += `*เงื่อนไขยกเลิกแผน:* ${plan.invalidation}\n`;
    messageText += `*ระดับความมั่นใจ:* ${plan.confidence}%\n`;
    messageText += `*สถานะปัจจุบัน:* ${plan.status}\n`;
    messageText += `━━━━━━━━━━━━━━━━━━━━━\n`;
    messageText += `*วิเคราะห์โดย:* ${plan.reasoning}\n\n`;
    messageText += `⚠️ *คำเตือน:* นี่ไม่ใช่คำแนะนำทางการลงทุน โปรดบริหารความเสี่ยงด้วยตัวท่านเอง`;

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      await axios.post(url, {
        chat_id: chatId,
        text: messageText,
        parse_mode: "Markdown",
      }, { timeout: 8000 });
    } catch (err: any) {
      const errMsg = err?.response?.data?.description || err.message;
      return NextResponse.json({ success: false, message: `ส่งแจ้งเตือน Telegram ล้มเหลว: ${errMsg}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "ส่งแผนการเทรดไปยัง Telegram สำเร็จ!" });
  } catch (error: any) {
    console.error("Failed to send trading plan to telegram:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
