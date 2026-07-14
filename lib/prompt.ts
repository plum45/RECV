import { TickerData, IndicatorData, SupportResistanceData } from "../types/market";
import { NewsArticle } from "../types/news";
import { SentimentData } from "../types/analysis";
import { PriceProjectionData } from "../types/projection";

interface PromptBuilderPayload {
  symbol: string;
  timeframe: string;
  tradingStyle: string;
  marketData: TickerData;
  indicators: IndicatorData;
  supportResistance: SupportResistanceData;
  news: NewsArticle[];
  sentiment: SentimentData;
  priceProjection?: PriceProjectionData;
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

  const projectionString = payload.priceProjection
    ? `- Upside Target Zone: ${payload.priceProjection.upsideScenario.targetZone.formatted} (Reasons: ${payload.priceProjection.upsideScenario.targetZone.reason})
- Base Range: ${payload.priceProjection.baseScenario.targetZone.formatted} (Reasons: ${payload.priceProjection.baseScenario.targetZone.reason})
- Downside Target Zone: ${payload.priceProjection.downsideScenario.targetZone.formatted} (Reasons: ${payload.priceProjection.downsideScenario.targetZone.reason})
- Time Horizon: ${payload.priceProjection.timeHorizon}
- Confidence: ${payload.priceProjection.confidence} (${payload.priceProjection.confidenceReasons[0] || ""})
- Event Risk: ${payload.priceProjection.eventRisk.level} (${payload.priceProjection.eventRisk.warningMessage || "Low"})`
    : "คำนวณจาก Confluence S/R & Pivot";

  const styleName = tradingStyle === "day" ? "Day Trade" : tradingStyle === "position" ? "Position Trade" : "Swing Trade";
  const styleDescription = 
    tradingStyle === "day" ? "Day Trade (สไตล์เก็งกำไรระยะสั้น: ระยะถือครอง นาทีถึงภายในวัน, ไทม์เฟรมแนะนำ: 5m, 15m, 1H. เน้นวิเคราะห์ RSI, MACD, Volume และแนวรับ/แนวต้านระยะสั้น, กำหนดจุด Stop Loss แคบเพื่อรักษาเงินทุน)" :
    tradingStyle === "position" ? "Position Trade (สไตล์เก็งกำไรระยะยาว: ระยะถือครอง หลายสัปดาห์ถึงหลายเดือน, ไทม์เฟรมแนะนำ: 1D และ 1W. เน้นวิเคราะห์ EMA 50/200, โครงสร้าง Trend ภาพใหญ่ระยะยาว, ระดับ Fibonacci และแนวรับ/แนวต้านระยะยาวเป็นหลัก โดยไม่ให้น้ำหนักกับสัญญาณ RSI ความผันผวนย่อยระยะสั้น, กำหนด Stop Loss และ Take Profit กว้างเพื่อถือทนความผันผวน)" :
    "Swing Trade (สไตล์เก็งกำไรรอบกลาง: ระยะถือครอง หลายวันถึงหลายสัปดาห์ เช่น 3–20 วัน, ไทม์เฟรมแนะนำ: 4H, 1D. เน้นวิเคราะห์ EMA 20/50, โครงสร้างตลาด Market Structure, RSI, MACD และแนวรับ/แนวต้านที่สดใหม่, ใช้ ATR ในการกำหนด Stop Loss ระยะปลอดภัย)";

