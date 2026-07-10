import { NextResponse } from "next/server";
import axios from "axios";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { type, token, chatId } = body;

    const testMessage = "🚀 การเชื่อมต่อกับ Rocket AI Trading Assistant สำเร็จ! ระบบแจ้งเตือนบ็อตของคุณพร้อมทำงานแล้ว";

    if (type === "line") {
      if (!token) {
        return NextResponse.json({ success: false, error: "Missing Line Token" }, { status: 400 });
      }

      const params = new URLSearchParams();
      params.append("message", testMessage);

      const response = await axios.post("https://notify-api.line.me/api/notify", params, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 8000,
      });

      if (response.data.status === 200) {
        return NextResponse.json({ success: true });
      } else {
        throw new Error(response.data.message || "Line Notify API error");
      }
    } else if (type === "telegram") {
      if (!token || !chatId) {
        return NextResponse.json({ success: false, error: "Missing Bot Token or Chat ID" }, { status: 400 });
      }

      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await axios.post(
        url,
        {
          chat_id: chatId,
          text: testMessage,
        },
        { timeout: 8000 }
      );

      if (response.data.ok) {
        return NextResponse.json({ success: true });
      } else {
        throw new Error(response.data.description || "Telegram API error");
      }
    }

    return NextResponse.json({ success: false, error: "Invalid alert type" }, { status: 400 });
  } catch (error: any) {
    console.error("Alert test error:", error.response?.data || error.message);
    return NextResponse.json(
      { success: false, error: error.response?.data?.message || error.response?.data?.description || error.message },
      { status: 500 }
    );
  }
}
