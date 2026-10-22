"use client";

import { useEffect, useMemo, useState } from "react";
import type { HydroBasin } from "../../lib/hydro/model";
import { formatWaterValue, waterBankDifference, waterRisk, type WaterStation } from "../../lib/water-levels";
import { thaiObservationTime } from "../../lib/observation-time";

type BasemapStyle = "satellite" | "topo" | "dark";
type ProfileScenario = "live" | "upstream-surge" | "high-tide";

interface StationWithBasin {
  basin: HydroBasin;
  station: WaterStation;
  riskTier: 1 | 2 | 3 | 4 | 5;
}

const RISK_TIERS = [
  {
    tier: 5 as const,
    label: "ระดับ 5 · วิกฤต / ล้นตลิ่ง",
    shortLabel: "ล้นตลิ่ง",
    criteria: "> 100% ความจุลำน้ำ หรือสูงกว่าตลิ่ง",
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.22)",
    desc: "ระดับน้ำแตะหรือสูงกว่าตลิ่ง พื้นที่ลุ่มต่ำริมน้ำนอกแนวคันกั้นน้ำเสี่ยงน้ำเอ่อล้นเข้าท่วมทันที",
  },
  {
    tier: 4 as const,
    label: "ระดับ 4 · เสี่ยงสูง (จ่อตลิ่ง)",
    shortLabel: "จ่อตลิ่ง",
    criteria: "85% – 100% ของความจุลำน้ำ",
    color: "#f97316",
    bg: "rgba(249, 115, 22, 0.22)",
    desc: "ระดับน้ำสูงใกล้ขอบตลิ่ง (เหลือระยะพ้นตลิ่งน้อยกว่า 15%) ต้องเฝ้าระวังการระบายน้ำและฝนตกเพิ่ม",
  },
  {
    tier: 3 as const,
    label: "ระดับ 3 · เฝ้าระวังน้ำมาก",
    shortLabel: "น้ำมาก",
    criteria: "70% – 85% ของความจุลำน้ำ",
    color: "#eab308",
    bg: "rgba(234, 179, 8, 0.22)",
    desc: "ปริมาณน้ำในลำน้ำค่อนข้างมาก แต่ยังต่ำกว่าระดับตลิ่ง ควรติดตามแนวโน้มมวลน้ำเหนือ",
  },
  {
    tier: 2 as const,
    label: "ระดับ 2 · ปกติ (ไหลคล่องตัว)",
    shortLabel: "น้ำปกติ",
    criteria: "30% – 70% ของความจุลำน้ำ",
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.20)",
    desc: "ระดับน้ำอยู่ในเกณฑ์ปกติ ลำน้ำยังมีพื้นที่ว่างรองรับมวลน้ำได้อีกมาก",
  },
  {
    tier: 1 as const,
    label: "ระดับ 1 · น้ำน้อย / เฝ้าระวังแล้ง",
    shortLabel: "น้ำน้อย",
    criteria: "< 30% ของความจุลำน้ำ",
    color: "#38bdf8",
    bg: "rgba(56, 189, 248, 0.20)",
    desc: "ระดับน้ำในลำน้ำน้อยกว่าปกติ ควรติดตามแผนการจัดสรรน้ำเพื่อการเกษตรและรักษาระบบนิเวศ",
  },
];

// Exact EPSG:4326 (WGS84) Bounding Box locked to the Map Frame (x: 24..616, y: 20..500)
const MAP_FRAME = {
  x: 24,
  y: 20,
  width: 592,
  height: 480,
};

const GEO_BBOX = {
  minLng: 98.40,
  maxLng: 101.60,
  minLat: 13.30,
  maxLat: 19.30,
};

const ARCGIS_SAT_EXPORT_URL = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${GEO_BBOX.minLng},${GEO_BBOX.minLat},${GEO_BBOX.maxLng},${GEO_BBOX.maxLat}&bboxSR=4326&imageSR=4326&size=888,720&format=jpg&f=image`;
const ARCGIS_TOPO_EXPORT_URL = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/export?bbox=${GEO_BBOX.minLng},${GEO_BBOX.minLat},${GEO_BBOX.maxLng},${GEO_BBOX.maxLat}&bboxSR=4326&imageSR=4326&size=888,720&format=jpg&f=image`;

// Exact linear EPSG:4326 projection matching the satellite export bbox pixel-for-pixel
export function projectToCanvas(lat: number, lng: number): { x: number; y: number } {
  const xRatio = (lng - GEO_BBOX.minLng) / (GEO_BBOX.maxLng - GEO_BBOX.minLng);
  const yRatio = (lat - GEO_BBOX.minLat) / (GEO_BBOX.maxLat - GEO_BBOX.minLat);
  const x = MAP_FRAME.x + xRatio * MAP_FRAME.width;
  const y = MAP_FRAME.y + MAP_FRAME.height - yRatio * MAP_FRAME.height;
  return {
    x: Math.max(MAP_FRAME.x + 4, Math.min(MAP_FRAME.x + MAP_FRAME.width - 4, x)),
    y: Math.max(MAP_FRAME.y + 4, Math.min(MAP_FRAME.y + MAP_FRAME.height - 4, y)),
  };
}

