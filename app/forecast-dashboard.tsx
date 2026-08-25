"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  forecastDays as bundledDays,
  forecastStations as bundledStations,
  getLevel,
  issuedAt as bundledIssuedAt,
  type ForecastPayload,
  type ForecastStation,
} from "./lib/forecast-data";
import { FORECAST_DAYS } from "./lib/forecast-horizon";
import OutlookNav from "./components/outlook-nav";
import ProvinceSelector from "./components/province-selector";
import { DEFAULT_REGION_ID, METRO_REGION_ID, buildFallbackBoundary, getRegion, type RegionId } from "./lib/provinces";
import "leaflet/dist/leaflet.css";
import "./reliability.css";

type Coordinate = [number, number];
type PolygonCoordinates = Coordinate[][];
type BoundaryFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: PolygonCoordinates | PolygonCoordinates[];
  };
};
type BoundaryCollection = {
  type: "FeatureCollection";
  features: BoundaryFeature[];
};

const surfaceCache = new Map<string, ReturnType<typeof createIdwSurface>>();
const MAX_SURFACE_CACHE = 12;

const colorStops = [
  { value: 0, color: [56, 189, 248] },
  { value: 15, color: [56, 189, 248] },
  { value: 25, color: [52, 211, 153] },
  { value: 37.5, color: [250, 204, 21] },
  { value: 75, color: [251, 146, 60] },
  { value: 120, color: [244, 63, 94] },
];

function getPolygons(boundary: BoundaryCollection): PolygonCoordinates[] {
  return boundary.features.flatMap((feature) =>
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates as PolygonCoordinates]
      : feature.geometry.coordinates as PolygonCoordinates[],
  );
}

function getBoundaryBounds(boundary: BoundaryCollection) {
  const coordinates = getPolygons(boundary).flat(2);
  const lngs = coordinates.map(([lng]) => lng);
  const lats = coordinates.map(([, lat]) => lat);
  return {
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}

function interpolateColor(value: number) {
  const upperIndex = colorStops.findIndex((stop) => value <= stop.value);
  if (upperIndex <= 0) return colorStops[0].color;
  if (upperIndex === -1) return colorStops[colorStops.length - 1].color;
  const lower = colorStops[upperIndex - 1];
  const upper = colorStops[upperIndex];
  const ratio = (value - lower.value) / (upper.value - lower.value || 1);
  return lower.color.map((channel, index) => Math.round(channel + (upper.color[index] - channel) * ratio));
}

function interpolateIdw(lng: number, lat: number, stations: ForecastStation[], dayIndex: number) {
  const longitudeScale = Math.cos((lat * Math.PI) / 180);
  let weightedValue = 0;
  let totalWeight = 0;

  for (const station of stations) {
    const dx = (lng - station.lng) * longitudeScale;
    const dy = lat - station.lat;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared < 0.0000002) return station.values[dayIndex];
    const weight = 1 / distanceSquared;
    weightedValue += station.values[dayIndex] * weight;
    totalWeight += weight;
  }

  return weightedValue / totalWeight;
}

