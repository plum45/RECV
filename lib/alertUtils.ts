export interface QuietHours {
  enabled?: boolean;
  start?: string;
  end?: string;
}

export interface SymbolAlertConfig {
  rsiEnabled?: boolean;
  macdEnabled?: boolean;
  srFlipEnabled?: boolean;
  supportEnabled?: boolean;
}

export interface AlertSettings {
  enabled: boolean;
  symbols: string[];
  rsiEnabled: boolean;
  macdEnabled: boolean;
  srFlipEnabled: boolean;
  supportEnabled: boolean;
  cooldownMinutes: number;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  configs: Record<string, SymbolAlertConfig>;
  updatedAt?: number;
}

export interface AlertOutcome {
  price: number;
  changePercent: number;
  result: string;
}

const DEFAULT_SYMBOLS = ["BTC-USD", "ETH-USD", "SOL-USD"];
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeSymbols(symbols: unknown): string[] {
  if (!Array.isArray(symbols)) return DEFAULT_SYMBOLS;

  const normalized = symbols
    .filter((symbol): symbol is string => typeof symbol === "string")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => /^[A-Z0-9.^=-]{1,15}$/.test(symbol));

  return normalized.length > 0 ? Array.from(new Set(normalized)) : DEFAULT_SYMBOLS;
}

function normalizeQuietHours(quietHours: unknown): AlertSettings["quietHours"] {
  if (!quietHours || typeof quietHours !== "object") {
    return { enabled: false, start: "22:00", end: "06:00" };
  }

  const data = quietHours as QuietHours;
  const start = typeof data.start === "string" && TIME_PATTERN.test(data.start) ? data.start : "22:00";
  const end = typeof data.end === "string" && TIME_PATTERN.test(data.end) ? data.end : "06:00";

  return {
    enabled: Boolean(data.enabled),
    start,
    end,
  };
}

function normalizeConfigs(configs: unknown): Record<string, SymbolAlertConfig> {
  if (!configs || typeof configs !== "object" || Array.isArray(configs)) return {};

  return Object.entries(configs as Record<string, unknown>).reduce<Record<string, SymbolAlertConfig>>(
    (acc, [rawSymbol, rawConfig]) => {
      const symbol = rawSymbol.trim().toUpperCase();
      if (!/^[A-Z0-9.^=-]{1,15}$/.test(symbol) || !rawConfig || typeof rawConfig !== "object") {
        return acc;
      }

      const config = rawConfig as SymbolAlertConfig;
      acc[symbol] = {
        rsiEnabled: config.rsiEnabled !== undefined ? Boolean(config.rsiEnabled) : true,
        macdEnabled: config.macdEnabled !== undefined ? Boolean(config.macdEnabled) : true,
        srFlipEnabled: config.srFlipEnabled !== undefined ? Boolean(config.srFlipEnabled) : true,
        supportEnabled: config.supportEnabled !== undefined ? Boolean(config.supportEnabled) : true,
      };
      return acc;
    },
    {}
  );
}

export function normalizeAlertSettings(input: unknown, updatedAt?: number): AlertSettings {
  const data = input && typeof input === "object" ? input as Record<string, unknown> : {};

  return {
    enabled: data.enabled !== undefined ? Boolean(data.enabled) : true,
    symbols: normalizeSymbols(data.symbols),
    rsiEnabled: data.rsiEnabled !== undefined ? Boolean(data.rsiEnabled) : true,
    macdEnabled: data.macdEnabled !== undefined ? Boolean(data.macdEnabled) : true,
    srFlipEnabled: data.srFlipEnabled !== undefined ? Boolean(data.srFlipEnabled) : true,
    supportEnabled: data.supportEnabled !== undefined ? Boolean(data.supportEnabled) : true,
    cooldownMinutes: typeof data.cooldownMinutes === "number" && data.cooldownMinutes >= 15
      ? data.cooldownMinutes
      : 120,
    quietHours: normalizeQuietHours(data.quietHours),
    configs: normalizeConfigs(data.configs),
    ...(updatedAt !== undefined ? { updatedAt } : {}),
  };
}

export function isWithinQuietHours(
  quietHours: QuietHours | undefined,
  now = new Date(),
  utcOffsetHours = 7
): boolean {
  if (!quietHours?.enabled) return false;

  const { start = "22:00", end = "06:00" } = normalizeQuietHours(quietHours);
  const localTime = new Date(now.getTime() + utcOffsetHours * 60 * 60 * 1000);
  const currentMinutes = localTime.getUTCHours() * 60 + localTime.getUTCMinutes();
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

export function resolveSymbolAlertConfig(
  settings: Pick<AlertSettings, "rsiEnabled" | "macdEnabled" | "srFlipEnabled" | "supportEnabled" | "configs">,
  symbol: string
): Required<SymbolAlertConfig> {
  const config = settings.configs?.[symbol.toUpperCase()] || {};

  return {
    rsiEnabled: config.rsiEnabled !== undefined ? Boolean(config.rsiEnabled) : settings.rsiEnabled !== false,
    macdEnabled: config.macdEnabled !== undefined ? Boolean(config.macdEnabled) : settings.macdEnabled !== false,
    srFlipEnabled: config.srFlipEnabled !== undefined ? Boolean(config.srFlipEnabled) : settings.srFlipEnabled !== false,
    supportEnabled: config.supportEnabled !== undefined ? Boolean(config.supportEnabled) : settings.supportEnabled !== false,
  };
}

export function calculateAlertOutcome(
  priceAtTrigger: number,
  currentPrice: number,
  thresholdPercent: number
): AlertOutcome {
  const changePercent = priceAtTrigger > 0
    ? ((currentPrice - priceAtTrigger) / priceAtTrigger) * 100
    : 0;

  return {
    price: currentPrice,
    changePercent,
    result: changePercent >= thresholdPercent
      ? "Bullish"
      : changePercent <= -thresholdPercent
        ? "Bearish"
        : "Neutral",
  };
}
