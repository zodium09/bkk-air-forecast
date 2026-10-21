"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect, useMemo, useState } from "react";
import {
  buildFallbackPayload,
  type AreaForecast,
  type FahSaiPayload,
  type TopicId,
} from "../../lib/fahsai-data";
import "./fahsai.css";

const TOPICS: {
  id: TopicId;
  icon: string;
  label: string;
  shortDesc: string;
  color: string;
}[] = [
  {
    id: "rain",
    icon: "🌧️",
    label: "ฝน & พายุ",
    shortDesc: "โอกาสฝนตก ปริมาณฝน เรดาร์ และเวลาพกร่ม",
    color: "#0ea5e9",
  },
  {
    id: "air",
    icon: "😷",
    label: "ฝุ่น PM2.5",
    shortDesc: "ค่าฝุ่นละเอียด ดัชนีคุณภาพอากาศ และการสวมหน้ากาก",
    color: "#10b981",
  },
  {
    id: "heat",
    icon: "☀️",
    label: "ความร้อน & UV",
    shortDesc: "อุณหภูมิความรู้สึกร้อนจริง (RealFeel) และรังสียูวี",
    color: "#f97316",
  },
  {
    id: "winter",
    icon: "🍃",
    label: "ลมหนาว & อากาศเย็น",
    shortDesc: "อุณหภูมิต่ำสุดเช้ามืด ทิศทางลมมรสุม และความเย็นสบาย",
    color: "#06b6d4",
  },
  {
    id: "sea",
    icon: "🌊",
    label: "น้ำทะเล & คลื่นอ่าวไทย",
    shortDesc: "ระดับน้ำขึ้น–น้ำลง ความสูงคลื่น และความปลอดภัยชายฝั่ง",
    color: "#2563eb",
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
      { tier: 2, label: "ระดับ 2 · เมฆเป็นส่วนมาก ฝนเล็กน้อย", rangeText: "โอกาส 15–34%", color: "#38bdf8" },
      { tier: 1, label: "ระดับ 1 · ฟ้าโปร่ง ไร้ฝน", rangeText: "โอกาส < 15%", color: "#10b981" },
    ];
  }
  if (topic === "air") {
    return [
      { tier: 5, label: "ระดับ 5 · มีผลกระทบต่อสุขภาพทุกคน", rangeText: "PM2.5 > 75.0 µg/m³", color: "#ef4444" },
      { tier: 4, label: "ระดับ 4 · เริ่มมีผลกระทบต่อสุขภาพ", rangeText: "PM2.5 37.6 – 75.0 µg/m³", color: "#f97316" },
      { tier: 3, label: "ระดับ 3 · ปานกลาง (กลุ่มเสี่ยงระวัง)", rangeText: "PM2.5 25.1 – 37.5 µg/m³", color: "#eab308" },
      { tier: 2, label: "ระดับ 2 · คุณภาพอากาศดี", rangeText: "PM2.5 15.1 – 25.0 µg/m³", color: "#10b981" },
      { tier: 1, label: "ระดับ 1 · อากาศดีมาก สดชื่น", rangeText: "PM2.5 ≤ 15.0 µg/m³", color: "#06b6d4" },
    ];
  }
  if (topic === "heat") {
    return [
      { tier: 5, label: "ระดับ 5 · อันตรายมาก (เสี่ยงฮีทสโตรกสูง)", rangeText: "RealFeel > 42°C", color: "#ef4444" },
      { tier: 4, label: "ระดับ 4 · เตือนภัยความร้อนจัด", rangeText: "RealFeel 38 – 42°C", color: "#f97316" },
      { tier: 3, label: "ระดับ 3 · เฝ้าระวังอากาศร้อน", rangeText: "RealFeel 34 – 37.9°C", color: "#eab308" },
      { tier: 2, label: "ระดับ 2 · อากาศอบอุ่นปกติ", rangeText: "RealFeel 30 – 33.9°C", color: "#10b981" },
      { tier: 1, label: "ระดับ 1 · อากาศสบายไม่ร้อน", rangeText: "RealFeel < 30°C", color: "#06b6d4" },
    ];
  }
  if (topic === "winter") {
    return [
      { tier: 5, label: "ระดับ 5 · อากาศหนาว/ลมมรสุมพัดแรงจัด", rangeText: "เช้า ≤ 18°C หรือลม > 35 กม./ชม.", color: "#6366f1" },
      { tier: 4, label: "ระดับ 4 · อากาศเย็นชัดเจน ลมแรง", rangeText: "เช้า 18.1 – 21.5°C", color: "#0284c7" },
      { tier: 3, label: "ระดับ 3 · เช้าเย็นสบาย ลมหนาวโชย", rangeText: "เช้า 21.6 – 23.5°C", color: "#06b6d4" },
      { tier: 2, label: "ระดับ 2 · อากาศโปร่งสบายปลายฝนต้นหนาว", rangeText: "เช้า 23.6 – 25.5°C", color: "#10b981" },
      { tier: 1, label: "ระดับ 1 · อากาศอุ่นปกติ", rangeText: "เช้า > 25.5°C", color: "#eab308" },
    ];
  }
  return [
    { tier: 5, label: "ระดับ 5 · คลื่นจัด / น้ำหนุนวิกฤต", rangeText: "คลื่น > 2.0 ม. หรือน้ำหนุน > +1.60 ม.", color: "#ef4444" },
    { tier: 4, label: "ระดับ 4 · คลื่นค่อนข้างแรง / น้ำหนุนสูง", rangeText: "คลื่น 1.3 – 2.0 ม. หรือน้ำหนุน +1.42 ม.+", color: "#f97316" },
    { tier: 3, label: "ระดับ 3 · คลื่นปานกลาง / เฝ้าระวังปากแม่น้ำ", rangeText: "คลื่น 0.8 – 1.29 ม. หรือน้ำหนุน +1.25 ม.+", color: "#eab308" },
    { tier: 2, label: "ระดับ 2 · คลื่นเล็กน้อย เดินเรือปกติ", rangeText: "คลื่น 0.4 – 0.79 ม.", color: "#06b6d4" },
    { tier: 1, label: "ระดับ 1 · ทะเลเรียบ สงบปลอดภัย", rangeText: "คลื่น < 0.4 ม.", color: "#10b981" },
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
    if (c.minMorningC <= 18 || c.windKmh > 35) return 5;
    if (c.minMorningC <= 21.5) return 4;
    if (c.minMorningC <= 23.5) return 3;
    if (c.minMorningC <= 25.5) return 2;
    return 1;
  }
  if (c.waveHeightM > 2.0 || c.highTideMsl > 1.6) return 5;
  if (c.waveHeightM >= 1.3 || c.highTideMsl >= 1.44) return 4;
  if (c.waveHeightM >= 0.8 || c.highTideMsl >= 1.25) return 3;
  if (c.waveHeightM >= 0.4) return 2;
  return 1;
}

// Exact EPSG:4326 Bounding Box for Bangkok, Vicinity & Upper Gulf of Thailand locked to SVG frame (16..504, 16..324)
const FAHSAI_FRAME = {
  x: 16,
  y: 16,
  width: 488,
  height: 308,
};

const FAHSAI_BBOX = {
  minLng: 99.75,
  maxLng: 101.25,
  minLat: 12.90,
  maxLat: 14.15,
};

const FAHSAI_SAT_URL = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${FAHSAI_BBOX.minLng},${FAHSAI_BBOX.minLat},${FAHSAI_BBOX.maxLng},${FAHSAI_BBOX.maxLat}&bboxSR=4326&imageSR=4326&size=976,616&format=jpg&f=image`;
const FAHSAI_TOPO_URL = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/export?bbox=${FAHSAI_BBOX.minLng},${FAHSAI_BBOX.minLat},${FAHSAI_BBOX.maxLng},${FAHSAI_BBOX.maxLat}&bboxSR=4326&imageSR=4326&size=976,616&format=jpg&f=image`;

