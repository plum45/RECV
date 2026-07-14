export type SectorImpactCategory =
  | "Direct"       // Direct company news
  | "Sector"       // Same sector (semiconductors, cloud, AI)
  | "Supply Chain" // Supply chain partner (TSMC, ASML, Samsung)
  | "Macro"        // Fed, CPI, GDP, interest rates
  | "Geopolitical" // Trade war, sanctions, export controls
  | "Noise";       // Not tech-relevant

export interface NewsArticle {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: "positive" | "negative" | "neutral" | "uncertain";
  impact: "short-term" | "long-term" | "catalyst" | "noise";
  isPriceIn: boolean | "maybe";
  /** Sector impact category for tech-focused filtering */
  sectorImpact?: SectorImpactCategory;
}
