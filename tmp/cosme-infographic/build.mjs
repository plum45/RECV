import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const W = 1280;
const H = 720;
const OUT = "C:/Users/lgopl/โฟลเดอร์ใหม่/rocket-ai-web/outputs/cosme-infographic-10-pages.pptx";
const PREVIEW = "C:/Users/lgopl/โฟลเดอร์ใหม่/rocket-ai-web/tmp/cosme-infographic/preview";
const ASSETS = "C:/Users/lgopl/โฟลเดอร์ใหม่/rocket-ai-web/tmp/cosme-infographic/assets";

const C = {
  cream: "#FBF7F0",
  paper: "#F2EBDD",
  navy: "#173B63",
  blue: "#2E75B6",
  sage: "#6F8F69",
  terracotta: "#C46B47",
  lavender: "#8B6BB1",
  mint: "#E8F2F0",
  paleBlue: "#E7F0F8",
  rose: "#F4E2DE",
  ink: "#1F2A37",
  muted: "#687585",
  white: "#FFFFFF",
  line: "#D9E0E6",
  danger: "#B74C4C",
};

const FONT = "Noto Sans Thai";

async function readImage(name) {
  const bytes = await fs.readFile(path.join(ASSETS, name));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function shape(slide, geometry, position, fill = "none", line = { style: "solid", fill: "none", width: 0 }, extra = {}) {
  return slide.shapes.add({ geometry, position, fill, line, ...extra });
}

function text(slide, value, position, style = {}) {
  const s = shape(slide, "textbox", position, "none");
  s.text = value;
  s.text.style = {
    fontFamily: FONT,
    color: C.ink,
    fontSize: 20,
    ...style,
  };
  return s;
}

function image(slide, blob, position, fit = "cover") {
  slide.images.add({ blob, contentType: "image/png", position, fit, alt: "ภาพประกอบอินโฟกราฟิก" });
}

function header(slide, kicker, title, page, accent = C.blue) {
  text(slide, kicker.toUpperCase(), { left: 72, top: 32, width: 380, height: 24 }, { fontSize: 13, bold: true, color: accent });
  text(slide, title, { left: 72, top: 66, width: 1030, height: 68 }, { fontSize: 36, bold: true, color: C.navy });
  shape(slide, "line", { left: 72, top: 146, width: 1136, height: 0 }, "none", { style: "solid", fill: accent, width: 3 });
  text(slide, String(page).padStart(2, "0"), { left: 1168, top: 30, width: 40, height: 26 }, { fontSize: 18, bold: true, color: accent, alignment: "right" });
}

function footer(slide, source = "สรุปจากเอกสารประกอบการเรียน chap 1-4 cosme") {
  text(slide, source, { left: 72, top: 682, width: 700, height: 20 }, { fontSize: 11, color: C.muted });
  text(slide, "COSME 101", { left: 1080, top: 682, width: 128, height: 20 }, { fontSize: 11, bold: true, color: C.muted, alignment: "right" });
}

function bulletList(slide, items, x, y, width, opts = {}) {
  const color = opts.color || C.ink;
  const bulletColor = opts.bulletColor || opts.accent || C.blue;
  const size = opts.size || 20;
  const gap = opts.gap || 50;
  items.forEach((item, i) => {
    const yy = y + i * gap;
    shape(slide, "ellipse", { left: x, top: yy + 8, width: 10, height: 10 }, bulletColor);
    text(slide, item, { left: x + 24, top: yy, width, height: gap - 2 }, { fontSize: size, color, bold: !!opts.bold });
  });
}

function label(slide, value, x, y, w, fill, color = C.navy) {
  const s = shape(slide, "roundRect", { left: x, top: y, width: w, height: 34 }, fill, { style: "solid", fill, width: 0 }, { borderRadius: "rounded-full" });
  s.text = value;
  s.text.style = { fontFamily: FONT, fontSize: 14, bold: true, color, alignment: "center" };
  return s;
}

function card(slide, x, y, w, h, fill = C.white, line = C.line) {
  return shape(slide, "roundRect", { left: x, top: y, width: w, height: h }, fill, { style: "solid", fill: line, width: 1 }, { borderRadius: "rounded-2xl", shadow: "shadow-sm" });
}

function numberCircle(slide, n, x, y, fill, color = C.white) {
  const s = shape(slide, "ellipse", { left: x, top: y, width: 42, height: 42 }, fill);
  s.text = String(n);
  s.text.style = { fontFamily: FONT, fontSize: 20, bold: true, color, alignment: "center" };
}

async function main() {
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.mkdir(PREVIEW, { recursive: true });
  const assets = {
    history: await readImage("history-cover.png"),
    label: await readImage("label-check.png"),
    safety: await readImage("safety-still-life.png"),
    skincare: await readImage("skincare-safety.png"),
  };

  const deck = Presentation.create({ slideSize: { width: W, height: H } });

  // 1. Cover
  {
    const s = deck.slides.add();
    s.background.fill = C.cream;
    image(s, assets.history, { left: 0, top: 0, width: W, height: H }, "cover");
    shape(s, "rect", { left: 0, top: 0, width: 650, height: H }, "#FBF7F0/92");
    label(s, "สรุปบทที่ 1-4", 72, 70, 150, C.navy, C.white);
    text(s, "เครื่องสำอาง\n101", { left: 72, top: 142, width: 540, height: 170 }, { fontSize: 58, bold: true, color: C.navy });
    text(s, "จากประวัติศาสตร์สู่การเลือกใช้อย่างปลอดภัย", { left: 76, top: 334, width: 490, height: 58 }, { fontSize: 24, color: C.terracotta, bold: true });
    text(s, "ทำความเข้าใจผลิตภัณฑ์ อ่านฉลากให้เป็น\nรู้จักเวชสำอาง และจับสัญญาณสารอันตราย", { left: 76, top: 420, width: 470, height: 82 }, { fontSize: 20, color: C.ink });
    label(s, "ประวัติ", 76, 575, 92, C.paper, C.terracotta);
    label(s, "ผลิตภัณฑ์", 178, 575, 112, C.paleBlue, C.blue);
    label(s, "เวชสำอาง", 300, 575, 112, C.mint, C.sage);
    label(s, "ความปลอดภัย", 422, 575, 136, C.rose, C.danger);
    footer(s, "สร้างจากเอกสารประกอบการเรียน chap 1-4 cosme");
  }

  // 2. History
  {
    const s = deck.slides.add();
    s.background.fill = C.cream;
    header(s, "บทที่ 1 / ที่มา", "ความงามเปลี่ยนไป แต่โจทย์เดิมยังอยู่", 2, C.terracotta);
    text(s, "ตั้งแต่อียิปต์โบราณ มนุษย์ใช้สีจากแร่ธาตุและพืช\nเพื่อดูแลรูปลักษณ์ สื่อสถานะ และประกอบพิธีกรรม", { left: 72, top: 176, width: 520, height: 84 }, { fontSize: 25, color: C.navy, bold: true });
    const steps = [
      ["อดีต", "หินแร่ สีดำจากโคลและคาร์บอน\nสีขาวจาก cerussite / สีเขียวจาก malachite", C.terracotta],
      ["พัฒนา", "สูตรและภาชนะซับซ้อนขึ้น\nเกิดผลิตภัณฑ์ทำความสะอาดและบำรุง", C.sage],
      ["ปัจจุบัน", "เครื่องสำอางตอบโจทย์ความสะอาด\nความสวยงาม และการดูแลผิวเฉพาะด้าน", C.blue],
    ];
    steps.forEach((it, i) => {
      const x = 72 + i * 206;
      card(s, x, 320, 182, 206, C.white, it[2]);
      numberCircle(s, i + 1, x + 18, 342, it[2]);
      text(s, it[0], { left: x + 18, top: 402, width: 145, height: 32 }, { fontSize: 24, bold: true, color: it[2] });
      text(s, it[1], { left: x + 18, top: 445, width: 146, height: 70 }, { fontSize: 16, color: C.ink });
    });
    card(s, 760, 176, 442, 350, C.navy, C.navy);
    text(s, "3 หน้าที่หลักของเครื่องสำอาง", { left: 796, top: 210, width: 360, height: 40 }, { fontSize: 25, bold: true, color: C.white });
    bulletList(s, ["ทำความสะอาดร่างกาย", "เพิ่มความสวยงามและความมั่นใจ", "ช่วยดูแลผิวพรรณและคงความงาม"], 804, 288, 340, { size: 20, gap: 62, color: C.white, bulletColor: "#E7B299" });
    footer(s);
  }

  // 3. Categories
  {
    const s = deck.slides.add();
    s.background.fill = C.cream;
    header(s, "บทที่ 3 / ความหมาย", "เครื่องสำอางไม่ใช่ยาทุกชนิด", 3, C.lavender);
    text(s, "ให้ดูที่ “วัตถุประสงค์ + การกล่าวอ้าง + ผลต่อร่างกาย”\nก่อนตัดสินว่าผลิตภัณฑ์อยู่กลุ่มใด", { left: 72, top: 176, width: 760, height: 74 }, { fontSize: 24, color: C.navy, bold: true });
    const cols = [
      ["เครื่องสำอาง", C.blue, "ใช้ทำความสะอาด\nเพิ่มความสวยงาม\nหรือดูแลผิวทั่วไป", "ไม่เน้นการรักษา\nและไม่มีฤทธิ์ทางเภสัชวิทยา"],
      ["เวชสำอาง", C.sage, "อยู่กึ่งกลางระหว่างยา\nกับเครื่องสำอาง", "เน้นการดูแลปัญหาเฉพาะ\nและอาจมีผลต่อโครงสร้างผิว"],
      ["ยา", C.terracotta, "ใช้วินิจฉัย ป้องกัน\nหรือรักษาโรค", "มีฤทธิ์ทางเภสัชวิทยา\nส่งผลโดยตรงต่อร่างกาย"],
    ];
    cols.forEach((it, i) => {
      const x = 72 + i * 380;
      card(s, x, 300, 340, 260, C.white, it[1]);
      shape(s, "rect", { left: x, top: 300, width: 340, height: 14 }, it[1]);
      text(s, it[0], { left: x + 24, top: 340, width: 280, height: 34 }, { fontSize: 24, bold: true, color: it[1] });
      text(s, it[2], { left: x + 24, top: 390, width: 290, height: 72 }, { fontSize: 20, bold: true, color: C.ink });
      text(s, it[3], { left: x + 24, top: 486, width: 290, height: 50 }, { fontSize: 17, color: C.muted });
    });
    text(s, "จำง่าย: คำว่า “ช่วยรักษา” หรือ “เห็นผลเร็วผิดปกติ” ควรทำให้เราหยุดตรวจสอบเพิ่ม", { left: 72, top: 600, width: 1136, height: 34 }, { fontSize: 20, bold: true, color: C.danger, alignment: "center" });
    footer(s);
  }

  // 4. Buying
  {
    const s = deck.slides.add();
    s.background.fill = C.cream;
    header(s, "บทที่ 2 / ผลิตภัณฑ์", "เริ่มจากแหล่งซื้อและสภาพบรรจุภัณฑ์", 4, C.blue);
    image(s, assets.safety, { left: 770, top: 165, width: 438, height: 330 }, "cover");
    label(s, "เช็กก่อนจ่าย", 72, 182, 140, C.blue, C.white);
    bulletList(s, ["เลือกแหล่งซื้อที่น่าเชื่อถือ: ร้านยา ห้าง ร้านสะดวกซื้อ หรือ Official online", "บรรจุภัณฑ์ต้องสมบูรณ์ ไม่ฉีก ไม่รั่ว และไม่มีร่องรอยเปิดใช้", "ไม่เลือกสินค้าที่ถูกแบ่งบรรจุหรือไม่มีข้อมูลผู้ผลิตชัดเจน", "หากเป็นของนำเข้า ต้องมีข้อมูลผู้นำเข้าและฉลากที่อ่านได้"], 76, 252, 630, { size: 20, gap: 84, bulletColor: C.blue });
    card(s, 770, 528, 438, 88, C.paleBlue, C.blue);
    text(s, "หลักคิด: แหล่งซื้อที่ตรวจสอบได้\nช่วยลดความเสี่ยงของของปลอมและของเสื่อมสภาพ", { left: 794, top: 548, width: 390, height: 52 }, { fontSize: 18, bold: true, color: C.navy });
    footer(s);
  }

  // 5. Label
  {
    const s = deck.slides.add();
    s.background.fill = C.cream;
    header(s, "บทที่ 2 / ฉลาก", "ฉลากคือแผนที่ของผลิตภัณฑ์", 5, C.blue);
    text(s, "ฉลากเครื่องสำอางต้องมีข้อความภาษาไทยที่อ่านได้ชัด\nและบอกข้อมูลสำคัญให้ผู้บริโภคตัดสินใจได้", { left: 72, top: 174, width: 560, height: 70 }, { fontSize: 23, color: C.navy, bold: true });
    image(s, assets.label, { left: 760, top: 160, width: 448, height: 300 }, "cover");
    const groups = [
      ["1", "ตัวตนของสินค้า", "ชื่อสินค้า • ประเภท/ชนิด • วิธีใช้", C.blue],
      ["2", "ส่วนผสมและปริมาณ", "ส่วนผสมเรียงจากมากไปน้อย • ปริมาณสุทธิ", C.sage],
      ["3", "แหล่งที่มา", "ผู้ผลิต/ผู้นำเข้า • ประเทศที่ผลิต • เลขที่จดแจ้ง", C.terracotta],
      ["4", "ความปลอดภัยและเวลา", "คำเตือน • ครั้งที่ผลิต • วันผลิต/หมดอายุ", C.lavender],
    ];
    groups.forEach((g, i) => {
      const y = 286 + i * 82;
      numberCircle(s, g[0], 76, y, g[3]);
      text(s, g[1], { left: 136, top: y - 2, width: 250, height: 28 }, { fontSize: 21, bold: true, color: g[3] });
      text(s, g[2], { left: 136, top: y + 30, width: 500, height: 30 }, { fontSize: 17, color: C.ink });
    });
    footer(s);
  }

  // 6. Notification check
  {
    const s = deck.slides.add();
    s.background.fill = C.cream;
    header(s, "บทที่ 2 / ตรวจสอบ", "เลขจดแจ้งช่วยยืนยันว่าเรากำลังดูสินค้าตัวไหน", 6, C.blue);
    text(s, "เลขจดแจ้งไม่ใช่คำรับรองว่าใช้แล้วได้ผล\nแต่เป็นจุดเริ่มต้นในการตรวจสอบข้อมูลผลิตภัณฑ์", { left: 72, top: 176, width: 600, height: 74 }, { fontSize: 24, bold: true, color: C.navy });
    const flow = [
      [1, "หยิบเลขจากฉลาก", "เลข 10 หรือ 13 หลัก\nต้องอ่านได้ชัด", C.terracotta],
      [2, "เข้าเว็บไซต์ อย.", "เลือกค้นหา\nผลิตภัณฑ์เครื่องสำอาง", C.blue],
      [3, "เทียบข้อมูล", "ชื่อสินค้า ผู้ผลิต\nและสถานะต้องสอดคล้อง", C.sage],
    ];
    flow.forEach((f, i) => {
      const x = 84 + i * 360;
      card(s, x, 320, 280, 214, C.white, f[3]);
      numberCircle(s, f[0], x + 22, 344, f[3]);
      text(s, f[1], { left: x + 82, top: 347, width: 175, height: 32 }, { fontSize: 21, bold: true, color: f[3] });
      text(s, f[2], { left: x + 26, top: 420, width: 220, height: 52 }, { fontSize: 20, color: C.ink, alignment: "center" });
      if (i < 2) {
        shape(s, "rightArrow", { left: x + 294, top: 394, width: 50, height: 28 }, f[3]);
      }
    });
    text(s, "เว็บไซต์ตรวจสอบตามเอกสาร: porta.fda.moph.go.th/fda_search_all/main/search_center_main.aspx", { left: 72, top: 584, width: 1136, height: 30 }, { fontSize: 15, color: C.muted, alignment: "center" });
    footer(s);
  }

  // 7. Ingredients and functions
  {
    const s = deck.slides.add();
    s.background.fill = C.cream;
    header(s, "บทที่ 3 / เวชสำอาง", "สารสำคัญแต่ละตัวทำงานต่างกัน", 7, C.sage);
    text(s, "อย่าดูแค่ชื่อสาร ให้ดูว่า “สารนั้นทำอะไร” และเหมาะกับเป้าหมายใด", { left: 72, top: 176, width: 780, height: 42 }, { fontSize: 24, bold: true, color: C.navy });
    const cards = [
      ["เติมความชุ่มชื้น", "ช่วยเพิ่มน้ำและลดการสูญเสียน้ำ\nตัวอย่าง: petrolatum, ceramides, กรดไขมัน, NMF", C.blue],
      ["ดูแลความหมองคล้ำ", "เกี่ยวข้องกับการยับยั้งการสร้างเม็ดสี\nตัวอย่าง: azelaic acid, arbutin, kojic acid, vitamin C derivatives, tranexamic acid", C.terracotta],
      ["ดูแลริ้วรอย", "เวชสำอางอาจช่วยกระตุ้นการสร้างเซลล์ผิว\nขณะที่เครื่องสำอางเน้นความชุ่มชื้นและภาพลักษณ์ชั่วคราว", C.lavender],
    ];
    cards.forEach((c, i) => {
      const x = 72 + i * 380;
      card(s, x, 292, 340, 258, C.white, c[2]);
      shape(s, "ellipse", { left: x + 28, top: 318, width: 52, height: 52 }, c[2]);
      text(s, String(i + 1), { left: x + 28, top: 328, width: 52, height: 28 }, { fontSize: 20, bold: true, color: C.white, alignment: "center" });
      text(s, c[0], { left: x + 96, top: 326, width: 210, height: 34 }, { fontSize: 22, bold: true, color: c[2] });
      text(s, c[1], { left: x + 28, top: 406, width: 280, height: 104 }, { fontSize: 18, color: C.ink });
    });
    text(s, "แก่นสำคัญ: เครื่องสำอางเน้นความงามและการดูแลทั่วไป ส่วนยาเน้นการรักษาโรค", { left: 72, top: 594, width: 1136, height: 32 }, { fontSize: 20, bold: true, color: C.sage, alignment: "center" });
    footer(s);
  }

  // 8. Dangerous ingredients
  {
    const s = deck.slides.add();
    s.background.fill = C.cream;
    header(s, "บทที่ 4 / สารอันตราย", "สวยไวผิดปกติ อาจต้องแลกด้วยผิวที่พัง", 8, C.danger);
    image(s, assets.skincare, { left: 760, top: 165, width: 448, height: 285 }, "cover");
    card(s, 72, 174, 620, 314, C.rose, C.danger);
    text(s, "สารที่เอกสารเตือนให้ระวัง", { left: 108, top: 208, width: 430, height: 36 }, { fontSize: 25, bold: true, color: C.danger });
    bulletList(s, ["ไฮโดรควิโนน (Hydroquinone)", "กรดเรทิโนอิก (Retinoic acid)", "สเตียรอยด์ (Steroid)", "สารปรอท และสารอื่นที่อยู่ในกลุ่มห้ามใช้"], 110, 274, 500, { size: 20, gap: 52, bulletColor: C.danger });
    text(s, "ผลข้างเคียงที่ยกตัวอย่างในเอกสาร: ผิวแดง แสบ ลอก ระคายเคือง ผิวบาง และรอยคล้ำ/ด่างที่รักษายาก", { left: 72, top: 526, width: 1136, height: 54 }, { fontSize: 19, bold: true, color: C.navy, alignment: "center" });
    label(s, "ไม่ซื้อมาใช้เองเพื่อรักษาโรค", 395, 602, 490, C.navy, C.white);
    footer(s);
  }

  // 9. Warning signs
  {
    const s = deck.slides.add();
    s.background.fill = C.cream;
    header(s, "บทที่ 4 / สังเกตความเสี่ยง", "สัญญาณเตือนของผลิตภัณฑ์ที่ควรวางลง", 9, C.terracotta);
    const signs = [
      ["โฆษณาเกินจริง", "อ้างขาวใน 3-7 วัน หรือผลลัพธ์เหมือนยา", C.terracotta],
      ["ไม่มีแหล่งที่มา", "ไม่ระบุผู้ผลิต/ผู้นำเข้า หรือเลขจดแจ้งไม่ชัด", C.blue],
      ["เนื้อครีมผิดปกติ", "แยกชั้น จับตัว หรือเปลี่ยนสีเร็วใน 1-3 เดือน", C.sage],
      ["กลิ่นแรงผิดธรรมชาติ", "กลิ่นน้ำหอมกลบกลิ่นสารเคมีหรือกลิ่นแปลก", C.lavender],
      ["ราคาถูกเกินเหตุ", "คำโฆษณาแรง แต่ข้อมูลและคุณภาพตรวจสอบไม่ได้", C.danger],
      ["คาดหวังผลเร็วเกินไป", "การผลัดผิว/ปรับสภาพผิวที่ดีมักค่อยเป็นค่อยไป", C.navy],
    ];
    signs.forEach((sg, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 72 + col * 580;
      const y = 182 + row * 132;
      card(s, x, y, 530, 104, C.white, sg[2]);
      numberCircle(s, i + 1, x + 22, y + 30, sg[2]);
      text(s, sg[0], { left: x + 84, top: y + 20, width: 370, height: 28 }, { fontSize: 21, bold: true, color: sg[2] });
      text(s, sg[1], { left: x + 84, top: y + 55, width: 400, height: 38 }, { fontSize: 17, color: C.ink });
    });
    footer(s);
  }

  // 10. Checklist
  {
    const s = deck.slides.add();
    s.background.fill = C.cream;
    header(s, "บทสรุป / ใช้จริง", "5 ขั้นก่อนหยิบเครื่องสำอางมาใช้", 10, C.navy);
    text(s, "ความสวยที่ยั่งยืนเริ่มจากการรู้เท่าทัน\nไม่ใช่การไล่ตามคำโฆษณา", { left: 72, top: 176, width: 500, height: 78 }, { fontSize: 27, bold: true, color: C.navy });
    const checklist = [
      ["รู้ว่าเป็นอะไร", "เครื่องสำอาง เวชสำอาง หรือยา?", C.blue],
      ["อ่านฉลาก", "ชื่อสินค้า ส่วนผสม วิธีใช้ คำเตือน วันหมดอายุ", C.sage],
      ["ตรวจเลขจดแจ้ง", "ค้นในช่องทางของ อย. แล้วเทียบข้อมูล", C.terracotta],
      ["ทดสอบและสังเกต", "เริ่มทีละน้อย อย่าคาดหวังผลเร็วผิดปกติ", C.lavender],
      ["เก็บให้ถูก", "ที่แห้ง เย็น พ้นแดด ประมาณ 25°C", C.navy],
    ];
    checklist.forEach((it, i) => {
      const y = 296 + i * 62;
      shape(s, "ellipse", { left: 76, top: y + 4, width: 30, height: 30 }, it[2]);
      text(s, "✓", { left: 76, top: y + 4, width: 30, height: 24 }, { fontSize: 20, bold: true, color: C.white, alignment: "center" });
      text(s, it[0], { left: 122, top: y - 2, width: 180, height: 28 }, { fontSize: 20, bold: true, color: it[2] });
      text(s, it[1], { left: 332, top: y - 1, width: 430, height: 28 }, { fontSize: 18, color: C.ink });
      shape(s, "line", { left: 122, top: y + 42, width: 640, height: 0 }, "none", { style: "solid", fill: C.line, width: 1 });
    });
    image(s, assets.label, { left: 824, top: 190, width: 356, height: 240 }, "cover");
    card(s, 824, 458, 356, 120, C.navy, C.navy);
    text(s, "สวยอย่างรู้เท่าทัน\nเลือกให้เหมาะ ใช้ให้ถูก ตรวจให้เป็น", { left: 852, top: 484, width: 300, height: 62 }, { fontSize: 22, bold: true, color: C.white, alignment: "center" });
    footer(s, "สรุปจาก chap 1 cosme.pdf • chap 2 cosme.pdf • chap 3 cosme.pdf • chap 4 cosme.pdf");
  }

  for (const [i, slide] of deck.slides.items.entries()) {
    const png = await deck.export({ slide, format: "png", scale: 1 });
    await fs.writeFile(path.join(PREVIEW, `slide-${String(i + 1).padStart(2, "0")}.png`), new Uint8Array(await png.arrayBuffer()));
  }
  const montage = await deck.export({ format: "webp", montage: true, scale: 1 });
  await fs.writeFile(path.join(PREVIEW, "montage.webp"), new Uint8Array(await montage.arrayBuffer()));
  const pptx = await PresentationFile.exportPptx(deck);
  await pptx.save(OUT);
  console.log(`WROTE ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
