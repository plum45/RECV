export async function register() {
  // Only run the pinging mechanism in the Node.js server runtime, not Edge runtime
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const url = process.env.RENDER_EXTERNAL_URL || (process.env.KEEP_ALIVE === "true" ? "http://localhost:3000" : null);

    if (url) {
      const cleanUrl = url.replace(/\/$/, "");
      const pingUrl = `${cleanUrl}/api/health`;

      console.log(`[Keep-Alive] Initializing self-ping loop targeting: ${pingUrl}`);

      // Delay the first ping by 30 seconds to allow the server to complete its startup/listen phase
      setTimeout(() => {
        const sendPing = async () => {
          try {
            console.log(`[Keep-Alive] Sending ping to ${pingUrl}...`);
            const response = await fetch(pingUrl, {
              headers: {
                "User-Agent": "NextJS-KeepAlive-Worker",
              },
            });
            console.log(`[Keep-Alive] Ping response received: ${response.status} ${response.statusText}`);
          } catch (error: any) {
            console.error(`[Keep-Alive] Ping failed:`, error.message || error);
          }
        };

        // Run immediately after the initial startup delay
        sendPing();

        // Repeat every 10 minutes (600,000 milliseconds)
        // This resets Render's 15-minute inactivity timeout
        setInterval(sendPing, 10 * 60 * 1000);
      }, 30 * 1000);

      // ── Auto-register Telegram Bot Webhook ────────────────────────
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        setTimeout(async () => {
          try {
            const webhookUrl = `${cleanUrl.startsWith("http") ? cleanUrl : `https://${cleanUrl}`}/api/telegram/webhook`;
            const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || undefined;

            const body: Record<string, any> = {
              url: webhookUrl,
              allowed_updates: ["message"],
              drop_pending_updates: false,
            };
            if (webhookSecret) {
              body.secret_token = webhookSecret;
            }

            const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const data = await res.json();

            if (data.ok) {
              console.log(`[Telegram] ✅ Webhook auto-registered: ${webhookUrl}`);
            } else {
              console.error(`[Telegram] ❌ Webhook auto-register failed:`, data);
            }
          } catch (err: any) {
            console.error(`[Telegram] ❌ Webhook auto-register error:`, err.message);
          }
        }, 10 * 1000); // 10 seconds after startup
      } else {
        console.log("[Telegram] TELEGRAM_BOT_TOKEN not set. Webhook auto-register skipped.");
      }
    } else {
      console.log("[Keep-Alive] RENDER_EXTERNAL_URL not detected. Self-ping loop disabled.");
    }
  }
}

