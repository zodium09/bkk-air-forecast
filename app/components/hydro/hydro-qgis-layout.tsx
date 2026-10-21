"use client";

import { useMemo, useState } from "react";
import type { HydroBasin } from "../../lib/hydro/model";
import { formatWaterValue, waterBankDifference, waterRisk, type WaterStation } from "../../lib/water-levels";
import { thaiObservationTime } from "../../lib/observation-time";

type BasemapStyle = "satellite" | "topo" | "dark";

interface StationWithBasin {
  basin: HydroBasin;
  station: WaterStation;
  riskTier: 1 | 2 | 3 | 4 | 5;
}

const RISK_TIERS = [
  {
    tier: 5 as const,
    label: "ระดับ 5 · วิกฤต / ล้นตลิ่ง",
    criteria: "> 100% ความจุลำน้ำ หรือสูงกว่าตลิ่ง",
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.22)",
    desc: "น้ำแตะหรือเกินเกณฑ์ตลิ่งของสถานี พื้นที่ลุ่มต่ำริมน้ำนอกคันกั้นน้ำเสี่ยงน้ำเอ่อล้น",
  },
  {
    tier: 4 as const,
    label: "ระดับ 4 · เสี่ยงสูง (จ่อตลิ่ง)",
    criteria: "85% – 100% ของความจุลำน้ำ",
    color: "#f97316",
    bg: "rgba(249, 115, 22, 0.22)",
    desc: "ระดับน้ำสูงใกล้ขอบตลิ่ง ต้องเฝ้าระวังการระบายน้ำและฝนตกเพิ่มในพื้นที่",
  },
  {
    tier: 3 as const,
    label: "ระดับ 3 · เฝ้าระวังน้ำมาก",
    criteria: "70% – 85% ของความจุลำน้ำ",
    color: "#eab308",
    bg: "rgba(234, 179, 8, 0.22)",
    desc: "ปริมาณน้ำในลำน้ำค่อนข้างมาก แต่ยังต่ำกว่าระดับตลิ่ง",
  },
  {
    tier: 2 as const,
    label: "ระดับ 2 · ปกติค่อนข้างน้อย/ปานกลาง",
    criteria: "30% – 70% ของความจุลำน้ำ",
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.20)",
    desc: "ระดับน้ำอยู่ในเกณฑ์ปกติ การไหลระบายในลำน้ำคล่องตัว",
  },
  {
    tier: 1 as const,
    label: "ระดับ 1 · น้ำน้อย / เฝ้าระวังแล้ง",
    criteria: "< 30% ของความจุลำน้ำ",
    color: "#38bdf8",
    bg: "rgba(56, 189, 248, 0.20)",
    desc: "ระดับน้ำในลำน้ำน้อยกว่าปกติ ควรติดตามแผนการจัดสรรน้ำ",
  },
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

