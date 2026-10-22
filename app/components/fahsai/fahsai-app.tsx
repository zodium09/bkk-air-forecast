"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect, useMemo, useState } from "react";

import {
  buildFallbackPayload,
  getBangkokHour,
  getBangkokClockText,
  type AreaForecast,
  type FahSaiPayload,
  type TopicId,
} from "../../lib/fahsai-data";
import "./fahsai.css";
import FahSaiTwinScene from "./fahsai-twin-scene";

type TwinCameraMode = "iso" | "atmosphere" | "coastal" | "top";

const TOPICS: {
  id: TopicId;
  icon: string;
  label: string;
  shortDesc: string;
  color: string;
  unit: string;
}[] = [
  {
    id: "rain",
    icon: "🌧️",
    label: "ฝน & พายุ",
    shortDesc: "โอกาสฝนตก ปริมาณฝน เรดาร์ และเวลาพกร่ม",
    color: "#0ea5e9",
    unit: "%",
  },
  {
    id: "air",
    icon: "😷",
    label: "ฝุ่น PM2.5",
    shortDesc: "ค่าฝุ่นละเอียด ดัชนีคุณภาพอากาศ และการสวมหน้ากาก",
    color: "#10b981",
    unit: "µg/m³",
  },
  {
    id: "heat",
    icon: "☀️",
    label: "ความร้อน & UV",
    shortDesc: "อุณหภูมิความรู้สึกร้อนจริง (RealFeel) และรังสียูวี",
    color: "#f97316",
    unit: "°C",
  },
  {
    id: "winter",
    icon: "🍃",
    label: "ลมหนาว & อากาศเย็น",
    shortDesc: "อุณหภูมิต่ำสุดเช้ามืด ทิศทางลมมรสุม และความเย็นสบาย",
    color: "#06b6d4",
    unit: "°C",
  },
  {
    id: "sea",
    icon: "🌊",
    label: "น้ำทะเล & คลื่นอ่าวไทย",
    shortDesc: "ระดับน้ำขึ้น–น้ำลง ความสูงคลื่น และความปลอดภัยชายฝั่ง",
    color: "#2563eb",
    unit: "ม. รทก.",
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

/**
 * 100% Aspect-Ratio-Locked EPSG:4326 Bounding Box for Bangkok, Vicinity & Upper Gulf of Thailand:
 * - dLng = 101.45 - 99.65 = 1.80°
 * - dLat = 14.05 - 12.85 = 1.20°
 * - Ratio dLng : dLat = 1.80 : 1.20 = 3 : 2
 * - FAHSAI_FRAME width : height = 480 : 320 = 3 : 2
 * - ArcGIS export size = 900,600 = 3 : 2
 * Zero distortion, 0.0000° bbox expansion!
 */
const FAHSAI_FRAME = {
  x: 20,
  y: 16,
  width: 480,
  height: 320,
};

const FAHSAI_BBOX = {
  minLng: 99.65,
  maxLng: 101.45,
  minLat: 12.85,
  maxLat: 14.05,
};

const FAHSAI_SAT_URL = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${FAHSAI_BBOX.minLng},${FAHSAI_BBOX.minLat},${FAHSAI_BBOX.maxLng},${FAHSAI_BBOX.maxLat}&bboxSR=4326&imageSR=4326&size=900,600&format=jpg&f=image`;
const FAHSAI_TOPO_URL = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/export?bbox=${FAHSAI_BBOX.minLng},${FAHSAI_BBOX.minLat},${FAHSAI_BBOX.maxLng},${FAHSAI_BBOX.maxLat}&bboxSR=4326&imageSR=4326&size=900,600&format=jpg&f=image`;

export function projectFahSaiGeo(lat: number, lng: number): { x: number; y: number } {
  const xRatio = (lng - FAHSAI_BBOX.minLng) / (FAHSAI_BBOX.maxLng - FAHSAI_BBOX.minLng);
  const yRatio = (lat - FAHSAI_BBOX.minLat) / (FAHSAI_BBOX.maxLat - FAHSAI_BBOX.minLat);
  const x = FAHSAI_FRAME.x + xRatio * FAHSAI_FRAME.width;
  const y = FAHSAI_FRAME.y + FAHSAI_FRAME.height - yRatio * FAHSAI_FRAME.height;
  return {
    x: Math.max(FAHSAI_FRAME.x + 8, Math.min(FAHSAI_FRAME.x + FAHSAI_FRAME.width - 8, x)),
    y: Math.max(FAHSAI_FRAME.y + 8, Math.min(FAHSAI_FRAME.y + FAHSAI_FRAME.height - 8, y)),
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

// Calibrated non-overlapping cartographic label offsets (dx, dy from exact WGS84 pin) for all 10 provinces
const AREA_LABEL_OFFSETS: Record<string, { dx: number; dy: number; shortName: string }> = {
  "pathum-thani": { dx: 48, dy: -16, shortName: "ปทุมธานี" },
  nonthaburi: { dx: -56, dy: -18, shortName: "นนทบุรี" },
  bangkok: { dx: 58, dy: -2, shortName: "กรุงเทพฯ" },
  "nakhon-pathom": { dx: -48, dy: -16, shortName: "นครปฐม" },
  chachoengsao: { dx: 42, dy: -16, shortName: "ฉะเชิงเทรา" },
  "samut-prakan": { dx: 56, dy: 24, shortName: "สมุทรปราการ" },
  "samut-sakhon": { dx: -54, dy: 22, shortName: "สมุทรสาคร" },
  "samut-songkhram": { dx: -52, dy: 20, shortName: "สมุทรสงคราม" },
  chonburi: { dx: -54, dy: -12, shortName: "ชลบุรี·พัทยา" },
  phetchaburi: { dx: 54, dy: -8, shortName: "เพชรบุรี·ชะอำ" },
};

// Real WGS84 Coastline of the Upper Gulf of Thailand
const UPPER_GULF_COASTLINE_WGS84: [number, number][] = [
  [12.85, 99.98],
  [13.11, 100.01],
  [13.28, 99.98],
  [13.40, 100.00],
  [13.48, 100.15],
  [13.52, 100.28],
  [13.58, 100.45],
  [13.595, 100.597],
  [13.52, 100.78],
  [13.47, 100.98],
  [13.36, 100.97],
  [13.15, 100.91],
  [12.88, 100.88],
];

// Real WGS84 4 Major River Estuaries flowing into the Upper Gulf
const ESTUARY_RIVERS_WGS84: { id: string; name: string; labelLat: number; labelLng: number; coords: [number, number][] }[] = [
  {
    id: "mae-klong",
    name: "แม่น้ำแม่กลอง",
    labelLat: 13.68,
    labelLng: 99.86,
    coords: [
      [14.04, 99.78],
      [13.80, 99.88],
      [13.56, 99.95],
      [13.40, 100.00],
    ],
  },
  {
    id: "tha-chin",
    name: "แม่น้ำท่าจีน",
    labelLat: 13.96,
    labelLng: 100.15,
    coords: [
      [14.04, 100.12],
      [13.82, 100.19],
      [13.65, 100.24],
      [13.52, 100.28],
    ],
  },
  {
    id: "chao-phraya",
    name: "แม่น้ำเจ้าพระยา",
    labelLat: 14.02,
    labelLng: 100.53,
    coords: [
      [14.04, 100.54],
      [13.95, 100.52],
      [13.86, 100.51],
      [13.75, 100.50],
      [13.66, 100.54],
      [13.595, 100.597],
    ],
  },
  {
    id: "bang-pakong",
    name: "แม่น้ำบางปะกง",
    labelLat: 13.88,
    labelLng: 101.13,
    coords: [
      [14.02, 101.18],
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

function getScienceExplainer(topic: TopicId): {
  title: string;
  subtitle: string;
  cards: { head: string; body: string }[];
} {
  if (topic === "rain") {
    return {
      title: "🔬 อธิบายวิชาการเข้าใจง่าย: ค่าเรดาร์ dBZ และโอกาสเกิดฝน (%)",
      subtitle: "ทำไมเรดาร์ตรวจพบเมฆฝนแต่บางจุดฝนไม่ตกหนัก? และค่า dBZ แปลว่าอะไร?",
      cards: [
        {
          head: "📡 1. ค่าการสะท้อนเรดาร์ (dBZ) คืออะไร?",
          body: "เรดาร์ส่งคลื่นไมโครเวฟไปกระทบหยดน้ำในเมฆ ค่า 20–30 dBZ (สีเขียว) คือฝนโปรยปราย (~1–3 มม./ชม.), ค่า 35–44 dBZ (สีเหลือง–ส้ม) คือฝนปานกลางถึงหนัก (~5–20 มม./ชม.) และ ≥ 45 dBZ (สีแดง) คือฝนตกหนักมากเสี่ยงน้ำท่วมขังรอระบาย",
        },
        {
          head: "🧭 2. ทิศทางลมกำหนดทิศทางกลุ่มฝนอย่างไร?",
          body: "กลุ่มเมฆฝนไม่ได้อยู่นิ่งแต่เคลื่อนที่ตามกระแสลมระดับบน–ล่าง (เช่น ลมตะวันออกเฉียงเหนือ หรือลมใต้จากอ่าวไทย) ลูกศรสีเหลืองบนแผนที่ช่วยบอกทิศทางและเวลาที่กลุ่มฝนจะเคลื่อนมาถึง (ETA นาที)",
        },
        {
          head: "☔ 3. โอกาสเกิดฝน 60% แปลว่าอะไร?",
          body: "โอกาสฝน 60% ไม่ได้แปลว่าฝนจะตก 60% ของเวลาทั้งวัน แต่หมายความว่า ณ จุดพิกัดที่คุณอยู่ มีโอกาส 6 ใน 10 ที่จะมีฝนตกลงมาวัดปริมาณได้ (ตั้งแต่ 0.1 มม. ขึ้นไป) ในช่วงเวลานั้น",
        },
      ],
    };
  }
  if (topic === "air") {
    return {
      title: "🔬 อธิบายวิชาการเข้าใจง่าย: ฝุ่น PM2.5 และปรากฏการณ์ฝาชีครอบ",
      subtitle: "ทำไมค่าฝุ่น PM2.5 มักพุ่งสูงช่วงเช้ามืด–สาย และลดลงเมื่อมีลมแรง?",
      cards: [
        {
          head: "🫧 1. ฝุ่น PM2.5 เล็กแค่ไหน?",
          body: "PM2.5 คือฝุ่นละอองขนาดไม่เกิน 2.5 ไมครอน (เล็กกว่าเส้นผมมนุษย์ราว 25 เท่า) สามารถผ่านขนจมูกเข้าสู่ถุงลมปอดและกระแสเลือดได้โดยตรง เกณฑ์ปลอดภัยมาตรฐานประเทศไทยกำหนดไว้ไม่เกิน 37.5 µg/m³ (ค่าเฉลี่ย 24 ชม.)",
        },
        {
          head: "🍲 2. ปรากฏการณ์ฝาชีครอบ (Temperature Inversion)",
          body: "ในคืนที่ฟ้าโปร่งและลมสงบ พื้นดินคายความร้อนเร็วทำให้อากาศเย็นตัวใกล้พื้นผิว ถูกชั้นอากาศอุ่นด้านบนกดทับไว้คล้าย “ฝาชีครอบ” ฝุ่นจากจราจรและแหล่งกำเนิดจึงลอยขึ้นข้างบนไม่ได้จนกว่าแดดช่วงบ่ายจะเผาพื้นดินให้เกิดการลอยตัว",
        },
        {
          head: "🌬️ 3. อัตราการระบายอากาศ (Ventilation Rate)",
          body: "เมื่อมีลมมรสุมตะวันออกเฉียงเหนือหรือลมทะเลพัดแรง (> 18 กม./ชม.) กระแสลมจะช่วยพัดระบายฝุ่นออกจากแอ่งกรุงเทพฯ สู่ทะเล ทำให้คุณภาพอากาศดีขึ้นอย่างรวดเร็ว",
        },
      ],
    };
  }
  if (topic === "heat") {
    return {
      title: "🔬 อธิบายวิชาการเข้าใจง่าย: ดัชนีความร้อน (Heat Index / RealFeel)",
      subtitle: "ทำไมอุณหภูมิเทอร์โมมิเตอร์วัดได้ 34°C แต่ร่างกายกลับรู้สึกร้อนถึง 40°C?",
      cards: [
        {
          head: "🌡️ 1. ความชื้นสัมพัทธ์กับกลไกการระเหยเหงื่อ",
          body: "ร่างกายมนุษย์ระบายความร้อนด้วยการขับเหงื่อให้ระเหยออกทางผิวหนัง แต่กรุงเทพฯ และชายฝั่งอ่าวไทยมีความชื้นในอากาศสูง (60–80%) ทำให้เหงื่อระเหยได้ช้าลง ความร้อนจึงสะสมอยู่ในร่างกายมากกว่าค่าที่วัดได้จากเทอร์โมมิเตอร์",
        },
        {
          head: "🚨 2. เกณฑ์เฝ้าระวังโรคลมแดด (Heatstroke)",
          body: "เมื่อค่าความรู้สึกร้อนจริง (RealFeel) แตะ 38–41°C จะเริ่มเกิดอาการอ่อนเพลีย ตะคริวแดด และหากเกิน 42°C ต่อเนื่อง มีความเสี่ยงเกิดภาวะฮีทสโตรก จึงควรดื่มน้ำเปล่าทุกชั่วโมงแม้ไม่รู้สึกกระหาย",
        },
        {
          head: "☀️ 3. ดัชนีรังสียูวี (UV Index) ช่วง 11:00–14:00 น.",
          body: "แม้จะมีเมฆบางส่วน รังสี UV-A และ UV-B ยังสามารถทะลุผ่านเมฆลงมาได้ถึง 70–80% เมื่อค่า UV Index ≥ 8 ควรสวมหมวก กางร่ม หรือทาครีมกันแดดเมื่ออยู่กลางแจ้งเกิน 15 นาที",
        },
      ],
    };
  }
  if (topic === "winter") {
    return {
      title: "🔬 อธิบายวิชาการเข้าใจง่าย: ลมมรสุมตะวันออกเฉียงเหนือ & อากาศเย็น",
      subtitle: "ลมหนาวเดินทางมาถึงกรุงเทพฯ ปริมณฑล และอ่าวไทยตอนบนได้อย่างไร?",
      cards: [
        {
          head: "🧭 1. บริเวณความกดอากาศสูงจากประเทศจีน",
          body: "เมื่อมวลอากาศเย็นกำลังแรง (ความกดอากาศสูง) แผ่ลงมาจากประเทศจีน จะผลักดันให้เกิดลมมรสุมตะวันออกเฉียงเหนือ (NE Monsoon) พัดพาอากาศเย็นและแห้งเข้าสู่ภาคกลางและกรุงเทพฯ",
        },
        {
          head: "🌅 2. ทำไมอากาศเย็นที่สุดช่วง 05:30–06:30 น.?",
          body: "ตลอดทั้งคืนพื้นดินคายความร้อนออกสู่อวกาศอย่างต่อเนื่อง (Radiative Cooling) โดยไม่มีแสงอาทิตย์เติมความร้อน อุณหภูมิจึงลดต่ำสุดในช่วงก่อนดวงอาทิตย์ขึ้นเล็กน้อย",
        },
        {
          head: "💨 3. ลมกระโชกแรงกับความรู้สึกเย็น (Wind Chill)",
          body: "กระแสลมที่พัดด้วยความเร็ว 20–30 กม./ชม. ช่วยพัดพาความร้อนออกจากผิวหนังเร็วขึ้น ทำให้เช้ามืดที่มีลมแรงจะรู้สึกเย็นสบายกว่าอุณหภูมิที่วัดได้จริงประมาณ 1–2°C",
        },
      ],
    };
  }
  return {
    title: "🔬 อธิบายวิชาการเข้าใจง่าย: น้ำขึ้น–น้ำลงอ่าวไทย & น้ำหนุนปากแม่น้ำ",
    subtitle: "อิทธิพลของดวงจันทร์และลมมรสุมส่งผลต่อระดับน้ำทะเลและปากแม่น้ำทั้ง 4 สายอย่างไร?",
    cards: [
      {
        head: "🌕 1. น้ำเกิด (Spring Tide) และ น้ำตาย (Neap Tide)",
        body: "ช่วงวันเพ็ญ (ขึ้น 15 ค่ำ) และวันเดือนดับ (แรม 15 ค่ำ) แรงดึงดูดของดวงจันทร์และดวงอาทิตย์เสริมกันในแนวเส้นตรง ทำให้พิสัยน้ำขึ้นสูงสุดและลงต่ำสุดมากกว่าปกติ เรียกว่า “น้ำเกิด”",
      },
      {
        head: "🌊 2. ปากแม่น้ำ 4 สายสำคัญของอ่าวไทยตอนบน",
        body: "แม่น้ำแม่กลอง ท่าจีน เจ้าพระยา และบางปะกง ไหลลงสู่อ่าวไทยตอนบนซึ่งมีลักษณะเป็นก้นอ่าวรูปตัว ก. เมื่อน้ำทะเลหนุนสูง (+1.35 ถึง +1.60 ม. รทก.) มวลน้ำทะเลจะดันย้อนเข้าปากแม่น้ำทำให้การระบายน้ำจืดช้าลง",
      },
      {
        head: "⚓ 3. ความสูงคลื่นมีนัยสำคัญ (Significant Wave Height)",
        body: "คลื่นสูง < 0.8 ม. ทะเลค่อนข้างสงบเรือเล็กสัญจรได้ปลอดภัย แต่หากมีลมมรสุมพัดแรงทำให้คลื่นสูงเกิน 1.3–2.0 ม. เรือประมงพื้นบ้านและเรือท่องเที่ยวชายฝั่งควรเพิ่มความระมัดระวัง",
      },
    ],
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
  const [hourIdx, setHourIdx] = useState<number>(() => getBangkokHour());
  const [dark, setDark] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // 3D Digital Twin camera state & live clock
  const [mainViewMode, setMainViewMode] = useState<"2d" | "3d">("2d");
  const [twinCamera, setTwinCamera] = useState<TwinCameraMode>("iso");
  const [twinAutoRotate, setTwinAutoRotate] = useState<boolean>(false);
  const [nowClockText, setNowClockText] = useState<string>(() => getBangkokClockText());

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
    const updateClock = () => {
      setNowClockText(getBangkokClockText());
    };
    const timer = window.setTimeout(() => {
      setHourIdx(getBangkokHour());
      updateClock();
      void loadData();
    }, 0);
    const interval = window.setInterval(updateClock, 30000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
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
  const science = useMemo(() => getScienceExplainer(topic), [topic]);

  // Compute Radar & Wind Trajectory analysis + Time-Window Quantitative Alerts
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

    const nowH = getBangkokHour();
    const sliceWindow = (startOffset: number, len: number, title: string, tag: string) => {
      const startH = (nowH + startOffset) % 24;
      const endH = (nowH + startOffset + len) % 24;
      const slots = Array.from({ length: len }, (_, k) => activeArea.hourly[(nowH + startOffset + k) % 24]).filter(Boolean);

      // For startOffset === 0 ("ตอนนี้ – 1 ชม."), synchronize directly with current live readings so risk tier is 100% consistent!
      const isNowSlot = startOffset === 0;
      const maxRainProb = isNowSlot
        ? c.rainProb
        : slots.length
          ? Math.max(...slots.map(s => s.rainProb))
          : c.rainProb;
      const sumRainMm = Number(
        (
          isNowSlot
            ? Math.max(rainRateMmHr * 0.6, (c.rainProb / 100) * 3.5)
            : slots.reduce((acc, s) => acc + (s.rainProb >= 35 ? (s.rainProb / 100) * 4.2 : (s.rainProb / 100) * 1.1), 0)
        ).toFixed(1)
      );
      const maxFeels = isNowSlot ? c.feelsLikeC : slots.length ? Math.max(...slots.map(s => s.feelsLikeC)) : c.feelsLikeC;
      const minTemp = isNowSlot ? c.minMorningC : slots.length ? Math.min(...slots.map(s => s.tempC)) : c.minMorningC;
      const maxPm25 = isNowSlot ? c.pm25 : slots.length ? Math.max(...slots.map(s => s.pm25)) : c.pm25;
      const maxWind = isNowSlot ? c.windKmh : slots.length ? Math.max(...slots.map(s => s.windKmh)) : c.windKmh;
      const maxTide = isNowSlot ? c.tideMsl : slots.length ? Math.max(...slots.map(s => s.tideMsl)) : c.highTideMsl;

      let slotTier: 1 | 2 | 3 | 4 | 5 = activeTier;
      if (isNowSlot) {
        slotTier = activeTier;
      } else if (topic === "rain") {
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
        windowText: isNowSlot
          ? `${title} (ณ เวลา ${nowClockText} น.)`
          : `${title} (${String(startH).padStart(2, "0")}:00–${String(endH).padStart(2, "0")}:00 น.)`,
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
        sliceWindow(0, 1, "ตอนนี้ – 1 ชม.", "ความเสี่ยง ณ เวลาปัจจุบัน"),
        sliceWindow(1, 3, "1–3 ชม. ข้างหน้า", "แจ้งเตือนระยะประชิด"),
        sliceWindow(3, 6, "3–6 ชม. ข้างหน้า", "แนวโน้มช่วงถัดไป"),
        sliceWindow(6, 12, "6–12 ชม. ข้างหน้า", "แนวโน้มล่วงหน้า 12 ชม."),
      ],
    };
  }, [activeArea, activeTier, activeTierColor, bands, topic, nowClockText]);

  // Build SVG path for the 24-hour animated curve chart
  const hourlyCurve = useMemo(() => {
    const pts = activeArea.hourly.map((h, i) => {
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
      const norm =
        topic === "rain"
          ? val / 100
          : topic === "air"
            ? Math.min(1, val / 80)
            : topic === "heat" || topic === "winter"
              ? Math.min(1, Math.max(0, (val - 18) / 26))
              : Math.min(1, Math.max(0, (val + 1.6) / 3.4));
      const x = 28 + (i / 23) * 704;
      const y = 112 - norm * 88;
      return { x, y, val, label: h.hourLabel };
    });
    const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},122 L${pts[0].x.toFixed(1)},122 Z`;
    const thresholdY =
      topic === "rain"
        ? 112 - 0.55 * 88
        : topic === "air"
          ? 112 - (37.5 / 80) * 88
          : topic === "heat"
            ? 112 - ((38 - 18) / 26) * 88
            : topic === "winter"
              ? 112 - ((22 - 18) / 26) * 88
              : 112 - ((1.35 + 1.6) / 3.4) * 88;
    const thresholdLabel =
      topic === "rain"
        ? "เกณฑ์เฝ้าระวังฝน 55%"
        : topic === "air"
          ? "เกณฑ์มาตรฐานไทย 37.5 µg/m³"
          : topic === "heat"
            ? "เกณฑ์เตือนความร้อน 38°C"
            : topic === "winter"
              ? "เกณฑ์อากาศเย็น 22°C"
              : "เกณฑ์เฝ้าระวังน้ำหนุน +1.35 ม.";

    return { pts, linePath, areaPath, thresholdY, thresholdLabel };
  }, [activeArea.hourly, topic]);

  const graticuleLats = [13.0, 13.3, 13.6, 13.9];
  const graticuleLngs = [99.8, 100.2, 100.6, 101.0, 101.3];

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
          <a href="#fs-3d-twin" className="fs-header-3d-pill" onClick={() => setMainViewMode("3d")}>
            🌐 แบบจำลอง 3D Twin
          </a>
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
        {/* PRIORITY 1: Topic Switcher */}
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

        {/* 3D DIGITAL TWIN QUICK LAUNCHER & MODE TOGGLE */}
        <div className="fs-3d-quick-banner" role="region" aria-label="แถบทางลัดแบบจำลอง 3 มิติ">
          <div className="fs-3d-quick-text">
            <span className="fs-3d-badge-pulse">3D LIVE</span>
            <span><b>แบบจำลอง 3 มิติ (Digital Twin):</b> จำลองชั้นบรรยากาศ เมฆฝนเรดาร์ ฝาชีครอบฝุ่น PM2.5 และอ่าวไทย</span>
          </div>
          <div className="fs-3d-quick-actions">
            <button
              type="button"
              className="fs-3d-tab-toggle"
              aria-pressed={mainViewMode === "3d"}
              onClick={() => setMainViewMode(m => m === "3d" ? "2d" : "3d")}
            >
              {mainViewMode === "3d" ? "🗺️ สลับดูแผนที่ 2D" : "🌐 เปิดมุมมอง 3D ในการ์ดหลัก"}
            </button>
            <a href="#fs-3d-twin" className="fs-3d-jump-btn">
              ดูแบบจำลอง 3D เต็มจอ ↓
            </a>
          </div>
        </div>

        {/* PRIORITY 2: MAIN HERO CARDS (Primary Area Hero Card on Left + Geospatial Satellite Map Card on Right) */}
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
                🚨 ความเสี่ยงตอนนี้ (ณ เวลา {nowClockText} น.) · ระดับ {activeTier}/5 · {advice.badge}
              </span>
            </div>

            <div className="fs-hero-showcase">
              <div className="fs-hero-big-metric">
                {topic === "rain" && (
                  <>
                    <small>โอกาสเกิดฝนวันนี้ (ณ เวลา {nowClockText} น.)</small>
                    <strong>
                      {activeArea.current.rainProb}
                      <span>%</span>
                    </strong>
                    <span>สะสม 24 ชม. ~{activeArea.current.rain24hMm} มม. · เรดาร์ {radarAndSchedule.dbz} dBZ</span>
                  </>
                )}
                {topic === "air" && (
                  <>
                    <small>ค่าฝุ่นละออง PM2.5 (ณ เวลา {nowClockText} น.)</small>
                    <strong>
                      {activeArea.current.pm25}
                      <span>µg/m³</span>
                    </strong>
                    <span>ดัชนี US AQI {activeArea.current.aqi}</span>
                  </>
                )}
                {topic === "heat" && (
                  <>
                    <small>ความรู้สึกร้อนจริง RealFeel (ณ เวลา {nowClockText} น.)</small>
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
                    <small>อุณหภูมิต่ำสุดเช้ามืด (อัปเดต {nowClockText} น.)</small>
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
                    <small>ระดับน้ำทะเลอ่าวไทยตอนบน (ณ เวลา {nowClockText} น.)</small>
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
              <strong>💡 คำแนะนำปฏิบัติตัวสำหรับคนทั่วไป: {advice.headline}</strong>
              <p>{advice.action}</p>
              <small>📍 บริบทพื้นที่: {activeArea.coastalNote}</small>
            </div>

            <div className="fs-risk-legend-box">
              <small className="fs-eyebrow">🎨 เกณฑ์สัญลักษณ์สีตามระดับความเสี่ยง 5 ระดับ ({TOPICS.find(t => t.id === topic)?.label})</small>
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
                <span className="fs-eyebrow">🛰️ แผนที่ดาวเทียมภูมิสารสนเทศพิกัดจริง (WGS84 · 99.65°E–101.45°E)</span>
                <h2>แผนที่ความเสี่ยง 5 ระดับ เรดาร์เมฆฝน และทิศทางลม กทม.–อ่าวไทยตอนบน</h2>
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
                  ⛰️ แผนที่ภูมิประเทศ
                </button>
                <button
                  type="button"
                  aria-pressed={mainViewMode === "2d" && basemap === "dark"}
                  onClick={() => { setMainViewMode("2d"); setBasemap("dark"); }}
                >
                  🌑 แผนที่มืดเน้นสัญลักษณ์
                </button>
                <button
                  type="button"
                  className="fs-3d-toggle-btn"
                  aria-pressed={mainViewMode === "3d"}
                  onClick={() => setMainViewMode(m => m === "3d" ? "2d" : "3d")}
                >
                  🌐 แบบจำลอง 3D Twin
                </button>
              </div>
            </div>

            <div className="fs-qgis-subtoolbar">
              <div className="fs-zone-filters">
                <button type="button" aria-pressed={zoneFilter === "all"} onClick={() => setZoneFilter("all")}>
                  ทั้งหมด (10 จังหวัด)
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
                  📡 เรดาร์ฝน & เวกเตอร์ลม
                </button>
                <button type="button" aria-pressed={showBuffer} onClick={() => setShowBuffer(v => !v)}>
                  🎯 รัศมีความเสี่ยง
                </button>
                <button type="button" aria-pressed={showGrid} onClick={() => setShowGrid(v => !v)}>
                  📐 กริดพิกัด (°N/°E)
                </button>
              </div>
            </div>

            {mainViewMode === "3d" ? (
              <div className="fs-map-embedded-3d">
                <div className="fs-3d-inline-header">
                  <span>🌐 กำลังแสดงแบบจำลอง 3 มิติแบบอนิเมชัน ({activeArea.name} · ณ เวลา {nowClockText} น.)</span>
                  <div className="fs-3d-btn-group" role="group" aria-label="เลือกมุมกล้อง 3 มิติ">
                    <button type="button" aria-pressed={twinCamera === "iso"} onClick={() => setTwinCamera("iso")}>📐 3D Iso</button>
                    <button type="button" aria-pressed={twinCamera === "atmosphere"} onClick={() => setTwinCamera("atmosphere")}>🌩️ บรรยากาศ</button>
                    <button type="button" aria-pressed={twinCamera === "coastal"} onClick={() => setTwinCamera("coastal")}>🌊 อ่าวไทย</button>
                    <button type="button" aria-pressed={twinCamera === "top"} onClick={() => setTwinCamera("top")}>🦅 มุมสูง</button>
                    <button type="button" aria-pressed={twinAutoRotate} onClick={() => setTwinAutoRotate(v => !v)}>
                      {twinAutoRotate ? "⏸️ หยุด" : "🔄 หมุน"}
                    </button>
                  </div>
                </div>
                <FahSaiTwinScene camera={twinCamera} autoRotate={twinAutoRotate} onManualMove={() => setTwinAutoRotate(false)} hud={
            <div className="fs-3d-hud">
              <span>🎯 พื้นที่โฟกัส: <b>{activeArea.name} ({activeArea.lat.toFixed(2)}°N, {activeArea.lng.toFixed(2)}°E)</b></span>
              <span>🚨 ความเสี่ยงตอนนี้ ({nowClockText} น.): <b style={{ color: activeTierColor }}>ระดับ {activeTier}/5</b></span>
              <span>📡 เรดาร์: <b>{radarAndSchedule.dbz} dBZ</b> · ลม{activeArea.current.windDirLabel} <b>{activeArea.current.windKmh} กม./ชม.</b></span>
              <span>🌊 น้ำทะเล: <b>{activeHour.tideMsl >= 0 ? "+" : ""}{activeHour.tideMsl} ม. รทก.</b> (เวลาเลือก {activeHour.hourLabel} น.)</span>
            </div>

            }>
              {/* 3D Terrain & Upper Gulf Base Slab */}
              <div className="fs-3d-slab">
                <div className="fs-3d-slab-grid" />

                {/* Landmass Zone (Bangkok & Metro Plains) */}
                <div className="fs-3d-land-zone">
                  <span className="fs-3d-zone-label">🏙️ แอ่งที่ราบกรุงเทพฯ · ปริมณฑล & ปากแม่น้ำ 4 สาย</span>

                  {/* 3D Extruded Urban Skyline Blocks (Bangkok Core) */}
                  <div className="fs-3d-skyline">
                    <div className="fs-3d-bldg b1" />
                    <div className="fs-3d-bldg b2" />
                    <div className="fs-3d-bldg b3" />
                    <div className="fs-3d-bldg b4" />
                    <div className="fs-3d-bldg b5" />
                  </div>
                </div>

                {/* Upper Gulf of Thailand 3D Animated Water Body */}
                <div
                  className="fs-3d-sea-zone"
                  style={{
                    transform: `translateZ(${Math.max(4, Math.round((activeHour.tideMsl + 1.4) * 7))}px)`,
                  }}
                >
                  <div className="fs-3d-sea-wave w1" />
                  <div className="fs-3d-sea-wave w2" />
                  <span className="fs-3d-zone-label">
                    🌊 อ่าวไทยตอนบน · คลื่น {activeArea.current.waveHeightM} ม. · ระดับน้ำ {activeHour.tideMsl >= 0 ? "+" : ""}{activeHour.tideMsl} ม. รทก.
                  </span>
                </div>

                {/* 3D PM2.5 Inversion Layer Dome ("ฝาชีครอบ 3 มิติ") */}
                <div
                  className="fs-3d-inversion-dome"
                  style={{
                    opacity: topic === "air" ? 0.85 : activeArea.current.pm25 > 28 ? 0.55 : 0.28,
                    borderColor: activeArea.current.pm25 > 37.5 ? "#f97316" : "#10b981",
                    background:
                      activeArea.current.pm25 > 37.5
                        ? "radial-gradient(ellipse at center, rgba(249, 115, 22, 0.34), rgba(234, 179, 8, 0.12) 70%, transparent)"
                        : "radial-gradient(ellipse at center, rgba(16, 185, 129, 0.22), rgba(6, 182, 212, 0.08) 70%, transparent)",
                  }}
                >
                  <span className="fs-3d-dome-tag">
                    😷 ชั้นฝาชีครอบ (Mixing Height) · PM2.5 {activeHour.pm25} µg/m³
                  </span>
                </div>

                {/* 3D Extruded Province Metric Pillars for All 10 Areas */}
                {filteredAreas.map(area => {
                  const xPct = ((area.lng - FAHSAI_BBOX.minLng) / (FAHSAI_BBOX.maxLng - FAHSAI_BBOX.minLng)) * 100;
                  const yPct = (1 - (area.lat - FAHSAI_BBOX.minLat) / (FAHSAI_BBOX.maxLat - FAHSAI_BBOX.minLat)) * 100;
                  const rTier = classifyAreaRisk(area, topic);
                  const col = bands.find(b => b.tier === rTier)?.color ?? "#0ea5e9";
                  const isSel = area.id === activeArea.id;
                  const metricText = pinMetricLabel(area, topic);
                  const heightPx = isSel ? 88 : 34 + rTier * 11;

                  return (
                    <div
                      key={`twin-area-${area.id}`}
                      className={`fs-3d-area-anchor ${isSel ? "is-selected" : ""}`}
                      style={{ left: `${Math.min(92, Math.max(8, xPct))}%`, top: `${Math.min(90, Math.max(10, yPct))}%` }}
                      onClick={() => setSelectedId(area.id)}
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(area.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`เลือกพื้นที่ 3 มิติ ${area.name}`}
                    >
                      <div className="fs-3d-area-ring" style={{ borderColor: col }} />
                      <div
                        className="fs-3d-area-pillar"
                        style={{
                          height: `${heightPx}px`,
                          background: `linear-gradient(180deg, ${col} 0%, rgba(14, 165, 233, 0.85) 100%)`,
                          boxShadow: `0 0 18px ${col}`,
                        }}
                      />
                      <div className="fs-3d-area-label" style={{ borderColor: isSel ? "#ffffff" : col }}>
                        <strong>{AREA_LABEL_OFFSETS[area.id]?.shortName ?? area.name}</strong>
                        <span>{metricText} · ระดับ {rTier}</span>
                      </div>
                    </div>
                  );
                })}

                {/* Upper Atmospheric Plane (Z = +118px): 3D Storm Clouds, Rain Shafts, Solar UV & Wind Streamlines */}
                <div className="fs-3d-upper-air">
                  <div className="fs-3d-storm-cell">
                    <div className="fs-3d-cloud-badge">
                      ⛈️ เมฆฝนเรดาร์ {radarAndSchedule.dbz} dBZ · ฝน {activeHour.rainProb}% (~{radarAndSchedule.rainRateMmHr} มม./ชม.)
                    </div>
                    {activeHour.rainProb >= 25 && <div className="fs-3d-rain-shaft" />}
                  </div>

                  <div className="fs-3d-solar-badge">
                    ☀️ รังสี UV {activeArea.current.uvIndex} · ร้อนจริง {activeHour.feelsLikeC}°C
                  </div>

                  <div
                    className="fs-3d-wind-ribbon"
                    style={{
                      transform: `rotateZ(${activeArea.current.windDeg + 180}deg)`,
                    }}
                  >
                    <span>💨 กระแสลม{activeArea.current.windDirLabel} {activeHour.windKmh} กม./ชม. ➔</span>
                  </div>
                </div>
              </div>
            </FahSaiTwinScene>
              </div>
            ) : (
              <>
                <div className="fs-svg-map-wrap is-qgis">
              <svg
                viewBox="0 0 520 352"
                className="fs-svg-map"
                role="img"
                aria-label="แผนที่ภาพถ่ายดาวเทียมตรึงพิกัด WGS84 อัตราส่วน 1:1 กรุงเทพฯ ปริมณฑล และอ่าวไทยตอนบน พร้อมสัญลักษณ์ความเสี่ยง เรดาร์ฝน และทิศทางลม"
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

                {/* 100% Aspect-Ratio-Locked Georeferenced Satellite / Topo Image (BBox 99.65..101.45°E, 12.85..14.05°N in WGS84) */}
                {basemap === "satellite" && (
                  <image
                    href={FAHSAI_SAT_URL}
                    x={FAHSAI_FRAME.x}
                    y={FAHSAI_FRAME.y}
                    width={FAHSAI_FRAME.width}
                    height={FAHSAI_FRAME.height}
                    preserveAspectRatio="none"
                    opacity="0.93"
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
                    opacity="0.93"
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

                  {/* Georeferenced 4 Major River Estuaries + Animated Flow Particles */}
                  {ESTUARY_RIVERS_WGS84.map(river => {
                    const rPath = projectFahSaiPolyline(river.coords);
                    return (
                      <g key={river.id}>
                        <path
                          d={rPath}
                          fill="none"
                          stroke="rgba(8, 25, 42, 0.78)"
                          strokeWidth={river.id === "chao-phraya" ? "5.2" : "3.8"}
                          strokeLinecap="round"
                        />
                        <path
                          d={rPath}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth={river.id === "chao-phraya" ? "3" : "2"}
                          strokeLinecap="round"
                        />
                        <circle r="2.5" fill="#ffffff" opacity="0.9">
                          <animateMotion dur="4.2s" repeatCount="indefinite" path={rPath} />
                        </circle>
                      </g>
                    );
                  })}

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
                            opacity={0.52}
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
                          const moveRad = ((area.current.windDeg + 180 - 90) * Math.PI) / 180;
                          const distPx = 34;
                          const tx = pt.x + Math.cos(moveRad) * distPx;
                          const ty = pt.y + Math.sin(moveRad) * distPx;
                          const dbzColor = area.current.rainProb >= 60 ? "#ef4444" : area.current.rainProb >= 45 ? "#f97316" : "#22c55e";
                          return (
                            <g key={`radar-${area.id}`}>
                              <g filter="url(#fs-radar-blur)">
                                <ellipse cx={pt.x} cy={pt.y} rx="28" ry="19" fill="#22c55e" opacity="0.36" />
                                <ellipse cx={pt.x} cy={pt.y} rx="17" ry="11" fill={dbzColor} opacity="0.56" />
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

                      {[
                        { lat: 13.92, lng: 100.88 },
                        { lat: 13.68, lng: 100.25 },
                        { lat: 13.18, lng: 100.42 },
                        { lat: 13.12, lng: 100.78 },
                      ].map((w, idx) => {
                        const p1 = projectFahSaiGeo(w.lat, w.lng);
                        const moveRad = ((activeArea.current.windDeg + 180 - 90) * Math.PI) / 180;
                        const p2 = {
                          x: p1.x + Math.cos(moveRad) * 38,
                          y: p1.y + Math.sin(moveRad) * 38,
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
                            <text
                              x={(p1.x + p2.x) / 2}
                              y={(p1.y + p2.y) / 2 - 4}
                              fill="#bae6fd"
                              stroke="rgba(8,24,40,0.85)"
                              strokeWidth="2"
                              paintOrder="stroke"
                              fontSize="7.5"
                              fontWeight="700"
                              textAnchor="middle"
                            >
                              ลม {activeArea.current.windKmh} กม./ชม.
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  )}

                  {/* Upper Gulf of Thailand Waves at real coordinates (13.16°N, 100.45°E) */}
                  {(() => {
                    const gulfCenter = projectFahSaiGeo(13.16, 100.45);
                    return (
                      <g className="fs-gulf-waves">
                        <path
                          d={`M${gulfCenter.x - 56},${gulfCenter.y - 10} Q${gulfCenter.x - 28},${gulfCenter.y - 17} ${gulfCenter.x},${gulfCenter.y - 10} T${gulfCenter.x + 56},${gulfCenter.y - 10}`}
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
                          🌊 อ่าวไทยตอนบน (13.16°N, 100.45°E)
                        </text>
                      </g>
                    );
                  })()}

                  {/* Georeferenced Province Symbology + Smart Leader-Line Non-Overlapping Callout Pills */}
                  {filteredAreas.map(area => {
                    const pt = projectFahSaiGeo(area.lat, area.lng);
                    const isSel = area.id === activeArea.id;
                    const metric = pinMetricLabel(area, topic);
                    const rTier = classifyAreaRisk(area, topic);
                    const riskColor = bands.find(b => b.tier === rTier)?.color ?? "#0284c7";
                    const offset = AREA_LABEL_OFFSETS[area.id] ?? { dx: 0, dy: -22, shortName: area.name.split(" ")[0] };
                    const pillW = 86;
                    const pillH = 22;

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
                        {isSel && <circle r="18" className="fs-pin-pulse" style={{ fill: riskColor }} />}
                        {/* Leader Line from exact coordinate point to non-overlapping callout pill */}
                        <line
                          x1="0"
                          y1="0"
                          x2={offset.dx}
                          y2={offset.dy}
                          stroke="#ffffff"
                          strokeWidth={isSel ? "2" : "1.3"}
                          opacity="0.92"
                        />
                        {/* Exact Georeferenced Coordinate Symbol */}
                        <circle
                          r={isSel ? 7 : rTier >= 4 ? 6 : 5}
                          fill={riskColor}
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                        <circle r="2" fill="#ffffff" />

                        {/* Non-Overlapping Callout Pill */}
                        <g transform={`translate(${offset.dx}, ${offset.dy})`}>
                          <rect
                            x={-pillW / 2}
                            y={-pillH / 2}
                            width={pillW}
                            height={pillH}
                            rx="11"
                            fill="rgba(12, 28, 44, 0.92)"
                            stroke={isSel ? "#ffffff" : riskColor}
                            strokeWidth={isSel ? "2.2" : "1.4"}
                          />
                          <circle cx={-pillW / 2 + 10} cy="0" r="4.5" fill={riskColor} />
                          <text x="4" y="3.5" textAnchor="middle" fill="#ffffff" fontSize="9.5" fontWeight="800">
                            {offset.shortName} {metric}
                          </text>
                        </g>
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
                  <circle r="18" fill="rgba(12, 28, 44, 0.85)" stroke="rgba(255,255,255,0.45)" />
                  <polygon points="0,-12 -5,6 0,3 5,6" fill="#ffffff" />
                  <text x="0" y="14" textAnchor="middle" fill="#7dd3fc" fontSize="8" fontWeight="800">N</text>
                </g>

                {/* Geographically calibrated Scale Bar (30 km ≈ 75 px at 13.5°N where 1° = 266.7 px) */}
                <g transform="translate(30, 314)">
                  <rect x="-4" y="-12" width="118" height="20" rx="4" fill="rgba(12, 28, 44, 0.85)" />
                  <rect x="2" y="1" width="38" height="4" fill="#ffffff" />
                  <rect x="40" y="1" width="38" height="4" fill="#38bdf8" />
                  <text x="2" y="-2" fill="#ffffff" fontSize="8" fontWeight="700">0</text>
                  <text x="36" y="-2" fill="#ffffff" fontSize="8" fontWeight="700">15</text>
                  <text x="74" y="-2" fill="#7dd3fc" fontSize="8" fontWeight="700">30 กม.</text>
                </g>

                <rect x={FAHSAI_FRAME.x} y={FAHSAI_FRAME.y} width={FAHSAI_FRAME.width} height={FAHSAI_FRAME.height} fill="none" stroke="#ffffff" strokeWidth="2" />
                <rect x="16" y="12" width="488" height="328" fill="none" stroke="#0c2e44" strokeWidth="4" strokeDasharray="20 20" />
              </svg>

              <div className="fs-qgis-titleblock">
                <div>
                  <small>GEOSPATIAL DATUM: WGS 84 (EPSG:4326) · TRUE 1:1 EXTENT: 99.65°E–101.45°E, 12.85°N–14.05°N</small>
                  <strong>แผนที่ดาวเทียมพิกัดจริง + สัญลักษณ์ความเสี่ยง & เรดาร์ทิศทางฝนลม ({TOPICS.find(t => t.id === topic)?.label})</strong>
                </div>
                <span>
                  {activeArea.name} · ความเสี่ยงตอนนี้ (ณ เวลา {nowClockText} น.): <b>ระดับ {activeTier}/5</b>
                </span>
              </div>
            </div>

            <div className="fs-qgis-commentary">
              <strong>📐 สรุปการวิเคราะห์เชิงพื้นที่ & เรดาร์ (Spatial & Radar Summary):</strong>
              <p>
                พื้นที่ <b>{activeArea.name}</b> (พิกัดจริง <code>{activeArea.lat.toFixed(4)}°N, {activeArea.lng.toFixed(4)}°E</code>) ณ เวลา <b>{nowClockText} น.</b> จัดอยู่ในเกณฑ์{" "}
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
              </>
            )}
          </article>
        </section>

        {/* BELOW MAIN HERO CARDS (ใต้การ์ดหลัก): Live Risk Status Now (with Current Time) + Radar Trajectory + 4 Time-Window Quantitative Schedule */}
        <section className="fs-live-alert-section" aria-label="ความเสี่ยงตอนนี้และตารางแจ้งเตือนรายช่วงเวลาใต้การ์ดหลัก">
          <div className="fs-live-alert-top">
            <div className="fs-live-alert-badges">
              <span className="fs-live-risk-pill" style={{ background: activeTierColor }}>
                🚨 ความเสี่ยงตอนนี้ ({activeArea.name} · ณ เวลา {nowClockText} น.): ระดับ {activeTier}/5 · {bands.find(b => b.tier === activeTier)?.label}
              </span>
              <span className="fs-live-radar-pill">
                📡 เรดาร์กลุ่มฝน {radarAndSchedule.dbz} dBZ (~{radarAndSchedule.rainRateMmHr} มม./ชม.) · ลม{activeArea.current.windDirLabel} {activeArea.current.windKmh} กม./ชม.
              </span>
              <span className="fs-live-coord-pill">
                📍 พิกัด {activeArea.lat.toFixed(4)}°N, {activeArea.lng.toFixed(4)}°E
              </span>
            </div>
            <p className="fs-live-radar-desc">
              🧭 <strong>วิเคราะห์เรดาร์และทิศทางฝน–ลมตอนนี้ (ณ เวลา {nowClockText} น.):</strong> ลม{activeArea.current.windDirLabel}พัดด้วยความเร็ว{" "}
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

        {/* PRO 3D ANIMATED ATMOSPHERIC, URBAN & COASTAL DIGITAL TWIN */}
        <section className="fs-3d-twin-section" id="fs-3d-twin" aria-label="แบบจำลองบรรยากาศ เมือง และอ่าวไทย 3 มิติแบบอนิเมชัน">
          <div className="fs-3d-twin-head">
            <div>
              <span className="fs-eyebrow">🌐 3D ATMOSPHERIC, URBAN & COASTAL DIGITAL TWIN · แบบจำลอง 3 มิติแบบอนิเมชัน</span>
              <h2>
                จำลองชั้นบรรยากาศ เมฆฝนเรดาร์ ฝาชีครอบฝุ่น PM2.5 ความร้อนเมือง และคลื่นน้ำหนุนอ่าวไทย 3 มิติ ({activeArea.name} · ณ เวลา {nowClockText} น.)
              </h2>
              <p>
                แสดงความสัมพันธ์เชิงลึก 3 มิติ ตั้งแต่ชั้นเมฆฝนระดับบน ชั้นการกดทับของฝุ่นละออง (Inversion Dome) เหนือตึกสูงกรุงเทพฯ–ปริมณฑล ไปจนถึงมวลน้ำทะเลอ่าวไทยที่หนุนเข้าสู่ปากแม่น้ำทั้ง 4 สาย
              </p>
            </div>
            <div className="fs-3d-controls">
              <div className="fs-3d-btn-group" role="group" aria-label="เลือกมุมกล้อง 3 มิติ">
                <button type="button" aria-pressed={twinCamera === "iso"} onClick={() => setTwinCamera("iso")}>
                  📐 มุมมอง 3D Isometric
                </button>
                <button type="button" aria-pressed={twinCamera === "atmosphere"} onClick={() => setTwinCamera("atmosphere")}>
                  🌩️ ซูมชั้นบรรยากาศ–เรดาร์เมฆ
                </button>
                <button type="button" aria-pressed={twinCamera === "coastal"} onClick={() => setTwinCamera("coastal")}>
                  🌊 ซูมคลื่น–ปากแม่น้ำอ่าวไทย
                </button>
                <button type="button" aria-pressed={twinCamera === "top"} onClick={() => setTwinCamera("top")}>
                  🦅 มุมสูง Bird’s-Eye 3D
                </button>
                <button
                  type="button"
                  aria-pressed={twinAutoRotate}
                  onClick={() => setTwinAutoRotate(v => !v)}
                >
                  {twinAutoRotate ? "⏸️ หยุดหมุน 3D" : "🔄 หมุน 3D อัตโนมัติ"}
                </button>
              </div>
            </div>
          </div>

          <FahSaiTwinScene camera={twinCamera} autoRotate={twinAutoRotate} onManualMove={() => setTwinAutoRotate(false)} hud={
            <div className="fs-3d-hud">
              <span>🎯 พื้นที่โฟกัส: <b>{activeArea.name} ({activeArea.lat.toFixed(2)}°N, {activeArea.lng.toFixed(2)}°E)</b></span>
              <span>🚨 ความเสี่ยงตอนนี้ ({nowClockText} น.): <b style={{ color: activeTierColor }}>ระดับ {activeTier}/5</b></span>
              <span>📡 เรดาร์: <b>{radarAndSchedule.dbz} dBZ</b> · ลม{activeArea.current.windDirLabel} <b>{activeArea.current.windKmh} กม./ชม.</b></span>
              <span>🌊 น้ำทะเล: <b>{activeHour.tideMsl >= 0 ? "+" : ""}{activeHour.tideMsl} ม. รทก.</b> (เวลาเลือก {activeHour.hourLabel} น.)</span>
            </div>

            }>
              {/* 3D Terrain & Upper Gulf Base Slab */}
              <div className="fs-3d-slab">
                <div className="fs-3d-slab-grid" />

                {/* Landmass Zone (Bangkok & Metro Plains) */}
                <div className="fs-3d-land-zone">
                  <span className="fs-3d-zone-label">🏙️ แอ่งที่ราบกรุงเทพฯ · ปริมณฑล & ปากแม่น้ำ 4 สาย</span>

                  {/* 3D Extruded Urban Skyline Blocks (Bangkok Core) */}
                  <div className="fs-3d-skyline">
                    <div className="fs-3d-bldg b1" />
                    <div className="fs-3d-bldg b2" />
                    <div className="fs-3d-bldg b3" />
                    <div className="fs-3d-bldg b4" />
                    <div className="fs-3d-bldg b5" />
                  </div>
                </div>

                {/* Upper Gulf of Thailand 3D Animated Water Body */}
                <div
                  className="fs-3d-sea-zone"
                  style={{
                    transform: `translateZ(${Math.max(4, Math.round((activeHour.tideMsl + 1.4) * 7))}px)`,
                  }}
                >
                  <div className="fs-3d-sea-wave w1" />
                  <div className="fs-3d-sea-wave w2" />
                  <span className="fs-3d-zone-label">
                    🌊 อ่าวไทยตอนบน · คลื่น {activeArea.current.waveHeightM} ม. · ระดับน้ำ {activeHour.tideMsl >= 0 ? "+" : ""}{activeHour.tideMsl} ม. รทก.
                  </span>
                </div>

                {/* 3D PM2.5 Inversion Layer Dome ("ฝาชีครอบ 3 มิติ") */}
                <div
                  className="fs-3d-inversion-dome"
                  style={{
                    opacity: topic === "air" ? 0.85 : activeArea.current.pm25 > 28 ? 0.55 : 0.28,
                    borderColor: activeArea.current.pm25 > 37.5 ? "#f97316" : "#10b981",
                    background:
                      activeArea.current.pm25 > 37.5
                        ? "radial-gradient(ellipse at center, rgba(249, 115, 22, 0.34), rgba(234, 179, 8, 0.12) 70%, transparent)"
                        : "radial-gradient(ellipse at center, rgba(16, 185, 129, 0.22), rgba(6, 182, 212, 0.08) 70%, transparent)",
                  }}
                >
                  <span className="fs-3d-dome-tag">
                    😷 ชั้นฝาชีครอบ (Mixing Height) · PM2.5 {activeHour.pm25} µg/m³
                  </span>
                </div>

                {/* 3D Extruded Province Metric Pillars for All 10 Areas */}
                {filteredAreas.map(area => {
                  const xPct = ((area.lng - FAHSAI_BBOX.minLng) / (FAHSAI_BBOX.maxLng - FAHSAI_BBOX.minLng)) * 100;
                  const yPct = (1 - (area.lat - FAHSAI_BBOX.minLat) / (FAHSAI_BBOX.maxLat - FAHSAI_BBOX.minLat)) * 100;
                  const rTier = classifyAreaRisk(area, topic);
                  const col = bands.find(b => b.tier === rTier)?.color ?? "#0ea5e9";
                  const isSel = area.id === activeArea.id;
                  const metricText = pinMetricLabel(area, topic);
                  const heightPx = isSel ? 88 : 34 + rTier * 11;

                  return (
                    <div
                      key={`twin-area-${area.id}`}
                      className={`fs-3d-area-anchor ${isSel ? "is-selected" : ""}`}
                      style={{ left: `${Math.min(92, Math.max(8, xPct))}%`, top: `${Math.min(90, Math.max(10, yPct))}%` }}
                      onClick={() => setSelectedId(area.id)}
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(area.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`เลือกพื้นที่ 3 มิติ ${area.name}`}
                    >
                      <div className="fs-3d-area-ring" style={{ borderColor: col }} />
                      <div
                        className="fs-3d-area-pillar"
                        style={{
                          height: `${heightPx}px`,
                          background: `linear-gradient(180deg, ${col} 0%, rgba(14, 165, 233, 0.85) 100%)`,
                          boxShadow: `0 0 18px ${col}`,
                        }}
                      />
                      <div className="fs-3d-area-label" style={{ borderColor: isSel ? "#ffffff" : col }}>
                        <strong>{AREA_LABEL_OFFSETS[area.id]?.shortName ?? area.name}</strong>
                        <span>{metricText} · ระดับ {rTier}</span>
                      </div>
                    </div>
                  );
                })}

                {/* Upper Atmospheric Plane (Z = +118px): 3D Storm Clouds, Rain Shafts, Solar UV & Wind Streamlines */}
                <div className="fs-3d-upper-air">
                  <div className="fs-3d-storm-cell">
                    <div className="fs-3d-cloud-badge">
                      ⛈️ เมฆฝนเรดาร์ {radarAndSchedule.dbz} dBZ · ฝน {activeHour.rainProb}% (~{radarAndSchedule.rainRateMmHr} มม./ชม.)
                    </div>
                    {activeHour.rainProb >= 25 && <div className="fs-3d-rain-shaft" />}
                  </div>

                  <div className="fs-3d-solar-badge">
                    ☀️ รังสี UV {activeArea.current.uvIndex} · ร้อนจริง {activeHour.feelsLikeC}°C
                  </div>

                  <div
                    className="fs-3d-wind-ribbon"
                    style={{
                      transform: `rotateZ(${activeArea.current.windDeg + 180}deg)`,
                    }}
                  >
                    <span>💨 กระแสลม{activeArea.current.windDirLabel} {activeHour.windKmh} กม./ชม. ➔</span>
                  </div>
                </div>
              </div>
            </FahSaiTwinScene>
        </section>

        {/* PRIORITY 3: Interactive 24-Hour Animated Curve & Bar Scrubber */}
        <section className="fs-timeline-section" aria-labelledby="fs-hourly-title">
          <div className="fs-section-head">
            <div>
              <span className="fs-eyebrow">📈 กราฟโต้ตอบรายชั่วโมง 24 ชม. (Interactive 24-Hour Curve & Scrubber)</span>
              <h2 id="fs-hourly-title">
                เส้นแนวโน้มและระดับเฝ้าระวังรายชั่วโมงของ {activeArea.name}
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

          {/* Animated SVG Curve Chart with Threshold Line */}
          <p className="fs-mobile-chart-hint">เลื่อนกราฟและแถบชั่วโมงซ้าย–ขวาเพื่อดูครบ 24 ชั่วโมง</p>
          <div className="fs-curve-svg-wrap">
            <svg viewBox="0 0 760 135" className="fs-curve-svg" role="img" aria-label={`กราฟเส้นโค้งรายชั่วโมง 24 ชั่วโมงของ ${activeArea.name}`}>
              <defs>
                <linearGradient id="fs-curve-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={activeTierColor} stopOpacity="0.42" />
                  <stop offset="100%" stopColor={activeTierColor} stopOpacity="0.03" />
                </linearGradient>
              </defs>
              {/* Warning Threshold Line */}
              <line
                x1="24"
                y1={hourlyCurve.thresholdY}
                x2="736"
                y2={hourlyCurve.thresholdY}
                stroke="#f43f5e"
                strokeWidth="1.4"
                strokeDasharray="5 4"
              />
              <text x="732" y={Math.max(12, hourlyCurve.thresholdY - 5)} textAnchor="end" fill="#f43f5e" fontSize="9.5" fontWeight="800">
                --- {hourlyCurve.thresholdLabel}
              </text>

              {/* Filled Area & Curve Line */}
              <path d={hourlyCurve.areaPath} fill="url(#fs-curve-fill)" />
              <path d={hourlyCurve.linePath} fill="none" stroke={activeTierColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

              {/* Interactive Hourly Points */}
              {hourlyCurve.pts.map((p, idx) => {
                const isSel = idx === hourIdx;
                return (
                  <g
                    key={p.label}
                    transform={`translate(${p.x}, ${p.y})`}
                    onClick={() => setHourIdx(idx)}
                    style={{ cursor: "pointer" }}
                  >
                    {isSel && <circle r="10" fill={activeTierColor} opacity="0.25" />}
                    <circle
                      r={isSel ? 5.5 : 3}
                      fill={isSel ? "#ffffff" : activeTierColor}
                      stroke={activeTierColor}
                      strokeWidth={isSel ? "3" : "1.5"}
                    />
                    {(isSel || idx % 3 === 0) && (
                      <text
                        x="0"
                        y="-9"
                        textAnchor="middle"
                        fill={isSel ? "#0f172a" : "#64748b"}
                        fontSize={isSel ? "10.5" : "8.8"}
                        fontWeight="800"
                      >
                        {topic === "sea" ? `${p.val >= 0 ? "+" : ""}${p.val}` : Math.round(p.val)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
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

        {/* PRIORITY 4: Easy-to-Understand Scientific Explainer Section */}
        <section className="fs-science-section" aria-label="คำอธิบายทางวิชาการแบบเข้าใจง่าย">
          <div className="fs-science-head">
            <span className="fs-eyebrow">🎓 ความรู้วิชาการฉบับประชาชน (Visual Science Explainer)</span>
            <h2>{science.title}</h2>
            <p>{science.subtitle}</p>
          </div>
          <div className="fs-science-grid">
            {science.cards.map((card, i) => (
              <article key={i} className="fs-science-card">
                <h3>{card.head}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* PRIORITY 5: 7-Day Outlook & Upper Gulf Tide Summary */}
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
