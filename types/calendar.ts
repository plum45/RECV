export type EventImportance = "low" | "medium" | "high";

export interface EventSource {
  source: string;
  sourceUrl?: string;
  fetchedAt: string;
  timezone: string;
  eventId?: string;
}

export interface EventScenario {
  condition: string;
  benefitingSectors: string[];
  targets: string[];
  confirmationSignals: string[];
}

export interface EventImpact {
  positiveScenario: EventScenario;
  baseScenario: {
    expectedMarketEffect: string;
    rangeBoundFactor: string;
    factorsToWatch: string[];
  };
  negativeScenario: EventScenario;
}

export type EventStatus =
  | "confirmed"
  | "estimated"
  | "delayed"
  | "LIVE"
  | "DELAYED"
  | "ESTIMATED"
  | "FALLBACK"
  | "UNAVAILABLE";

export interface EconomicEvent {
  id: string;
  eventId?: string;
  title: string;
  type: "economic";
  importance: EventImportance;
  announcedAt: string; // ISO String
  timeThai: string; // ISO String in GMT+7
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  revision: string | null;
  country: string;
  source: EventSource;
  status: EventStatus;
}

export interface EarningsEvent {
  id: string;
  eventId?: string;
  symbol: string;
  type: "earnings";
  announcedAt: string; // ISO String
  timeThai: string; // ISO String in GMT+7
  importance: EventImportance;
  revenueActual: string | null;
  revenueForecast: string | null;
  revenuePrevious: string | null;
  epsActual: string | null;
  epsForecast: string | null;
  epsPrevious: string | null;
  netIncomeActual?: string | null;
  grossMarginActual?: string | null;
  guidance?: string | null;
  eventTypeName: "Earnings" | "Dividend" | "Meeting" | "InvestorDay" | "AnalystMeeting";
  source: EventSource;
  status: EventStatus;
  quarter?: number;
  year?: number;
  exchange?: string;
}

export interface CryptoEvent {
  id: string;
  eventId?: string;
  title: string;
  type: "crypto";
  symbol: string;
  announcedAt: string; // ISO String
  timeThai: string;
  importance: EventImportance;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  source: EventSource;
  status: EventStatus;
}

export type GeneralCalendarEvent = EconomicEvent | EarningsEvent | CryptoEvent;

export interface EventAlertPreference {
  enabled: boolean;
  symbols: string[];
  types: ("economic" | "earnings" | "crypto")[];
  importance: EventImportance[];
  alertLeadTimes: number[]; // in minutes (e.g. 10080 for 7 days, 1440 for 24h, 60 for 1h)
}