function createIdwSurface(boundary: BoundaryCollection, stations: ForecastStation[], dayIndex: number) {
  const bounds = getBoundaryBounds(boundary);
  const width = 360;
  const height = Math.max(320, Math.round(width * (bounds.maxLat - bounds.minLat) / (bounds.maxLng - bounds.minLng)));
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true })!;
  maskContext.fillStyle = "#fff";

  for (const polygon of getPolygons(boundary)) {
    maskContext.beginPath();
    for (const ring of polygon) {
      ring.forEach(([lng, lat], index) => {
        const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * width;
        const y = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * height;
        if (index === 0) maskContext.moveTo(x, y);
        else maskContext.lineTo(x, y);
      });
      maskContext.closePath();
    }
    maskContext.fill("evenodd");
  }

  const mask = maskContext.getImageData(0, 0, width, height).data;
  const surfaceCanvas = document.createElement("canvas");
  surfaceCanvas.width = width;
  surfaceCanvas.height = height;
  const surfaceContext = surfaceCanvas.getContext("2d")!;
  const image = surfaceContext.createImageData(width, height);

  for (let y = 0; y < height; y += 1) {
    const lat = bounds.maxLat - ((y + 0.5) / height) * (bounds.maxLat - bounds.minLat);
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = (y * width + x) * 4;
      if (mask[pixelIndex + 3] === 0) continue;
      const lng = bounds.minLng + ((x + 0.5) / width) * (bounds.maxLng - bounds.minLng);
      const value = interpolateIdw(lng, lat, stations, dayIndex);
      const [red, green, blue] = interpolateColor(value);
      image.data[pixelIndex] = red;
      image.data[pixelIndex + 1] = green;
      image.data[pixelIndex + 2] = blue;
      image.data[pixelIndex + 3] = 168;
    }
  }

  surfaceContext.putImageData(image, 0, 0);
  return {
    url: surfaceCanvas.toDataURL("image/png"),
    bounds: [[bounds.minLat, bounds.minLng], [bounds.maxLat, bounds.maxLng]] as [[number, number], [number, number]],
  };
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function getHealthAdvice(mean: number | null) {
  if (mean === null) return "ยังไม่มีข้อมูลคำแนะนำ";
  if (mean <= 15) return "คุณภาพอากาศดีเยี่ยม เหมาะทำกิจกรรมกลางแจ้ง";
  if (mean <= 25) return "คุณภาพอากาศดี สามารถทำกิจกรรมกลางแจ้งได้ปกติ";
  if (mean <= 37.5) return "ระดับปานกลาง ผู้ป่วยระบบทางเดินหายใจควรสังเกตอาการ";
  if (mean <= 75) return "เริ่มมีผลกระทบต่อสุขภาพ ควรลดเวลาทำกิจกรรมกลางแจ้ง";
  return "มีผลกระทบต่อสุขภาพ สวมหน้ากาก N95 เมื่อออกนอกอาคาร";
}

function degradedReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    no_local_station_bias_correction: "ไม่มีสถานีท้องถิ่นสำหรับปรับเทียบ",
    cams_partial_coverage: "แบบจำลอง CAMS ครอบคลุมบางช่วง",
    weather_unavailable: "ข้อมูลสภาพอากาศประกอบไม่พร้อม",
    observations_older_than_3h: "ข้อมูลสถานีล่าสุดเกิน 3 ชั่วโมง",
    airbkk_timeout: "AirBKK ตอบสนองช้า จึงใช้ CAMS โดยไม่ปรับด้วยสถานี",
    airbkk_error: "AirBKK ไม่พร้อมใช้งาน จึงใช้ Air4Thai หรือ CAMS สำรอง",
    air4thai_bias_correction: "ปรับแบบจำลอง CAMS ด้วยสถานี Air4Thai ล่าสุด",
    air4thai_timeout: "Air4Thai ตอบสนองช้า",
    air4thai_error: "Air4Thai ไม่พร้อมใช้งาน",
  };
  return labels[reason] ?? reason;
}

