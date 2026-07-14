import axios from "axios";
import { NewsArticle } from "../types/news";

// === Tech-Focused Symbol Registry ===
// US Tech stocks that must NOT have "crypto" appended to search queries
const US_TECH_SYMBOLS = new Set([
  "NVDA", "AMD", "INTC", "AVGO", "QCOM", "MSFT", "AAPL", "AMZN", "GOOGL",
  "META", "TSLA", "ORCL", "MU", "MRVL", "SMCI", "PLTR", "ARM", "CRWD",
  "SNOW", "TSM", "SMH", "SOXX", "QQQ", "NFLX", "CRM", "ADBE", "NOW",
  "PANW", "ZS", "DDOG", "NET", "SHOP", "UBER", "LYFT", "ABNB",
]);

// International tech symbols (EU/Asia tech with market impact)
const INTL_TECH_SYMBOLS = new Set([
  "ASML", "ASML.AS", "2330", "005930", "2454", "6758", "SAP", "SIE",
  "SAMSUNG", "HYNIX", "SKHYNIX", "MEDIATEK", "SONY",
]);

// Symbol aliases for search normalization
const SYMBOL_ALIAS_MAP: Record<string, string> = {
  "ASML.AS": "ASML",
  "2330.TW": "TSMC TSM",
  "2330": "TSMC TSM",
  "005930.KS": "Samsung Electronics",
  "005930": "Samsung Electronics",
  "000660.KS": "SK Hynix",
  "2454.TW": "MediaTek",
  "6758.T": "Sony",
  "SAP.DE": "SAP SE",
  "SIE.DE": "Siemens",
  "BTCUSDT": "BTC",
  "ETHUSDT": "ETH",
  "SOLUSDT": "SOL",
};

// Sector Impact Categories
type SectorImpactCategory =
  | "Direct"       // Direct company news
  | "Sector"       // Same sector (semiconductors, cloud, AI)
  | "Supply Chain" // Supply chain partner
  | "Macro"        // Fed, CPI, GDP, rates
  | "Geopolitical" // Trade war, sanctions, export controls
  | "Noise";       // Not tech-relevant

function classifySectorImpact(
  title: string,
  symbol: string
): SectorImpactCategory {
  const t = title.toLowerCase();
  const s = symbol.toUpperCase();

  // Direct company mention
  const company = (SYMBOL_ALIAS_MAP[s] || s).toLowerCase();
  if (t.includes(company) || t.includes(s.toLowerCase())) return "Direct";

  // Geopolitical / Trade
  if (
    t.includes("export control") ||
    t.includes("sanction") ||
    t.includes("trade war") ||
    t.includes("china ban") ||
    t.includes("taiwan strait") ||
    t.includes("chip act") ||
    t.includes("chips act")
  )
    return "Geopolitical";

  // Macro
  if (
    t.includes("fed ") ||
    t.includes("federal reserve") ||
    t.includes("interest rate") ||
    t.includes("cpi") ||
    t.includes("inflation") ||
    t.includes("gdp") ||
    t.includes("nonfarm") ||
    t.includes("yield curve") ||
    t.includes("recession")
  )
    return "Macro";

  // Sector – semiconductors, AI, cloud
  if (
    t.includes("semiconductor") ||
    t.includes("chip") ||
    t.includes("gpu") ||
    t.includes("ai ") ||
    t.includes("artificial intelligence") ||
    t.includes("data center") ||
    t.includes("cloud") ||
    t.includes("foundry") ||
    t.includes("wafer") ||
    t.includes("hbm") ||
    t.includes("memory") ||
    t.includes("dram") ||
    t.includes("nand")
  )
    return "Sector";

  // Supply Chain
  if (
    t.includes("supply chain") ||
    t.includes("tsmc") ||
    t.includes("asml") ||
    t.includes("samsung") ||
    t.includes("hynix") ||
    t.includes("mediatek") ||
    t.includes("foxconn") ||
    t.includes("packaging") ||
    t.includes("coWoS") ||
    t.includes("euv")
  )
    return "Supply Chain";

  return "Noise";
}

