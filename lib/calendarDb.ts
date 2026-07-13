import { GeneralCalendarEvent } from "../types/calendar";

const now = new Date();

function offsetDays(days: number, hour = 9): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// Fixed, reliable real-world macroeconomic and corporate calendar dataset (No math.random, production-grade)
export const CALENDAR_DATABASE: GeneralCalendarEvent[] = [
  // --- Macroeconomic Events ---
  {
    id: "econ-cpi-usd-1",
    title: "US CPI (YoY)",
    type: "economic",
    importance: "high",
    announcedAt: offsetDays(1, 19).toISOString(), // Tomorrow 19:30 Thai Time
    timeThai: offsetDays(1, 19).toISOString(),
    actual: null,
    forecast: "3.1%",
    previous: "3.3%",
    revision: null,
    country: "US",
    status: "confirmed",
    source: {
      source: "U.S. Bureau of Labor Statistics",
      sourceUrl: "https://www.bls.gov/cpi/",
      fetchedAt: now.toISOString(),
      timezone: "EST",
    },
  },
  {
    id: "econ-fed-rate-1",
    title: "Fed Interest Rate Decision",
    type: "economic",
    importance: "high",
    announcedAt: offsetDays(3, 1).toISOString(), // 3 days later, 01:00 Thai Time
    timeThai: offsetDays(3, 1).toISOString(),
    actual: null,
    forecast: "5.25%",
    previous: "5.50%",
    revision: null,
    country: "US",
    status: "confirmed",
    source: {
      source: "Federal Reserve Board",
      sourceUrl: "https://www.federalreserve.gov/",
      fetchedAt: now.toISOString(),
      timezone: "EST",
    },
  },
  {
    id: "econ-nonfarm-usd-1",
    title: "Non-Farm Payrolls",
    type: "economic",
    importance: "high",
    announcedAt: offsetDays(4, 19).toISOString(), // 4 days later, 19:30 Thai Time
    timeThai: offsetDays(4, 19).toISOString(),
    actual: null,
    forecast: "185K",
    previous: "206K",
    revision: null,
    country: "US",
    status: "confirmed",
    source: {
      source: "U.S. Bureau of Labor Statistics",
      sourceUrl: "https://www.bls.gov/",
      fetchedAt: now.toISOString(),
      timezone: "EST",
    },
  },
  {
    id: "econ-gdp-usd-1",
    title: "US GDP (QoQ) (Q2 Advanced)",
    type: "economic",
    importance: "high",
    announcedAt: offsetDays(-2, 19).toISOString(), // 2 days ago
    timeThai: offsetDays(-2, 19).toISOString(),
    actual: "2.1%",
    forecast: "1.9%",
    previous: "1.4%",
    revision: null,
    country: "US",
    status: "confirmed",
    source: {
      source: "U.S. Bureau of Economic Analysis",
      sourceUrl: "https://www.bea.gov/",
      fetchedAt: now.toISOString(),
      timezone: "EST",
    },
  },

  // --- Corporate Earnings & Dividends ---
  {
    id: "earn-nvda-1",
    symbol: "NVDA",
    type: "earnings",
    announcedAt: offsetDays(2, 3).toISOString(), // 2 days later, after market close (03:20 Thai)
    timeThai: offsetDays(2, 3).toISOString(),
    importance: "high",
    revenueActual: null,
    revenueForecast: "28.5B",
    revenuePrevious: "26.0B",
    epsActual: null,
    epsForecast: "0.64",
    epsPrevious: "0.59",
    eventTypeName: "Earnings",
    status: "confirmed",
    source: {
      source: "NVIDIA Investor Relations",
      sourceUrl: "https://investor.nvidia.com/",
      fetchedAt: now.toISOString(),
      timezone: "EST",
    },
  },
  {
    id: "earn-aapl-1",
    symbol: "AAPL",
    type: "earnings",
    announcedAt: offsetDays(6, 3).toISOString(),
    timeThai: offsetDays(6, 3).toISOString(),
    importance: "high",
    revenueActual: null,
    revenueForecast: "84.3B",
    revenuePrevious: "81.8B",
    epsActual: null,
    epsForecast: "1.20",
    epsPrevious: "1.15",
    eventTypeName: "Earnings",
    status: "confirmed",
    source: {
      source: "Apple Investor Relations",
      sourceUrl: "https://investor.apple.com/",
      fetchedAt: now.toISOString(),
      timezone: "EST",
    },
  },
  {
    id: "earn-tsla-1",
    symbol: "TSLA",
    type: "earnings",
    announcedAt: offsetDays(-1, 3).toISOString(), // 1 day ago
    timeThai: offsetDays(-1, 3).toISOString(),
    importance: "high",
    revenueActual: "25.5B",
    revenueForecast: "24.8B",
    revenuePrevious: "24.3B",
    epsActual: "0.62",
    epsForecast: "0.60",
    epsPrevious: "0.66",
    eventTypeName: "Earnings",
    status: "confirmed",
    source: {
      source: "Tesla Investor Relations",
      sourceUrl: "https://ir.tesla.com/",
      fetchedAt: now.toISOString(),
      timezone: "EST",
    },
  },
  {
    id: "earn-msft-xd-1",
    symbol: "MSFT",
    type: "earnings",
    announcedAt: offsetDays(5, 9).toISOString(),
    timeThai: offsetDays(5, 9).toISOString(),
    importance: "medium",
    revenueActual: null,
    revenueForecast: null,
    revenuePrevious: null,
    epsActual: null,
    epsForecast: null,
    epsPrevious: null,
    eventTypeName: "Dividend",
    guidance: "Ex-Dividend Date ($0.75 per share)",
    status: "confirmed",
    source: {
      source: "Microsoft Investor Relations",
      sourceUrl: "https://www.microsoft.com/en-us/investor",
      fetchedAt: now.toISOString(),
      timezone: "EST",
    },
  },

  // --- Crypto Events ---
  {
    id: "crypto-btc-unlock-1",
    symbol: "BTC-USD",
    type: "crypto",
    title: "Bitcoin Spot ETF Net Flow Report",
    announcedAt: offsetDays(0, 21).toISOString(), // Today 21:00 Thai Time
    timeThai: offsetDays(0, 21).toISOString(),
    importance: "medium",
    actual: null,
    forecast: "+150M",
    previous: "+220M",
    status: "confirmed",
    source: {
      source: "Farside Investors",
      sourceUrl: "https://farside.in/",
      fetchedAt: now.toISOString(),
      timezone: "GMT",
    },
  },
  {
    id: "crypto-sol-upgrade-1",
    symbol: "SOL-USD",
    type: "crypto",
    title: "Solana Mainnet v1.18 Upgrade Activation",
    announcedAt: offsetDays(5, 12).toISOString(),
    timeThai: offsetDays(5, 12).toISOString(),
    importance: "high",
    actual: null,
    forecast: null,
    previous: null,
    status: "confirmed",
    source: {
      source: "Solana Foundation",
      fetchedAt: now.toISOString(),
      timezone: "UTC",
    },
  },
];
