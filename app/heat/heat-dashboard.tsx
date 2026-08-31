"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OutlookNav from "../components/outlook-nav";
import ProvinceSelector from "../components/province-selector";
import LocationForecastCard, { type LocationSelection } from "../components/location-forecast-card";
import { MapForecastHover, useMapForecastInteraction } from "../components/map-forecast-interaction";
import { buildHeatDayShells, getHeatRisk, type HeatForecastPayload, type HeatPoint } from "../lib/heat-forecast-data";
import { getBasemapConfig, getCurrentBasemapTheme, type BasemapKind, type BasemapTheme } from "../lib/basemap";
import { spatialIdw } from "../lib/forecast/interpolation";
import { buildFallbackBoundary, getRegion, METRO_REGION_ID, type RegionId } from "../lib/provinces";
import "leaflet/dist/leaflet.css";

type MetricMode = "heat-index" | "temperature";
type BoundaryCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
type Coordinate = [number, number];
type PolygonCoordinates = Coordinate[][];

const heatSurfaceCache = new Map<string, ReturnType<typeof createHeatSurface>>();
const MAX_HEAT_SURFACES = 20;

const heatIndexStops = [
  { value: 24, color: [56, 189, 248] },
  { value: 27, color: [34, 197, 94] },
  { value: 33, color: [234, 179, 8] },
  { value: 42, color: [249, 115, 22] },
  { value: 52, color: [220, 38, 38] },
  { value: 62, color: [127, 29, 29] },
];

const temperatureStops = [
  { value: 24, color: [56, 189, 248] },
  { value: 30, color: [250, 204, 21] },
  { value: 34, color: [249, 115, 22] },
  { value: 38, color: [220, 38, 38] },
  { value: 44, color: [127, 29, 29] },
];

