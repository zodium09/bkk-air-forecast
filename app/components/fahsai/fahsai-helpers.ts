import type { AreaForecast, RegionId, TopicId } from "../../lib/fahsai-data";

export interface TopicCardConfig {
  id: TopicId;
  icon: string;
  label: string;
  tagline: string;
  shortDesc: string;
  color: string;
  gradient: string;
  accentLight: string;
  unit: string;
  badgeText: string;
}

export const TOPICS: TopicCardConfig[] = [
  {
    id: "rain",
    icon: "🌧️",
    label: "ฝน & พายุฟ้าคะนอง",
    tagline: "เรดาร์เมฆฝน · โอกาสตก · ปริมาณสะสม",
    shortDesc: "เช็กโอกาสฝนตก เรดาร์ dBZ ทิศทางพายุฝน และเวลาพกร่ม",
    color: "#0284c7",
    gradient: "linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)",
    accentLight: "rgba(14, 165, 233, 0.14)",
    unit: "%",
    badgeText: "เรดาร์สด & โอกาสฝน",
  },
  {
    id: "sky",
    icon: "🌤️",
    label: "ฟ้า & สภาพอากาศ",
    tagline: "ท้องฟ้า · ความชื้น · ทัศนวิสัย · ความกดอากาศ",
    shortDesc: "ความโปร่งของท้องฟ้า อุณหภูมิ ความชื้น และความสบายตัว",
    color: "#0ea5e9",
    gradient: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
    accentLight: "rgba(99, 102, 241, 0.14)",
    unit: "°C",
    badgeText: "ฟ้าใส & สภาพอากาศ",
  },
  {
    id: "tide",
    icon: "🌊",
    label: "น้ำทะเลหนุน & น้ำขึ้นลง",
    tagline: "ระดับน้ำ รทก. · จังหวะน้ำขึ้นสูงสุด–ลงต่ำสุด",
    shortDesc: "ติดตามเวลาน้ำทะเลหนุนสูง ปากแม่น้ำ และชายฝั่งทั่วไทย",
    color: "#1d4ed8",
    gradient: "linear-gradient(135deg, #1d4ed8 0%, #06b6d4 100%)",
    accentLight: "rgba(29, 78, 216, 0.14)",
    unit: "ม. รทก.",
    badgeText: "น้ำขึ้น–น้ำลง",
  },
  {
    id: "wave",
    icon: "⛵",
    label: "คลื่นลม & การเดินเรือ",
    tagline: "ความสูงคลื่นอ่าวไทย–อันดามัน · ลมชายฝั่ง",
    shortDesc: "ความปลอดภัยเรือเล็ก เรือท่องเที่ยว ดำน้ำ และเล่นน้ำชายหาด",
    color: "#0369a1",
    gradient: "linear-gradient(135deg, #0369a1 0%, #0d9488 100%)",
    accentLight: "rgba(13, 148, 136, 0.14)",
    unit: "เมตร",
    badgeText: "คลื่นลมทะเล",
  },
  {
    id: "air",
    icon: "😷",
    label: "ฝุ่น PM2.5 & อากาศ",
    tagline: "ค่าฝุ่นละเอียด · US AQI · ชั้นฝาชีครอบ",
    shortDesc: "คุณภาพอากาศ การระบายฝุ่นตามลม และคำแนะนำสวมหน้ากาก",
    color: "#059669",
    gradient: "linear-gradient(135deg, #059669 0%, #34d399 100%)",
    accentLight: "rgba(16, 185, 129, 0.14)",
    unit: "µg/m³",
    badgeText: "คุณภาพอากาศ",
  },
  {
    id: "heat",
    icon: "☀️",
    label: "ความร้อน & รังสี UV",
    tagline: "RealFeel รู้สึกร้อนจริง · ดัชนียูวี · ฮีทสโตรก",
    shortDesc: "อุณหภูมิความรู้สึกร้อนจริง ความเข้มแสงแดด และเวลาเลี่ยงแดด",
    color: "#ea580c",
    gradient: "linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)",
    accentLight: "rgba(249, 115, 22, 0.14)",
    unit: "°C",
    badgeText: "ดัชนีความร้อน & UV",
  },
  {
    id: "winter",
    icon: "🍃",
    label: "ลมหนาว & ทะเลหมอก",
    tagline: "อุณหภูมิต่ำสุดเช้ามืด · โอกาสเกิดทะเลหมอก",
    shortDesc: "มวลอากาศเย็น ลมมรสุมตะวันออกเฉียงเหนือ และหมอกยอดดอย",
    color: "#0891b2",
    gradient: "linear-gradient(135deg, #0891b2 0%, #2dd4bf 100%)",
    accentLight: "rgba(6, 182, 212, 0.14)",
    unit: "°C",
    badgeText: "อากาศเย็น & หมอก",
  },
  {
    id: "tourism",
    icon: "🏖️",
    label: "การท่องเที่ยวทั่วไทย",
    tagline: "คะแนนน่าเที่ยว 0–100 · แนะนำกิจกรรมเด่น",
    shortDesc: "วางแผนเที่ยวทะเล ภูเขา น้ำตก แคมป์ปิ้ง และถ่ายภาพตามอากาศจริง",
    color: "#7c3aed",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)",
    accentLight: "rgba(124, 58, 237, 0.14)",
    unit: "คะแนน",
    badgeText: "Smart Tourism",
  },
  {
    id: "risk",
    icon: "⚠️",
    label: "พื้นที่เสี่ยงภัยวันนี้",
    tagline: "สแกนจุดเสี่ยงฝนหนัก · คลื่นแรง · ฝุ่น · ร้อนจัด",
    shortDesc: "เฝ้าระวังพื้นที่เสี่ยงภัยธรรมชาติทั่วไทยแบบเรียลไทม์ 5 ระดับ",
    color: "#dc2626",
    gradient: "linear-gradient(135deg, #dc2626 0%, #f97316 100%)",
    accentLight: "rgba(220, 38, 38, 0.14)",
    unit: "ระดับ",
    badgeText: "เฝ้าระวังพื้นที่เสี่ยง",
  },
  {
    id: "suitable",
    icon: "✨",
    label: "พื้นที่เหมาะสม & น่าไป",
    tagline: "คัดจุดฟ้าใส · ไร้ฝุ่น · ทะเลสงบ · อากาศดีสุด",
    shortDesc: "จัดอันดับจังหวัดที่อากาศดีและเหมาะสมกับกิจกรรมกลางแจ้งที่สุดวันนี้",
    color: "#16a34a",
    gradient: "linear-gradient(135deg, #16a34a 0%, #0ea5e9 100%)",
    accentLight: "rgba(22, 163, 74, 0.14)",
    unit: "คะแนน",
    badgeText: "พื้นที่เหมาะสมสูงสุด",
  },
];

