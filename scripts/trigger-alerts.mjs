const alertUrl = process.env.ALERT_TRIGGER_URL;
const cronSecret = process.env.ALERT_CRON_SECRET;

if (!alertUrl || !cronSecret) {
  throw new Error("ALERT_TRIGGER_URL and ALERT_CRON_SECRET must be configured for the alert cron job.");
}

const response = await fetch(alertUrl, {
  method: "POST",
  headers: { Authorization: `Bearer ${cronSecret}` },
  signal: AbortSignal.timeout(90_000),
});

const body = await response.text();
if (!response.ok) {
  throw new Error(`Alert scan failed with HTTP ${response.status}: ${body.slice(0, 500)}`);
}

console.log(`Alert scan completed: ${body.slice(0, 500)}`);
