"use client";

import { useEffect, useMemo, useState } from "react";

import {
  buildFallbackPayload,
  getBangkokClockText,
  getBangkokHour,
  REGIONS,
  type FahSaiPayload,
  type RegionId,
  type TopicId,
} from "../../lib/fahsai-data";
import {
  classifyAreaRisk,
  getFriendlyAdvice,
  getScienceExplainer,
  getTopicRiskBands,
  pinMetricLabel,
  projectFahSaiGeo,
  projectThailandGeo,
  projectThailandPolyline,
  REGION_BBOXES,
  THAILAND_BORDER_WGS84,
  THAILAND_LABEL_OFFSETS,
  THAILAND_MAP_FRAME,
  TOPICS,
  type RiskBandInfo,
} from "./fahsai-helpers";
import "./fahsai.css";
import FahSaiTwinScene from "./fahsai-twin-scene";

export { classifyAreaRisk, getTopicRiskBands, projectFahSaiGeo, type RiskBandInfo };

type TwinCameraMode = "iso" | "atmosphere" | "coastal" | "top";

function formatDms(deg: number, isLat: boolean): string {
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const m = Math.round((abs - d) * 60);
  return `${d}°${String(m).padStart(2, "0")}'${isLat ? "N" : "E"}`;
}

export default function FahSaiApp() {
  const [payload, setPayload] = useState<FahSaiPayload>(() => buildFallbackPayload());
  const [topic, setTopic] = useState<TopicId>("rain");
  const [selectedId, setSelectedId] = useState<string>("bangkok");
  const [regionFilter, setRegionFilter] = useState<RegionId>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [basemap, setBasemap] = useState<"satellite" | "topo" | "dark">("satellite");
  const [showRadarWind, setShowRadarWind] = useState<boolean>(true);
  const [showBuffer, setShowBuffer] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [hourIdx, setHourIdx] = useState<number>(() => getBangkokHour());
  const [dark, setDark] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [locating, setLocating] = useState<boolean>(false);
  const [gpsStatus, setGpsStatus] = useState<string>("");

  // 3D Digital Twin camera state & live clock
  const [mainViewMode, setMainViewMode] = useState<"2d" | "3d" | "split">("2d");
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

  const handleFindMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("เบราว์เซอร์ไม่รองรับการระบุพิกัด");
      return;
    }
    setLocating(true);
    setGpsStatus("กำลังค้นหาจังหวัดใกล้คุณ...");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        let nearest = payload.areas[0];
        let bestDist = Infinity;
        for (const area of payload.areas) {
          const d = Math.hypot(area.lat - latitude, area.lng - longitude);
          if (d < bestDist) {
            bestDist = d;
            nearest = area;
          }
        }
        if (nearest) {
          setSelectedId(nearest.id);
          setRegionFilter("all");
          setGpsStatus(`📍 พบพื้นที่ใกล้คุณ: ${nearest.name}`);
        }
        setLocating(false);
      },
      () => {
        setLocating(false);
        setGpsStatus("ไม่สามารถเข้าถึงพิกัดได้ กรุณาเลือกจังหวัดจากแผนที่หรือการ์ด");
      },
      { enableHighAccuracy: false, timeout: 6000 }
    );
  };

  const filteredAreas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return payload.areas.filter(a => {
      const matchRegion = regionFilter === "all" ? true : a.regionId === regionFilter;
      const matchSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.subtitle.toLowerCase().includes(q) ||
        a.regionName.toLowerCase().includes(q) ||
        a.tourismHighlights.some(h => h.toLowerCase().includes(q));
      return matchRegion && matchSearch;
    });
  }, [payload.areas, regionFilter, searchQuery]);

  const activeArea = useMemo(
    () =>
      payload.areas.find(a => a.id === selectedId) ??
      filteredAreas[0] ??
      payload.areas[0],
    [payload.areas, filteredAreas, selectedId]
  );

  const activeBBox = useMemo(
    () => REGION_BBOXES[regionFilter] ?? REGION_BBOXES.all,
    [regionFilter]
  );

  const activeSatUrl = useMemo(
    () =>
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${activeBBox.minLng},${activeBBox.minLat},${activeBBox.maxLng},${activeBBox.maxLat}&bboxSR=4326&imageSR=4326&size=708,1050&format=jpg&f=image`,
    [activeBBox]
  );

  const activeTopoUrl = useMemo(
    () =>
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/export?bbox=${activeBBox.minLng},${activeBBox.minLat},${activeBBox.maxLng},${activeBBox.maxLat}&bboxSR=4326&imageSR=4326&size=708,1050&format=jpg&f=image`,
    [activeBBox]
  );

  const activeHour = activeArea.hourly[hourIdx] ?? activeArea.hourly[0];
  const activeTopicMeta = useMemo(
    () => TOPICS.find(t => t.id === topic) ?? TOPICS[0],
    [topic]
  );
  const advice = useMemo(() => getFriendlyAdvice(activeArea, topic), [activeArea, topic]);
  const bands = useMemo(() => getTopicRiskBands(topic), [topic]);
  const activeTier = classifyAreaRisk(activeArea, topic);
  const activeTierColor = bands.find(b => b.tier === activeTier)?.color ?? "#0284c7";
  const science = useMemo(() => getScienceExplainer(topic), [topic]);

  // Top Suitable vs Top Risk areas across Thailand
  const topSuitableAreas = useMemo(
    () =>
      [...payload.areas]
        .sort((a, b) => b.current.suitabilityScore - a.current.suitabilityScore)
        .slice(0, 6),
    [payload.areas]
  );

  const topRiskAreas = useMemo(
    () =>
      [...payload.areas]
        .sort(
          (a, b) =>
            b.current.multiHazardTier * 100 +
            b.current.rainProb +
            b.current.pm25 -
            (a.current.multiHazardTier * 100 + a.current.rainProb + a.current.pm25)
        )
        .slice(0, 6),
    [payload.areas]
  );

  // Compute live summary metric for each of the 10 Topic Cards so user sees immediate value on every card!
  const getTopicQuickValue = (tId: TopicId): string => {
    const c = activeArea.current;
    if (tId === "rain") return `ฝน ${c.rainProb}% · ${c.rain24hMm} มม.`;
    if (tId === "sky") return `${c.tempC}°C · ความชื้น ${c.humidity}%`;
    if (tId === "tide")
      return activeArea.isCoastal || c.highTideMsl > 0
        ? `สูงสุด +${c.highTideMsl} ม. (${c.highTideTime})`
        : `สูง ${activeArea.elevationM} ม. (พ้นน้ำหนุน)`;
    if (tId === "wave")
      return activeArea.isCoastal ? `คลื่น ${c.waveHeightM} ม. · ลม ${c.windKmh} กม./ชม.` : `ลม ${c.windKmh} กม./ชม.`;
    if (tId === "air") return `PM2.5 ${c.pm25} µg · AQI ${c.aqi}`;
    if (tId === "heat") return `RealFeel ${c.feelsLikeC}°C · UV ${c.uvIndex}`;
    if (tId === "winter") return `เช้า ${c.minMorningC}°C · หมอก ${c.mistChancePct}%`;
    if (tId === "tourism") return `น่าเที่ยว ${c.tourismScore}/100 คะแนน`;
    if (tId === "risk") return `ระดับเฝ้าระวัง ${c.multiHazardTier}/5`;
    return `ความเหมาะสม ${c.suitabilityScore}%`;
  };

  // Compute Radar & Wind Trajectory analysis + Time-Window Quantitative Alerts
  const radarAndSchedule = useMemo(() => {
    const c = activeArea.current;
    const dbz = c.radarDbz;
    const rainRateMmHr =
      c.rainProb >= 60
        ? Number((c.rain24hMm / 2.2).toFixed(1))
        : Number((c.rain24hMm / 4.0).toFixed(1));
    const etaMin = Math.max(20, Math.round(45 - c.windKmh * 0.6));
    const moveDirText =
      c.windDeg >= 20 && c.windDeg <= 110
        ? "เคลื่อนตัวจากทิศตะวันออกเฉียงเหนือมุ่งหน้าทิศตะวันตกเฉียงใต้ตามแนวลมมรสุม"
        : c.windDeg > 110 && c.windDeg <= 220
          ? "เคลื่อนตัวจากทะเลขึ้นสู่แผ่นดินตามแนวลมใต้–ตะวันออกเฉียงใต้"
          : "เคลื่อนตัวจากฝั่งทะเลอันดามันเข้าสู่พื้นที่รับลมตามมรสุมตะวันตกเฉียงใต้";

    const nowH = getBangkokHour();
    const sliceWindow = (startOffset: number, len: number, title: string, tag: string) => {
      const startH = (nowH + startOffset) % 24;
      const endH = (nowH + startOffset + len) % 24;
      const slots = Array.from(
        { length: len },
        (_, k) => activeArea.hourly[(nowH + startOffset + k) % 24]
      ).filter(Boolean);

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
            : slots.reduce(
                (acc, s) =>
                  acc + (s.rainProb >= 35 ? (s.rainProb / 100) * 4.2 : (s.rainProb / 100) * 1.1),
                0
              )
        ).toFixed(1)
      );
      const maxFeels = isNowSlot
        ? c.feelsLikeC
        : slots.length
          ? Math.max(...slots.map(s => s.feelsLikeC))
          : c.feelsLikeC;
      const minTemp = isNowSlot
        ? c.minMorningC
        : slots.length
          ? Math.min(...slots.map(s => s.tempC))
          : c.minMorningC;
      const maxPm25 = isNowSlot
        ? c.pm25
        : slots.length
          ? Math.max(...slots.map(s => s.pm25))
          : c.pm25;
      const maxWind = isNowSlot
        ? c.windKmh
        : slots.length
          ? Math.max(...slots.map(s => s.windKmh))
          : c.windKmh;
      const maxTide = isNowSlot
        ? c.tideMsl
        : slots.length
          ? Math.max(...slots.map(s => s.tideMsl))
          : c.highTideMsl;

      let slotTier: 1 | 2 | 3 | 4 | 5 = activeTier;
      if (!isNowSlot) {
        if (topic === "rain") {
          slotTier =
            maxRainProb > 75 || sumRainMm > 20
              ? 5
              : maxRainProb >= 55
                ? 4
                : maxRainProb >= 35
                  ? 3
                  : maxRainProb >= 15
                    ? 2
                    : 1;
        } else if (topic === "air") {
          slotTier = maxPm25 > 75 ? 5 : maxPm25 > 37.5 ? 4 : maxPm25 > 25 ? 3 : maxPm25 > 15 ? 2 : 1;
        } else if (topic === "heat") {
          slotTier = maxFeels > 42 ? 5 : maxFeels >= 38 ? 4 : maxFeels >= 34 ? 3 : maxFeels >= 30 ? 2 : 1;
        }
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
              ? `ค่าฝุ่นสะสม ${maxPm25} µg/m³ แนะนำสวมหน้ากากป้องกันฝุ่นเมื่ออยู่นอกอาคาร`
              : maxFeels >= 38
                ? `ความร้อนสะสมสูง ${maxFeels}°C ดื่มน้ำเพิ่มขึ้นและเลี่ยงแดดจัด`
                : `สภาพอากาศเอื้ออำนวย เหมาะเดินทางและทำกิจกรรมกลางแจ้ง`,
      };
    };

    return {
      dbz,
      rainRateMmHr,
      etaMin,
      moveDirText,
      slots: [
        sliceWindow(0, 1, "ตอนนี้ – 1 ชม.", "สถานะปัจจุบัน"),
        sliceWindow(1, 3, "1–3 ชม. ข้างหน้า", "แจ้งเตือนระยะประชิด"),
        sliceWindow(3, 6, "3–6 ชม. ข้างหน้า", "แนวโน้มช่วงถัดไป"),
        sliceWindow(6, 12, "6–12 ชม. ข้างหน้า", "วางแผนล่วงหน้า 12 ชม."),
      ],
    };
  }, [activeArea, activeTier, activeTierColor, bands, topic, nowClockText]);

  // Build SVG path for the 24-hour animated curve chart
  const hourlyCurve = useMemo(() => {
    const pts = activeArea.hourly.map((h, i) => {
      const val =
        topic === "rain"
          ? h.rainProb
          : topic === "sky"
            ? 100 - h.cloudPct
            : topic === "tide"
              ? h.tideMsl
              : topic === "wave"
                ? h.waveM
                : topic === "air"
                  ? h.pm25
                  : topic === "heat"
                    ? h.feelsLikeC
                    : topic === "winter"
                      ? h.tempC
                      : 100 - h.rainProb * 0.6;
      const norm =
        topic === "rain" || topic === "sky" || topic === "tourism" || topic === "suitable" || topic === "risk"
          ? Math.min(1, Math.max(0, val / 100))
          : topic === "air"
            ? Math.min(1, val / 80)
            : topic === "heat" || topic === "winter"
              ? Math.min(1, Math.max(0, (val - 14) / 30))
              : topic === "wave"
                ? Math.min(1, Math.max(0, val / 2.5))
                : Math.min(1, Math.max(0, (val + 1.8) / 3.8));
      const x = 28 + (i / 23) * 704;
      const y = 112 - norm * 88;
      return { x, y, val: Number(val.toFixed(2)), label: h.hourLabel };
    });
    const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},122 L${pts[0].x.toFixed(1)},122 Z`;
    const thresholdY =
      topic === "rain"
        ? 112 - 0.55 * 88
        : topic === "air"
          ? 112 - (37.5 / 80) * 88
          : topic === "heat"
            ? 112 - ((38 - 14) / 30) * 88
            : topic === "winter"
              ? 112 - ((20 - 14) / 30) * 88
              : 112 - 0.65 * 88;
    const thresholdLabel =
      topic === "rain"
        ? "เกณฑ์เฝ้าระวังฝน 55%"
        : topic === "air"
          ? "เกณฑ์มาตรฐานไทย 37.5 µg/m³"
          : topic === "heat"
            ? "เกณฑ์เตือนความร้อน 38°C"
            : topic === "winter"
              ? "เกณฑ์อากาศหนาวเย็น 20°C"
              : "เกณฑ์อ้างอิงมาตรฐาน";

    return { pts, linePath, areaPath, thresholdY, thresholdLabel };
  }, [activeArea.hourly, topic]);

  const graticuleLats = useMemo(() => {
    const step = (activeBBox.maxLat - activeBBox.minLat) / 5;
    return [1, 2, 3, 4].map(i => Number((activeBBox.minLat + step * i).toFixed(1)));
  }, [activeBBox]);

  const graticuleLngs = useMemo(() => {
    const step = (activeBBox.maxLng - activeBBox.minLng) / 4;
    return [1, 2, 3].map(i => Number((activeBBox.minLng + step * i).toFixed(1)));
  }, [activeBBox]);

  // Reusable 3D Digital Twin Content
  const renderTwinSceneContent = () => (
    <FahSaiTwinScene
      camera={twinCamera}
      autoRotate={twinAutoRotate}
      onManualMove={() => setTwinAutoRotate(false)}
      hud={
        <div className="fs-3d-hud">
          <span>
            🎯 โฟกัส: <b>{activeArea.name} ({activeArea.regionName})</b>
          </span>
          <span>
            🌟 สถานะ ({nowClockText} น.):{" "}
            <b style={{ color: activeTierColor }}>
              {activeTopicMeta.label} · ระดับ {activeTier}/5
            </b>
          </span>
          <span>
            📡 เรดาร์: <b>{radarAndSchedule.dbz} dBZ</b> · ลม{activeArea.current.windDirLabel}{" "}
            <b>{activeArea.current.windKmh} กม./ชม.</b>
          </span>
          <span>
            🏖️ ความน่าเที่ยว: <b>{activeArea.current.tourismScore}/100</b> · ความเหมาะสม:{" "}
            <b>{activeArea.current.suitabilityScore}%</b>
          </span>
        </div>
      }
    >
      <div className="fs-3d-slab">
        <div className="fs-3d-slab-grid" />

        {/* Northern & Mountainous Highland Zone */}
        <div className="fs-3d-mountain-zone">
          <span className="fs-3d-zone-label">
            ⛰️ เทือกเขาภาคเหนือ–อีสาน–ตะวันตก · หมอกเช้า {activeArea.current.mistChancePct}% · ต่ำสุด {activeArea.current.minMorningC}°C
          </span>
        </div>

        {/* Central Plains & Urban Core */}
        <div className="fs-3d-land-zone">
          <span className="fs-3d-zone-label">
            🇹🇭 โครงข่ายภูมิประเทศทั่วไทย ({filteredAreas.length} จังหวัดในมุมมอง)
          </span>
          <div className="fs-3d-skyline">
            <div className="fs-3d-bldg b1" />
            <div className="fs-3d-bldg b2" />
            <div className="fs-3d-bldg b3" />
            <div className="fs-3d-bldg b4" />
            <div className="fs-3d-bldg b5" />
          </div>
        </div>

        {/* Gulf of Thailand & Andaman Sea 3D Water Body */}
        <div
          className="fs-3d-sea-zone"
          style={{
            transform: `translateZ(${Math.max(4, Math.round((activeHour.tideMsl + 1.4) * 7))}px)`,
          }}
        >
          <div className="fs-3d-sea-wave w1" />
          <div className="fs-3d-sea-wave w2" />
          <span className="fs-3d-zone-label">
            🌊 อ่าวไทย & ทะเลอันดามัน · คลื่น {activeArea.current.waveHeightM} ม. · น้ำทะเล{" "}
            {activeHour.tideMsl >= 0 ? "+" : ""}
            {activeHour.tideMsl} ม. รทก.
          </span>
        </div>

        {/* 3D PM2.5 Inversion & Atmospheric Mixing Dome */}
        <div
          className="fs-3d-inversion-dome"
          style={{
            opacity: topic === "air" ? 0.88 : activeArea.current.pm25 > 28 ? 0.52 : 0.25,
            borderColor: activeArea.current.pm25 > 37.5 ? "#f97316" : "#10b981",
            background:
              activeArea.current.pm25 > 37.5
                ? "radial-gradient(ellipse at center, rgba(249, 115, 22, 0.34), rgba(234, 179, 8, 0.12) 70%, transparent)"
                : "radial-gradient(ellipse at center, rgba(16, 185, 129, 0.22), rgba(6, 182, 212, 0.08) 70%, transparent)",
          }}
        >
          <span className="fs-3d-dome-tag">
            😷 ชั้นบรรยากาศ & ฝาชีครอบ · PM2.5 {activeHour.pm25} µg/m³ · ทัศนวิสัย {activeArea.current.visibilityKm} กม.
          </span>
        </div>

        {/* 3D Extruded Province Metric Pillars across Thailand */}
        {filteredAreas.map(area => {
          const xPct =
            ((area.lng - activeBBox.minLng) / (activeBBox.maxLng - activeBBox.minLng)) * 100;
          const yPct =
            (1 - (area.lat - activeBBox.minLat) / (activeBBox.maxLat - activeBBox.minLat)) * 100;
          const rTier = classifyAreaRisk(area, topic);
          const col = bands.find(b => b.tier === rTier)?.color ?? "#0ea5e9";
          const isSel = area.id === activeArea.id;
          const metricText = pinMetricLabel(area, topic);
          const heightPx = isSel ? 92 : 30 + rTier * 11;

          return (
            <div
              key={`twin-area-${area.id}`}
              className={`fs-3d-area-anchor ${isSel ? "is-selected" : ""}`}
              style={{
                left: `${Math.min(93, Math.max(7, xPct))}%`,
                top: `${Math.min(91, Math.max(9, yPct))}%`,
              }}
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
              <div
                className="fs-3d-area-label"
                style={{ borderColor: isSel ? "#ffffff" : col }}
              >
                <strong>{THAILAND_LABEL_OFFSETS[area.id]?.shortName ?? area.name}</strong>
                <span>{metricText}</span>
              </div>
            </div>
          );
        })}

        {/* Upper Atmospheric Plane: Storm Clouds, Solar UV & Monsoon Wind Streamlines */}
        <div className="fs-3d-upper-air">
          <div className="fs-3d-storm-cell">
            <div className="fs-3d-cloud-badge">
              ⛈️ เมฆเรดาร์ {radarAndSchedule.dbz} dBZ · ฝน {activeHour.rainProb}% (~{radarAndSchedule.rainRateMmHr} มม./ชม.)
            </div>
            {activeHour.rainProb >= 25 && <div className="fs-3d-rain-shaft" />}
          </div>

          <div className="fs-3d-solar-badge">
            ☀️ UV {activeArea.current.uvIndex} · ร้อนจริง {activeHour.feelsLikeC}°C · ฟ้าโปร่ง {100 - activeArea.current.cloudCoverPct}%
          </div>

          <div
            className="fs-3d-wind-ribbon"
            style={{
              transform: `rotateZ(${activeArea.current.windDeg + 180}deg)`,
            }}
          >
            <span>
              💨 กระแสลม{activeArea.current.windDirLabel} {activeHour.windKmh} กม./ชม. ➔
            </span>
          </div>
        </div>
      </div>
    </FahSaiTwinScene>
  );

  return (
    <div className={`fs-app theme-${topic} ${dark ? "is-dark" : ""}`}>
      {/* Ambient Dynamic Weather Particle Background */}
      <div className="fs-ambient" aria-hidden="true">
        <div className="fs-orb fs-orb-1" />
        <div className="fs-orb fs-orb-2" />
        <div className="fs-orb fs-orb-3" />
        {topic === "rain" && (
          <div className="fs-rain-layer">
            {Array.from({ length: 20 }, (_, i) => (
              <span
                key={i}
                className="fs-raindrop"
                style={{
                  left: `${(i * 5.2) % 100}%`,
                  animationDelay: `${(i * 0.21) % 2}s`,
                  animationDuration: `${1.05 + (i % 4) * 0.22}s`,
                }}
              />
            ))}
          </div>
        )}
        {(topic === "winter" || topic === "wave") && (
          <div className="fs-wind-layer">
            <span className="fs-wind-streak s1" />
            <span className="fs-wind-streak s2" />
            <span className="fs-wind-streak s3" />
          </div>
        )}
      </div>

      {/* TOP NAVIGATION HEADER */}
      <header className="fs-header">
        <div className="fs-brand">
          <span className="fs-logo" aria-hidden="true">
            🌤️
          </span>
          <div>
            <div className="fs-brand-title-row">
              <strong>ฟ้าใส ทั่วไทย · FahSai Thailand</strong>
              <span className="fs-nationwide-pill">🇹🇭 ครบทั้ง 6 ภูมิภาค · 24 จังหวัดหลัก</span>
            </div>
            <small>
              Interactive Map Dashboard & Animated 3D Digital Twin สำหรับประชาชน · ฝน ฟ้า อากาศ น้ำทะเลหนุน คลื่นลม ฝุ่น ความร้อน ลมหนาว ท่องเที่ยว พื้นที่เสี่ยง & พื้นที่เหมาะสม
            </small>
          </div>
        </div>

        <div className="fs-header-actions">
          <button
            type="button"
            className="fs-gps-btn"
            onClick={handleFindMyLocation}
            disabled={locating}
          >
            {locating ? "📡 กำลังค้นหาพิกัด..." : "📍 พิกัดใกล้ฉัน"}
          </button>
          <a
            href="#fs-3d-twin"
            className="fs-header-3d-pill"
            onClick={() => setMainViewMode("3d")}
          >
            🌐 3D Digital Twin
          </a>
          <a href="#fs-risk-suitable" className="fs-header-rank-pill">
            ✨ พื้นที่เหมาะสม vs เสี่ยง
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
        {/* SECTION 1: 10 VIBRANT STORY TOPIC CARDS (การ์ดเรื่องให้เลือกแบบสวยงามสดใส เข้าใจง่าย ครบวงจร) */}
        <section className="fs-topic-deck-section" aria-label="เลือกเรื่องที่ต้องการสำรวจ">
          <div className="fs-deck-header">
            <div>
              <span className="fs-eyebrow">✨ เลือกการ์ดเรื่องที่คุณสนใจ (10 หมวดครบวงจรสำหรับประชาชน)</span>
              <h2>คลิกเลือกเรื่องเพื่อเปลี่ยนแผนที่ Interactive, แบบจำลอง 3D Twin และคำแนะนำทันที</h2>
            </div>
            <div className="fs-deck-live-tag">
              <span className="fs-live-dot" />
              <span>
                พื้นที่กำลังดู: <b>{activeArea.name}</b> ({activeArea.regionName}) · อัปเดตเวลา{" "}
                <b>{nowClockText} น.</b>
              </span>
            </div>
          </div>

          <div className="fs-topic-card-grid" role="group" aria-label="การ์ดเลือกหมวดหมู่ฟ้าใส 10 เรื่อง">
            {TOPICS.map(t => {
              const active = topic === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  className={`fs-story-topic-card ${active ? "is-active" : ""}`}
                  style={
                    active
                      ? { background: t.gradient, borderColor: "transparent", color: "#ffffff" }
                      : { "--card-accent": t.color, "--card-bg-tint": t.accentLight } as React.CSSProperties
                  }
                  onClick={() => setTopic(t.id)}
                >
                  <div className="fs-stc-top">
                    <span className="fs-stc-icon" aria-hidden="true">
                      {t.icon}
                    </span>
                    <span className="fs-stc-badge">{t.badgeText}</span>
                  </div>
                  <strong className="fs-stc-title">{t.label}</strong>
                  <small className="fs-stc-desc">{t.shortDesc}</small>
                  <div className="fs-stc-live-metric">
                    <span>📍 {activeArea.name}:</span>
                    <b>{getTopicQuickValue(t.id)}</b>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: NATIONWIDE REGION SELECTOR + SEARCH + VIEW MODE BAR */}
        <section className="fs-control-ribbon" aria-label="เลือกภูมิภาคและค้นหาจังหวัดทั่วไทย">
          <div className="fs-region-tabs" role="group" aria-label="กรองตามภูมิภาคของประเทศไทย">
            {REGIONS.map(r => (
              <button
                key={r.id}
                type="button"
                className={`fs-region-pill ${regionFilter === r.id ? "is-active" : ""}`}
                aria-pressed={regionFilter === r.id}
                onClick={() => {
                  setRegionFilter(r.id);
                  const firstInRegion =
                    r.id === "all"
                      ? payload.areas[0]
                      : payload.areas.find(a => a.regionId === r.id);
                  if (firstInRegion && r.id !== "all" && activeArea.regionId !== r.id) {
                    setSelectedId(firstInRegion.id);
                  }
                }}
              >
                <span>{r.icon}</span>
                <strong>{r.label}</strong>
              </button>
            ))}
          </div>

          <div className="fs-search-and-mode">
            <div className="fs-search-box">
              <span aria-hidden="true">🔍</span>
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ค้นหาจังหวัด, เกาะ, ยอดดอย, ที่เที่ยว (เช่น เชียงใหม่, สมุย, ภูเก็ต, เขาใหญ่)..."
                aria-label="ค้นหาจังหวัดหรือสถานที่ท่องเที่ยวทั่วไทย"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} aria-label="ล้างคำค้นหา">
                  ✕
                </button>
              )}
            </div>

            <div className="fs-viewmode- pills" role="group" aria-label="สลับโหมดการแสดงผลแผนที่และ 3D">
              <button
                type="button"
                className={`fs-vm-btn ${mainViewMode === "2d" ? "is-active" : ""}`}
                aria-pressed={mainViewMode === "2d"}
                onClick={() => setMainViewMode("2d")}
              >
                🗺️ แผนที่ 2D
              </button>
              <button
                type="button"
                className={`fs-vm-btn ${mainViewMode === "3d" ? "is-active" : ""}`}
                aria-pressed={mainViewMode === "3d"}
                onClick={() => setMainViewMode("3d")}
              >
                🌐 3D Twin
              </button>
              <button
                type="button"
                className={`fs-vm-btn ${mainViewMode === "split" ? "is-active" : ""}`}
                aria-pressed={mainViewMode === "split"}
                onClick={() => setMainViewMode("split")}
              >
                🔀 คู่ขนาน 2D+3D
              </button>
            </div>
          </div>
          {gpsStatus && <p className="fs-gps-feedback">{gpsStatus}</p>}
        </section>

        {/* SECTION 3: MAIN INTERACTIVE DASHBOARD WORKSPACE (Left: Rich Area Story Card | Right: Interactive Thailand Map & 3D Digital Twin) */}
        <section className="fs-hero-grid">
          {/* LEFT CARD: SELECTED PROVINCE / DESTINATION DEEP INSIGHT */}
          <article className="fs-hero-card">
            <div className="fs-hero-top">
              <div>
                <div className="fs-hero-badges-row">
                  <span className="fs-zone-badge">
                    {activeArea.regionName} ·{" "}
                    {activeArea.isCoastal
                      ? activeArea.seaBasin === "andaman"
                        ? "⛵ ชายฝั่งทะเลอันดามัน"
                        : "🌊 ชายฝั่งอ่าวไทย"
                      : activeArea.zoneType === "mountain"
                        ? `⛰️ ภูเขา/ดอยสูง (${activeArea.elevationM} ม.)`
                        : "🏙️ พื้นที่เมือง/ที่ราบ"}{" "}
                    · {activeArea.lat.toFixed(2)}°N, {activeArea.lng.toFixed(2)}°E
                  </span>
                </div>
                <h1>{activeArea.name}</h1>
                <p className="fs-subtitle">{activeArea.subtitle}</p>
              </div>
              <span
                className="fs-advice-pill"
                style={{ background: activeTierColor, color: "#fff" }}
              >
                {topic === "tourism" || topic === "suitable"
                  ? `✨ ความเหมาะสม ระดับ ${activeTier}/5 · ${advice.badge}`
                  : `🚨 สถานะตอนนี้ (${nowClockText} น.) · ระดับ ${activeTier}/5 · ${advice.badge}`}
              </span>
            </div>

            {/* DYNAMIC HERO SHOWCASE FOR ALL 10 TOPICS */}
            <div
              className="fs-hero-showcase"
              style={{ background: activeTopicMeta.gradient }}
            >
              <div className="fs-hero-big-metric">
                {topic === "rain" && (
                  <>
                    <small>🌧️ โอกาสเกิดฝนวันนี้ (ณ เวลา {nowClockText} น.)</small>
                    <strong>
                      {activeArea.current.rainProb}
                      <span>%</span>
                    </strong>
                    <span>
                      ฝนสะสม 24 ชม. ~{activeArea.current.rain24hMm} มม. · เรดาร์{" "}
                      {radarAndSchedule.dbz} dBZ
                    </span>
                  </>
                )}
                {topic === "sky" && (
                  <>
                    <small>🌤️ สภาพท้องฟ้าและอุณหภูมิ ({nowClockText} น.)</small>
                    <strong>
                      {activeArea.current.tempC}
                      <span>°C</span>
                    </strong>
                    <span>
                      {activeArea.current.skyStateLabel} · ความชื้น {activeArea.current.humidity}% · ทัศนวิสัย{" "}
                      {activeArea.current.visibilityKm} กม.
                    </span>
                  </>
                )}
                {topic === "tide" && (
                  <>
                    <small>🌊 ระดับน้ำทะเล & น้ำหนุน ({nowClockText} น.)</small>
                    <strong>
                      {activeArea.isCoastal || activeArea.current.highTideMsl > 0
                        ? `${activeArea.current.tideMsl >= 0 ? "+" : ""}${activeArea.current.tideMsl}`
                        : `${activeArea.elevationM}`}
                      <span>
                        {activeArea.isCoastal || activeArea.current.highTideMsl > 0
                          ? "ม. รทก."
                          : "ม. เหนือทะเล"}
                      </span>
                    </strong>
                    <span>{activeArea.current.tideStatusLabel}</span>
                  </>
                )}
                {topic === "wave" && (
                  <>
                    <small>⛵ ความสูงคลื่นและลมชายฝั่ง ({nowClockText} น.)</small>
                    <strong>
                      {activeArea.isCoastal ? activeArea.current.waveHeightM : activeArea.current.windKmh}
                      <span>{activeArea.isCoastal ? "เมตร" : "กม./ชม."}</span>
                    </strong>
                    <span>
                      ลม{activeArea.current.windDirLabel} {activeArea.current.windKmh} กม./ชม. (กระโชก{" "}
                      {activeArea.current.windGustKmh} กม./ชม.)
                    </span>
                  </>
                )}
                {topic === "air" && (
                  <>
                    <small>😷 ค่าฝุ่นละออง PM2.5 ({nowClockText} น.)</small>
                    <strong>
                      {activeArea.current.pm25}
                      <span>µg/m³</span>
                    </strong>
                    <span>
                      ดัชนี US AQI {activeArea.current.aqi} · ทัศนวิสัย {activeArea.current.visibilityKm} กม.
                    </span>
                  </>
                )}
                {topic === "heat" && (
                  <>
                    <small>☀️ ความรู้สึกร้อนจริง RealFeel ({nowClockText} น.)</small>
                    <strong>
                      {activeArea.current.feelsLikeC}
                      <span>°C</span>
                    </strong>
                    <span>
                      อุณหภูมิจริง {activeArea.current.tempC}°C (สูงสุด {activeArea.current.maxAfternoonC}°C) · UV{" "}
                      {activeArea.current.uvIndex}
                    </span>
                  </>
                )}
                {topic === "winter" && (
                  <>
                    <small>🍃 อุณหภูมิต่ำสุดเช้ามืด & ทะเลหมอก</small>
                    <strong>
                      {activeArea.current.minMorningC}
                      <span>°C</span>
                    </strong>
                    <span>
                      โอกาสเกิดหมอกเช้า {activeArea.current.mistChancePct}% · ลม{activeArea.current.windDirLabel}
                    </span>
                  </>
                )}
                {topic === "tourism" && (
                  <>
                    <small>🏖️ คะแนนฟ้าใสรับการท่องเที่ยววันนี้</small>
                    <strong>
                      {activeArea.current.tourismScore}
                      <span>/100</span>
                    </strong>
                    <span>{activeArea.current.tourismBadge}</span>
                  </>
                )}
                {topic === "risk" && (
                  <>
                    <small>⚠️ ระดับเฝ้าระวังภัยธรรมชาติรวม</small>
                    <strong>
                      ระดับ {activeArea.current.multiHazardTier}
                      <span>/5</span>
                    </strong>
                    <span>{activeArea.current.primaryHazardLabel}</span>
                  </>
                )}
                {topic === "suitable" && (
                  <>
                    <small>✨ ดัชนีความเหมาะสมทำกิจกรรมวันนี้</small>
                    <strong>
                      {activeArea.current.suitabilityScore}
                      <span>%</span>
                    </strong>
                    <span>{activeArea.current.suitabilityTags.join(" · ")}</span>
                  </>
                )}
              </div>

              {/* Animated Visual Indicator Box on Right of Hero Banner */}
              <div className="fs-hero-visual-box" aria-hidden="true">
                {topic === "rain" && (
                  <div className="fs-vis-umbrella">
                    <span className="fs-vis-emoji">☔</span>
                    <div className="fs-vis-meter">
                      <i style={{ width: `${activeArea.current.rainProb}%` }} />
                    </div>
                    <small>ความจำเป็นในการพกร่ม</small>
                  </div>
                )}
                {topic === "sky" && (
                  <div className="fs-vis-sky">
                    <span className="fs-vis-emoji">🌤️</span>
                    <div className="fs-vis-meter">
                      <i style={{ width: `${100 - activeArea.current.cloudCoverPct}%` }} />
                    </div>
                    <small>ความโปร่งของท้องฟ้า {100 - activeArea.current.cloudCoverPct}%</small>
                  </div>
                )}
                {(topic === "tide" || topic === "wave") && (
                  <div className="fs-vis-sea">
                    <div className="fs-sea-tank">
                      <div
                        className="fs-sea-water"
                        style={{
                          height: `${Math.min(
                            92,
                            Math.max(22, ((activeArea.current.tideMsl + 1.5) / 3.2) * 100)
                          )}%`,
                        }}
                      >
                        <span className="fs-sea-wave" />
                      </div>
                      <b>
                        {!activeArea.isCoastal
                          ? "⛰️ พื้นที่ดอน"
                          : activeArea.current.tideTrend === "rising"
                            ? "⬆️ น้ำกำลังขึ้น"
                            : "⬇️ น้ำกำลังลง"}
                      </b>
                    </div>
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
                    <small>โอกาสหมอกเช้า {activeArea.current.mistChancePct}%</small>
                  </div>
                )}
                {(topic === "tourism" || topic === "suitable" || topic === "risk") && (
                  <div className="fs-vis-tourism">
                    <span className="fs-vis-emoji">
                      {topic === "risk" ? "🛡️" : topic === "tourism" ? "🏖️" : "✨"}
                    </span>
                    <div className="fs-vis-meter">
                      <i
                        style={{
                          width: `${
                            topic === "risk"
                              ? activeArea.current.multiHazardTier * 20
                              : activeArea.current.suitabilityScore
                          }%`,
                        }}
                      />
                    </div>
                    <small>{activeArea.bestActivity}</small>
                  </div>
                )}
              </div>
            </div>

            {/* PLAIN-LANGUAGE CITIZEN ADVICE */}
            <div className={`fs-friendly-box is-${advice.tone}`}>
              <strong>💡 คำแนะนำเข้าใจง่ายสำหรับประชาชน: {advice.headline}</strong>
              <p>{advice.action}</p>
              <small>📍 ลักษณะเฉพาะพื้นที่: {activeArea.coastalNote}</small>
            </div>

            {/* TOURISM & LANDMARK HIGHLIGHTS PILLS */}
            <div className="fs-tourism-strip">
              <div className="fs-tourism-strip-head">
                <span>🎒 กิจกรรมเด่นแนะนำวันนี้:</span>
                <strong>{activeArea.bestActivity}</strong>
              </div>
              <div className="fs-landmark-tags">
                {activeArea.tourismHighlights.map(hl => (
                  <span key={hl} className="fs-landmark-pill">
                    📍 {hl}
                  </span>
                ))}
                {activeArea.current.suitabilityTags.map(tag => (
                  <span key={tag} className="fs-suit-pill">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* 5-LEVEL SYMBOLOGY LEGEND */}
            <div className="fs-risk-legend-box">
              <small className="fs-eyebrow">
                🎨 เกณฑ์สัญลักษณ์สี 5 ระดับ ({activeTopicMeta.label})
              </small>
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

            {/* 10-TOPIC MINI MATRIX SWITCHER */}
            <div className="fs-ten-strip" role="group" aria-label="สรุปครบทุกเรื่องในพื้นที่นี้">
              <button type="button" onClick={() => setTopic("rain")} className={topic === "rain" ? "is-selected" : ""}>
                <small>🌧️ ฝน</small>
                <b>{activeArea.current.rainProb}%</b>
              </button>
              <button type="button" onClick={() => setTopic("sky")} className={topic === "sky" ? "is-selected" : ""}>
                <small>🌤️ ฟ้า/อากาศ</small>
                <b>{activeArea.current.tempC}°C</b>
              </button>
              <button type="button" onClick={() => setTopic("tide")} className={topic === "tide" ? "is-selected" : ""}>
                <small>🌊 น้ำหนุน</small>
                <b>{activeArea.isCoastal ? `+${activeArea.current.highTideMsl}ม.` : "ดอน"}</b>
              </button>
              <button type="button" onClick={() => setTopic("wave")} className={topic === "wave" ? "is-selected" : ""}>
                <small>⛵ คลื่นลม</small>
                <b>{activeArea.isCoastal ? `${activeArea.current.waveHeightM}ม.` : `${activeArea.current.windKmh}กม.`}</b>
              </button>
              <button type="button" onClick={() => setTopic("air")} className={topic === "air" ? "is-selected" : ""}>
                <small>😷 PM2.5</small>
                <b>{activeArea.current.pm25}</b>
              </button>
              <button type="button" onClick={() => setTopic("heat")} className={topic === "heat" ? "is-selected" : ""}>
                <small>☀️ ร้อนจริง</small>
                <b>{activeArea.current.feelsLikeC}°C</b>
              </button>
              <button type="button" onClick={() => setTopic("winter")} className={topic === "winter" ? "is-selected" : ""}>
                <small>🍃 ลมหนาว</small>
                <b>{activeArea.current.minMorningC}°C</b>
              </button>
              <button type="button" onClick={() => setTopic("tourism")} className={topic === "tourism" ? "is-selected" : ""}>
                <small>🏖️ ท่องเที่ยว</small>
                <b>{activeArea.current.tourismScore}/100</b>
              </button>
              <button type="button" onClick={() => setTopic("risk")} className={topic === "risk" ? "is-selected" : ""}>
                <small>⚠️ ความเสี่ยง</small>
                <b>ระดับ {activeArea.current.multiHazardTier}</b>
              </button>
              <button type="button" onClick={() => setTopic("suitable")} className={topic === "suitable" ? "is-selected" : ""}>
                <small>✨ เหมาะสม</small>
                <b>{activeArea.current.suitabilityScore}%</b>
              </button>
            </div>
          </article>

          {/* RIGHT CARD: INTERACTIVE THAILAND MAP & ANIMATED 3D DIGITAL TWIN */}
          <article className="fs-map-card">
            <div className="fs-map-head">
              <div>
                <span className="fs-eyebrow">
                  🛰️ แผนที่ประเทศไทย Interactive & Digital Twin ({activeBBox.label})
                </span>
                <h2>
                  แผนที่ดาวเทียมพิกัดจริง ครอบคลุมทั่วไทย · {activeTopicMeta.icon} {activeTopicMeta.label}
                </h2>
              </div>
              <div className="fs-zone-filters" role="group" aria-label="สลับภาพพื้นหลังแผนที่">
                <button
                  type="button"
                  aria-pressed={basemap === "satellite"}
                  onClick={() => setBasemap("satellite")}
                >
                  🛰️ ดาวเทียมจริง
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
                  🌑 โหมดมืดเรืองแสง
                </button>
              </div>
            </div>

            <div className="fs-qgis-subtoolbar">
              <div className="fs-zone-filters">
                <button
                  type="button"
                  aria-pressed={showRadarWind}
                  onClick={() => setShowRadarWind(v => !v)}
                >
                  📡 เรดาร์ฝน & กระแสลม
                </button>
                <button
                  type="button"
                  aria-pressed={showBuffer}
                  onClick={() => setShowBuffer(v => !v)}
                >
                  🎯 รัศมีสีความเสี่ยง/ความเหมาะสม
                </button>
                <button
                  type="button"
                  aria-pressed={showGrid}
                  onClick={() => setShowGrid(v => !v)}
                >
                  📐 กริดพิกัด (°N/°E)
                </button>
              </div>
              <div className="fs-zone-filters">
                {regionFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setRegionFilter("all")}
                    className="fs-zoom-reset-btn"
                  >
                    🇹🇭 ซูมออกดูทั่วประเทศ
                  </button>
                )}
              </div>
            </div>

            {mainViewMode === "3d" && (
              <div className="fs-map-embedded-3d">
                <div className="fs-3d-inline-header">
                  <span>
                    🌐 แบบจำลอง 3D Digital Twin ทั่วไทย ({activeArea.name} · ณ เวลา {nowClockText} น.)
                  </span>
                  <div className="fs-3d-btn-group" role="group" aria-label="เลือกมุมกล้อง 3 มิติ">
                    <button type="button" aria-pressed={twinCamera === "iso"} onClick={() => setTwinCamera("iso")}>
                      📐 3D Iso
                    </button>
                    <button type="button" aria-pressed={twinCamera === "atmosphere"} onClick={() => setTwinCamera("atmosphere")}>
                      🌩️ บรรยากาศ
                    </button>
                    <button type="button" aria-pressed={twinCamera === "coastal"} onClick={() => setTwinCamera("coastal")}>
                      🌊 ทะเลไทย
                    </button>
                    <button type="button" aria-pressed={twinCamera === "top"} onClick={() => setTwinCamera("top")}>
                      🦅 มุมสูง
                    </button>
                    <button type="button" aria-pressed={twinAutoRotate} onClick={() => setTwinAutoRotate(v => !v)}>
                      {twinAutoRotate ? "⏸️ หยุด" : "🔄 หมุน"}
                    </button>
                  </div>
                </div>
                {renderTwinSceneContent()}
              </div>
            )}

            {(mainViewMode === "2d" || mainViewMode === "split") && (
              <div className={mainViewMode === "split" ? "fs-split-stage" : ""}>
                <div className="fs-svg-map-wrap is-qgis">
                  <svg
                    viewBox="0 0 520 740"
                    className="fs-svg-map is-thailand"
                    role="img"
                    aria-label="แผนที่ประเทศไทยพิกัดจริง WGS84 แสดงข้อมูลฝน ฟ้า อากาศ น้ำทะเล คลื่นลม ฝุ่น ความร้อน ลมหนาว การท่องเที่ยว พื้นที่เสี่ยง และพื้นที่เหมาะสม"
                  >
                    <defs>
                      <linearGradient id="fs-sea-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={basemap === "topo" ? "#bae6fd" : "#062138"} />
                        <stop offset="50%" stopColor={basemap === "topo" ? "#7dd3fc" : "#0a3656"} />
                        <stop offset="100%" stopColor={basemap === "topo" ? "#38bdf8" : "#041628"} />
                      </linearGradient>
                      <filter id="fs-idw-blur" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="22" />
                      </filter>
                      <filter id="fs-radar-blur" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="11" />
                      </filter>
                      <marker
                        id="fs-wind-arrow"
                        viewBox="0 0 10 10"
                        refX="7"
                        refY="5"
                        markerWidth="5.5"
                        markerHeight="5.5"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                      </marker>
                      <marker
                        id="fs-storm-arrow"
                        viewBox="0 0 10 10"
                        refX="7"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#facc15" />
                      </marker>
                      <clipPath id="fs-frame-clip">
                        <rect
                          x={THAILAND_MAP_FRAME.x}
                          y={THAILAND_MAP_FRAME.y}
                          width={THAILAND_MAP_FRAME.width}
                          height={THAILAND_MAP_FRAME.height}
                        />
                      </clipPath>
                    </defs>

                    <rect
                      x={THAILAND_MAP_FRAME.x}
                      y={THAILAND_MAP_FRAME.y}
                      width={THAILAND_MAP_FRAME.width}
                      height={THAILAND_MAP_FRAME.height}
                      fill="url(#fs-sea-grad)"
                    />

                    {basemap === "satellite" && (
                      <image
                        href={activeSatUrl}
                        x={THAILAND_MAP_FRAME.x}
                        y={THAILAND_MAP_FRAME.y}
                        width={THAILAND_MAP_FRAME.width}
                        height={THAILAND_MAP_FRAME.height}
                        preserveAspectRatio="none"
                        opacity="0.92"
                      />
                    )}
                    {basemap === "topo" && (
                      <image
                        href={activeTopoUrl}
                        x={THAILAND_MAP_FRAME.x}
                        y={THAILAND_MAP_FRAME.y}
                        width={THAILAND_MAP_FRAME.width}
                        height={THAILAND_MAP_FRAME.height}
                        preserveAspectRatio="none"
                        opacity="0.92"
                      />
                    )}

                    <g clipPath="url(#fs-frame-clip)">
                      {/* Thailand National Border Outline */}
                      <path
                        d={projectThailandPolyline(THAILAND_BORDER_WGS84, activeBBox)}
                        fill={basemap === "dark" ? "rgba(15, 38, 62, 0.72)" : "rgba(255, 255, 255, 0.04)"}
                        stroke="#38bdf8"
                        strokeWidth="2.2"
                        strokeLinejoin="round"
                      />

                      {/* IDW Spatial Halo Layer */}
                      {showBuffer && (
                        <g filter="url(#fs-idw-blur)">
                          {filteredAreas.map(area => {
                            const pt = projectThailandGeo(area.lat, area.lng, activeBBox);
                            const rTier = classifyAreaRisk(area, topic);
                            const col = bands.find(b => b.tier === rTier)?.color ?? "#10b981";
                            return (
                              <circle
                                key={`halo-${area.id}`}
                                cx={pt.x}
                                cy={pt.y}
                                r={rTier >= 4 ? 44 : rTier === 3 ? 34 : 26}
                                fill={col}
                                opacity={0.48}
                              />
                            );
                          })}
                        </g>
                      )}

                      {/* Animated Radar Cells & Wind Streamlines Across Thailand */}
                      {showRadarWind && (
                        <g className="fs-radar-wind-layer">
                          {filteredAreas
                            .filter(a => a.current.rainProb >= 32)
                            .map(area => {
                              const pt = projectThailandGeo(area.lat, area.lng, activeBBox);
                              const moveRad = ((area.current.windDeg + 180 - 90) * Math.PI) / 180;
                              const tx = pt.x + Math.cos(moveRad) * 32;
                              const ty = pt.y + Math.sin(moveRad) * 32;
                              const dbzColor =
                                area.current.rainProb >= 55
                                  ? "#ef4444"
                                  : area.current.rainProb >= 40
                                    ? "#f97316"
                                    : "#22c55e";
                              return (
                                <g key={`radar-${area.id}`}>
                                  <g filter="url(#fs-radar-blur)">
                                    <ellipse cx={pt.x} cy={pt.y} rx="26" ry="18" fill="#22c55e" opacity="0.34" />
                                    <ellipse cx={pt.x} cy={pt.y} rx="15" ry="10" fill={dbzColor} opacity="0.54" />
                                  </g>
                                  <line
                                    x1={pt.x}
                                    y1={pt.y}
                                    x2={tx}
                                    y2={ty}
                                    stroke="#facc15"
                                    strokeWidth="1.8"
                                    strokeDasharray="3 2"
                                    markerEnd="url(#fs-storm-arrow)"
                                  />
                                </g>
                              );
                            })}

                          {/* Nationwide Monsoon Wind Vectors */}
                          {[
                            { lat: 19.2, lng: 100.2, label: "ลมเหนือ" },
                            { lat: 16.0, lng: 103.6, label: "ลมอีสาน" },
                            { lat: 12.2, lng: 100.8, label: "ลมอ่าวไทย" },
                            { lat: 8.6, lng: 101.0, label: "มรสุมอ่าวไทย" },
                            { lat: 8.2, lng: 97.9, label: "ลมอันดามัน" },
                          ].map((w, idx) => {
                            const p1 = projectThailandGeo(w.lat, w.lng, activeBBox);
                            const moveRad =
                              ((activeArea.current.windDeg + 180 - 90) * Math.PI) / 180;
                            const p2 = {
                              x: p1.x + Math.cos(moveRad) * 36,
                              y: p1.y + Math.sin(moveRad) * 36,
                            };
                            return (
                              <g key={`wind-stream-${idx}`} opacity="0.86">
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
                                  stroke="rgba(8,24,40,0.88)"
                                  strokeWidth="2.2"
                                  paintOrder="stroke"
                                  fontSize="8.5"
                                  fontWeight="700"
                                  textAnchor="middle"
                                >
                                  {w.label} {activeArea.current.windKmh} กม./ชม.
                                </text>
                              </g>
                            );
                          })}
                        </g>
                      )}

                      {/* Sea Labels for Gulf of Thailand & Andaman Sea */}
                      {(() => {
                        const gulfPt = projectThailandGeo(10.8, 101.2, activeBBox);
                        const andamanPt = projectThailandGeo(9.2, 97.9, activeBBox);
                        return (
                          <g className="fs-gulf-waves">
                            <text x={gulfPt.x} y={gulfPt.y} textAnchor="middle" className="fs-gulf-label">
                              🌊 อ่าวไทย (Gulf of Thailand)
                            </text>
                            <text x={andamanPt.x} y={andamanPt.y} textAnchor="middle" className="fs-gulf-label">
                              ⛵ ทะเลอันดามัน
                            </text>
                          </g>
                        );
                      })()}

                      {/* Interactive Province Pins & Non-Overlapping Callout Pills */}
                      {filteredAreas.map(area => {
                        const pt = projectThailandGeo(area.lat, area.lng, activeBBox);
                        const isSel = area.id === activeArea.id;
                        const metric = pinMetricLabel(area, topic);
                        const rTier = classifyAreaRisk(area, topic);
                        const riskColor = bands.find(b => b.tier === rTier)?.color ?? "#0284c7";
                        const offset = THAILAND_LABEL_OFFSETS[area.id] ?? {
                          dx: 48,
                          dy: -14,
                          shortName: area.name.split(" ")[0],
                        };
                        const pillW = 94;
                        const pillH = 21;

                        return (
                          <g
                            key={area.id}
                            className={`fs-map-pin ${isSel ? "is-selected" : ""}`}
                            transform={`translate(${pt.x}, ${pt.y})`}
                            onClick={() => setSelectedId(area.id)}
                            role="button"
                            tabIndex={0}
                            aria-label={`เลือกพื้นที่ ${area.name} (${area.regionName}) ค่าปัจจุบัน ${metric}`}
                          >
                            {isSel && (
                              <circle r="18" className="fs-pin-pulse" style={{ fill: riskColor }} />
                            )}
                            <line
                              x1="0"
                              y1="0"
                              x2={offset.dx}
                              y2={offset.dy}
                              stroke="#ffffff"
                              strokeWidth={isSel ? "2" : "1.2"}
                              opacity="0.9"
                            />
                            <circle
                              r={isSel ? 7.5 : 5.2}
                              fill={riskColor}
                              stroke="#ffffff"
                              strokeWidth="2"
                            />
                            <circle r="2" fill="#ffffff" />

                            <g transform={`translate(${offset.dx}, ${offset.dy})`}>
                              <rect
                                x={-pillW / 2}
                                y={-pillH / 2}
                                width={pillW}
                                height={pillH}
                                rx="10.5"
                                fill={isSel ? "rgba(2, 132, 199, 0.96)" : "rgba(10, 25, 41, 0.92)"}
                                stroke={isSel ? "#ffffff" : riskColor}
                                strokeWidth={isSel ? "2.2" : "1.3"}
                              />
                              <circle cx={-pillW / 2 + 9} cy="0" r="4" fill={riskColor} />
                              <text
                                x="4"
                                y="3.5"
                                textAnchor="middle"
                                fill="#ffffff"
                                fontSize="8.8"
                                fontWeight="800"
                              >
                                {offset.shortName} {metric}
                              </text>
                            </g>
                          </g>
                        );
                      })}
                    </g>

                    {/* Coordinate Graticule Grid */}
                    {showGrid && (
                      <g className="fs-qgis-grid">
                        {graticuleLats.map(lat => {
                          const { y } = projectThailandGeo(lat, activeBBox.minLng, activeBBox);
                          const label = formatDms(lat, true);
                          return (
                            <g key={`lat-${lat}`}>
                              <line
                                x1={THAILAND_MAP_FRAME.x}
                                y1={y}
                                x2={THAILAND_MAP_FRAME.x + THAILAND_MAP_FRAME.width}
                                y2={y}
                              />
                              <text x={THAILAND_MAP_FRAME.x + 6} y={y - 4}>
                                {label}
                              </text>
                              <text
                                x={THAILAND_MAP_FRAME.x + THAILAND_MAP_FRAME.width - 6}
                                y={y - 4}
                                textAnchor="end"
                              >
                                {label}
                              </text>
                            </g>
                          );
                        })}
                        {graticuleLngs.map(lng => {
                          const { x } = projectThailandGeo(activeBBox.minLat, lng, activeBBox);
                          const label = formatDms(lng, false);
                          return (
                            <g key={`lng-${lng}`}>
                              <line
                                x1={x}
                                y1={THAILAND_MAP_FRAME.y}
                                x2={x}
                                y2={THAILAND_MAP_FRAME.y + THAILAND_MAP_FRAME.height}
                              />
                              <text x={x + 4} y={THAILAND_MAP_FRAME.y + 13}>
                                {label}
                              </text>
                            </g>
                          );
                        })}
                      </g>
                    )}

                    {/* Compass Rose */}
                    <g transform="translate(468, 48)">
                      <circle
                        r="18"
                        fill="rgba(12, 28, 44, 0.85)"
                        stroke="rgba(255,255,255,0.45)"
                      />
                      <polygon points="0,-12 -5,6 0,3 5,6" fill="#ffffff" />
                      <text
                        x="0"
                        y="14"
                        textAnchor="middle"
                        fill="#7dd3fc"
                        fontSize="8"
                        fontWeight="800"
                      >
                        N
                      </text>
                    </g>

                    {/* Scale Bar */}
                    <g transform="translate(36, 698)">
                      <rect
                        x="-4"
                        y="-12"
                        width="134"
                        height="20"
                        rx="4"
                        fill="rgba(12, 28, 44, 0.85)"
                      />
                      <rect x="2" y="1" width="42" height="4" fill="#ffffff" />
                      <rect x="44" y="1" width="42" height="4" fill="#38bdf8" />
                      <text x="2" y="-2" fill="#ffffff" fontSize="8" fontWeight="700">
                        0
                      </text>
                      <text x="38" y="-2" fill="#ffffff" fontSize="8" fontWeight="700">
                        100
                      </text>
                      <text x="78" y="-2" fill="#7dd3fc" fontSize="8" fontWeight="700">
                        200 กม.
                      </text>
                    </g>

                    <rect
                      x={THAILAND_MAP_FRAME.x}
                      y={THAILAND_MAP_FRAME.y}
                      width={THAILAND_MAP_FRAME.width}
                      height={THAILAND_MAP_FRAME.height}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  </svg>

                  <div className="fs-qgis-titleblock">
                    <div>
                      <small>
                        GEOSPATIAL DATUM: WGS 84 (EPSG:4326) · ขอบเขต: {activeBBox.label}
                      </small>
                      <strong>
                        แผนที่ฟ้าใสทั่วไทย ({activeTopicMeta.label}) · คลิกที่หมุดจังหวัดเพื่อดูรายละเอียดทันที
                      </strong>
                    </div>
                    <span>
                      {activeArea.name} · <b>ระดับ {activeTier}/5</b>
                    </span>
                  </div>
                </div>

                {mainViewMode === "split" && (
                  <div className="fs-split-3d-pane">{renderTwinSceneContent()}</div>
                )}
              </div>
            )}

            {/* QUICK PROVINCE CHIPS BELOW MAP */}
            <div className="fs-area-chips" role="group" aria-label="เลือกจังหวัดอย่างรวดเร็ว">
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

        {/* SECTION 4: ✨ พื้นที่เหมาะสมที่สุด vs ⚠️ พื้นที่เสี่ยงเฝ้าระวังทั่วไทย (RISK vs SUITABLE SPOTLIGHT) */}
        <section
          className="fs-risk-suitable-section"
          id="fs-risk-suitable"
          aria-label="เปรียบเทียบพื้นที่เหมาะสมที่สุดและพื้นที่เฝ้าระวังความเสี่ยงทั่วไทย"
        >
          <div className="fs-rs-grid">
            {/* LEFT: TOP SUITABLE & TOURISM DESTINATIONS TODAY */}
            <article className="fs-rs-card is-suitable">
              <div className="fs-rs-head">
                <div>
                  <span className="fs-eyebrow">✨ BEST PLACES TODAY · พื้นที่เหมาะสม & น่าไปที่สุดวันนี้</span>
                  <h2>จัดอันดับจังหวัดฟ้าใส อากาศดี น่าท่องเที่ยวและทำกิจกรรมกลางแจ้ง</h2>
                </div>
                <button
                  type="button"
                  className="fs-rs-mode-btn"
                  onClick={() => setTopic("suitable")}
                >
                  ดูบนแผนที่ →
                </button>
              </div>
              <div className="fs-rs-list">
                {topSuitableAreas.map((area, idx) => (
                  <div
                    key={area.id}
                    className={`fs-rs-item ${area.id === activeArea.id ? "is-active" : ""}`}
                    onClick={() => setSelectedId(area.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") setSelectedId(area.id);
                    }}
                  >
                    <span className="fs-rs-rank is-good">#{idx + 1}</span>
                    <div className="fs-rs-info">
                      <div className="fs-rs-title-row">
                        <strong>{area.name}</strong>
                        <small>{area.regionName}</small>
                      </div>
                      <p>{area.bestActivity}</p>
                      <div className="fs-rs-tags">
                        {area.current.suitabilityTags.slice(0, 3).map(t => (
                          <span key={t}>{t}</span>
                        ))}
                      </div>
                    </div>
                    <div className="fs-rs-score is-good">
                      <strong>{area.current.suitabilityScore}%</strong>
                      <small>เหมาะสม</small>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            {/* RIGHT: MULTI-HAZARD RISK WATCH AREAS TODAY */}
            <article className="fs-rs-card is-risk">
              <div className="fs-rs-head">
                <div>
                  <span className="fs-eyebrow">⚠️ RISK SURVEILLANCE · พื้นที่เฝ้าระวังความเสี่ยงวันนี้</span>
                  <h2>จุดเฝ้าระวังฝนตกหนัก คลื่นลมแรง น้ำทะเลหนุน ฝุ่น และความร้อน</h2>
                </div>
                <button
                  type="button"
                  className="fs-rs-mode-btn is-warn"
                  onClick={() => setTopic("risk")}
                >
                  ดูแผนที่เสี่ยง →
                </button>
              </div>
              <div className="fs-rs-list">
                {topRiskAreas.map(area => {
                  const tier = area.current.multiHazardTier;
                  const badgeCol =
                    tier >= 4 ? "#ef4444" : tier === 3 ? "#f59e0b" : "#0ea5e9";
                  return (
                    <div
                      key={area.id}
                      className={`fs-rs-item ${area.id === activeArea.id ? "is-active" : ""}`}
                      onClick={() => setSelectedId(area.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") setSelectedId(area.id);
                      }}
                    >
                      <span className="fs-rs-rank" style={{ background: badgeCol }}>
                        Lv.{tier}
                      </span>
                      <div className="fs-rs-info">
                        <div className="fs-rs-title-row">
                          <strong>{area.name}</strong>
                          <small>{area.regionName}</small>
                        </div>
                        <p>{area.current.primaryHazardLabel}</p>
                        <small className="fs-rs-submetrics">
                          🌧️ ฝน {area.current.rainProb}% · 😷 PM2.5 {area.current.pm25} · ☀️ ร้อนจริง{" "}
                          {area.current.feelsLikeC}°C
                          {area.isCoastal ? ` · 🌊 คลื่น ${area.current.waveHeightM}ม.` : ""}
                        </small>
                      </div>
                      <div className="fs-rs-score" style={{ color: badgeCol }}>
                        <strong>ระดับ {tier}/5</strong>
                        <small>เฝ้าระวัง</small>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          </div>
        </section>

        {/* SECTION 5: 🏖️ LIFESTYLE & DAILY ACTIVITY PLANNER CARDS (อื่นๆ ครบวงจรสำหรับประชาชน) */}
        <section className="fs-lifestyle-section" aria-label="การ์ดวางแผนชีวิตประจำวันและกิจกรรมกลางแจ้งครบวงจร">
          <div className="fs-section-head">
            <div>
              <span className="fs-eyebrow">🌱 SMART LIFESTYLE & DAILY PLANNER · ตัวช่วยตัดสินใจในชีวิตประจำวันครบวงจร</span>
              <h2>คะแนนความเหมาะสมสำหรับกิจกรรมประจำวันใน {activeArea.name}</h2>
            </div>
          </div>
          <div className="fs-lifestyle-grid">
            {[
              {
                icon: "👕",
                title: "ซักผ้า & ตากผ้ากลางแจ้ง",
                score: activeArea.current.lifestyle.laundryScore,
                desc: activeArea.current.lifestyle.laundryLabel,
                sub: `แดด/อุณหภูมิ ${activeArea.current.tempC}°C · ความชื้น ${activeArea.current.humidity}%`,
              },
              {
                icon: "🏃",
                title: "วิ่ง & ออกกำลังกายในสวน",
                score: activeArea.current.lifestyle.outdoorScore,
                desc: activeArea.current.lifestyle.outdoorLabel,
                sub: `PM2.5 ${activeArea.current.pm25} µg/m³ · RealFeel ${activeArea.current.feelsLikeC}°C`,
              },
              {
                icon: "⛺",
                title: "แคมป์ปิ้ง ดูดาว & ชมหมอก",
                score: activeArea.current.lifestyle.campingScore,
                desc: activeArea.current.lifestyle.campingLabel,
                sub: `ต่ำสุดเช้ามืด ${activeArea.current.minMorningC}°C · โอกาสหมอก ${activeArea.current.mistChancePct}%`,
              },
              {
                icon: "🚤",
                title: "เที่ยวทะเล ดำน้ำ & ล่องเรือ",
                score: activeArea.current.lifestyle.marineScore,
                desc: activeArea.current.lifestyle.marineLabel,
                sub: activeArea.isCoastal
                  ? `คลื่นสูง ${activeArea.current.waveHeightM} ม. · น้ำขึ้นสูงสุด +${activeArea.current.highTideMsl} ม.`
                  : `ลม ${activeArea.current.windKmh} กม./ชม. · แหล่งน้ำในแผ่นดิน`,
              },
              {
                icon: "🚗",
                title: "ล้างรถ & ขับรถเดินทางไกล",
                score: activeArea.current.lifestyle.carWashScore,
                desc: activeArea.current.lifestyle.carWashLabel,
                sub: `โอกาสฝน ${activeArea.current.rainProb}% · ทัศนวิสัย ${activeArea.current.visibilityKm} กม.`,
              },
              {
                icon: "⚡",
                title: "โซลาร์เซลล์ & พลังงานแสงอาทิตย์",
                score: activeArea.current.lifestyle.solarScore,
                desc: activeArea.current.lifestyle.solarLabel,
                sub: `UV สูงสุด ${activeArea.current.uvIndex} · เมฆปกคลุม ${activeArea.current.cloudCoverPct}%`,
              },
            ].map(item => {
              const toneColor =
                item.score >= 75 ? "#10b981" : item.score >= 55 ? "#f59e0b" : "#ef4444";
              return (
                <article key={item.title} className="fs-lifestyle-card">
                  <div className="fs-lc-top">
                    <span className="fs-lc-icon">{item.icon}</span>
                    <div className="fs-lc-badge" style={{ background: toneColor }}>
                      {item.score}/100
                    </div>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                  <div className="fs-lc-bar">
                    <i style={{ width: `${item.score}%`, background: toneColor }} />
                  </div>
                  <small>{item.sub}</small>
                </article>
              );
            })}
          </div>
        </section>

        {/* SECTION 6: LIVE RADAR TRAJECTORY + 4 TIME-WINDOW QUANTITATIVE SCHEDULE */}
        <section
          className="fs-live-alert-section"
          aria-label="ความเสี่ยงตอนนี้และตารางแจ้งเตือนรายช่วงเวลา"
        >
          <div className="fs-live-alert-top">
            <div className="fs-live-alert-badges">
              <span className="fs-live-risk-pill" style={{ background: activeTierColor }}>
                🚨 สถานะตอนนี้ ({activeArea.name} · ณ เวลา {nowClockText} น.): ระดับ {activeTier}/5 ·{" "}
                {bands.find(b => b.tier === activeTier)?.label}
              </span>
              <span className="fs-live-radar-pill">
                📡 เรดาร์กลุ่มฝน {radarAndSchedule.dbz} dBZ (~{radarAndSchedule.rainRateMmHr} มม./ชม.) · ลม
                {activeArea.current.windDirLabel} {activeArea.current.windKmh} กม./ชม.
              </span>
              <span className="fs-live-coord-pill">
                📍 พิกัด {activeArea.lat.toFixed(4)}°N, {activeArea.lng.toFixed(4)}°E
              </span>
            </div>
            <p className="fs-live-radar-desc">
              🧭 <strong>วิเคราะห์เรดาร์และทิศทางฝน–ลมตอนนี้ (ณ เวลา {nowClockText} น.):</strong> ลม
              {activeArea.current.windDirLabel}พัดด้วยความเร็ว <b>{activeArea.current.windKmh} กม./ชม.</b>{" "}
              (ลมกระโชกสูงสุด <b>{activeArea.current.windGustKmh} กม./ชม.</b>) ส่งผลให้กลุ่มเมฆฝน{" "}
              <b>{radarAndSchedule.moveDirText}</b> คาดว่าจะเคลื่อนตัวถึงพื้นที่รับลมภายในประมาณ{" "}
              <b>{radarAndSchedule.etaMin} นาที</b> · ปริมาณฝนสะสม 24 ชม. คาดการณ์{" "}
              <b>{activeArea.current.rain24hMm} มม.</b>
            </p>
          </div>

          <div className="fs-schedule-grid">
            {radarAndSchedule.slots.map((slot, i) => (
              <div
                key={i}
                className="fs-schedule-card"
                style={{ borderTop: `4px solid ${slot.color}` }}
              >
                <div className="fs-schedule-head">
                  <strong>⏰ {slot.windowText}</strong>
                  <span style={{ background: slot.color }}>ระดับ {slot.tier}</span>
                </div>
                <small className="fs-schedule-tag">{slot.tag}</small>
                <div className="fs-schedule-body">
                  <p>
                    🌧️ <b>ปริมาณฝน:</b> {slot.rainQty}
                  </p>
                  <p>
                    🧭 <b>ทิศทางลม & เรดาร์:</b> {slot.windRadarQty}
                  </p>
                  <p>
                    📊 <b>สภาพแวดล้อม:</b> {slot.otherQty}
                  </p>
                </div>
                <p className="fs-schedule-advice">💡 {slot.adviceText}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 7: FULL-SCREEN 3D ANIMATED DIGITAL TWIN SHOWCASE */}
        <section
          className="fs-3d-twin-section"
          id="fs-3d-twin"
          aria-label="แบบจำลองบรรยากาศ เมือง ภูเขา และทะเลไทย 3 มิติแบบอนิเมชัน"
        >
          <div className="fs-3d-twin-head">
            <div>
              <span className="fs-eyebrow">
                🌐 3D ANIMATED DIGITAL TWIN THAILAND · แบบจำลองภูมิอากาศและทะเลไทย 3 มิติ
              </span>
              <h2>
                สำรวจชั้นบรรยากาศ เมฆฝนเรดาร์ ฝาชีครอบฝุ่น PM2.5 ลมมรสุม และคลื่นน้ำทะเล 3 มิติ ({activeArea.name})
              </h2>
              <p>
                หมุนปรับมุมกล้อง 3 มิติได้อย่างอิสระ เพื่อดูความสัมพันธ์ตั้งแต่ชั้นเมฆฝนระดับบน ลมหนาวบนยอดดอย ชั้นฝาชีครอบฝุ่น ไปจนถึงระดับน้ำทะเลหนุนและคลื่นลมในอ่าวไทย–อันดามัน
              </p>
            </div>
            <div className="fs-3d-controls">
              <div className="fs-3d-btn-group" role="group" aria-label="เลือกมุมกล้อง 3 มิติ">
                <button
                  type="button"
                  aria-pressed={twinCamera === "iso"}
                  onClick={() => setTwinCamera("iso")}
                >
                  📐 มุมมอง 3D Isometric
                </button>
                <button
                  type="button"
                  aria-pressed={twinCamera === "atmosphere"}
                  onClick={() => setTwinCamera("atmosphere")}
                >
                  🌩️ ซูมชั้นบรรยากาศ–เมฆเรดาร์
                </button>
                <button
                  type="button"
                  aria-pressed={twinCamera === "coastal"}
                  onClick={() => setTwinCamera("coastal")}
                >
                  🌊 ซูมคลื่น–น้ำทะเลหนุน
                </button>
                <button
                  type="button"
                  aria-pressed={twinCamera === "top"}
                  onClick={() => setTwinCamera("top")}
                >
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

          {renderTwinSceneContent()}
        </section>

        {/* SECTION 8: INTERACTIVE 24-HOUR ANIMATED CURVE & SCRUBBER */}
        <section className="fs-timeline-section" aria-labelledby="fs-hourly-title">
          <div className="fs-section-head">
            <div>
              <span className="fs-eyebrow">
                📈 กราฟโต้ตอบรายชั่วโมง 24 ชม. (Interactive 24-Hour Curve & Scrubber)
              </span>
              <h2 id="fs-hourly-title">
                เส้นแนวโน้มรายชั่วโมงของ {activeArea.name} ({activeTopicMeta.label})
              </h2>
            </div>
            <div className="fs-hour-readout">
              <span>
                เวลาที่เลือก: <strong>{activeHour.hourLabel} น.</strong>
              </span>
              <b>
                🌡️ {activeHour.tempC}°C (ร้อนจริง {activeHour.feelsLikeC}°C) · 🌧️ ฝน{" "}
                {activeHour.rainProb}% · 😷 PM2.5 {activeHour.pm25} · 🌊 น้ำทะเล{" "}
                {activeHour.tideMsl >= 0 ? "+" : ""}
                {activeHour.tideMsl} ม.
              </b>
            </div>
          </div>

          <p className="fs-mobile-chart-hint">
            คลิกที่จุดชั่วโมงหรือเลื่อนแถบด้านล่างเพื่อดูการเปลี่ยนแปลงตลอด 24 ชั่วโมง (ซิงก์กับแบบจำลอง 3D Twin อัตโนมัติ)
          </p>
          <div className="fs-curve-svg-wrap">
            <svg
              viewBox="0 0 760 135"
              className="fs-curve-svg"
              role="img"
              aria-label={`กราฟเส้นโค้งรายชั่วโมง 24 ชั่วโมงของ ${activeArea.name}`}
            >
              <defs>
                <linearGradient id="fs-curve-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={activeTierColor} stopOpacity="0.42" />
                  <stop offset="100%" stopColor={activeTierColor} stopOpacity="0.03" />
                </linearGradient>
              </defs>
              <line
                x1="24"
                y1={hourlyCurve.thresholdY}
                x2="736"
                y2={hourlyCurve.thresholdY}
                stroke="#f43f5e"
                strokeWidth="1.4"
                strokeDasharray="5 4"
              />
              <text
                x="732"
                y={Math.max(12, hourlyCurve.thresholdY - 5)}
                textAnchor="end"
                fill="#f43f5e"
                fontSize="9.5"
                fontWeight="800"
              >
                --- {hourlyCurve.thresholdLabel}
              </text>

              <path d={hourlyCurve.areaPath} fill="url(#fs-curve-fill)" />
              <path
                d={hourlyCurve.linePath}
                fill="none"
                stroke={activeTierColor}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

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
                        {topic === "tide"
                          ? `${p.val >= 0 ? "+" : ""}${p.val}`
                          : topic === "wave"
                            ? `${p.val}m`
                            : Math.round(p.val)}
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
                      : topic === "winter" || topic === "sky"
                        ? h.tempC
                        : topic === "wave"
                          ? h.waveM
                          : h.tideMsl;
              const heightPct =
                topic === "rain"
                  ? Math.max(8, h.rainProb)
                  : topic === "air"
                    ? Math.min(100, Math.max(10, (h.pm25 / 60) * 100))
                    : topic === "heat" || topic === "winter" || topic === "sky"
                      ? Math.min(100, Math.max(15, ((val - 14) / 28) * 100))
                      : topic === "wave"
                        ? Math.min(100, Math.max(14, (h.waveM / 2.2) * 100))
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
                        : topic === "tide"
                          ? `${h.tideMsl >= 0 ? "+" : ""}${h.tideMsl}`
                          : topic === "wave"
                            ? `${h.waveM}m`
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

        {/* SECTION 9: VISUAL SCIENCE EXPLAINER FOR CITIZENS */}
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

        {/* SECTION 10: 7-DAY OUTLOOK & COASTAL / REGIONAL SUMMARY */}
        <section className="fs-bottom-grid">
          <article className="fs-daily-card">
            <span className="fs-eyebrow">📅 พยากรณ์ล่วงหน้า 7 วัน (7-Day Outlook)</span>
            <h3>แนวโน้มรายวัน & คะแนนน่าเที่ยว · {activeArea.name}</h3>
            <div className="fs-daily-list">
              {activeArea.daily.map(d => (
                <div key={d.dayLabel} className="fs-daily-row">
                  <strong>{d.dayLabel}</strong>
                  <span className="fs-daily-rain">
                    🌧️ {d.rainProb}% ({d.rainMm} มม.)
                  </span>
                  <span className="fs-daily-temp">
                    🍃 <b>{d.minTempC}°C</b> — ☀️ <b>{d.maxTempC}°C</b>
                  </span>
                  <span className="fs-daily-uv">🏖️ น่าเที่ยว {d.tourismScore}%</span>
                </div>
              ))}
            </div>
          </article>

          <article className="fs-sea-summary-card">
            <span className="fs-eyebrow">🌊 สรุปน้ำทะเล คลื่นลม & ภูมิอากาศของพื้นที่</span>
            <h3>ข้อมูลสำคัญประจำวัน · {activeArea.name} ({activeArea.regionName})</h3>
            <div className="fs-sea-bento">
              <div>
                <small>⬆️ น้ำทะเลขึ้นสูงสุด / ระดับพื้นที่</small>
                <strong>
                  {activeArea.isCoastal || activeArea.current.highTideMsl > 0
                    ? `+${activeArea.current.highTideMsl} ม. รทก.`
                    : `สูง ${activeArea.elevationM} เมตร`}
                </strong>
                <span>{activeArea.current.highTideTime}</span>
              </div>
              <div>
                <small>⬇️ น้ำทะเลลงต่ำสุด / การระบายน้ำ</small>
                <strong>
                  {activeArea.isCoastal || activeArea.current.highTideMsl > 0
                    ? `${activeArea.current.lowTideMsl} ม. รทก.`
                    : `ความกดอากาศ ${activeArea.current.pressureHpa} hPa`}
                </strong>
                <span>{activeArea.current.lowTideTime}</span>
              </div>
              <div>
                <small>⛵ คลื่นลม & ความปลอดภัยทางน้ำ</small>
                <strong>
                  {activeArea.isCoastal
                    ? `คลื่น ${activeArea.current.waveHeightM} เมตร`
                    : `หมอกเช้า ${activeArea.current.mistChancePct}%`}
                </strong>
                <span>{activeArea.current.seaStateLabel}</span>
              </div>
              <div>
                <small>🍃 ทิศทางลม & คุณภาพอากาศ</small>
                <strong>
                  ลม {activeArea.current.windKmh} กม./ชม. · PM2.5 {activeArea.current.pm25}
                </strong>
                <span>{activeArea.current.windDirLabel}</span>
              </div>
            </div>
          </article>
        </section>
      </main>

      <footer className="fs-footer">
        <div>
          <strong>🌤️ ฟ้าใส ทั่วไทย · FahSai Thailand Digital Twin Dashboard</strong>
          <p>
            แพลตฟอร์มข้อมูลสภาพอากาศ ภูมิอากาศ น้ำทะเลหนุน คลื่นลม ฝุ่น PM2.5 ความร้อน ลมหนาว การท่องเที่ยว พื้นที่เสี่ยง และพื้นที่เหมาะสม สำหรับประชาชนทั่วไป ครอบคลุมทั้ง 6 ภูมิภาคทั่วประเทศไทย
          </p>
        </div>
        <div className="fs-footer-badges">
          <span>🛰️ พิกัดจริง WGS84</span>
          <span>🌐 3D Digital Twin</span>
          <span>🇹🇭 ครอบคลุมทั่วไทย</span>
        </div>
      </footer>
    </div>
  );
}
