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

export function getRainLikelihood(probability: number | null | undefined): RainLikelihood {
  if (probability === null || probability === undefined) return { label: "รอข้อมูล", color: "#94a3b8" };
  if (probability < 20) return { label: "น้อย", color: "#64748b" };
  if (probability < 40) return { label: "มีโอกาส", color: "#0284c7" };
  if (probability < 60) return { label: "ค่อนข้างสูง", color: "#0ea5e9" };
  if (probability < 80) return { label: "สูง", color: "#2563eb" };
  return { label: "สูงมาก", color: "#6d28d9" };
}

export function formatProbabilityContext(probability: number | null | undefined, leadDay: number) {
  if (probability === null || probability === undefined) return "รอข้อมูลแบบจำลอง";
  const rounded = Math.round(probability);
  if (leadDay >= 2) {
    const lower = Math.min(80, Math.floor(rounded / 20) * 20);
    const upper = lower === 80 ? 100 : lower + 19;
    return `ช่วงแบบจำลอง ${lower}–${upper}%`;
  }
  return `ค่าสูงสุดของแบบจำลอง ${rounded}%`;
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
  if (!day || day.dailyPeakAreaMeanProbability === null || day.rainMeanMm === null) return "กำลังประมวลผลแนวโน้มฝน";
  const probability = day.dailyPeakAreaMeanProbability;
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
  if (!day || day.dailyPeakAreaMeanProbability === null) {
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
  const maxMm = day.rainMaxMm ?? meanMm;
  const wetHours = day.wetHours ?? 0;
  const likelihood = getRainLikelihood(day.dailyPeakAreaMeanProbability).label;
  const intensity = getRainIntensity(day.rainMeanMm, day.rainMaxMm);
  const floodWatch = meanMm >= 35 || maxMm >= 70 || (maxMm >= 50 && wetHours >= 6);
  const heavyLocalized = meanMm >= 10 || maxMm >= 35 || (peakWindowMeanRainMm ?? 0) >= 10;
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
  if (day.dailyPeakAreaMeanProbability >= 60) {
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
    icon: day.dailyPeakAreaMeanProbability >= 25 ? "⛅" : "☀️",
    risk: "ผลกระทบต่ำ",
    riskColor: "#10b981",
    likelihood,
    intensity,
    impact: "ต่ำ",
  };
}
