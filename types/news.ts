export interface NewsArticle {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: "positive" | "negative" | "neutral" | "uncertain";
  impact: "short-term" | "long-term" | "catalyst" | "noise";
  isPriceIn: boolean | "maybe";
}
