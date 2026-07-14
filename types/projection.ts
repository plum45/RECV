export interface PriceZone {
  low: number;
  high: number;
  formatted: string;
  reason: string;
  sources: string[];
}

export interface ConfirmationItem {
  label: string;
  isConfirmed: boolean;
  detail: string;
}

export interface ScenarioInfo {
  scenarioType: "bullish" | "base" | "bearish";
  targetZone: PriceZone;
  confirmations: ConfirmationItem[];
  confirmedCount: number;
  totalConfirmations: number;
  nextLevel: {
    label: string;
    price: number;
    formatted: string;
  };
  supportingReasons: string[];
  invalidationTrigger: {
    price: number;
    formatted: string;
    condition: string;
  };
  shiftConditions?: string[];
}

export interface EventRiskAssessment {
  level: "Low" | "Moderate" | "High";
  hasEventWithin24h: boolean;
  eventTitle?: string;
  eventTime?: string;
  warningMessage?: string;
}

export interface PriceProjectionData {
  projectionId: string;
  symbol: string;
  currentPrice: number;
  timeHorizon: string;
  confidence: "High" | "Moderate" | "Low" | "Conflicting";
  confidenceScore: number;
  confidenceReasons: string[];
  adxStrength: number;
  isSidewaysAdx: boolean;
  eventRisk: EventRiskAssessment;
  upsideScenario: ScenarioInfo;
  baseScenario: ScenarioInfo;
  downsideScenario: ScenarioInfo;
  isStaleProjection: boolean;
  atrValue: number;
  updatedAt: string;
  dataSource: string;
}