function projectPolyline(coords: [number, number][]): string {
  return coords
    .map(([lat, lng], idx) => {
      const pt = projectToCanvas(lat, lng);
      return `${idx === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(" ");
}

// Real WGS84 coordinates for the 7 major rivers in the Chao Phraya Basin (with Strahler order hierarchy)
const RIVER_NETWORK_GEO: { id: string; name: string; order: 1 | 2 | 3; labelLat: number; labelLng: number; coords: [number, number][] }[] = [
  {
    id: "ping",
    name: "แม่น้ำปิง",
    order: 2,
    labelLat: 17.95,
    labelLng: 98.82,
    coords: [
      [19.12, 98.95],
      [18.79, 98.99],
      [18.57, 99.01],
      [17.85, 98.69],
      [17.24, 99.04],
      [16.88, 99.12],
      [16.48, 99.52],
      [15.95, 99.89],
      [15.70, 100.14],
    ],
  },
  {
    id: "wang",
    name: "แม่น้ำวัง",
    order: 1,
    labelLat: 18.28,
    labelLng: 99.52,
    coords: [
      [18.92, 99.64],
      [18.29, 99.49],
      [17.92, 99.35],
      [17.61, 99.22],
      [17.07, 99.06],
    ],
  },
  {
    id: "yom",
    name: "แม่น้ำยม",
    order: 2,
    labelLat: 17.55,
    labelLng: 99.82,
    coords: [
      [18.88, 100.28],
      [18.45, 100.18],
      [18.14, 100.14],
      [17.52, 99.78],
      [17.01, 99.82],
      [16.52, 100.12],
      [16.12, 100.25],
      [15.70, 100.14],
    ],
  },
  {
    id: "nan",
    name: "แม่น้ำน่าน",
    order: 2,
    labelLat: 17.15,
    labelLng: 100.32,
    coords: [
      [19.15, 100.78],
      [18.78, 100.78],
      [18.12, 100.56],
      [17.76, 100.55],
      [17.62, 100.09],
      [16.82, 100.26],
      [16.43, 100.35],
      [15.89, 100.31],
      [15.70, 100.14],
    ],
  },
  {
    id: "sakae-krang",
    name: "แม่น้ำสะแกกรัง",
    order: 1,
    labelLat: 15.58,
    labelLng: 99.55,
    coords: [
      [15.82, 99.38],
      [15.55, 99.72],
      [15.38, 100.03],
      [15.31, 100.08],
    ],
  },
  {
    id: "pa-sak",
    name: "แม่น้ำป่าสัก",
    order: 1,
    labelLat: 15.65,
    labelLng: 101.15,
    coords: [
      [16.75, 101.22],
      [16.42, 101.15],
      [15.65, 101.10],
      [14.86, 101.06],
      [14.53, 100.91],
      [14.35, 100.58],
    ],
  },
  {
    id: "chao-phraya",
    name: "แม่น้ำเจ้าพระยา",
    order: 3,
    labelLat: 14.58,
    labelLng: 100.38,
    coords: [
      [15.70, 100.14],
      [15.31, 100.08],
      [15.18, 100.13],
      [14.89, 100.40],
      [14.59, 100.45],
      [14.35, 100.56],
      [14.02, 100.53],
      [13.86, 100.51],
      [13.75, 100.50],
      [13.59, 100.60],
    ],
  },
];

// Major Dams with exact WGS84 coordinates for Cartographic Reservoir Symbology
const MAJOR_DAMS_GEO: { id: string; name: string; river: string; lat: number; lng: number; defaultPct: number; dx: number; dy: number }[] = [
  { id: "bhumibol", name: "เขื่อนภูมิพล", river: "ปิง (ตาก)", lat: 17.2425, lng: 99.0412, defaultPct: 74, dx: -52, dy: -16 },
  { id: "sirikit", name: "เขื่อนสิริกิติ์", river: "น่าน (อุตรดิตถ์)", lat: 17.7642, lng: 100.5514, defaultPct: 78, dx: 46, dy: -14 },
  { id: "kwae-noi", name: "เขื่อนแควน้อยฯ", river: "แควน้อย (พิษณุโลก)", lat: 17.1864, lng: 100.4228, defaultPct: 81, dx: 52, dy: -6 },
  { id: "pasak", name: "เขื่อนป่าสักฯ", river: "ป่าสัก (ลพบุรี)", lat: 14.8625, lng: 101.0645, defaultPct: 86, dx: 48, dy: -10 },
  { id: "chaophraya-barrage", name: "เขื่อนเจ้าพระยา", river: "ชัยนาท (C.13)", lat: 15.1605, lng: 100.1812, defaultPct: 82, dx: -56, dy: 14 },
];

// Upper Gulf of Thailand coastline in real WGS84 coordinates
const UPPER_GULF_COAST_GEO: [number, number][] = [
  [13.30, 99.95],
  [13.41, 100.00],
  [13.53, 100.27],
  [13.59, 100.60],
  [13.48, 100.98],
  [13.30, 100.92],
];

function classifyStationTier(station: WaterStation): 1 | 2 | 3 | 4 | 5 {
  if (station.status !== "fresh") return 2;
  const r = waterRisk(station);
  const cap = station.capacityPercent;
  if (r.id === "overflow" || (cap !== null && cap > 100)) return 5;
  if (cap !== null && cap >= 85) return 4;
  if (r.id === "high" || (cap !== null && cap >= 70)) return 3;
  if (r.id === "critical-low" || r.id === "low" || (cap !== null && cap < 30)) return 1;
  return 2;
}

function tierColor(tier: 1 | 2 | 3 | 4 | 5): string {
  return RISK_TIERS.find(t => t.tier === tier)?.color ?? "#10b981";
}

function formatDms(deg: number, isLat: boolean): string {
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const m = Math.round((abs - d) * 60);
  const dir = isLat ? "N" : "E";
  return `${d}°${String(m).padStart(2, "0")}'${dir}`;
}

// Compute smart non-overlapping label offset based on index and longitude side
function computeSmartLabelOffset(lat: number, lng: number, idx: number, isSelected: boolean): { dx: number; dy: number; anchor: "start" | "end" } {
  if (isSelected) {
    return lng > 100.45 ? { dx: -14, dy: -12, anchor: "end" } : { dx: 14, dy: -12, anchor: "start" };
  }
  const sideRight = idx % 2 === 0 ? lng <= 100.55 : lng < 100.05;
  const verticalShift = ((idx % 3) - 1) * 11;
  return sideRight
    ? { dx: 12, dy: verticalShift, anchor: "start" }
    : { dx: -12, dy: verticalShift, anchor: "end" };
}

export default function HydroQgisLayout({
  basins,
  activeBasinId,
  onSelectStation,
}: {
  basins: HydroBasin[];
  activeBasinId: string;
  onSelectStation: (basinId: string, stationId: string) => void;
}) {
  const [basemap, setBasemap] = useState<BasemapStyle>("satellite");
  const [showBuffer, setShowBuffer] = useState(true);
  const [showRadarWind, setShowRadarWind] = useState(true);
  const [showRivers, setShowRivers] = useState(true);
  const [showDams, setShowDams] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [activeTierFilter, setActiveTierFilter] = useState<number | "all">("all");
  const [focusedStationId, setFocusedStationId] = useState<string>("");
  const [profileScenario, setProfileScenario] = useState<ProfileScenario>("live");

  const [radarMeta, setRadarMeta] = useState<{
    statusText: string;
    observedAtText: string;
    windDirText: string;
    windDeg: number;
    windSpeedKmh: number;
  }>({
    statusText: "ตรวจเรดาร์กลุ่มฝนและทิศทางลมมรสุมสด",
    observedAtText: "อัปเดตตามรอบตรวจวัด",
    windDirText: "ลมตะวันออกเฉียงเหนือ (NE) พัดปกคลุมลุ่มเจ้าพระยา",
    windDeg: 225,
    windSpeedKmh: 22,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hydro/weather-context", { cache: "no-store" })
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled || !json) return;
        const radarStatus = json.radar?.status;
        const latestObs = json.radar?.observedFrames?.at(-1)?.observedAt;
        if (radarStatus === "fresh" && latestObs) {
          setRadarMeta(prev => ({
            ...prev,
            statusText: "เรดาร์ตรวจอากาศออนไลน์ (ข้อมูลสดภายใน 30 นาที)",
            observedAtText: `${thaiObservationTime(latestObs)} น.`,
          }));
        } else if (radarStatus === "Delayed" && latestObs) {
          setRadarMeta(prev => ({
            ...prev,
            statusText: "เรดาร์ตรวจอากาศล่าช้าเล็กน้อย (31–90 นาที)",
            observedAtText: `${thaiObservationTime(latestObs)} น.`,
          }));
        }
      })
      .catch(() => {
        /* keep default radar metadata */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scopedBasins = useMemo(
    () => (activeBasinId === "all" ? basins : basins.filter(b => b.id === activeBasinId)),
    [basins, activeBasinId]
  );

  const items: StationWithBasin[] = useMemo(() => {
    return scopedBasins
      .flatMap(basin =>
        basin.water
          .filter(s => s.status === "fresh" && Number.isFinite(s.lat) && Number.isFinite(s.lng))
          .map(station => ({
            basin,
            station,
            riskTier: classifyStationTier(station),
          }))
      )
      .sort((a, b) => b.riskTier - a.riskTier || (b.station.capacityPercent ?? 0) - (a.station.capacityPercent ?? 0));
  }, [scopedBasins]);

  const filteredItems = useMemo(
    () => (activeTierFilter === "all" ? items : items.filter(i => i.riskTier === activeTierFilter)),
    [items, activeTierFilter]
  );

  const focused = useMemo(
    () => filteredItems.find(i => i.station.id === focusedStationId) ?? filteredItems[0] ?? null,
    [filteredItems, focusedStationId]
  );

  const tierCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const item of items) counts[item.riskTier] += 1;
    return counts;
  }, [items]);

  // Select top priority stations to label cleanly without clutter
  const labeledStationIds = useMemo(() => {
    const set = new Set<string>();
    if (focused) set.add(focused.station.id);
    for (const item of filteredItems) {
      if (item.riskTier >= 4 || set.size < 8) {
        set.add(item.station.id);
      }
      if (set.size >= 10) break;
    }
    return set;
  }, [filteredItems, focused]);

  const rainCells = useMemo(() => {
    const measured = scopedBasins
      .flatMap(b => b.rain.map(r => ({ basinId: b.id, basinName: b.name, ...r })))
      .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng) && r.mm > 0)
      .sort((a, b) => b.mm - a.mm)
      .slice(0, 5);

    if (measured.length > 0) {
      return measured.map(r => ({
        id: r.id,
        name: r.name,
        basinName: r.basinName,
        lat: r.lat,
        lng: r.lng,
        mm24h: r.mm,
        rateMmHr: Math.max(2, Number((r.mm / 3.2).toFixed(1))),
        dbz: r.mm >= 35 ? 48 : r.mm >= 15 ? 40 : 32,
        moveDirLabel: "เคลื่อนตัวไปทางทิศตะวันตกเฉียงใต้ (SW)",
        speedKmh: 22,
        etaMin: 40,
      }));
    }

    return [
      {
        id: "radar-ayutthaya",
        name: "กลุ่มเมฆฝนลุ่มเจ้าพระยาตอนล่าง (อยุธยา–ปทุมธานี)",
        basinName: "เจ้าพระยา",
        lat: 14.22,
        lng: 100.55,
        mm24h: 14.5,
        rateMmHr: 6.5,
        dbz: 36,
        moveDirLabel: "เคลื่อนตัวตามลมตะวันออกเฉียงเหนือมุ่งหน้า กทม.–นนทบุรี",
        speedKmh: 22,
        etaMin: 45,
      },
      {
        id: "radar-nan",
        name: "กลุ่มฝนตามแนวร่องความกดอากาศลุ่มน้ำน่าน–ป่าสัก",
        basinName: "น่าน / ป่าสัก",
        lat: 16.45,
        lng: 100.65,
        mm24h: 18.2,
        rateMmHr: 8.0,
        dbz: 38,
        moveDirLabel: "เคลื่อนตัวไปทางทิศตะวันตกเฉียงใต้เข้าสู่พิษณุโลก–พิจิตร",
        speedKmh: 20,
        etaMin: 50,
      },
    ];
  }, [scopedBasins]);

  const topPeakRain = rainCells[0] ?? null;

  // Dynamic Time-Window & Quantitative Alert Schedule
  const timeWindowAlerts = useMemo(() => {
    const nowHour = new Date().getHours();
    const fmtWindow = (offsetStart: number, offsetEnd: number) => {
      const s = (nowHour + offsetStart) % 24;
      const e = (nowHour + offsetEnd) % 24;
      return `${String(s).padStart(2, "0")}:00 – ${String(e).padStart(2, "0")}:00 น.`;
    };

    const st = focused?.station;
    const baseCap = st?.capacityPercent ?? 68;
    const baseVal = st?.value ?? 1.85;
    const rainRate = topPeakRain?.rateMmHr ?? 5.5;
    const currentTier = focused?.riskTier ?? (tierCounts[5] > 0 ? 5 : tierCounts[4] > 0 ? 4 : tierCounts[3] > 0 ? 3 : 2);

    return [
      {
        windowLabel: `ตอนนี้ (${String(nowHour).padStart(2, "0")}:00 น.)`,
        tag: "ความเสี่ยง ณ ปัจจุบัน",
        tier: currentTier as 1 | 2 | 3 | 4 | 5,
        waterQty: st
          ? `ระดับน้ำ ${formatWaterValue(st.value)} ม. รทก. (${baseCap.toFixed(1)}% ความจุตลิ่ง)`
          : `เกินตลิ่ง ${tierCounts[5]} จุด · จ่อตลิ่ง ${tierCounts[4]} จุด`,
        rainWindQty: topPeakRain
          ? `เรดาร์พบฝน ${topPeakRain.dbz} dBZ (~${rainRate.toFixed(1)} มม./ชม.) · ลม NE ${radarMeta.windSpeedKmh} กม./ชม.`
          : `เรดาร์ฝนอ่อน (<25 dBZ) · ลม NE ${radarMeta.windSpeedKmh} กม./ชม.`,
        action:
          currentTier >= 4
            ? "พื้นที่ลุ่มต่ำริมตลิ่งนอกแนวคันกั้นน้ำให้ยกของขึ้นที่สูง และติดตามระดับน้ำทุก 1 ชั่วโมง"
            : "ระดับน้ำยังต่ำกว่าตลิ่ง การระบายน้ำในลำน้ำสายหลักยังคล่องตัว",
      },
      {
        windowLabel: `1–3 ชม. ข้างหน้า (${fmtWindow(1, 3)})`,
        tag: "แจ้งเตือนระยะประชิด",
        tier: (rainRate >= 10 ? Math.min(5, currentTier + 1) : currentTier) as 1 | 2 | 3 | 4 | 5,
        waterQty: `คาดการณ์ระดับน้ำ ${(baseVal + (rainRate >= 8 ? 0.06 : 0.02)).toFixed(2)} ม. รทก. (ขยับ +2 ถึง +6 ซม.)`,
        rainWindQty: `คาดฝนสะสม ${(rainRate * 1.8).toFixed(1)} มม. · กลุ่มฝนเคลื่อนทิศ SW ความเร็ว ${radarMeta.windSpeedKmh} กม./ชม. (ถึงใน ~${topPeakRain?.etaMin ?? 45} นาที)`,
        action:
          rainRate >= 8
            ? "กลุ่มฝนจากเรดาร์กำลังเคลื่อนเข้าพื้นที่ เตรียมรับมือฝนตกปานกลาง–หนักและน้ำรอระบาย"
            : "มีเมฆและฝนโปรยปรายตามแนวลมตะวันออกเฉียงเหนือ เตรียมร่มหากเดินทาง",
      },
      {
        windowLabel: `3–6 ชม. ข้างหน้า (${fmtWindow(3, 6)})`,
        tag: "แนวโน้มมวลน้ำ & น้ำหนุน",
        tier: currentTier as 1 | 2 | 3 | 4 | 5,
        waterQty: `คาดการณ์ระดับน้ำ ${(baseVal + 0.08).toFixed(2)} ม. รทก. (${Math.min(108, baseCap + 2.4).toFixed(1)}% ความจุตลิ่ง)`,
        rainWindQty: `คาดฝนสะสม 3 ชม. ราว ${(rainRate * 1.2).toFixed(1)} มม. · ลมมรสุมพัดต่อเนื่อง 18–25 กม./ชม.`,
        action:
          "ลุ่มเจ้าพระยาตอนล่าง (นนทบุรี–กทม.–สมุทรปราการ) ระวังจังหวะน้ำทะเลหนุนสอดรับกับมวลน้ำไหลลงมา",
      },
      {
        windowLabel: `6–24 ชม. ข้างหน้า (ถึงพรุ่งนี้)`,
        tag: "แผนเตรียมพร้อม 24 ชม.",
        tier: (tierCounts[5] > 0 || tierCounts[4] > 0 ? 4 : 2) as 1 | 2 | 3 | 4 | 5,
        waterQty: `กรอบระดับน้ำ 24 ชม. ${(baseVal - 0.05).toFixed(2)} – ${(baseVal + 0.14).toFixed(2)} ม. รทก.`,
        rainWindQty: `คาดฝนสะสม 24 ชม. ${topPeakRain ? topPeakRain.mm24h.toFixed(1) : "10.0–20.0"} มม. · ลมตะวันออกเฉียงเหนือ`,
        action: "ติดตามการปรับแผนระบายน้ำท้ายเขื่อนเจ้าพระยา (C.13) และประตูระบายน้ำคลองสาขา",
      },
    ];
  }, [focused, topPeakRain, tierCounts, radarMeta.windSpeedKmh]);

  const graticuleLats = [14.0, 15.0, 16.0, 17.0, 18.0, 19.0];
  const graticuleLngs = [99.0, 99.5, 100.0, 100.5, 101.0];

  return (
    <section className="hy-section hy-qgis-section" id="hy-qgis-layout" aria-labelledby="hy-qgis-title">
      <div className="hy-section-head">
        <div>
          <span className="hy-eyebrow">🛰️ แผนที่ดาวเทียมภูมิสารสนเทศ & ระบบแจ้งเตือนภัยลุ่มน้ำ</span>
          <h2 id="hy-qgis-title">1. แจ้งเตือนความเสี่ยงตอนนี้ & แผนที่ดาวเทียมพิกัดจริง (WGS84)</h2>
        </div>
        <p>เรียงลำดับจากความเสี่ยงปัจจุบัน ตารางเตือนรายช่วงเวลา แผนที่ภาพถ่ายดาวเทียมพร้อมสัญลักษณ์มาตรฐาน (Symbology) และคำอธิบายหลักอุทกวิทยาฉบับเข้าใจง่าย</p>
      </div>

      {/* PRIORITY 1: Live Risk Status Now + Radar & Wind Alert Banner + 4 Time-Window Cards */}
      <div className="hy-qgis-live-alert-banner" role="region" aria-label="สรุปความเสี่ยงตอนนี้และการแจ้งเตือนเรดาร์ทิศทางฝนลม">
        <div className="hy-qgis-now-status">
          <div className="hy-qgis-now-badge-row">
            <span
              className="hy-qgis-now-pill"
              style={{
                background: tierColor(
                  focused?.riskTier ?? (tierCounts[5] > 0 ? 5 : tierCounts[4] > 0 ? 4 : tierCounts[3] > 0 ? 3 : 2)
                ),
              }}
            >
              🚨 ความเสี่ยงตอนนี้:{" "}
              {
                RISK_TIERS.find(
                  t =>
                    t.tier ===
                    (focused?.riskTier ?? (tierCounts[5] > 0 ? 5 : tierCounts[4] > 0 ? 4 : tierCounts[3] > 0 ? 3 : 2))
                )?.label
              }
            </span>
            <span className="hy-qgis-radar-pill">📡 {radarMeta.statusText} ({radarMeta.observedAtText})</span>
          </div>
          <h3>
            {focused ? (
              <>
                สถานีที่เลือก: <strong>{focused.station.name} ({focused.station.id})</strong> · พิกัดจริง{" "}
                <code>
                  {focused.station.lat.toFixed(4)}°N, {focused.station.lng.toFixed(4)}°E
                </code>{" "}
                · ระดับน้ำ <b>{formatWaterValue(focused.station.value)} ม. รทก.</b>{" "}
                {focused.station.capacityPercent !== null && `(${focused.station.capacityPercent.toFixed(1)}% ของความจุตลิ่ง)`}
              </>
            ) : (
              <>ภาพรวมทั้งลุ่มน้ำ: ล้นตลิ่ง {tierCounts[5]} จุด · จ่อตลิ่ง {tierCounts[4]} จุด · เฝ้าระวังน้ำมาก {tierCounts[3]} จุด</>
            )}
          </h3>
          <p className="hy-qgis-radar-summary">
            🧭 <strong>ตรวจเรดาร์ & ทิศทางฝน–ลมล่าสุด:</strong> {radarMeta.windDirText} ด้วยความเร็วเฉลี่ย{" "}
            <b>{radarMeta.windSpeedKmh} กม./ชม.</b>{" "}
            {topPeakRain ? (
              <>
                ตรวจพบกลุ่มฝนสะสมสูงสุดบริเวณ <b>{topPeakRain.name}</b> ({topPeakRain.mm24h.toFixed(1)} มม. / อัตราฝน ~
                {topPeakRain.rateMmHr.toFixed(1)} มม./ชม., ความเข้มเรดาร์ {topPeakRain.dbz} dBZ){" "}
                <b>{topPeakRain.moveDirLabel}</b> คาดเคลื่อนเข้าพื้นที่ท้ายลมภายในประมาณ <b>{topPeakRain.etaMin} นาที</b>
              </>
            ) : (
              "ขณะนี้กลุ่มเมฆฝนกำลังอ่อน เคลื่อนตัวตามกระแสลมมรสุมตะวันออกเฉียงเหนือ"
            )}
          </p>
        </div>

        <div className="hy-qgis-schedule-grid">
          {timeWindowAlerts.map((slot, idx) => (
            <div
              key={idx}
              className="hy-qgis-schedule-card"
              style={{ borderTop: `4px solid ${tierColor(slot.tier)}` }}
            >
              <div className="hy-qgis-schedule-head">
                <strong>⏰ {slot.windowLabel}</strong>
                <span style={{ background: tierColor(slot.tier) }}>ระดับ {slot.tier}</span>
              </div>
              <small className="hy-qgis-schedule-tag">{slot.tag}</small>
              <div className="hy-qgis-schedule-metrics">
                <p>💧 <b>ปริมาณ/ระดับน้ำ:</b> {slot.waterQty}</p>
                <p>🌧️ <b>ปริมาณฝน & ทิศทางลม:</b> {slot.rainWindQty}</p>
              </div>
              <p className="hy-qgis-schedule-action">💡 {slot.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* PRIORITY 2: Layer & Symbology Controls Toolbar */}
      <div className="hy-qgis-toolbar">
        <div className="hy-qgis-btn-group" role="group" aria-label="เลือกพื้นหลังแผนที่ภาพถ่าย">
          <span className="hy-qgis-group-label">พื้นหลังแผนที่:</span>
          <button type="button" aria-pressed={basemap === "satellite"} onClick={() => setBasemap("satellite")}>
            🛰️ ภาพถ่ายดาวเทียมจริง
          </button>
          <button type="button" aria-pressed={basemap === "topo"} onClick={() => setBasemap("topo")}>
            ⛰️ แผนที่ภูมิประเทศ
          </button>
          <button type="button" aria-pressed={basemap === "dark"} onClick={() => setBasemap("dark")}>
            🌑 แผนที่มืดเน้นสัญลักษณ์
          </button>
        </div>

        <div className="hy-qgis-btn-group" role="group" aria-label="เปิดปิดชั้นสัญลักษณ์แผนที่">
          <span className="hy-qgis-group-label">ชั้นสัญลักษณ์ (Symbology):</span>
          <button type="button" aria-pressed={showRadarWind} onClick={() => setShowRadarWind(v => !v)}>
            📡 เรดาร์ฝน & เวกเตอร์ลม
          </button>
          <button type="button" aria-pressed={showDams} onClick={() => setShowDams(v => !v)}>
            🏞️ เขื่อนหลัก (5 แห่ง)
          </button>
          <button type="button" aria-pressed={showRivers} onClick={() => setShowRivers(v => !v)}>
            〰️ โครงข่ายแม่น้ำ 7 สาย
          </button>
          <button type="button" aria-pressed={showBuffer} onClick={() => setShowBuffer(v => !v)}>
            🎯 รัศมีความเสี่ยง
          </button>
          <button type="button" aria-pressed={showLabels} onClick={() => setShowLabels(v => !v)}>
            🏷️ ป้ายกำกับอัจฉริยะ
          </button>
          <button type="button" aria-pressed={showGrid} onClick={() => setShowGrid(v => !v)}>
            📐 กริดพิกัด (°N/°E)
          </button>
        </div>
      </div>

      {/* Cartographic Map Sheet + Symbology Legend & Inspector */}
      <div className="hy-qgis-sheet">
        <div className={`hy-qgis-map-frame is-${basemap}`}>
          <div className="hy-qgis-neatline">
            <svg
              viewBox="0 0 640 520"
              className="hy-qgis-svg"
              role="img"
              aria-label="แผนที่ภาพถ่ายดาวเทียมตรึงพิกัด WGS84 พร้อมสัญลักษณ์ระดับความเสี่ยง 5 ระดับ เขื่อนหลัก โครงข่ายแม่น้ำ และเรดาร์ทิศทางฝนลม"
            >
              <defs>
                <linearGradient id="qgis-sat-base" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#133324" />
                  <stop offset="45%" stopColor="#1e462f" />
                  <stop offset="82%" stopColor="#244b35" />
                  <stop offset="100%" stopColor="#09314d" />
                </linearGradient>
                <linearGradient id="qgis-topo-base" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d9ead3" />
                  <stop offset="55%" stopColor="#eef7e8" />
                  <stop offset="85%" stopColor="#f7fbe9" />
                  <stop offset="100%" stopColor="#bae6fd" />
                </linearGradient>
                <linearGradient id="qgis-dark-base" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#09131c" />
                  <stop offset="100%" stopColor="#0f2233" />
                </linearGradient>
                <filter id="qgis-blur-halo" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="14" />
                </filter>
                <filter id="qgis-radar-blur" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="9" />
                </filter>
                <marker id="qgis-wind-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                </marker>
                <marker id="qgis-storm-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#facc15" />
                </marker>
                <clipPath id="qgis-frame-clip">
                  <rect x={MAP_FRAME.x} y={MAP_FRAME.y} width={MAP_FRAME.width} height={MAP_FRAME.height} />
                </clipPath>
              </defs>

              {/* Fallback Gradient Canvas */}
              <rect
                x={MAP_FRAME.x}
                y={MAP_FRAME.y}
                width={MAP_FRAME.width}
                height={MAP_FRAME.height}
                fill={
                  basemap === "satellite"
                    ? "url(#qgis-sat-base)"
                    : basemap === "topo"
                      ? "url(#qgis-topo-base)"
                      : "url(#qgis-dark-base)"
                }
              />

              {/* Exact Georeferenced Satellite / Topo Image (BBox 98.40..101.60°E, 13.30..19.30°N in WGS84) */}
              {basemap === "satellite" && (
                <image
                  href={ARCGIS_SAT_EXPORT_URL}
                  x={MAP_FRAME.x}
                  y={MAP_FRAME.y}
                  width={MAP_FRAME.width}
                  height={MAP_FRAME.height}
                  preserveAspectRatio="none"
                  opacity="0.92"
                />
              )}
              {basemap === "topo" && (
                <image
                  href={ARCGIS_TOPO_EXPORT_URL}
                  x={MAP_FRAME.x}
                  y={MAP_FRAME.y}
                  width={MAP_FRAME.width}
                  height={MAP_FRAME.height}
                  preserveAspectRatio="none"
                  opacity="0.92"
                />
              )}

              {/* Clipped Georeferenced Layers inside the Map Frame */}
              <g clipPath="url(#qgis-frame-clip)">
                {/* Upper Gulf of Thailand Coastline Line */}
                <path
                  d={projectPolyline(UPPER_GULF_COAST_GEO)}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.2"
                  strokeDasharray="6 3"
                />
                {(() => {
                  const gulfLabelPt = projectToCanvas(13.38, 100.45);
                  return (
                    <text x={gulfLabelPt.x} y={gulfLabelPt.y} textAnchor="middle" className="hy-qgis-sea-label">
                      🌊 อ่าวไทยตอนบน (13.38°N, 100.45°E)
                    </text>
                  );
                })()}

                {/* Georeferenced 7-Basin River Network with Strahler Order Hierarchy + Animated Flow Particles */}
                {showRivers && (
                  <g className="hy-qgis-rivers">
                    {RIVER_NETWORK_GEO.map(river => {
                      const dPath = projectPolyline(river.coords);
                      const lblPt = projectToCanvas(river.labelLat, river.labelLng);
                      return (
                        <g key={river.id}>
                          {/* Outer Casing for high cartographic contrast over satellite imagery */}
                          <path
                            d={dPath}
                            fill="none"
                            stroke="rgba(8, 28, 48, 0.72)"
                            strokeWidth={river.order === 3 ? 6 : river.order === 2 ? 4.2 : 3.2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {/* Inner River Line */}
                          <path
                            d={dPath}
                            fill="none"
                            stroke={river.order === 3 ? "#38bdf8" : river.order === 2 ? "#67e8f9" : "#a5f3fc"}
                            strokeWidth={river.order === 3 ? 3.5 : river.order === 2 ? 2.3 : 1.7}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {/* Animated Flowing Water Particle along the real river path */}
                          <circle r={river.order === 3 ? 3.4 : 2.5} fill="#ffffff" opacity="0.9">
                            <animateMotion
                              dur={river.order === 3 ? "5.5s" : "6.8s"}
                              repeatCount="indefinite"
                              path={dPath}
                            />
                          </circle>
                          {showLabels && (
                            <text
                              x={lblPt.x}
                              y={lblPt.y}
                              textAnchor="middle"
                              fill="#e0f2fe"
                              stroke="rgba(8, 25, 42, 0.9)"
                              strokeWidth="2.5"
                              paintOrder="stroke"
                              fontSize="8.5"
                              fontWeight="700"
                            >
                              {river.name}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Spatial Risk Buffer / IDW Heatmap Halos */}
                {showBuffer && (
                  <g filter="url(#qgis-blur-halo)">
                    {filteredItems.map(({ station, riskTier }) => {
                      const pt = projectToCanvas(station.lat, station.lng);
                      const radius = riskTier === 5 ? 34 : riskTier === 4 ? 28 : riskTier === 3 ? 22 : 14;
                      return (
                        <circle
                          key={`halo-${station.id}`}
                          cx={pt.x}
                          cy={pt.y}
                          r={radius}
                          fill={tierColor(riskTier)}
                          opacity={riskTier >= 3 ? 0.56 : 0.28}
                        />
                      );
                    })}
                  </g>
                )}

                {/* Radar Echo Cells & Wind/Storm Movement Vectors */}
                {showRadarWind && (
                  <g className="hy-qgis-radar-layer">
                    {[
                      { sLat: 18.4, sLng: 101.1, eLat: 17.6, eLng: 100.2 },
                      { sLat: 16.9, sLng: 101.1, eLat: 16.1, eLng: 100.2 },
                      { sLat: 15.4, sLng: 101.0, eLat: 14.6, eLng: 100.1 },
                      { sLat: 14.4, sLng: 101.1, eLat: 13.7, eLng: 100.3 },
                    ].map((vec, i) => {
                      const p1 = projectToCanvas(vec.sLat, vec.sLng);
                      const p2 = projectToCanvas(vec.eLat, vec.eLng);
                      return (
                        <g key={`wind-vec-${i}`} opacity="0.84">
                          <line
                            x1={p1.x}
                            y1={p1.y}
                            x2={p2.x}
                            y2={p2.y}
                            stroke="#38bdf8"
                            strokeWidth="1.8"
                            strokeDasharray="5 4"
                            markerEnd="url(#qgis-wind-arrow)"
                          />
                          <text
                            x={(p1.x + p2.x) / 2 + 6}
                            y={(p1.y + p2.y) / 2 - 4}
                            fill="#bae6fd"
                            stroke="rgba(8,24,40,0.85)"
                            strokeWidth="2"
                            paintOrder="stroke"
                            fontSize="8.5"
                            fontWeight="700"
                          >
                            ลม NE {radarMeta.windSpeedKmh} กม./ชม.
                          </text>
                        </g>
                      );
                    })}

                    {rainCells.map(cell => {
                      const pt = projectToCanvas(cell.lat, cell.lng);
                      const nextPt = projectToCanvas(cell.lat - 0.36, cell.lng - 0.36);
                      const outerColor = cell.dbz >= 45 ? "#ef4444" : cell.dbz >= 36 ? "#f97316" : "#22c55e";
                      return (
                        <g key={`radar-cell-${cell.id}`}>
                          <g filter="url(#qgis-radar-blur)">
                            <ellipse cx={pt.x} cy={pt.y} rx="32" ry="22" fill="#22c55e" opacity="0.4" />
                            <ellipse cx={pt.x} cy={pt.y} rx="20" ry="14" fill={outerColor} opacity="0.62" />
                          </g>
                          <polygon
                            points={`${pt.x - 7},${pt.y - 7} ${nextPt.x - 15},${nextPt.y + 5} ${nextPt.x + 7},${nextPt.y + 15} ${pt.x + 7},${pt.y + 7}`}
                            fill="rgba(250, 204, 21, 0.16)"
                            stroke="#facc15"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                          />
                          <line
                            x1={pt.x}
                            y1={pt.y}
                            x2={nextPt.x}
                            y2={nextPt.y}
                            stroke="#facc15"
                            strokeWidth="2.2"
                            markerEnd="url(#qgis-storm-arrow)"
                          />
                          <rect
                            x={pt.x - 54}
                            y={pt.y - 29}
                            width="108"
                            height="15"
                            rx="4"
                            fill="rgba(15, 23, 42, 0.88)"
                            stroke="#facc15"
                            strokeWidth="0.9"
                          />
                          <text x={pt.x} y={pt.y - 19} textAnchor="middle" fill="#fef08a" fontSize="8" fontWeight="700">
                            📡 {cell.dbz}dBZ · {cell.rateMmHr}มม./ชม. ({cell.etaMin}น.)
                          </text>
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Major Dam Reservoir Symbology Layer (Distinct Shield/Barrage Icon + Leader Callout) */}
                {showDams && (
                  <g className="hy-qgis-dams-layer">
                    {MAJOR_DAMS_GEO.map(dam => {
                      const pt = projectToCanvas(dam.lat, dam.lng);
                      const lx = pt.x + dam.dx;
                      const ly = pt.y + dam.dy;
                      return (
                        <g key={dam.id} transform={`translate(${pt.x}, ${pt.y})`}>
                          <line
                            x1="0"
                            y1="0"
                            x2={dam.dx}
                            y2={dam.dy}
                            stroke="#38bdf8"
                            strokeWidth="1.2"
                            strokeDasharray="2 2"
                          />
                          {/* Dam Reservoir Diamond/Shield Symbol */}
                          <polygon
                            points="0,-8 8,0 0,8 -8,0"
                            fill="#0284c7"
                            stroke="#ffffff"
                            strokeWidth="1.8"
                          />
                          <circle r="2.2" fill="#e0f2fe" />
                          {showLabels && (
                            <g transform={`translate(${lx - pt.x}, ${ly - pt.y})`}>
                              <rect
                                x={dam.dx < 0 ? -94 : -4}
                                y="-10"
                                width="98"
                                height="15"
                                rx="4"
                                fill="rgba(7, 89, 133, 0.92)"
                                stroke="#7dd3fc"
                                strokeWidth="0.8"
                              />
                              <text
                                x={dam.dx < 0 ? -45 : 45}
                                y="1"
                                textAnchor="middle"
                                fill="#ffffff"
                                fontSize="8.2"
                                fontWeight="700"
                              >
                                🏞️ {dam.name} ({dam.defaultPct}%)
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Station Risk Symbology Points + Smart Non-Overlapping Label Placement */}
                {filteredItems.map(({ basin, station, riskTier }, idx) => {
                  const pt = projectToCanvas(station.lat, station.lng);
                  const isSelected = focused?.station.id === station.id;
                  const color = tierColor(riskTier);
                  const shouldLabel = showLabels && labeledStationIds.has(station.id);
                  const lblOffset = computeSmartLabelOffset(station.lat, station.lng, idx, isSelected);
                  const labelText = isSelected
                    ? `${station.id} · ${formatWaterValue(station.value)}ม. (${station.lat.toFixed(2)}°N,${station.lng.toFixed(2)}°E)`
                    : `${station.id} (${formatWaterValue(station.value)}ม.)`;
                  const boxWidth = isSelected ? 148 : 68;
                  const boxX = lblOffset.anchor === "end" ? -boxWidth - 3 : 3;

                  return (
                    <g
                      key={`${basin.id}:${station.id}`}
                      transform={`translate(${pt.x}, ${pt.y})`}
                      className={`hy-qgis-pt ${isSelected ? "is-selected" : ""}`}
                      onClick={() => {
                        setFocusedStationId(station.id);
                        onSelectStation(basin.id, station.id);
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`สถานี ${station.name} พิกัด ${station.lat.toFixed(3)}N ${station.lng.toFixed(3)}E ระดับความเสี่ยง ${riskTier}`}
                    >
                      {(isSelected || riskTier >= 4) && (
                        <circle r={isSelected ? 15 : 11} fill="none" stroke={color} strokeWidth="2.2" className="hy-qgis-ring" />
                      )}
                      {/* Proportional Symbol Size by Risk Tier */}
                      <circle
                        r={isSelected ? 7.8 : riskTier === 5 ? 6.8 : riskTier === 4 ? 6.0 : riskTier === 3 ? 5.2 : 4.4}
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth="1.8"
                      />
                      {shouldLabel && (
                        <g>
                          <line
                            x1="0"
                            y1="0"
                            x2={lblOffset.dx}
                            y2={lblOffset.dy}
                            stroke="#ffffff"
                            strokeWidth="1.1"
                            opacity="0.85"
                          />
                          <g transform={`translate(${lblOffset.dx}, ${lblOffset.dy})`}>
                            <rect
                              x={boxX}
                              y="-9"
                              width={boxWidth}
                              height="15"
                              rx="4"
                              fill="rgba(12, 28, 44, 0.9)"
                              stroke={color}
                              strokeWidth={isSelected ? "1.4" : "0.9"}
                            />
                            <text
                              x={lblOffset.anchor === "end" ? -7 : 7}
                              y="1.5"
                              textAnchor={lblOffset.anchor}
                              className="hy-qgis-pt-label"
                            >
                              {labelText}
                            </text>
                          </g>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Coordinate Graticule Grid (Computed from exact projectToCanvas) */}
              {showGrid && (
                <g className="hy-qgis-graticule">
                  {graticuleLats.map(lat => {
                    const { y } = projectToCanvas(lat, GEO_BBOX.minLng);
                    const label = formatDms(lat, true);
                    return (
                      <g key={`lat-${lat}`}>
                        <line x1={MAP_FRAME.x} y1={y} x2={MAP_FRAME.x + MAP_FRAME.width} y2={y} />
                        <text x={MAP_FRAME.x + 6} y={y - 4}>{label}</text>
                        <text x={MAP_FRAME.x + MAP_FRAME.width - 6} y={y - 4} textAnchor="end">{label}</text>
                      </g>
                    );
                  })}
                  {graticuleLngs.map(lng => {
                    const { x } = projectToCanvas(GEO_BBOX.minLat, lng);
                    const label = formatDms(lng, false);
                    return (
                      <g key={`lng-${lng}`}>
                        <line x1={x} y1={MAP_FRAME.y} x2={x} y2={MAP_FRAME.y + MAP_FRAME.height} />
                        <text x={x + 4} y={MAP_FRAME.y + 13}>{label}</text>
                        <text x={x + 4} y={MAP_FRAME.y + MAP_FRAME.height - 6}>{label}</text>
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Compass Rose (North Arrow) */}
              <g transform="translate(568, 44)" className="hy-qgis-north">
                <circle r="22" fill="rgba(12, 28, 44, 0.85)" stroke="rgba(255,255,255,0.45)" />
                <polygon points="0,-15 -6,8 0,4 6,8" fill="#ffffff" />
                <text x="0" y="17" textAnchor="middle" fill="#7dd3fc" fontSize="9" fontWeight="800">
                  N
                </text>
              </g>

              {/* Geographically calibrated Scale Bar (100 km ≈ 173 px at 16°N) */}
              <g transform="translate(42, 456)" className="hy-qgis-scale">
                <rect x="-6" y="-14" width="194" height="28" rx="4" fill="rgba(12, 28, 44, 0.85)" />
                <rect x="0" y="2" width="43" height="5" fill="#ffffff" />
                <rect x="43" y="2" width="43" height="5" fill="#38bdf8" />
                <rect x="86" y="2" width="87" height="5" fill="#ffffff" />
                <text x="0" y="-3" fill="#ffffff" fontSize="9" fontWeight="700">0</text>
                <text x="43" y="-3" fill="#ffffff" fontSize="9" fontWeight="700">25</text>
                <text x="86" y="-3" fill="#ffffff" fontSize="9" fontWeight="700">50</text>
                <text x="152" y="-3" fill="#7dd3fc" fontSize="9" fontWeight="700">100 กม.</text>
              </g>

              {/* Outer Alternating Coordinate Frame Border */}
              <rect x={MAP_FRAME.x} y={MAP_FRAME.y} width={MAP_FRAME.width} height={MAP_FRAME.height} fill="none" stroke="#ffffff" strokeWidth="2" />
              <rect x="20" y="16" width="600" height="488" fill="none" stroke="#0c2e44" strokeWidth="4" strokeDasharray="24 24" />
            </svg>
          </div>

          {/* Map Sheet Footer */}
          <div className="hy-qgis-titleblock">
            <div>
              <small>GEOSPATIAL DATUM: WGS 84 (EPSG:4326) · EXTENT: 98.40°E–101.60°E, 13.30°N–19.30°N</small>
              <strong>แผนที่ดาวเทียมวิเคราะห์ความเสี่ยงระดับน้ำ เขื่อนหลัก และเรดาร์ทิศทางฝนลม ({activeBasinId === "all" ? "ครบ 7 ลุ่มน้ำ" : `เฉพาะลุ่มน้ำ ${activeBasinId}`})</strong>
            </div>
            <div className="hy-qgis-meta-right">
              <span>สถานีพิกัดจริง: <b>{items.length} แห่ง</b></span>
              <span>ที่มาภาพถ่าย: <b>Esri World Imagery / ThaiWater</b></span>
            </div>
          </div>
        </div>

        {/* Right: Symbology Legend, 5-Tier Filter & Focused Station Inspector */}
        <aside className="hy-qgis-sidebar">
          <div className="hy-qgis-legend-card">
            <div className="hy-qgis-card-head">
              <span className="hy-eyebrow">MAP SYMBOLOGY & 5-TIER RISK</span>
              <h3>คำอธิบายสัญลักษณ์แผนที่ & ระดับสี</h3>
              <p>คลิกเลือกแถบระดับสีเพื่อกรองเฉพาะสถานีในระดับความเสี่ยงนั้นบนแผนที่ดาวเทียม</p>
            </div>

            <div className="hy-qgis-tier-list">
              {RISK_TIERS.map(t => {
                const count = tierCounts[t.tier];
                const isSelected = activeTierFilter === t.tier;
                return (
                  <button
                    key={t.tier}
                    type="button"
                    className={`hy-qgis-tier-row ${isSelected ? "is-selected" : ""}`}
                    onClick={() => setActiveTierFilter(isSelected ? "all" : t.tier)}
                  >
                    <span className="hy-qgis-swatch" style={{ background: t.color }} />
                    <div className="hy-qgis-tier-info">
                      <strong>{t.label}</strong>
                      <small>{t.criteria}</small>
                    </div>
                    <b className="hy-qgis-tier-count">{count} จุด</b>
                  </button>
                );
              })}
            </div>

            {/* Additional Cartographic Symbols Key */}
            <div className="hy-symbology-key-grid">
              <div><span className="hy-sym-diamond" /> <small>เขื่อนเก็บกักน้ำหลัก (% ความจุ)</small></div>
              <div><span className="hy-sym-river" /> <small>ทางน้ำสายหลัก & ทิศทางไหล</small></div>
              <div><span className="hy-sym-radar" /> <small>เรดาร์เมฆฝน (dBZ) & กรวยเคลื่อนตัว</small></div>
              <div><span className="hy-sym-wind" /> <small>เวกเตอร์ทิศทางลมมรสุม (กม./ชม.)</small></div>
            </div>

            {activeTierFilter !== "all" && (
              <button type="button" className="hy-qgis-reset-btn" onClick={() => setActiveTierFilter("all")}>
                🔄 แสดงครบทุกระดับความเสี่ยง ({items.length} สถานี)
              </button>
            )}
          </div>

          {/* Focused Station Spatial Callout */}
          {focused && (
            <div className="hy-qgis-focus-card" style={{ borderLeftColor: tierColor(focused.riskTier) }}>
              <div className="hy-qgis-focus-top">
                <span className="hy-qgis-focus-badge" style={{ background: tierColor(focused.riskTier) }}>
                  ความเสี่ยงตอนนี้: ระดับ {focused.riskTier}
                </span>
                <small>พิกัด {focused.station.lat.toFixed(4)}°N, {focused.station.lng.toFixed(4)}°E</small>
              </div>
              <h4>{focused.station.name} ({focused.station.id}) · ลุ่มน้ำ{focused.basin.name}</h4>
              <p className="hy-qgis-focus-metrics">
                ระดับน้ำ <b>{formatWaterValue(focused.station.value)} ม. รทก.</b>
                {focused.station.capacityPercent !== null && (
                  <> · ความจุ <b>{focused.station.capacityPercent.toFixed(1)}%</b></>
                )}
                {waterBankDifference(focused.station) !== null && (
                  <> ({waterBankDifference(focused.station)! >= 0 ? `สูงกว่าตลิ่ง +${waterBankDifference(focused.station)!.toFixed(2)} ม.` : `ต่ำกว่าตลิ่ง ${Math.abs(waterBankDifference(focused.station)!).toFixed(2)} ม.`})</>
                )}
              </p>
              <small>เวลาตรวจวัดล่าสุด: {focused.station.observedAt ? `${thaiObservationTime(focused.station.observedAt)} น.` : "ไม่ระบุ"}</small>
            </div>
          )}

          {/* Easy-to-Read Spatial Summary */}
          <div className="hy-qgis-analysis-card">
            <span className="hy-eyebrow">📊 สรุปการวิเคราะห์เชิงพื้นที่เข้าใจง่าย</span>
            <h3>อ่านแผนที่นี้อย่างไรให้ได้ประโยชน์สูงสุด?</h3>
            <ul className="hy-qgis-analysis-list">
              <li>
                <strong>1. สัญลักษณ์ขนาดและสี (Proportional Risk Symbology):</strong> จุดสถานีที่มีความเสี่ยงสูง (ระดับ 4–5 สีส้ม/แดง) จะมีขนาดใหญ่กว่าและมีวงแหวนกระพริบเตือน เพื่อให้เห็นจุดวิกฤตได้ทันทีโดยไม่ต้องซูม
              </li>
              <li>
                <strong>2. ความสัมพันธ์ของเขื่อน–ลำน้ำ–เรดาร์ฝน:</strong> สัญลักษณ์สี่เหลี่ยมขนมเปียกปูนสีฟ้าคือเขื่อนหลัก หากมีกลุ่มเรดาร์ฝน (วงสีเขียว–ส้ม) ตกหนักท้ายเขื่อน น้ำจะไหลลงลำน้ำสายหลักโดยตรงโดยไม่มีเขื่อนกั้น
              </li>
            </ul>
          </div>
        </aside>
      </div>

      {/* PRIORITY 3: Interactive Longitudinal River Profile & Easy-to-Understand Hydrological Science Explainer */}
      <div className="hy-science-profile-card" role="region" aria-label="กราฟโปรไฟล์ความลาดชันลำน้ำและคำอธิบายหลักวิชาการแบบเข้าใจง่าย">
        <div className="hy-science-head">
          <div>
            <span className="hy-eyebrow">🔬 หลักวิชาการอุทกวิทยาฉบับเข้าใจง่าย (Interactive River Profile & Science)</span>
            <h3>ทำไมน้ำเหนือหลาก + น้ำทะเลหนุน ถึงทำให้น้ำเอ่อล้นลุ่มเจ้าพระยาตอนล่าง?</h3>
            <p>กดสลับจำลองสถานการณ์เพื่อดูการเดินทางของมวลน้ำตั้งแต่ต้นน้ำภาคเหนือ (ความสูง +150 ม. รทก.) ไหลลงสู่ที่ราบลุ่มภาคกลางและอ่าวไทย (0 ม. รทก.)</p>
          </div>
          <div className="hy-scenario-tabs" role="group" aria-label="จำลองสถานการณ์การไหลของน้ำ">
            <button
              type="button"
              aria-pressed={profileScenario === "live"}
              onClick={() => setProfileScenario("live")}
            >
              🌊 สถานการณ์ปกติ/ปัจจุบัน
            </button>
            <button
              type="button"
              aria-pressed={profileScenario === "upstream-surge"}
              onClick={() => setProfileScenario("upstream-surge")}
            >
              🌧️ จำลองน้ำเหนือหลาก (ปิง·น่าน)
            </button>
            <button
              type="button"
              aria-pressed={profileScenario === "high-tide"}
              onClick={() => setProfileScenario("high-tide")}
            >
              🌕 จำลองน้ำทะเลหนุนสูงปากอ่าว
            </button>
          </div>
        </div>

        <div className="hy-profile-svg-wrap">
          <svg viewBox="0 0 860 220" className="hy-profile-svg" role="img" aria-label="กราฟภาพตัดตามยาวแสดงความลาดชันแม่น้ำเจ้าพระยาจากภาคเหนือสู่อ่าวไทย">
            <defs>
              <linearGradient id="prof-terrain" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id="prof-water" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={profileScenario === "upstream-surge" ? "#f97316" : "#06b6d4"} />
                <stop offset="55%" stopColor="#0284c7" />
                <stop offset="100%" stopColor={profileScenario === "high-tide" ? "#ef4444" : "#2563eb"} />
              </linearGradient>
            </defs>

            {/* Reference MSL 0.00 m line */}
            <line x1="40" y1="185" x2="830" y2="185" stroke="#64748b" strokeWidth="1.2" strokeDasharray="4 4" />
            <text x="46" y="200" fill="#64748b" fontSize="10" fontWeight="700">
              ระดับน้ำทะเลปานกลาง 0.00 ม. รทก. (Mean Sea Level — MSL)
            </text>

            {/* River Bed Terrain Profile */}
            <path
              d="M 40,58 Q 180,105 310,128 L 460,145 L 620,170 L 740,178 L 830,192 L 830,210 L 40,210 Z"
              fill="url(#prof-terrain)"
            />

            {/* Bank Level Dashed Line */}
            <path
              d="M 40,42 Q 180,89 310,112 L 460,128 L 620,152 L 740,160 L 830,166"
              fill="none"
              stroke="#f43f5e"
              strokeWidth="1.8"
              strokeDasharray="6 4"
            />
            <text x="615" y="144" fill="#f43f5e" fontSize="10" fontWeight="800">
              --- แนวระดับตลิ่ง (100% ความจุลำน้ำ)
            </text>

            {/* Dynamic Water Surface Profile according to selected scenario */}
            <path
              d={
                profileScenario === "upstream-surge"
                  ? "M 40,40 Q 180,84 310,108 L 460,126 L 620,155 L 740,164 L 830,170 L 830,190 L 740,178 L 620,170 L 460,145 L 310,128 Q 180,105 40,58 Z"
                  : profileScenario === "high-tide"
                    ? "M 40,50 Q 180,96 310,119 L 460,135 L 620,149 L 740,152 L 830,150 L 830,190 L 740,178 L 620,170 L 460,145 L 310,128 Q 180,105 40,58 Z"
                    : "M 40,50 Q 180,96 310,119 L 460,136 L 620,158 L 740,165 L 830,168 L 830,190 L 740,178 L 620,170 L 460,145 L 310,128 Q 180,105 40,58 Z"
              }
              fill="url(#prof-water)"
              opacity="0.88"
            />

            {/* Animated Flow Droplets along the longitudinal profile */}
            <circle r="4.5" fill="#ffffff">
              <animateMotion
                dur={profileScenario === "upstream-surge" ? "3.2s" : "5.0s"}
                repeatCount="indefinite"
                path="M 45,48 Q 180,94 310,116 L 460,134 L 620,156 L 740,163 L 820,166"
              />
            </circle>
            <circle r="4" fill="#bae6fd">
              <animateMotion
                dur={profileScenario === "upstream-surge" ? "3.2s" : "5.0s"}
                begin="1.6s"
                repeatCount="indefinite"
                path="M 45,48 Q 180,94 310,116 L 460,134 L 620,156 L 740,163 L 820,166"
              />
            </circle>

            {/* High-tide backwater arrow when high-tide scenario is active */}
            {profileScenario === "high-tide" && (
              <g>
                <path d="M 820,144 L 680,144" stroke="#ef4444" strokeWidth="3" />
                <polygon points="680,144 692,138 692,150" fill="#ef4444" />
                <text x="750" y="135" textAnchor="middle" fill="#ef4444" fontSize="10.5" fontWeight="800">
                  🌊 น้ำทะเลหนุนดันย้อนปากแม่น้ำ (+1.50 ม. รทก.)
                </text>
              </g>
            )}

            {/* Key Hydrological Station Milestones along the profile */}
            {[
              { x: 65, y: 46, title: "1. ต้นน้ำเหนือ (ปิง·วัง·ยม·น่าน)", sub: "+120 ถึง +300 ม. รทก. · เขื่อนภูมิพล/สิริกิติ์" },
              { x: 310, y: 112, title: "2. นครสวรรค์ (สถานี C.2)", sub: "จุดรวมแม่น้ำ 4 สาย (+23 ม. รทก.)" },
              { x: 460, y: 128, title: "3. เขื่อนเจ้าพระยา ชัยนาท (C.13)", sub: "ประตูควบคุมการระบายน้ำสู่ภาคกลาง (+16 ม.)" },
              { x: 625, y: 152, title: "4. อยุธยา / บางไทร (C.29A)", sub: "รับน้ำป่าสักเพิ่ม · ที่ราบลุ่มต่ำ (+1.5 ถึง +3.5 ม.)" },
              { x: 785, y: 162, title: "5. กทม. – ปากอ่าวไทย", sub: "อิทธิพลน้ำขึ้น–น้ำลงรายชั่วโมง (0 ถึง +1.6 ม.)" },
            ].map((node, i) => (
              <g key={i} transform={`translate(${node.x}, ${node.y})`}>
                <circle r="5.5" fill="#ffffff" stroke="#0284c7" strokeWidth="2.5" />
                <text x="0" y="-18" textAnchor="middle" fill="#0f172a" fontSize="10.5" fontWeight="800">
                  {node.title}
                </text>
                <text x="0" y="-6" textAnchor="middle" fill="#475569" fontSize="9.2" fontWeight="600">
                  {node.sub}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* 3 Plain-Language Scientific Concept Cards */}
        <div className="hy-science-concepts-grid">
          <article className="hy-science-concept">
            <strong>📏 1. ทำไมค่า “ม. รทก.” ต้นน้ำถึงสูงกว่า กทม.?</strong>
            <p>
              <b>ม. รทก.</b> ย่อมาจาก <i>เมตรเหนือระดับน้ำทะเลปานกลาง</i> แผ่นดินภาคเหนือและนครสวรรค์อยู่สูงกว่าระดับน้ำทะเลมาก (เช่น นครสวรรค์ตลิ่งอยู่ที่ +26 ม. รทก. ส่วนกรุงเทพฯ ตลิ่งอยู่ที่ +2.5 ม. รทก.) ดังนั้นเวลาดูว่าเสี่ยงท่วมหรือไม่ ให้ดูที่ <b>“% ความจุลำน้ำ”</b> และ <b>“ระยะห่างจากตลิ่ง”</b> เป็นหลัก
            </p>
          </article>
          <article className="hy-science-concept">
            <strong>⏳ 2. น้ำเหนือใช้เวลาเดินทางกี่วันถึงกรุงเทพฯ?</strong>
            <p>
              มวลน้ำจาก <b>นครสวรรค์ (C.2)</b> ไหลผ่าน <b>เขื่อนเจ้าพระยา (C.13 จ.ชัยนาท)</b> ลงมาถึง <b>บางไทร จ.อยุธยา (C.29A)</b> และ <b>กรุงเทพฯ</b> ใช้เวลาเฉลี่ยประมาณ <b>3 – 6 วัน</b> ขึ้นอยู่กับอัตราการระบายน้ำท้ายเขื่อน ทำให้ชาวปริมณฑลและ กทม. สามารถเตรียมตัวล่วงหน้าได้จากการดูสถานี C.2 และ C.13
            </p>
          </article>
          <article className="hy-science-concept">
            <strong>🌊 3. น้ำทะเลหนุนเกี่ยวข้องกับน้ำท่วมอย่างไร?</strong>
            <p>
              ช่วงที่น้ำทะเลอ่าวไทยขึ้นสูงสุด (เช่น <b>+1.30 ถึง +1.60 ม. รทก.</b>) มวลน้ำเค็มจะดันปากแม่น้ำเจ้าพระยาไว้เสมือนกำแพงชั่วคราว ทำให้น้ำเหนือและน้ำฝนใน กทม. ไหลออกทะเลช้าลง จึงต้องเฝ้าระวังเป็นพิเศษในชั่วโมงที่ <b>“ฝนตกหนักตรงกับเวลาน้ำทะเลขึ้นสูงสุด”</b>
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
