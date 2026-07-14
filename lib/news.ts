import axios from "axios";
import { NewsArticle, SectorImpactCategory } from "../types/news";
import { normalizeSymbol, SYMBOL_ALIAS_MAP } from "./symbolMapping";

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

const COMPANY_SEARCH_NAMES: Record<string, string> = {
  ASML: "ASML Holding",
  TSM: "Taiwan Semiconductor TSMC",
  "005930": "Samsung Electronics",
  "000660": "SK Hynix",
  SAP: "SAP SE",
  SIE: "Siemens AG",
  NVDA: "NVIDIA",
  AMD: "Advanced Micro Devices",
  AVGO: "Broadcom",
};

function classifySectorImpact(
  title: string,
  symbol: string
): SectorImpactCategory {
  const t = title.toLowerCase();
  const s = normalizeSymbol(symbol);

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
    t.includes("chips act") ||
    t.includes("tariffs")
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
    t.includes("cowos") ||
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
  const fetchedAtIso = new Date().toISOString();

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
      fetchedAt: fetchedAtIso,
      sentiment,
      impact,
      isPriceIn,
      sectorImpact,
      status: "LIVE",
    });
  }

  return articles;
}

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
 * Build a search query:
 * - Stocks: search by symbol + company name (no crypto keywords)
 * - Crypto: append "crypto" only for crypto symbols
 */
function buildSearchQuery(symbol: string): string {
  const norm = normalizeSymbol(symbol);
  const alias = SYMBOL_ALIAS_MAP[symbol.toUpperCase()] || SYMBOL_ALIAS_MAP[norm] || norm;

  if (isCryptoSymbol(symbol) || isCryptoSymbol(norm)) {
    const clean = alias.replace(/USDT|USDC|-USD/g, "");
    return `${clean} crypto price news`;
  }

  if (isTechStock(norm)) {
    // International or US tech: query by ticker and company keyword
    const companyName = COMPANY_SEARCH_NAMES[norm] || alias;
    return `${companyName} ${norm} stock company news`;
  }

  return `${alias} stock market news`;
}

/**
 * Fetches Company News directly from Finnhub API if FINNHUB_API_KEY is available.
 */
async function fetchFinnhubCompanyNews(symbol: string, maxItems = 20): Promise<NewsArticle[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey || apiKey === "your_finnhub_api_key_optional" || apiKey.includes("your_")) {
    return [];
  }

  try {
    const normSym = normalizeSymbol(symbol);
    const now = new Date();
    const fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    const toDate = now.toISOString().substring(0, 10);

    const url = `https://finnhub.io/api/v1/company-news?symbol=${normSym}&from=${fromDate}&to=${toDate}&token=${apiKey}`;
    const response = await axios.get<any>(url, { timeout: 8000 });

    if (Array.isArray(response.data) && response.data.length > 0) {
      const fetchedAtIso = new Date().toISOString();
      return response.data.slice(0, maxItems).map((art: any) => {
        const title = art.headline || art.summary || "Company News";
        const publishedAt = art.datetime ? new Date(art.datetime * 1000).toISOString() : new Date().toISOString();
        const { sentiment, impact, isPriceIn, sectorImpact } = tagSentimentAndImpact(title, normSym);

        return {
          title,
          source: art.source || "Finnhub Company News",
          url: art.url || "#",
          publishedAt,
          fetchedAt: fetchedAtIso,
          sentiment,
          impact,
          isPriceIn,
          sectorImpact,
          status: "LIVE",
        };
      });
    }
  } catch (err: any) {
    console.warn("Finnhub Company News fetch failed:", err.message);
  }

  return [];
}

