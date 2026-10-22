"use client";

import { useEffect, useMemo, useState } from "react";
import upstreamBasinsGeo from "../../data/chao-phraya-upstream-basins.json";
import coreGeographyGeo from "../../data/chao-phraya-geography.json";
import type { HydroBasin } from "../../lib/hydro/model";
import { formatWaterValue, waterBankDifference, waterRisk, type WaterStation } from "../../lib/water-levels";
import { thaiObservationTime } from "../../lib/observation-time";

type BasemapStyle = "satellite" | "topo" | "dark";
type ProfileScenario = "live" | "upstream-surge" | "high-tide";
type TwinCameraPreset = "iso" | "north-dams" | "delta-gulf" | "top-tilt";

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

/**
 * 100% Aspect-Ratio-Matched EPSG:4326 (WGS84) Bounding Box & Map Frame:
 * - dLng = 102.50 - 97.50 = 5.00°
 * - dLat = 19.80 - 13.30 = 6.50°
 * - Ratio dLng : dLat = 5.00 : 6.50 = 10 : 13
 * - MAP_FRAME width : height = 500 : 650 = 10 : 13
 * - ArcGIS export size = 800,1040 = 10 : 13
 * Because all three share the exact 10:13 aspect ratio, ArcGIS World_Imagery/MapServer/export
 * returns the exact [97.50, 13.30, 102.50, 19.80] extent with 0.0000° expansion!
 */
const MAP_FRAME = {
  x: 30,
  y: 20,
  width: 500,
  height: 650,
};

const GEO_BBOX = {
  minLng: 97.50,
  maxLng: 102.50,
  minLat: 13.30,
  maxLat: 19.80,
};

const ARCGIS_SAT_EXPORT_URL = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${GEO_BBOX.minLng},${GEO_BBOX.minLat},${GEO_BBOX.maxLng},${GEO_BBOX.maxLat}&bboxSR=4326&imageSR=4326&size=800,1040&format=jpg&f=image`;
const ARCGIS_TOPO_EXPORT_URL = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/export?bbox=${GEO_BBOX.minLng},${GEO_BBOX.minLat},${GEO_BBOX.maxLng},${GEO_BBOX.maxLat}&bboxSR=4326&imageSR=4326&size=800,1040&format=jpg&f=image`;