export interface RiskBandInfo {
  tier: 1 | 2 | 3 | 4 | 5;
  label: string;
  rangeText: string;
  color: string;
}

export function getTopicRiskBands(topic: TopicId): RiskBandInfo[] {
  if (topic === "rain") {
    return [
      { tier: 5, label: "ระดับ 5 · ฝนตกหนักมาก/เสี่ยงน้ำท่วมขัง", rangeText: "โอกาส > 75% หรือฝน > 35 มม.", color: "#ef4444" },
      { tier: 4, label: "ระดับ 4 · ฝนฟ้าคะนองกระจาย", rangeText: "โอกาส 55–75% หรือฝน 15–35 มม.", color: "#f97316" },
      { tier: 3, label: "ระดับ 3 · มีฝนบางแห่ง (ควรพกร่ม)", rangeText: "โอกาส 35–54%", color: "#eab308" },
      { tier: 2, label: "ระดับ 2 · เมฆบางส่วน ฝนเล็กน้อย", rangeText: "โอกาส 15–34%", color: "#38bdf8" },
      { tier: 1, label: "ระดับ 1 · ฟ้าใสโปร่ง ไร้ฝน", rangeText: "โอกาส < 15%", color: "#10b981" },
    ];
  }
  if (topic === "sky") {
    return [
      { tier: 5, label: "ระดับ 5 · พายุเมฆฝนหนาทึบ ทัศนวิสัยต่ำ", rangeText: "เมฆ > 85% หรือทัศนวิสัย < 6 กม.", color: "#ef4444" },
      { tier: 4, label: "ระดับ 4 · เมฆครึ้มปกคลุม อากาศอับชื้น", rangeText: "เมฆ 70–85%", color: "#f97316" },
      { tier: 3, label: "ระดับ 3 · เมฆเป็นส่วนมาก แดดสลับร่ม", rangeText: "เมฆ 45–69%", color: "#eab308" },
      { tier: 2, label: "ระดับ 2 · ฟ้าโปร่ง มีเมฆก้อนสวยงาม", rangeText: "เมฆ 25–44%", color: "#0ea5e9" },
      { tier: 1, label: "ระดับ 1 · ฟ้าใสกระจ่าง ทัศนวิสัยดีเยี่ยม", rangeText: "เมฆ < 25% · ทัศนวิสัย > 14 กม.", color: "#10b981" },
    ];
  }
  if (topic === "tide") {
    return [
      { tier: 5, label: "ระดับ 5 · น้ำทะเลหนุนสูงวิกฤต", rangeText: "น้ำขึ้นสูงสุด > +1.70 ม. รทก.", color: "#ef4444" },
      { tier: 4, label: "ระดับ 4 · น้ำทะเลหนุนสูง เฝ้าระวังปากแม่น้ำ", rangeText: "น้ำขึ้นสูงสุด +1.42 ถึง +1.70 ม.", color: "#f97316" },
      { tier: 3, label: "ระดับ 3 · น้ำขึ้นปานกลางตามรอบดวงจันทร์", rangeText: "น้ำขึ้นสูงสุด +1.15 ถึง +1.41 ม.", color: "#eab308" },
      { tier: 2, label: "ระดับ 2 · น้ำขึ้น–ลงปกติ ชายฝั่งปลอดภัย", rangeText: "น้ำขึ้นสูงสุด +0.30 ถึง +1.14 ม.", color: "#06b6d4" },
      { tier: 1, label: "ระดับ 1 · พื้นที่ดอน/ภูเขา พ้นเขตน้ำหนุน", rangeText: "ไม่มีอิทธิพลน้ำทะเลหนุน", color: "#10b981" },
    ];
  }
  if (topic === "wave") {
    return [
      { tier: 5, label: "ระดับ 5 · คลื่นลมแรงจัด งดเดินเรือทุกชนิด", rangeText: "คลื่นสูง > 2.0 เมตร", color: "#ef4444" },
      { tier: 4, label: "ระดับ 4 · คลื่นค่อนข้างแรง เรือเล็กงดออกจากฝั่ง", rangeText: "คลื่นสูง 1.30 – 2.00 เมตร", color: "#f97316" },
      { tier: 3, label: "ระดับ 3 · คลื่นปานกลาง เดินเรือด้วยความระมัดระวัง", rangeText: "คลื่นสูง 0.85 – 1.29 เมตร", color: "#eab308" },
      { tier: 2, label: "ระดับ 2 · คลื่นเล็กน้อย ท่องเที่ยวทางทะเลปกติ", rangeText: "คลื่นสูง 0.40 – 0.84 เมตร", color: "#06b6d4" },
      { tier: 1, label: "ระดับ 1 · ทะเลเรียบสงบ / แหล่งน้ำในแผ่นดิน", rangeText: "คลื่น < 0.40 เมตร", color: "#10b981" },
    ];
  }
  if (topic === "air") {
    return [
      { tier: 5, label: "ระดับ 5 · มีผลกระทบต่อสุขภาพทุกคน", rangeText: "PM2.5 > 75.0 µg/m³", color: "#ef4444" },
      { tier: 4, label: "ระดับ 4 · เริ่มมีผลกระทบต่อสุขภาพ", rangeText: "PM2.5 37.6 – 75.0 µg/m³", color: "#f97316" },
      { tier: 3, label: "ระดับ 3 · ปานกลาง (กลุ่มเสี่ยงระวัง)", rangeText: "PM2.5 25.1 – 37.5 µg/m³", color: "#eab308" },
      { tier: 2, label: "ระดับ 2 · คุณภาพอากาศดี", rangeText: "PM2.5 15.1 – 25.0 µg/m³", color: "#10b981" },
      { tier: 1, label: "ระดับ 1 · อากาศดีมาก สดชื่นบริสุทธิ์", rangeText: "PM2.5 ≤ 15.0 µg/m³", color: "#06b6d4" },
    ];
  }
  if (topic === "heat") {
    return [
      { tier: 5, label: "ระดับ 5 · อันตรายมาก (เสี่ยงฮีทสโตรกสูง)", rangeText: "RealFeel > 42°C", color: "#ef4444" },
      { tier: 4, label: "ระดับ 4 · เตือนภัยความร้อนจัด", rangeText: "RealFeel 38 – 42°C", color: "#f97316" },
      { tier: 3, label: "ระดับ 3 · เฝ้าระวังอากาศร้อน", rangeText: "RealFeel 34 – 37.9°C", color: "#eab308" },
      { tier: 2, label: "ระดับ 2 · อากาศอบอุ่นปกติ", rangeText: "RealFeel 30 – 33.9°C", color: "#10b981" },
      { tier: 1, label: "ระดับ 1 · อากาศเย็นสบาย ไม่ร้อน", rangeText: "RealFeel < 30°C", color: "#06b6d4" },
    ];
  }
  if (topic === "winter") {
    return [
      { tier: 5, label: "ระดับ 5 · อากาศหนาวจัด & ทะเลหมอกหนาแน่น", rangeText: "เช้า ≤ 17.5°C · โอกาสหมอกสูง", color: "#6366f1" },
      { tier: 4, label: "ระดับ 4 · อากาศเย็นชัดเจน ลมหนาวพัดแรง", rangeText: "เช้า 17.6 – 20.5°C", color: "#0284c7" },
      { tier: 3, label: "ระดับ 3 · เช้าเย็นสบาย ลมโชยสดชื่น", rangeText: "เช้า 20.6 – 23.0°C", color: "#06b6d4" },
      { tier: 2, label: "ระดับ 2 · อากาศโปร่งสบายปลายฝนต้นหนาว", rangeText: "เช้า 23.1 – 25.0°C", color: "#10b981" },
      { tier: 1, label: "ระดับ 1 · อากาศอบอุ่นริมทะเล/ที่ราบ", rangeText: "เช้า > 25.0°C", color: "#eab308" },
    ];
  }
  if (topic === "tourism" || topic === "suitable") {
    return [
      { tier: 5, label: "ระดับ 5 · แนะนำสูงสุด (ฟ้าใส อากาศดีมาก)", rangeText: "คะแนนความเหมาะสม 88 – 100", color: "#10b981" },
      { tier: 4, label: "ระดับ 4 · เหมาะสมดีเยี่ยม น่าเดินทาง", rangeText: "คะแนนความเหมาะสม 78 – 87", color: "#0ea5e9" },
      { tier: 3, label: "ระดับ 3 · เที่ยวได้ตามปกติ เตรียมพร้อมเล็กน้อย", rangeText: "คะแนนความเหมาะสม 65 – 77", color: "#eab308" },
      { tier: 2, label: "ระดับ 2 · ควรเช็กช่วงเวลา (มีฝน/แดด/ฝุ่นบางช่วง)", rangeText: "คะแนนความเหมาะสม 50 – 64", color: "#f97316" },
      { tier: 1, label: "ระดับ 1 · แนะนำกิจกรรมในร่มชั่วคราว", rangeText: "คะแนนความเหมาะสม < 50", color: "#ef4444" },
    ];
  }
  // topic === "risk"
  return [
    { tier: 5, label: "ระดับ 5 · พื้นที่เสี่ยงสูงมาก (เฝ้าระวังใกล้ชิด)", rangeText: "ฝนหนักมาก / ฝุ่นพุ่ง / คลื่นจัด", color: "#ef4444" },
    { tier: 4, label: "ระดับ 4 · พื้นที่เฝ้าระวังสำคัญ", rangeText: "มีปัจจัยเสี่ยงเกินเกณฑ์มาตรฐาน", color: "#f97316" },
    { tier: 3, label: "ระดับ 3 · เฝ้าระวังระดับปานกลาง", rangeText: "ติดตามพยากรณ์รายชั่วโมง", color: "#eab308" },
    { tier: 2, label: "ระดับ 2 · ความเสี่ยงต่ำ สภาวะปกติ", rangeText: "ใช้ชีวิตประจำวันได้ปกติ", color: "#38bdf8" },
    { tier: 1, label: "ระดับ 1 · พื้นที่ปลอดภัย ฟ้าใสไร้ภัยคุกคาม", rangeText: "ทุกตัวแปรอยู่ในเกณฑ์ดีมาก", color: "#10b981" },
  ];
}

