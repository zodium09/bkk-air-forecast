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
    shortDesc: "โอกาสฝนตก ปริมาณฝน และเวลาพกร่ม",
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
        headline: `PM2.5 อยู่ที่ ${c.pm25} µg/m³ · อากาศถ่ายเทปานกลาง`,
        action: "คนทั่วไปทำกิจกรรมได้ตามปกติ ผู้ที่แพ้ง่ายควรสังเกตอาการระคายเคืองตาหรือจมูก",
      };
    }
    return {
      badge: "🟢 อากาศสดชื่น สะอาด",
      tone: "good",
      headline: `PM2.5 ต่ำเพียง ${c.pm25} µg/m³ · ลมทะเลช่วยพัดฝุ่นได้ดี`,
      action: "เปิดหน้าต่างรับลมธรรมชาติ หรือออกไปวิ่ง/ปั่นจักรยานในสวนได้เต็มที่",
    };
  }

  if (topic === "heat") {
    if (c.feelsLikeC >= 38) {
      return {
        badge: "🔥 ร้อนจัด เฝ้าระวังฮีทสโตรก",
        tone: "alert",
        headline: `ความรู้สึกร้อนจริงพุ่งถึง ${c.feelsLikeC}°C (อุณหภูมิ ${c.tempC}°C)`,
        action: "จิบน้ำบ่อยๆ สวมเสื้อผ้าระบายอากาศ และเลี่ยงการอยู่กลางแดดจัดช่วง 11:00–15:00 น.",
      };
    }
    if (c.feelsLikeC >= 34) {
      return {
        badge: "☀️ อากาศค่อนข้างร้อน",
        tone: "warn",
        headline: `ความรู้สึกร้อน ${c.feelsLikeC}°C · ดัชนี UV ${c.uvIndex}`,
        action: "ทาครีมกันแดด สวมหมวกหรือแว่นกันแดดเมื่อต้องเดินกลางแจ้ง",
      };
    }
    return {
      badge: "🌤️ อุณหภูมิสบายกำลังดี",
      tone: "good",
      headline: `อุณหภูมิ ${c.tempC}°C (รู้สึกเหมือน ${c.feelsLikeC}°C)`,
      action: "อากาศไม่ร้อนจัด เดินเล่นหรือท่องเที่ยวกลางแจ้งได้สบาย",
    };
  }

  if (topic === "winter") {
    if (c.minMorningC <= 23.5) {
      return {
        badge: "🍃 ลมหนาวโชย อากาศเย็นสบาย",
        tone: "good",
        headline: `เช้ามืดเย็นสุด ${c.minMorningC}°C · ลม${c.windDirLabel} ${c.windKmh} กม./ชม.`,
        action: "ช่วงเช้ามืดถึง 08:00 น. อากาศเย็นสดชื่น เหมาะจิบกาแฟรับลมหรือเดินออกกำลังกาย",
      };
    }
    return {
      badge: "🌬️ ลมมรสุมพัดโปร่งสบาย",
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
  const [showBuffer, setShowBuffer] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [hourIdx, setHourIdx] = useState<number>(14);
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

        <section className="fs-hero-grid">
          <article className="fs-hero-card">
            <div className="fs-hero-top">
              <div>
                <span className="fs-zone-badge">
                  {activeArea.zoneType === "coastal"
                    ? "⚓ ชายฝั่งอ่าวไทยตอนบน"
                    : "🏙️ กรุงเทพฯ และปริมณฑล"}
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
                    <span>สะสม 24 ชม. ~{activeArea.current.rain24hMm} มม.</span>
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
                <span className="fs-eyebrow">🛰️ QGIS Print Composer · แผนที่ภาพถ่ายดาวเทียมและโซนความเสี่ยง</span>
                <h2>แผนที่วิเคราะห์ความเสี่ยง กทม.–ปริมณฑล และอ่าวไทยตอนบน</h2>
              </div>
              <div className="fs-zone-filters" role="group" aria-label="สลับภาพพื้นหลังแผนที่">
                <button
                  type="button"
                  aria-pressed={basemap === "satellite"}
                  onClick={() => setBasemap("satellite")}
                >
                  🛰️ ภาพถ่ายดาวเทียม
                </button>
                <button
                  type="button"
                  aria-pressed={basemap === "topo"}
                  onClick={() => setBasemap("topo")}
                >
                  ⛰️ ภูมิประเทศ
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
                <button type="button" aria-pressed={showBuffer} onClick={() => setShowBuffer(v => !v)}>
                  🎯 รัศมีความเสี่ยง (IDW)
                </button>
                <button type="button" aria-pressed={showGrid} onClick={() => setShowGrid(v => !v)}>
                  📐 กริดพิกัด
                </button>
              </div>
            </div>

            <div className="fs-svg-map-wrap is-qgis">
              <svg
                viewBox="0 0 520 340"
                className="fs-svg-map"
                role="img"
                aria-label="แผนที่ภาพถ่ายดาวเทียมและระดับความเสี่ยงสไตล์ QGIS กรุงเทพฯ ปริมณฑล และอ่าวไทยตอนบน"
              >
                <defs>
                  <linearGradient id="fs-land-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={basemap === "topo" ? "#d9f99d" : "#143828"} />
                    <stop offset="100%" stopColor={basemap === "topo" ? "#a7f3d0" : "#1c4532"} />
                  </linearGradient>
                  <linearGradient id="fs-sea-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={basemap === "topo" ? "#7dd3fc" : "#082f49"} />
                    <stop offset="55%" stopColor={basemap === "topo" ? "#38bdf8" : "#0c4a6e"} />
                    <stop offset="100%" stopColor={basemap === "topo" ? "#0284c7" : "#071f33"} />
                  </linearGradient>
                  <filter id="fs-idw-blur" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="20" />
                  </filter>
                </defs>

                <rect x="16" y="16" width="488" height="308" fill="url(#fs-sea-grad)" />

                {basemap === "satellite" && (
                  <g opacity="0.82">
                    <image
                      href="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/7/58/99"
                      x="16"
                      y="16"
                      width="244"
                      height="154"
                      preserveAspectRatio="none"
                    />
                    <image
                      href="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/7/58/100"
                      x="260"
                      y="16"
                      width="244"
                      height="154"
                      preserveAspectRatio="none"
                    />
                    <image
                      href="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/7/59/99"
                      x="16"
                      y="170"
                      width="244"
                      height="154"
                      preserveAspectRatio="none"
                    />
                    <image
                      href="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/7/59/100"
                      x="260"
                      y="170"
                      width="244"
                      height="154"
                      preserveAspectRatio="none"
                    />
                  </g>
                )}

                <path
                  d="M 16,16 L 504,16 L 504,295 L 415,280 L 372,240 L 388,168 L 325,188 L 285,186 L 232,188 L 178,206 L 142,275 L 95,324 L 16,324 Z"
                  fill={basemap === "satellite" ? "rgba(20, 60, 40, 0.25)" : "url(#fs-land-grad)"}
                  stroke="#34d399"
                  strokeWidth="2"
                />

                <path
                  d="M286,20 Q282,95 288,146 T304,186"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3.2"
                  strokeDasharray="6 4"
                  className="fs-map-river"
                />
                <path
                  d="M205,40 Q218,120 236,184"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.2"
                  strokeDasharray="5 4"
                  className="fs-map-river"
                />
                <path
                  d="M150,80 Q175,145 186,202"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.2"
                  strokeDasharray="5 4"
                  className="fs-map-river"
                />
                <path
                  d="M440,95 Q410,135 392,162"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.2"
                  strokeDasharray="5 4"
                  className="fs-map-river"
                />

                {showGrid && (
                  <g className="fs-qgis-grid">
                    {[
                      { y: 72, label: "14°00'N" },
                      { y: 156, label: "13°35'N" },
                      { y: 240, label: "13°10'N" },
                    ].map(r => (
                      <g key={r.label}>
                        <line x1="16" y1={r.y} x2="504" y2={r.y} />
                        <text x="22" y={r.y - 4}>{r.label}</text>
                      </g>
                    ))}
                    {[
                      { x: 140, label: "100°00'E" },
                      { x: 280, label: "100°30'E" },
                      { x: 410, label: "101°00'E" },
                    ].map(c => (
                      <g key={c.label}>
                        <line x1={c.x} y1="16" x2={c.x} y2="324" />
                        <text x={c.x + 4} y="28">{c.label}</text>
                      </g>
                    ))}
                  </g>
                )}

                {showBuffer && (
                  <g filter="url(#fs-idw-blur)">
                    {filteredAreas.map(area => {
                      const rTier = classifyAreaRisk(area, topic);
                      const col = bands.find(b => b.tier === rTier)?.color ?? "#10b981";
                      return (
                        <circle
                          key={`halo-${area.id}`}
                          cx={area.mapX}
                          cy={area.mapY}
                          r={rTier >= 4 ? 44 : rTier === 3 ? 36 : 28}
                          fill={col}
                          opacity={0.55}
                        />
                      );
                    })}
                  </g>
                )}

                <g className="fs-gulf-waves">
                  <path
                    d="M190,235 Q215,227 240,235 T290,235 T340,235"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.2"
                    opacity="0.75"
                  />
                  <path
                    d="M175,265 Q205,257 235,265 T295,265 T355,265"
                    fill="none"
                    stroke="#e0f2fe"
                    strokeWidth="2"
                    opacity="0.65"
                  />
                  <text
                    x="265"
                    y="296"
                    textAnchor="middle"
                    className="fs-gulf-label"
                  >
                    🌊 อ่าวไทยตอนบน (UPPER GULF OF THAILAND)
                  </text>
                </g>

                {filteredAreas.map(area => {
                  const isSel = area.id === activeArea.id;
                  const metric = pinMetricLabel(area, topic);
                  const rTier = classifyAreaRisk(area, topic);
                  const riskColor = bands.find(b => b.tier === rTier)?.color ?? "#0284c7";
                  return (
                    <g
                      key={area.id}
                      className={`fs-map-pin ${isSel ? "is-selected" : ""}`}
                      transform={`translate(${area.mapX}, ${area.mapY})`}
                      onClick={() => setSelectedId(area.id)}
                      role="button"
                      tabIndex={0}
                      aria-label={`เลือกพื้นที่ ${area.name} ค่าปัจจุบัน ${metric} ระดับความเสี่ยง ${rTier}`}
                    >
                      {isSel && <circle r="24" className="fs-pin-pulse" style={{ fill: riskColor }} />}
                      <rect
                        x="-36"
                        y="-26"
                        width="72"
                        height="22"
                        rx="11"
                        fill={riskColor}
                        stroke="#ffffff"
                        strokeWidth={isSel ? "2.5" : "1.5"}
                      />
                      <text x="0" y="-11" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800">
                        {metric}
                      </text>
                      <circle r="6" cy="4" fill={riskColor} stroke="#ffffff" strokeWidth="2" />
                      <text x="0" y="19" textAnchor="middle" className="fs-pin-name">
                        {area.name.split(" ")[0]}
                      </text>
                    </g>
                  );
                })}

                <g transform="translate(474, 42)">
                  <circle r="18" fill="rgba(12, 28, 44, 0.8)" stroke="rgba(255,255,255,0.4)" />
                  <polygon points="0,-12 -5,6 0,3 5,6" fill="#ffffff" />
                  <text x="0" y="14" textAnchor="middle" fill="#7dd3fc" fontSize="8" fontWeight="800">N</text>
                </g>
                <g transform="translate(28, 304)">
                  <rect x="-4" y="-12" width="118" height="20" rx="4" fill="rgba(12, 28, 44, 0.8)" />
                  <rect x="2" y="1" width="24" height="4" fill="#ffffff" />
                  <rect x="26" y="1" width="24" height="4" fill="#38bdf8" />
                  <text x="2" y="-2" fill="#ffffff" fontSize="8" fontWeight="700">0</text>
                  <text x="24" y="-2" fill="#ffffff" fontSize="8" fontWeight="700">15</text>
                  <text x="52" y="-2" fill="#7dd3fc" fontSize="8" fontWeight="700">30 กม.</text>
                </g>

                <rect x="16" y="16" width="488" height="308" fill="none" stroke="#ffffff" strokeWidth="2" />
                <rect x="12" y="12" width="496" height="316" fill="none" stroke="#0c2e44" strokeWidth="4" strokeDasharray="20 20" />
              </svg>

              <div className="fs-qgis-titleblock">
                <div>
                  <small>MAP SHEET: FAHSAI-GULF-2026 · CRS: EPSG:4326 (WGS 84)</small>
                  <strong>แผนที่วิเคราะห์ความเสี่ยง {TOPICS.find(t => t.id === topic)?.label} · กทม. ปริมณฑล และอ่าวไทยตอนบน</strong>
                </div>
                <span>โซนที่เลือก: <b>{activeArea.name} (ระดับ {activeTier}/5)</b></span>
              </div>
            </div>

            <div className="fs-qgis-commentary">
              <strong>📐 คำอธิบายวิเคราะห์เชิงพื้นที่ (QGIS Spatial Commentary):</strong>
              <p>
                พื้นที่ <b>{activeArea.name}</b> จัดอยู่ในเกณฑ์{" "}
                <b style={{ color: activeTierColor }}>
                  {bands.find(b => b.tier === activeTier)?.label}
                </b>{" "}
                ({advice.headline}) · {activeArea.coastalNote}
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
