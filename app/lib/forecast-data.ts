export type ForecastStation = {
  id: string;
  district: string;
  label: string;
  lat: number;
  lng: number;
  values: number[];
  observed?: number;
  observedAt?: string;
  sourceType?: string;
};

export type ForecastDay = {
  lead: number;
  date: string;
  weekday: string;
  confidence: number;
  uncertainty: number;
  wind: string;
  weather: string;
  note: string;
  year?: number;
  sourceMode?: "cams" | "extrapolated" | "demo";
  coverageHours?: number;
};

export const issuedAt = "11 ส.ค. 2569 · 10:00 น.";

export const forecastDays: ForecastDay[] = [
  {
    lead: 1,
    date: "12 ส.ค.",
    weekday: "พุธ",
    confidence: 88,
    uncertainty: 5,
    wind: "ลมตะวันตกเฉียงใต้ 9–14 กม./ชม.",
    weather: "อากาศถ่ายเทปานกลาง",
    note: "ค่าฝุ่นสะสมช่วงเช้า ก่อนลมแรงขึ้นในช่วงบ่าย",
  },
  {
    lead: 2,
    date: "13 ส.ค.",
    weekday: "พฤหัส",
    confidence: 81,
    uncertainty: 7,
    wind: "ลมใต้ 6–10 กม./ชม.",
    weather: "ลมอ่อน ความชื้นสูง",
    note: "แนวโน้มสูงขึ้นในพื้นที่ชั้นในและตอนเหนือของกรุงเทพฯ",
  },
  {
    lead: 3,
    date: "14 ส.ค.",
    weekday: "ศุกร์",
    confidence: 73,
    uncertainty: 9,
    wind: "ลมแปรปรวน 4–8 กม./ชม.",
    weather: "การระบายอากาศต่ำ",
    note: "เป็นวันที่ควรเฝ้าระวังที่สุด โดยเฉพาะช่วง 06:00–10:00 น.",
  },
  {
    lead: 4,
    date: "15 ส.ค.",
    weekday: "เสาร์",
    confidence: 64,
    uncertainty: 12,
    wind: "ลมตะวันออกเฉียงใต้ 8–13 กม./ชม.",
    weather: "มีโอกาสเกิดฝนบางพื้นที่",
    note: "ความไม่แน่นอนเพิ่มขึ้น ผลฝนอาจทำให้ค่าจริงต่ำกว่าค่ากลาง",
  },
  {
    lead: 5,
    date: "16 ส.ค.",
    weekday: "อาทิตย์",
    confidence: 56,
    uncertainty: 15,
    wind: "ลมใต้ 10–16 กม./ชม.",
    weather: "อากาศถ่ายเทดีขึ้น",
    note: "ใช้เป็นแนวโน้มความเสี่ยง ควรติดตามการอัปเดตในรอบถัดไป",
  },
];

export const forecastStations: ForecastStation[] = [
  { id: "phra-nakhon", district: "พระนคร", label: "ศาลาว่าการ กทม.", lat: 13.7563, lng: 100.5018, values: [31, 38, 47, 40, 32] },
  { id: "bang-rak", district: "บางรัก", label: "บางรัก", lat: 13.7278, lng: 100.5241, values: [35, 43, 53, 45, 36] },
  { id: "pathum-wan", district: "ปทุมวัน", label: "ปทุมวัน", lat: 13.7466, lng: 100.5347, values: [38, 46, 57, 48, 39] },
  { id: "din-daeng", district: "ดินแดง", label: "ดินแดง", lat: 13.7697, lng: 100.5526, values: [42, 49, 61, 52, 42] },
  { id: "chatuchak", district: "จตุจักร", label: "จตุจักร", lat: 13.8286, lng: 100.5596, values: [39, 47, 58, 50, 40] },
  { id: "bang-khen", district: "บางเขน", label: "บางเขน", lat: 13.8737, lng: 100.5967, values: [36, 45, 55, 47, 38] },
  { id: "don-mueang", district: "ดอนเมือง", label: "ดอนเมือง", lat: 13.9133, lng: 100.5898, values: [34, 43, 54, 46, 37] },
  { id: "sai-mai", district: "สายไหม", label: "สายไหม", lat: 13.9192, lng: 100.6459, values: [33, 41, 51, 44, 35] },
  { id: "bueng-kum", district: "บึงกุ่ม", label: "บึงกุ่ม", lat: 13.7857, lng: 100.6696, values: [31, 39, 49, 42, 34] },
  { id: "min-buri", district: "มีนบุรี", label: "มีนบุรี", lat: 13.8133, lng: 100.7481, values: [29, 36, 45, 39, 31] },
  { id: "nong-chok", district: "หนองจอก", label: "หนองจอก", lat: 13.8557, lng: 100.8624, values: [25, 32, 40, 35, 28] },
  { id: "lat-krabang", district: "ลาดกระบัง", label: "ลาดกระบัง", lat: 13.7223, lng: 100.759, values: [28, 35, 44, 38, 30] },
  { id: "bang-na", district: "บางนา", label: "บางนา", lat: 13.6686, lng: 100.6111, values: [27, 34, 42, 36, 29] },
  { id: "khlong-toei", district: "คลองเตย", label: "คลองเตย", lat: 13.7078, lng: 100.5839, values: [37, 44, 55, 47, 38] },
  { id: "yan-nawa", district: "ยานนาวา", label: "ยานนาวา", lat: 13.6965, lng: 100.543, values: [34, 41, 51, 44, 35] },
  { id: "rat-burana", district: "ราษฎร์บูรณะ", label: "ราษฎร์บูรณะ", lat: 13.676, lng: 100.4986, values: [32, 40, 50, 43, 34] },
  { id: "thon-buri", district: "ธนบุรี", label: "ธนบุรี", lat: 13.721, lng: 100.4867, values: [33, 41, 52, 44, 35] },
  { id: "bang-khae", district: "บางแค", label: "บางแค", lat: 13.7085, lng: 100.4064, values: [30, 38, 48, 41, 33] },
  { id: "taling-chan", district: "ตลิ่งชัน", label: "ตลิ่งชัน", lat: 13.7769, lng: 100.4567, values: [29, 37, 46, 40, 32] },
];

export function getLevel(value: number) {
  if (value <= 15) return { label: "ดีมาก", color: "#38bdf8", className: "very-good" };
  if (value <= 25) return { label: "ดี", color: "#34d399", className: "good" };
  if (value <= 37.5) return { label: "ปานกลาง", color: "#facc15", className: "moderate" };
  if (value <= 75) return { label: "เริ่มมีผลกระทบ", color: "#fb923c", className: "unhealthy" };
  return { label: "มีผลกระทบ", color: "#f43f5e", className: "hazard" };
}
