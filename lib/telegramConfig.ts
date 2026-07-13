export function getTelegramBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

export function getTelegramBotUsername(): string {
  return (process.env.TELEGRAM_BOT_USERNAME || "MyRocketAlert_Bot").replace(/^@/, "").trim();
}
