"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

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
  getNearbyAreas,
  getScienceExplainer,
  getTopicRelevantAreas,
  getTopicRiskBands,
  getTopicScopeConfig,
  pinMetricLabel,
  projectFahSaiGeo,
  THAILAND_LABEL_OFFSETS,
  TOPICS,
  type RiskBandInfo,
} from "./fahsai-helpers";
import "./fahsai.css";
import FahSaiTwinScene from "./fahsai-twin-scene";
import { FahSaiLeafletMap, type RealBasemapMode } from "./fahsai-leaflet-map";
import { FahSaiTopicPresentation } from "./fahsai-topic-presentation";

export {
  classifyAreaRisk,
  getNearbyAreas,
  getTopicRelevantAreas,
  getTopicRiskBands,
  getTopicScopeConfig,
  projectFahSaiGeo,
  type RiskBandInfo,
};

type TwinCameraMode = "iso" | "atmosphere" | "coastal" | "top";

export default function FahSaiApp() {
  const [payload, setPayload] = useState<FahSaiPayload>(() => buildFallbackPayload());
  const [topic, setTopic] = useState<TopicId>("rain");
  const [selectedId, setSelectedId] = useState<string>("bangkok");
  const [regionFilter, setRegionFilter] = useState<RegionId>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [basemapMode, setBasemapMode] = useState<RealBasemapMode>("street");
  const [showAllProvincesScope, setShowAllProvincesScope] = useState<boolean>(false);
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

  // Topic-scoped relevant areas (each topic has its own geographic coverage!)
  const topicScopedAreas = useMemo(() => {
    const baseList = showAllProvincesScope
      ? payload.areas
      : getTopicRelevantAreas(payload.areas, topic, regionFilter);

    const q = searchQuery.trim().toLowerCase();
    if (!q) return baseList;
    const searched = payload.areas.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.subtitle.toLowerCase().includes(q) ||
        a.regionName.toLowerCase().includes(q) ||
        a.tourismHighlights.some((h) => h.toLowerCase().includes(q))
    );
    return searched.length > 0 ? searched : baseList;
  }, [payload.areas, topic, regionFilter, showAllProvincesScope, searchQuery]);

  // Switch topic handler: automatically ensures selected province belongs to the topic's geographic scope
  const handleSelectTopic = (nextTopic: TopicId) => {
    setTopic(nextTopic);
    const nextRelevant = getTopicRelevantAreas(payload.areas, nextTopic, regionFilter);
    if (nextRelevant.length > 0 && !nextRelevant.some((a) => a.id === selectedId)) {
      setSelectedId(nextRelevant[0].id);
    }
  };

  const activeArea = useMemo(
    () =>
      payload.areas.find((a) => a.id === selectedId) ??
      topicScopedAreas[0] ??
      payload.areas[0],
    [payload.areas, topicScopedAreas, selectedId]
  );

  // Local-proximity neighborhood for the 3D Digital Twin (Selected province + 3 nearest neighbors)
  const nearbyTwinNodes = useMemo(
    () => getNearbyAreas(activeArea, payload.areas, 3),
    [activeArea, payload.areas]
  );

  const handleFindMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("เบราว์เซอร์ไม่รองรับการระบุพิกัด");
      return;
    }
    setLocating(true);
    setGpsStatus("กำลังค้นหาจังหวัดใกล้คุณ...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
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

  const activeHour = activeArea.hourly[hourIdx] ?? activeArea.hourly[0];
  const activeTopicMeta = useMemo(
    () => TOPICS.find((t) => t.id === topic) ?? TOPICS[0],
    [topic]
  );
  const scopeConfig = useMemo(() => getTopicScopeConfig(topic), [topic]);
  const bands = useMemo(() => getTopicRiskBands(topic), [topic]);
  const activeTier = classifyAreaRisk(activeArea, topic);
  const activeTierColor = bands.find((b) => b.tier === activeTier)?.color ?? "#0284c7";
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

  const getTopicQuickValue = (tId: TopicId): string => {
    const c = activeArea.current;
    if (tId === "rain") return `ฝน ${c.rainProb}% · ${c.rain24hMm} มม.`;
    if (tId === "sky") return `ฟ้าโปร่ง ${100 - c.cloudCoverPct}% · ${c.tempC}°C`;
    if (tId === "tide")
      return activeArea.isCoastal || c.highTideMsl > 0
        ? `สูงสุด +${c.highTideMsl} ม. (${c.highTideTime})`
        : `เฉพาะ 14 จ.ชายฝั่ง/ปากน้ำ`;
    if (tId === "wave")
      return activeArea.isCoastal
        ? `คลื่น ${c.waveHeightM} ม. · ลม ${c.windKmh} กม./ชม.`
        : `เฉพาะ 11 จ.ทะเลอ่าวไทย–อันดามัน`;
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
          ? Math.max(...slots.map((s) => s.rainProb))
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
          ? Math.max(...slots.map((s) => s.feelsLikeC))
          : c.feelsLikeC;
      const minTemp = isNowSlot
        ? c.minMorningC
        : slots.length
          ? Math.min(...slots.map((s) => s.tempC))
          : c.minMorningC;
      const maxPm25 = isNowSlot
        ? c.pm25
        : slots.length
          ? Math.max(...slots.map((s) => s.pm25))
          : c.pm25;
      const maxWind = isNowSlot
        ? c.windKmh
        : slots.length
          ? Math.max(...slots.map((s) => s.windKmh))
          : c.windKmh;
      const maxTide = isNowSlot
        ? c.tideMsl
        : slots.length
          ? Math.max(...slots.map((s) => s.tideMsl))
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

      const slotColor = bands.find((b) => b.tier === slotTier)?.color ?? activeTierColor;

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

  // =========================================================================
  // REDESIGNED LOCAL-PROXIMITY, UNCLUTTERED 3D DIGITAL TWIN
  // Uses ONLY activeArea + 3 nearest neighboring provinces (`nearbyTwinNodes`)
  // =========================================================================
  const renderTwinSceneContent = () => {
    const terrainTypeLabel = activeArea.isCoastal
      ? activeArea.seaBasin === "andaman"
        ? "⛵ ภูมิประเทศชายฝั่งและหมู่เกาะอันดามัน"
        : "🌊 ภูมิประเทศชายฝั่งและปากแม่น้ำอ่าวไทย"
      : activeArea.zoneType === "mountain"
        ? `⛰️ ภูมิประเทศหุบเขาและยอดดอยสูง (${activeArea.elevationM} ม.)`
        : "🏙️ ภูมิประเทศเขตเมืองและที่ราบลุ่ม";

    return (
      <div className="fahsai-twin-clean-wrapper">
        {/* Clean 3-Layer Visual Breakdown Strip (Replaces cluttered floating text inside 3D) */}
        <div className="fahsai-twin-layer-strip" aria-label="สรุป 3 ชั้นภูมิอากาศของพื้นที่ที่เลือก">
          <div className="fahsai-twin-layer-card">
            <span className="fahsai-tl-badge">☁️ ชั้นที่ 1 · เมฆและเรดาร์ฝนระดับบน</span>
            <strong>
              เรดาร์ {radarAndSchedule.dbz} dBZ · โอกาสฝน {activeHour.rainProb}%
            </strong>
            <small>
              เมฆปกคลุม {activeArea.current.cloudCoverPct}% · UV {activeArea.current.uvIndex} · ร้อนจริง{" "}
              {activeHour.feelsLikeC}°C
            </small>
          </div>

          <div className="fahsai-twin-layer-card">
            <span className="fahsai-tl-badge">🌬️ ชั้นที่ 2 · กระแสลมและโดมคุณภาพอากาศ</span>
            <strong>
              PM2.5 {activeHour.pm25} µg/m³ · ลม {activeHour.windKmh} กม./ชม.
            </strong>
            <small>
              ทิศทางลม{activeArea.current.windDirLabel} · ทัศนวิสัย {activeArea.current.visibilityKm} กม.
            </small>
          </div>

          <div className="fahsai-twin-layer-card">
            <span className="fahsai-tl-badge">🌍 ชั้นที่ 3 · {terrainTypeLabel}</span>
            <strong>
              {activeArea.isCoastal || activeArea.current.highTideMsl > 0
                ? `น้ำทะเล ${activeHour.tideMsl >= 0 ? "+" : ""}${activeHour.tideMsl} ม. รทก. · คลื่น ${activeArea.current.waveHeightM} ม.`
                : `เช้าต่ำสุด ${activeArea.current.minMorningC}°C · โอกาสหมอก ${activeArea.current.mistChancePct}%`}
            </strong>
            <small>
              จุดศูนย์กลาง: {activeArea.name} และพื้นที่ข้างเคียง {nearbyTwinNodes.length - 1} จังหวัด
            </small>
          </div>
        </div>

        {/* Clean 3D Stage showing ONLY activeArea + 3 nearest neighbors */}
        <FahSaiTwinScene
          camera={twinCamera}
          autoRotate={twinAutoRotate}
          onManualMove={() => setTwinAutoRotate(false)}
          hud={
            <div className="fs-3d-hud is-clean">
              <span>
                📍 ศูนย์กลาง Digital Twin: <b>{activeArea.name}</b> ({terrainTypeLabel})
              </span>
              <span>
                🧭 แสดงเฉพาะพื้นที่ใกล้เคียง ({nearbyTwinNodes.map((n) => n.area.name.split(" ")[0]).join(" · ")})
              </span>
              <span>
                🎯 {activeTopicMeta.label}:{" "}
                <b style={{ color: activeTierColor }}>
                  {pinMetricLabel(activeArea, topic)} (ระดับ {activeTier}/5)
                </b>
              </span>
            </div>
          }
        >
          <div className={`fs-3d-slab terrain-${activeArea.zoneType}`}>
            <div className="fs-3d-slab-grid" />

            {/* Terrain Archetype Layer adapted to activeArea */}
            {activeArea.zoneType === "mountain" && (
              <div className="fs-3d-mountain-zone is-focused">
                <span className="fs-3d-zone-label">
                  ⛰️ สันเขาและหุบเขา {activeArea.name} ({activeArea.elevationM} ม.) · หมอกเช้า {activeArea.current.mistChancePct}%
                </span>
              </div>
            )}

            <div className="fs-3d-land-zone">
              <span className="fs-3d-zone-label">
                📍 พื้นที่จังหวัด {activeArea.name} และจังหวัดข้างเคียงในรัศมีใกล้เคียง
              </span>
              {activeArea.zoneType !== "mountain" && (
                <div className="fs-3d-skyline">
                  <div className="fs-3d-bldg b1" />
                  <div className="fs-3d-bldg b2" />
                  <div className="fs-3d-bldg b3" />
                  <div className="fs-3d-bldg b4" />
                  <div className="fs-3d-bldg b5" />
                </div>
              )}
            </div>

            {(activeArea.isCoastal || activeArea.current.highTideMsl > 0) && (
              <div
                className="fs-3d-sea-zone"
                style={{
                  transform: `translateZ(${Math.max(4, Math.round((activeHour.tideMsl + 1.4) * 7))}px)`,
                }}
              >
                <div className="fs-3d-sea-wave w1" />
                <div className="fs-3d-sea-wave w2" />
                <span className="fs-3d-zone-label">
                  🌊 ชายฝั่ง {activeArea.name} · คลื่น {activeArea.current.waveHeightM} ม. · น้ำทะเล{" "}
                  {activeHour.tideMsl >= 0 ? "+" : ""}
                  {activeHour.tideMsl} ม. รทก.
                </span>
              </div>
            )}

            {/* Clean Atmospheric Dome */}
            <div
              className="fs-3d-inversion-dome"
              style={{
                opacity: topic === "air" ? 0.75 : 0.25,
                borderColor: activeArea.current.pm25 > 37.5 ? "#f97316" : "#10b981",
              }}
            />

            {/* ONLY THE SELECTED PROVINCE + ITS 3 NEAREST NEIGHBORS (Uncluttered, well-spaced!) */}
            {nearbyTwinNodes.map((node) => {
              const area = node.area;
              // Center node is at (50%, 52%); neighbors are placed cleanly around it
              const leftPct = 50 + node.relX * 34;
              const topPct = 52 + node.relZ * 32;
              const rTier = classifyAreaRisk(area, topic);
              const col = bands.find((b) => b.tier === rTier)?.color ?? "#0ea5e9";
              const isSel = node.isCenter;
              const metricText = pinMetricLabel(area, topic);
              const heightPx = isSel ? 98 : 44 + rTier * 8;

              return (
                <div
                  key={`twin-local-${area.id}`}
                  className={`fs-3d-area-anchor ${isSel ? "is-selected" : "is-neighbor"}`}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                  }}
                  onClick={() => setSelectedId(area.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(area.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`เลือกพื้นที่ใกล้เคียง 3 มิติ ${area.name}`}
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
                    <strong>
                      {isSel ? `🎯 ${THAILAND_LABEL_OFFSETS[area.id]?.shortName ?? area.name}` : THAILAND_LABEL_OFFSETS[area.id]?.shortName ?? area.name}
                    </strong>
                    <span>
                      {metricText} {!isSel ? `· ${node.distanceKm}กม.` : ""}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Minimal Upper Air Streamline */}
            <div className="fs-3d-upper-air">
              <div className="fs-3d-storm-cell">
                <div className="fs-3d-cloud-badge">
                  ☁️ เรดาร์ {radarAndSchedule.dbz} dBZ · ฝน {activeHour.rainProb}%
                </div>
                {activeHour.rainProb >= 25 && <div className="fs-3d-rain-shaft" />}
              </div>
              <div
                className="fs-3d-wind-ribbon"
                style={{
                  transform: `rotateZ(${activeArea.current.windDeg + 180}deg)`,
                }}
              >
                <span>
                  💨 ลม{activeArea.current.windDirLabel} {activeHour.windKmh} กม./ชม. ➔
                </span>
              </div>
            </div>
          </div>
        </FahSaiTwinScene>

        {/* Interactive Neighbor Switcher Cards under the 3D Scene */}
        <div className="fahsai-twin-neighbor-bar" role="group" aria-label="สลับจุดศูนย์กลาง Digital Twin ไปยังจังหวัดใกล้เคียง">
          {nearbyTwinNodes.map((node) => {
            const tier = classifyAreaRisk(node.area, topic);
            const col = bands.find((b) => b.tier === tier)?.color ?? activeTopicMeta.color;
            return (
              <button
                key={node.area.id}
                type="button"
                className={`fahsai-twin-neighbor-card ${node.isCenter ? "is-center" : ""}`}
                onClick={() => setSelectedId(node.area.id)}
              >
                <div className="fahsai-tnc-top">
                  <span className="fahsai-tnc-tag">
                    {node.isCenter ? "🎯 จังหวัดที่เลือก (ศูนย์กลาง)" : `🧭 ${node.compassLabel} · ห่าง ${node.distanceKm} กม.`}
                  </span>
                  <span className="fahsai-tnc-dot" style={{ background: col }} />
                </div>
                <strong>{node.area.name}</strong>
                <div className="fahsai-tnc-metric" style={{ color: col }}>
                  {activeTopicMeta.icon} {pinMetricLabel(node.area, topic)} · 🌡️ {node.area.current.tempC}°C
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`fs-app theme-${topic} ${dark ? "is-dark" : ""}`}>
      {/* Ambient Dynamic Weather Particle Background */}
      <div className="fs-ambient" aria-hidden="true">
        <div className="fs-orb fs-orb-1" />
        <div className="fs-orb fs-orb-2" />
        <div className="fs-orb fs-orb-3" />
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
              <span className="fs-nationwide-pill">🇹🇭 แผนที่ Basemap & ขอบเขตปกครองจริง 77 จังหวัด</span>
            </div>
            <small>
              Interactive Map Dashboard & Local-Proximity 3D Digital Twin สำหรับประชาชน · ออกแบบการนำเสนอและพื้นที่เฉพาะตามแต่ละเรื่อง
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
            onClick={() => setDark((d) => !d)}
            aria-label="สลับโหมดมืด/สว่าง"
          >
            {dark ? "☀️ โหมดสว่าง" : "🌙 โหมดมืด"}
          </button>
        </div>
      </header>

      <main className="fs-main">
        {/* SECTION 1: 10 VIBRANT STORY TOPIC CARDS */}
        <section className="fs-topic-deck-section" aria-label="เลือกเรื่องที่ต้องการสำรวจ">
          <div className="fs-deck-header">
            <div>
              <span className="fs-eyebrow">✨ เลือกการ์ดเรื่องที่คุณสนใจ (แต่ละเรื่องปรับพื้นที่และการนำเสนอเฉพาะตัวอัตโนมัติ)</span>
              <h2>คลิกเลือกเรื่องเพื่อปรับขอบเขตจังหวัดบนแผนที่จริง, การ์ดวิเคราะห์เฉพาะเรื่อง และ 3D Twin</h2>
            </div>
            <div className="fs-deck-live-tag">
              <span className="fs-live-dot" />
              <span>
                กำลังดู: <b>{activeArea.name}</b> ({scopeConfig.scopeBadge}) · เวลา <b>{nowClockText} น.</b>
              </span>
            </div>
          </div>

          <div className="fs-topic-card-grid" role="group" aria-label="การ์ดเลือกหมวดหมู่ฟ้าใส 10 เรื่อง">
            {TOPICS.map((t) => {
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
                      : ({ "--card-accent": t.color, "--card-bg-tint": t.accentLight } as CSSProperties)
                  }
                  onClick={() => handleSelectTopic(t.id)}
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
            {REGIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`fs-region-pill ${regionFilter === r.id ? "is-active" : ""}`}
                aria-pressed={regionFilter === r.id}
                onClick={() => {
                  setRegionFilter(r.id);
                  const scopedInRegion = getTopicRelevantAreas(payload.areas, topic, r.id);
                  if (scopedInRegion.length > 0 && r.id !== "all" && activeArea.regionId !== r.id) {
                    setSelectedId(scopedInRegion[0].id);
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
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาจังหวัด, เกาะ, ยอดดอย, ที่เที่ยว (เช่น เชียงใหม่, สมุย, ภูเก็ต, เขาใหญ่)..."
                aria-label="ค้นหาจังหวัดหรือสถานที่ท่องเที่ยวทั่วไทย"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} aria-label="ล้างคำค้นหา">
                  ✕
                </button>
              )}
            </div>

            <div className="fs-viewmode-pills" role="group" aria-label="สลับโหมดการแสดงผลแผนที่และ 3D">
              <button
                type="button"
                className={`fs-vm-btn ${mainViewMode === "2d" ? "is-active" : ""}`}
                aria-pressed={mainViewMode === "2d"}
                onClick={() => setMainViewMode("2d")}
              >
                🗺️ แผนที่จริง 2D
              </button>
              <button
                type="button"
                className={`fs-vm-btn ${mainViewMode === "3d" ? "is-active" : ""}`}
                aria-pressed={mainViewMode === "3d"}
                onClick={() => setMainViewMode("3d")}
              >
                🌐 3D Twin พื้นที่ใกล้เคียง
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

        {/* SECTION 3: MAIN INTERACTIVE WORKSPACE
            Left: Bespoke Topic Presentation Card
            Right: Real Basemap & Official Administrative Boundaries + Local-Proximity 3D Twin */}
        <section className="fs-hero-grid">
          {/* LEFT: BESPOKE TOPIC PRESENTATION */}
          <article className="fs-hero-card">
            <FahSaiTopicPresentation
              topic={topic}
              activeArea={activeArea}
              scopedAreas={topicScopedAreas}
              allAreas={payload.areas}
              onSelectArea={setSelectedId}
              onSelectTopic={handleSelectTopic}
              nowClockText={nowClockText}
              radarAndSchedule={radarAndSchedule}
            />
          </article>

          {/* RIGHT: REAL LEAFLET BASEMAP + REAL 77-PROVINCE / 50-DISTRICT BOUNDARIES */}
          <article className="fs-map-card">
            <div className="fs-map-head">
              <div>
                <span className="fs-eyebrow">
                  🛰️ แผนที่ Basemap จริง & ขอบเขตการปกครองจริง (DMR 77 จังหวัด / BMA 50 เขต)
                </span>
                <h2>
                  {activeTopicMeta.icon} {scopeConfig.scopeTitle}
                </h2>
              </div>
            </div>

            {mainViewMode === "3d" && (
              <div className="fs-map-embedded-3d">
                <div className="fs-3d-inline-header">
                  <span>
                    🌐 3D Digital Twin พื้นที่ใกล้เคียง: <b>{activeArea.name}</b> และจังหวัดข้างเคียง
                  </span>
                  <div className="fs-3d-btn-group" role="group" aria-label="เลือกมุมกล้อง 3 มิติ">
                    <button type="button" aria-pressed={twinCamera === "iso"} onClick={() => setTwinCamera("iso")}>
                      📐 มุมมองมาตรฐาน
                    </button>
                    <button type="button" aria-pressed={twinCamera === "atmosphere"} onClick={() => setTwinCamera("atmosphere")}>
                      ☁️ ซูมชั้นฟ้า
                    </button>
                    <button type="button" aria-pressed={twinCamera === "coastal"} onClick={() => setTwinCamera("coastal")}>
                      🌊 ซูมพื้นดิน/ทะเล
                    </button>
                    <button type="button" aria-pressed={twinCamera === "top"} onClick={() => setTwinCamera("top")}>
                      🦅 มุมสูง
                    </button>
                    <button type="button" aria-pressed={twinAutoRotate} onClick={() => setTwinAutoRotate((v) => !v)}>
                      {twinAutoRotate ? "⏸️ หยุด" : "🔄 หมุน"}
                    </button>
                  </div>
                </div>
                {renderTwinSceneContent()}
              </div>
            )}

            {(mainViewMode === "2d" || mainViewMode === "split") && (
              <div className={mainViewMode === "split" ? "fs-split-stage" : ""}>
                <FahSaiLeafletMap
                  areas={topicScopedAreas}
                  allAreas={payload.areas}
                  selectedArea={activeArea}
                  onSelectArea={setSelectedId}
                  activeTopic={topic}
                  activeRegion={regionFilter}
                  basemapMode={basemapMode}
                  onChangeBasemapMode={setBasemapMode}
                  showAllProvincesScope={showAllProvincesScope}
                  onToggleAllProvincesScope={() => setShowAllProvincesScope((v) => !v)}
                />

                {mainViewMode === "split" && (
                  <div className="fs-split-3d-pane">{renderTwinSceneContent()}</div>
                )}
              </div>
            )}
          </article>
        </section>

        {/* SECTION 4: LOCAL-PROXIMITY 3D ANIMATED DIGITAL TWIN SHOWCASE */}
        <section
          className="fs-3d-twin-section"
          id="fs-3d-twin"
          aria-label="แบบจำลอง 3D Digital Twin พื้นที่ใกล้เคียงจังหวัดที่เลือก"
        >
          <div className="fs-3d-twin-head">
            <div>
              <span className="fs-eyebrow">
                🌐 LOCAL-PROXIMITY 3D DIGITAL TWIN · แบบจำลอง 3 มิติเฉพาะจังหวัดที่เลือกและพื้นที่ใกล้เคียง
              </span>
              <h2>
                สำรวจภูมิประเทศและชั้นบรรยากาศ 3 มิติของ {activeArea.name} และจังหวัดข้างเคียง ({nearbyTwinNodes.length} พื้นที่)
              </h2>
              <p>
                ออกแบบใหม่ให้ดูง่าย ไม่รกตา โดยโฟกัสเฉพาะ <b>{activeArea.name}</b> เป็นจุดศูนย์กลาง พร้อมเปรียบเทียบกับจังหวัดใกล้เคียงตามทิศทางจริง และสรุปข้อมูลแยก 3 ชั้นชัดเจน
              </p>
            </div>
            <div className="fs-3d-controls">
              <div className="fs-3d-btn-group" role="group" aria-label="เลือกมุมกล้อง 3 มิติ">
                <button
                  type="button"
                  aria-pressed={twinCamera === "iso"}
                  onClick={() => setTwinCamera("iso")}
                >
                  📐 มุมมอง 3D มาตรฐาน
                </button>
                <button
                  type="button"
                  aria-pressed={twinCamera === "atmosphere"}
                  onClick={() => setTwinCamera("atmosphere")}
                >
                  ☁️ ซูมชั้นเมฆ–เรดาร์
                </button>
                <button
                  type="button"
                  aria-pressed={twinCamera === "coastal"}
                  onClick={() => setTwinCamera("coastal")}
                >
                  🌊 ซูมระดับพื้นดิน/น้ำทะเล
                </button>
                <button
                  type="button"
                  aria-pressed={twinCamera === "top"}
                  onClick={() => setTwinCamera("top")}
                >
                  🦅 มุมสูง Bird’s-Eye
                </button>
                <button
                  type="button"
                  aria-pressed={twinAutoRotate}
                  onClick={() => setTwinAutoRotate((v) => !v)}
                >
                  {twinAutoRotate ? "⏸️ หยุดหมุน 3D" : "🔄 หมุน 3D อัตโนมัติ"}
                </button>
              </div>
            </div>
          </div>

          {renderTwinSceneContent()}
        </section>

        {/* SECTION 5: INTERACTIVE 24-HOUR ANIMATED CURVE & SCRUBBER */}
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
            onChange={(e) => setHourIdx(Number(e.target.value))}
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

        {/* SECTION 6: ✨ พื้นที่เหมาะสมที่สุด vs ⚠️ พื้นที่เสี่ยงเฝ้าระวังทั่วไทย */}
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
                  onClick={() => handleSelectTopic("suitable")}
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
                    onKeyDown={(e) => {
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
                        {area.current.suitabilityTags.slice(0, 3).map((t) => (
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
                  onClick={() => handleSelectTopic("risk")}
                >
                  ดูแผนที่เสี่ยง →
                </button>
              </div>
              <div className="fs-rs-list">
                {topRiskAreas.map((area) => {
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
                      onKeyDown={(e) => {
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

        {/* SECTION 7: 🏖️ LIFESTYLE & DAILY ACTIVITY PLANNER CARDS */}
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
            ].map((item) => {
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

        {/* SECTION 8: VISUAL SCIENCE EXPLAINER FOR CITIZENS */}
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

        {/* SECTION 9: 7-DAY OUTLOOK & REGIONAL SUMMARY */}
        <section className="fs-bottom-grid">
          <article className="fs-daily-card">
            <span className="fs-eyebrow">📅 พยากรณ์ล่วงหน้า 7 วัน (7-Day Outlook)</span>
            <h3>แนวโน้มรายวัน & คะแนนน่าเที่ยว · {activeArea.name}</h3>
            <div className="fs-daily-list">
              {activeArea.daily.map((d) => (
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
          <span>🗺️ Basemap & ขอบเขตปกครองจริง</span>
          <span>🌐 3D Twin พื้นที่ใกล้เคียง</span>
          <span>🇹🇭 ครอบคลุมทั่วไทย</span>
        </div>
      </footer>
    </div>
  );
}
