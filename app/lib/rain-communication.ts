import type { RainDay } from "./rain-forecast-data";

export type RainLikelihood = {
  label: "รอข้อมูล" | "น้อย" | "มีโอกาส" | "ค่อนข้างสูง" | "สูง" | "สูงมาก";
  color: string;
};

export type RainAdvisory = {
  title: string;
  desc: string;
  icon: string;
  risk: string;
  riskColor: string;
  likelihood: string;
  intensity: string;
  impact: string;
};

export type RainWatchLevel = {
  key: "unavailable" | "dry" | "light" | "moderate" | "heavy" | "very-heavy";
  label: string;
  rainClass: string;
  color: string;
  rank: number;
  guidance: string;
};

/**
 * Planning tier derived from a spatial mean plus a locally corroborated high value.
 * Thresholds follow TMD's 24-hour rain-amount classes, while the labels remain
 * explicitly planning-oriented and are not an official warning product.
 */
export function getRainWatchLevel(meanMm: number | null | undefined, corroboratedMm: number | null | undefined): RainWatchLevel {
  const value = corroboratedMm ?? meanMm;
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { key: "unavailable", label: "รอข้อมูล", rainClass: "ไม่มีข้อมูล", color: "#64748b", rank: -1, guidance: "ยังประเมินระดับเฝ้าระวังไม่ได้" };
  }
  if (value < 0.1) {
    return { key: "dry", label: "ปกติ", rainClass: "ไม่มีฝน", color: "#0f766e", rank: 0, guidance: "ยังไม่พบฝนสะสมจากจุดแบบจำลอง" };
  }
  if (value <= 10) {
    return { key: "light", label: "ติดตามทั่วไป", rainClass: "ฝนเล็กน้อย", color: "#0284c7", rank: 1, guidance: "ตรวจเรดาร์ใกล้เวลาเมื่อมีกิจกรรมกลางแจ้ง" };
  }
  if (value <= 35) {
    return { key: "moderate", label: "ติดตาม", rainClass: "ฝนปานกลาง", color: "#2563eb", rank: 2, guidance: "ติดตามช่วงเวลาที่ฝนเด่นและเผื่อเวลาเดินทาง" };
  }
  if (value <= 90) {
    return { key: "heavy", label: "เฝ้าระวัง", rainClass: "ฝนหนัก", color: "#c2410c", rank: 3, guidance: "ติดตามฝนสะสม เรดาร์ และประกาศทางการอย่างใกล้ชิด" };
  }
  return { key: "very-heavy", label: "เฝ้าระวังสูง", rainClass: "ฝนหนักมาก", color: "#b91c1c", rank: 4, guidance: "เตรียมแผนเดินทางสำรองและติดตามประกาศทางการ" };
}

export function getRainLikelihood(probability: number | null | undefined): RainLikelihood {
  if (probability === null || probability === undefined) return { label: "รอข้อมูล", color: "#94a3b8" };
  if (probability < 20) return { label: "น้อย", color: "#64748b" };
  if (probability < 40) return { label: "มีโอกาส", color: "#0284c7" };
  if (probability < 60) return { label: "ค่อนข้างสูง", color: "#0ea5e9" };
  if (probability < 80) return { label: "สูง", color: "#2563eb" };
  return { label: "สูงมาก", color: "#6d28d9" };
}

export function formatProbabilityContext(probability: number | null | undefined, scope: "daily" | "window" = "window") {
  if (probability === null || probability === undefined) return "รอข้อมูลแบบจำลอง";
  const rounded = Math.round(probability);
  return scope === "daily"
    ? `โอกาสเกิดฝนช่วงใดช่วงหนึ่ง เฉลี่ยจากจุดแบบจำลอง ${rounded}%`
    : `เฉลี่ยจากจุดแบบจำลองของค่าสูงสุดในช่วง ${rounded}%`;
}

export function getRainIntensity(meanMm: number | null | undefined, maxMm: number | null | undefined) {
  if (meanMm === null || meanMm === undefined) return "รอข้อมูล";
  const maximum = maxMm ?? meanMm;
  if (meanMm < 0.1 && maximum < 0.5) return "แทบไม่มีฝน";
  if (meanMm < 2.5 && maximum < 10) return "เล็กน้อย";
  if (meanMm < 10 && maximum < 35) return "ปานกลาง";
  if (meanMm < 35 && maximum < 70) return "มากบางจุด";
  return "สูงมากบางจุด";
}

