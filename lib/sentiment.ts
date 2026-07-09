import axios from "axios";
import { SentimentData } from "../types/analysis";
import { getFundingRate, getOpenInterest } from "./binance";

export async function fetchSentiment(symbol: string): Promise<SentimentData> {
  const cleanSymbol = symbol.toUpperCase();

  // 1. Fetch Fear & Greed Index (global crypto metric)
  let fearAndGreed = { value: 50, label: "Neutral" };
  try {
    const fngUrl = "https://api.alternative.me/fng/?limit=1";
    const fngRes = await axios.get<any>(fngUrl);
    if (fngRes.data && fngRes.data.data && fngRes.data.data[0]) {
      const val = parseInt(fngRes.data.data[0].value);
      const classification = fngRes.data.data[0].value_classification;
      fearAndGreed = { value: val, label: classification };
    }
  } catch (error: any) {
    console.warn("Failed to fetch Fear & Greed index:", error.message);
  }

  // 2. Fetch Futures Funding Rate from Binance
  let fundingRate: number | null = null;
  try {
    fundingRate = await getFundingRate(cleanSymbol);
  } catch (error: any) {
    console.warn("Failed to fetch funding rate:", error.message);
  }

  // 3. Fetch Futures Open Interest from Binance
  let openInterest: number | null = null;
  try {
    openInterest = await getOpenInterest(cleanSymbol);
  } catch (error: any) {
    console.warn("Failed to fetch open interest:", error.message);
  }

  // 4. Fetch Global Long/Short Ratio from Binance Futures API
  let longShortRatio: number | null = null;
  try {
    const lsUrl = `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${cleanSymbol}&period=1h&limit=1`;
    const lsRes = await axios.get<any[]>(lsUrl);
    if (lsRes.data && lsRes.data[0] && lsRes.data[0].longShortRatio) {
      longShortRatio = parseFloat(lsRes.data[0].longShortRatio);
    }
  } catch (error: any) {
    console.warn("Failed to fetch Long/Short ratio from Binance Futures:", error.message);
  }

  // 5. Aggregate and evaluate overall Sentiment
  const reasons: string[] = [];
  let score = 50; // Neutral starting score out of 100

  // Fear & Greed score weight
  score += (fearAndGreed.value - 50) * 0.4;
  reasons.push(`ดัชนี Fear & Greed อยู่ที่ ${fearAndGreed.value} (${fearAndGreed.label})`);

  // Long/Short ratio weight
  if (longShortRatio !== null) {
    reasons.push(`อัตราส่วน Long/Short Ratio อยู่ที่ ${longShortRatio.toFixed(2)}`);
    if (longShortRatio > 1.5) {
      score += 15;
      reasons.push("ผู้บัญชีฝั่ง Long มีจำนวนมากกว่าอย่างเห็นได้ชัด (ระดับบูลลิชในตลาดฟิวเจอร์ส)");
    } else if (longShortRatio < 0.8) {
      score -= 15;
      reasons.push("ผู้บัญชีฝั่ง Short มีจำนวนมากกว่าอย่างเห็นได้ชัด (ระดับแบร์ริชในตลาดฟิวเจอร์ส)");
    } else {
      reasons.push("สัดส่วน Long/Short อยู่ในเกณฑ์ปกติ ใกล้เคียงกัน");
    }
  }

  // Funding rate weight
  if (fundingRate !== null) {
    const fundingRatePct = fundingRate * 100;
    reasons.push(`อัตราค่าธรรมเนียม Funding Rate ล่าสุดเท่ากับ ${fundingRatePct.toFixed(4)}%`);
    if (fundingRatePct > 0.05) {
      score += 10;
      reasons.push("Funding rate ค่อนข้างสูง ฝั่ง Long จ่ายให้ฝั่ง Short แสดงถึงความต้องการเปิดสถานะ Long ด้วยเลバレッジสูง (ระวังการเกิด Long Squeeze)");
    } else if (fundingRatePct < 0) {
      score -= 10;
      reasons.push("Funding rate เป็นลบ ฝั่ง Short จ่ายให้ฝั่ง Long แสดงถึงความต้องการเปิดสถานะ Short ด้วยเลバレッジสูง (ระวังการเกิด Short Squeeze)");
    }
  }

  // Open Interest weight
  if (openInterest !== null) {
    reasons.push(`ระดับ Open Interest ของสัญญาฟิวเจอร์สคือ ${openInterest.toLocaleString()} สัญญา`);
  }

  // Determine label based on final score
  let overallSentiment: SentimentData["overallSentiment"] = "Neutral";
  if (score >= 75) overallSentiment = "Extreme Bullish";
  else if (score >= 60) overallSentiment = "Bullish";
  else if (score >= 40) overallSentiment = "Neutral";
  else if (score >= 25) overallSentiment = "Bearish";
  else overallSentiment = "Extreme Bearish";

  return {
    fearAndGreed,
    fundingRate,
    openInterest,
    longShortRatio,
    overallSentiment,
    reasons,
  };
}
