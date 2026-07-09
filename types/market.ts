export interface TickerData {
  symbol: string;
  currentPrice: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  change24h: number;
}

export interface KlineData {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export interface IndicatorData {
  ema20: number;
  ema50: number;
  ema200: number;
  rsi14: number;
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
    crossover: "bullish" | "bearish" | "none"; // fresh crossover signal
  };
  atr14: number;
  pivot: {
    p: number;
    r1: number;
    s1: number;
    r2: number;
    s2: number;
    r3: number;
    s3: number;
  };
  volumeAnalysis: {
    avgVolume20: number;
    isVolumeSpike: boolean;
    currentVolume: number;
    volumeRatio: number;
    obv: number;       // On-Balance Volume direction: positive = accumulation
    obvTrend: "rising" | "falling" | "flat";
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;  // (upper-lower)/middle — volatility gauge
    percentB: number;   // where price is within the bands 0-1
    squeeze: boolean;   // bandwidth < 20-period avg bandwidth
  };
  adx: {
    adx: number;        // ADX value — trend strength (>25 = trending)
    plusDI: number;     // +DI
    minusDI: number;    // -DI
    trending: boolean;  // ADX > 25
    direction: "up" | "down" | "neutral";
  };
  stochasticRSI: {
    k: number;
    d: number;
    overbought: boolean;
    oversold: boolean;
  };
  fibonacci: {
    swing_high: number;
    swing_low: number;
    r0: number;   // 100% (swing high)
    r236: number; // 23.6% retracement
    r382: number; // 38.2%
    r500: number; // 50.0%
    r618: number; // 61.8%
    r786: number; // 78.6%
    r100: number; // 0% (swing low)
    ext127: number; // 127.2% extension
    ext161: number; // 161.8% extension
  };
  vwap: number; // Volume Weighted Average Price (intraday)
  marketStructure: {
    type: "uptrend" | "downtrend" | "sideways";
    higherHighs: boolean;
    higherLows: boolean;
    lowerHighs: boolean;
    lowerLows: boolean;
    lastSwingHigh: number;
    lastSwingLow: number;
    breakOfStructure: "bullish_bos" | "bearish_bos" | "none";
  };
}

export interface SupportResistanceZone {
  zone: string;
  type: "support" | "resistance";
  score: number;
  reasons: string[];
}

export interface SupportResistanceData {
  supportZones: SupportResistanceZone[];
  resistanceZones: SupportResistanceZone[];
}
