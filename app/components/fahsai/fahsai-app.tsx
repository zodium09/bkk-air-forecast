"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

import {
  buildFallbackPayload,
  calculateDewPointC,
  calculateHeatIndexC,
  calculateMarshallPalmerDbz,
  calculateThaiAqiFromPm25,
  calculateUsAqiFromPm25,
  formatTmdRainText,
  getBangkokClockText,
  getBangkokHour,
  getTmdRainCoverageLabel,
  getTmdRainIntensityLabel,
  REGIONS,
  toTmdRainAreaPercent,
  type FahSaiPayload,
  type RegionId,
  type TopicId,
} from "../../lib/fahsai-data";
import {
  classifyAreaRisk,
  classifyDailyPointRisk,
  classifyHourlyPointRisk,
  getFriendlyAdvice,
  getNearbyAreas,
  getTopicRelevantAreas,
  getTopicRiskBands,
  getTopicScopeConfig,
  projectAreaAtDayHour,
  projectFahSaiGeo,
  TOPICS,
  type RiskBandInfo,
} from "./fahsai-helpers.ts";
import "./fahsai.css";
import { FahSaiInsightsSections } from "./fahsai-insights-sections.tsx";
import { FahSaiLeafletMap, type RealBasemapMode } from "./fahsai-leaflet-map.tsx";
import { FahSaiSeverityCharts } from "./fahsai-severity-charts.tsx";
import { FahSaiTopicPresentation } from "./fahsai-topic-presentation.tsx";

export {
  calculateDewPointC,
  calculateHeatIndexC,
  calculateMarshallPalmerDbz,
  calculateThaiAqiFromPm25,
  calculateUsAqiFromPm25,
  classifyAreaRisk,
  classifyDailyPointRisk,
  classifyHourlyPointRisk,
  formatTmdRainText,
  getNearbyAreas,
  getTmdRainCoverageLabel,
  getTmdRainIntensityLabel,
  getTopicRelevantAreas,
  getTopicRiskBands,
  getTopicScopeConfig,
  projectAreaAtDayHour,
  projectFahSaiGeo,
  toTmdRainAreaPercent,
  type RiskBandInfo,
};