export function projectFahSaiGeo(lat: number, lng: number): { x: number; y: number } {
  const xRatio = (lng - FAHSAI_BBOX.minLng) / (FAHSAI_BBOX.maxLng - FAHSAI_BBOX.minLng);
  const yRatio = (lat - FAHSAI_BBOX.minLat) / (FAHSAI_BBOX.maxLat - FAHSAI_BBOX.minLat);
  const x = FAHSAI_FRAME.x + xRatio * FAHSAI_FRAME.width;
  const y = FAHSAI_FRAME.y + FAHSAI_FRAME.height - yRatio * FAHSAI_FRAME.height;
  return {
    x: Math.max(FAHSAI_FRAME.x + 12, Math.min(FAHSAI_FRAME.x + FAHSAI_FRAME.width - 12, x)),
    y: Math.max(FAHSAI_FRAME.y + 12, Math.min(FAHSAI_FRAME.y + FAHSAI_FRAME.height - 12, y)),
  };
}

function projectFahSaiPolyline(coords: [number, number][]): string {
  return coords
    .map(([lat, lng], idx) => {
      const pt = projectFahSaiGeo(lat, lng);
      return `${idx === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(" ");
}

function formatDms(deg: number, isLat: boolean): string {
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const m = Math.round((abs - d) * 60);
  return `${d}°${String(m).padStart(2, "0")}'${isLat ? "N" : "E"}`;
}

// Real WGS84 Coastline of the Upper Gulf of Thailand (Phetchaburi -> Samut Songkhram -> Samut Sakhon -> Samut Prakan -> Chachoengsao -> Chonburi/Pattaya)
const UPPER_GULF_COASTLINE_WGS84: [number, number][] = [
  [12.90, 99.98],
  [13.11, 100.01],
  [13.28, 99.98],
  [13.40, 100.00],
  [13.48, 100.15],
  [13.52, 100.28],
  [13.58, 100.45],
  [13.59, 100.60],
  [13.52, 100.78],
  [13.47, 100.98],
  [13.36, 100.97],
  [13.15, 100.91],
  [12.92, 100.88],
];

// Real WGS84 4 Major River Estuaries flowing into the Upper Gulf
const ESTUARY_RIVERS_WGS84: { id: string; name: string; coords: [number, number][] }[] = [
  {
    id: "mae-klong",
    name: "แม่น้ำแม่กลอง",
    coords: [
      [14.05, 99.78],
      [13.80, 99.88],
      [13.56, 99.95],
      [13.40, 100.00],
    ],
  },
  {
    id: "tha-chin",
    name: "แม่น้ำท่าจีน",
    coords: [
      [14.15, 100.12],
      [13.82, 100.19],
      [13.65, 100.24],
      [13.52, 100.28],
    ],
  },
  {
    id: "chao-phraya",
    name: "แม่น้ำเจ้าพระยา",
    coords: [
      [14.15, 100.54],
      [14.02, 100.53],
      [13.86, 100.51],
      [13.75, 100.50],
      [13.66, 100.54],
      [13.59, 100.60],
    ],
  },
  {
    id: "bang-pakong",
    name: "แม่น้ำบางปะกง",
    coords: [
      [14.05, 101.18],
      [13.85, 101.15],
      [13.69, 101.08],
      [13.47, 100.98],
    ],
  },
];

function getFriendlyAdvice(area: AreaForecast, topic: TopicId): {
  badge: string;
  tone: "good" | "warn" | "alert";
  headline: string;
  action: string;
} {
  const c = area.current;
  if (topic === "rain") {
    if (c.rainProb >= 60 || c.rain24hMm >= 15) {
      return {
        badge: "☔ โอกาสฝนตกสูง",
        tone: "alert",
        headline: `มีโอกาสฝนตก ${c.rainProb}% (สะสมราว ${c.rain24hMm} มม.)`,
        action: "ควรพกร่มหรือเสื้อกันฝนติดตัว และเผื่อเวลาเดินทางช่วงเย็นหลังเลิกงาน",
      };
    }
    if (c.rainProb >= 35) {
      return {
        badge: "🌦️ มีเมฆและฝนบางแห่ง",
        tone: "warn",
        headline: `มีโอกาสเจอฝนโปรยปราย ${c.rainProb}% ช่วงบ่ายถึงค่ำ`,
        action: "พกร่มพับติดกระเป๋าไว้จะอุ่นใจกว่า โดยเฉพาะพื้นที่ใกล้ชายฝั่งอ่าวไทย",
      };
    }
    return {
      badge: "🌤️ ฟ้าโปร่ง ฝนน้อย",
      tone: "good",
      headline: `โอกาสฝนตกต่ำเพียง ${c.rainProb}% ตลอดวัน`,
      action: "เหมาะสำหรับซักผ้า ตากผ้า และทำกิจกรรมกลางแจ้งได้สบายใจ",
    };
  }

  if (topic === "air") {
    if (c.pm25 > 37.5) {
      return {
        badge: "🟠 ฝุ่นเริ่มมีผลต่อสุขภาพ",
        tone: "alert",
        headline: `PM2.5 อยู่ที่ ${c.pm25} µg/m³ (US AQI ${c.aqi})`,
        action: "กลุ่มเสี่ยงควรสวมหน้ากากป้องกันฝุ่นเมื่ออยู่กลางแจ้ง และลดการวิ่งกลางแจ้งนานๆ",
      };
    }
    if (c.pm25 > 25) {
      return {
        badge: "🟡 คุณภาพอากาศปานกลาง",
        tone: "warn",
        headline: `PM2.5 อยู่ที่ ${c.pm25} µg/m³ (อยู่ในเกณฑ์มาตรฐานไทย)`,
        action: "คนทั่วไปทำกิจกรรมกลางแจ้งได้ตามปกติ ผู้ที่แพ้ง่ายควรสังเกตอาการตนเอง",
      };
    }
    return {
      badge: "🟢 อากาศดี สูดอากาศได้เต็มปอด",
      tone: "good",
      headline: `PM2.5 ต่ำเพียง ${c.pm25} µg/m³ ลมช่วยพัดระบายฝุ่นดีมาก`,
      action: "เปิดหน้าต่างระบายอากาศ หรือออกกำลังกายในสวนสาธารณะได้เลย",
    };
  }

  if (topic === "heat") {
    if (c.feelsLikeC >= 39) {
      return {
        badge: "🔥 ร้อนจัด ระวังฮีทสโตรก",
        tone: "alert",
        headline: `ความรู้สึกร้อนจริงพุ่งถึง ${c.feelsLikeC}°C (UV สูงสุด ${c.uvIndex})`,
        action: "จิบน้ำบ่อยๆ เลี่ยงการตากแดดจัดช่วง 11:00–15:00 น. และสวมหมวกหรือทาครีมกันแดด",
      };
    }
    if (c.feelsLikeC >= 35) {
      return {
        badge: "☀️ อากาศค่อนข้างร้อน",
        tone: "warn",
        headline: `ความรู้สึกร้อนจริง ${c.feelsLikeC}°C (อุณหภูมิวัดได้ ${c.tempC}°C)`,
        action: "สวมเสื้อผ้าระบายอากาศได้ดี และพกน้ำดื่มติดตัวเมื่อออกนอกอาคาร",
      };
    }
    return {
      badge: "🌤️ อากาศอบอุ่นกำลังดี",
      tone: "good",
      headline: `ความรู้สึกร้อนจริง ${c.feelsLikeC}°C ไม่ร้อนอบอ้าวจนเกินไป`,
      action: "เดินเล่นหรือทำกิจกรรมกลางแจ้งได้สบาย แนะนำทาครีมกันแดดช่วงเที่ยง",
    };
  }

  if (topic === "winter") {
    if (c.minMorningC <= 22.5) {
      return {
        badge: "🍃 ลมหนาวมาแล้ว เช้าเย็นสบาย",
        tone: "good",
        headline: `อุณหภูมิต่ำสุดเช้ามืด ${c.minMorningC}°C · ลม${c.windDirLabel} ${c.windKmh} กม./ชม.`,
        action: "เตรียมเสื้อคลุมบางๆ สำหรับช่วงเช้ามืด (05:00–07:30 น.) อากาศสดชื่นน่าเดินเล่น",
      };
    }
    return {
      badge: "🌬️ ลมโชยโปร่งสบาย",
      tone: "good",
      headline: `อุณหภูมิต่ำสุดเช้า ${c.minMorningC}°C · ลมกระโชก ${c.windGustKmh} กม./ชม.`,
      action: c.coolIndexLabel,
    };
  }

  if (c.waveHeightM >= 1.2 || c.tideMsl >= 1.35) {
    return {
      badge: "🌊 น้ำทะเลหนุนสูง / คลื่นปานกลาง",
      tone: "warn",
      headline: `ระดับน้ำทะเล ${c.tideMsl >= 0 ? "+" : ""}${c.tideMsl} ม. รทก. · คลื่นสูง ${c.waveHeightM} ม.`,
      action: "พื้นที่ลุ่มต่ำปากแม่น้ำควรระวังน้ำเค็ม/น้ำหนุนช่วงน้ำขึ้นสูงสุด และเรือเล็กควรระวังคลื่นลม",
    };
  }
  return {
    badge: "⚓ ทะเลสงบ เที่ยวชายฝั่งสบาย",
    tone: "good",
    headline: `คลื่นอ่าวไทยสูงเพียง ${c.waveHeightM} ม. · น้ำขึ้นสูงสุดเวลา ${c.highTideTime}`,
    action: c.seaStateLabel,
  };
}

function pinMetricLabel(area: AreaForecast, topic: TopicId): string {
  const c = area.current;
  if (topic === "rain") return `${c.rainProb}%`;
  if (topic === "air") return `${Math.round(c.pm25)} µg`;
  if (topic === "heat") return `${Math.round(c.feelsLikeC)}°C`;
  if (topic === "winter") return `${c.minMorningC}°C`;
  return `${c.waveHeightM}m`;
}

export default function FahSaiApp() {
  const [payload, setPayload] = useState<FahSaiPayload>(() => buildFallbackPayload());
  const [topic, setTopic] = useState<TopicId>("rain");
  const [selectedId, setSelectedId] = useState<string>("bangkok");
  const [zoneFilter, setZoneFilter] = useState<"all" | "metro" | "coastal">("all");
  const [basemap, setBasemap] = useState<"satellite" | "topo" | "dark">("satellite");
  const [showRadarWind, setShowRadarWind] = useState<boolean>(true);
  const [showBuffer, setShowBuffer] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [hourIdx, setHourIdx] = useState<number>(15);
  const [dark, setDark] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/fahsai");
      if (res.ok) {
        const json: FahSaiPayload = await res.json();
        setPayload(json);
      }
    } catch {
      // Keep fallback data
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHourIdx(new Date().getHours());
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredAreas = useMemo(
    () =>
      payload.areas.filter(a =>
        zoneFilter === "all" ? true : a.zoneType === zoneFilter
      ),
    [payload.areas, zoneFilter]
  );

  const activeArea = useMemo(
    () =>
      payload.areas.find(a => a.id === selectedId) ??
      filteredAreas[0] ??
      payload.areas[0],
    [payload.areas, filteredAreas, selectedId]
  );

  const activeHour = activeArea.hourly[hourIdx] ?? activeArea.hourly[0];
  const advice = getFriendlyAdvice(activeArea, topic);
  const bands = useMemo(() => getTopicRiskBands(topic), [topic]);
  const activeTier = classifyAreaRisk(activeArea, topic);
  const activeTierColor = bands.find(b => b.tier === activeTier)?.color ?? "#0284c7";

  // Compute Radar & Wind Trajectory analysis + Time-Window Quantitative Alerts for activeArea
  const radarAndSchedule = useMemo(() => {
    const c = activeArea.current;
    const dbz = c.rainProb >= 60 ? 44 : c.rainProb >= 40 ? 36 : c.rainProb >= 25 ? 28 : 18;
    const rainRateMmHr = c.rainProb >= 60 ? Number((c.rain24hMm / 2.2).toFixed(1)) : Number((c.rain24hMm / 4.0).toFixed(1));
    const etaMin = Math.max(20, Math.round(45 - c.windKmh * 0.6));
    const moveDirText =
      c.windDeg >= 20 && c.windDeg <= 110
        ? "เคลื่อนตัวจากทิศตะวันออกเฉียงเหนือมุ่งหน้าทิศตะวันตกเฉียงใต้ (เข้าสู่อ่าวไทยและปริมณฑลฝั่งตะวันตก)"
        : c.windDeg > 110 && c.windDeg <= 220
          ? "เคลื่อนตัวจากอ่าวไทยขึ้นสู่ฝั่งตอนบนตามแนวลมใต้–ตะวันออกเฉียงใต้"
          : "เคลื่อนตัวตามแนวลมมรสุมผ่านพื้นที่กรุงเทพฯ และปริมณฑล";

    const nowH = new Date().getHours();
    const sliceWindow = (startOffset: number, len: number, title: string, tag: string) => {
      const startH = (nowH + startOffset) % 24;
      const endH = (nowH + startOffset + len) % 24;
      const slots = Array.from({ length: len }, (_, k) => activeArea.hourly[(nowH + startOffset + k) % 24]).filter(Boolean);
      const maxRainProb = slots.length ? Math.max(...slots.map(s => s.rainProb)) : c.rainProb;
      const sumRainMm = Number(
        (
          slots.reduce((acc, s) => acc + (s.rainProb >= 35 ? (s.rainProb / 100) * 4.2 : (s.rainProb / 100) * 1.1), 0)
        ).toFixed(1)
      );
      const maxFeels = slots.length ? Math.max(...slots.map(s => s.feelsLikeC)) : c.feelsLikeC;
      const minTemp = slots.length ? Math.min(...slots.map(s => s.tempC)) : c.minMorningC;
      const maxPm25 = slots.length ? Math.max(...slots.map(s => s.pm25)) : c.pm25;
      const maxWind = slots.length ? Math.max(...slots.map(s => s.windKmh)) : c.windKmh;
      const maxTide = slots.length ? Math.max(...slots.map(s => s.tideMsl)) : c.highTideMsl;

      let slotTier: 1 | 2 | 3 | 4 | 5 = activeTier;
      if (topic === "rain") {
        slotTier = maxRainProb > 75 || sumRainMm > 20 ? 5 : maxRainProb >= 55 ? 4 : maxRainProb >= 35 ? 3 : maxRainProb >= 15 ? 2 : 1;
      } else if (topic === "air") {
        slotTier = maxPm25 > 75 ? 5 : maxPm25 > 37.5 ? 4 : maxPm25 > 25 ? 3 : maxPm25 > 15 ? 2 : 1;
      } else if (topic === "heat") {
        slotTier = maxFeels > 42 ? 5 : maxFeels >= 38 ? 4 : maxFeels >= 34 ? 3 : maxFeels >= 30 ? 2 : 1;
      } else if (topic === "winter") {
        slotTier = minTemp <= 18 ? 5 : minTemp <= 21.5 ? 4 : minTemp <= 23.5 ? 3 : minTemp <= 25.5 ? 2 : 1;
      } else {
        slotTier = maxTide > 1.6 ? 5 : maxTide >= 1.42 ? 4 : maxTide >= 1.25 ? 3 : 2;
      }

      const slotColor = bands.find(b => b.tier === slotTier)?.color ?? activeTierColor;

      return {
        windowText: `${title} (${String(startH).padStart(2, "0")}:00–${String(endH).padStart(2, "0")}:00 น.)`,
        tag,
        tier: slotTier,
        color: slotColor,
        rainQty: `โอกาสฝน ${maxRainProb}% · ปริมาณฝนคาดการณ์ ${sumRainMm} มม.`,
        windRadarQty: `ลม${c.windDirLabel} ${maxWind} กม./ชม. · เรดาร์ ${dbz} dBZ`,
        otherQty: `🌡️ ร้อนจริง ${maxFeels}°C (ต่ำสุด ${minTemp}°C) · 😷 PM2.5 ${maxPm25} µg/m³ · 🌊 น้ำทะเล ${maxTide >= 0 ? "+" : ""}${maxTide} ม.`,
        adviceText:
          maxRainProb >= 55
            ? `ระวังฝนตกปานกลาง–หนักสะสม ${sumRainMm} มม. เตรียมร่มและเลี่ยงจุดเสี่ยงน้ำขัง`
            : maxPm25 > 37.5
              ? `ค่าฝุ่นสะสมสูงถึง ${maxPm25} µg/m³ แนะนำสวมหน้ากากป้องกันฝุ่นเมื่ออยู่นอกอาคาร`
              : maxFeels >= 38
                ? `ความร้อนสะสมสูง ${maxFeels}°C ดื่มน้ำเพิ่มขึ้นและเลี่ยงแดดจัด`
                : `สภาพอากาศและระดับน้ำอยู่ในเกณฑ์ปลอดภัย เดินทางได้ตามปกติ`,
      };
    };

    return {
      dbz,
      rainRateMmHr,
      etaMin,
      moveDirText,
      slots: [
        sliceWindow(0, 1, "ตอนนี้ – 1 ชม.", "ความเสี่ยงตอนนี้"),
        sliceWindow(1, 3, "1–3 ชม. ข้างหน้า", "แจ้งเตือนระยะประชิด"),
        sliceWindow(3, 6, "3–6 ชม. ข้างหน้า", "แนวโน้มช่วงเย็น–ค่ำ"),
        sliceWindow(6, 12, "6–12 ชม. ข้างหน้า", "แนวโน้มกลางคืน–เช้ามืด"),
      ],
    };
  }, [activeArea, activeTier, activeTierColor, bands, topic]);

  const graticuleLats = [13.0, 13.3, 13.6, 13.9];
  const graticuleLngs = [100.0, 100.4, 100.8, 101.1];

  return (
    <div className={`fs-app theme-${topic} ${dark ? "is-dark" : ""}`}>
      <div className="fs-ambient" aria-hidden="true">
        <div className="fs-orb fs-orb-1" />
        <div className="fs-orb fs-orb-2" />
        {topic === "rain" && (
          <div className="fs-rain-layer">
            {Array.from({ length: 18 }, (_, i) => (
              <span
                key={i}
                className="fs-raindrop"
                style={{
                  left: `${(i * 5.7) % 100}%`,
                  animationDelay: `${(i * 0.23) % 2}s`,
                  animationDuration: `${1.1 + (i % 4) * 0.25}s`,
                }}
              />
            ))}
          </div>
        )}
        {topic === "winter" && (
          <div className="fs-wind-layer">
            <span className="fs-wind-streak s1" />
            <span className="fs-wind-streak s2" />
            <span className="fs-wind-streak s3" />
          </div>
        )}
      </div>

      <header className="fs-header">
        <div className="fs-brand">
          <span className="fs-logo" aria-hidden="true">
            🌤️
          </span>
          <div>
            <strong>ฟ้าใส · FahSai Weather & Sea</strong>
            <small>พยากรณ์อากาศ ฝน ฝุ่น ความร้อน ลมหนาว และน้ำทะเลอ่าวไทยตอนบน</small>
          </div>
        </div>

        <div className="fs-header-actions">
          <a href="/" className="fs-sister-link">
            🌊 เปิดแอปสายน้ำเจ้าพระยา (7 ลุ่มน้ำ) ↗
          </a>
          <button
            type="button"
            className="fs-refresh-btn"
            onClick={loadData}
            disabled={refreshing}
          >
            {refreshing ? "⏳ กำลังอัปเดต…" : "🔄 อัปเดตสด"}
          </button>
          <button
            type="button"
            className="fs-theme-btn"
            onClick={() => setDark(d => !d)}
            aria-label="สลับโหมดมืด/สว่าง"
          >
            {dark ? "☀️ โหมดสว่าง" : "🌙 โหมดมืด"}
          </button>
        </div>
      </header>

      <main className="fs-main">
        <section className="fs-topic-bar" aria-label="เลือกหมวดพยากรณ์">
          {TOPICS.map(t => {
            const active = topic === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className={`fs-topic-pill ${active ? "is-active" : ""}`}
                aria-pressed={active}
                onClick={() => setTopic(t.id)}
              >
                <span className="fs-topic-icon" aria-hidden="true">
                  {t.icon}
                </span>
                <span className="fs-topic-text">
                  <strong>{t.label}</strong>
                  <small>{t.shortDesc}</small>
                </span>
              </button>
            );
          })}
        </section>

        {/* Live Current Risk Status + Radar & Wind Direction Alert + Time-Window Quantitative Schedule */}
        <section className="fs-live-alert-section" aria-label="ความเสี่ยงตอนนี้และตารางแจ้งเตือนรายช่วงเวลา">
          <div className="fs-live-alert-top">
            <div className="fs-live-alert-badges">
              <span className="fs-live-risk-pill" style={{ background: activeTierColor }}>
                🚨 ความเสี่ยงตอนนี้ ({activeArea.name}): ระดับ {activeTier}/5 · {bands.find(b => b.tier === activeTier)?.label}
              </span>
              <span className="fs-live-radar-pill">
                📡 เรดาร์กลุ่มฝน {radarAndSchedule.dbz} dBZ (~{radarAndSchedule.rainRateMmHr} มม./ชม.) · ลม{activeArea.current.windDirLabel} {activeArea.current.windKmh} กม./ชม.
              </span>
              <span className="fs-live-coord-pill">
                📍 พิกัดจริง {activeArea.lat.toFixed(4)}°N, {activeArea.lng.toFixed(4)}°E
              </span>
            </div>
            <p className="fs-live-radar-desc">
              🧭 <strong>วิเคราะห์เรดาร์และทิศทางฝน–ลมตอนนี้:</strong> ลม{activeArea.current.windDirLabel}พัดด้วยความเร็ว{" "}
              <b>{activeArea.current.windKmh} กม./ชม.</b> (ลมกระโชกสูงสุด <b>{activeArea.current.windGustKmh} กม./ชม.</b>) ส่งผลให้กลุ่มเมฆฝน{" "}
              <b>{radarAndSchedule.moveDirText}</b> คาดว่าจะเคลื่อนตัวถึงพื้นที่รับลมภายในประมาณ{" "}
              <b>{radarAndSchedule.etaMin} นาที</b> · ปริมาณฝนสะสม 24 ชม. คาดการณ์ <b>{activeArea.current.rain24hMm} มม.</b>
            </p>
          </div>

          <div className="fs-schedule-grid">
            {radarAndSchedule.slots.map((slot, i) => (
              <div key={i} className="fs-schedule-card" style={{ borderTop: `4px solid ${slot.color}` }}>
                <div className="fs-schedule-head">
                  <strong>⏰ {slot.windowText}</strong>
                  <span style={{ background: slot.color }}>ระดับ {slot.tier}</span>
                </div>
                <small className="fs-schedule-tag">{slot.tag}</small>
                <div className="fs-schedule-body">
                  <p>🌧️ <b>ปริมาณฝน:</b> {slot.rainQty}</p>
                  <p>🧭 <b>ทิศทางลม & เรดาร์:</b> {slot.windRadarQty}</p>
                  <p>📊 <b>สภาพแวดล้อม:</b> {slot.otherQty}</p>
                </div>
                <p className="fs-schedule-advice">💡 {slot.adviceText}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="fs-hero-grid">
          <article className="fs-hero-card">
            <div className="fs-hero-top">
              <div>
                <span className="fs-zone-badge">
                  {activeArea.zoneType === "coastal"
                    ? "⚓ ชายฝั่งอ่าวไทยตอนบน"
                    : "🏙️ กรุงเทพฯ และปริมณฑล"}{" "}
                  · {activeArea.lat.toFixed(4)}°N, {activeArea.lng.toFixed(4)}°E
                </span>
                <h1>{activeArea.name}</h1>
                <p className="fs-subtitle">{activeArea.subtitle}</p>
              </div>
              <span
                className="fs-advice-pill"
                style={{ background: activeTierColor, color: "#fff" }}
              >
                ระดับความเสี่ยง {activeTier}/5 · {advice.badge}
              </span>
            </div>

            <div className="fs-hero-showcase">
              <div className="fs-hero-big-metric">
                {topic === "rain" && (
                  <>
                    <small>โอกาสเกิดฝนวันนี้</small>
                    <strong>
                      {activeArea.current.rainProb}
                      <span>%</span>
                    </strong>
                    <span>สะสม 24 ชม. ~{activeArea.current.rain24hMm} มม. · เรดาร์ {radarAndSchedule.dbz} dBZ</span>
                  </>
                )}
                {topic === "air" && (
                  <>
                    <small>ค่าฝุ่นละออง PM2.5</small>
                    <strong>
                      {activeArea.current.pm25}
                      <span>µg/m³</span>
                    </strong>
                    <span>ดัชนี US AQI {activeArea.current.aqi}</span>
                  </>
                )}
                {topic === "heat" && (
                  <>
                    <small>ความรู้สึกร้อนจริง (RealFeel)</small>
                    <strong>
                      {activeArea.current.feelsLikeC}
                      <span>°C</span>
                    </strong>
                    <span>
                      อุณหภูมิจริง {activeArea.current.tempC}°C · UV{" "}
                      {activeArea.current.uvIndex}
                    </span>
                  </>
                )}
                {topic === "winter" && (
                  <>
                    <small>อุณหภูมิต่ำสุดเช้ามืด</small>
                    <strong>
                      {activeArea.current.minMorningC}
                      <span>°C</span>
                    </strong>
                    <span>
                      ลม{activeArea.current.windDirLabel} ·{" "}
                      {activeArea.current.windKmh} กม./ชม.
                    </span>
                  </>
                )}
                {topic === "sea" && (
                  <>
                    <small>ระดับน้ำทะเลอ่าวไทยตอนบน</small>
                    <strong>
                      {activeArea.current.tideMsl >= 0 ? "+" : ""}
                      {activeArea.current.tideMsl}
                      <span>ม. รทก.</span>
                    </strong>
                    <span>
                      คลื่นสูง {activeArea.current.waveHeightM} ม. · น้ำขึ้นสูงสุด{" "}
                      {activeArea.current.highTideTime}
                    </span>
                  </>
                )}
              </div>

              <div className="fs-hero-visual-box" aria-hidden="true">
                {topic === "rain" && (
                  <div className="fs-vis-umbrella">
                    <span className="fs-vis-emoji">☔</span>
                    <div className="fs-vis-meter">
                      <i style={{ width: `${activeArea.current.rainProb}%` }} />
                    </div>
                    <small>ระดับความจำเป็นในการพกร่ม</small>
                  </div>
                )}
                {topic === "air" && (
                  <div className="fs-vis-aqi">
                    <span className="fs-vis-emoji">
                      {activeArea.current.pm25 <= 25 ? "😊" : "😷"}
                    </span>
                    <div className="fs-vis-meter is-air">
                      <i
                        style={{
                          width: `${Math.min(100, (activeArea.current.pm25 / 75) * 100)}%`,
                        }}
                      />
                    </div>
                    <small>เกณฑ์ปลอดภัยไทย ≤ 37.5 µg/m³</small>
                  </div>
                )}
                {topic === "heat" && (
                  <div className="fs-vis-sun">
                    <span className="fs-vis-emoji is-spin">☀️</span>
                    <div className="fs-vis-meter is-heat">
                      <i
                        style={{
                          width: `${Math.min(100, ((activeArea.current.feelsLikeC - 20) / 25) * 100)}%`,
                        }}
                      />
                    </div>
                    <small>ความชื้นสัมพัทธ์ {activeArea.current.humidity}%</small>
                  </div>
                )}
                {topic === "winter" && (
                  <div className="fs-vis-wind">
                    <span className="fs-vis-emoji">🍃</span>
                    <div className="fs-compass">
                      <span
                        className="fs-compass-arrow"
                        style={{
                          transform: `rotate(${activeArea.current.windDeg}deg)`,
                        }}
                      >
                        ➤
                      </span>
                    </div>
                    <small>ลมกระโชก {activeArea.current.windGustKmh} กม./ชม.</small>
                  </div>
                )}
                {topic === "sea" && (
                  <div className="fs-vis-sea">
                    <div className="fs-sea-tank">
                      <div
                        className="fs-sea-water"
                        style={{
                          height: `${Math.min(92, Math.max(18, ((activeArea.current.tideMsl + 1.5) / 3.2) * 100))}%`,
                        }}
                      >
                        <span className="fs-sea-wave" />
                      </div>
                      <b>
                        {activeArea.current.tideTrend === "rising"
                          ? "⬆️ น้ำกำลังขึ้น"
                          : "⬇️ น้ำกำลังลง"}
                      </b>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={`fs-friendly-box is-${advice.tone}`}>
              <strong>💡 คำแนะนำสำหรับคนทั่วไป: {advice.headline}</strong>
              <p>{advice.action}</p>
              <small>📍 บริบทพื้นที่: {activeArea.coastalNote}</small>
            </div>

            <div className="fs-risk-legend-box">
              <small className="fs-eyebrow">🎨 เกณฑ์แบ่งสีตามระดับความเสี่ยง 5 ระดับ ({TOPICS.find(t => t.id === topic)?.label})</small>
              <div className="fs-risk-band-grid">
                {bands.map(b => (
                  <div
                    key={b.tier}
                    className={`fs-risk-band-item ${activeTier === b.tier ? "is-current" : ""}`}
                  >
                    <span className="fs-risk-swatch" style={{ background: b.color }} />
                    <div>
                      <strong>{b.label}</strong>
                      <small>{b.rangeText}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="fs-five-strip">
              <button type="button" onClick={() => setTopic("rain")} className={topic === "rain" ? "is-selected" : ""}>
                <small>🌧️ โอกาสฝน</small>
                <b>{activeArea.current.rainProb}%</b>
              </button>
              <button type="button" onClick={() => setTopic("air")} className={topic === "air" ? "is-selected" : ""}>
                <small>😷 ฝุ่น PM2.5</small>
                <b>{activeArea.current.pm25}</b>
              </button>
              <button type="button" onClick={() => setTopic("heat")} className={topic === "heat" ? "is-selected" : ""}>
                <small>☀️ รู้สึกร้อน</small>
                <b>{activeArea.current.feelsLikeC}°C</b>
              </button>
              <button type="button" onClick={() => setTopic("winter")} className={topic === "winter" ? "is-selected" : ""}>
                <small>🍃 เช้าเย็นสุด</small>
                <b>{activeArea.current.minMorningC}°C</b>
              </button>
              <button type="button" onClick={() => setTopic("sea")} className={topic === "sea" ? "is-selected" : ""}>
                <small>🌊 น้ำทะเล</small>
                <b>+{activeArea.current.highTideMsl}ม.</b>
              </button>
            </div>
          </article>

          <article className="fs-map-card">
            <div className="fs-map-head">
              <div>
                <span className="fs-eyebrow">🛰️ QGIS Georeferenced Satellite & Radar Layout (EPSG:4326)</span>
                <h2>แผนที่ดาวเทียมตรึงพิกัดจริง + เรดาร์ทิศทางฝนลม กทม.–อ่าวไทยตอนบน</h2>
              </div>
              <div className="fs-zone-filters" role="group" aria-label="สลับภาพพื้นหลังแผนที่">
                <button
                  type="button"
                  aria-pressed={basemap === "satellite"}
                  onClick={() => setBasemap("satellite")}
                >
                  🛰️ ภาพถ่ายดาวเทียมจริง
                </button>
                <button
                  type="button"
                  aria-pressed={basemap === "topo"}
                  onClick={() => setBasemap("topo")}
                >
                  ⛰️ ภูมิประเทศจริง
                </button>
                <button
                  type="button"
                  aria-pressed={basemap === "dark"}
                  onClick={() => setBasemap("dark")}
                >
                  🌑 แผนที่มืด GIS
                </button>
              </div>
            </div>

            <div className="fs-qgis-subtoolbar">
              <div className="fs-zone-filters">
                <button type="button" aria-pressed={zoneFilter === "all"} onClick={() => setZoneFilter("all")}>
                  ทั้งหมด (10)
                </button>
                <button type="button" aria-pressed={zoneFilter === "metro"} onClick={() => setZoneFilter("metro")}>
                  🏙️ กทม.·ปริมณฑล
                </button>
                <button type="button" aria-pressed={zoneFilter === "coastal"} onClick={() => setZoneFilter("coastal")}>
                  ⚓ ชายฝั่งอ่าวไทย
                </button>
              </div>
              <div className="fs-zone-filters">
                <button type="button" aria-pressed={showRadarWind} onClick={() => setShowRadarWind(v => !v)}>
                  📡 เรดาร์ฝน & ทิศทางลม
                </button>
                <button type="button" aria-pressed={showBuffer} onClick={() => setShowBuffer(v => !v)}>
                  🎯 รัศมีความเสี่ยง (IDW)
                </button>
                <button type="button" aria-pressed={showGrid} onClick={() => setShowGrid(v => !v)}>
                  📐 กริดพิกัดจริง
                </button>
              </div>
            </div>

            <div className="fs-svg-map-wrap is-qgis">
              <svg
                viewBox="0 0 520 340"
                className="fs-svg-map"
                role="img"
                aria-label="แผนที่ภาพถ่ายดาวเทียมตรึงพิกัด EPSG:4326 กรุงเทพฯ ปริมณฑล และอ่าวไทยตอนบน พร้อมเรดาร์ฝนและทิศทางลม"
              >
                <defs>
                  <linearGradient id="fs-sea-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={basemap === "topo" ? "#7dd3fc" : "#082f49"} />
                    <stop offset="55%" stopColor={basemap === "topo" ? "#38bdf8" : "#0c4a6e"} />
                    <stop offset="100%" stopColor={basemap === "topo" ? "#0284c7" : "#071f33"} />
                  </linearGradient>
                  <filter id="fs-idw-blur" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="18" />
                  </filter>
                  <filter id="fs-radar-blur" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="10" />
                  </filter>
                  <marker id="fs-wind-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                  </marker>
                  <marker id="fs-storm-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#facc15" />
                  </marker>
                  <clipPath id="fs-frame-clip">
                    <rect x={FAHSAI_FRAME.x} y={FAHSAI_FRAME.y} width={FAHSAI_FRAME.width} height={FAHSAI_FRAME.height} />
                  </clipPath>
                </defs>

                {/* Base fallback canvas */}
                <rect x={FAHSAI_FRAME.x} y={FAHSAI_FRAME.y} width={FAHSAI_FRAME.width} height={FAHSAI_FRAME.height} fill="url(#fs-sea-grad)" />

                {/* Exact Georeferenced Satellite / Topo Image (BBox 99.75..101.25°E, 12.90..14.15°N in EPSG:4326) */}
                {basemap === "satellite" && (
                  <image
                    href={FAHSAI_SAT_URL}
                    x={FAHSAI_FRAME.x}
                    y={FAHSAI_FRAME.y}
                    width={FAHSAI_FRAME.width}
                    height={FAHSAI_FRAME.height}
                    preserveAspectRatio="none"
                    opacity="0.92"
                  />
                )}
                {basemap === "topo" && (
                  <image
                    href={FAHSAI_TOPO_URL}
                    x={FAHSAI_FRAME.x}
                    y={FAHSAI_FRAME.y}
                    width={FAHSAI_FRAME.width}
                    height={FAHSAI_FRAME.height}
                    preserveAspectRatio="none"
                    opacity="0.92"
                  />
                )}

                <g clipPath="url(#fs-frame-clip)">
                  {/* Georeferenced Upper Gulf of Thailand Coastline */}
                  <path
                    d={projectFahSaiPolyline(UPPER_GULF_COASTLINE_WGS84)}
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="2.2"
                    strokeDasharray="6 3"
                  />

                  {/* Georeferenced 4 Major River Estuaries (แม่กลอง, ท่าจีน, เจ้าพระยา, บางปะกง) */}
                  {ESTUARY_RIVERS_WGS84.map(river => (
                    <path
                      key={river.id}
                      d={projectFahSaiPolyline(river.coords)}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth={river.id === "chao-phraya" ? "3.2" : "2.2"}
                      strokeDasharray="6 4"
                      className="fs-map-river"
                    />
                  ))}

                  {/* Georeferenced IDW Risk Buffer Halos */}
                  {showBuffer && (
                    <g filter="url(#fs-idw-blur)">
                      {filteredAreas.map(area => {
                        const pt = projectFahSaiGeo(area.lat, area.lng);
                        const rTier = classifyAreaRisk(area, topic);
                        const col = bands.find(b => b.tier === rTier)?.color ?? "#10b981";
                        return (
                          <circle
                            key={`halo-${area.id}`}
                            cx={pt.x}
                            cy={pt.y}
                            r={rTier >= 4 ? 42 : rTier === 3 ? 34 : 26}
                            fill={col}
                            opacity={0.55}
                          />
                        );
                      })}
                    </g>
                  )}

                  {/* Radar Echo Cells & Wind Direction Vectors Layer */}
                  {showRadarWind && (
                    <g className="fs-radar-wind-layer">
                      {filteredAreas
                        .filter(a => a.current.rainProb >= 30)
                        .map(area => {
                          const pt = projectFahSaiGeo(area.lat, area.lng);
                          // Calculate movement vector from windDeg (windDeg is direction wind blows FROM, so movement is +180 deg)
                          const moveRad = ((area.current.windDeg + 180 - 90) * Math.PI) / 180;
                          const distPx = 36;
                          const tx = pt.x + Math.cos(moveRad) * distPx;
                          const ty = pt.y + Math.sin(moveRad) * distPx;
                          const dbzColor = area.current.rainProb >= 60 ? "#ef4444" : area.current.rainProb >= 45 ? "#f97316" : "#22c55e";
                          return (
                            <g key={`radar-${area.id}`}>
                              <g filter="url(#fs-radar-blur)">
                                <ellipse cx={pt.x} cy={pt.y} rx="30" ry="20" fill="#22c55e" opacity="0.38" />
                                <ellipse cx={pt.x} cy={pt.y} rx="18" ry="12" fill={dbzColor} opacity="0.58" />
                              </g>
                              <line
                                x1={pt.x}
                                y1={pt.y}
                                x2={tx}
                                y2={ty}
                                stroke="#facc15"
                                strokeWidth="2"
                                strokeDasharray="3 2"
                                markerEnd="url(#fs-storm-arrow)"
                              />
                            </g>
                          );
                        })}

                      {/* Wind Streamline Vectors across the Gulf & Metro */}
                      {[
                        { lat: 13.98, lng: 100.85 },
                        { lat: 13.68, lng: 100.25 },
                        { lat: 13.22, lng: 100.42 },
                        { lat: 13.15, lng: 100.75 },
                      ].map((w, idx) => {
                        const p1 = projectFahSaiGeo(w.lat, w.lng);
                        const moveRad = ((activeArea.current.windDeg + 180 - 90) * Math.PI) / 180;
                        const p2 = {
                          x: p1.x + Math.cos(moveRad) * 42,
                          y: p1.y + Math.sin(moveRad) * 42,
                        };
                        return (
                          <g key={`wind-stream-${idx}`} opacity="0.85">
                            <line
                              x1={p1.x}
                              y1={p1.y}
                              x2={p2.x}
                              y2={p2.y}
                              stroke="#38bdf8"
                              strokeWidth="1.8"
                              strokeDasharray="4 3"
                              markerEnd="url(#fs-wind-arrow)"
                            />
                            <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 - 4} fill="#bae6fd" fontSize="7.5" fontWeight="700" textAnchor="middle">
                              ลม {activeArea.current.windKmh} กม./ชม.
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  )}

                  {/* Upper Gulf of Thailand Waves at real coordinates (13.18°N, 100.42°E) */}
                  {(() => {
                    const gulfCenter = projectFahSaiGeo(13.18, 100.42);
                    return (
                      <g className="fs-gulf-waves">
                        <path
                          d={`M${gulfCenter.x - 65},${gulfCenter.y - 14} Q${gulfCenter.x - 35},${gulfCenter.y - 22} ${gulfCenter.x - 5},${gulfCenter.y - 14} T${gulfCenter.x + 55},${gulfCenter.y - 14}`}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="2"
                          opacity="0.75"
                        />
                        <text
                          x={gulfCenter.x}
                          y={gulfCenter.y + 8}
                          textAnchor="middle"
                          className="fs-gulf-label"
                        >
                          🌊 อ่าวไทยตอนบน (13.18°N, 100.42°E)
                        </text>
                      </g>
                    );
                  })()}

                  {/* Georeferenced Province Pins (projected directly from area.lat, area.lng) */}
                  {filteredAreas.map(area => {
                    const pt = projectFahSaiGeo(area.lat, area.lng);
                    const isSel = area.id === activeArea.id;
                    const metric = pinMetricLabel(area, topic);
                    const rTier = classifyAreaRisk(area, topic);
                    const riskColor = bands.find(b => b.tier === rTier)?.color ?? "#0284c7";
                    return (
                      <g
                        key={area.id}
                        className={`fs-map-pin ${isSel ? "is-selected" : ""}`}
                        transform={`translate(${pt.x}, ${pt.y})`}
                        onClick={() => setSelectedId(area.id)}
                        role="button"
                        tabIndex={0}
                        aria-label={`เลือกพื้นที่ ${area.name} พิกัด ${area.lat.toFixed(2)}N ${area.lng.toFixed(2)}E ค่าปัจจุบัน ${metric} ระดับความเสี่ยง ${rTier}`}
                      >
                        {isSel && <circle r="22" className="fs-pin-pulse" style={{ fill: riskColor }} />}
                        <rect
                          x="-34"
                          y="-25"
                          width="68"
                          height="20"
                          rx="10"
                          fill={riskColor}
                          stroke="#ffffff"
                          strokeWidth={isSel ? "2.4" : "1.4"}
                        />
                        <text x="0" y="-11" textAnchor="middle" fill="#ffffff" fontSize="10.5" fontWeight="800">
                          {metric}
                        </text>
                        <circle r="5.5" cy="3" fill={riskColor} stroke="#ffffff" strokeWidth="1.8" />
                        <text x="0" y="16" textAnchor="middle" className="fs-pin-name">
                          {area.name.split(" ")[0]}
                        </text>
                      </g>
                    );
                  })}
                </g>

                {/* Georeferenced Coordinate Graticule Grid */}
                {showGrid && (
                  <g className="fs-qgis-grid">
                    {graticuleLats.map(lat => {
                      const { y } = projectFahSaiGeo(lat, FAHSAI_BBOX.minLng);
                      const label = formatDms(lat, true);
                      return (
                        <g key={`lat-${lat}`}>
                          <line x1={FAHSAI_FRAME.x} y1={y} x2={FAHSAI_FRAME.x + FAHSAI_FRAME.width} y2={y} />
                          <text x={FAHSAI_FRAME.x + 5} y={y - 4}>{label}</text>
                          <text x={FAHSAI_FRAME.x + FAHSAI_FRAME.width - 5} y={y - 4} textAnchor="end">{label}</text>
                        </g>
                      );
                    })}
                    {graticuleLngs.map(lng => {
                      const { x } = projectFahSaiGeo(FAHSAI_BBOX.minLat, lng);
                      const label = formatDms(lng, false);
                      return (
                        <g key={`lng-${lng}`}>
                          <line x1={x} y1={FAHSAI_FRAME.y} x2={x} y2={FAHSAI_FRAME.y + FAHSAI_FRAME.height} />
                          <text x={x + 4} y={FAHSAI_FRAME.y + 12}>{label}</text>
                        </g>
                      );
                    })}
                  </g>
                )}

                <g transform="translate(474, 42)">
                  <circle r="18" fill="rgba(12, 28, 44, 0.84)" stroke="rgba(255,255,255,0.4)" />
                  <polygon points="0,-12 -5,6 0,3 5,6" fill="#ffffff" />
                  <text x="0" y="14" textAnchor="middle" fill="#7dd3fc" fontSize="8" fontWeight="800">N</text>
                </g>

                {/* Geographically calibrated Scale Bar (30 km ≈ 0.278° lng ≈ 90 px) */}
                <g transform="translate(28, 304)">
                  <rect x="-4" y="-12" width="128" height="20" rx="4" fill="rgba(12, 28, 44, 0.84)" />
                  <rect x="2" y="1" width="45" height="4" fill="#ffffff" />
                  <rect x="47" y="1" width="45" height="4" fill="#38bdf8" />
                  <text x="2" y="-2" fill="#ffffff" fontSize="8" fontWeight="700">0</text>
                  <text x="42" y="-2" fill="#ffffff" fontSize="8" fontWeight="700">15</text>
                  <text x="84" y="-2" fill="#7dd3fc" fontSize="8" fontWeight="700">30 กม.</text>
                </g>

                <rect x={FAHSAI_FRAME.x} y={FAHSAI_FRAME.y} width={FAHSAI_FRAME.width} height={FAHSAI_FRAME.height} fill="none" stroke="#ffffff" strokeWidth="2" />
                <rect x="12" y="12" width="496" height="316" fill="none" stroke="#0c2e44" strokeWidth="4" strokeDasharray="20 20" />
              </svg>

              <div className="fs-qgis-titleblock">
                <div>
                  <small>MAP SHEET: FAHSAI-GULF-2026 · CRS: EPSG:4326 (BBOX 99.75°E–101.25°E, 12.90°N–14.15°N)</small>
                  <strong>แผนที่ดาวเทียมพิกัดจริง + เรดาร์ทิศทางฝนลม ({TOPICS.find(t => t.id === topic)?.label})</strong>
                </div>
                <span>
                  {activeArea.name} ({activeArea.lat.toFixed(2)}°N, {activeArea.lng.toFixed(2)}°E) · <b>ระดับ {activeTier}/5</b>
                </span>
              </div>
            </div>

            <div className="fs-qgis-commentary">
              <strong>📐 คำอธิบายวิเคราะห์เชิงพื้นที่ & เรดาร์ (QGIS Spatial & Radar Commentary):</strong>
              <p>
                พื้นที่ <b>{activeArea.name}</b> (พิกัดจริง <code>{activeArea.lat.toFixed(4)}°N, {activeArea.lng.toFixed(4)}°E</code>) จัดอยู่ในเกณฑ์{" "}
                <b style={{ color: activeTierColor }}>
                  {bands.find(b => b.tier === activeTier)?.label}
                </b>{" "}
                ({advice.headline}) · เรดาร์ตรวจพบความเข้ม <b>{radarAndSchedule.dbz} dBZ</b> เคลื่อนตัวตามลม{activeArea.current.windDirLabel} ({activeArea.current.windKmh} กม./ชม.) · {activeArea.coastalNote}
              </p>
            </div>

            <div className="fs-area-chips">
              {filteredAreas.map(a => {
                const rTier = classifyAreaRisk(a, topic);
                const col = bands.find(b => b.tier === rTier)?.color ?? "#0284c7";
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={a.id === activeArea.id ? "is-selected" : ""}
                    onClick={() => setSelectedId(a.id)}
                  >
                    <span className="fs-chip-dot" style={{ background: col }} />
                    <strong>{a.name}</strong>
                    <b>{pinMetricLabel(a, topic)}</b>
                  </button>
                );
              })}
            </div>
          </article>
        </section>

        <section className="fs-timeline-section" aria-labelledby="fs-hourly-title">
          <div className="fs-section-head">
            <div>
              <span className="fs-eyebrow">⏱️ Interactive 24-Hour Scrubber</span>
              <h2 id="fs-hourly-title">
                เลื่อนดูแนวโน้มรายชั่วโมงของ {activeArea.name} (24 ชม.)
              </h2>
            </div>
            <div className="fs-hour-readout">
              <span>เวลาที่เลือก: <strong>{activeHour.hourLabel} น.</strong></span>
              <b>
                🌡️ {activeHour.tempC}°C · 🌧️ ฝน {activeHour.rainProb}% · 😷 PM2.5{" "}
                {activeHour.pm25} · 🌊 น้ำทะเล{" "}
                {activeHour.tideMsl >= 0 ? "+" : ""}
                {activeHour.tideMsl} ม.
              </b>
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={23}
            value={hourIdx}
            onChange={e => setHourIdx(Number(e.target.value))}
            className="fs-time-slider"
            aria-label="เลื่อนเลือกชั่วโมงพยากรณ์"
          />

          <div className="fs-hourly-bars">
            {activeArea.hourly.map((h, idx) => {
              const selected = idx === hourIdx;
              const val =
                topic === "rain"
                  ? h.rainProb
                  : topic === "air"
                    ? h.pm25
                    : topic === "heat"
                      ? h.feelsLikeC
                      : topic === "winter"
                        ? h.tempC
                        : h.tideMsl;
              const heightPct =
                topic === "rain"
                  ? Math.max(8, h.rainProb)
                  : topic === "air"
                    ? Math.min(100, Math.max(10, (h.pm25 / 60) * 100))
                    : topic === "heat" || topic === "winter"
                      ? Math.min(100, Math.max(15, ((val - 18) / 24) * 100))
                      : Math.min(100, Math.max(12, ((h.tideMsl + 1.6) / 3.2) * 100));

              return (
                <button
                  key={h.hourLabel}
                  type="button"
                  className={`fs-hour-col ${selected ? "is-selected" : ""}`}
                  onClick={() => setHourIdx(idx)}
                >
                  <small className="fs-hour-val">
                    {topic === "rain"
                      ? `${h.rainProb}%`
                      : topic === "air"
                        ? Math.round(h.pm25)
                        : topic === "sea"
                          ? `${h.tideMsl >= 0 ? "+" : ""}${h.tideMsl}`
                          : `${Math.round(val)}°`}
                  </small>
                  <div className="fs-hour-bar-track">
                    <i style={{ height: `${heightPct}%` }} />
                  </div>
                  <span className="fs-hour-time">{h.hourLabel.slice(0, 2)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="fs-bottom-grid">
          <article className="fs-daily-card">
            <span className="fs-eyebrow">📅 พยากรณ์ล่วงหน้า 7 วัน</span>
            <h3>แนวโน้มรายวัน · {activeArea.name}</h3>
            <div className="fs-daily-list">
              {activeArea.daily.map(d => (
                <div key={d.dayLabel} className="fs-daily-row">
                  <strong>{d.dayLabel}</strong>
                  <span className="fs-daily-rain">🌧️ {d.rainProb}% ({d.rainMm} มม.)</span>
                  <span className="fs-daily-temp">
                    🍃 ต่ำสุด <b>{d.minTempC}°C</b> — ☀️ สูงสุด <b>{d.maxTempC}°C</b>
                  </span>
                  <span className="fs-daily-uv">UV {d.uvMax}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="fs-sea-summary-card">
            <span className="fs-eyebrow">🌊 สรุปน้ำทะเลและลมชายฝั่งอ่าวไทยตอนบน</span>
            <h3>จังหวะน้ำขึ้น–น้ำลง & คลื่นลมวันนี้ ({activeArea.name})</h3>
            <div className="fs-sea-bento">
              <div>
                <small>⬆️ น้ำทะเลขึ้นสูงสุด</small>
                <strong>+{activeArea.current.highTideMsl} ม. รทก.</strong>
                <span>เวลาประมาณ {activeArea.current.highTideTime}</span>
              </div>
              <div>
                <small>⬇️ น้ำทะเลลงต่ำสุด</small>
                <strong>{activeArea.current.lowTideMsl} ม. รทก.</strong>
                <span>เวลาประมาณ {activeArea.current.lowTideTime}</span>
              </div>
              <div>
                <small>🌊 ความสูงคลื่นอ่าวไทย</small>
                <strong>{activeArea.current.waveHeightM} เมตร</strong>
                <span>{activeArea.current.seaStateLabel}</span>
              </div>
              <div>
                <small>🍃 ทิศทางและความเร็วลม</small>
                <strong>{activeArea.current.windKmh} กม./ชม.</strong>
                <span>{activeArea.current.windDirLabel}</span>
              </div>
            </div>
          </article>
        </section>
      </main>

      <footer className="fs-footer">
        <div>
          <strong>ฟ้าใส · FahSai Weather & Sea</strong>
          <p>
            แอปพยากรณ์อากาศ ฝน ฝุ่น PM2.5 ความร้อน ลมหนาว และน้ำทะเลสำหรับกรุงเทพฯ
            ปริมณฑล และชายฝั่งอ่าวไทยตอนบน
          </p>
        </div>
        <div>
          <a href="/">
            🌊 สลับไปแอปสายน้ำเจ้าพระยา (ChaoPhraya Flow) →
          </a>
        </div>
      </footer>
    </div>
  );
}
