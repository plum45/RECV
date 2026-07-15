export const TRADING_STYLES = ["scalping", "day", "swing", "position"] as const;

export type TradingStyle = (typeof TRADING_STYLES)[number];

const STORAGE_KEY = "rocket_trading_style";

export function isTradingStyle(value: unknown): value is TradingStyle {
  return typeof value === "string" && (TRADING_STYLES as readonly string[]).includes(value);
}

export function getStoredTradingStyle(): TradingStyle {
  if (typeof window === "undefined") return "swing";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isTradingStyle(stored) ? stored : "swing";
}

export function storeTradingStyle(style: TradingStyle): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, style);
  }
}

export function getRecommendedTimeframe(style: TradingStyle): string {
  if (style === "scalping") return "5m";
  if (style === "day") return "15m";
  if (style === "position") return "1D";
  return "1H";
}