export function classifyAreaRisk(area: AreaForecast, topic: TopicId): 1 | 2 | 3 | 4 | 5 {
  const c = area.current;
  if (topic === "rain") {
    if (c.rainProb > 75 || c.rain24hMm > 35) return 5;
    if (c.rainProb >= 55 || c.rain24hMm >= 15) return 4;
    if (c.rainProb >= 35) return 3;
    if (c.rainProb >= 15) return 2;
    return 1;
  }
  if (topic === "sky") {
    if (c.cloudCoverPct > 85 || c.visibilityKm < 6) return 5;
    if (c.cloudCoverPct >= 70) return 4;
    if (c.cloudCoverPct >= 45) return 3;
    if (c.cloudCoverPct >= 25) return 2;
    return 1;
  }
  if (topic === "tide") {
    if (!area.isCoastal && c.highTideMsl <= 0.05) return 1;
    if (c.highTideMsl > 1.7) return 5;
    if (c.highTideMsl >= 1.42) return 4;
    if (c.highTideMsl >= 1.15) return 3;
    return 2;
  }
  if (topic === "wave") {
    if (!area.isCoastal) return 1;
    if (c.waveHeightM > 2.0) return 5;
    if (c.waveHeightM >= 1.3) return 4;
    if (c.waveHeightM >= 0.85) return 3;
    if (c.waveHeightM >= 0.4) return 2;
    return 1;
  }
  if (topic === "air") {
    if (c.pm25 > 75) return 5;
    if (c.pm25 > 37.5) return 4;
    if (c.pm25 > 25) return 3;
    if (c.pm25 > 15) return 2;
    return 1;
  }
  if (topic === "heat") {
    if (c.feelsLikeC > 42) return 5;
    if (c.feelsLikeC >= 38) return 4;
    if (c.feelsLikeC >= 34) return 3;
    if (c.feelsLikeC >= 30) return 2;
    return 1;
  }
  if (topic === "winter") {
    if (c.minMorningC <= 17.5) return 5;
    if (c.minMorningC <= 20.5) return 4;
    if (c.minMorningC <= 23.0) return 3;
    if (c.minMorningC <= 25.0) return 2;
    return 1;
  }
  if (topic === "tourism" || topic === "suitable") {
    const score = topic === "tourism" ? c.tourismScore : c.suitabilityScore;
    if (score >= 88) return 5;
    if (score >= 78) return 4;
    if (score >= 65) return 3;
    if (score >= 50) return 2;
    return 1;
  }
  return c.multiHazardTier;
}

export function pinMetricLabel(area: AreaForecast, topic: TopicId): string {
  const c = area.current;
  if (topic === "rain") return `${c.rainProb}%`;
  if (topic === "sky") return `${Math.round(c.tempC)}°C`;
  if (topic === "tide") return area.isCoastal || c.highTideMsl > 0 ? `+${c.highTideMsl}ม.` : "ดอน";
  if (topic === "wave") return area.isCoastal ? `${c.waveHeightM}ม.` : "น้ำจืด";
  if (topic === "air") return `${Math.round(c.pm25)}µg`;
  if (topic === "heat") return `${Math.round(c.feelsLikeC)}°C`;
  if (topic === "winter") return `${c.minMorningC}°C`;
  if (topic === "tourism") return `${c.tourismScore}pt`;
  if (topic === "suitable") return `${c.suitabilityScore}%`;
  return `Lv.${c.multiHazardTier}`;
}