// Convert lat/lng (Chao Phraya basin extent: lat 13.4..19.5, lng 98.4..101.6) to SVG 640x520
function projectToCanvas(lat: number, lng: number): { x: number; y: number } {
  const minLat = 13.35;
  const maxLat = 19.35;
  const minLng = 98.5;
  const maxLng = 101.5;
  const x = 44 + ((lng - minLng) / (maxLng - minLng)) * 552;
  const y = 486 - ((lat - minLat) / (maxLat - minLat)) * 448;
  return {
    x: Math.max(36, Math.min(604, x)),
    y: Math.max(32, Math.min(492, y)),
  };
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
  const [showRivers, setShowRivers] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [activeTierFilter, setActiveTierFilter] = useState<number | "all">("all");
  const [focusedStationId, setFocusedStationId] = useState<string>("");

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

  const topPeakRain = useMemo(() => {
    const rains = scopedBasins
      .flatMap(b => b.rain.map(r => ({ basinName: b.name, ...r })))
      .sort((a, b) => b.mm - a.mm);
    return rains[0] ?? null;
  }, [scopedBasins]);

  return (
    <section className="hy-section hy-qgis-section" id="hy-qgis-layout" aria-labelledby="hy-qgis-title">
      <div className="hy-section-head">
        <div>
          <span className="hy-eyebrow">🛰️ QGIS Cartographic Risk Layout · แผนที่วิเคราะห์ความเสี่ยงเชิงพื้นที่</span>
          <h2 id="hy-qgis-title">แผนที่ภาพถ่ายดาวเทียมและโซนระดับความเสี่ยง 5 ระดับ (QGIS Print Composer)</h2>
        </div>
        <p>จำลองแผ่นงานแผนที่มาตรฐาน GIS พร้อมเส้นกริดพิกัด เข็มทิศ มาตราส่วน ชั้นรัศมีความเสี่ยง และคำอธิบายวิเคราะห์ประกอบ</p>
      </div>

      {/* Layer Controls Toolbar */}
      <div className="hy-qgis-toolbar">
        <div className="hy-qgis-btn-group" role="group" aria-label="เลือกพื้นหลังแผนที่ภาพถ่าย">
          <span className="hy-qgis-group-label">พื้นหลัง (Basemap):</span>
          <button type="button" aria-pressed={basemap === "satellite"} onClick={() => setBasemap("satellite")}>
            🛰️ ภาพถ่ายดาวเทียม (Satellite)
          </button>
          <button type="button" aria-pressed={basemap === "topo"} onClick={() => setBasemap("topo")}>
            ⛰️ ภูมิประเทศ (Topo Relief)
          </button>
          <button type="button" aria-pressed={basemap === "dark"} onClick={() => setBasemap("dark")}>
            🌑 แผนที่วิเคราะห์มืด (Dark GIS)
          </button>
        </div>

        <div className="hy-qgis-btn-group" role="group" aria-label="เปิดปิดชั้นข้อมูล GIS">
          <span className="hy-qgis-group-label">ชั้นวิเคราะห์ (Layers):</span>
          <button type="button" aria-pressed={showBuffer} onClick={() => setShowBuffer(v => !v)}>
            🎯 โซนรัศมีความเสี่ยง (IDW Buffer)
          </button>
          <button type="button" aria-pressed={showRivers} onClick={() => setShowRivers(v => !v)}>
            〰️ เส้นลำน้ำหลัก
          </button>
          <button type="button" aria-pressed={showLabels} onClick={() => setShowLabels(v => !v)}>
            🏷️ ป้ายรหัสสถานี
          </button>
          <button type="button" aria-pressed={showGrid} onClick={() => setShowGrid(v => !v)}>
            📐 กริดพิกัด (Graticule)
          </button>
        </div>
      </div>

      {/* QGIS Print Sheet Container */}
      <div className="hy-qgis-sheet">
        {/* Left: Cartographic Map Frame with Neatline & Graticule */}
        <div className={`hy-qgis-map-frame is-${basemap}`}>
          <div className="hy-qgis-neatline">
            <svg
              viewBox="0 0 640 520"
              className="hy-qgis-svg"
              role="img"
              aria-label="แผนที่วิเคราะห์ความเสี่ยงระดับน้ำลุ่มเจ้าพระยาสไตล์ QGIS"
            >
              <defs>
                {/* Satellite Terrain Texture & Elevation Shading */}
                <radialGradient id="qgis-sat-north" cx="45%" cy="22%" r="55%">
                  <stop offset="0%" stopColor="#143d29" />
                  <stop offset="55%" stopColor="#1c4c34" />
                  <stop offset="100%" stopColor="#0f291e" />
                </radialGradient>
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
                  <feGaussianBlur stdDeviation="16" />
                </filter>
              </defs>

              {/* Basemap Canvas */}
              <rect
                x="24"
                y="20"
                width="592"
                height="480"
                fill={
                  basemap === "satellite"
                    ? "url(#qgis-sat-base)"
                    : basemap === "topo"
                      ? "url(#qgis-topo-base)"
                      : "url(#qgis-dark-base)"
                }
              />

              {/* Real Satellite Mosaic Tiles from ArcGIS World Imagery (when satellite mode is active) */}
              {basemap === "satellite" && (
                <g opacity="0.86">
                  <image
                    href="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/6/28/49"
                    x="24"
                    y="20"
                    width="296"
                    height="240"
                    preserveAspectRatio="none"
                  />
                  <image
                    href="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/6/28/50"
                    x="320"
                    y="20"
                    width="296"
                    height="240"
                    preserveAspectRatio="none"
                  />
                  <image
                    href="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/6/29/49"
                    x="24"
                    y="260"
                    width="296"
                    height="240"
                    preserveAspectRatio="none"
                  />
                  <image
                    href="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/6/29/50"
                    x="320"
                    y="260"
                    width="296"
                    height="240"
                    preserveAspectRatio="none"
                  />
                </g>
              )}

              {/* Upper Gulf of Thailand Coastline & Floodplain Polygon */}
              <path
                d="M160,65 C135,140 165,240 215,310 C235,345 245,420 250,470 L395,470 C405,410 420,335 415,270 C410,185 390,105 350,65 Z"
                fill={basemap === "topo" ? "rgba(16, 185, 129, 0.08)" : "rgba(56, 189, 248, 0.09)"}
                stroke={basemap === "topo" ? "#059669" : "#38bdf8"}
                strokeWidth="1.2"
                strokeDasharray="6 4"
              />

              {/* Gulf of Thailand Sea Polygon at bottom */}
              <path
                d="M24,475 Q180,458 310,468 T616,478 L616,500 L24,500 Z"
                fill="rgba(2, 132, 199, 0.65)"
              />
              <text x="320" y="492" textAnchor="middle" className="hy-qgis-sea-label">
                อ่าวไทยตอนบน (UPPER GULF OF THAILAND)
              </text>

              {/* Coordinate Graticule Grid (Lines of Latitude & Longitude) */}
              {showGrid && (
                <g className="hy-qgis-graticule">
                  {[
                    { y: 78, label: "18°30'N" },
                    { y: 158, label: "17°15'N" },
                    { y: 238, label: "16°00'N" },
                    { y: 318, label: "14°45'N" },
                    { y: 398, label: "13°45'N" },
                  ].map(row => (
                    <g key={row.label}>
                      <line x1="24" y1={row.y} x2="616" y2={row.y} />
                      <text x="30" y={row.y - 4}>{row.label}</text>
                      <text x="610" y={row.y - 4} textAnchor="end">{row.label}</text>
                    </g>
                  ))}
                  {[
                    { x: 120, label: "99°00'E" },
                    { x: 255, label: "99°45'E" },
                    { x: 390, label: "100°30'E" },
                    { x: 525, label: "101°15'E" },
                  ].map(col => (
                    <g key={col.label}>
                      <line x1={col.x} y1="20" x2={col.x} y2="500" />
                      <text x={col.x + 4} y="34">{col.label}</text>
                      <text x={col.x + 4} y="494">{col.label}</text>
                    </g>
                  ))}
                </g>
              )}

              {/* Vector River Network */}
              {showRivers && (
                <g className="hy-qgis-rivers">
                  {/* Ping */}
                  <path d="M168,58 Q185,155 235,220 T295,286" />
                  {/* Wang */}
                  <path d="M225,72 Q238,150 252,225" />
                  {/* Yom */}
                  <path d="M292,68 Q288,165 296,255 T295,286" />
                  {/* Nan */}
                  <path d="M362,64 Q348,175 322,250 T295,286" />
                  {/* Sakae Krang */}
                  <path d="M218,295 Q255,302 295,305" />
                  {/* Pa Sak */}
                  <path d="M405,215 Q388,300 332,378" />
                  {/* Main Chao Phraya */}
                  <path d="M295,286 Q304,345 316,395 T324,468" className="is-main-stem" />
                </g>
              )}

              {/* Spatial Risk Buffer / IDW Heatmap Halos */}
              {showBuffer && (
                <g filter="url(#qgis-blur-halo)">
                  {filteredItems.map(({ station, riskTier }) => {
                    const pt = projectToCanvas(station.lat, station.lng);
                    const radius = riskTier === 5 ? 36 : riskTier === 4 ? 30 : riskTier === 3 ? 24 : 16;
                    return (
                      <circle
                        key={`halo-${station.id}`}
                        cx={pt.x}
                        cy={pt.y}
                        r={radius}
                        fill={tierColor(riskTier)}
                        opacity={riskTier >= 3 ? 0.55 : 0.3}
                      />
                    );
                  })}
                </g>
              )}

              {/* Station Risk Vector Points */}
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
                    aria-label={`สถานี ${station.name} ระดับความเสี่ยง ${riskTier}`}
                  >
                    {(isSelected || riskTier >= 4) && (
                      <circle r={isSelected ? 15 : 11} fill="none" stroke={color} strokeWidth="2" className="hy-qgis-ring" />
                    )}
                    <circle
                      r={isSelected ? 7.5 : riskTier >= 3 ? 6 : 4.8}
                      fill={color}
                      stroke="#ffffff"
                      strokeWidth="1.8"
                    />
                    {showLabels && (isSelected || riskTier >= 3 || filteredItems.length <= 18) && (
                      <g transform="translate(9, -6)">
                        <rect x="-2" y="-10" width="54" height="14" rx="3" fill="rgba(12, 28, 44, 0.82)" />
                        <text x="2" y="0" className="hy-qgis-pt-label">
                          {station.id}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* QGIS Cartographic Overlays: North Arrow, Scale Bar, CRS */}
              <g transform="translate(568, 44)" className="hy-qgis-north">
                <circle r="22" fill="rgba(12, 28, 44, 0.78)" stroke="rgba(255,255,255,0.4)" />
                <polygon points="0,-15 -6,8 0,4 6,8" fill="#ffffff" />
                <text x="0" y="17" textAnchor="middle" fill="#7dd3fc" fontSize="9" fontWeight="800">
                  N
                </text>
              </g>

              {/* Scale Bar */}
              <g transform="translate(42, 456)" className="hy-qgis-scale">
                <rect x="-6" y="-14" width="148" height="28" rx="4" fill="rgba(12, 28, 44, 0.78)" />
                <rect x="0" y="2" width="30" height="5" fill="#ffffff" />
                <rect x="30" y="2" width="30" height="5" fill="#38bdf8" />
                <rect x="60" y="2" width="30" height="5" fill="#ffffff" />
                <text x="0" y="-3" fill="#ffffff" fontSize="9" fontWeight="700">0</text>
                <text x="30" y="-3" fill="#ffffff" fontSize="9" fontWeight="700">25</text>
                <text x="60" y="-3" fill="#ffffff" fontSize="9" fontWeight="700">50</text>
                <text x="95" y="-3" fill="#7dd3fc" fontSize="9" fontWeight="700">100 กม.</text>
              </g>

              {/* Outer Alternating Zebra Neatline Border */}
              <rect x="24" y="20" width="592" height="480" fill="none" stroke="#ffffff" strokeWidth="2" />
              <rect x="20" y="16" width="600" height="488" fill="none" stroke="#0c2e44" strokeWidth="4" strokeDasharray="24 24" />
            </svg>
          </div>

          {/* Bottom Map Sheet Title Block (QGIS Print Composer Footer) */}
          <div className="hy-qgis-titleblock">
            <div>
              <small>MAP SHEET: CPF-HYDRO-2026 · CRS: EPSG:4326 (WGS 84)</small>
              <strong>แผนที่วิเคราะห์โซนความเสี่ยงระดับน้ำลุ่มเจ้าพระยา 7 ลุ่มน้ำ ({activeBasinId === "all" ? "ทั้งลุ่มน้ำ" : `เฉพาะลุ่มน้ำรหัส ${activeBasinId}`})</strong>
            </div>
            <div className="hy-qgis-meta-right">
              <span>สถานีวิเคราะห์สด: <b>{items.length} แห่ง</b></span>
              <span>ที่มาภาพถ่าย: <b>Esri World Imagery / ThaiWater</b></span>
            </div>
          </div>
        </div>

        {/* Right: QGIS Legend, 5-Tier Risk Matrix & Spatial Analysis Narrative */}
        <aside className="hy-qgis-sidebar">
          <div className="hy-qgis-legend-card">
            <div className="hy-qgis-card-head">
              <span className="hy-eyebrow">LEGEND & RISK CLASSIFICATION</span>
              <h3>เกณฑ์สีระดับความเสี่ยง 5 ระดับ</h3>
              <p>กดที่แถบระดับสีเพื่อกรองเฉพาะสถานีในระดับความเสี่ยงนั้นบนแผนที่</p>
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
                  ระดับ {focused.riskTier}
                </span>
                <small>ลุ่มน้ำ{focused.basin.name} · พิกัด {focused.station.lat.toFixed(3)}°N, {focused.station.lng.toFixed(3)}°E</small>
              </div>
              <h4>{focused.station.name} ({focused.station.id})</h4>
              <p className="hy-qgis-focus-metrics">
                ระดับน้ำ <b>{formatWaterValue(focused.station.value)} ม. รทก.</b>
                {focused.station.capacityPercent !== null && (
                  <> · ความจุ <b>{focused.station.capacityPercent.toFixed(1)}%</b></>
                )}
                {waterBankDifference(focused.station) !== null && (
                  <> ({waterBankDifference(focused.station)! >= 0 ? `สูงกว่าตลิ่ง +${waterBankDifference(focused.station)!.toFixed(2)} ม.` : `ต่ำกว่าตลิ่ง ${Math.abs(waterBankDifference(focused.station)!).toFixed(2)} ม.`})</>
                )}
              </p>
              <small>เวลาตรวจวัด: {focused.station.observedAt ? `${thaiObservationTime(focused.station.observedAt)} น.` : "ไม่ระบุ"}</small>
            </div>
          )}

          {/* Automated Spatial Analysis Commentary */}
          <div className="hy-qgis-analysis-card">
            <span className="hy-eyebrow">📊 บทวิเคราะห์เชิงพื้นที่ (Spatial Analysis Summary)</span>
            <h3>คำอธิบายประกอบแผนที่วิเคราะห์</h3>
            <ul className="hy-qgis-analysis-list">
              <li>
                <strong>1. การกระจายตัวของความเสี่ยงริมตลิ่ง:</strong> จากสถานีที่มีข้อมูลสด {items.length} แห่ง พบระดับวิกฤต/ล้นตลิ่ง (สีแดง ระดับ 5) จำนวน <b>{tierCounts[5]} แห่ง</b> และระดับเสี่ยงสูงจ่อตลิ่ง (สีส้ม ระดับ 4) จำนวน <b>{tierCounts[4]} แห่ง</b> ส่วนใหญ่อยู่ในแนวที่ราบลุ่มริมน้ำสายหลัก
              </li>
              <li>
                <strong>2. ปัจจัยฝนสะสมในลุ่มน้ำ:</strong>{" "}
                {topPeakRain
                  ? `ตรวจพบจุดฝนสะสม 24 ชม. สูงสุดที่สถานี “${topPeakRain.name}” (ลุ่มน้ำ${topPeakRain.basinName}) ปริมาณ ${topPeakRain.mm.toFixed(1)} มม. ซึ่งอาจเพิ่มปริมาณน้ำท่าไหลลงลำน้ำสาขา`
                  : "ยังไม่พบกลุ่มฝนตกหนักเกินเกณฑ์ในรอบ 3 ชั่วโมงล่าสุด"}
              </li>
              <li>
                <strong>3. วิธีอ่านชั้นรัศมีความเสี่ยง (IDW Buffer):</strong> วงรัศมีสีรอบจุดสถานีบนแผนที่ภาพถ่ายดาวเทียมใช้เน้นตำแหน่งที่มีความจุลำน้ำสูงเพื่อให้สังเกตง่าย (ไม่ใช่ขอบเขตพื้นที่น้ำท่วมจริงในชุมชน)
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