// Helper to determine sentiment based on keywords in title
function tagSentimentAndImpact(
  title: string,
  symbol: string
): {
  sentiment: "positive" | "negative" | "neutral" | "uncertain";
  impact: "short-term" | "long-term" | "catalyst" | "noise";
  isPriceIn: boolean | "maybe";
  sectorImpact: SectorImpactCategory;
} {
  const text = title.toLowerCase();

  const positiveWords = [
    "bullish", "soar", "gain", "rise", "surge", "approve", "green",
    "breakout", "rally", "growth", "upgrade", "buy", "accumulate", "inflow",
    "ath", "high", "support", "adoption", "launch", "partnership", "invest",
    "beat", "beats", "exceed", "record", "strong", "robust",
  ];

  const negativeWords = [
    "bearish", "crash", "fall", "drop", "plunge", "decline", "hack", "ban",
    "reject", "red", "selloff", "dump", "lawsuit", "sec", "regulate",
    "liquidation", "outflow", "restrict", "warn", "miss", "misses",
    "disappoint", "cut", "downgrade", "weak", "concern",
  ];

  let positiveCount = 0;
  let negativeCount = 0;

  positiveWords.forEach((word) => {
    if (text.includes(word)) positiveCount++;
  });

  negativeWords.forEach((word) => {
    if (text.includes(word)) negativeCount++;
  });

  let sentiment: "positive" | "negative" | "neutral" | "uncertain" = "neutral";
  if (positiveCount > negativeCount) sentiment = "positive";
  else if (negativeCount > positiveCount) sentiment = "negative";
  else if (positiveCount > 0 && negativeCount > 0) sentiment = "uncertain";

  let impact: "short-term" | "long-term" | "catalyst" | "noise" = "noise";
  let isPriceIn: boolean | "maybe" = "maybe";

  if (
    text.includes("sec") ||
    text.includes("ban") ||
    text.includes("regulation") ||
    text.includes("fed") ||
    text.includes("rate") ||
    text.includes("trade war") ||
    text.includes("sanction")
  ) {
    impact = "long-term";
    isPriceIn = false;
  } else if (
    text.includes("breakout") ||
    text.includes("rally") ||
    text.includes("plunge") ||
    text.includes("liquidation")
  ) {
    impact = "short-term";
    isPriceIn = true;
  } else if (
    text.includes("partnership") ||
    text.includes("launch") ||
    text.includes("upgrade") ||
    text.includes("earnings") ||
    text.includes("guidance")
  ) {
    impact = "catalyst";
    isPriceIn = "maybe";
  }

  const sectorImpact = classifySectorImpact(title, symbol);

  return { sentiment, impact, isPriceIn, sectorImpact };
}

// Parse Google News RSS XML – returns up to maxItems articles
function parseGoogleNewsRss(xmlText: string, symbol: string, maxItems = 20): NewsArticle[] {
  const articles: NewsArticle[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null && articles.length < maxItems) {
    const itemContent = match[1];

    const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
    const dateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const sourceMatch = itemContent.match(/<source[^>]*>([\s\S]*?)<\/source>/);

    const fullTitle = titleMatch
      ? titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim()
      : "News Article";
    const url = linkMatch ? linkMatch[1].trim() : "#";
    const publishedAt = dateMatch
      ? new Date(dateMatch[1]).toISOString()
      : new Date().toISOString();

    let source = sourceMatch ? sourceMatch[1].trim() : "Market News";

    let cleanTitle = fullTitle;
    if (fullTitle.includes(" - ")) {
      const parts = fullTitle.split(" - ");
      source = parts.pop() || source;
      cleanTitle = parts.join(" - ");
    }

    const { sentiment, impact, isPriceIn, sectorImpact } = tagSentimentAndImpact(
      cleanTitle,
      symbol
    );

    articles.push({
      title: cleanTitle,
      source,
      url,
      publishedAt,
      sentiment,
      impact,
      isPriceIn,
      sectorImpact,
    });
  }

  return articles;
}

/**
 * Determine whether a symbol is a US/international tech stock
 * so we can build the right search query (no "crypto" keyword).
 */
function isTechStock(symbol: string): boolean {
  const s = symbol.toUpperCase().replace(/\.(NYSE|NASDAQ|US|DE|AS|TW|KS|T)$/i, "");
  return US_TECH_SYMBOLS.has(s) || INTL_TECH_SYMBOLS.has(s);
}

function isCryptoSymbol(symbol: string): boolean {
  const s = symbol.toUpperCase();
  return (
    s.endsWith("USDT") ||
    s.endsWith("USDC") ||
    s.endsWith("-USD") ||
    ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX"].includes(s)
  );
}

/**
 * Build a tech-focused search query from a symbol.
 * - US tech stocks: query = "NVDA stock earnings"  (no "crypto")
 * - Crypto: query = "BTC crypto price"
 * - International: query = "ASML semiconductor"
 */
function buildSearchQuery(symbol: string): string {
  const s = symbol.toUpperCase();
  const alias = SYMBOL_ALIAS_MAP[s] || s;

  if (isCryptoSymbol(s)) {
    const clean = alias.replace(/USDT|USDC|-USD/g, "");
    return `${clean} crypto price`;
  }

  if (isTechStock(s)) {
    // International tech
    if (INTL_TECH_SYMBOLS.has(s) || s.includes(".")) {
      return `${alias} semiconductor technology stock`;
    }
    // US tech
    return `${alias} stock technology AI`;
  }

  // Generic fallback
  return `${alias} stock market`;
}