async function fetchBoundary(regionId: RegionId) {
  const url = regionId === "bangkok" ? "/api/bangkok-boundary" : `/api/province-boundary?province=${regionId}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("boundary unavailable");
    return { boundary: await response.json() as BoundaryCollection, state: "official" as const };
  } catch {
    return { boundary: buildFallbackBoundary(regionId) as BoundaryCollection, state: "fallback" as const };
  }
}

function formatUpdated(value?: string) {
  if (!value) return "กำลังสรุปข้อมูลล่าสุด";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function pointWindow(point: HeatPoint, dayIndex: number, windowIndex: number) {
  return point.windows?.find((window) => window.dayIndex === dayIndex && window.windowIndex === windowIndex);
}

function pointValue(point: HeatPoint, dayIndex: number, windowIndex: number, metric: MetricMode) {
  const window = pointWindow(point, dayIndex, windowIndex);
  return metric === "heat-index" ? window?.maxHeatIndexC ?? null : window?.maxTemperatureC ?? null;
}

function getBangkokDateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Bangkok",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { dateKey: `${value("year")}-${value("month")}-${value("day")}`, hour: Number(value("hour")) };
}

function getPolygons(boundary: BoundaryCollection): PolygonCoordinates[] {
  return boundary.features.flatMap((feature) => feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates as PolygonCoordinates]
    : feature.geometry.coordinates as PolygonCoordinates[]);
}

function getBoundaryBounds(boundary: BoundaryCollection) {
  const coordinates = getPolygons(boundary).flat(2);
  const lngs = coordinates.map(([lng]) => lng);
  const lats = coordinates.map(([, lat]) => lat);
  return { minLng: Math.min(...lngs), maxLng: Math.max(...lngs), minLat: Math.min(...lats), maxLat: Math.max(...lats) };
}

function interpolateSurfaceColor(value: number, metric: MetricMode) {
  const stops = metric === "heat-index" ? heatIndexStops : temperatureStops;
  const upperIndex = stops.findIndex((stop) => value <= stop.value);
  if (upperIndex <= 0) return stops[0].color;
  if (upperIndex === -1) return stops[stops.length - 1].color;
  const lower = stops[upperIndex - 1];
  const upper = stops[upperIndex];
  const ratio = (value - lower.value) / Math.max(0.1, upper.value - lower.value);
  return lower.color.map((channel, index) => Math.round(channel + (upper.color[index] - channel) * ratio));
}

function createHeatSurface(boundary: BoundaryCollection, points: HeatPoint[], dayIndex: number, windowIndex: number, metric: MetricMode) {
  const anchors = points.map((point) => ({ lat: point.lat, lng: point.lng, value: pointValue(point, dayIndex, windowIndex, metric) }))
    .filter((anchor): anchor is { lat: number; lng: number; value: number } => anchor.value !== null);
  if (anchors.length < 3) return null;
  const bounds = getBoundaryBounds(boundary);
  const width = 420;
  const height = Math.max(280, Math.round(width * (bounds.maxLat - bounds.minLat) / (bounds.maxLng - bounds.minLng)));
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
      const value = spatialIdw(lat, lng, anchors, { maxDistanceKm: 55, maxNeighbors: 12, minNeighbors: 3, power: 2 });
      if (value === null) continue;
      const [red, green, blue] = interpolateSurfaceColor(value, metric);
      image.data[pixelIndex] = red;
      image.data[pixelIndex + 1] = green;
      image.data[pixelIndex + 2] = blue;
      image.data[pixelIndex + 3] = 158;
    }
  }
  surfaceContext.putImageData(image, 0, 0);
  return { url: surfaceCanvas.toDataURL("image/png"), bounds: [[bounds.minLat, bounds.minLng], [bounds.maxLat, bounds.maxLng]] as [[number, number], [number, number]] };
}

export default function HeatDashboard() {
  const initialProvince = typeof window === "undefined" ? METRO_REGION_ID : new URLSearchParams(window.location.search).get("province") as RegionId || METRO_REGION_ID;
  const [selectedProvinceId, setSelectedProvinceId] = useState<RegionId>(initialProvince);
  const [payload, setPayload] = useState<HeatForecastPayload | null>(null);
  const [dataState, setDataState] = useState<"loading" | HeatForecastPayload["status"]>("loading");
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedWindowIndex, setSelectedWindowIndex] = useState(0);
  const [metric, setMetric] = useState<MetricMode>("heat-index");
  const [basemap, setBasemap] = useState<BasemapKind>("street");
  const [mapTheme, setMapTheme] = useState<BasemapTheme>("light");
  const [boundary, setBoundary] = useState<BoundaryCollection | null>(null);
  const [boundaryState, setBoundaryState] = useState<"loading" | "official" | "fallback">("loading");
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [showPoints, setShowPoints] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationSelection | null>(null);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const tileRef = useRef<import("leaflet").TileLayer | null>(null);
  const boundaryRef = useRef<import("leaflet").GeoJSON | null>(null);
  const surfaceRef = useRef<import("leaflet").ImageOverlay | null>(null);
  const valuesRef = useRef<import("leaflet").LayerGroup | null>(null);
  const selectedLocationRef = useRef<import("leaflet").CircleMarker | null>(null);

  const selectedRegion = getRegion(selectedProvinceId);
  const days = useMemo(() => payload?.days ?? buildHeatDayShells(), [payload]);
  const windows = useMemo(() => payload?.windows ?? [], [payload]);
  const points = useMemo(() => payload?.points ?? [], [payload]);
  const day = days[selectedDay] ?? days[0];
  const dayWindows = useMemo(() => windows.filter((window) => window.dayIndex === selectedDay), [selectedDay, windows]);
  const selectedWindow = dayWindows.find((window) => window.windowIndex === selectedWindowIndex) ?? null;
  const focusValue = metric === "heat-index" ? selectedWindow?.maxHeatIndexC ?? null : selectedWindow?.maxTemperatureC ?? null;
  const risk = getHeatRisk(selectedWindow?.pointMaxHeatIndexC ?? selectedWindow?.maxHeatIndexC ?? null);
  const bangkokNow = getBangkokDateParts();
  const currentWindowIndex = Math.min(7, Math.floor(bangkokNow.hour / 3));
  const selectedDayIsToday = day?.dateKey === bangkokNow.dateKey;
  const peakWindowIndex = [...dayWindows].filter((window) => window.pointMaxHeatIndexC !== null).sort((a, b) => (b.pointMaxHeatIndexC ?? -999) - (a.pointMaxHeatIndexC ?? -999))[0]?.windowIndex ?? null;

  const selectProvince = useCallback((value: RegionId) => {
    setSelectedProvinceId(value);
    setSelectedDay(0);
    setSelectedWindowIndex(0);
    setSelectedLocation(null);
    setDataState("loading");
    setBoundaryState("loading");
    window.history.replaceState(null, "", `/heat?province=${value}`);
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`/api/heat-forecast?province=${selectedProvinceId}`)
      .then(async (response) => {
        const data = await response.json() as HeatForecastPayload;
        if (!active) return;
        setPayload(data);
        setDataState(data.status);
      })
      .catch(() => {
        if (!active) return;
        setPayload(null);
        setDataState("unavailable");
      });
    return () => { active = false; };
  }, [reloadKey, selectedProvinceId]);

  useEffect(() => {
    let active = true;
    fetchBoundary(selectedProvinceId).then((result) => {
      if (!active) return;
      setBoundary(result.boundary);
      setBoundaryState(result.state);
    });
    return () => { active = false; };
  }, [selectedProvinceId]);

  useEffect(() => {
    const initialSync = window.setTimeout(() => setMapTheme(getCurrentBasemapTheme()), 0);
    const observer = new MutationObserver(() => setMapTheme(getCurrentBasemapTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { window.clearTimeout(initialSync); observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return;
    let disposed = false;
    import("leaflet").then((module) => {
      if (disposed || !mapElementRef.current) return;
      const L = module.default;
      const map = L.map(mapElementRef.current, { zoomControl: true, attributionControl: true, preferCanvas: true }).setView([13.78, 100.43], 9);
      map.createPane("selectedLocationPane").style.zIndex = "680";
      mapRef.current = map;
      valuesRef.current = L.layerGroup().addTo(map);
      setMapReady(true);
      requestAnimationFrame(() => map.invalidateSize());
    });
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      tileRef.current = null;
      boundaryRef.current = null;
      surfaceRef.current = null;
      valuesRef.current = null;
      selectedLocationRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    import("leaflet").then((module) => {
      const L = module.default;
      if (tileRef.current) map.removeLayer(tileRef.current);
      const config = getBasemapConfig(basemap, mapTheme);
      tileRef.current = L.tileLayer(config.url, { attribution: config.attribution, maxZoom: config.maxZoom }).addTo(map);
    });
  }, [basemap, mapReady, mapTheme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    if (selectedLocationRef.current) {
      map.removeLayer(selectedLocationRef.current);
      selectedLocationRef.current = null;
    }
    if (!selectedLocation) return;
    let cancelled = false;
    import("leaflet").then((module) => {
      if (cancelled || !mapRef.current) return;
      selectedLocationRef.current = module.default.circleMarker([selectedLocation.lat, selectedLocation.lng], {
        pane: "selectedLocationPane", radius: 8, color: "#ffffff", weight: 3, fillColor: "#ea580c", fillOpacity: 1,
      }).addTo(map);
    });
    return () => { cancelled = true; };
  }, [mapReady, selectedLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !boundary) return;
    import("leaflet").then((module) => {
      const L = module.default;
      if (boundaryRef.current) map.removeLayer(boundaryRef.current);
      boundaryRef.current = L.geoJSON(boundary as GeoJSON.GeoJsonObject, { style: { color: "#b45309", weight: 1.6, fillOpacity: 0.035, dashArray: boundaryState === "fallback" ? "5 5" : undefined } }).addTo(map);
      map.fitBounds(boundaryRef.current.getBounds(), { padding: [18, 18], animate: false });
    });
  }, [boundary, boundaryState, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = valuesRef.current;
    if (!mapReady || !map || !layer) return;
    layer.clearLayers();
    import("leaflet").then((module) => {
      const L = module.default;
      if (surfaceRef.current) map.removeLayer(surfaceRef.current);
      surfaceRef.current = null;
      if (boundary && boundaryState === "official" && points.length >= 3) {
        const dataVersion = points.map((point) => `${point.id}:${pointValue(point, selectedDay, selectedWindowIndex, metric) ?? "x"}`).join("|");
        const cacheKey = `${selectedProvinceId}:${selectedDay}:${selectedWindowIndex}:${metric}:${boundary.features.length}:${dataVersion}`;
        let surface = heatSurfaceCache.get(cacheKey);
        if (surface === undefined) {
          surface = createHeatSurface(boundary, points, selectedDay, selectedWindowIndex, metric);
          heatSurfaceCache.set(cacheKey, surface);
          if (heatSurfaceCache.size > MAX_HEAT_SURFACES) heatSurfaceCache.delete(heatSurfaceCache.keys().next().value!);
        }
        if (surface) surfaceRef.current = L.imageOverlay(surface.url, surface.bounds, { opacity: 1, interactive: false }).addTo(map);
        boundaryRef.current?.bringToFront();
      }
      if (!showPoints) return;
      points.forEach((point) => {
        const value = pointValue(point, selectedDay, selectedWindowIndex, metric);
        if (value === null) return;
        const color = metric === "heat-index" ? getHeatRisk(value).color : value < 32 ? "#fbbf24" : value < 36 ? "#f97316" : "#dc2626";
        L.circleMarker([point.lat, point.lng], { radius: Math.max(9, Math.min(19, 9 + (value - 25) * 0.6)), color: "#ffffff", weight: 2, fillColor: color, fillOpacity: 0.78 })
          .bindTooltip(`<b>${point.label}</b><br>${metric === "heat-index" ? "Heat Index" : "อุณหภูมิ"} ${value.toFixed(1)}°C`, { direction: "top" })
          .addTo(layer);
      });
    });
  }, [boundary, boundaryState, mapReady, metric, points, selectedDay, selectedProvinceId, selectedWindowIndex, showPoints]);

  const hotspots = useMemo(() => [...points].map((point) => ({ point, value: pointWindow(point, selectedDay, selectedWindowIndex)?.maxHeatIndexC ?? null })).filter((item): item is { point: HeatPoint; value: number } => item.value !== null).sort((a, b) => b.value - a.value).slice(0, 5), [points, selectedDay, selectedWindowIndex]);
  const startDayIndex = Math.max(0, days.findIndex((forecastDay) => forecastDay.dateKey === bangkokNow.dateKey));
  const selectedHeatSeries = useMemo(() => selectedLocation ? Array.from({ length: 16 }, (_, index) => {
    const absoluteWindow = currentWindowIndex + index;
    const dayIndex = startDayIndex + Math.floor(absoluteWindow / 8);
    const windowIndex = absoluteWindow % 8;
    const heatAnchors = points.map((point) => ({ lat: point.lat, lng: point.lng, value: pointValue(point, dayIndex, windowIndex, "heat-index") }))
      .filter((anchor): anchor is { lat: number; lng: number; value: number } => anchor.value !== null);
    const tempAnchors = points.map((point) => ({ lat: point.lat, lng: point.lng, value: pointValue(point, dayIndex, windowIndex, "temperature") }))
      .filter((anchor): anchor is { lat: number; lng: number; value: number } => anchor.value !== null);
    const heat = spatialIdw(selectedLocation.lat, selectedLocation.lng, heatAnchors, { maxDistanceKm: 55, maxNeighbors: 12, minNeighbors: 3 });
    const temperature = spatialIdw(selectedLocation.lat, selectedLocation.lng, tempAnchors, { maxDistanceKm: 55, maxNeighbors: 12, minNeighbors: 3 });
    return {
      label: `${days[dayIndex]?.weekday ?? ""} ${String(windowIndex * 3).padStart(2, "0")}`,
      primary: heat === null ? null : Math.round(heat * 10) / 10,
      secondary: temperature === null ? null : Math.round(temperature * 10) / 10,
    };
  }) : [], [currentWindowIndex, days, points, selectedLocation, startDayIndex]);
  const getHeatSnapshot = useCallback((lat: number, lng: number) => {
    const anchors = points.map((point) => ({ lat: point.lat, lng: point.lng, value: pointValue(point, selectedDay, selectedWindowIndex, metric) }))
      .filter((anchor): anchor is { lat: number; lng: number; value: number } => anchor.value !== null);
    const otherMetric: MetricMode = metric === "heat-index" ? "temperature" : "heat-index";
    const otherAnchors = points.map((point) => ({ lat: point.lat, lng: point.lng, value: pointValue(point, selectedDay, selectedWindowIndex, otherMetric) }))
      .filter((anchor): anchor is { lat: number; lng: number; value: number } => anchor.value !== null);
    const interpolated = spatialIdw(lat, lng, anchors, { maxDistanceKm: 55, maxNeighbors: 12, minNeighbors: 3 });
    const other = spatialIdw(lat, lng, otherAnchors, { maxDistanceKm: 55, maxNeighbors: 12, minNeighbors: 3 });
    const value = interpolated === null ? null : Math.round(interpolated * 10) / 10;
    const level = metric === "heat-index" ? getHeatRisk(value) : value === null
      ? { label: "ไม่มีข้อมูล", color: "#94a3b8" }
      : value < 30 ? { label: "อากาศค่อนข้างร้อน", color: "#facc15" }
      : value < 34 ? { label: "อากาศร้อน", color: "#f59e0b" }
      : value < 38 ? { label: "ร้อนจัด", color: "#f97316" }
      : { label: "ร้อนจัดมาก", color: "#dc2626" };
    return {
      value,
      valueLabel: metric === "heat-index" ? "Heat Index" : "อุณหภูมิ",
      unit: "°C",
      secondary: other === null ? undefined : `${otherMetric === "heat-index" ? "Heat Index" : "อุณหภูมิ"} ${other.toFixed(1)}°C`,
      interpretation: value === null ? "อยู่นอกระยะข้อมูล" : level.label,
      color: level.color,
    };
  }, [metric, points, selectedDay, selectedWindowIndex]);
  const { hover: mapHover, selectedArea } = useMapForecastInteraction({
    mapReady,
    mapRef,
    selection: selectedLocation,
    getSnapshot: getHeatSnapshot,
    onSelect: setSelectedLocation,
  });
  const chartMax = Math.max(42, ...days.map((item) => item.maxHeatIndexC ?? 0));

  return (
    <main className="app-shell heat-shell">
      <header className={`dashboard-banner heat-banner ${dataState}`}>
        <div className="banner-copy">
          <span className="banner-kicker">BKK Heat Forecast</span>
          <h1>พยากรณ์ความร้อน <em>{selectedRegion.shortNameTh}</em></h1>
          <p>อุณหภูมิและ Heat Index รายช่วง 3 ชั่วโมง ล่วงหน้า 7 วัน</p>
        </div>
        <ProvinceSelector value={selectedProvinceId} onChange={selectProvince} />
        <OutlookNav active="heat" province={selectedProvinceId} />
        <div className="banner-status" role="status"><span className={`status-dot ${dataState}`} /><div><span>{dataState === "live" ? "ข้อมูลอัปเดตแล้ว" : dataState === "degraded" ? "ข้อมูลอัปเดตบางส่วน" : dataState === "unavailable" ? "ข้อมูลไม่พร้อมใช้งาน" : "กำลังโหลดข้อมูล"}</span><b>{formatUpdated(payload?.fetchedAt)}</b></div></div>
      </header>

      <section className="workspace heat-workspace">
        <aside className="control-panel heat-control-panel" aria-label="เลือกวันและตัวแปรพยากรณ์ความร้อน">
          <div className="panel-section">
            <div className="panel-title"><span>📅 เลือกวันพยากรณ์</span><small>7 วันล่วงหน้า</small></div>
            <nav className="sidebar-days" aria-label="เลือกวันพยากรณ์">
              {days.map((item, index) => {
                const itemRisk = getHeatRisk(item.pointMaxHeatIndexC ?? item.maxHeatIndexC);
                return <button key={item.dateKey} className={`sidebar-day-btn heat-day-btn ${selectedDay === index ? "active" : ""}`} onClick={() => setSelectedDay(index)} aria-pressed={selectedDay === index}>
                  <div className="day-btn-left"><b className="day-name">{item.weekday}</b><span className="day-date">{item.date}</span></div>
                  <div className="day-btn-right"><span className="heat-day-values"><b>{item.maxTemperatureC ?? "—"}°</b><em style={{ color: selectedDay === index ? "#fff" : itemRisk.color }}>HI {item.maxHeatIndexC ?? "—"}°</em></span></div>
                </button>;
              })}
            </nav>
          </div>
          <div className="panel-section heat-time-section">
            <div className="panel-title"><span>🕒 เลือกช่วงเวลา</span><small>ช่วงละ 3 ชั่วโมง</small></div>
            <div className="heat-panel-windows" role="group" aria-label="เลือกช่วงเวลาพยากรณ์ความร้อน 3 ชั่วโมง">
              {(dayWindows.length ? dayWindows : Array.from({ length: 8 }, (_, windowIndex) => {
                const startHour = windowIndex * 3;
                const endHour = (startHour + 3) % 24;
                return { windowIndex, label: `${String(startHour).padStart(2, "0")}:00–${String(endHour).padStart(2, "0")}:00 น.`, maxTemperatureC: null, maxHeatIndexC: null, pointMaxHeatIndexC: null };
              })).map((window) => {
                const isActive = selectedWindowIndex === window.windowIndex;
                const isNow = selectedDayIsToday && window.windowIndex === currentWindowIndex;
                const isPeak = window.windowIndex === peakWindowIndex;
                const windowRisk = getHeatRisk(window.pointMaxHeatIndexC ?? window.maxHeatIndexC);
                return <button key={window.windowIndex} className={`panel-window-btn heat-window-btn ${isActive ? "active" : ""}`} onClick={() => setSelectedWindowIndex(window.windowIndex)} aria-pressed={isActive} disabled={!dayWindows.length} title={`${window.label} · Heat Index ${window.maxHeatIndexC ?? "ไม่มีข้อมูล"} องศา`}>
                  <div className="window-time-wrap"><i className="window-color-dot" style={{ backgroundColor: isActive ? "#fff" : windowRisk.color }} /><span className="window-clock">{window.label}</span></div>
                  <div className="window-val-wrap"><b className="window-prob">HI {window.maxHeatIndexC ?? "—"}°</b><small className="window-prob-secondary">{window.maxTemperatureC ?? "—"}°C</small>{isNow && <em className="badge-now">ตอนนี้</em>}{isPeak && !isNow && <em className="badge-peak">ร้อนสุด</em>}</div>
                </button>;
              })}
            </div>
          </div>
          <div className="panel-section heat-metric-section">
            <div className="panel-title"><span>🗺️ ชั้นข้อมูลบนแผนที่</span></div>
            <div className="heat-metric-switch" role="group" aria-label="เลือกชั้นข้อมูลความร้อน">
              <button className={metric === "heat-index" ? "active" : ""} onClick={() => setMetric("heat-index")} aria-pressed={metric === "heat-index"}><b>Heat Index</b><small>ความร้อนที่ร่างกายรับรู้</small></button>
              <button className={metric === "temperature" ? "active" : ""} onClick={() => setMetric("temperature")} aria-pressed={metric === "temperature"}><b>อุณหภูมิสูงสุด</b><small>ค่าสูงสุดในช่วง 3 ชั่วโมง</small></button>
            </div>
          </div>
          <div className="panel-section heat-trend-section">
            <div className="panel-title"><span>📈 แนวโน้ม 7 วัน</span><small>ค่าเฉลี่ยพื้นที่</small></div>
            <div className="heat-bars" role="img" aria-label="แนวโน้ม Heat Index เจ็ดวัน">
              {days.map((item, index) => <button key={item.dateKey} onClick={() => setSelectedDay(index)} className={selectedDay === index ? "active" : ""} title={`${item.weekday} Heat Index ${item.maxHeatIndexC ?? "ไม่มีข้อมูล"} องศา`}><b>{item.maxHeatIndexC ?? "—"}</b><i style={{ height: `${Math.max(12, ((item.maxHeatIndexC ?? 25) / chartMax) * 100)}%`, background: getHeatRisk(item.maxHeatIndexC).color }} /><small>{item.weekday}</small></button>)}
            </div>
          </div>
        </aside>

        <div className="map-card heat-map-card">
          <div className="map-wrap">
            <div ref={mapElementRef} className="map" data-basemap={basemap} data-map-theme={mapTheme} role="application" aria-label={`แผนที่พยากรณ์ความร้อน ${selectedRegion.nameTh} ${day?.weekday ?? ""} ${day?.date ?? ""} ${selectedWindow?.label ?? ""}`} />
            <MapForecastHover hover={mapHover} />
            {dataState === "unavailable" && <div className="forecast-unavailable" role="alert"><b>ยังโหลดข้อมูลความร้อนไม่ได้</b><span>ระบบปิดค่าบนแผนที่เพื่อป้องกันความเข้าใจผิด</span><button onClick={() => { setDataState("loading"); setReloadKey((value) => value + 1); }}>ลองใหม่</button></div>}
            <div className="layer-menu">
              <button className="layer-menu-trigger" onClick={() => setLayerMenuOpen((open) => !open)} aria-expanded={layerMenuOpen} aria-label="ตั้งค่าแผนที่"><span className="layer-symbol"><i /><i /><i /></span></button>
              <div className="layer-menu-panel heat-layer-panel" hidden={!layerMenuOpen}>
                <strong>ชั้นข้อมูลความร้อน</strong>
                <div className="layer-static"><span aria-hidden="true">✓</span>พื้นผิว IDW ตามขอบเขตพื้นที่</div>
                <label className="range-toggle" htmlFor="heat-points-toggle"><input id="heat-points-toggle" type="checkbox" checked={showPoints} onChange={(event) => setShowPoints(event.target.checked)} /><span />แสดงจุดข้อมูลแบบจำลอง</label>
                <small className="heat-layer-note">คำนวณจากจุดใกล้เคียงสูงสุด 12 จุด และเว้นพื้นที่ที่ข้อมูลไม่เพียงพอ</small>
                <div className="basemap-layer-section"><small className="basemap-section-title">แผนที่ฐาน</small><div className="basemap-switcher-grid"><button className={`basemap-option-btn ${basemap === "street" ? "active" : ""}`} onClick={() => setBasemap("street")}>{mapTheme === "dark" ? "🌙 แผนที่มืด" : "🗺️ ถนน"}</button><button className={`basemap-option-btn ${basemap === "satellite" ? "active" : ""}`} onClick={() => setBasemap("satellite")}>🛰️ ดาวเทียม</button></div></div>
              </div>
            </div>
            <div className="map-metric heat-map-metric"><span>{metric === "heat-index" ? "Heat Index เฉลี่ยช่วงนี้" : "อุณหภูมิเฉลี่ยช่วงนี้"}</span><strong>{focusValue ?? "—"}<small>°C</small></strong><b style={{ color: metric === "heat-index" ? risk.color : "#ea580c" }}>{metric === "heat-index" ? `จุดสูงสุด ${selectedWindow?.pointMaxHeatIndexC ?? "—"}°C · ${risk.label}` : `บางจุด ${selectedWindow?.pointMaxTemperatureC ?? "—"}°C`}</b><em>{day?.weekday} {day?.date} · {selectedWindow?.label ?? "เลือกช่วงเวลา"}</em></div>
            <div className={`surface-status heat-surface-status ${boundaryState}`}><b>{dataState === "live" ? "ข้อมูลพร้อมใช้งาน" : dataState === "degraded" ? "ข้อมูลบางส่วน" : "กำลังตรวจข้อมูล"}</b><span>พื้นผิว IDW · {points.length} จุด · {selectedWindow?.label ?? "รอข้อมูลช่วงเวลา"}</span><em>{payload?.dataQuality.tmdStatus === "live" ? "ใช้ TMD NWP ประกอบช่วง 48 ชม.แรก" : payload?.dataQuality.tmdStatus === "unavailable" ? "TMD ไม่พร้อม ใช้ Open-Meteo สำรอง" : "ยังไม่ได้เชื่อม TMD ในสภาพแวดล้อมนี้"}</em></div>
            {metric === "heat-index" ? <div className="legend heat-legend" aria-label="ระดับ Heat Index"><span><i style={{ background: "#22c55e" }} />27–32.9 เฝ้าระวัง</span><span><i style={{ background: "#eab308" }} />33–41.9 เตือนภัย</span><span><i style={{ background: "#f97316" }} />42–51.9 อันตราย</span><span><i style={{ background: "#dc2626" }} />≥52 อันตรายมาก</span><small>Heat Index · °C</small></div> : <div className="legend heat-legend" aria-label="ระดับอุณหภูมิสูงสุด"><span><i style={{ background: "#38bdf8" }} />ต่ำกว่า 30°C</span><span><i style={{ background: "#facc15" }} />30–33.9°C</span><span><i style={{ background: "#f97316" }} />34–37.9°C</span><span><i style={{ background: "#dc2626" }} />≥38°C</span><small>อุณหภูมิสูงสุด · °C</small></div>}
          </div>
        </div>

        <aside className="insights heat-insights">
          <LocationForecastCard kind="heat" selection={selectedLocation} series={selectedHeatSeries} placeName={selectedArea?.label} onClear={() => setSelectedLocation(null)} />
          <div className="heat-risk-card" style={{ "--heat-risk": risk.color } as React.CSSProperties}><span>ระดับสูงสุดในช่วงที่เลือก</span><strong>{selectedWindow?.pointMaxHeatIndexC ?? "—"}<small>°C</small></strong><b>{risk.label}</b><p>{risk.guidance}</p></div>
          <div className="heat-dual-card"><span>ภาพรวมช่วง {selectedWindow?.label ?? "ที่เลือก"}</span><div><p><small>อุณหภูมิเฉลี่ย</small><b>{selectedWindow?.maxTemperatureC ?? "—"}°C</b></p><p><small>Heat Index เฉลี่ย</small><b>{selectedWindow?.maxHeatIndexC ?? "—"}°C</b></p></div><em>จุดร้อนสุดประมาณ {selectedWindow?.peakHour ?? "—"}</em></div>
          <div className="heat-hotspots"><div className="panel-title"><span>พื้นที่ตัวอย่างที่ร้อนสุด</span><small>{selectedWindow?.label ?? "ตามช่วงที่เลือก"}</small></div><ol>{hotspots.map(({ point, value }) => <li key={point.id}><span>{point.label}</span><b>{value.toFixed(1)}°</b><i style={{ background: getHeatRisk(value).color }} /></li>)}</ol></div>
          <div className="forecast-note"><span>!</span><p><b>ใช้เพื่อวางแผนเบื้องต้น</b>{payload?.disclaimer ?? "Heat Index ขึ้นกับอุณหภูมิและความชื้นจริง ณ ตำแหน่งนั้น"}<small>กลุ่มเสี่ยงควรติดตามประกาศกรมอุตุนิยมวิทยาและคำแนะนำกรมอนามัยเพิ่มเติม</small></p></div>
        </aside>
      </section>
    </main>
  );
}