export function getDailyRainNarrative(day: RainDay | null | undefined) {
  if (!day || day.dailyAreaMeanProbability === null || day.rainMeanMm === null) return "กำลังประมวลผลแนวโน้มฝน";
  const probability = day.dailyAreaMeanProbability;
  const meanMm = day.rainMeanMm;
  const wetHours = day.wetHours ?? 0;

  if (meanMm < 0.1 && wetHours < 0.5) return "แนวโน้มฝนน้อย";
  if (wetHours <= 1.5 && meanMm < 2.5) {
    return probability >= 60 ? "มีโอกาสเกิดฝนช่วงสั้นบางพื้นที่" : "อาจมีฝนเล็กน้อยบางพื้นที่";
  }
  if (meanMm < 5) {
    return probability >= 60 ? "ฝนมีแนวโน้มสูงบางพื้นที่" : "อาจมีฝนเป็นบางพื้นที่";
  }
  if (meanMm < 15) return "มีฝนเป็นช่วง ๆ หลายพื้นที่";
  return "มีฝนสะสมมากในบางพื้นที่";
}

export function getRainAdvisory(
  day: RainDay | null | undefined,
  peakWindowMeanRainMm: number | null | undefined,
  sampleWetCoveragePct: number | null | undefined,
): RainAdvisory {
  if (!day || day.dailyAreaMeanProbability === null) {
    return {
      title: "กำลังประมวลผลข้อมูล",
      desc: "ระบบกำลังรวบรวมข้อมูลพยากรณ์ฝนล่าสุดจากแบบจำลอง",
      icon: "ℹ️",
      risk: "รอข้อมูล",
      riskColor: "#64748b",
      likelihood: "รอข้อมูล",
      intensity: "รอข้อมูล",
      impact: "รอประเมิน",
    };
  }

  const meanMm = day.rainMeanMm ?? 0;
  const watchMm = day.rainWatchMm ?? meanMm;
  const wetHours = day.wetHours ?? 0;
  const likelihood = getRainLikelihood(day.dailyAreaMeanProbability).label;
  const intensity = getRainIntensity(day.rainMeanMm, day.rainMaxMm);
  const floodWatch = meanMm >= 35 || watchMm >= 70 || (watchMm >= 50 && wetHours >= 6);
  const heavyLocalized = meanMm >= 10 || watchMm >= 35 || (peakWindowMeanRainMm ?? 0) >= 10;
  const prolonged = meanMm >= 5 && wetHours >= 6;
  const coverage = sampleWetCoveragePct === null || sampleWetCoveragePct === undefined
    ? "บางพื้นที่"
    : sampleWetCoveragePct >= 70 ? "หลายจุดตัวอย่าง" : sampleWetCoveragePct >= 30 ? "บางจุดตัวอย่าง" : "ไม่กี่จุดตัวอย่าง";

  if (floodWatch) {
    return {
      title: "ติดตามฝนสะสมและน้ำท่วมขัง",
      desc: `แบบจำลองคาดปริมาณฝนสะสมสูงใน${coverage} ควรเผื่อเวลาเดินทางและติดตามประกาศทางการกับเรดาร์ล่าสุด`,
      icon: "⛈️",
      risk: "ติดตามผลกระทบ",
      riskColor: "#dc2626",
      likelihood,
      intensity,
      impact: "อาจมีน้ำท่วมขัง",
    };
  }
  if (heavyLocalized || prolonged) {
    return {
      title: prolonged ? "ฝนอาจเกิดเป็นเวลานาน" : "ระวังฝนแรงบางจุด",
      desc: `ปริมาณฝนและระยะเวลาสนับสนุนผลกระทบต่อการเดินทางใน${coverage} ควรตรวจเรดาร์ก่อนออกเดินทาง`,
      icon: "🌧️",
      risk: "เผื่อเวลาเดินทาง",
      riskColor: "#f59e0b",
      likelihood,
      intensity,
      impact: "กระทบการเดินทางบางช่วง",
    };
  }
  if (day.dailyAreaMeanProbability >= 60) {
    return {
      title: "แนวโน้มสูง แต่ปริมาณรวมยังไม่มาก",
      desc: `แบบจำลองเห็นสัญญาณฝนใน${coverage} แต่อาจตกช่วงสั้นหรือไม่ตรงตำแหน่งของคุณ ให้ใช้เรดาร์ตอบคำถามว่าฝนกำลังเข้าใกล้หรือไม่`,
      icon: "🌦️",
      risk: "พกร่มไว้ก่อน",
      riskColor: "#2563eb",
      likelihood,
      intensity,
      impact: "จำกัดเป็นบางช่วง",
    };
  }
  return {
    title: "ยังไม่พบสัญญาณผลกระทบเด่น",
    desc: "ปริมาณฝนที่คาดยังไม่สูง หากต้องทำกิจกรรมกลางแจ้งควรตรวจเรดาร์ใกล้เวลาอีกครั้ง",
    icon: day.dailyAreaMeanProbability >= 25 ? "⛅" : "☀️",
    risk: "ผลกระทบต่ำ",
    riskColor: "#10b981",
    likelihood,
    intensity,
    impact: "ต่ำ",
  };
}
