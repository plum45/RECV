/**
 * Central Symbol Mapping and Normalization Utility (`lib/symbolMapping.ts`)
 * Ensures consistent matching across Live Calendar, News, and Alert Services.
 *
 * Rules handled:
 * - ASML = ASML.AS = ASML NA
 * - TSM = TSMC = 2330.TW = 2330
 * - 005930 = Samsung = 005930.KS = SAMSUNG ELECTRONICS
 * - 000660 = SK Hynix = 000660.KS = HYNIX
 * - SAP.DE = SAP
 * - SIE.DE = Siemens = SIE
 * - Crypto suffixes stripped or normalized (e.g., BTCUSDT -> BTC)
 */

// Normalized standard ticker mapping
export const SYMBOL_ALIAS_MAP: Record<string, string> = {
  // ASML variants
  "ASML.AS": "ASML",
  "ASML NA": "ASML",
  "ASML": "ASML",

  // TSMC variants
  "TSM": "TSM",
  "TSMC": "TSM",
  "2330.TW": "TSM",
  "2330": "TSM",

  // Samsung variants
  "005930": "005930",
  "005930.KS": "005930",
  "SAMSUNG": "005930",
  "SAMSUNG ELECTRONICS": "005930",

  // SK Hynix variants
  "000660": "000660",
  "000660.KS": "000660",
  "HYNIX": "000660",
  "SK HYNIX": "000660",
  "SKHYNIX": "000660",

  // SAP variants
  "SAP.DE": "SAP",
  "SAP": "SAP",

  // Siemens variants
  "SIE.DE": "SIE",
  "SIE": "SIE",

  // Crypto variants
  "BTCUSDT": "BTC",
  "ETHUSDT": "ETH",
  "SOLUSDT": "SOL",
  "BNBUSDT": "BNB",
  "XRPUSDT": "XRP",
  "DOGEUSDT": "DOGE",
  "ADAUSDT": "ADA",
  "AVAXUSDT": "AVAX",
};

/**
 * Normalizes a given symbol string to its standard primary identifier.
 * E.g., "ASML.AS" -> "ASML", "TSMC" -> "TSM", "005930.KS" -> "005930"
 */
export function normalizeSymbol(rawSymbol: string): string {
  if (!rawSymbol) return "";
  const cleaned = rawSymbol.trim().toUpperCase();

  // Check exact map hit
  if (SYMBOL_ALIAS_MAP[cleaned]) {
    return SYMBOL_ALIAS_MAP[cleaned];
  }

  // Check if stripped of exchange suffix (.NYSE, .NASDAQ, .US, .DE, .AS, .TW, .KS, .T) matches any
  const withoutSuffix = cleaned.replace(/\.(NYSE|NASDAQ|US|DE|AS|TW|KS|T|NA)$/i, "");
  if (SYMBOL_ALIAS_MAP[withoutSuffix]) {
    return SYMBOL_ALIAS_MAP[withoutSuffix];
  }

  // Crypto suffix cleanup (-USD, USDT, USDC)
  if (cleaned.endsWith("USDT") || cleaned.endsWith("USDC") || cleaned.endsWith("-USD")) {
    const cryptoBase = cleaned.replace(/USDT|USDC|-USD/g, "");
    return SYMBOL_ALIAS_MAP[cryptoBase] || cryptoBase;
  }

  return withoutSuffix || cleaned;
}

/**
 * Checks if two symbols represent the same underlying asset or company.
 */
export function areSymbolsEquivalent(sym1: string, sym2: string): boolean {
  if (!sym1 || !sym2) return false;
  const norm1 = normalizeSymbol(sym1);
  const norm2 = normalizeSymbol(sym2);
  return norm1 === norm2;
}

/**
 * Checks if a normalized symbol matches any in an array of symbols/aliases.
 */
export function matchesAnySymbol(targetSymbol: string, symbolList: string[]): boolean {
  if (!targetSymbol || !symbolList || symbolList.length === 0) return false;
  const normTarget = normalizeSymbol(targetSymbol);
  return symbolList.some((s) => normalizeSymbol(s) === normTarget);
}

/**
 * Returns all common aliases for a normalized symbol so that search queries or database filters check all variations.
 */
export function getAllSymbolAliases(symbol: string): string[] {
  const norm = normalizeSymbol(symbol);
  const aliases = new Set<string>([norm, symbol.toUpperCase()]);

  for (const [key, val] of Object.entries(SYMBOL_ALIAS_MAP)) {
    if (val === norm) {
      aliases.add(key);
    }
  }

  return Array.from(aliases);
}