export function getFriendlyAdvice(area: AreaForecast, topic: TopicId): {
  badge: string;
  tone: "good" | "warn" | "alert";
  headline: string;
  action: string;
} {
  const c = area.current;
  if (topic === "rain") {
    if (c.rainProb >= 55 || c.rain24hMm >= 15) {
      return {
        badge: "☔ โอกาสฝนตกสูง",
        tone: "alert",
        headline: `โอกาสเกิดฝน ${c.rainProb}% · สะสมคาดการณ์ ~${c.rain24hMm} มม. (เรดาร์ ${c.radarDbz} dBZ)`,
        action: "ควรพกร่มหรือเสื้อกันฝนติดตัว หลีกเลี่ยงจุดลุ่มต่ำน้ำขัง และเผื่อเวลาเดินทางช่วงบ่าย–ค่ำ",
      };
    }
    if (c.rainProb >= 35) {
      return {
        badge: "🌦️ มีเมฆและฝนบางแห่ง",
        tone: "warn",
        headline: `มีโอกาสเจอฝนโปรยปราย ${c.rainProb}% ช่วงบ่ายถึงค่ำ`,
        action: "พกร่มพับติดกระเป๋าไว้จะอุ่นใจกว่า โดยเฉพาะพื้นที่รับลมมรสุมและชายฝั่งทะเล",
      };
    }
    return {
      badge: "🌤️ ฟ้าใส ฝนน้อย",
      tone: "good",
      headline: `โอกาสฝนตกต่ำเพียง ${c.rainProb}% ตลอดวัน ท้องฟ้าโปร่ง`,
      action: "เหมาะสำหรับซักตากผ้า เดินทางท่องเที่ยว และทำกิจกรรมกลางแจ้งได้สบายใจ",
    };
  }

  if (topic === "sky") {
    return {
      badge: c.skyStateLabel,
      tone: c.rainProb >= 55 ? "warn" : "good",
      headline: `${c.skyStateLabel} · อุณหภูมิ ${c.tempC}°C · ความชื้น ${c.humidity}% · ทัศนวิสัย ${c.visibilityKm} กม.`,
      action: `ความกดอากาศ ${c.pressureHpa} hPa · เมฆปกคลุม ${c.cloudCoverPct}% · ${c.lifestyle.outdoorLabel}`,
    };
  }

  if (topic === "tide") {
    if (!area.isCoastal && c.highTideMsl <= 0.05) {
      return {
        badge: "⛰️ พื้นที่ดอน/ภูเขา",
        tone: "good",
        headline: `ความสูงเหนือระดับน้ำทะเล ~${area.elevationM} เมตร พ้นเขตอิทธิพลน้ำทะเลหนุน`,
        action: "ไม่มีผลกระทบจากน้ำทะเลหนุน การระบายน้ำเป็นไปตามความลาดชันของพื้นที่",
      };
    }
    if (c.highTideMsl >= 1.42) {
      return {
        badge: "🌊 เฝ้าระวังน้ำทะเลหนุนสูง",
        tone: "warn",
        headline: `ระดับน้ำปัจจุบัน ${c.tideMsl >= 0 ? "+" : ""}${c.tideMsl} ม. รทก. · น้ำขึ้นสูงสุด +${c.highTideMsl} ม. เวลา ${c.highTideTime}`,
        action: "ชุมชนริมน้ำ ปากแม่น้ำ และพื้นที่ลุ่มต่ำชายฝั่งควรระวังน้ำเอ่อท้นช่วงเวลาน้ำขึ้นสูงสุด",
      };
    }
    return {
      badge: "⚓ น้ำขึ้น–ลงปกติ",
      tone: "good",
      headline: `น้ำขึ้นสูงสุด +${c.highTideMsl} ม. (${c.highTideTime}) · น้ำลงต่ำสุด ${c.lowTideMsl} ม. (${c.lowTideTime})`,
      action: "จังหวะน้ำขึ้น–ลงอยู่ในเกณฑ์ปลอดภัย เหมาะวางแผนเดินชายหาด ล่องเรือ หรือเที่ยวทะเลแหวกช่วงน้ำลง",
    };
  }

  if (topic === "wave") {
    if (!area.isCoastal) {
      return {
        badge: "🏞️ พื้นที่ในแผ่นดิน",
        tone: "good",
        headline: `ลม${c.windDirLabel} ${c.windKmh} กม./ชม. (ลมกระโชก ${c.windGustKmh} กม./ชม.)`,
        action: "กิจกรรมล่องแพ พายคายัค หรือล่องเรือในอ่างเก็บน้ำและแม่น้ำสามารถทำได้ตามปกติ",
      };
    }
    if (c.waveHeightM >= 1.3) {
      return {
        badge: "🌊 คลื่นลมค่อนข้างแรง",
        tone: "warn",
        headline: `คลื่นสูง ${c.waveHeightM} เมตร · ลมชายฝั่ง ${c.windKmh} กม./ชม.`,
        action: c.marineSafetyLabel,
      };
    }
    return {
      badge: "⛵ ทะเลสงบ น่าเที่ยว",
      tone: "good",
      headline: `ความสูงคลื่นเพียง ${c.waveHeightM} เมตร · ${c.seaStateLabel}`,
      action: c.marineSafetyLabel,
    };
  }

  if (topic === "air") {
    if (c.pm25 > 37.5) {
      return {
        badge: "🟠 ฝุ่นเกินเกณฑ์มาตรฐาน",
        tone: "alert",
        headline: `PM2.5 อยู่ที่ ${c.pm25} µg/m³ (US AQI ${c.aqi})`,
        action: "กลุ่มเสี่ยงควรสวมหน้ากากป้องกันฝุ่นเมื่ออยู่กลางแจ้ง และลดการออกกำลังกายหนักกลางแจ้ง",
      };
    }
    if (c.pm25 > 25) {
      return {
        badge: "🟡 คุณภาพอากาศปานกลาง",
        tone: "warn",
        headline: `PM2.5 อยู่ที่ ${c.pm25} µg/m³ (อยู่ในเกณฑ์มาตรฐานไทย ≤ 37.5 µg/m³)`,
        action: "คนทั่วไปทำกิจกรรมกลางแจ้งได้ตามปกติ ผู้ที่แพ้ง่ายควรสังเกตอาการตนเอง",
      };
    }
    return {
      badge: "🟢 อากาศสะอาด สดชื่นมาก",
      tone: "good",
      headline: `PM2.5 ต่ำเพียง ${c.pm25} µg/m³ (US AQI ${c.aqi}) อากาศบริสุทธิ์`,
      action: "สูดอากาศได้เต็มปอด เหมาะเปิดหน้าต่างรับลม วิ่งในสวน หรือท่องเที่ยวธรรมชาติ",
    };
  }

  if (topic === "heat") {
    if (c.feelsLikeC >= 38) {
      return {
        badge: "🔥 ร้อนจัด ระวังฮีทสโตรก",
        tone: "alert",
        headline: `ความรู้สึกร้อนจริง RealFeel ${c.feelsLikeC}°C (UV สูงสุด ${c.uvIndex})`,
        action: "จิบน้ำบ่อยๆ เลี่ยงการตากแดดจัดช่วง 11:00–15:00 น. และสวมหมวกหรือทาครีมกันแดด",
      };
    }
    if (c.feelsLikeC >= 34) {
      return {
        badge: "☀️ อากาศค่อนข้างร้อน",
        tone: "warn",
        headline: `ความรู้สึกร้อนจริง ${c.feelsLikeC}°C (อุณหภูมิวัดได้ ${c.tempC}°C · UV ${c.uvIndex})`,
        action: "สวมเสื้อผ้าระบายอากาศได้ดี และพกน้ำดื่มติดตัวเมื่อออกนอกอาคาร",
      };
    }
    return {
      badge: "🌤️ อากาศสบาย ไม่ร้อนจัด",
      tone: "good",
      headline: `ความรู้สึกร้อนจริงเพียง ${c.feelsLikeC}°C อากาศกำลังสบาย`,
      action: "เดินเล่น ท่องเที่ยว หรือทำกิจกรรมกลางแจ้งได้ตลอดวัน แนะนำทาครีมกันแดดช่วงเที่ยง",
    };
  }

  if (topic === "winter") {
    return {
      badge: c.minMorningC <= 20 ? "❄️ อากาศหนาวเย็น & มีหมอก" : "🍃 ลมโชยเย็นสบาย",
      tone: "good",
      headline: `ต่ำสุดเช้ามืด ${c.minMorningC}°C · โอกาสเกิดหมอกเช้า ${c.mistChancePct}% · ลม${c.windDirLabel}`,
      action: `${c.coolIndexLabel} · แนะนำเตรียมเสื้อกันหนาวหรือเสื้อคลุมบางๆ ช่วง 05:30–08:00 น.`,
    };
  }

  if (topic === "tourism") {
    return {
      badge: c.tourismBadge,
      tone: c.tourismScore >= 75 ? "good" : "warn",
      headline: `คะแนนน่าเที่ยววันนี้ ${c.tourismScore}/100 คะแนน · แนะนำ: ${area.bestActivity}`,
      action: `แลนด์มาร์กห้ามพลาดใน ${area.name}: ${area.tourismHighlights.join(" · ")}`,
    };
  }

  if (topic === "suitable") {
    return {
      badge: `✨ ความเหมาะสม ${c.suitabilityScore}/100`,
      tone: c.suitabilityScore >= 78 ? "good" : "warn",
      headline: `ดัชนีความเหมาะสมรวม ${c.suitabilityScore}% · จุดเด่น: ${c.suitabilityTags.join(" ")}`,
      action: `${c.lifestyle.outdoorLabel} · ${c.lifestyle.laundryLabel} · ${c.lifestyle.campingLabel}`,
    };
  }

  // topic === "risk"
  return {
    badge: `⚠️ ความเสี่ยงรวม ระดับ ${c.multiHazardTier}/5`,
    tone: c.multiHazardTier >= 4 ? "alert" : c.multiHazardTier === 3 ? "warn" : "good",
    headline: c.primaryHazardLabel,
    action: c.hazardAdvice,
  };
}

