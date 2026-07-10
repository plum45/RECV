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
    } else {
      console.log("[Keep-Alive] RENDER_EXTERNAL_URL not detected. Self-ping loop disabled.");
    }
  }
}
