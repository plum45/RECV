export type AssetClass = "equity" | "crypto" | "precious_metal";

export interface AssetProfile {
  assetClass: AssetClass;
  label: string;
  isPreciousMetal: boolean;
  sessionTimeZone: string;
  /** CME metals trading day begins at 18:00 New York time. */
  sessionStartHour: number;
  alertTimeframe: string;
  recommendedTimeframes: {
    day: string;
    swing: string;
    position: string;
  };
  supportAlert: {
    upperPercent: number;
    lowerPercent: number;
  };
  macroDrivers: string[];
}

const PRECIOUS_METAL_SYMBOLS = new Set(["GC=F", "SI=F", "XAUUSD=X", "XAGUSD=X"]);

const defaultProfile: AssetProfile = {
  assetClass: "equity",
  label: "Equity",
  isPreciousMetal: false,
  sessionTimeZone: "America/New_York",
  sessionStartHour: 0,
  alertTimeframe: "15m",
  recommendedTimeframes: { day: "15m", swing: "4H", position: "1D" },
  supportAlert: { upperPercent: 2.5, lowerPercent: -1 },
  macroDrivers: [],
};

const preciousMetalsProfile: AssetProfile = {
  assetClass: "precious_metal",
  label: "Precious Metals",
  isPreciousMetal: true,
  sessionTimeZone: "America/New_York",
  sessionStartHour: 18,
  alertTimeframe: "15m",
  recommendedTimeframes: { day: "15m", swing: "4H", position: "1D" },
  supportAlert: { upperPercent: 1.6, lowerPercent: -0.6 },
  macroDrivers: ["CPI / PPI", "NFP", "FOMC / US rates", "US Dollar (DXY)", "US Treasury yields"],
};

const cryptoProfile: AssetProfile = {
  ...defaultProfile,
  assetClass: "crypto",
  label: "Crypto",
  sessionTimeZone: "UTC",
  sessionStartHour: 0,
  supportAlert: { upperPercent: 2, lowerPercent: -0.75 },
};

export function getAssetProfile(symbol: string): AssetProfile {
  const normalized = symbol.trim().toUpperCase();
  if (PRECIOUS_METAL_SYMBOLS.has(normalized)) return preciousMetalsProfile;
  if (normalized.endsWith("-USD")) return cryptoProfile;
  return defaultProfile;
}