export function getScienceExplainer(topic: TopicId): {
  title: string;
  subtitle: string;
  cards: { head: string; body: string }[];
} {
  if (topic === "rain") {
    return {
      title: "🔬 ความรู้เข้าใจง่าย: เรดาร์ฝน dBZ, โอกาสเกิดฝน (%) และร่องมรสุมทั่วไทย",
      subtitle: "อ่านค่าเรดาร์และเปอร์เซ็นต์ฝนอย่างไรให้วางแผนเดินทางและพกร่มได้แม่นยำ?",
      cards: [
        {
          head: "📡 1. ค่าการสะท้อนเรดาร์ (dBZ) บอกความแรงฝนอย่างไร?",
          body: "20–30 dBZ (สีเขียว) คือฝนโปรยปราย, 35–44 dBZ (สีเหลือง–ส้ม) คือฝนปานกลางถึงหนัก และ ≥ 45 dBZ (สีแดง) คือพายุฝนฟ้าคะนองตกหนักมากที่อาจเกิดน้ำท่วมขังรอระบาย",
        },
        {
          head: "🧭 2. ทิศทางลมมรสุมกำหนดเส้นทางฝนทั่วไทย",
          body: "กลุ่มฝนเคลื่อนที่ตามกระแสลม เช่น มรสุมตะวันตกเฉียงใต้พัดฝนจากอันดามันเข้าฝั่ง หรือมรสุมตะวันออกเฉียงเหนือพัดฝนเข้าสู่อ่าวไทยและภาคใต้",
        },
        {
          head: "☔ 3. โอกาสเกิดฝน 60% แปลว่าอะไร?",
          body: "หมายถึง ณ พิกัดที่คุณอยู่ มีโอกาส 6 ใน 10 ที่จะมีฝนตกลงมาวัดปริมาณได้ (ตั้งแต่ 0.1 มม. ขึ้นไป) ในช่วงเวลานั้น ช่วยให้ตัดสินใจพกร่มหรือเลื่อนเวลาซักผ้าได้ง่ายขึ้น",
        },
      ],
    };
  }
  if (topic === "sky") {
    return {
      title: "🔬 ความรู้เข้าใจง่าย: ท้องฟ้า ความกดอากาศ และดัชนีความสบาย",
      subtitle: "ทำไมบางวันฟ้าใสเป็นสีฟ้าเข้ม และความกดอากาศบอกสภาพอากาศล่วงหน้าได้อย่างไร?",
      cards: [
        {
          head: "🌤️ 1. ความกดอากาศสูง vs ความกดอากาศต่ำ",
          body: "ความกดอากาศสูง (> 1014 hPa) อากาศจะจมตัวทำให้เมฆสลายตัว ท้องฟ้าจึงใสโปร่งและอากาศเย็นสบาย ส่วนความกดอากาศต่ำอากาศจะลอยตัวสร้างเมฆครึ้มและฝน",
        },
        {
          head: "👁️ 2. ทัศนวิสัย (Visibility) กับความใสของท้องฟ้า",
          body: "วันที่ลมระบายอากาศดีและฝุ่น PM2.5 ต่ำ ทัศนวิสัยจะไกลถึง 15–20 กม. ทำให้มองเห็นยอดดอยหรือเส้นขอบฟ้าทะเลได้ชัดเจน เหมาะแก่การถ่ายภาพและชมวิว",
        },
        {
          head: "💧 3. ความชื้นสัมพัทธ์กับความสบายตัว",
          body: "ช่วงความชื้น 50–65% ร่างกายจะรู้สึกโปร่งสบายที่สุด ไม่เหนียวเหนอะหนะและผิวไม่แห้งตึงจนเกินไป",
        },
      ],
    };
  }
  if (topic === "tide") {
    return {
      title: "🔬 ความรู้เข้าใจง่าย: น้ำทะเลหนุน น้ำเกิด–น้ำตาย และทะเลแหวก",
      subtitle: "ระดับน้ำขึ้น–น้ำลงส่งผลต่อทั้งการระบายน้ำปากแม่น้ำและการท่องเที่ยวชายหาดอย่างไร?",
      cards: [
        {
          head: "🌕 1. น้ำเกิด (Spring Tide) และ น้ำตาย (Neap Tide)",
          body: "ช่วงวันเพ็ญขึ้น 15 ค่ำ และแรม 15 ค่ำ แรงดึงดูดดวงจันทร์และดวงอาทิตย์เสริมกัน ทำให้ระดับน้ำทะเลขึ้นสูงสุดและลงต่ำสุดมากกว่าปกติ เรียกว่า “น้ำเกิด”",
        },
        {
          head: "🌊 2. น้ำทะเลหนุนปากแม่น้ำอ่าวไทย vs อันดามัน",
          body: "อ่าวไทยตอนบนเมื่อน้ำหนุนเกิน +1.40 ม. รทก. จะดันน้ำในแม่น้ำให้ไหลช้าลง ส่วนฝั่งอันดามัน (ภูเก็ต–กระบี่–พังงา) มีพิสัยน้ำขึ้นลงกว้างถึง 1.8–2.5 เมตร",
        },
        {
          head: "🏖️ 3. เช็กเวลาน้ำลงเที่ยว “ทะเลแหวก” และเดินชายหาด",
          body: "การรู้เวลาน้ำลงต่ำสุดช่วยให้วางแผนเที่ยวสันทรายทะเลแหวก ชมปะการังน้ำตื้น หรือเดินเล่นชายหาดกว้างๆ ได้ถูกจังหวะเวลา",
        },
      ],
    };
  }
  if (topic === "wave") {
    return {
      title: "🔬 ความรู้เข้าใจง่าย: คลื่นลมทะเลอ่าวไทย & อันดามัน และการเดินเรือปลอดภัย",
      subtitle: "ทำไมฤดูเที่ยวทะเลอ่าวไทยและอันดามันถึงสลับช่วงกันตามทิศทางลมมรสุม?",
      cards: [
        {
          head: "⛵ 1. ความสูงคลื่นมีนัยสำคัญ (Significant Wave Height)",
          body: "คลื่น < 0.8 ม. ทะเลเรียบสงบเหมาะดำน้ำและล่องเรือทุกชนิด, คลื่น 1.0–1.3 ม. เรือเล็กควรระมัดระวัง และหากคลื่น > 1.5–2.0 ม. เรือเล็กควรงดออกจากฝั่ง",
        },
        {
          head: "🧭 2. ฤดูกาลคลื่นสงบ: อันดามัน vs อ่าวไทย",
          body: "ช่วง พ.ย.–เม.ย. ลมตะวันออกเฉียงเหนือถูกด้ามขวานบัง ทำให้ทะเลอันดามันและอ่าวไทยตะวันออกเรียบใส ส่วน พ.ค.–ต.ค. เกาะสมุย–พะงัน–เต่าในอ่าวไทยจะหลบลมตะวันตกได้ดี",
        },
        {
          head: "🏊 3. การสังเกตคลื่นซัดฝั่งและกระแสน้ำย้อนกลับ (Rip Current)",
          body: "เมื่อลมทะเลพัดแรงเข้าหาฝั่งโดยตรง ควรสังเกตธงสีแจ้งเตือนริมหาด เลือกเล่นน้ำในจุดที่มีเจ้าหน้าที่ดูแล และงดเล่นน้ำเมื่อมีธงแดง",
        },
      ],
    };
  }
  if (topic === "air") {
    return {
      title: "🔬 ความรู้เข้าใจง่าย: ฝุ่น PM2.5, ปรากฏการณ์ฝาชีครอบ และการระบายอากาศ",
      subtitle: "ทำไมค่าฝุ่นมักสะสมช่วงเช้ามืดที่ลมสงบ และจางหายไปเมื่อมีลมแรงหรือฝนตก?",
      cards: [
        {
          head: "🫧 1. เกณฑ์มาตรฐาน PM2.5 ของประเทศไทย",
          body: "ค่าเฉลี่ย 24 ชั่วโมงไม่เกิน 37.5 µg/m³ จัดอยู่ในเกณฑ์ปลอดภัย (สีฟ้า ≤ 15 ดีมาก, สีเขียว 15.1–25 ดี, สีเหลือง 25.1–37.5 ปานกลาง, สีส้ม > 37.5 เริ่มมีผลต่อสุขภาพ)",
        },
        {
          head: "🍲 2. ปรากฏการณ์ฝาชีครอบ (Temperature Inversion)",
          body: "คืนที่ฟ้าโปร่งลมสงบ พื้นดินคายความร้อนเร็วทำให้อากาศเย็นใกล้พื้นถูกอากาศอุ่นด้านบนกดทับไว้คล้ายฝาชีครอบ ฝุ่นจึงสะสมตัวจนกว่าแดดสายๆ จะเผาให้ลอยตัวขึ้น",
        },
        {
          head: "🌬️ 3. ลมทะเลและป่าเขาช่วยฟอกอากาศ",
          body: "พื้นที่ชายฝั่งทะเลภาคใต้ ภาคตะวันออก และผืนป่าเขาใหญ่–คีรีวง มีกระแสลมช่วยพัดระบายอากาศตลอดวัน ทำให้ค่า PM2.5 ต่ำและอากาศบริสุทธิ์",
        },
      ],
    };
  }
  if (topic === "heat") {
    return {
      title: "🔬 ความรู้เข้าใจง่าย: ดัชนีความร้อน (RealFeel) และรังสียูวี (UV Index)",
      subtitle: "ทำไมอุณหภูมิวัดได้ 33°C แต่ร่างกายกลับรู้สึกร้อนเหมือน 39°C?",
      cards: [
        {
          head: "🌡️ 1. ความชื้นสัมพัทธ์กับกลไกระบายเหงื่อ",
          body: "เมื่อความชื้นในอากาศสูงเกิน 65–75% เหงื่อบนผิวหนังจะระเหยได้ช้าลงมาก ทำให้ความร้อนสะสมในร่างกายสูงกว่าตัวเลขบนเทอร์โมมิเตอร์ 4–7°C",
        },
        {
          head: "🚨 2. การป้องกันโรคลมแดด (Heatstroke)",
          body: "เมื่อค่า RealFeel แตะ 38°C ขึ้นไป ควรจิบน้ำเปล่าทุกชั่วโมง พักในที่ร่มมีลมโกรกเป็นระยะ และสวมเสื้อผ้าสีอ่อนระบายอากาศดี",
        },
        {
          head: "☀️ 3. รังสี UV ในเขตร้อนของประเทศไทย",
          body: "ประเทศไทยมีค่า UV Index ช่วง 11:00–14:00 น. สูงระดับ 8–11 แนะนำทาครีมกันแดด SPF 50+ สวมแว่นกันแดดและหมวกเมื่อทำกิจกรรมกลางแจ้ง",
        },
      ],
    };
  }
  if (topic === "winter") {
    return {
      title: "🔬 ความรู้เข้าใจง่าย: มวลอากาศเย็น ยอดดอย และกลไกการเกิดทะเลหมอก",
      subtitle: "เช็กอย่างไรว่าพรุ่งนี้เช้าบนดอยหรือริมโขงจะมีทะเลหมอกสวยงาม?",
      cards: [
        {
          head: "☁️ 1. สูตรลับการเกิดทะเลหมอกยามเช้า",
          body: "ทะเลหมอกเกิดได้ดีที่สุดเมื่อมีความชื้นหลังฝนตกหรือใกล้แหล่งน้ำ + อุณหภูมิเช้ามืดลดต่ำลงต่ำกว่า 19–21°C + ลมสงบ (ไม่เกิน 15 กม./ชม.) ทำให้ไอน้ำกลั่นตัวลอยค้างในหุบเขา",
        },
        {
          head: "🏔️ 2. ยิ่งสูงยิ่งหนาว (Lapse Rate 6.5°C ต่อ 1,000 เมตร)",
          body: "ทุกความสูงที่เพิ่มขึ้น 1,000 เมตร อุณหภูมิจะลดลงประมาณ 6.5°C ดังนั้นเมื่อตัวเมืองเชียงใหม่ 18°C ยอดดอยอินทนนท์ (สูง 2,565 ม.) จึงหนาวลงไปถึง 5–8°C",
        },
        {
          head: "🧭 3. ลมมรสุมตะวันออกเฉียงเหนือ (ลมหนาว)",
          body: "แผ่ลงมาจากบริเวณความกดอากาศสูงประเทศจีน พัดผ่านภาคอีสานและภาคเหนือก่อนลงสู่ภาคกลาง ทำให้อากาศเย็นและแห้งสบาย",
        },
      ],
    };
  }
  if (topic === "tourism" || topic === "suitable") {
    return {
      title: "🔬 ความรู้เข้าใจง่าย: ดัชนีการท่องเที่ยวและพื้นที่เหมาะสมอัจฉริยะ (Smart Suitability Index)",
      subtitle: "ระบบฟ้าใสคำนวณคะแนนความน่าเที่ยวและคัดเลือกพื้นที่เหมาะสมจากอะไร?",
      cards: [
        {
          head: "🎯 1. การผสานข้อมูล 5 มิติแบบเรียลไทม์",
          body: "คำนวณจาก โอกาสเกิดฝน (30%) + คุณภาพอากาศ PM2.5 (25%) + ความสบายทางอุณหภูมิ/ลมหนาว (20%) + ความปลอดภัยคลื่นลมทะเล (15%) + ทัศนวิสัยและแสงแดด (10%)",
        },
        {
          head: "🏖️ 2. เลือกที่เที่ยวให้ตรงกับสภาพอากาศวันนั้น",
          body: "วันที่ยอดดอยภาคเหนืออากาศเย็นและลมสงบ ระบบจะแนะนำชมทะเลหมอกและแคมป์ปิ้ง ส่วนวันที่ทะเลอันดามันหรืออ่าวไทยคลื่นต่ำกว่า 0.8 ม. จะแนะนำดำน้ำดูปะการัง",
        },
        {
          head: "👕 3. ตัวช่วยวางแผนชีวิตประจำวันครบวงจร",
          body: "นอกจากท่องเที่ยวแล้วยังแปลงข้อมูลอุตุนิยมวิทยาเป็นคะแนนซักตากผ้า วิ่งออกกำลังกาย ล้างรถ กางเต็นท์ดูดาว และผลิตไฟโซลาร์เซลล์ที่เข้าใจได้ในพริบตา",
        },
      ],
    };
  }
  return {
    title: "🔬 ความรู้เข้าใจง่าย: ระบบเฝ้าระวังพื้นที่เสี่ยงภัยหลายมิติ (Multi-Hazard Surveillance)",
    subtitle: "การสังเคราะห์ความเสี่ยงทั้งฝน น้ำทะเลหนุน คลื่นลม ฝุ่น และความร้อนในแผนที่เดียว",
    cards: [
      {
        head: "⚠️ 1. มาตรฐานสีความเสี่ยง 5 ระดับเข้าใจง่าย",
        body: "ระดับ 1 (เขียว) ปลอดภัย, ระดับ 2 (ฟ้า) ปกติ, ระดับ 3 (เหลือง) เฝ้าระวัง, ระดับ 4 (ส้ม) เตือนภัยเตรียมพร้อม และระดับ 5 (แดง) ความเสี่ยงสูงมากควรหลีกเลี่ยงพื้นที่เสี่ยง",
      },
      {
        head: "🌊 2. ความเสี่ยงร่วม (Compound Risk): ฝนตกหนัก + น้ำทะเลหนุน",
        body: "ในพื้นที่ชายฝั่งและกรุงเทพฯ หากเกิดฝนตกหนักตรงกับจังหวะน้ำทะเลหนุนสูง (+1.40 ม. รทก. ขึ้นไป) การระบายน้ำจะช้ากว่าปกติ ระบบจึงยกระดับการแจ้งเตือนล่วงหน้า",
      },
      {
        head: "🛡️ 3. ข้อมูลเพื่อการวางแผนล่วงหน้าของประชาชน",
        body: "ช่วยให้ประชาชนตรวจสอบพื้นที่เสี่ยงก่อนออกเดินทางต่างจังหวัด เลือกเส้นทางที่ปลอดภัย และติดตามประกาศเตือนภัยจากกรมอุตุนิยมวิทยาได้อย่างทันท่วงที",
      },
    ],
  };
}

