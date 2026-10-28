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
  classifyDailyPointRisk,
  classifyHourlyPointRisk,
  getNearbyAreas,
  getScienceExplainer,
  getTopicRelevantAreas,
  getTopicRiskBands,
  getTopicScopeConfig,
  projectAreaAtDayHour,
  projectFahSaiGeo,
  TOPICS,
  type RiskBandInfo,
} from "./fahsai-helpers";
import "./fahsai.css";
import { FahSaiLeafletMap, type RealBasemapMode } from "./fahsai-leaflet-map";
import { FahSaiTopicPresentation } from "./fahsai-topic-presentation";

export {
  classifyAreaRisk,
  classifyDailyPointRisk,
  classifyHourlyPointRisk,
  getNearbyAreas,
  getTopicRelevantAreas,
  getTopicRiskBands,
  getTopicScopeConfig,
  projectAreaAtDayHour,
  projectFahSaiGeo,
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
  const [dark, setDark] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [locating, setLocating] = useState<boolean>(false);
  const [gpsStatus, setGpsStatus] = useState<string>("");
  const [nowClockText, setNowClockText] = useState<string>(() => getBangkokClockText());

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
  const activeTierColor = bands.find((b) => b.tier === activeTier)?.color ?? "#0284c7";
  const science = useMemo(() => getScienceExplainer(topic), [topic]);

  // Top Suitable vs Top Risk areas across all 77 provinces for the selected forecast day & time
  const topSuitableAreas = useMemo(
    () =>
      [...projectedAreas]
        .sort((a, b) => b.current.suitabilityScore - a.current.suitabilityScore)
        .slice(0, 6),
    [projectedAreas]
  );

  const topRiskAreas = useMemo(
    () =>
      [...projectedAreas]
        .sort(
          (a, b) =>
            b.current.multiHazardTier * 100 +
            b.current.rainProb +
            b.current.pm25 -
            (a.current.multiHazardTier * 100 + a.current.rainProb + a.current.pm25)
        )
        .slice(0, 6),
    [projectedAreas]
  );

  const getTopicQuickValue = (tId: TopicId): string => {
    const c = activeArea.current;
    if (tId === "rain") return `ฝน ${c.rainProb}% · ${c.rain24hMm} มม.`;
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

  // Build SVG path and per-hour severity colors for the 24-hour animated curve chart ("กราฟแยกสีความรุนแรง")
  const hourlyCurve = useMemo(() => {
    const tierCounts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const pts = activeArea.hourly.map((h, i) => {
      const sev = classifyHourlyPointRisk(activeArea, h, topic);
      tierCounts[sev.tier] = (tierCounts[sev.tier] ?? 0) + 1;
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
      return { x, y, val: Number(val.toFixed(2)), label: h.hourLabel, sev };
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

    // 5 horizontal background severity bands from top (y=24) to bottom (y=112)
    // Order bands from top to bottom (for winter, lower temp = higher tier at bottom; for others, higher value = higher tier at top)
    const orderedBands =
      topic === "winter" ? [...bands].reverse() : bands;
    const bandHeight = 88 / orderedBands.length;
    const zoneBands = orderedBands.map((b, idx) => ({
      tier: b.tier,
      color: b.color,
      label: b.label.split("·")[0]?.trim() ?? `ระดับ ${b.tier}`,
      yTop: 24 + idx * bandHeight,
      height: bandHeight,
    }));

    return { pts, linePath, areaPath, thresholdY, thresholdLabel, tierCounts, zoneBands };
  }, [activeArea, bands, topic]);

  // Build SVG path and per-day severity colors for the 7-Day Daily Forecast Curve & Bar Chart ("กราฟพยากรณ์รายวัน")
  const dailyCurve = useMemo(() => {
    const tierCounts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const pts = activeArea.daily.map((d, i) => {
      const sev = classifyDailyPointRisk(activeArea, d, topic);
      tierCounts[sev.tier] = (tierCounts[sev.tier] ?? 0) + 1;
      const highTideDay = Number(
        (activeArea.current.highTideMsl * (1 + Math.sin(i * 0.65) * 0.08)).toFixed(2)
      );
      const feelsMax = Number(
        (d.maxTempC + (activeArea.isCoastal ? 3.5 : 3.0)).toFixed(1)
      );
      const clearSkyPct = Math.max(12, 100 - Math.round(d.rainProb * 0.85));

      const val =
        topic === "rain"
          ? d.rainProb
          : topic === "sky"
            ? clearSkyPct
            : topic === "tide"
              ? highTideDay
              : topic === "wave"
                ? d.waveMaxM
                : topic === "air"
                  ? d.pm25Avg
                  : topic === "heat"
                    ? feelsMax
                    : topic === "winter"
                      ? d.minTempC
                      : topic === "tourism" || topic === "suitable"
                        ? d.tourismScore
                        : sev.tier * 20;

      const valLabel =
        topic === "rain"
          ? `${d.rainProb}%`
          : topic === "sky"
            ? `ฟ้าใส ${clearSkyPct}%`
            : topic === "tide"
              ? activeArea.isCoastal || highTideDay > 0
                ? `+${highTideDay}ม.`
                : "พื้นที่ดอน"
              : topic === "wave"
                ? activeArea.isCoastal
                  ? `${d.waveMaxM}ม.`
                  : "น้ำจืด"
                : topic === "air"
                  ? `${Math.round(d.pm25Avg)} µg`
                  : topic === "heat"
                    ? `${feelsMax}°C`
                    : topic === "winter"
                      ? `เช้า ${d.minTempC}°C`
                      : topic === "tourism" || topic === "suitable"
                        ? `${d.tourismScore}%`
                        : `ระดับ ${sev.tier}/5`;

      const subLabel =
        topic === "rain"
          ? `ฝนสะสม ${d.rainMm} มม.`
          : topic === "sky"
            ? `${d.minTempC}°–${d.maxTempC}°C`
            : topic === "tide"
              ? `ฝน ${d.rainProb}% · ${d.maxTempC}°C`
              : topic === "wave"
                ? `ฝน ${d.rainProb}% · UV ${d.uvMax}`
                : topic === "air"
                  ? `AQI ~${Math.round(d.pm25Avg * 2.55)}`
                  : topic === "heat"
                    ? `วัดจริง ${d.maxTempC}°C · UV ${d.uvMax}`
                    : topic === "winter"
                      ? `บ่าย ${d.maxTempC}°C · ฝน ${d.rainProb}%`
                      : `🌧️ ${d.rainProb}% · 🌡️ ${d.minTempC}°–${d.maxTempC}°C`;

      const norm =
        topic === "rain" || topic === "sky" || topic === "tourism" || topic === "suitable" || topic === "risk"
          ? Math.min(1, Math.max(0.06, val / 100))
          : topic === "air"
            ? Math.min(1, Math.max(0.08, val / 80))
            : topic === "heat" || topic === "winter"
              ? Math.min(1, Math.max(0.08, (val - 14) / 30))
              : topic === "wave"
                ? Math.min(1, Math.max(0.08, val / 2.5))
                : Math.min(1, Math.max(0.08, (val + 0.5) / 2.6));

      const x = 68 + (i / Math.max(1, activeArea.daily.length - 1)) * 624;
      const y = 112 - norm * 84;
      const barPct = Math.round(norm * 100);
      return {
        x,
        y,
        val: Number(val.toFixed(2)),
        valLabel,
        subLabel,
        barPct: Math.max(16, Math.min(100, barPct)),
        day: d,
        sev,
      };
    });

    const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},122 L${pts[0].x.toFixed(1)},122 Z`;
    return { pts, linePath, areaPath, tierCounts };
  }, [activeArea, topic]);

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

        {/* SECTION 2: NATIONWIDE REGION SELECTOR + SEARCH + EXPAND MAP CONTROL */}
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
        <section className={`fs-hero-grid is-map-dominant ${isMapExpandedWide ? "is-map-fullwidth" : ""}`}>
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
          <article className="fs-hero-card">
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

        {/* SECTION 4: INTERACTIVE 24-HOUR SEVERITY-COLORED CURVE & BAR CHART ("กราฟแยกสีความรุนแรง") */}
        <section className="fs-timeline-section" aria-labelledby="fs-hourly-title">
          <div className="fs-section-head">
            <div>
              <span className="fs-eyebrow">
                📈 กราฟแยกสีความรุนแรงรายชั่วโมง 24 ชม. ({activeArea.daily[dayIdx]?.dayLabel ?? "วันนี้"})
              </span>
              <h2 id="fs-hourly-title">
                เส้นแนวโน้มและกราฟแท่งแยกสีความรุนแรง 5 ระดับ · จ.{activeArea.name} ({activeTopicMeta.label})
              </h2>
            </div>
            <div className="fs-hour-readout">
              <span>
                วัน/เวลาที่เลือก:{" "}
                <strong>
                  {activeArea.daily[dayIdx]?.dayLabel ?? "วันนี้"} · {activeHour.hourLabel} น.
                </strong>
              </span>
              <b>
                🌡️ {activeHour.tempC}°C (ร้อนจริง {activeHour.feelsLikeC}°C) · 🌧️ ฝน{" "}
                {activeHour.rainProb}% · 😷 PM2.5 {activeHour.pm25} · 🌊 น้ำทะเล{" "}
                {activeHour.tideMsl >= 0 ? "+" : ""}
                {activeHour.tideMsl} ม.
              </b>
            </div>
          </div>

          {/* 5-LEVEL SEVERITY COLOR SUMMARY BAR */}
          <div className="fs-severity-legend-strip" role="group" aria-label="สรุปจำนวนชั่วโมงแยกตามสีระดับความรุนแรง">
            {bands.map((b) => {
              const count = hourlyCurve.tierCounts[b.tier] ?? 0;
              return (
                <div
                  key={b.tier}
                  className={`fs-sev-chip ${count > 0 ? "has-hours" : ""}`}
                  style={{ borderColor: `${b.color}66`, background: `${b.color}12` }}
                >
                  <span className="fs-sev-dot" style={{ background: b.color }} />
                  <div className="fs-sev-text">
                    <strong style={{ color: b.color }}>{b.label}</strong>
                    <small>
                      {b.rangeText} · <b>{count} ชม./วัน</b>
                    </small>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="fs-mobile-chart-hint">
            คลิกที่จุดชั่วโมงหรือแท่งกราฟสีความรุนแรงด้านล่าง เพื่อซิงค์เวลาพยากรณ์กับแผนที่ประเทศไทยทันที
          </p>
          <div className="fs-curve-svg-wrap">
            <svg
              viewBox="0 0 760 135"
              className="fs-curve-svg"
              role="img"
              aria-label={`กราฟเส้นโค้งแยกสีความรุนแรงรายชั่วโมง 24 ชั่วโมงของ ${activeArea.name}`}
            >
              <defs>
                <linearGradient id="fs-curve-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={activeTierColor} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={activeTierColor} stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* 5 Horizontal Severity Color Zone Backgrounds */}
              {hourlyCurve.zoneBands.map((z) => (
                <g key={z.tier}>
                  <rect
                    x="24"
                    y={z.yTop}
                    width="712"
                    height={z.height}
                    fill={z.color}
                    fillOpacity="0.09"
                  />
                  <line
                    x1="24"
                    y1={z.yTop}
                    x2="736"
                    y2={z.yTop}
                    stroke={z.color}
                    strokeOpacity="0.25"
                    strokeWidth="0.8"
                  />
                  <text
                    x="30"
                    y={z.yTop + 11}
                    fill={z.color}
                    fontSize="8.2"
                    fontWeight="800"
                    opacity="0.85"
                  >
                    {z.label}
                  </text>
                </g>
              ))}

              <line
                x1="24"
                y1={hourlyCurve.thresholdY}
                x2="736"
                y2={hourlyCurve.thresholdY}
                stroke="#f43f5e"
                strokeWidth="1.5"
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

              {/* Per-Hour Severity-Colored Vertical Stems & Line Segments */}
              {hourlyCurve.pts.map((p, idx) => {
                const nextP = hourlyCurve.pts[idx + 1];
                return (
                  <g key={`seg-${p.label}`}>
                    <line
                      x1={p.x}
                      y1={p.y}
                      x2={p.x}
                      y2={122}
                      stroke={p.sev.color}
                      strokeOpacity={idx === hourIdx ? "0.65" : "0.24"}
                      strokeWidth={idx === hourIdx ? "3" : "1.5"}
                    />
                    {nextP && (
                      <line
                        x1={p.x}
                        y1={p.y}
                        x2={nextP.x}
                        y2={nextP.y}
                        stroke={nextP.sev.color}
                        strokeWidth="3.4"
                        strokeLinecap="round"
                      />
                    )}
                  </g>
                );
              })}

              {hourlyCurve.pts.map((p, idx) => {
                const isSel = idx === hourIdx;
                return (
                  <g
                    key={p.label}
                    transform={`translate(${p.x}, ${p.y})`}
                    onClick={() => handleSelectHour(idx)}
                    style={{ cursor: "pointer" }}
                  >
                    {isSel && <circle r="10.5" fill={p.sev.color} opacity="0.28" />}
                    <circle
                      r={isSel ? 5.8 : 3.6}
                      fill={isSel ? "#ffffff" : p.sev.color}
                      stroke={p.sev.color}
                      strokeWidth={isSel ? "3.2" : "1.6"}
                    />
                    {(isSel || idx % 3 === 0) && (
                      <text
                        x="0"
                        y="-9"
                        textAnchor="middle"
                        fill={isSel ? p.sev.color : "#334155"}
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
            onChange={(e) => handleSelectHour(Number(e.target.value))}
            className="fs-time-slider"
            aria-label="เลื่อนเลือกชั่วโมงพยากรณ์"
          />

          <div className="fs-hourly-bars">
            {activeArea.hourly.map((h, idx) => {
              const selected = idx === hourIdx;
              const hSev = classifyHourlyPointRisk(activeArea, h, topic);
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
                  ? Math.max(10, h.rainProb)
                  : topic === "air"
                    ? Math.min(100, Math.max(12, (h.pm25 / 60) * 100))
                    : topic === "heat" || topic === "winter" || topic === "sky"
                      ? Math.min(100, Math.max(16, ((val - 14) / 28) * 100))
                      : topic === "wave"
                        ? Math.min(100, Math.max(14, (h.waveM / 2.2) * 100))
                        : Math.min(100, Math.max(14, ((h.tideMsl + 1.6) / 3.2) * 100));

              return (
                <button
                  key={h.hourLabel}
                  type="button"
                  className={`fs-hour-col ${selected ? "is-selected" : ""}`}
                  style={
                    selected
                      ? { borderColor: hSev.color, background: `${hSev.color}16` }
                      : undefined
                  }
                  onClick={() => handleSelectHour(idx)}
                  title={`${h.hourLabel} น. · ระดับ ${hSev.tier}/5 (${hSev.shortTag})`}
                >
                  <small className="fs-hour-val" style={{ color: hSev.color }}>
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
                    <i
                      style={{
                        height: `${heightPct}%`,
                        background: hSev.color,
                      }}
                    />
                  </div>
                  <span
                    className="fs-hour-sev-pill"
                    style={{ background: `${hSev.color}22`, color: hSev.color }}
                  >
                    Lv.{hSev.tier}
                  </span>
                  <span className="fs-hour-time">{h.hourLabel.slice(0, 2)}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* SECTION 4B: INTERACTIVE 7-DAY DAILY FORECAST SEVERITY CURVE & BAR CHART ("กราฟพยากรณ์รายวันด้วย") */}
        <section className="fs-timeline-section fs-daily-forecast-section" aria-labelledby="fs-daily-chart-title">
          <div className="fs-section-head">
            <div>
              <span className="fs-eyebrow">
                📅 กราฟพยากรณ์รายวัน 7 วัน แยกสีความรุนแรง (Interactive 7-Day Daily Forecast Graph)
              </span>
              <h2 id="fs-daily-chart-title">
                กราฟเส้นแนวโน้มและแท่งความรุนแรงรายวัน (7 วันล่วงหน้า) · จ.{activeArea.name} ({activeTopicMeta.label})
              </h2>
            </div>
            <div className="fs-hour-readout">
              <span>
                วันที่เลือกบนแผนที่:{" "}
                <strong>{activeArea.daily[dayIdx]?.dayLabel ?? "วันนี้"}</strong>
              </span>
              <b>
                🌧️ โอกาสฝน {activeArea.daily[dayIdx]?.rainProb ?? activeArea.current.rainProb}% (
                {activeArea.daily[dayIdx]?.rainMm ?? activeArea.current.rain24hMm} มม.) · 🌡️{" "}
                {activeArea.daily[dayIdx]?.minTempC ?? activeArea.current.minMorningC}°C –{" "}
                {activeArea.daily[dayIdx]?.maxTempC ?? activeArea.current.maxAfternoonC}°C · 😷 PM2.5 เฉลี่ย{" "}
                {activeArea.daily[dayIdx]?.pm25Avg ?? activeArea.current.pm25} µg/m³
              </b>
            </div>
          </div>

          {/* 5-LEVEL DAILY SEVERITY SUMMARY STRIP */}
          <div className="fs-severity-legend-strip" role="group" aria-label="สรุปจำนวนวันแยกตามสีระดับความรุนแรงใน 7 วัน">
            {bands.map((b) => {
              const count = dailyCurve.tierCounts[b.tier] ?? 0;
              return (
                <div
                  key={`daily-band-${b.tier}`}
                  className={`fs-sev-chip ${count > 0 ? "has-hours" : ""}`}
                  style={{ borderColor: `${b.color}66`, background: `${b.color}12` }}
                >
                  <span className="fs-sev-dot" style={{ background: b.color }} />
                  <div className="fs-sev-text">
                    <strong style={{ color: b.color }}>{b.label}</strong>
                    <small>
                      {b.rangeText} · <b>{count} วัน/สัปดาห์</b>
                    </small>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="fs-mobile-chart-hint">
            คลิกที่จุดวันหรือการ์ดแท่งรายวันด้านล่าง เพื่อเปลี่ยนวันพยากรณ์บนแผนที่ทั้ง 77 จังหวัดและกราฟรายชั่วโมงทันที
          </p>

          {/* 7-DAY DAILY SVG CURVE WITH 5 SEVERITY ZONES */}
          <div className="fs-curve-svg-wrap">
            <svg
              viewBox="0 0 760 148"
              className="fs-curve-svg"
              role="img"
              aria-label={`กราฟพยากรณ์รายวัน 7 วันแยกสีความรุนแรงของ ${activeArea.name}`}
            >
              <defs>
                <linearGradient id="fs-daily-curve-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={activeTierColor} stopOpacity="0.26" />
                  <stop offset="100%" stopColor={activeTierColor} stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* 5 Horizontal Severity Color Zone Backgrounds */}
              {hourlyCurve.zoneBands.map((z) => (
                <g key={`dzone-${z.tier}`}>
                  <rect
                    x="24"
                    y={z.yTop}
                    width="712"
                    height={z.height}
                    fill={z.color}
                    fillOpacity="0.09"
                  />
                  <line
                    x1="24"
                    y1={z.yTop}
                    x2="736"
                    y2={z.yTop}
                    stroke={z.color}
                    strokeOpacity="0.25"
                    strokeWidth="0.8"
                  />
                  <text
                    x="30"
                    y={z.yTop + 11}
                    fill={z.color}
                    fontSize="8.2"
                    fontWeight="800"
                    opacity="0.85"
                  >
                    {z.label}
                  </text>
                </g>
              ))}

              <line
                x1="24"
                y1={hourlyCurve.thresholdY}
                x2="736"
                y2={hourlyCurve.thresholdY}
                stroke="#f43f5e"
                strokeWidth="1.5"
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

              <path d={dailyCurve.areaPath} fill="url(#fs-daily-curve-fill)" />

              {/* Per-Day Severity-Colored Columns & Connecting Line Segments */}
              {dailyCurve.pts.map((p, idx) => {
                const nextP = dailyCurve.pts[idx + 1];
                const isSel = idx === dayIdx;
                return (
                  <g key={`dseg-${p.day.dayLabel}`}>
                    <rect
                      x={p.x - 16}
                      y={p.y}
                      width="32"
                      height={Math.max(4, 122 - p.y)}
                      rx="6"
                      fill={p.sev.color}
                      fillOpacity={isSel ? "0.38" : "0.18"}
                      stroke={p.sev.color}
                      strokeOpacity={isSel ? "0.85" : "0.35"}
                      strokeWidth={isSel ? "2" : "1"}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleSelectDay(idx)}
                    />
                    {nextP && (
                      <line
                        x1={p.x}
                        y1={p.y}
                        x2={nextP.x}
                        y2={nextP.y}
                        stroke={nextP.sev.color}
                        strokeWidth="3.8"
                        strokeLinecap="round"
                      />
                    )}
                  </g>
                );
              })}

              {/* Interactive Day Nodes & Labels */}
              {dailyCurve.pts.map((p, idx) => {
                const isSel = idx === dayIdx;
                return (
                  <g
                    key={`dpt-${p.day.dayLabel}`}
                    transform={`translate(${p.x}, ${p.y})`}
                    onClick={() => handleSelectDay(idx)}
                    style={{ cursor: "pointer" }}
                  >
                    {isSel && <circle r="12" fill={p.sev.color} opacity="0.28" />}
                    <circle
                      r={isSel ? 6.5 : 4.8}
                      fill={isSel ? "#ffffff" : p.sev.color}
                      stroke={p.sev.color}
                      strokeWidth={isSel ? "3.5" : "2"}
                    />
                    <text
                      x="0"
                      y="-11"
                      textAnchor="middle"
                      fill={p.sev.color}
                      fontSize={isSel ? "11" : "9.8"}
                      fontWeight="900"
                    >
                      {p.valLabel}
                    </text>
                    <text
                      x="0"
                      y={138 - p.y}
                      textAnchor="middle"
                      fill={isSel ? p.sev.color : "#334155"}
                      fontSize={isSel ? "11" : "10"}
                      fontWeight={isSel ? "900" : "700"}
                    >
                      {p.day.dayLabel} (Lv.{p.sev.tier})
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* 7-DAY INTERACTIVE SEVERITY BAR CARDS */}
          <div className="fs-daily-bars-grid" role="group" aria-label="การ์ดกราฟแท่งพยากรณ์รายวัน 7 วันแยกสีความรุนแรง">
            {dailyCurve.pts.map((p, idx) => {
              const isSel = idx === dayIdx;
              return (
                <button
                  key={`dbar-${p.day.dayLabel}`}
                  type="button"
                  className={`fs-daily-bar-card ${isSel ? "is-selected" : ""}`}
                  style={
                    isSel
                      ? { borderColor: p.sev.color, background: `${p.sev.color}15` }
                      : undefined
                  }
                  onClick={() => handleSelectDay(idx)}
                >
                  <div className="fs-dbc-head">
                    <strong>{p.day.dayLabel}</strong>
                    <span
                      className="fs-dbc-lv"
                      style={{ background: `${p.sev.color}22`, color: p.sev.color }}
                    >
                      Lv.{p.sev.tier}
                    </span>
                  </div>
                  <div className="fs-dbc-val" style={{ color: p.sev.color }}>
                    {p.valLabel}
                  </div>
                  <div className="fs-dbc-bar-track">
                    <i style={{ height: `${p.barPct}%`, background: p.sev.color }} />
                  </div>
                  <span className="fs-dbc-tag" style={{ color: p.sev.color }}>
                    {p.sev.shortTag}
                  </span>
                  <small className="fs-dbc-sub">{p.subLabel}</small>
                </button>
              );
            })}
          </div>
        </section>

        {/* SECTION 5: ✨ พื้นที่เหมาะสมที่สุด vs ⚠️ พื้นที่เสี่ยงเฝ้าระวังทั่วไทย */}
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

        {/* SECTION 6: 🏖️ LIFESTYLE & DAILY ACTIVITY PLANNER CARDS */}
        <section className="fs-lifestyle-section" aria-label="การ์ดวางแผนชีวิตประจำวันและกิจกรรมกลางแจ้งครบวงจร">
          <div className="fs-section-head">
            <div>
              <span className="fs-eyebrow">🌱 SMART LIFESTYLE & DAILY PLANNER · ตัวช่วยตัดสินใจในชีวิตประจำวันครบวงจร</span>
              <h2>คะแนนความเหมาะสมสำหรับกิจกรรมประจำวันใน จ.{activeArea.name}</h2>
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

        {/* SECTION 7: VISUAL SCIENCE EXPLAINER FOR CITIZENS */}
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

        {/* SECTION 8: 7-DAY SEVERITY-COLORED OUTLOOK & REGIONAL SUMMARY */}
        <section className="fs-bottom-grid">
          <article className="fs-daily-card">
            <span className="fs-eyebrow">📅 พยากรณ์ล่วงหน้า 7 วัน & กราฟแยกสีความรุนแรงรายวัน (คลิกเลือกวันเพื่อดูบนแผนที่)</span>
            <h3>แนวโน้มรายวัน & ระดับสีความรุนแรง · จ.{activeArea.name} ({activeTopicMeta.label})</h3>

            {/* 7-Day Severity Column Bar Chart */}
            <div className="fs-daily-severity-chart" role="group" aria-label="กราฟแท่งแยกสีความรุนแรงล่วงหน้า 7 วัน">
              {activeArea.daily.map((d, idx) => {
                const dSev = classifyDailyPointRisk(activeArea, d, topic);
                const isDaySel = idx === dayIdx;
                const barPct =
                  topic === "rain"
                    ? Math.max(16, d.rainProb)
                    : topic === "air"
                      ? Math.min(100, Math.max(18, (d.pm25Avg / 65) * 100))
                      : topic === "heat"
                        ? Math.min(100, Math.max(22, ((d.maxTempC - 22) / 18) * 100))
                        : topic === "winter"
                          ? Math.min(100, Math.max(22, ((30 - d.minTempC) / 16) * 100))
                          : topic === "wave"
                            ? Math.min(100, Math.max(18, (d.waveMaxM / 2.2) * 100))
                            : topic === "tourism" || topic === "suitable"
                              ? d.tourismScore
                              : dSev.tier * 20;
                return (
                  <button
                    key={`chart-${d.dayLabel}`}
                    type="button"
                    className={`fs-dsc-col ${isDaySel ? "is-active" : ""}`}
                    onClick={() => handleSelectDay(idx)}
                  >
                    <span className="fs-dsc-tier" style={{ color: dSev.color }}>
                      Lv.{dSev.tier}
                    </span>
                    <div className="fs-dsc-track">
                      <i style={{ height: `${barPct}%`, background: dSev.color }} />
                    </div>
                    <strong className="fs-dsc-day">{d.dayLabel}</strong>
                    <small className="fs-dsc-tag" style={{ color: dSev.color }}>
                      {dSev.shortTag}
                    </small>
                  </button>
                );
              })}
            </div>

            <div className="fs-daily-list">
              {activeArea.daily.map((d, idx) => {
                const dSev = classifyDailyPointRisk(activeArea, d, topic);
                const isDaySel = idx === dayIdx;
                return (
                  <button
                    key={d.dayLabel}
                    type="button"
                    className={`fs-daily-row ${isDaySel ? "is-selected" : ""}`}
                    style={
                      isDaySel
                        ? { borderColor: dSev.color, background: `${dSev.color}12` }
                        : undefined
                    }
                    onClick={() => handleSelectDay(idx)}
                  >
                    <div className="fs-daily-day-col">
                      <span className="fs-daily-sev-dot" style={{ background: dSev.color }} />
                      <strong>{d.dayLabel}</strong>
                    </div>
                    <span className="fs-daily-rain">
                      🌧️ {d.rainProb}% ({d.rainMm} มม.)
                    </span>
                    <span className="fs-daily-temp">
                      🍃 <b>{d.minTempC}°C</b> — ☀️ <b>{d.maxTempC}°C</b>
                    </span>
                    <span
                      className="fs-daily-sev-badge"
                      style={{ background: `${dSev.color}1f`, color: dSev.color }}
                    >
                      ระดับ {dSev.tier}/5 · {dSev.shortTag}
                    </span>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="fs-sea-summary-card">
            <span className="fs-eyebrow">🌊 สรุปน้ำทะเล คลื่นลม & ภูมิอากาศของพื้นที่</span>
            <h3>ข้อมูลสำคัญประจำวัน · จ.{activeArea.name} ({activeArea.regionName})</h3>
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
    </div>
  );
}
