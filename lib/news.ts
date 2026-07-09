import axios from "axios";
import { NewsArticle } from "../types/news";

// Helper to determine sentiment based on keywords in title
function tagSentimentAndImpact(title: string): {
  sentiment: "positive" | "negative" | "neutral" | "uncertain";
  impact: "short-term" | "long-term" | "catalyst" | "noise";
  isPriceIn: boolean | "maybe";
} {
  const text = title.toLowerCase();

  const positiveWords = [
    "bullish", "soar", "gain", "rise", "surge", "approve", "green", "breakout",
    "rally", "growth", "upgrade", "buy", "accumulate", "inflow", "ath", "high",
    "support", "adoption", "launch", "partnership", "invest"
  ];

  const negativeWords = [
    "bearish", "crash", "fall", "drop", "plunge", "decline", "hack", "ban",
    "reject", "red", "selloff", "dump", "fud", "scam", "lawsuit", "sec",
    "regulate", "liquidation", "outflow", "restrict", "warn"
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

  // Determine impact and if it's priced in
  let impact: "short-term" | "long-term" | "catalyst" | "noise" = "noise";
  let isPriceIn: boolean | "maybe" = "maybe";

  if (text.includes("sec") || text.includes("ban") || text.includes("regulation") || text.includes("fed") || text.includes("rate")) {
    impact = "long-term";
    isPriceIn = false;
  } else if (text.includes("breakout") || text.includes("rally") || text.includes("plunge") || text.includes("liquidation")) {
    impact = "short-term";
    isPriceIn = true;
  } else if (text.includes("partnership") || text.includes("launch") || text.includes("upgrade")) {
    impact = "catalyst";
    isPriceIn = "maybe";
  }

  return { sentiment, impact, isPriceIn };
}

// Parse Google News RSS XML with Regex
function parseGoogleNewsRss(xmlText: string): NewsArticle[] {
  const articles: NewsArticle[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null && articles.length < 5) {
    const itemContent = match[1];

    const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
    const dateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const sourceMatch = itemContent.match(/<source[^>]*>([\s\S]*?)<\/source>/);

    const fullTitle = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "News Article";
    const url = linkMatch ? linkMatch[1].trim() : "#";
    const publishedAt = dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString();
    
    // Clean source name
    let source = sourceMatch ? sourceMatch[1].trim() : "Crypto News";
    
    // Sometimes title contains " - Source Name" at the end, let's extract that if source is missing
    let cleanTitle = fullTitle;
    if (fullTitle.includes(" - ")) {
      const parts = fullTitle.split(" - ");
      source = parts.pop() || source;
      cleanTitle = parts.join(" - ");
    }

    const { sentiment, impact, isPriceIn } = tagSentimentAndImpact(cleanTitle);

    articles.push({
      title: cleanTitle,
      source,
      url,
      publishedAt,
      sentiment,
      impact,
      isPriceIn,
    });
  }

  return articles;
}

export async function fetchNews(symbol: string): Promise<NewsArticle[]> {
  const query = symbol.toUpperCase().replace("USDT", "");
  const apiKey = process.env.NEWS_API_KEY;

  // 1. Try NewsAPI if API key is provided
  if (apiKey && apiKey !== "your_news_api_key_optional") {
    try {
      const url = `https://newsapi.org/v2/everything?q=${query}+crypto&sortBy=publishedAt&pageSize=5&apiKey=${apiKey}`;
      const response = await axios.get<any>(url);

      if (response.data && response.data.articles) {
        return response.data.articles.map((art: any) => {
          const title = art.title || "No Title";
          const { sentiment, impact, isPriceIn } = tagSentimentAndImpact(title);
          return {
            title,
            source: art.source?.name || "NewsAPI",
            url: art.url || "#",
            publishedAt: art.publishedAt || new Date().toISOString(),
            sentiment,
            impact,
            isPriceIn,
          };
        });
      }
    } catch (error: any) {
      console.warn("Failed to fetch from NewsAPI, falling back to Google News RSS:", error.message);
    }
  }

  // 2. Fallback to Google News RSS
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${query}+crypto&hl=en-US&gl=US&ceid=US:en`;
    const response = await axios.get<string>(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    const parsedArticles = parseGoogleNewsRss(response.data);
    if (parsedArticles.length > 0) {
      return parsedArticles;
    }
  } catch (error: any) {
    console.error("Failed to fetch Google News RSS:", error.message);
  }

  // 3. Ultimate Fallback with high-quality mock data related to the asset
  return getMockNews(symbol);
}

function getMockNews(symbol: string): NewsArticle[] {
  const asset = symbol.toUpperCase().replace("USDT", "");
  const now = new Date();
  
  return [
    {
      title: `${asset} Market Analysis: Consolidation Pattern Forms Near Major Support Zone`,
      source: "Rocket Market Insights",
      url: "#",
      publishedAt: new Date(now.getTime() - 1000 * 60 * 45).toISOString(), // 45m ago
      sentiment: "neutral",
      impact: "short-term",
      isPriceIn: true,
    },
    {
      title: `Institutional Interest in ${asset} Grows as Accumulation Addresses Reach New Highs`,
      source: "Chain Analytics",
      url: "#",
      publishedAt: new Date(now.getTime() - 1000 * 60 * 120).toISOString(), // 2h ago
      sentiment: "positive",
      impact: "long-term",
      isPriceIn: false,
    },
    {
      title: `Macroeconomic Warnings: Federal Reserve Comments Create Volatility in High-Risk Assets like ${asset}`,
      source: "Macro Finance",
      url: "#",
      publishedAt: new Date(now.getTime() - 1000 * 60 * 240).toISOString(), // 4h ago
      sentiment: "negative",
      impact: "long-term",
      isPriceIn: "maybe",
    }
  ];
}