function buildAirSvgCurve(pts: Array<{ x: number; y: number }>) {
  if (!pts.length) return "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

async function fetchAirPayload(regionId: RegionId, reloadKey: number): Promise<ForecastPayload> {
  const query = new URLSearchParams({ horizon: String(FORECAST_DAYS), province: regionId });
  const response = await fetch(`/api/forecast?${query}`, { cache: reloadKey ? "no-cache" : "default" });
  if (!response.ok) throw new Error("forecast unavailable");
  return response.json() as Promise<ForecastPayload>;
}
async function fetchRegionBoundary(regionId: RegionId): Promise<{ boundary: BoundaryCollection; state: "official" | "fallback" }> {
  const url = regionId === "bangkok" ? "/api/bangkok-boundary" : `/api/province-boundary?province=${regionId}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("boundary unavailable");
    return { boundary: await response.json() as BoundaryCollection, state: "official" };
  } catch {
    return { boundary: buildFallbackBoundary(regionId) as BoundaryCollection, state: "fallback" };
  }
}export default function ForecastDashboard() {
  const [selectedProvinceId, setSelectedProvinceId] = useState<RegionId>(DEFAULT_REGION_ID);
  const [selectedDay, setSelectedDay] = useState(0);
  const [days, setDays] = useState(bundledDays);
  const [stations, setStations] = useState(bundledStations);
  const [issuedAt, setIssuedAt] = useState(bundledIssuedAt);
  const [model, setModel] = useState("กำลังเชื่อมต่อแหล่งข้อมูล");
  const [disclaimer, setDisclaimer] = useState("ค่าบนแผนที่เป็นค่าพยากรณ์และการประมาณเชิงพื้นที่");
  const [dataState, setDataState] = useState<"loading" | "live" | "degraded" | "unavailable">("loading");
  const [degradedReasons, setDegradedReasons] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [showRange, setShowRange] = useState(false);
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [boundary, setBoundary] = useState<BoundaryCollection | null>(null);
  const [boundaryState, setBoundaryState] = useState<"loading" | "official" | "fallback">("loading");
  const [mapReady, setMapReady] = useState(false);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const surfaceLayerRef = useRef<import("leaflet").ImageOverlay | null>(null);
  const boundaryLayerRef = useRef<import("leaflet").GeoJSON | null>(null);
  const selectedRegion = getRegion(selectedProvinceId);

  useEffect(() => {
    window.scrollTo(0, 0);
    const requestedProvince = new URLSearchParams(window.location.search).get("province");
    Promise.resolve().then(() => setSelectedProvinceId(getRegion(requestedProvince).id));
  }, []);

  useEffect(() => {
    let active = true;

    fetchAirPayload(selectedProvinceId, reloadKey)
      .then((payload) => {
        if (!active) return;
        setDays(payload.days);
        setStations(payload.stations);
        setIssuedAt(payload.issuedAt);
        setModel(payload.model ?? "แบบจำลอง PM2.5");
        setDisclaimer(payload.disclaimer ?? "ค่าบนแผนที่เป็นค่าพยากรณ์และการประมาณเชิงพื้นที่");
        const nextStatus = payload.status === "fallback" ? "unavailable" : payload.status;
        setDataState(nextStatus);
        setDegradedReasons(payload.degradedReasons ?? []);
      })
      .catch(() => {
        if (active) { setStations([]); setDataState("unavailable"); setDegradedReasons(["forecast_request_failed"]); }
      });
    return () => {
      active = false;
    };
  }, [reloadKey, selectedProvinceId]);

  useEffect(() => {
    let active = true;
    fetchRegionBoundary(selectedProvinceId).then((result) => {
      if (!active) return;
      setBoundary(result.boundary);
      setBoundaryState(result.state);
    });
    return () => {
      active = false;
    };
  }, [selectedProvinceId]);

  useEffect(() => {
    let cancelled = false;
    if (!mapElementRef.current || mapInstanceRef.current) return;

    import("leaflet").then((leafletModule) => {
      if (cancelled || !mapElementRef.current || mapInstanceRef.current) return;
      const L = leafletModule.default;
      const map = L.map(mapElementRef.current, {
        zoomControl: true,
        attributionControl: true,
        minZoom: 8,
        maxZoom: 15,
      }).setView([13.765, 100.595], 10);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      map.createPane("surfacePane").style.zIndex = "350";
      map.getPane("surfacePane")!.style.pointerEvents = "none";
      map.createPane("boundaryPane").style.zIndex = "420";
      map.getPane("boundaryPane")!.style.pointerEvents = "none";
      mapInstanceRef.current = map;
      setMapReady(true);
      window.setTimeout(() => map.invalidateSize(), 80);
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        surfaceLayerRef.current = null;
        boundaryLayerRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !boundary) return;
    let cancelled = false;

    import("leaflet").then((leafletModule) => {
      if (cancelled || !mapInstanceRef.current) return;
      const L = leafletModule.default;
      const map = mapInstanceRef.current;

      if (surfaceLayerRef.current) map.removeLayer(surfaceLayerRef.current);
      if (boundaryLayerRef.current) map.removeLayer(boundaryLayerRef.current);

      if ((dataState === "live" || dataState === "degraded") && stations.length) {
        const stationDataVersion = stations.map((station) => `${station.id}:${station.values.join(",")}`).join("|");
        const boundaryVersion = `${selectedProvinceId}:${boundaryState}:${boundary.features.length}`;
        const cacheKey = `${selectedDay}:${stationDataVersion}:${boundaryVersion}`;
        let surface = surfaceCache.get(cacheKey);
        if (!surface) {
          surface = createIdwSurface(boundary, stations, selectedDay);
          surfaceCache.set(cacheKey, surface);
          if (surfaceCache.size > MAX_SURFACE_CACHE) surfaceCache.delete(surfaceCache.keys().next().value!);
        }
        surfaceLayerRef.current = L.imageOverlay(surface.url, surface.bounds, { pane: "surfacePane", opacity: 0.78, interactive: false }).addTo(map);
      }

      boundaryLayerRef.current = L.geoJSON(boundary as GeoJSON.GeoJsonObject, {
        pane: "boundaryPane",
        style: {
          color: "#0f766e",
          weight: 1.2,
          opacity: 0.8,
          fillOpacity: 0,
        },
      }).addTo(map);

      map.fitBounds(boundaryLayerRef.current.getBounds(), { padding: [14, 14], animate: false });
    });

    return () => {
      cancelled = true;
    };
  }, [boundary, boundaryState, dataState, mapReady, selectedDay, selectedProvinceId, stations]);

  const selectProvince = (provinceId: RegionId) => {
    setDataState("loading");
    setBoundaryState("loading");
    setSelectedDay(0);
    setSelectedProvinceId(provinceId);
    const url = new URL(window.location.href);
    url.searchParams.set("province", provinceId);
    window.history.replaceState({}, "", url);
  };

  const day = days[selectedDay];
  const values = useMemo(
    () => stations.map((station) => station.values[selectedDay]),
    [selectedDay, stations],
  );
  const mean = average(values);
  const meanLevel = mean === null ? { label: "ไม่มีข้อมูล", color: "#94a3b8" } : getLevel(mean);
  const healthAdvice = useMemo(() => getHealthAdvice(mean), [mean]);
  const sortedStations = useMemo(
    () => [...stations].sort((a, b) => b.values[selectedDay] - a.values[selectedDay]).slice(0, 5),
    [selectedDay, stations],
  );
  const dailyMeans = useMemo(
    () => days.map((_, index) => average(stations.map((station) => station.values[index]))),
    [days, stations],
  );
  const highestStation = sortedStations[0];

  return (
    <main className="app-shell air-shell">
      <header className={`dashboard-banner ${dataState}`} id="top">
        <div className="banner-copy">
          <span className="banner-kicker">BKK Air Forecast</span>
          <h1>แผนที่พยากรณ์ <em>PM2.5 {selectedRegion.shortNameTh}</em></h1>
          <p>ดูล่วงหน้า 1–7 วัน เลือกวันแล้วตรวจพื้นที่ที่ควรเฝ้าระวังได้ทันที</p>
        </div>
        <ProvinceSelector value={selectedProvinceId} onChange={selectProvince} />
        <OutlookNav active="air" province={selectedProvinceId} />
        <div className="banner-status" role="status">
          <span className={`status-dot ${dataState}`} aria-hidden="true" />
          <div>
            <span>{dataState === "live" ? "ข้อมูลอัปเดตแล้ว" : dataState === "degraded" ? "ข้อมูลอัปเดตบางส่วน" : dataState === "unavailable" ? "ข้อมูลไม่พร้อมใช้งาน" : "กำลังโหลดข้อมูล"}</span>
            <b>{issuedAt}</b>
          </div>
        </div>
      </header>

      <section className="workspace air-workspace">
        {/* LEFT CONTROL PANEL */}
        <aside className="control-panel air-control-panel" aria-label="แถบเลือกวันและแนวโน้มพยากรณ์ฝุ่น">
          {/* Section 1: 7-Day Outlook Selector */}
          <div className="panel-section">
            <div className="panel-title">
              <span>📅 เลือกวันพยากรณ์</span>
              <small>7 วันล่วงหน้า</small>
            </div>
            <nav className="sidebar-days" aria-label="เลือกวันพยากรณ์">
              {days.map((forecastDay, index) => {
                const dailyValues = stations.map((station) => station.values[index]);
                const dailyMean = average(dailyValues);
                const isActive = selectedDay === index;
                const level = dailyMean === null ? { label: "—", color: "#94a3b8" } : getLevel(dailyMean);
                return (
                  <button
                    key={forecastDay.lead}
                    className={`sidebar-day-btn ${isActive ? "active" : ""}`}
                    onClick={() => setSelectedDay(index)}
                    aria-pressed={isActive}
                  >
                    <div className="day-btn-left">
                      <b className="day-name">{forecastDay.weekday}</b>
                      <span className="day-date">{forecastDay.date}</span>
                    </div>
                    <div className="day-btn-right">
                      <span className="day-val-badge" style={{ color: isActive ? "#ffffff" : level.color }}>
                        {dailyMean ?? "—"} µg/m³
                      </span>
                      {forecastDay.sourceMode === "extrapolated" && <em className="badge-trend">แนวโน้ม</em>}
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Section 2: 7-Day Trend Line Curve Graph */}
          <div className="panel-section trend-line-section">
            <div className="panel-title">
              <span>📈 แนวโน้ม 7 วัน</span>
              <small>ค่าเฉลี่ย {selectedRegion.shortNameTh}</small>
            </div>
            <div className="air-trend-graph-wrap">
              {(() => {
                const svgPts = dailyMeans.map((val, i) => {
                  const x = i * (240 / Math.max(1, dailyMeans.length - 1));
                  const safeVal = val ?? 20;
                  const y = Math.max(6, Math.min(38, 38 - ((safeVal - 0) / 75) * 32));
                  return { x, y };
                });
                const lineD = buildAirSvgCurve(svgPts);
                const areaD = lineD ? `${lineD} L 240 42 L 0 42 Z` : "";
                return (
                  <>
                    <svg className="air-trend-svg" viewBox="0 0 240 42" preserveAspectRatio="none" aria-hidden="true">
                      <defs>
                        <linearGradient id="airLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#38bdf8" />
                          <stop offset="50%" stopColor="#34d399" />
                          <stop offset="100%" stopColor="#f59e0b" />
                        </linearGradient>
                        <linearGradient id="airAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#0d9488" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {areaD && <path d={areaD} fill="url(#airAreaGrad)" />}
                      {lineD && <path d={lineD} stroke="url(#airLineGrad)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
                    </svg>
                    <div className="air-trend-nodes" role="group" aria-label="กราฟแนวโน้มค่าฝุ่นเฉลี่ย 7 วัน">
                      {dailyMeans.map((value, index) => {
                        const leftPct = (index / Math.max(1, dailyMeans.length - 1)) * 100;
                        const alignClass = index === 0 ? "align-left" : index === dailyMeans.length - 1 ? "align-right" : "align-center";
                        const level = value === null ? { color: "#94a3b8" } : getLevel(value);
                        return (
                          <button
                            key={days[index]?.lead ?? index}
                            className={`${selectedDay === index ? "active" : ""} ${alignClass}`}
                            style={{ left: `${leftPct}%` }}
                            onClick={() => setSelectedDay(index)}
                            aria-label={`${days[index]?.weekday ?? "วัน"} ${days[index]?.date ?? ""} ค่าเฉลี่ย ${value ?? "ไม่มีข้อมูล"} ไมโครกรัมต่อลูกบาศก์เมตร`}
                            aria-pressed={selectedDay === index}
                          >
                            <i className="trend-node-dot" style={{ backgroundColor: level.color }} />
                            <span className="trend-node-val">{value ?? "—"}</span>
                            <small>{days[index]?.weekday.slice(0, 2)}</small>
                          </button>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Section 3: Weather Factors */}
          <div className="panel-section weather-factor-section">
            <div className="panel-title">
              <span>💨 ปัจจัยสภาพอากาศ & ลม</span>
            </div>
            <div className="weather-factor-list">
              <div>
                <span className="weather-factor-icon" aria-hidden="true">↗</span>
                <div>
                  <small>ทิศทางและความเร็วลม</small>
                  <b>{day.wind}</b>
                </div>
              </div>
              <div>
                <span className="weather-factor-icon" aria-hidden="true">◌</span>
                <div>
                  <small>สภาพอากาศทั่วไป</small>
                  <b>{day.weather}</b>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER MAP CANVAS */}
        <div className="map-card air-map-card">
          <div className="map-wrap">
            <div ref={mapElementRef} className="map" role="application" aria-label={`แผนที่ PM2.5 ${selectedRegion.nameTh} พยากรณ์ล่วงหน้า ${day.lead} วัน`} />
            {dataState === "unavailable" && <div className="forecast-unavailable" role="alert"><b>ไม่สามารถโหลดข้อมูลพยากรณ์ล่าสุดได้</b><span>ค่าที่แสดงบนแผนที่ถูกปิดไว้เพื่อป้องกันการเข้าใจผิด</span><button type="button" onClick={() => { setDataState("loading"); setReloadKey((value) => value + 1); }}>ลองใหม่</button></div>}
            <div className="layer-menu">
              <button
                className="layer-menu-trigger"
                type="button"
                onClick={() => setLayerMenuOpen((open) => !open)}
                aria-label="เลือกชั้นข้อมูลแผนที่"
                aria-expanded={layerMenuOpen}
              >
                <span className="layer-symbol" aria-hidden="true"><i /><i /><i /></span>
              </button>
              <div className="layer-menu-panel" hidden={!layerMenuOpen}>
                <strong>การแสดงผล</strong>
                <div className="layer-static"><span aria-hidden="true">✓</span>พื้นผิว IDW ค่าฝุ่น</div>
                <label className="range-toggle">
                  <input type="checkbox" checked={showRange} onChange={(event) => setShowRange(event.target.checked)} />
                  <span />แสดงช่วงค่า
                </label>
              </div>
            </div>
            <div className="map-metric">
              <span>ค่าเฉลี่ย {selectedRegion.shortNameTh}</span>
              <strong>{mean ?? "—"}<small>µg/m³</small></strong>
              <b style={{ color: meanLevel.color }}>{meanLevel.label}</b>
              {showRange && mean !== null && <em>ช่วงคาดการณ์ {Math.max(0, mean - day.uncertainty)}–{mean + day.uncertainty}</em>}
            </div>
            <div className={`surface-status ${boundaryState}`}>
              <b>{dataState === "live" ? "ข้อมูลอัปเดตแล้ว" : dataState === "degraded" ? "ข้อมูลอัปเดตบางส่วน" : dataState === "unavailable" ? "ข้อมูลไม่พร้อมใช้งาน" : "กำลังโหลด"}</b>
              <span>{stations.length ? `พื้นผิว IDW · คำนวณจากข้อมูล ${stations.length} พิกัด` : "ปิดพื้นผิวพยากรณ์จนกว่าจะมีข้อมูลจริง"}</span>
              {dataState === "degraded" && degradedReasons.length > 0 && <em>ข้อจำกัด: {degradedReasons.map(degradedReasonLabel).join(" · ")}</em>}
              <em>{boundaryState === "official" ? selectedProvinceId === METRO_REGION_ID ? "ครอบคลุมกรุงเทพฯ และปริมณฑล 6 จังหวัด" : selectedProvinceId === "bangkok" ? "ครอบคลุมพื้นที่ 50 เขต" : `ขอบเขตจังหวัด${selectedRegion.nameTh}` : boundaryState === "fallback" ? "กำลังใช้ขอบเขตสำรอง" : `กำลังโหลดขอบเขต${selectedRegion.nameTh}`}</em>
            </div>
            <div className="legend" aria-label="คำอธิบายระดับ PM2.5">
              <span><i style={{ background: "#38bdf8" }} />0–15</span>
              <span><i style={{ background: "#34d399" }} />16–25</span>
              <span><i style={{ background: "#facc15" }} />26–37.5</span>
              <span><i style={{ background: "#fb923c" }} />38–75</span>
              <span><i style={{ background: "#f43f5e" }} />&gt;75</span>
              <small>PM2.5 · µg/m³</small>
            </div>
          </div>
        </div>

        {/* RIGHT INSIGHTS SIDEBAR */}
        <aside className="insights air-insights">
          <div className="average-card">
            <div
              className="average-ring"
              style={{
                "--progress": `${Math.min(100, ((mean ?? 0) / 75) * 100) * 3.6}deg`,
                "--metric-color": meanLevel.color,
              } as React.CSSProperties}
            >
              <span>{mean ?? "—"}<small>µg/m³</small></span>
            </div>
            <div>
              <p>ค่าฝุ่นเฉลี่ย {selectedRegion.shortNameTh}</p>
              <strong style={{ color: meanLevel.color }}>{meanLevel.label}</strong>
              <em>เฉลี่ย {mean ?? "—"} µg/m³ · {stations.length} จุดข้อมูล</em>
            </div>
          </div>

          <div className="advisory-card air-advisory-card">
            <div className="advisory-header">
              <span className="advisory-icon">{mean && mean > 37.5 ? "😷" : mean && mean > 25 ? "⚠️" : "🌿"}</span>
              <div className="advisory-title-wrap">
                <b>คำแนะนำสุขภาพ</b>
                <span className="advisory-risk-badge" style={{ backgroundColor: meanLevel.color }}>
                  {meanLevel.label}
                </span>
              </div>
            </div>
            <p className="advisory-desc">{healthAdvice}</p>
          </div>

          <div className="watch-card">
            <p>พื้นที่เฝ้าระวัง</p>
            <ol>
              {sortedStations.map((station) => {
                const value = station.values[selectedDay];
                return <li key={station.id}><span>{station.district}</span><b>{value}</b><i style={{ background: getLevel(value).color }} /></li>;
              })}
            </ol>
            <small>หน่วย µg/m³ · เรียงจากค่าคาดการณ์สูงสุด</small>
          </div>

          <div className="forecast-note">
            <span aria-hidden="true">!</span>
            <p><b>สรุปวันนี้</b>{mean === null ? "ยังไม่มีข้อมูลพยากรณ์ที่พร้อมแสดง" : `ค่าเฉลี่ยอยู่ในระดับ${meanLevel.label}${highestStation ? ` พื้นที่ที่ควรติดตามมากที่สุดคือ${highestStation.district}` : ""}`}<small>{model} · {disclaimer}</small></p>
          </div>
        </aside>
      </section>
    </main>
  );
}