// ============================================================================
// NATIONWIDE THAILAND GEOREFERENCED PROJECTION (WGS84: 5.5°N–20.6°N, 97.2°E–105.8°E)
// ============================================================================
export const THAILAND_MAP_FRAME = {
  x: 24,
  y: 20,
  width: 472,
  height: 700,
};

export interface MapBBox {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
  label: string;
}

export const REGION_BBOXES: Record<RegionId, MapBBox> = {
  all: { minLng: 97.1, maxLng: 105.9, minLat: 5.5, maxLat: 20.6, label: "ทั่วประเทศไทย (5.5°N–20.6°N, 97.1°E–105.9°E)" },
  north: { minLng: 97.3, maxLng: 101.6, minLat: 17.0, maxLat: 20.6, label: "ภาคเหนือ (17.0°N–20.6°N)" },
  northeast: { minLng: 101.0, maxLng: 105.8, minLat: 14.0, maxLat: 18.6, label: "ภาคตะวันออกเฉียงเหนือ (14.0°N–18.6°N)" },
  central: { minLng: 99.4, maxLng: 101.6, minLat: 13.2, maxLat: 16.8, label: "ภาคกลาง & กรุงเทพฯ–ปริมณฑล (13.2°N–16.8°N)" },
  east: { minLng: 100.5, maxLng: 103.0, minLat: 11.8, maxLat: 14.0, label: "ภาคตะวันออก & ชายฝั่งอ่าวไทย (11.8°N–14.0°N)" },
  west: { minLng: 98.8, maxLng: 100.4, minLat: 11.5, maxLat: 15.2, label: "ภาคตะวันตก & หัวหิน (11.5°N–15.2°N)" },
  "south-gulf": { minLng: 99.0, maxLng: 102.2, minLat: 6.2, maxLat: 11.2, label: "ภาคใต้ฝั่งอ่าวไทย (6.2°N–11.2°N)" },
  "south-andaman": { minLng: 97.6, maxLng: 100.2, minLat: 6.4, maxLat: 9.8, label: "ภาคใต้ฝั่งอันดามัน (6.4°N–9.8°N)" },
};

