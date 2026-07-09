# Rocket AI Trading Assistant 🚀

เว็บแอปพลิเคชันส่วนตัวสำหรับการแสดงผลกราฟตลาดคริปโทเคอร์เรนซีแบบเรียลไทม์ คำนวณอินดิเคเตอร์ทางเทคนิค ค้นหาสัญญาณแนวรับ-แนวต้านเชิงสถิติ วิเคราะห์ Sentiment สรุปความข่าวสารล่าสุด และสังเคราะห์แผนการเทรด (Long/Short Trade Setup) ด้วยระบบปัญญาประดิษฐ์ (OpenAI GPT-4o-mini)

---

## 🌟 ฟีเจอร์หลัก (Features)

1. **Real-time Chart**: ฝังกราฟเทคนิคอลจาก TradingView Widget อัปเดตราคาล่าสุดแบบสดๆ พร้อมกรอบเวลา (Timeframes) ได้แก่ `5m`, `15m`, `1H`, `4H` และ `1D`
2. **Binance Live Data Integration**: ดึงข้อมูล OHLCV (200 แท่งล่าสุด) จาก Binance Spot API เพื่อใช้คำนวณและทำโมเดลราคา
3. **Quantitative Indicator Engine**:
   - เส้นค่าเฉลี่ยเคลื่อนที่แบบเอ็กซ์โพเนนเชียล (EMA 20, 50, 200)
   - ดัชนีกำลังสัมพัทธ์ (RSI 14) พร้อมแจ้งสถานะ Overbought/Oversold
   - ค้นหารอบโมเมนตัมแนวโน้มด้วย MACD (12, 26, 9)
   - คำนวณดัชนีความผันผวน ATR (14)
   - คำนวณ Pivot Point Daily (P, R1-R3, S1-S3)
   - วิเคราะห์พฤติกรรมปริมาณการซื้อขาย (Volume Spike detection)
4. **Statistical Support & Resistance Zones Engine**: ค้นหาโซนแนวรับและแนวต้านสำคัญจากการทำกลุ่มคลัสเตอร์ (Clustering) ของประวัติราคาย้อนหลัง 150 แท่งเทียน ร่วมกับจุดกลับตัว Swing High/Low ระดับ EMA และระดับราคาจิตวิทยา (เลขกลม) พร้อมแจกคะแนนความน่าเชื่อถือ 1-10
5. **Aggregated Sentiment Engine**:
   - สรุปดัชนี Fear & Greed Index จาก Alternative.me API
   - วิเคราะห์ Funding Rate จาก Binance Futures API
   - วิเคราะห์ยอดสัญญาสะสม (Open Interest) และสัดส่วนบัญชีผู้ใช้ Long/Short Ratio
   - สังเคราะห์สรุปความเห็นของตลาด (Bullish / Bearish / Neutral)
6. **Smart News Analyzer**: ดึงข่าวด่วนล่าสุด คัดแยกอารมณ์ข่าว (Positive/Negative/Neutral) พร้อมประเมินผลกระทบต่อราคา (ระยะสั้น/ระยะยาว) และวิเคราะห์ว่าข่าวนั้นซึมซับเข้าไปในตลาดแล้วหรือยัง (Price-in status)
7. **Bespoke AI Trading Report (Rocket AI)**: ส่งข้อมูลตลาดเชิงปริมาณทั้งหมดให้ปัญญาประดิษฐ์ประมวลผล สังเคราะห์แผนการเข้าทำกำไร Long/Short Setup ที่ต้องมีระดับ Entry, Stop Loss, Take Profit, อัตราส่วน Risk/Reward (R:R), เงื่อนไข Invalidation, และการคำนวณขนาดไม้ที่เหมาะสมเป็นภาษาไทย
8. **Rocket Score**: แสดงคะแนนความสอดคล้องเชิงบวกของการจัดตั้งการเทรด (0-100) ผ่านมาตรวัดรูปทรงกลมเรืองแสง

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4.0
- **Icon Library**: Lucide React
- **API Requests**: Axios
- **Indicator Calculations**: `technicalindicators`
- **AI Engine**: OpenAI Node SDK (GPT-4o-mini)

---

## 📦 การติดตั้งและการใช้งาน (Installation)

### 1. โคลนโปรเจกต์และเข้าสู่โฟลเดอร์
หลังจากที่นำโค้ดไปติดตั้ง ให้เข้าสู่ไดเรกทอรีโครงการ:
```bash
cd rocket-ai-web
```

### 2. ติดตั้ง Dependencies
```bash
npm install
```

### 3. ตั้งค่าสภาพแวดล้อม (Environment Variables)
คัดลอกไฟล์ `.env.local` หรือตั้งค่าข้อมูลด้านล่างนี้:
```bash
# สร้าง/แก้ไขไฟล์ .env.local ที่รูทโปรเจกต์
OPENAI_API_KEY=your_openai_api_key_here
NEWS_API_KEY=your_news_api_key_optional_here
```
*(หากไม่ใส่ `NEWS_API_KEY` ระบบจะเปลี่ยนไปใช้วิธีดึงข่าวฟรีจาก Google News RSS โดยอัตโนมัติ ทำให้ใช้งานได้ฟรีโดยไม่เกิดข้อผิดพลาด)*

### 4. รันโปรเจกต์ในโหมดพัฒนาการใช้งาน (Development Mode)
```bash
npm run dev
```
เปิดบราว์เซอร์ของคุณและไปที่ `http://localhost:3000`

---

## ⚠️ คำเตือนเรื่องความเสี่ยง (Risk Disclaimer)

โปรแกรม "Rocket AI Trading Assistant" เป็นเครื่องมือส่วนบุคคลที่ช่วยประมวลผลข้อมูลตลาดและวิเคราะห์ทางเทคนิคตามอัลกอริทึมเชิงปริมาณ ร่วมกับการใช้ความคิดเห็นเชิงสถิติผ่านแบบจำลองภาษาขนาดใหญ่ (LLM) 

- **ไม่ใช่คำแนะนำทางการลงทุน (Not Financial Advice)**: ทุกข้อมูล แผนเทรด และระดับราคาเข้า/ตัดขาดทุน ไม่จัดเป็นคำแนะนำหรือชี้ชวนในการทำธุรกรรมซื้อขายสินทรัพย์ทางการเงินจริง
- **การตัดสินใจลงทุน**: ผู้ใช้งานจำเป็นต้องใช้วิจารณญาณส่วนบุคคล วิเคราะห์ข้อมูลความเสี่ยงประกอบการตัดสินใจด้วยตนเอง และใช้ Stop Loss เสมอทุกครั้งที่มีการเปิดสถานะการเทรด
- **ความเสี่ยงการใช้งาน API Key**: โปรดเก็บรักษากุญแจเชื่อมต่อ `OPENAI_API_KEY` ไว้เป็นความลับบนฝั่งเซิร์ฟเวอร์เท่านั้น ห้ามเผยแพร่หรือนำไปเก็บไว้ในฝั่ง Client

---

## 🚀 แผนพัฒนาในอนาคต (Roadmap)
- **Phase 2**: ยกระดับระบบดึงข้อมูล Real-time Liquidation map และ Heatmap
- **Phase 3**: ระบบสมัครสมาชิก บันทึกประวัติและจดบันทึกบันทึกเทรด (Trade Journal)
- **Phase 4**: ระบบแจ้งเตือนแจ้งเข้าไลน์บอท หรือ Telegram (Telegram & Line Bot Alerts)