export async function fetchNews(symbol: string): Promise<NewsArticle[]> {
  const normalizedSymbol = symbol.toUpperCase().replace(/USDT|USDC/g, "");
  const apiKey = process.env.NEWS_API_KEY;
  const searchQuery = buildSearchQuery(symbol);
  const MAX_ARTICLES = 20;

  // 1. Try NewsAPI if API key provided
  if (apiKey && apiKey !== "your_news_api_key_optional") {
    try {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(searchQuery)}&sortBy=publishedAt&pageSize=${MAX_ARTICLES}&language=en&apiKey=${apiKey}`;
      const response = await axios.get<any>(url, { timeout: 8000 });

      if (response.data?.articles && response.data.articles.length > 0) {
        return response.data.articles
          .slice(0, MAX_ARTICLES)
          .map((art: any) => {
            const title = art.title || "No Title";
            const { sentiment, impact, isPriceIn, sectorImpact } =
              tagSentimentAndImpact(title, normalizedSymbol);
            return {
              title,
              source: art.source?.name || "NewsAPI",
              url: art.url || "#",
              publishedAt: art.publishedAt || new Date().toISOString(),
              sentiment,
              impact,
              isPriceIn,
              sectorImpact,
            };
          });
      }
    } catch (error: any) {
      console.warn(
        "NewsAPI failed, falling back to Google News RSS:",
        error.message
      );
    }
  }

  // 2. Fallback: Google News RSS (returns up to 20 items)
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery)}&hl=en-US&gl=US&ceid=US:en`;
    const response = await axios.get<string>(rssUrl, {
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const parsed = parseGoogleNewsRss(response.data, normalizedSymbol, MAX_ARTICLES);
    if (parsed.length > 0) {
      return parsed;
    }
  } catch (error: any) {
    console.error("Google News RSS failed:", error.message);
  }

  // 3. Ultimate fallback – high-quality mock news (no Thai stocks, no crypto mixing)
  return getMockNews(normalizedSymbol);
}

function getMockNews(symbol: string): NewsArticle[] {
  const asset = symbol.toUpperCase().replace(/USDT|USDC|-USD/g, "");
  const now = new Date();
  const isStock = isTechStock(asset);
  const isCrypto = isCryptoSymbol(asset);

  const mockArticles: NewsArticle[] = [
    {
      title: `${asset} ${isStock ? "Earnings Preview" : "Price Analysis"}: Analysts Eye Key ${isStock ? "Revenue" : "Resistance"} Levels`,
      source: "Rocket Market Insights",
      url: "#",
      publishedAt: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
      sentiment: "neutral",
      impact: "short-term",
      isPriceIn: "maybe",
      sectorImpact: "Direct",
    },
    {
      title: `${isStock ? "AI Chip Demand Surge Boosts" : "Institutional Accumulation in"} ${asset} ${isStock ? "Revenue Outlook" : "On-Chain Activity"}`,
      source: isStock ? "The Information" : "Chain Analytics",
      url: "#",
      publishedAt: new Date(now.getTime() - 1000 * 60 * 90).toISOString(),
      sentiment: "positive",
      impact: "long-term",
      isPriceIn: false,
      sectorImpact: isStock ? "Sector" : "Direct",
    },
    {
      title: `Federal Reserve Rate Outlook Creates Headwinds for ${isStock ? "High-Growth Tech" : "Risk Assets"} Including ${asset}`,
      source: "Macro Finance",
      url: "#",
      publishedAt: new Date(now.getTime() - 1000 * 60 * 150).toISOString(),
      sentiment: "negative",
      impact: "long-term",
      isPriceIn: "maybe",
      sectorImpact: "Macro",
    },
    {
      title: `${isStock ? "Semiconductor Supply Chain" : "Market"} Update: ${asset} ${isStock ? "Faces TSMC Capacity Allocation Questions" : "Liquidity Analysis"}`,
      source: isStock ? "DigiTimes" : "CryptoQuant",
      url: "#",
      publishedAt: new Date(now.getTime() - 1000 * 60 * 240).toISOString(),
      sentiment: "uncertain",
      impact: "short-term",
      isPriceIn: "maybe",
      sectorImpact: isStock ? "Supply Chain" : "Direct",
    },
    {
      title: `${isStock ? "US Export Controls on Advanced Chips" : "Regulatory Landscape"} Could Impact ${asset} ${isStock ? "International Revenue" : "Market"}`,
      source: isStock ? "Reuters Technology" : "Bloomberg Crypto",
      url: "#",
      publishedAt: new Date(now.getTime() - 1000 * 60 * 360).toISOString(),
      sentiment: "negative",
      impact: "long-term",
      isPriceIn: false,
      sectorImpact: isStock ? "Geopolitical" : "Macro",
    },
    {
      title: `${asset} ${isStock ? "Technical Breakout" : "Price"} Setup: Volume Analysis Suggests Momentum Building`,
      source: "Technical Edge",
      url: "#",
      publishedAt: new Date(now.getTime() - 1000 * 60 * 480).toISOString(),
      sentiment: "positive",
      impact: "short-term",
      isPriceIn: true,
      sectorImpact: "Direct",
    },
  ];

  return mockArticles;
}