export async function fetchNews(symbol: string): Promise<NewsArticle[]> {
  const normalizedSymbol = normalizeSymbol(symbol);
  const fetchedAtIso = new Date().toISOString();
  const MAX_ARTICLES = 20;

  // 1. Try Finnhub Company News first (primary live source when API key exists)
  const finnhubArticles = await fetchFinnhubCompanyNews(normalizedSymbol, MAX_ARTICLES);
  if (finnhubArticles.length > 0) {
    return finnhubArticles;
  }

  // 2. Try NewsAPI if key provided
  const newsApiKey = process.env.NEWS_API_KEY;
  const searchQuery = buildSearchQuery(symbol);

  if (newsApiKey && newsApiKey !== "your_news_api_key_optional" && !newsApiKey.includes("your_")) {
    try {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(searchQuery)}&sortBy=publishedAt&pageSize=${MAX_ARTICLES}&language=en&apiKey=${newsApiKey}`;
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
              fetchedAt: fetchedAtIso,
              sentiment,
              impact,
              isPriceIn,
              sectorImpact,
              status: "LIVE",
            };
          });
      }
    } catch (error: any) {
      console.warn("NewsAPI failed, falling back to Google News RSS:", error.message);
    }
  }

  // 3. Fallback: Google News RSS
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

  // 4. Production behavior check: no mock news in production if all sources fail
  if (process.env.NODE_ENV === "production") {
    return [
      {
        title: `Live news temporarily unavailable for ${normalizedSymbol}.`,
        source: "System Notice",
        url: "#",
        publishedAt: fetchedAtIso,
        fetchedAt: fetchedAtIso,
        sentiment: "neutral",
        impact: "noise",
        isPriceIn: "maybe",
        sectorImpact: "Noise",
        status: "UNAVAILABLE",
      },
    ];
  }

  // 5. Non-production / Dev fallback: Mock News explicitly tagged with status: "FALLBACK"
  return getMockNews(normalizedSymbol);
}

function getMockNews(symbol: string): NewsArticle[] {
  const asset = normalizeSymbol(symbol);
  const now = new Date();
  const fetchedAtIso = now.toISOString();
  const isStock = isTechStock(asset);

  const mockArticles: NewsArticle[] = [
    {
      title: `${asset} ${isStock ? "Earnings Preview" : "Price Analysis"}: Analysts Eye Key ${isStock ? "Revenue" : "Resistance"} Levels`,
      source: "Rocket Market Insights",
      url: "#",
      publishedAt: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
      fetchedAt: fetchedAtIso,
      sentiment: "neutral",
      impact: "short-term",
      isPriceIn: "maybe",
      sectorImpact: "Direct",
      status: "FALLBACK",
    },
    {
      title: `${isStock ? "AI Chip Demand Surge Boosts" : "Institutional Accumulation in"} ${asset} ${isStock ? "Revenue Outlook" : "On-Chain Activity"}`,
      source: isStock ? "The Information" : "Chain Analytics",
      url: "#",
      publishedAt: new Date(now.getTime() - 1000 * 60 * 90).toISOString(),
      fetchedAt: fetchedAtIso,
      sentiment: "positive",
      impact: "long-term",
      isPriceIn: false,
      sectorImpact: isStock ? "Sector" : "Direct",
      status: "FALLBACK",
    },
    {
      title: `Federal Reserve Rate Outlook Creates Headwinds for ${isStock ? "High-Growth Tech" : "Risk Assets"} Including ${asset}`,
      source: "Macro Finance",
      url: "#",
      publishedAt: new Date(now.getTime() - 1000 * 60 * 150).toISOString(),
      fetchedAt: fetchedAtIso,
      sentiment: "negative",
      impact: "long-term",
      isPriceIn: "maybe",
      sectorImpact: "Macro",
      status: "FALLBACK",
    },
    {
      title: `${isStock ? "Semiconductor Supply Chain" : "Market"} Update: ${asset} ${isStock ? "Faces TSMC Capacity Allocation Questions" : "Liquidity Analysis"}`,
      source: isStock ? "DigiTimes" : "CryptoQuant",
      url: "#",
      publishedAt: new Date(now.getTime() - 1000 * 60 * 240).toISOString(),
      fetchedAt: fetchedAtIso,
      sentiment: "uncertain",
      impact: "short-term",
      isPriceIn: "maybe",
      sectorImpact: isStock ? "Supply Chain" : "Direct",
      status: "FALLBACK",
    },
    {
      title: `${isStock ? "US Export Controls on Advanced Chips" : "Regulatory Landscape"} Could Impact ${asset} ${isStock ? "International Revenue" : "Market"}`,
      source: isStock ? "Reuters Technology" : "Bloomberg Crypto",
      url: "#",
      publishedAt: new Date(now.getTime() - 1000 * 60 * 360).toISOString(),
      fetchedAt: fetchedAtIso,
      sentiment: "negative",
      impact: "long-term",
      isPriceIn: false,
      sectorImpact: isStock ? "Geopolitical" : "Macro",
      status: "FALLBACK",
    },
    {
      title: `${asset} ${isStock ? "Technical Breakout" : "Price"} Setup: Volume Analysis Suggests Momentum Building`,
      source: "Technical Edge",
      url: "#",
      publishedAt: new Date(now.getTime() - 1000 * 60 * 480).toISOString(),
      fetchedAt: fetchedAtIso,
      sentiment: "positive",
      impact: "short-term",
      isPriceIn: true,
      sectorImpact: "Direct",
      status: "FALLBACK",
    },
  ];

  return mockArticles;
}
