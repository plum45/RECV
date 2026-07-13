import { NextResponse } from "next/server";
import { getTelegramBotToken } from "../../../../lib/telegramConfig";

export const runtime = "nodejs";

/**
 * GET /api/telegram/setup-webhook?secret=<ALERT_CRON_SECRET>
 * 
 * Registers the Telegram Bot webhook to point to this server's
 * /api/telegram/webhook endpoint.
 */
export async function GET(request: Request) {
  try {
    // Simple auth: require ALERT_CRON_SECRET or TELEGRAM_WEBHOOK_SECRET
    const url = new URL(request.url);
    const secret = url.searchParams.get("secret");
    const expectedSecret = process.env.ALERT_CRON_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET;
    
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const botToken = getTelegramBotToken();
    if (!botToken) {
      return NextResponse.json({ success: false, message: "TELEGRAM_BOT_TOKEN not configured" }, { status: 500 });
    }

    // Determine the base URL
    const baseUrl = process.env.RENDER_EXTERNAL_URL 
      || process.env.NEXT_PUBLIC_SITE_URL 
      || process.env.VERCEL_URL 
      || null;

    if (!baseUrl) {
      return NextResponse.json({ 
        success: false, 
        message: "Cannot determine server URL. Set RENDER_EXTERNAL_URL env var." 
      }, { status: 500 });
    }

    const cleanBase = baseUrl.replace(/\/$/, "");
    const webhookUrl = `${cleanBase.startsWith("http") ? cleanBase : `https://${cleanBase}`}/api/telegram/webhook`;
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || undefined;

    // Call Telegram setWebhook API
    const setWebhookUrl = `https://api.telegram.org/bot${botToken}/setWebhook`;
    const body: Record<string, any> = {
      url: webhookUrl,
      allowed_updates: ["message"],
      drop_pending_updates: false,
    };
    if (webhookSecret) {
      body.secret_token = webhookSecret;
    }

    const res = await fetch(setWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data.ok) {
      console.log(`[Telegram] ✅ Webhook set to: ${webhookUrl}`);
      return NextResponse.json({ 
        success: true, 
        message: `Webhook registered: ${webhookUrl}`,
        telegram_response: data,
      });
    } else {
      console.error("[Telegram] ❌ setWebhook failed:", data);
      return NextResponse.json({ 
        success: false, 
        message: "Telegram setWebhook failed",
        telegram_response: data,
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[Telegram] Webhook setup error:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