  return `คุณคือ Senior AI Trading Analyst และ System Designer หน้าที่ของคุณคือสร้างรายงานการวิเคราะห์ทางเทคนิค แผนการเทรด และการบริหารความเสี่ยงอย่างละเอียดสำหรับสินทรัพย์ ${symbol} ในไทม์เฟรม ${timeframe} อ้างอิงสไตล์การเทรดแบบ **${styleName}**

รายละเอียดคำจำกัดความสไตล์การเทรดที่ผู้ใช้เลือก:
${styleDescription}

⚠️ **ข้อกำหนดทางเทคนิคที่ห้ามละเลยเด็ดขาด (CRITICAL RULES):**
1. สถานะ **"Long Setup"** ในที่นี้หมายถึง **มุมมองคาดการณ์ว่าราคาจะปรับตัวสูงขึ้น (Bullish Outlook)** ไม่เกี่ยวกับระยะเวลาหรือระยะการถือครองสินทรัพย์จริงแต่อย่างใด โปรดอธิบายให้ชัดเจนในรายงาน
2. ปรับระยะของ Entry, Stop Loss, Take Profit และสัดส่วน Risk/Reward (R:R) ให้สอดรับกับสไตล์การเทรดที่ระบุข้างต้น
3. **หากข้อมูลไม่เพียงพอ หรือมีความผันผวนเกินกว่าที่สไตล์การเทรดนี้จะรับได้:** คุณต้องพิมพ์แสดงคำเตือน (Warning Alert) อย่างชัดเจนไว้ในรายงาน และห้ามสร้างสัญญาณเข้าทำรายการเทรดที่มีระดับความมั่นใจสูงเกินจริง (Overconfident signals) เพื่อป้องกันความปลอดภัยในพอร์ตผู้ใช้

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

## 8. Price Projection Matrix & 3-Scenario Analysis (คาดการณ์โซนราคา)
* Current Price: [ราคาปัจจุบัน]
* Upside Target Zone: [โซนเป้าหมายกรณีขาขึ้น เช่น $155–$160]
* Base Range: [กรอบราคาพักตัวสะสมพลัง เช่น $145–$152]
* Downside Target Zone: [โซนเป้าหมายกรณีขาลง เช่น $138–$142]
* Time Horizon: [1-3 วัน หรือตาม Timeframe]
* Confidence: [High / Moderate / Low / Conflicting - ห้ามเรียกเป็นโอกาสชนะ หรือ % Win rate]
* Confirmation Conditions: [เงื่อนไขรอยืนยันในภาพรวม]
* Invalidation Conditions: [เงื่อนไขยกเลิกภาพรวมเมื่อหลุดกรอบ]
* News/Event Risk: [High Risk / Low Risk ตามปฏิทินข่าวสาร]

### 🗺️ Scenario Comparison Table
| สถานการณ์ (Scenario) | โซนเป้าหมาย (Target Zone) | เงื่อนไขยืนยัน (Confirmations) | แนวเป้าหมายถัดไป | จุดยกเลิก (Invalidation Level) |
| :--- | :--- | :--- | :--- | :--- |
| 🚀 Bullish Scenario | [นำค่า Upside Target Zone จากข้อ 4 มาแสดง] | [ระบุเงื่อนไขยืนยันที่ผ่าน] | [แนวต้านถัดไป] | [จุดยกเลิกเมื่อหลุดรับ] |
| ⚖️ Base Scenario | [นำค่า Base Range จากข้อ 4 มาแสดง] | [สภาวะ Sideways/พักตัว] | [SMA/Pivot กลาง] | [Breakout บน/ล่าง] |
| 🔻 Bearish Scenario | [นำค่า Downside Target Zone จากข้อ 4 มาแสดง] | [ระบุเงื่อนไขยืนยันที่ผ่าน] | [แนวรับถัดไป] | [จุดยกเลิกเมื่อทะลุต้าน] |

### Bullish Scenario Details
* เหตุผลสนับสนุน: [อธิบายตามสูตรและ Price Action]
* เงื่อนไขยืนยัน: [รายละเอียดเงื่อนไขทางเทคนิค]
* Invalidation: [ระดับราคาและเงื่อนไขที่ทำให้กรณีขาขึ้นเป็นโมฆะ]

### Base Scenario Details
* กรอบการสะสมพลัง: [ช่วงราคา Base Range]
* เงื่อนไขเปลี่ยนสถานะ (Shift Triggers): [เงื่อนไขที่ราคาจะเลือกทางไป Bullish หรือ Bearish]

### Bearish Scenario Details
* เหตุผลกดดัน: [อธิบายตามสูตรและ Price Action]
* เงื่อนไขยืนยัน: [รายละเอียดเงื่อนไขทางเทคนิค]
* Invalidation: [ระดับราคาและเงื่อนไขที่ทำให้กรณีขาลงเป็นโมฆะ]

## 9. Long Setup (Wait-for-Confirmation Model)
* Entry Type: [เลือกระหว่าง Limit Entry / Breakout Entry / Retest Entry / Market Entry]
* Entry Zone: [$X - $Y ระบุเป็นโซนราคาระดับความสอดคล้องสูง ห้ามใช้แนวรับแนวต้านเดี่ยวๆ เป็นจุดเข้าทันที]
* Stop Loss: [ราคาตัดขาดทุน]
* Take Profit 1: [ค่า] | Take Profit 2: [ค่า] | Take Profit 3: [ค่า]
* Risk/Reward: [อัตราส่วนต้อง >= 1:1.5 หากต่ำกว่าต้องเตือนว่า Invalid]
* 9-Point Confirmation Checklist:
  - [ ] ราคาเข้าทดสอบโซนรับหรือโซน Confluence ($X-$Y)
  - [ ] แท่งเทียนเกิดรูปแบบ Bullish Reversal บน Timeframe ที่เลือก
  - [ ] RSI Momentum (> 45 หรือเกิด Divergence)
  - [ ] MACD Histogram > 0 หรือเกิด Bullish Crossover
  - [ ] Volume Ratio > 1.0 หรือ OBV สะสมเพิ่มขึ้น
  - [ ] ราคายืนเหนือ EMA 20 / EMA 50
  - [ ] โครงสร้างราคา Market Structure เป็น Uptrend (HH/HL)
  - [ ] เกิด Bullish Break of Structure (BOS)
  - [ ] ราคาเคลื่อนไหวอยู่เหนือ VWAP
* แผนนี้ใช้ไม่ได้ถ้า (Invalidation): [เงื่อนไขยกเลิกสถานะ Long เช่น ปิด 4H ต่ำกว่า Stop Loss ด้วย Volume สูง]

## 10. Short Setup (Wait-for-Confirmation Model)
* Entry Type: [เลือกระหว่าง Limit Entry / Breakout Entry / Retest Entry / Market Entry]
* Entry Zone: [$X - $Y ระบุเป็นโซนราคาระดับความสอดคล้องสูง ห้ามใช้แนวต้านเดี่ยวๆ เป็นจุดเข้าทันที]
* Stop Loss: [ราคาตัดขาดทุน]
* Take Profit 1: [ค่า] | Take Profit 2: [ค่า] | Take Profit 3: [ค่า]
* Risk/Reward: [อัตราส่วนต้อง >= 1:1.5 หากต่ำกว่าต้องเตือนว่า Invalid]
* 9-Point Confirmation Checklist:
  - [ ] ราคาเข้าทดสอบโซนต้านหรือโซน Confluence ($X-$Y)
  - [ ] แท่งเทียนเกิดรูปแบบ Bearish Reversal บน Timeframe ที่เลือก
  - [ ] RSI Momentum (< 55 หรือเกิด Divergence)
  - [ ] MACD Histogram < 0 หรือเกิด Bearish Crossover
  - [ ] Volume Ratio > 1.0 หรือ OBV ขายกดทับ
  - [ ] ราคาอยู่ใต้ EMA 20 / EMA 50
  - [ ] โครงสร้างราคา Market Structure เป็น Downtrend (LH/LL)
  - [ ] เกิด Bearish Break of Structure (BOS)
  - [ ] ราคาเคลื่อนไหวอยู่ใต้ VWAP
* แผนนี้ใช้ไม่ได้ถ้า (Invalidation): [เงื่อนไขยกเลิกสถานะ Short เช่น ปิด 4H เหนือ Stop Loss ด้วย Volume สูง]

## 11. Risk Management & Position Setup
* ความเสี่ยงต่อไม้: [แนะนำเปอร์เซ็นต์ความเสี่ยงที่เหมาะสม เช่น 1%]
* การบริหารช่วงข่าว High Impact: [หากมีรายงาน Earnings หรือ FOMC ใน 24 ชม. ห้ามเข้า Market Entry เด็ดขาด ให้รอยืนยันหลังข่าว]
* การประเมิน Gap Risk: [หาก Pre-market Gap > 2% ให้ระมัดระวัง Slippage และชะลอการเข้าซื้อ]
* คำแนะนำเรื่อง Position Sizing: [อธิบายการคำนวณจำนวนยูนิตให้ความเสี่ยงสุทธิไม่เกินเกณฑ์]

## 12. Rocket Score Breakdown (7-Dimension Scoring)
ให้คะแนนจากสภาวะตลาดปัจจุบัน 7 มิติ (ประเมินความสอดคล้องระบบ ไม่ใช่อัตรา Win Rate):
* 1. Trend Direction & Bias: __/15
* 2. Momentum (RSI & MACD): __/10
* 3. Market Structure Alignment: __/10
* 4. Volume & OBV Flow: __/10
* 5. Support & Resistance Confluence: __/10
* 6. News & Macro Safety: __/10
* 7. Data Quality & Freshness: __/10

รวมคะแนนความสอดคล้องระบบ: __/75 (ระดับ: High Confluence / Moderate / Low Confluence)

## 13. สรุปแบบภาษาคนทั่วไป
[คำอธิบายภาษาเรียบง่าย สรุปชัดเจนว่าฝั่งไหนได้เปรียบ ควรรอจังหวะใด ราคาจุดวัดใจคือจุดใด และปัจจัยหลักที่ต้องเฝ้าระวังสูงสุดคืออะไร]

## 14. คำเตือน
> [!CAUTION]
> **นี่ไม่ใช่คำแนะนำทางการเงิน การเทรดมีความเสี่ยงสูง ผู้ใช้ควรตัดสินใจด้วยตนเอง ใช้ Stop Loss เสมอ และไม่ควรเสี่ยงเงินทุนเกินกว่าที่รับไหว**
`;
}