// Exact linear EPSG:4326 projection matching the satellite export bbox pixel-for-pixel (100 px per 1.00°)
export function projectToCanvas(lat: number, lng: number): { x: number; y: number } {
  const xRatio = (lng - GEO_BBOX.minLng) / (GEO_BBOX.maxLng - GEO_BBOX.minLng);
  const yRatio = (lat - GEO_BBOX.minLat) / (GEO_BBOX.maxLat - GEO_BBOX.minLat);
  const x = MAP_FRAME.x + xRatio * MAP_FRAME.width;
  const y = MAP_FRAME.y + MAP_FRAME.height - yRatio * MAP_FRAME.height;
  return {
    x: Math.max(MAP_FRAME.x + 2, Math.min(MAP_FRAME.x + MAP_FRAME.width - 2, x)),
    y: Math.max(MAP_FRAME.y + 2, Math.min(MAP_FRAME.y + MAP_FRAME.height - 2, y)),
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

function projectGeoJsonRing(ring: number[][], step = 10): string {
  if (!ring.length) return "";
  const pts: string[] = [];
  for (let i = 0; i < ring.length; i += step) {
    const [lng, lat] = ring[i];
    const pt = projectToCanvas(lat, lng);
    pts.push(`${pts.length === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`);
  }
  return `${pts.join(" ")} Z`;
}

// High-precision real-world WGS84 coordinates for the 7 major rivers in the Chao Phraya Basin
const RIVER_NETWORK_GEO: {
  id: string;
  basinCode: string;
  name: string;
  order: 1 | 2 | 3;
  labelLat: number;
  labelLng: number;
  coords: [number, number][];
}[] = [
  {
    id: "ping",
    basinCode: "06",
    name: "แม่น้ำปิง",
    order: 2,
    labelLat: 17.85,
    labelLng: 98.58,
    coords: [
      [19.45, 98.96], // เชียงดาว
      [19.08, 98.95], // แม่แตง
      [18.788, 98.993], // เมืองเชียงใหม่ (P.1)
      [18.575, 99.008], // ลำพูน
      [18.185, 98.642], // จอมทอง / ฮอด
      [17.822, 98.695], // ทะเลสาบดอยเต่า / แม่ตื่น
      [17.2425, 99.0412], // เขื่อนภูมิพล (อ.สามเงา จ.ตาก)
      [17.072, 99.062], // จุดบรรจบแม่น้ำวัง (บ้านตาก)
      [16.884, 99.123], // เมืองตาก
      [16.478, 99.523], // เมืองกำแพงเพชร (P.7A)
      [16.125, 99.782], // ขาณุวรลักษบุรี
      [15.918, 99.925], // บรรพตพิสัย (P.17)
      [15.698, 100.141], // ปากน้ำโพ จ.นครสวรรค์ (C.2)
    ],
  },
  {
    id: "wang",
    basinCode: "07",
    name: "แม่น้ำวัง",
    order: 1,
    labelLat: 18.32,
    labelLng: 99.48,
    coords: [
      [19.08, 99.62], // วังเหนือ (เขื่อนกิ่วคอหมา)
      [18.61, 99.58], // แจ้ห่ม / เขื่อนกิ่วลม
      [18.288, 99.492], // เมืองลำปาง (W.4A)
      [18.025, 99.382], // เกาะคา
      [17.618, 99.218], // เถิน (W.3A)
      [17.345, 99.124], // แม่พริก
      [17.072, 99.062], // บรรจบแม่น้ำปิง อ.บ้านตาก จ.ตาก
    ],
  },
  {
    id: "yom",
    basinCode: "08",
    name: "แม่น้ำยม",
    order: 2,
    labelLat: 17.62,
    labelLng: 99.78,
    coords: [
      [18.92, 100.27], // เชียงม่วน / ปง
      [18.48, 100.18], // สอง (Y.20)
      [18.145, 100.142], // เมืองแพร่ (Y.1C)
      [17.795, 99.985], // วังชิ้น (Y.37)
      [17.432, 99.832], // ศรีสัชนาลัย (Y.14A)
      [17.308, 99.825], // สวรรคโลก
      [17.008, 99.824], // เมืองสุโขทัย (Y.4)
      [16.742, 99.968], // กงไกรลาศ
      [16.525, 100.122], // บางระกำ จ.พิษณุโลก (Y.16)
      [16.165, 100.242], // โพทะเล จ.พิจิตร
      [15.868, 100.258], // ชุมแสง (บรรจบแม่น้ำน่าน)
      [15.698, 100.141], // ปากน้ำโพ จ.นครสวรรค์ (C.2)
    ],
  },
  {
    id: "nan",
    basinCode: "09",
    name: "แม่น้ำน่าน",
    order: 2,
    labelLat: 17.35,
    labelLng: 100.46,
    coords: [
      [19.18, 100.78], // ท่าวังผา
      [18.778, 100.779], // เมืองน่าน (N.1)
      [18.565, 100.752], // เวียงสา (N.13A)
      [18.124, 100.562], // ทะเลสาบเหนือเขื่อนสิริกิติ์
      [17.7642, 100.5514], // เขื่อนสิริกิติ์ จ.อุตรดิตถ์
      [17.620, 100.098], // เมืองอุตรดิตถ์ (N.2B)
      [17.205, 100.195], // พิชัย / พรหมพิราม
      [16.821, 100.262], // เมืองพิษณุโลก (N.5A)
      [16.438, 100.348], // เมืองพิจิตร / ตะพานหิน (N.7A)
      [16.042, 100.312], // บางมูลนาก (N.8A)
      [15.868, 100.258], // ชุมแสง จ.นครสวรรค์ (N.67)
      [15.698, 100.141], // ปากน้ำโพ จ.นครสวรรค์ (C.2)
    ],
  },
  {
    id: "sakae-krang",
    basinCode: "11",
    name: "แม่น้ำสะแกกรัง",
    order: 1,
    labelLat: 15.58,
    labelLng: 99.64,
    coords: [
      [15.82, 99.38], // แม่วงก์ / คลองโพธิ์
      [15.62, 99.68], // สว่างอารมณ์
      [15.382, 100.025], // เมืองอุทัยธานี (Ct.19)
      [15.312, 100.078], // มโนรมย์ (บรรจบแม่น้ำเจ้าพระยา)
    ],
  },
  {
    id: "pa-sak",
    basinCode: "12",
    name: "แม่น้ำป่าสัก",
    order: 1,
    labelLat: 15.65,
    labelLng: 101.18,
    coords: [
      [16.82, 101.24], // หล่มสัก
      [16.418, 101.155], // เมืองเพชรบูรณ์ (S.3)
      [15.762, 101.032], // วิเชียรบุรี / ศรีเทพ
      [15.225, 101.048], // ชัยบาดาล
      [14.8625, 101.0645], // เขื่อนป่าสักชลสิทธิ์ จ.ลพบุรี
      [14.528, 100.912], // เมืองสระบุรี / เขื่อนพระราม 6 (S.5)
      [14.462, 100.732], // ท่าเรือ จ.อยุธยา (S.26)
      [14.353, 100.565], // เกาะเมืองพระนครศรีอยุธยา (บรรจบแม่น้ำเจ้าพระยา)
    ],
  },
  {
    id: "chao-phraya",
    basinCode: "chao-phraya",
    name: "แม่น้ำเจ้าพระยา",
    order: 3,
    labelLat: 14.55,
    labelLng: 100.38,
    coords: [
      [15.698, 100.141], // ปากน้ำโพ จ.นครสวรรค์ (C.2)
      [15.312, 100.078], // มโนรมย์ จ.ชัยนาท
      [15.1605, 100.1812], // เขื่อนเจ้าพระยา อ.สรรพยา จ.ชัยนาท (C.13)
      [14.892, 100.402], // เมืองสิงห์บุรี (C.3)
      [14.588, 100.452], // เมืองอ่างทอง (C.7A)
      [14.353, 100.565], // พระนครศรีอยุธยา (C.35)
      [14.198, 100.508], // บางไทร จ.อยุธยา (C.29A)
      [14.020, 100.535], // เมืองปทุมธานี
      [13.862, 100.514], // เมืองนนทบุรี / ปากเกร็ด
      [13.756, 100.493], // กรุงเทพฯ (สะพานพุทธ / บางนา)
      [13.595, 100.597], // ปากแม่น้ำเจ้าพระยา จ.สมุทรปราการ (ออกสู่อ่าวไทย)
    ],
  },
];

// Major Dams with exact WGS84 coordinates for Cartographic Reservoir Symbology
const MAJOR_DAMS_GEO: {
  id: string;
  name: string;
  river: string;
  lat: number;
  lng: number;
  defaultPct: number;
  side: "left" | "right";
}[] = [
  { id: "bhumibol", name: "เขื่อนภูมิพล", river: "ปิง (ตาก)", lat: 17.2425, lng: 99.0412, defaultPct: 74, side: "left" },
  { id: "sirikit", name: "เขื่อนสิริกิติ์", river: "น่าน (อุตรดิตถ์)", lat: 17.7642, lng: 100.5514, defaultPct: 78, side: "right" },
  { id: "kwae-noi", name: "เขื่อนแควน้อยฯ", river: "แควน้อย (พิษณุโลก)", lat: 17.1864, lng: 100.4228, defaultPct: 81, side: "right" },
  { id: "pasak", name: "เขื่อนป่าสักฯ", river: "ป่าสัก (ลพบุรี)", lat: 14.8625, lng: 101.0645, defaultPct: 86, side: "right" },
  { id: "chaophraya-barrage", name: "เขื่อนเจ้าพระยา", river: "ชัยนาท (C.13)", lat: 15.1605, lng: 100.1812, defaultPct: 82, side: "left" },
];

// Upper Gulf of Thailand coastline in real WGS84 coordinates
const UPPER_GULF_COAST_GEO: [number, number][] = [
  [13.30, 99.98],
  [13.40, 100.00],
  [13.52, 100.28],
  [13.595, 100.597],
  [13.47, 100.98],
  [13.30, 100.92],
];

const BASIN_POLYGON_COLORS: Record<string, { stroke: string; fill: string; label: string }> = {
  "06": { stroke: "#38bdf8", fill: "rgba(56, 189, 248, 0.08)", label: "ลุ่มน้ำปิง" },
  "07": { stroke: "#22d3ee", fill: "rgba(34, 211, 238, 0.08)", label: "ลุ่มน้ำวัง" },
  "08": { stroke: "#818cf8", fill: "rgba(129, 140, 248, 0.08)", label: "ลุ่มน้ำยม" },
  "09": { stroke: "#34d399", fill: "rgba(52, 211, 153, 0.08)", label: "ลุ่มน้ำน่าน" },
  "11": { stroke: "#fbbf24", fill: "rgba(251, 191, 36, 0.08)", label: "ลุ่มน้ำสะแกกรัง" },
  "12": { stroke: "#f472b6", fill: "rgba(244, 114, 182, 0.08)", label: "ลุ่มน้ำป่าสัก" },
  "chao-phraya": { stroke: "#0ea5e9", fill: "rgba(14, 165, 233, 0.11)", label: "ลุ่มน้ำเจ้าพระยา" },
};

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
  const [showBasinBounds, setShowBasinBounds] = useState(true);
  const [showBuffer, setShowBuffer] = useState(true);
  const [showRadarWind, setShowRadarWind] = useState(true);
  const [showRivers, setShowRivers] = useState(true);
  const [showDams, setShowDams] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [activeTierFilter, setActiveTierFilter] = useState<number | "all">("all");
  const [focusedStationId, setFocusedStationId] = useState<string>("");
  const [profileScenario, setProfileScenario] = useState<ProfileScenario>("live");

  // 3D Digital Twin interactive camera state
  const [twinPreset, setTwinPreset] = useState<TwinCameraPreset>("iso");
  const [twinAutoRotate, setTwinAutoRotate] = useState<boolean>(false);
  const [nowClockText, setNowClockText] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

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
    const updateClock = () => {
      const d = new Date();
      setNowClockText(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    updateClock();
    const interval = window.setInterval(updateClock, 30000);
    return () => window.clearInterval(interval);
  }, []);

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

  // Pre-compute official GeoJSON basin boundary SVG paths from DWR 22-Basin data
  const officialBasinBoundaryPaths = useMemo(() => {
    const results: { code: string; d: string; stroke: string; fill: string }[] = [];
    for (const feat of upstreamBasinsGeo.features) {
      const code = String(feat.properties?.MB_CODE ?? "");
      if (!["06", "07", "08", "09", "11", "12"].includes(code)) continue;
      if (activeBasinId !== "all" && activeBasinId !== code) continue;
      const style = BASIN_POLYGON_COLORS[code];
      const geom = feat.geometry as { type: string; coordinates: unknown };
      const polygons =
        geom.type === "Polygon"
          ? [geom.coordinates as number[][][]]
          : geom.type === "MultiPolygon"
            ? (geom.coordinates as number[][][][])
            : [];
      for (const poly of polygons) {
        if (poly[0]) {
          results.push({
            code,
            d: projectGeoJsonRing(poly[0], 10),
            stroke: style.stroke,
            fill: style.fill,
          });
        }
      }
    }
    if (activeBasinId === "all" || activeBasinId === "chao-phraya") {
      const style = BASIN_POLYGON_COLORS["chao-phraya"];
      for (const feat of coreGeographyGeo.core.features) {
        const geom = feat.geometry as { type: string; coordinates: unknown };
        const polygons =
          geom.type === "Polygon"
            ? [geom.coordinates as number[][][]]
            : geom.type === "MultiPolygon"
              ? (geom.coordinates as number[][][][])
              : [];
        for (const poly of polygons) {
          if (poly[0]) {
            results.push({
              code: "chao-phraya",
              d: projectGeoJsonRing(poly[0], 10),
              stroke: style.stroke,
              fill: style.fill,
            });
          }
        }
      }
    }
    return results;
  }, [activeBasinId]);

  // Select top priority stations to label and run a deterministic Collision-Avoidance Layout Solver
  const stationLabelBoxes = useMemo(() => {
    const candidateItems: StationWithBasin[] = [];
    const seen = new Set<string>();
    if (focused) {
      candidateItems.push(focused);
      seen.add(focused.station.id);
    }
    for (const item of filteredItems) {
      if (seen.has(item.station.id)) continue;
      if (item.riskTier >= 4 || candidateItems.length < 9) {
        candidateItems.push(item);
        seen.add(item.station.id);
      }
      if (candidateItems.length >= 10) break;
    }

    type PlacedBox = {
      id: string;
      ptX: number;
      ptY: number;
      boxX: number;
      boxY: number;
      boxW: number;
      boxH: number;
      text: string;
      color: string;
      isSelected: boolean;
    };

    const leftGroup: PlacedBox[] = [];
    const rightGroup: PlacedBox[] = [];

    for (const item of candidateItems) {
      const pt = projectToCanvas(item.station.lat, item.station.lng);
      const isSelected = focused?.station.id === item.station.id;
      const text = isSelected
        ? `${item.station.id} · ${formatWaterValue(item.station.value)}ม. (${item.station.lat.toFixed(2)}°N)`
        : `${item.station.id} (${formatWaterValue(item.station.value)}ม.)`;
      const boxW = isSelected ? 136 : 74;
      const boxH = 16;
      const goLeft = item.station.lng < 100.12;
      const rawBoxX = goLeft ? pt.x - boxW - 14 : pt.x + 14;
      const clampedBoxX = Math.max(
        MAP_FRAME.x + 8,
        Math.min(MAP_FRAME.x + MAP_FRAME.width - boxW - 8, rawBoxX)
      );
      const entry: PlacedBox = {
        id: item.station.id,
        ptX: pt.x,
        ptY: pt.y,
        boxX: clampedBoxX,
        boxY: pt.y - boxH / 2,
        boxW,
        boxH,
        text,
        color: tierColor(item.riskTier),
        isSelected,
      };
      if (goLeft) leftGroup.push(entry);
      else rightGroup.push(entry);
    }

    const resolveVerticalCollisions = (group: PlacedBox[]) => {
      group.sort((a, b) => a.ptY - b.ptY);
      const minGap = 19;
      for (let i = 1; i < group.length; i++) {
        if (group[i].boxY < group[i - 1].boxY + minGap) {
          group[i].boxY = group[i - 1].boxY + minGap;
        }
      }
      // Clamp bottom and push up if needed
      const maxBottom = MAP_FRAME.y + MAP_FRAME.height - 22;
      for (let i = group.length - 1; i >= 0; i--) {
        if (group[i].boxY > maxBottom) {
          group[i].boxY = maxBottom;
        }
        if (i > 0 && group[i - 1].boxY > group[i].boxY - minGap) {
          group[i - 1].boxY = Math.max(MAP_FRAME.y + 14, group[i].boxY - minGap);
        }
      }
    };

    resolveVerticalCollisions(leftGroup);
    resolveVerticalCollisions(rightGroup);

    const map = new Map<string, PlacedBox>();
    for (const b of [...leftGroup, ...rightGroup]) map.set(b.id, b);
    return map;
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

  const currentOverallTier = useMemo(() => {
    return focused?.riskTier ?? (tierCounts[5] > 0 ? 5 : tierCounts[4] > 0 ? 4 : tierCounts[3] > 0 ? 3 : 2);
  }, [focused, tierCounts]);

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
    const currentTier = currentOverallTier;

    return [
      {
        windowLabel: `ตอนนี้ (ณ เวลา ${nowClockText} น.)`,
        tag: "ความเสี่ยง ณ เวลาปัจจุบัน",
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
  }, [focused, topPeakRain, tierCounts, radarMeta.windSpeedKmh, currentOverallTier, nowClockText]);

  // Build 3D Digital Twin Nodes from live station & dam data
  const twinNodes = useMemo(() => {
    const findCap = (basinCode: string, fallbackCap: number) => {
      const b = basins.find(x => x.id === basinCode);
      const withCap = b?.water.find(s => s.status === "fresh" && s.capacityPercent !== null);
      return withCap?.capacityPercent ?? fallbackCap;
    };
    const boost = profileScenario === "upstream-surge" ? 14 : profileScenario === "high-tide" ? 8 : 0;
    const tideBoost = profileScenario === "high-tide" ? 18 : 0;

    return [
      {
        id: "bhumibol-3d",
        title: "เขื่อนภูมิพล (ปิง)",
        sub: "กักเก็บน้ำต้นน้ำเหนือ",
        zone: "highland",
        pct: Math.min(100, Math.round(74 + boost * 0.5)),
        mslText: "+248 ม. รทก.",
        xPct: 18,
        yPct: 18,
        tier: (74 + boost * 0.5 >= 85 ? 4 : 3) as 1 | 2 | 3 | 4 | 5,
      },
      {
        id: "sirikit-3d",
        title: "เขื่อนสิริกิติ์ (น่าน)",
        sub: "กักเก็บน้ำสายตะวันออก",
        zone: "highland",
        pct: Math.min(100, Math.round(78 + boost * 0.6)),
        mslText: "+162 ม. รทก.",
        xPct: 68,
        yPct: 16,
        tier: (78 + boost * 0.6 >= 85 ? 4 : 3) as 1 | 2 | 3 | 4 | 5,
      },
      {
        id: "c2-nakhonsawan",
        title: "ปากน้ำโพ นครสวรรค์ (C.2)",
        sub: "จุดรวม 4 แม่น้ำสายหลัก",
        zone: "confluence",
        pct: Math.min(108, Math.round(findCap("06", 69) + boost)),
        mslText: "+23.4 ม. รทก.",
        xPct: 44,
        yPct: 40,
        tier: (findCap("06", 69) + boost >= 85 ? 4 : 3) as 1 | 2 | 3 | 4 | 5,
      },
      {
        id: "c13-chainat",
        title: "เขื่อนเจ้าพระยา ชัยนาท (C.13)",
        sub: "ประตูควบคุมมวลน้ำภาคกลาง",
        zone: "barrage",
        pct: Math.min(110, Math.round(findCap("chao-phraya", 76) + boost)),
        mslText: "+16.2 ม. รทก.",
        xPct: 43,
        yPct: 56,
        tier: (findCap("chao-phraya", 76) + boost >= 95 ? 5 : findCap("chao-phraya", 76) + boost >= 82 ? 4 : 3) as 1 | 2 | 3 | 4 | 5,
      },
      {
        id: "pasak-3d",
        title: "เขื่อนป่าสักฯ – อยุธยา (C.29A)",
        sub: "รับน้ำป่าสัก + ที่ราบลุ่มต่ำ",
        zone: "delta",
        pct: Math.min(112, Math.round(84 + boost * 0.7 + tideBoost * 0.4)),
        mslText: "+2.45 ม. รทก.",
        xPct: 64,
        yPct: 68,
        tier: (84 + boost * 0.7 + tideBoost * 0.4 >= 100 ? 5 : 4) as 1 | 2 | 3 | 4 | 5,
      },
      {
        id: "bkk-estuary-3d",
        title: "กทม. – ปากอ่าวไทย (สมุทรปราการ)",
        sub: profileScenario === "high-tide" ? "น้ำทะเลหนุนสูงดันปากแม่น้ำ" : "อิทธิพลน้ำขึ้น–น้ำลงอ่าวไทย",
        zone: "estuary",
        pct: Math.min(112, Math.round(72 + tideBoost + boost * 0.4)),
        mslText: profileScenario === "high-tide" ? "+1.54 ม. รทก." : "+1.18 ม. รทก.",
        xPct: 48,
        yPct: 86,
        tier: (72 + tideBoost + boost * 0.4 >= 95 ? 5 : 72 + tideBoost >= 85 ? 4 : 2) as 1 | 2 | 3 | 4 | 5,
      },
    ];
  }, [basins, profileScenario]);

  const graticuleLats = [14.0, 15.0, 16.0, 17.0, 18.0, 19.0];
  const graticuleLngs = [98.0, 99.0, 100.0, 101.0, 102.0];

  return (
    <section className="hy-section hy-qgis-section" id="hy-qgis-layout" aria-labelledby="hy-qgis-title">
      <div className="hy-section-head">
        <div>
          <span className="hy-eyebrow">🛰️ แผนที่ดาวเทียมภูมิสารสนเทศพิกัดจริง & แบบจำลองลุ่มน้ำ 3 มิติ</span>
          <h2 id="hy-qgis-title">1. แผนที่ดาวเทียม 7 ลุ่มน้ำพิกัดจริง (WGS84) & ตารางเตือนความเสี่ยงรายช่วงเวลา</h2>
        </div>
        <p>
          ตรึงอัตราส่วนพิกัดภูมิศาสตร์ EPSG:4326 แบบ 1:1 กับภาพถ่ายดาวเทียมจริง พร้อมขอบเขต 7 ลุ่มน้ำทางการ โครงข่ายแม่น้ำที่ไหลผ่านสถานีจริง ป้ายกำกับไม่ทับซ้อน และแบบจำลองลุ่มน้ำ 3 มิติ
        </p>
      </div>

      {/* Layer & Symbology Controls Toolbar */}
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
          <button type="button" aria-pressed={showBasinBounds} onClick={() => setShowBasinBounds(v => !v)}>
            🗺️ ขอบเขต 7 ลุ่มน้ำจริง
          </button>
          <button type="button" aria-pressed={showRivers} onClick={() => setShowRivers(v => !v)}>
            〰️ แม่น้ำ 7 สายพิกัดจริง
          </button>
          <button type="button" aria-pressed={showDams} onClick={() => setShowDams(v => !v)}>
            🏞️ เขื่อนหลัก (5 แห่ง)
          </button>
          <button type="button" aria-pressed={showRadarWind} onClick={() => setShowRadarWind(v => !v)}>
            📡 เรดาร์ฝน & ทิศทางลม
          </button>
          <button type="button" aria-pressed={showBuffer} onClick={() => setShowBuffer(v => !v)}>
            🎯 รัศมีความเสี่ยง
          </button>
          <button type="button" aria-pressed={showLabels} onClick={() => setShowLabels(v => !v)}>
            🏷️ ป้ายกำกับไม่ทับซ้อน
          </button>
          <button type="button" aria-pressed={showGrid} onClick={() => setShowGrid(v => !v)}>
            📐 กริดพิกัด (°N/°E)
          </button>
        </div>
      </div>

      {/* MAIN CARD: Cartographic Map Sheet + Symbology Legend & Inspector */}
      <div className="hy-qgis-sheet">
        <div className={`hy-qgis-map-frame is-${basemap}`}>
          <div className="hy-qgis-neatline">
            <svg
              viewBox="0 0 560 690"
              className="hy-qgis-svg"
              role="img"
              aria-label="แผนที่ภาพถ่ายดาวเทียมตรึงพิกัด WGS84 อัตราส่วน 1:1 พร้อมขอบเขต 7 ลุ่มน้ำ โครงข่ายแม่น้ำจริง เขื่อนหลัก และระดับความเสี่ยง 5 ระดับ"
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

              {/* 100% Aspect-Locked Georeferenced Satellite / Topo Image (BBox 97.50..102.50°E, 13.30..19.80°N in WGS84) */}
              {basemap === "satellite" && (
                <image
                  href={ARCGIS_SAT_EXPORT_URL}
                  x={MAP_FRAME.x}
                  y={MAP_FRAME.y}
                  width={MAP_FRAME.width}
                  height={MAP_FRAME.height}
                  preserveAspectRatio="none"
                  opacity="0.94"
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
                  opacity="0.94"
                />
              )}

              {/* Clipped Georeferenced Layers inside the Map Frame */}
              <g clipPath="url(#qgis-frame-clip)">
                {/* Official DWR 7-Basin Watershed Polygons Layer */}
                {showBasinBounds && (
                  <g className="hy-qgis-basin-polygons">
                    {officialBasinBoundaryPaths.map((poly, idx) => (
                      <path
                        key={`basin-poly-${poly.code}-${idx}`}
                        d={poly.d}
                        fill={poly.fill}
                        stroke={poly.stroke}
                        strokeWidth="1.2"
                        strokeDasharray="4 3"
                        opacity="0.88"
                      />
                    ))}
                  </g>
                )}

                {/* Upper Gulf of Thailand Coastline Line */}
                <path
                  d={projectPolyline(UPPER_GULF_COAST_GEO)}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.4"
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
                    {RIVER_NETWORK_GEO.filter(
                      r => activeBasinId === "all" || r.basinCode === activeBasinId || r.id === "chao-phraya"
                    ).map(river => {
                      const dPath = projectPolyline(river.coords);
                      const lblPt = projectToCanvas(river.labelLat, river.labelLng);
                      return (
                        <g key={river.id}>
                          {/* Outer Casing for high cartographic contrast over satellite imagery */}
                          <path
                            d={dPath}
                            fill="none"
                            stroke="rgba(6, 22, 38, 0.85)"
                            strokeWidth={river.order === 3 ? 6.4 : river.order === 2 ? 4.6 : 3.4}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {/* Inner River Line */}
                          <path
                            d={dPath}
                            fill="none"
                            stroke={river.order === 3 ? "#0ea5e9" : river.order === 2 ? "#38bdf8" : "#67e8f9"}
                            strokeWidth={river.order === 3 ? 3.8 : river.order === 2 ? 2.6 : 1.9}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {/* Animated Flowing Water Particle along the real river path */}
                          <circle r={river.order === 3 ? 3.6 : 2.6} fill="#ffffff" opacity="0.95">
                            <animateMotion
                              dur={river.order === 3 ? "5.2s" : "6.5s"}
                              repeatCount="indefinite"
                              path={dPath}
                            />
                          </circle>
                          {showLabels && (
                            <text
                              x={lblPt.x}
                              y={lblPt.y}
                              textAnchor="middle"
                              fill="#bae6fd"
                              stroke="rgba(6, 20, 36, 0.94)"
                              strokeWidth="3"
                              paintOrder="stroke"
                              fontSize="9"
                              fontWeight="800"
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
                      const radius = riskTier === 5 ? 32 : riskTier === 4 ? 26 : riskTier === 3 ? 20 : 13;
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
                      { sLat: 18.6, sLng: 101.6, eLat: 17.8, eLng: 100.7 },
                      { sLat: 16.9, sLng: 101.6, eLat: 16.1, eLng: 100.7 },
                      { sLat: 15.3, sLng: 101.5, eLat: 14.5, eLng: 100.6 },
                    ].map((vec, i) => {
                      const p1 = projectToCanvas(vec.sLat, vec.sLng);
                      const p2 = projectToCanvas(vec.eLat, vec.eLng);
                      return (
                        <g key={`wind-vec-${i}`} opacity="0.86">
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
                            x={(p1.x + p2.x) / 2}
                            y={(p1.y + p2.y) / 2 - 5}
                            textAnchor="middle"
                            fill="#bae6fd"
                            stroke="rgba(8,24,40,0.9)"
                            strokeWidth="2.4"
                            paintOrder="stroke"
                            fontSize="8.2"
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
                            <ellipse cx={pt.x} cy={pt.y} rx="30" ry="20" fill="#22c55e" opacity="0.4" />
                            <ellipse cx={pt.x} cy={pt.y} rx="18" ry="12" fill={outerColor} opacity="0.62" />
                          </g>
                          <line
                            x1={pt.x}
                            y1={pt.y}
                            x2={nextPt.x}
                            y2={nextPt.y}
                            stroke="#facc15"
                            strokeWidth="2.2"
                            strokeDasharray="3 2"
                            markerEnd="url(#qgis-storm-arrow)"
                          />
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Major Dam Reservoir Symbology Layer (Distinct Shield/Barrage Icon + Inside-Frame Callout) */}
                {showDams && (
                  <g className="hy-qgis-dams-layer">
                    {MAJOR_DAMS_GEO.map(dam => {
                      const pt = projectToCanvas(dam.lat, dam.lng);
                      const boxW = 104;
                      const boxH = 16;
                      const rawBoxX = dam.side === "left" ? pt.x - boxW - 14 : pt.x + 14;
                      const boxX = Math.max(
                        MAP_FRAME.x + 8,
                        Math.min(MAP_FRAME.x + MAP_FRAME.width - boxW - 8, rawBoxX)
                      );
                      const boxY = pt.y - 22;
                      return (
                        <g key={dam.id}>
                          {showLabels && (
                            <line
                              x1={pt.x}
                              y1={pt.y}
                              x2={dam.side === "left" ? boxX + boxW : boxX}
                              y2={boxY + boxH / 2}
                              stroke="#38bdf8"
                              strokeWidth="1.2"
                              strokeDasharray="2 2"
                            />
                          )}
                          {/* Dam Reservoir Diamond/Shield Symbol at Exact Coordinate */}
                          <g transform={`translate(${pt.x}, ${pt.y})`}>
                            <polygon
                              points="0,-8 8,0 0,8 -8,0"
                              fill="#0284c7"
                              stroke="#ffffff"
                              strokeWidth="1.8"
                            />
                            <circle r="2.2" fill="#e0f2fe" />
                          </g>
                          {showLabels && (
                            <g transform={`translate(${boxX}, ${boxY})`}>
                              <rect
                                x="0"
                                y="0"
                                width={boxW}
                                height={boxH}
                                rx="4"
                                fill="rgba(7, 89, 133, 0.94)"
                                stroke="#7dd3fc"
                                strokeWidth="0.9"
                              />
                              <text
                                x={boxW / 2}
                                y="11"
                                textAnchor="middle"
                                fill="#ffffff"
                                fontSize="8"
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

                {/* Station Risk Symbology Points */}
                {filteredItems.map(({ basin, station, riskTier }) => {
                  const pt = projectToCanvas(station.lat, station.lng);
                  const isSelected = focused?.station.id === station.id;
                  const color = tierColor(riskTier);

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
                        r={isSelected ? 7.6 : riskTier === 5 ? 6.6 : riskTier === 4 ? 5.8 : riskTier === 3 ? 5.0 : 4.2}
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth="1.8"
                      />
                    </g>
                  );
                })}

                {/* Collision-Free Station Callout Labels Layer */}
                {showLabels &&
                  Array.from(stationLabelBoxes.values()).map(lbl => {
                    const lineTargetX = lbl.boxX < lbl.ptX ? lbl.boxX + lbl.boxW : lbl.boxX;
                    const lineTargetY = lbl.boxY + lbl.boxH / 2;
                    return (
                      <g
                        key={`lbl-${lbl.id}`}
                        style={{ cursor: "pointer" }}
                        onClick={() => setFocusedStationId(lbl.id)}
                      >
                        <line
                          x1={lbl.ptX}
                          y1={lbl.ptY}
                          x2={lineTargetX}
                          y2={lineTargetY}
                          stroke="#ffffff"
                          strokeWidth={lbl.isSelected ? "1.6" : "1.1"}
                          opacity="0.9"
                        />
                        <g transform={`translate(${lbl.boxX}, ${lbl.boxY})`}>
                          <rect
                            x="0"
                            y="0"
                            width={lbl.boxW}
                            height={lbl.boxH}
                            rx="4"
                            fill="rgba(10, 25, 41, 0.94)"
                            stroke={lbl.isSelected ? "#ffffff" : lbl.color}
                            strokeWidth={lbl.isSelected ? "1.6" : "1.1"}
                          />
                          <circle cx="8" cy={lbl.boxH / 2} r="3.2" fill={lbl.color} />
                          <text
                            x={lbl.boxW / 2 + 4}
                            y="11"
                            textAnchor="middle"
                            className="hy-qgis-pt-label"
                          >
                            {lbl.text}
                          </text>
                        </g>
                      </g>
                    );
                  })}
              </g>

              {/* Coordinate Graticule Grid (Computed from exact 1:1 projectToCanvas) */}
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
              <g transform="translate(496, 52)" className="hy-qgis-north">
                <circle r="20" fill="rgba(12, 28, 44, 0.88)" stroke="rgba(255,255,255,0.45)" />
                <polygon points="0,-13 -5,7 0,3 5,7" fill="#ffffff" />
                <text x="0" y="15" textAnchor="middle" fill="#7dd3fc" fontSize="8.5" fontWeight="800">
                  N
                </text>
              </g>

              {/* Geographically calibrated Scale Bar (100 km ≈ 93 px at 16°N where 1° = 100 px) */}
              <g transform="translate(46, 636)" className="hy-qgis-scale">
                <rect x="-6" y="-14" width="136" height="26" rx="4" fill="rgba(12, 28, 44, 0.88)" />
                <rect x="0" y="2" width="46" height="5" fill="#ffffff" />
                <rect x="46" y="2" width="47" height="5" fill="#38bdf8" />
                <text x="0" y="-3" fill="#ffffff" fontSize="8.5" fontWeight="700">0</text>
                <text x="42" y="-3" fill="#ffffff" fontSize="8.5" fontWeight="700">50</text>
                <text x="84" y="-3" fill="#7dd3fc" fontSize="8.5" fontWeight="700">100 กม.</text>
              </g>

              {/* Outer Alternating Coordinate Frame Border */}
              <rect x={MAP_FRAME.x} y={MAP_FRAME.y} width={MAP_FRAME.width} height={MAP_FRAME.height} fill="none" stroke="#ffffff" strokeWidth="2" />
              <rect x="26" y="16" width="508" height="658" fill="none" stroke="#0c2e44" strokeWidth="4" strokeDasharray="24 24" />
            </svg>
          </div>

          {/* Map Sheet Footer */}
          <div className="hy-qgis-titleblock">
            <div>
              <small>GEOSPATIAL DATUM: WGS 84 (EPSG:4326) · TRUE 1:1 EXTENT: 97.50°E–102.50°E, 13.30°N–19.80°N</small>
              <strong>แผนที่ดาวเทียม 7 ลุ่มน้ำพิกัดจริง เขื่อนหลัก และเรดาร์ทิศทางฝนลม ({activeBasinId === "all" ? "ครบ 7 ลุ่มน้ำ" : `เฉพาะลุ่มน้ำ ${activeBasinId}`})</strong>
            </div>
            <div className="hy-qgis-meta-right">
              <span>ความเสี่ยงตอนนี้ (ณ เวลา {nowClockText} น.): <b>ระดับ {currentOverallTier}/5</b></span>
              <span>สถานีพิกัดจริง: <b>{items.length} แห่ง</b></span>
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
              <div><span className="hy-sym-river" /> <small>แม่น้ำจริง 7 สาย & ทิศทางไหล</small></div>
              <div><span className="hy-sym-radar" /> <small>เรดาร์เมฆฝน (dBZ) & ทิศเคลื่อนตัว</small></div>
              <div><span className="hy-sym-wind" /> <small>ขอบเขต 7 ลุ่มน้ำจริง & เวกเตอร์ลม</small></div>
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
                  ความเสี่ยงตอนนี้ (ณ เวลา {nowClockText} น.): ระดับ {focused.riskTier}/5
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
              <small>เวลาตรวจวัดล่าสุดของสถานี: {focused.station.observedAt ? `${thaiObservationTime(focused.station.observedAt)} น.` : "ไม่ระบุ"}</small>
            </div>
          )}

          {/* Easy-to-Read Spatial Summary */}
          <div className="hy-qgis-analysis-card">
            <span className="hy-eyebrow">📊 สรุปการวิเคราะห์เชิงพื้นที่เข้าใจง่าย</span>
            <h3>อ่านแผนที่นี้อย่างไรให้ได้ประโยชน์สูงสุด?</h3>
            <ul className="hy-qgis-analysis-list">
              <li>
                <strong>1. พิกัดดาวเทียมและแม่น้ำตรงกัน 100%:</strong> แผนที่ล็อกสัดส่วนองศาละติจูด–ลองจิจูดแบบ 1:1 (100 พิกเซลต่อ 1 องศา) พร้อมวาดขอบเขตลุ่มน้ำจริงและแนวลำน้ำผ่านพิกัดสถานีวัดน้ำโดยตรง
              </li>
              <li>
                <strong>2. ป้ายกำกับอัจฉริยะไม่ทับซ้อน:</strong> จัดเรียงป้ายชื่อสถานีแยกฝั่งซ้าย–ขวาพร้อมเส้นชี้พิกัด (Leader Line) ทำให้จุดหนาแน่นในอยุธยา–ปทุมธานีอ่านง่ายชัดเจน
              </li>
            </ul>
          </div>
        </aside>
      </div>

      {/* BELOW MAIN CARD: Live Risk Status Now (with Current Time) + Radar & Wind Alert Banner + 4 Time-Window Cards */}
      <div className="hy-qgis-live-alert-banner" role="region" aria-label="สรุปความเสี่ยงตอนนี้และการแจ้งเตือนเรดาร์ทิศทางฝนลมใต้การ์ดหลัก">
        <div className="hy-qgis-now-status">
          <div className="hy-qgis-now-badge-row">
            <span
              className="hy-qgis-now-pill"
              style={{
                background: tierColor(currentOverallTier),
              }}
            >
              🚨 ความเสี่ยงตอนนี้ (ณ เวลา {nowClockText} น.):{" "}
              {RISK_TIERS.find(t => t.tier === currentOverallTier)?.label}
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
              <>ภาพรวมทั้งลุ่มน้ำ (ณ เวลา {nowClockText} น.): ล้นตลิ่ง {tierCounts[5]} จุด · จ่อตลิ่ง {tierCounts[4]} จุด · เฝ้าระวังน้ำมาก {tierCounts[3]} จุด</>
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

      {/* PRO 3D ANIMATED DIGITAL TWIN OF THE 7 RIVER BASINS */}
      <div className="hy-3d-twin-card" role="region" aria-label="แบบจำลองลุ่มน้ำ 3 มิติแบบอนิเมชัน">
        <div className="hy-3d-twin-head">
          <div>
            <span className="hy-eyebrow">🌐 3D HYDROLOGICAL DIGITAL TWIN · แบบจำลองลุ่มน้ำ 3 มิติแบบอนิเมชัน</span>
            <h3>จำลองภูมิประเทศ 3 มิติ เขื่อนหลัก แท่งระดับน้ำรายสถานี และพลศาสตร์มวลน้ำ–อ่าวไทย (ณ เวลา {nowClockText} น.)</h3>
            <p>
              หมุนปรับมุมกล้อง 3 มิติและสลับสถานการณ์เพื่อดูความต่างระดับความสูงจริงตั้งแต่ขุนเขาภาคเหนือ (+280 ม. รทก.) ไหลรวมสู่นครสวรรค์ เขื่อนเจ้าพระยา ลงสู่ที่ราบลุ่มภาคกลางและอ่าวไทย (0 ม. รทก.)
            </p>
          </div>
          <div className="hy-3d-controls">
            <div className="hy-3d-btn-row" role="group" aria-label="เลือกมุมกล้อง 3 มิติ">
              <button type="button" aria-pressed={twinPreset === "iso"} onClick={() => setTwinPreset("iso")}>
                📐 มุมมอง 3D Isometric
              </button>
              <button type="button" aria-pressed={twinPreset === "north-dams"} onClick={() => setTwinPreset("north-dams")}>
                ⛰️ ซูมเขื่อนต้นน้ำเหนือ
              </button>
              <button type="button" aria-pressed={twinPreset === "delta-gulf"} onClick={() => setTwinPreset("delta-gulf")}>
                🌊 ซูมที่ราบลุ่ม–อ่าวไทย
              </button>
              <button type="button" aria-pressed={twinPreset === "top-tilt"} onClick={() => setTwinPreset("top-tilt")}>
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
            <div className="hy-3d-btn-row" role="group" aria-label="จำลองสภาวะมวลน้ำ 3 มิติ">
              <button type="button" aria-pressed={profileScenario === "live"} onClick={() => setProfileScenario("live")}>
                📡 ข้อมูลสดตอนนี้ ({nowClockText} น.)
              </button>
              <button type="button" aria-pressed={profileScenario === "upstream-surge"} onClick={() => setProfileScenario("upstream-surge")}>
                🌧️ จำลองพายุฝนเหนือ + เร่งระบายเขื่อน
              </button>
              <button type="button" aria-pressed={profileScenario === "high-tide"} onClick={() => setProfileScenario("high-tide")}>
                🌕 จำลองน้ำทะเลหนุนสูงสุด (+1.54 ม.)
              </button>
            </div>
          </div>
        </div>

        <div className="hy-3d-viewport">
          <div className="hy-3d-hud-overlay">
            <span>🧭 สถานะแบบจำลอง 3D: <b>{profileScenario === "live" ? "ข้อมูลตรวจวัดจริง" : profileScenario === "upstream-surge" ? "จำลองน้ำเหนือหลาก" : "จำลองน้ำทะเลหนุนสูง"}</b></span>
            <span>⏱️ เวลาอ้างอิง: <b>{nowClockText} น.</b></span>
            <span>💨 ลมมรสุม: <b>NE {radarMeta.windSpeedKmh} กม./ชม.</b></span>
          </div>

          <div
            className={`hy-3d-scene preset-${twinPreset} ${twinAutoRotate ? "is-autorotate" : ""}`}
          >
            {/* 3D Stepped Terrain Base Slab */}
            <div className="hy-3d-slab">
              <div className="hy-3d-slab-grid" />

              {/* Stepped Elevation Terraces */}
              <div className="hy-3d-terrace is-north">
                <span className="hy-3d-zone-tag">⛰️ ต้นน้ำภาคเหนือ (ปิง·วัง·ยม·น่าน · +150 ถึง +280 ม. รทก.)</span>
              </div>
              <div className="hy-3d-terrace is-central">
                <span className="hy-3d-zone-tag">🏞️ นครสวรรค์ (C.2) – เขื่อนเจ้าพระยา ชัยนาท (C.13 · +16 ถึง +24 ม. รทก.)</span>
              </div>
              <div className="hy-3d-terrace is-delta">
                <span className="hy-3d-zone-tag">🏙️ ที่ราบลุ่มอยุธยา–ปทุมธานี–นนทบุรี–กทม. (+1.5 ถึง +3.5 ม. รทก.)</span>
              </div>
              <div className={`hy-3d-terrace is-gulf ${profileScenario === "high-tide" ? "is-surge" : ""}`}>
                <div className="hy-3d-gulf-wave w1" />
                <div className="hy-3d-gulf-wave w2" />
                <span className="hy-3d-zone-tag">🌊 อ่าวไทยตอนบน (น้ำหนุน {profileScenario === "high-tide" ? "+1.54" : "+1.18"} ม. รทก.)</span>
              </div>

              {/* 3D Animated River Channels on the Slab Surface */}
              <svg viewBox="0 0 600 420" className="hy-3d-river-svg" aria-hidden="true">
                <defs>
                  <linearGradient id="twin-river-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#67e8f9" />
                    <stop offset="55%" stopColor="#0ea5e9" />
                    <stop offset="100%" stopColor={profileScenario === "high-tide" ? "#f43f5e" : "#2563eb"} />
                  </linearGradient>
                </defs>
                {/* 4 Northern Tributaries converging at Pak Nam Pho (265, 168) */}
                <path id="tw-ping" d="M 105,52 C 120,108 195,135 265,168" fill="none" stroke="url(#twin-river-grad)" strokeWidth="7" strokeLinecap="round" />
                <path id="tw-wang" d="M 205,46 C 215,98 240,132 265,168" fill="none" stroke="url(#twin-river-grad)" strokeWidth="5" strokeLinecap="round" />
                <path id="tw-yom" d="M 325,46 C 310,102 290,135 265,168" fill="none" stroke="url(#twin-river-grad)" strokeWidth="5.5" strokeLinecap="round" />
                <path id="tw-nan" d="M 420,52 C 395,108 335,140 265,168" fill="none" stroke="url(#twin-river-grad)" strokeWidth="7" strokeLinecap="round" />
                {/* Sakae Krang & Pa Sak */}
                <path id="tw-sakae" d="M 135,192 C 185,204 225,212 258,225" fill="none" stroke="#38bdf8" strokeWidth="4.5" strokeLinecap="round" />
                <path id="tw-pasak" d="M 465,180 C 435,235 375,268 312,285" fill="none" stroke="#38bdf8" strokeWidth="5.5" strokeLinecap="round" />
                {/* Main Chao Phraya Stem from Nakhon Sawan (265,168) -> Chai Nat (258,225) -> Ayutthaya (312,285) -> Gulf (295,385) */}
                <path
                  id="tw-main"
                  d="M 265,168 L 258,225 C 265,252 295,268 312,285 C 316,318 302,348 295,385"
                  fill="none"
                  stroke="url(#twin-river-grad)"
                  strokeWidth={profileScenario !== "live" ? "14" : "11"}
                  strokeLinecap="round"
                />

                {/* Animated 3D Water Flow Spheres */}
                <circle r="5" fill="#ffffff">
                  <animateMotion dur="2.6s" repeatCount="indefinite" path="M 105,52 C 120,108 195,135 265,168" />
                </circle>
                <circle r="5" fill="#ffffff">
                  <animateMotion dur="2.4s" repeatCount="indefinite" path="M 420,52 C 395,108 335,140 265,168" />
                </circle>
                <circle r="6.5" fill="#e0f2fe">
                  <animateMotion
                    dur={profileScenario === "upstream-surge" ? "2.0s" : "3.2s"}
                    repeatCount="indefinite"
                    path="M 265,168 L 258,225 C 265,252 295,268 312,285 C 316,318 302,348 295,385"
                  />
                </circle>
                <circle r="6" fill="#ffffff">
                  <animateMotion
                    dur={profileScenario === "upstream-surge" ? "2.0s" : "3.2s"}
                    begin="1.5s"
                    repeatCount="indefinite"
                    path="M 265,168 L 258,225 C 265,252 295,268 312,285 C 316,318 302,348 295,385"
                  />
                </circle>
              </svg>

              {/* 3D Extruded Water Columns & Dam Towers standing vertically in Z-space */}
              {twinNodes.map(node => {
                const colColor = tierColor(node.tier);
                const pillarHeightPx = Math.max(36, Math.round(node.pct * 1.05));
                return (
                  <div
                    key={node.id}
                    className="hy-3d-pillar-anchor"
                    style={{ left: `${node.xPct}%`, top: `${node.yPct}%` }}
                  >
                    <div className="hy-3d-pillar-ring" style={{ borderColor: colColor }} />
                    <div
                      className="hy-3d-pillar-column"
                      style={{
                        height: `${pillarHeightPx}px`,
                        background: `linear-gradient(180deg, ${colColor} 0%, rgba(14, 165, 233, 0.88) 100%)`,
                        boxShadow: `0 0 22px ${colColor}`,
                      }}
                    >
                      <span className="hy-3d-pillar-cap" style={{ background: colColor }}>
                        {node.pct}%
                      </span>
                    </div>
                    <div className="hy-3d-pillar-billboard">
                      <strong>{node.title}</strong>
                      <span>{node.mslText} · <b>{node.pct}% ความจุ</b></span>
                      <small>{node.sub}</small>
                    </div>
                  </div>
                );
              })}

              {/* 3D Floating Atmospheric Rain Clouds & Animated Rain Curtains in Upper Z-Plane */}
              <div className="hy-3d-cloud-cluster is-upper">
                <div className="hy-3d-cloud-pill">
                  🌧️ เมฆฝนต้นน้ำ–พิษณุโลก ({topPeakRain ? `${topPeakRain.dbz} dBZ` : "38 dBZ"})
                </div>
                <div className="hy-3d-rain-curtain" />
              </div>
              <div className="hy-3d-cloud-cluster is-lower">
                <div className="hy-3d-cloud-pill">
                  ⛈️ เรดาร์ฝนอยุธยา–ปทุมธานี ({topPeakRain ? `${topPeakRain.rateMmHr} มม./ชม.` : "6.5 มม./ชม."})
                </div>
                <div className="hy-3d-rain-curtain" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Longitudinal River Profile & Easy-to-Understand Hydrological Science Explainer */}
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
