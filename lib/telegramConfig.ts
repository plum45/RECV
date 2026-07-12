export function getTelegramBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "8726308416:AAFRMPLn3oxeckuos_LvLqYdFnjZiKylecI";
}

export function getTelegramBotUsername(): string {
  return (process.env.TELEGRAM_BOT_USERNAME || "MyRocketAlert_Bot").replace(/^@/, "").trim();
}