export function projectThailandGeo(
  lat: number,
  lng: number,
  bbox: MapBBox = REGION_BBOXES.all
): { x: number; y: number } {
  const xRatio = (lng - bbox.minLng) / (bbox.maxLng - bbox.minLng);
  const yRatio = (lat - bbox.minLat) / (bbox.maxLat - bbox.minLat);
  const x = THAILAND_MAP_FRAME.x + xRatio * THAILAND_MAP_FRAME.width;
  const y = THAILAND_MAP_FRAME.y + THAILAND_MAP_FRAME.height - yRatio * THAILAND_MAP_FRAME.height;
  return {
    x: Math.max(THAILAND_MAP_FRAME.x + 12, Math.min(THAILAND_MAP_FRAME.x + THAILAND_MAP_FRAME.width - 12, x)),
    y: Math.max(THAILAND_MAP_FRAME.y + 12, Math.min(THAILAND_MAP_FRAME.y + THAILAND_MAP_FRAME.height - 12, y)),
  };
}

// Keep legacy export name working for any external caller
export const projectFahSaiGeo = projectThailandGeo;

export function projectThailandPolyline(coords: [number, number][], bbox: MapBBox = REGION_BBOXES.all): string {
  return coords
    .map(([lat, lng], idx) => {
      const pt = projectThailandGeo(lat, lng, bbox);
      return `${idx === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(" ");
}

// Simplified accurate WGS84 silhouette outline of Thailand for crisp vector rendering over satellite/dark basemaps
export const THAILAND_BORDER_WGS84: [number, number][] = [
  [20.42, 99.88], [20.15, 100.45], [19.55, 101.15], [18.78, 101.18],
  [17.85, 101.42], [17.92, 102.62], [18.35, 103.65], [17.40, 104.78],
  [16.10, 105.05], [15.25, 105.58], [14.42, 105.12], [14.32, 103.10],
  [13.65, 102.58], [12.15, 102.78], [11.75, 102.90], [12.55, 101.55],
  [12.68, 100.90], [13.52, 100.85], [13.59, 100.58], [13.42, 100.02],
  [12.55, 99.96], [11.20, 99.55], [10.05, 99.18], [9.35, 99.95],
  [8.42, 100.02], [7.20, 100.62], [6.22, 102.05], [5.75, 101.15],
  [6.52, 100.08], [7.55, 99.32], [8.10, 98.88], [7.85, 98.35],
  [8.55, 98.24], [9.95, 98.60], [10.85, 98.95], [11.85, 99.62],
  [12.85, 99.45], [13.85, 99.05], [15.25, 98.35], [16.65, 98.52],
  [17.85, 97.72], [18.85, 97.68], [19.65, 98.15], [20.42, 99.88],
];

// Calibrated non-overlapping label offsets for all 24 Thailand destinations
export const THAILAND_LABEL_OFFSETS: Record<string, { dx: number; dy: number; shortName: string }> = {
  "mae-hong-son": { dx: -52, dy: -12, shortName: "แม่ฮ่องสอน" },
  "chiang-rai": { dx: 48, dy: -16, shortName: "เชียงราย" },
  "chiang-mai": { dx: -52, dy: 14, shortName: "เชียงใหม่" },
  nan: { dx: 48, dy: -8, shortName: "น่าน" },
  loei: { dx: -48, dy: -16, shortName: "เลย·เชียงคาน" },
  phetchabun: { dx: -56, dy: 8, shortName: "เพชรบูรณ์·เขาค้อ" },
  "khon-kaen": { dx: 52, dy: -14, shortName: "ขอนแก่น" },
  "nakhon-ratchasima": { dx: 56, dy: -10, shortName: "โคราช·เขาใหญ่" },
  "ubon-ratchathani": { dx: 52, dy: 12, shortName: "อุบลราชธานี" },
  ayutthaya: { dx: -56, dy: -22, shortName: "อยุธยา" },
  nonthaburi: { dx: 58, dy: -22, shortName: "นนทบุรี·ปทุม" },
  bangkok: { dx: 64, dy: -2, shortName: "กรุงเทพฯ" },
  "samut-prakan": { dx: -60, dy: 20, shortName: "สมุทรปราการ" },
  kanchanaburi: { dx: -56, dy: -4, shortName: "กาญจนบุรี" },
  chonburi: { dx: 58, dy: 14, shortName: "ชลบุรี·พัทยา" },
  rayong: { dx: 58, dy: 28, shortName: "ระยอง·เสม็ด" },
  trat: { dx: 56, dy: 16, shortName: "ตราด·เกาะกูด" },
  prachuap: { dx: -56, dy: 6, shortName: "หัวหิน·ประจวบ" },
  "surat-thani": { dx: 58, dy: -12, shortName: "สุราษฎร์·สมุย" },
  "nakhon-si": { dx: 60, dy: 8, shortName: "นครศรีฯ·คีรีวง" },
  songkhla: { dx: 56, dy: 14, shortName: "สงขลา·หาดใหญ่" },
  "phang-nga": { dx: -56, dy: -18, shortName: "พังงา·สิมิลัน" },
  krabi: { dx: 56, dy: 24, shortName: "กระบี่·พีพี" },
  phuket: { dx: -52, dy: 18, shortName: "ภูเก็ต" },
};