export default function FahSaiApp() {
  const [payload, setPayload] = useState<FahSaiPayload>(() => buildFallbackPayload());
  const [topic, setTopic] = useState<TopicId>("rain");
  const [selectedId, setSelectedId] = useState<string>("bangkok");
  const [regionFilter, setRegionFilter] = useState<RegionId>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [basemapMode, setBasemapMode] = useState<RealBasemapMode>("street");
  // Default to true so all 77 provinces are shown clearly on the map!
  const [showAllProvincesScope, setShowAllProvincesScope] = useState<boolean>(true);
  const [isMapExpandedWide, setIsMapExpandedWide] = useState<boolean>(false);
  const [dayIdx, setDayIdx] = useState<number>(0);
  const [hourIdx, setHourIdx] = useState<number>(() => getBangkokHour());
  const [isLiveNow, setIsLiveNow] = useState<boolean>(true);
  const [isPlayingTime, setIsPlayingTime] = useState<boolean>(false);
  const [chartViewMode, setChartViewMode] = useState<"both" | "hourly" | "daily">("both");
  const [dark, setDark] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [locating, setLocating] = useState<boolean>(false);
  const [gpsStatus, setGpsStatus] = useState<string>("");
  const [shareCopied, setShareCopied] = useState<boolean>(false);
  const [urlHydrated, setUrlHydrated] = useState<boolean>(false);
  const [nowClockText, setNowClockText] = useState<string>(() => getBangkokClockText());

  const handleToggleDark = () => {
    setDark((prev) => {
      const next = !prev;
      if (typeof document !== "undefined") {
        document.documentElement.dataset.theme = next ? "dark" : "light";
      }
      try {
        window.localStorage.setItem("bkk-air-theme", next ? "dark" : "light");
      } catch {
        // Ignore storage errors
      }
      setBasemapMode((currMode) => (currMode === "satellite" ? "satellite" : next ? "dark" : "street"));
      return next;
    });
  };

  const handleCopyShareLink = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("topic", topic);
    url.searchParams.set("province", selectedId);
    if (regionFilter !== "all") url.searchParams.set("region", regionFilter);
    else url.searchParams.delete("region");
    if (dayIdx > 0) url.searchParams.set("day", String(dayIdx));
    else url.searchParams.delete("day");
    window.history.replaceState(null, "", url.toString());
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(url.toString());
    }
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 2400);
  };

  const handleSelectDay = (nextDayIdx: number) => {
    setDayIdx(nextDayIdx);
    setIsLiveNow(false);
  };

  const handleSelectHour = (nextHourIdx: number) => {
    setHourIdx(nextHourIdx);
    setIsLiveNow(false);
  };

  const handleResetLiveNow = () => {
    setIsPlayingTime(false);
    setDayIdx(0);
    setHourIdx(getBangkokHour());
    setIsLiveNow(true);
  };

  // Hydrate initial state from URL query params (?topic=&province=&region=&day=) and global theme
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const qTopic = params.get("topic") as TopicId | null;
    const qProvince = params.get("province");
    const qRegion = params.get("region") as RegionId | null;
    const qDay = params.get("day");

    const timer = window.setTimeout(() => {
      if (qTopic && TOPICS.some((t) => t.id === qTopic)) {
        setTopic(qTopic);
      }
      if (qProvince && payload.areas.some((a) => a.id === qProvince)) {
        setSelectedId(qProvince);
      }
      if (qRegion && REGIONS.some((r) => r.id === qRegion)) {
        setRegionFilter(qRegion);
      }
      if (qDay !== null) {
        const parsedDay = Number(qDay);
        if (Number.isInteger(parsedDay) && parsedDay >= 0 && parsedDay <= 6) {
          setDayIdx(parsedDay);
          if (parsedDay > 0) setIsLiveNow(false);
        }
      }

      let storedTheme: string | null = null;
      try {
        storedTheme = window.localStorage.getItem("bkk-air-theme");
      } catch {
        storedTheme = null;
      }
      const isDocDark =
        document.documentElement.dataset.theme === "dark" || storedTheme === "dark";
      if (isDocDark) {
        setDark(true);
        setBasemapMode((curr) => (curr === "satellite" ? "satellite" : "dark"));
      }
      setUrlHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [payload.areas]);

  // Keep URL query parameters synchronized with topic, province, region, and forecast day
  useEffect(() => {
    if (!urlHydrated || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("topic", topic);
    url.searchParams.set("province", selectedId);
    if (regionFilter !== "all") url.searchParams.set("region", regionFilter);
    else url.searchParams.delete("region");
    if (dayIdx > 0) url.searchParams.set("day", String(dayIdx));
    else url.searchParams.delete("day");
    window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
  }, [urlHydrated, topic, selectedId, regionFilter, dayIdx]);

  useEffect(() => {
    if (!isPlayingTime) return;
    const timer = window.setInterval(() => {
      setIsLiveNow(false);
      setHourIdx((prevH) => {
        if (prevH >= 23) {
          setDayIdx((prevD) => (prevD + 1) % 7);
          return 0;
        }
        return prevH + 1;
      });
    }, 950);
    return () => window.clearInterval(timer);
  }, [isPlayingTime]);

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

  // Project all 77 provinces to the selected Forecast Day (0..6) and Hour (0..23)
  const projectedAreas = useMemo(
    () => payload.areas.map((a) => projectAreaAtDayHour(a, dayIdx, hourIdx, isLiveNow)),
    [payload.areas, dayIdx, hourIdx, isLiveNow]
  );

  // Areas displayed on the map & province list (all 77 provinces by default, or filtered by region/topic/search)
  const topicScopedAreas = useMemo(() => {
    const baseList = showAllProvincesScope
      ? regionFilter === "all"
        ? projectedAreas
        : projectedAreas.filter((a) => a.regionId === regionFilter)
      : getTopicRelevantAreas(projectedAreas, topic, regionFilter);

    const q = searchQuery.trim().toLowerCase();
    if (!q) return baseList;
    const searched = projectedAreas.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.subtitle.toLowerCase().includes(q) ||
        a.regionName.toLowerCase().includes(q) ||
        a.tourismHighlights.some((h) => h.toLowerCase().includes(q))
    );
    return searched.length > 0 ? searched : baseList;
  }, [projectedAreas, topic, regionFilter, showAllProvincesScope, searchQuery]);

  // Switch topic handler: if selected province isn't in the topic's primary relevant areas, pick the #1 relevant province
  const handleSelectTopic = (nextTopic: TopicId) => {
    setTopic(nextTopic);
    const nextRelevant = getTopicRelevantAreas(projectedAreas, nextTopic, regionFilter);
    if (nextRelevant.length > 0 && !nextRelevant.some((a) => a.id === selectedId)) {
      setSelectedId(nextRelevant[0].id);
    }
  };

  const activeArea = useMemo(
    () =>
      projectedAreas.find((a) => a.id === selectedId) ??
      topicScopedAreas[0] ??
      projectedAreas[0],
    [projectedAreas, topicScopedAreas, selectedId]
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
          setGpsStatus(`📍 พบพื้นที่ใกล้คุณ: จ.${nearest.name}`);
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
  const activeBand = bands.find((b) => b.tier === activeTier) ?? bands[0];
  const activeTierColor = activeBand?.color ?? "#0284c7";
  const activeAdvice = useMemo(() => getFriendlyAdvice(activeArea, topic), [activeArea, topic]);

  const getTopicQuickValue = (tId: TopicId): string => {
    const c = activeArea.current;
    if (tId === "rain") {
      const tmdPct = toTmdRainAreaPercent(c.rainProb);
      const cov = c.tmdRainCoverageLabel ?? getTmdRainCoverageLabel(tmdPct);
      return `ฝน ${tmdPct}% ของพื้นที่ (${cov})`;
    }
    if (tId === "sky") return `ฟ้าโปร่ง ${100 - c.cloudCoverPct}% · ${c.tempC}°C`;
    if (tId === "tide")
      return activeArea.isCoastal || c.highTideMsl > 0
        ? `สูงสุด +${c.highTideMsl} ม. (${c.highTideTime})`
        : `พ้นเขตน้ำหนุน (สูง ${activeArea.elevationM} ม.)`;
    if (tId === "wave")
      return activeArea.isCoastal
        ? `คลื่น ${c.waveHeightM} ม. · ลม ${c.windKmh} กม./ชม.`
        : `ลมในแผ่นดิน ${c.windKmh} กม./ชม.`;
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
      const slotTmdPct = toTmdRainAreaPercent(maxRainProb);
      const slotTmdCov = getTmdRainCoverageLabel(slotTmdPct);

      return {
        windowText: isNowSlot
          ? `${title} (ณ เวลา ${nowClockText} น.)`
          : `${title} (${String(startH).padStart(2, "0")}:00–${String(endH).padStart(2, "0")}:00 น.)`,
        tag,
        tier: slotTier,
        color: slotColor,
        rainQty: `ฝน ${slotTmdPct}% ของพื้นที่ (${slotTmdCov}) · ปริมาณคาดการณ์ ${sumRainMm} มม.`,
        windRadarQty: `ลม${c.windDirLabel} ${maxWind} กม./ชม. · เรดาร์ ${dbz} dBZ`,
        otherQty: `🌡️ ร้อนจริง ${maxFeels}°C (ต่ำสุด ${minTemp}°C) · 😷 PM2.5 ${maxPm25} µg/m³ · 🌊 น้ำทะเล ${maxTide >= 0 ? "+" : ""}${maxTide} ม.`,
        adviceText:
          maxRainProb >= 55
            ? `ระวัง${slotTmdCov}สะสม ${sumRainMm} มม. เตรียมร่มและเลี่ยงจุดเสี่ยงน้ำขัง`
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

  return (
    <div className={`fs-app theme-${topic} ${dark ? "is-dark" : ""}`}>
      {/* Ambient Dynamic Weather Particle Background */}
      <div className="fs-ambient" aria-hidden="true">
        <div className="fs-orb fs-orb-1" />
        <div className="fs-orb fs-orb-2" />
        <div className="fs-orb fs-orb-3" />
      </div>

      {/* GLOBAL PLATFORM MODE SWITCHER BAR (Cross-App Navigation) */}
      <nav className="fs-global-mode-bar" aria-label="แถบสลับโหมดระบบพยากรณ์และเฝ้าระวังหลัก">
        <div className="fs-gmb-inner">
          <span className="fs-gmb-label">🌐 ระบบในเครือข่าย:</span>
          <div className="fs-gmb-links">
            <a href="/fahsai" className="fs-gmb-link is-current" aria-current="page">
              🌤️ ฟ้าใส ทั่วไทย (77 จังหวัด)
            </a>
            <a href={`/rain?province=${activeArea.id === "bangkok" ? "metro" : activeArea.id}`} className="fs-gmb-link">
              🌧️ เรดาร์และพยากรณ์ฝนเชิงลึก
            </a>
            <a href={`/air?province=${activeArea.id === "bangkok" ? "metro" : activeArea.id}`} className="fs-gmb-link">
              😷 คุณภาพอากาศ PM2.5 (CAMS)
            </a>
            <a href="/heat" className="fs-gmb-link">
              🌡️ ดัชนีความร้อน (Heat Index)
            </a>
            <a href="/water" className="fs-gmb-link">
              🌊 ระดับน้ำ &amp; น้ำทะเลหนุน
            </a>
            <a href="/explore" className="fs-gmb-link">
              🛰️ ติดตามเชิงลึก &amp; สถานีสนาม
            </a>
            <a href="/sources" className="fs-gmb-link">
              📚 แหล่งข้อมูลทางการ
            </a>
          </div>
        </div>
      </nav>

      {/* TOP NAVIGATION HEADER */}
      <header className="fs-header">
        <div className="fs-brand">
          <span className="fs-logo" aria-hidden="true">
            🌤️
          </span>
          <div>
            <div className="fs-brand-title-row">
              <strong>ฟ้าใส ทั่วไทย · FahSai Thailand</strong>
              <span className="fs-nationwide-pill">🇹🇭 แผนที่ Basemap & ข้อมูลครบทั้ง 77 จังหวัดจริง</span>
            </div>
            <small>
              Interactive Map Dashboard สำหรับประชาชน · ครอบคลุมข้อมูลและขอบเขตการปกครองจริงครบทั้ง 77 จังหวัดทั่วไทย
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
          <button
            type="button"
            className="fs-header-3d-pill"
            onClick={() => setIsMapExpandedWide((v) => !v)}
          >
            {isMapExpandedWide ? "🗗 มุมมองคู่" : "⛶ ขยายแผนที่ใหญ่เต็มจอ"}
          </button>
          <a href="#fs-risk-suitable" className="fs-header-rank-pill">
            ✨ พื้นที่เหมาะสม vs เสี่ยง
          </a>
          <button
            type="button"
            className="fs-share-btn"
            onClick={handleCopyShareLink}
            aria-label="คัดลอกลิงก์หน้าพยากรณ์จังหวัดและหมวดหมู่นี้"
          >
            {shareCopied ? "✅ คัดลอกลิงก์แล้ว!" : "🔗 แชร์ลิงก์จังหวัดนี้"}
          </button>
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
            onClick={handleToggleDark}
            aria-label="สลับโหมดมืด/สว่าง"
          >
            {dark ? "☀️ โหมดสว่าง" : "🌙 โหมดมืด"}
          </button>
        </div>
      </header>

      {/* DATA PROVENANCE & SCIENTIFIC STANDARDS BANNER */}
      <div className="fs-provenance-banner" role="status" aria-label="สถานะความสดของข้อมูลและมาตรฐานวิชาการ">
        <div className="fs-prov-main">
          <span
            className={`fs-prov-badge ${payload.status === "live" ? "is-live" : "is-fallback"}`}
          >
            {payload.status === "live"
              ? "🟢 ข้อมูลพยากรณ์สดออนไลน์ (Live Multi-Source API)"
              : "🟡 ข้อมูลจำลองตามฤดูกาลและภูมิศาสตร์ (Climatology Fallback Mode)"}
          </span>
          <span className="fs-prov-source">
            <strong>แหล่งที่มา:</strong> {payload.source} · อัปเดตเมื่อ <b>{payload.updatedAt} น.</b>
          </span>
        </div>
        <div className="fs-prov-standards">
          <span>🌧️ เกณฑ์ % ฝนของพื้นที่ (กรมอุตุนิยมวิทยา TMD)</span>
          <span>😷 US EPA &amp; Thai PCD Piecewise AQI</span>
          <span>🌡️ NOAA Rothfusz Heat Index</span>
          <span>🌊 Open-Meteo Marine &amp; ดาราศาสตร์น้ำขึ้น–น้ำลง</span>
        </div>
      </div>

      <main className="fs-main">
        {/* PRIORITY #1 ON MOBILE: INSTant ACTIVE PROVINCE AT-A-GLANCE STATUS CARD */}
        <section
          className="fs-mobile-glance-card"
          id="fs-top-glance"
          aria-label="สรุปสถานะจังหวัดที่เลือกอย่างรวดเร็ว"
          style={{ borderColor: `${activeTierColor}55` }}
        >
          <div className="fs-mgc-top">
            <div className="fs-mgc-loc">
              <span className="fs-mgc-live-badge">
                <i className="fs-live-dot" />
                {dayIdx === 0 && isLiveNow
                  ? `สดวันนี้ · ${nowClockText} น.`
                  : `${activeArea.daily[dayIdx]?.dayLabel ?? "วันนี้"} · ${activeHour.hourLabel} น.`}
              </span>
              <h1>
                📍 จ.{activeArea.name} <small>({activeArea.regionName})</small>
              </h1>
            </div>
            <span
              className="fs-mgc-tier-pill"
              style={{ background: activeTierColor, color: "#ffffff" }}
            >
              ระดับ {activeTier}/5 · {activeBand?.label ?? "ปกติ"}
            </span>
          </div>

          <div className="fs-mgc-hero-row">
            <div className="fs-mgc-primary-metric" style={{ color: activeTierColor }}>
              <span className="fs-mgc-topic-icon" aria-hidden="true">
                {activeTopicMeta.icon}
              </span>
              <div>
                <small>{activeTopicMeta.label}</small>
                <strong>{getTopicQuickValue(topic)}</strong>
              </div>
            </div>
            <p className="fs-mgc-advice">{activeAdvice.headline}</p>
          </div>

          <div className="fs-mgc-vitals-grid">
            <div className="fs-mgc-vital">
              <small>🌡️ อุณหภูมิ</small>
              <strong>{activeArea.current.tempC}°C</strong>
              <span>ร้อนจริง {activeArea.current.feelsLikeC}°C</span>
            </div>
            <div className="fs-mgc-vital">
              <small>🌧️ % ฝนของพื้นที่</small>
              <strong>{toTmdRainAreaPercent(activeArea.current.rainProb)}%</strong>
              <span>
                {activeArea.current.tmdRainCoverageLabel ?? getTmdRainCoverageLabel(toTmdRainAreaPercent(activeArea.current.rainProb))} ({activeArea.current.rain24hMm} มม.)
              </span>
            </div>
            <div className="fs-mgc-vital">
              <small>😷 ฝุ่น PM2.5</small>
              <strong>{activeArea.current.pm25} µg</strong>
              <span>AQI {activeArea.current.aqi}</span>
            </div>
            <div className="fs-mgc-vital">
              <small>{activeArea.isCoastal ? "🌊 คลื่นทะเล" : "☀️ ดัชนี UV"}</small>
              <strong>
                {activeArea.isCoastal
                  ? `${activeArea.current.waveHeightM} ม.`
                  : `UV ${activeArea.current.uvIndex}`}
              </strong>
              <span>ลม {activeArea.current.windKmh} กม./ชม.</span>
            </div>
          </div>

          <div className="fs-mgc-actions">
            <a href="#fs-map-workspace" className="fs-mgc-jump-btn is-primary">
              🗺️ ดูแผนที่ &amp; เลือกเวลา
            </a>
            <a href="#fs-charts-hub" className="fs-mgc-jump-btn">
              📈 กราฟ 24 ชม. / 7 วัน
            </a>
            <a href="#fs-bespoke-analysis" className="fs-mgc-jump-btn">
              📋 วิเคราะห์เจาะลึก
            </a>
          </div>
        </section>

        {/* SECTION 1: 10 VIBRANT STORY TOPIC CARDS */}
        <section
          className="fs-topic-deck-section"
          id="fs-topic-deck"
          aria-label="เลือกเรื่องที่ต้องการสำรวจ"
        >
          <div className="fs-deck-header">
            <div>
              <span className="fs-eyebrow">✨ เลือกการ์ดเรื่องที่คุณสนใจ (10 หมวดครบวงจร · ข้อมูลครบทั้ง 77 จังหวัดทั่วไทย)</span>
              <h2>คลิกเลือกเรื่องเพื่อดูแผนที่ประเทศไทยขนาดใหญ่พร้อมข้อมูลครบทุกจังหวัดและการวิเคราะห์เฉพาะเรื่อง</h2>
            </div>
            <div className="fs-deck-live-tag">
              <span className="fs-live-dot" />
              <span>
                กำลังดู: <b>จ.{activeArea.name}</b> ({activeArea.regionName}) · เวลา <b>{nowClockText} น.</b>
              </span>
            </div>
          </div>
          <p className="fs-mobile-swipe-hint" aria-hidden="true">
            👉 ปัดซ้าย–ขวาเพื่อเลือกเรื่องที่สนใจทั้ง 10 หมวดหมู่
          </p>

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

        {/* SECTION 2: NATIONWIDE REGION SELECTOR + SEARCH + QUICK 77-PROVINCE PICKER */}
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
                  const scopedInRegion =
                    r.id === "all"
                      ? payload.areas
                      : payload.areas.filter((a) => a.regionId === r.id);
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
            <label className="fs-province-picker-wrap">
              <span aria-hidden="true">📍</span>
              <select
                className="fs-province-quick-select"
                value={activeArea.id}
                aria-label="เลือกจังหวัดอย่างรวดเร็วครบทั้ง 77 จังหวัด"
                onChange={(e) => {
                  setSelectedId(e.target.value);
                }}
              >
                {REGIONS.filter((r) => r.id !== "all").map((reg) => (
                  <optgroup key={reg.id} label={`${reg.icon} ${reg.label}`}>
                    {projectedAreas
                      .filter((a) => a.regionId === reg.id)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          จ.{a.name} — {getTopicQuickValue(topic) && a.id === activeArea.id ? "กำลังเลือก" : `${a.current.tempC}°C · ฝน ${a.current.rainProb}%`}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <div className="fs-search-box">
              <span aria-hidden="true">🔍</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาได้ครบทั้ง 77 จังหวัด (เช่น เชียงใหม่, ลำปาง, ขอนแก่น, โคราช, กรุงเทพฯ, ชลบุรี, ภูเก็ต, สงขลา)..."
                aria-label="ค้นหาจังหวัดหรือสถานที่ท่องเที่ยวทั่วไทยครบ 77 จังหวัด"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} aria-label="ล้างคำค้นหา">
                  ✕
                </button>
              )}
            </div>

            <div className="fs-viewmode-pills" role="group" aria-label="ปรับขนาดแผนที่">
              <button
                type="button"
                className={`fs-vm-btn ${!isMapExpandedWide ? "is-active" : ""}`}
                aria-pressed={!isMapExpandedWide}
                onClick={() => setIsMapExpandedWide(false)}
              >
                🗺️ แผนที่ใหญ่ + การ์ดวิเคราะห์
              </button>
              <button
                type="button"
                className={`fs-vm-btn ${isMapExpandedWide ? "is-active" : ""}`}
                aria-pressed={isMapExpandedWide}
                onClick={() => setIsMapExpandedWide(true)}
              >
                ⛶ ขยายแผนที่เต็มจอ (77 จังหวัดชัดพิเศษ)
              </button>
            </div>
          </div>
          {gpsStatus && <p className="fs-gps-feedback">{gpsStatus}</p>}
        </section>

        {/* SECTION 3: MAIN INTERACTIVE WORKSPACE
            Expanded Map with all 77 Provinces + Bespoke Topic Presentation */}
        <section
          className={`fs-hero-grid is-map-dominant ${isMapExpandedWide ? "is-map-fullwidth" : ""}`}
          id="fs-map-workspace"
        >
          {/* LARGE HIGH-CLARITY 77-PROVINCE INTERACTIVE MAP */}
          <article className="fs-map-card is-primary-map">
            <div className="fs-map-head">
              <div>
                <span className="fs-eyebrow">
                  🛰️ แผนที่ประเทศไทยขนาดใหญ่ · ข้อมูลและขอบเขตการปกครองจริงครบทั้ง 77 จังหวัด (DMR / BMA)
                </span>
                <h2>
                  {activeTopicMeta.icon} {scopeConfig.scopeTitle} · กำลังเลือก: จ.{activeArea.name}
                </h2>
              </div>
            </div>

            <FahSaiLeafletMap
              areas={topicScopedAreas}
              allAreas={projectedAreas}
              selectedArea={activeArea}
              onSelectArea={setSelectedId}
              activeTopic={topic}
              activeRegion={regionFilter}
              basemapMode={basemapMode}
              onChangeBasemapMode={setBasemapMode}
              showAllProvincesScope={showAllProvincesScope}
              onToggleAllProvincesScope={() => setShowAllProvincesScope((v) => !v)}
              isExpandedWide={isMapExpandedWide}
              onToggleExpandedWide={() => setIsMapExpandedWide((v) => !v)}
              dayIdx={dayIdx}
              onChangeDayIdx={handleSelectDay}
              hourIdx={hourIdx}
              onChangeHourIdx={handleSelectHour}
              isLiveNow={isLiveNow}
              onResetLiveNow={handleResetLiveNow}
              isPlayingTime={isPlayingTime}
              onTogglePlayTime={() => setIsPlayingTime((v) => !v)}
            />
          </article>

          {/* BESPOKE TOPIC PRESENTATION CARD */}
          <article className="fs-hero-card" id="fs-bespoke-analysis">
            <FahSaiTopicPresentation
              topic={topic}
              activeArea={activeArea}
              scopedAreas={topicScopedAreas}
              allAreas={projectedAreas}
              onSelectArea={setSelectedId}
              onSelectTopic={handleSelectTopic}
              nowClockText={
                dayIdx === 0 && isLiveNow
                  ? nowClockText
                  : `${activeArea.daily[dayIdx]?.dayLabel ?? "วันนี้"} ${String(hourIdx).padStart(2, "0")}:00`
              }
              radarAndSchedule={radarAndSchedule}
            />
          </article>
        </section>

        <FahSaiSeverityCharts
          activeArea={activeArea}
          activeHour={activeHour}
          activeTopicMeta={activeTopicMeta}
          activeTierColor={activeTierColor}
          bands={bands}
          topic={topic}
          dayIdx={dayIdx}
          hourIdx={hourIdx}
          dark={dark}
          chartViewMode={chartViewMode}
          onChangeChartViewMode={setChartViewMode}
          onSelectHour={handleSelectHour}
          onSelectDay={handleSelectDay}
        />

        <FahSaiInsightsSections
          activeArea={activeArea}
          projectedAreas={projectedAreas}
          topic={topic}
          activeTopicMeta={activeTopicMeta}
          dayIdx={dayIdx}
          onSelectArea={setSelectedId}
          onSelectTopic={handleSelectTopic}
          onSelectDay={handleSelectDay}
        />
      </main>

      <footer className="fs-footer">
        <div>
          <strong>🌤️ ฟ้าใส ทั่วไทย · FahSai Thailand Interactive Map Dashboard</strong>
          <p>
            แพลตฟอร์มข้อมูลสภาพอากาศ ภูมิอากาศ น้ำทะเลหนุน คลื่นลม ฝุ่น PM2.5 ความร้อน ลมหนาว การท่องเที่ยว พื้นที่เสี่ยง และพื้นที่เหมาะสม สำหรับประชาชนทั่วไป ครอบคลุมข้อมูลและขอบเขตการปกครองจริงครบทั้ง 77 จังหวัดทั่วประเทศไทย
          </p>
        </div>
        <div className="fs-footer-badges">
          <span>🗺️ Basemap & ขอบเขตปกครองจริง 77 จังหวัด</span>
          <span>📊 ข้อมูลครบทุกจังหวัดทั่วไทย</span>
          <span>🇹🇭 ครอบคลุมทั้ง 6 ภูมิภาค</span>
        </div>
      </footer>

      {/* MOBILE STICKY BOTTOM THUMB NAVIGATION BAR */}
      <nav className="fs-mobile-bottom-nav" aria-label="เมนูนำทางด่วนบนมือถือ">
        <a href="#fs-top-glance" className="fs-mbn-item">
          <span aria-hidden="true">📍</span>
          <small>สรุปจังหวัด</small>
        </a>
        <a href="#fs-topic-deck" className="fs-mbn-item">
          <span aria-hidden="true">🎴</span>
          <small>10 เรื่อง</small>
        </a>
        <a href="#fs-map-workspace" className="fs-mbn-item is-center-map">
          <span aria-hidden="true">🗺️</span>
          <small>แผนที่ 77 จ.</small>
        </a>
        <a href="#fs-charts-hub" className="fs-mbn-item">
          <span aria-hidden="true">📈</span>
          <small>กราฟสี</small>
        </a>
        <a href="#fs-risk-suitable" className="fs-mbn-item">
          <span aria-hidden="true">✨</span>
          <small>จัดอันดับ</small>
        </a>
      </nav>
    </div>
  );
}
