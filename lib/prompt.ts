import { TickerData, IndicatorData, SupportResistanceData } from "../types/market";
import { NewsArticle } from "../types/news";
import { SentimentData } from "../types/analysis";

interface PromptBuilderPayload {
  symbol: string;
  timeframe: string;
  tradingStyle: string;
  marketData: TickerData;
  indicators: IndicatorData;
  supportResistance: SupportResistanceData;
  news: NewsArticle[];
  sentiment: SentimentData;
}

export function buildAnalysisPrompt(payload: PromptBuilderPayload): string {
  const {
    symbol,
    timeframe,
    tradingStyle,
    marketData,
    indicators,
    supportResistance,
    news,
    sentiment,
  } = payload;

  const newsString = news.length > 0 
    ? news.map(n => `- Title: "${n.title}" | Source: ${n.source} | Sentiment: ${n.sentiment} | Impact: ${n.impact} | Priced In: ${n.isPriceIn}`).join("\n")
    : "ไม่มีข่าวล่าสุดที่ดึงข้อมูลได้";

  const sentimentReasons = sentiment.reasons.map(r => `- ${r}`).join("\n");

  const supportString = supportResistance.supportZones
    .map(z => `- Zone: ${z.zone} | Score: ${z.score}/10 | Reasons: ${z.reasons.join(", ")}`)
    .join("\n");

  const resistanceString = supportResistance.resistanceZones
    .map(z => `- Zone: ${z.zone} | Score: ${z.score}/10 | Reasons: ${z.reasons.join(", ")}`)
    .join("\n");

  return `คุณคือ Senior AI Trading Analyst และ System Designer หน้าที่ของคุณคือสร้างรายงานการวิเคราะห์ทางเทคนิค แผนการเทรด และการบริหารความเสี่ยงอย่างละเอียดสำหรับสินทรัพย์ ${symbol} ในไทม์เฟรม ${timeframe} สไตล์การเทรดแบบ ${tradingStyle}

นี่คือข้อมูลดิบของตลาดในปัจจุบัน:

[1. ข้อมูลราคา Ticker]
- ราคาปัจจุบัน: ${marketData.currentPrice}
- ราคา 24h สูงสุด: ${marketData.high24h}
- ราคา 24h ต่ำสุด: ${marketData.low24h}
- ปริมาณการซื้อขาย 24h: ${marketData.volume24h}
- อัตราการเปลี่ยนแปลง 24h: ${marketData.change24h}%

[2. ตัวชี้วัดทางเทคนิค (Technical Indicators)]
- EMA 20: ${indicators.ema20}
- EMA 50: ${indicators.ema50}
- EMA 200: ${indicators.ema200}
- RSI (14): ${indicators.rsi14}
- MACD Line: ${indicators.macd.macdLine} | Signal Line: ${indicators.macd.signalLine} | Histogram: ${indicators.macd.histogram}
- ATR (14): ${indicators.atr14}
- Pivot Point: P=${indicators.pivot.p}, S1=${indicators.pivot.s1}, S2=${indicators.pivot.s2}, S3=${indicators.pivot.s3}, R1=${indicators.pivot.r1}, R2=${indicators.pivot.r2}, R3=${indicators.pivot.r3}
- Volume Analysis: ปริมาณปัจจุบัน=${indicators.volumeAnalysis.currentVolume}, ค่าเฉลี่ย 20 แท่ง=${indicators.volumeAnalysis.avgVolume20}, อัตราส่วนปริมาณ=${indicators.volumeAnalysis.volumeRatio.toFixed(2)}x, สัญญาณ Volume Spike: ${indicators.volumeAnalysis.isVolumeSpike ? "ใช่" : "ไม่ใช่"}

[3. แนวรับ-แนวต้านหลักที่คำนวณแบบสถิติ (Clustered Zones)]
แนวรับ (Support Zones):
${supportString || "ไม่สามารถคำนวณแนวรับได้ชัดเจน"}

แนวต้าน (Resistance Zones):
${resistanceString || "ไม่สามารถคำนวณแนวต้านได้ชัดเจน"}

[4. ข้อมูลข่าวสารล่าสุด (Market News)]
${newsString}

[5. สภาพจิตวิทยาตลาดรวม (Market Sentiment)]
- ดัชนีหลัก: ${sentiment.overallSentiment}
- รายละเอียด:
${sentimentReasons}

---

ข้อกำหนดในการตอบกลับ:
1. ตอบกลับเป็นภาษาไทยเท่านั้น
2. ห้ามฟันธงทิศทางอย่างเด็ดขาด (ห้ามพูดว่า "ขึ้นแน่นอน" หรือ "ลงแน่นอน") ให้เขียนวิเคราะห์ในลักษณะความน่าจะเป็นโดยใช้ข้อมูลประกอบ
3. ห้ามบอกให้ All-in
4. ทุกแผนการเทรด (Long Setup และ Short Setup) ต้องระบุ Stop Loss และ Take Profit รวมถึงอัตรา Risk/Reward (R:R) เสมอ
5. ต้องระบุเงื่อนไข Invalidation (เงื่อนไขที่เมื่อราคาถึงจุดนี้ แผนเทรดจะเป็นโมฆะและต้องยอมแพ้) ของแต่ละกรณีอย่างชัดเจน
6. ใช้คำแนวทางเช่น "หากราคา...", "รอยืนยันสัญญาณ...", "มีโอกาสเคลื่อนตัวไปที่..." แทนคำสั่งตรง เช่น "ซื้อทันทีที่..."
7. ต้องใช้รูปแบบการจัดหน้า (Markdown Template) ตามโครงสร้างด้านล่างนี้เป๊ะๆ (ห้ามขาดหัวข้อใดหัวข้อหนึ่ง)

---
[เทมเพลตคำตอบที่ต้องใช้]

# Rocket AI Analysis: ${symbol}

## 1. ข้อมูลตลาดล่าสุด
* Symbol: ${symbol}
* Timeframe: ${timeframe}
* ราคาปัจจุบัน: ${marketData.currentPrice}
* แหล่งข้อมูล: Binance Spot API, Alternative.me
* อัปเดตล่าสุด: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
* 24h High: ${marketData.high24h}
* 24h Low: ${marketData.low24h}
* Volume: ${marketData.volume24h.toLocaleString()}

## 2. ภาพรวมตลาด
[วิเคราะห์สรุปแนวโน้มตลาดในปัจจุบันว่าเป็น Bullish / Bearish / Sideway / Mixed โดยอ้างอิงจากข้อมูล EMAs, RSI, MACD และ Sentiment]

## 3. Market Structure
* โครงสร้างราคา: [เช่น High High - Higher Low, Lower High - Lower Low หรือ ไซด์เวย์ในกรอบแคบ]
* จุดแข็ง: [วิเคราะห์แรงซื้อหรือตัวหนุนราคา]
* จุดอ่อน: [วิเคราะห์แรงขาย หรือสัญญาณการอ่อนแรงของแนวโน้ม]
* จุดเปลี่ยนแนวโน้ม: [ระดับราคาสำคัญที่จะชี้ว่าแนวโน้มปัจจุบันเสียโครงสร้าง]

## 4. แนวรับ–แนวต้านสำคัญ
| โซนราคา | ประเภท | คะแนน | เหตุผล |
| :--- | :--- | :--- | :--- |
[เขียนแนวรับและแนวต้านในตารางนี้จากข้อมูล Support Resistance ที่ให้ไป โดยระบุคะแนนและเหตุผล]

## 5. Indicator Summary
| Indicator | ค่า | ความหมาย |
| :--- | :--- | :--- |
| EMA20 | [ค่า] | [ความหมายและการทำหน้าที่] |
| EMA50 | [ค่า] | [ความหมายและการทำหน้าที่] |
| EMA200 | [ค่า] | [ความหมายและการทำหน้าที่] |
| RSI | [ค่า] | [สภาวะ Overbought/Oversold หรือโมเมนตัม] |
| MACD | [ค่า] | [สภาวะแนวโน้มและโมเมนตัม] |
| ATR | [ค่า] | [ความผันผวนของราคา] |
| Volume | [ค่า] | [การยืนยันแนวโน้ม หรือสัญญาณการกลับตัว] |

## 6. Pivot Point
* P: [ค่า]
* S1: [ค่า] | S2: [ค่า] | S3: [ค่า]
* R1: [ค่า] | R2: [ค่า] | R3: [ค่า]

## 7. News & Sentiment
* ข่าวล่าสุด: [สรุปประเด็นข่าวเด่น]
* ผลต่อราคา: [วิเคราะห์ทิศทางแรงขับเคลื่อนจากข่าวสาร]
* Sentiment รวม: [ดัชนีภาพรวมจิตวิทยาตลาดและความหมาย]
* สิ่งที่ต้องระวัง: [ปัจจัยภายนอก ข้อมูลทางสถิติ หรือข่าวที่จะประกาศเร็ว ๆ นี้]

## 8. Scenario Analysis

### Bullish Case
* เงื่อนไข: [เช่น ราคายืนเหนือ EMA50 หรือเบรคแนวต้าน]
* Target 1: [ค่า]
* Target 2: [ค่า]
* Target 3: [ค่า]
* Invalidation: [ระดับราคาที่ทำให้กรณีขาขึ้นเป็นโมฆะ]

### Bearish Case
* เงื่อนไข: [เช่น ราคาหลุด EMA20 หรือทะลุแนวรับสำคัญ]
* Target 1: [ค่า]
* Target 2: [ค่า]
* Target 3: [ค่า]
* Invalidation: [ระดับราคาที่ทำให้กรณีขาลงเป็นโมฆะ]

### Sideway Case
* กรอบบน: [ค่า]
* กรอบล่าง: [ค่า]
* กลยุทธ์: [คำแนะนำสำหรับการเทรดในกรอบ]
* จุดรอ Breakout: [ราคาที่ต้องยืนยันเพื่อหลุดกรอบสะสมพลัง]

## 9. Long Setup
* เงื่อนไขก่อนเข้า: [สัญญาณยืนยันการเปิดสถานะ]
* Entry Aggressive: [ราคาเข้าแบบเชิงรุก]
* Entry Conservative: [ราคาเข้าแบบเชิงรับ/รอบลูแบ็ค]
* Stop Loss: [ราคาตัดขาดทุน]
* TP1: [ค่า]
* TP2: [ค่า]
* TP3: [ค่า]
* Risk/Reward: [อัตราส่วน]
* แผนนี้ใช้ไม่ได้ถ้า: [เงื่อนไขยกเลิกสถานะ Long]

## 10. Short Setup
* เงื่อนไขก่อนเข้า: [สัญญาณยืนยันการเปิดสถานะ]
* Entry Aggressive: [ราคาเข้าแบบเชิงรุก]
* Entry Conservative: [ราคาเข้าแบบเชิงรับ/รอพูลแบ็ค]
* Stop Loss: [ราคาตัดขาดทุน]
* TP1: [ค่า]
* TP2: [ค่า]
* TP3: [ค่า]
* Risk/Reward: [อัตราส่วน]
* แผนนี้ใช้ไม่ได้ถ้า: [เงื่อนไขยกเลิกสถานะ Short]

## 11. Risk Management
* ความเสี่ยงต่อไม้: [แนะนำเปอร์เซ็นต์ความเสี่ยงที่เหมาะสม เช่น 1-2%]
* จุดที่ไม่ควรเข้า: [ระดับราคาที่ไม่คุ้มความเสี่ยง]
* สิ่งที่ต้องรอยืนยัน: [เช่น รอราคาปิดแท่ง หรือสัญญาณแท่งเทียนกลับตัว]
* ข่าวที่ต้องระวัง: [ระบุข่าวสำคัญ]
* คำแนะนำเรื่องขนาดไม้: [การคำนวณ Position Sizing และเลเวอเรจที่เหมาะสม]

## 12. Rocket Score
ให้คะแนนจากสภาวะตลาดปัจจุบันดังนี้ (สรุปคะแนนย่อยและคะแนนรวม):
* Trend: __/20
* Market Structure: __/15
* Support / Resistance: __/15
* Momentum: __/15
* Volume: __/10
* News: __/10
* Sentiment: __/5
* Risk/Reward: __/10

รวม: __/100

## 13. สรุปแบบภาษาคนทั่วไป
[คำอธิบายภาษาเรียบง่าย สรุปชัดเจนว่าฝั่งไหนได้เปรียบ ควรรอจังหวะใด ราคาจุดวัดใจคือจุดใด และปัจจัยหลักที่ต้องเฝ้าระวังสูงสุดคืออะไร]

## 14. คำเตือน
**นี่ไม่ใช่คำแนะนำทางการเงิน การเทรดมีความเสี่ยงสูง ผู้ใช้ควรตัดสินใจด้วยตนเอง ใช้ Stop Loss เสมอ และไม่ควรเสี่ยงเงินทุนเกินกว่าที่รับไหว**
`;
}
