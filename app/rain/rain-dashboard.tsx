"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OutlookNav from "../components/outlook-nav";
import {
  buildRainDayShells,
  rainAmountLevel,
  type RainForecastPayload,
  type RainPoint,
} from "../lib/rain-forecast-data";
import "leaflet/dist/leaflet.css";

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
type MetricMode = "probability" | "rain";

const fallbackBoundary: BoundaryCollection = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: { NAME_T: "กรุงเทพมหานคร (ขอบเขตสำรอง)" },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [100.327, 13.652], [100.376, 13.615], [100.47, 13.63], [100.568, 13.645],
        [100.668, 13.638], [100.759, 13.69], [100.875, 13.735], [100.915, 13.816],
        [100.895, 13.925], [100.801, 13.956], [100.703, 13.951], [100.622, 13.934],
        [100.533, 13.961], [100.442, 13.914], [100.348, 13.861], [100.327, 13.779],
        [100.327, 13.652],
      ]],
    },
  }],
};

const probabilityStops = [
  { value: 0, color: [220, 247, 250] },
  { value: 20, color: [116, 222, 235] },
  { value: 40, color: [48, 169, 220] },
  { value: 60, color: [42, 105, 194] },
  { value: 80, color: [61, 64, 157] },
  { value: 100, color: [91, 33, 132] },
];

const rainStops = [
  { value: 0, color: [220, 247, 250] },
  { value: 1, color: [116, 222, 235] },
  { value: 5, color: [48, 169, 220] },
  { value: 10, color: [42, 105, 194] },
  { value: 20, color: [61, 64, 157] },
  { value: 35, color: [91, 33, 132] },
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

function interpolateColor(value: number, mode: MetricMode) {
  const stops = mode === "probability" ? probabilityStops : rainStops;
  const upperIndex = stops.findIndex((stop) => value <= stop.value);
  if (upperIndex <= 0) return stops[0].color;
  if (upperIndex === -1) return stops[stops.length - 1].color;
  const lower = stops[upperIndex - 1];
  const upper = stops[upperIndex];
  const ratio = (value - lower.value) / (upper.value - lower.value || 1);
  return lower.color.map((channel, index) => Math.round(channel + (upper.color[index] - channel) * ratio));
}

function getPointWindow(point: RainPoint, dayIndex: number, windowIndex: number) {
  return point.windows.find((window) => window.dayIndex === dayIndex && window.windowIndex === windowIndex);
}

function getPointValue(point: RainPoint, dayIndex: number, windowIndex: number, mode: MetricMode) {
  const window = getPointWindow(point, dayIndex, windowIndex);
  return mode === "probability" ? window?.probabilityMax ?? null : window?.rainMm ?? null;
}

function interpolateIdw(lng: number, lat: number, values: Array<{ point: RainPoint; value: number }>) {
  const longitudeScale = Math.cos((lat * Math.PI) / 180);
  let weightedValue = 0;
  let totalWeight = 0;
  for (const { point, value } of values) {
    const dx = (lng - point.lng) * longitudeScale;
    const dy = lat - point.lat;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared < 0.0000002) return value;
    const weight = 1 / distanceSquared;
    weightedValue += value * weight;
    totalWeight += weight;
  }
  return totalWeight ? weightedValue / totalWeight : 0;
}

function createRainSurface(
  boundary: BoundaryCollection,
  points: RainPoint[],
  dayIndex: number,
  windowIndex: number,
  mode: MetricMode,
) {
  const values = points
    .map((point) => ({ point, value: getPointValue(point, dayIndex, windowIndex, mode) }))
    .filter((entry): entry is { point: RainPoint; value: number } => entry.value !== null);
  if (values.length < 3) return null;

  const bounds = getBoundaryBounds(boundary);
  const width = 460;
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
      const value = interpolateIdw(lng, lat, values);
      const [red, green, blue] = interpolateColor(value, mode);
      image.data[pixelIndex] = red;
      image.data[pixelIndex + 1] = green;
      image.data[pixelIndex + 2] = blue;
      image.data[pixelIndex + 3] = value <= 0.05 ? 90 : 170;
    }
  }
  surfaceContext.putImageData(image, 0, 0);
  return {
    url: surfaceCanvas.toDataURL("image/png"),
    bounds: [[bounds.minLat, bounds.minLng], [bounds.maxLat, bounds.maxLng]] as [[number, number], [number, number]],
  };
}

function formatFetchedAt(value: string) {
  if (!value) return "รอข้อมูลล่าสุด";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "รอข้อมูลล่าสุด";
  return new Intl.DateTimeFormat("th-TH-u-nu-latn", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(date).replace(".", "");
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
  return {
    dateKey: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
  };
}

function getPeakWindowIndex(windows: RainForecastPayload["windows"], dayIndex: number) {
  const peak = windows
    .filter((window) => window.dayIndex === dayIndex)
    .sort((a, b) =>
      (b.rainMeanMm ?? -1) - (a.rainMeanMm ?? -1) ||
      (b.probabilityMax ?? -1) - (a.probabilityMax ?? -1),
    )[0];
  return peak?.windowIndex ?? 0;
}

export default function RainDashboard() {
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedWindowIndex, setSelectedWindowIndex] = useState(0);
  const [days, setDays] = useState(() => buildRainDayShells());
  const [windows, setWindows] = useState<RainForecastPayload["windows"]>([]);
  const [points, setPoints] = useState<RainPoint[]>([]);
  const [fetchedAt, setFetchedAt] = useState("");
  const [model, setModel] = useState("กำลังเชื่อมต่อข้อมูลพยากรณ์จริง");
  const [disclaimer, setDisclaimer] = useState("ค่าประมาณจากแบบจำลอง ไม่ใช่เรดาร์ฝนหรือประกาศเตือนภัย");
  const [dataState, setDataState] = useState<RainForecastPayload["status"] | "loading">("loading");
  const [metricMode, setMetricMode] = useState<MetricMode>("probability");
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [boundary, setBoundary] = useState<BoundaryCollection | null>(null);
  const [boundaryState, setBoundaryState] = useState<"loading" | "official" | "fallback">("loading");
  const [mapReady, setMapReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const layerMenuRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const surfaceLayerRef = useRef<import("leaflet").ImageOverlay | null>(null);
  const boundaryLayerRef = useRef<import("leaflet").GeoJSON | null>(null);
  const selectedDayRef = useRef(0);

  const loadForecast = useCallback(() => {
    let active = true;
    fetch("/api/rain-forecast", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("rain forecast unavailable");
        return response.json() as Promise<RainForecastPayload>;
      })
      .then((payload) => {
        if (!active) return;
        setDays(payload.days);
        setWindows(payload.windows);
        setPoints(payload.points);
        setFetchedAt(payload.fetchedAt);
        setModel(payload.model);
        setDisclaimer(payload.disclaimer);
        setDataState(payload.status);
        const bangkokNow = getBangkokDateParts();
        const activeDayIndex = Math.min(selectedDayRef.current, Math.max(0, payload.days.length - 1));
        const activeDayIsToday = payload.days[activeDayIndex]?.dateKey === bangkokNow.dateKey;
        setSelectedWindowIndex(activeDayIsToday
          ? Math.min(7, Math.floor(bangkokNow.hour / 3))
          : getPeakWindowIndex(payload.windows, activeDayIndex));
      })
      .catch(() => {
        if (!active) return;
        setPoints([]);
        setWindows([]);
        setDataState("unavailable");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => loadForecast(), [loadForecast, reloadKey]);

  useEffect(() => {
    let active = true;
    fetch("/api/bangkok-boundary")
      .then((response) => {
        if (!response.ok) throw new Error("boundary unavailable");
        return response.json() as Promise<BoundaryCollection>;
      })
      .then((payload) => {
        if (!active) return;
        setBoundary(payload);
        setBoundaryState("official");
      })
      .catch(() => {
        if (!active) return;
        setBoundary(fallbackBoundary);
        setBoundaryState("fallback");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!layerMenuOpen) return;
    const closeOnPointer = (event: PointerEvent) => {
      if (!layerMenuRef.current?.contains(event.target as Node)) setLayerMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLayerMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [layerMenuOpen]);

  useEffect(() => {
    let cancelled = false;
    if (!mapElementRef.current || mapInstanceRef.current) return;
    import("leaflet").then((leafletModule) => {
      if (cancelled || !mapElementRef.current || mapInstanceRef.current) return;
      const L = leafletModule.default;
      const map = L.map(mapElementRef.current, {
        zoomControl: true,
        attributionControl: true,
        minZoom: 9,
        maxZoom: 15,
      }).setView([13.765, 100.595], 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      map.createPane("rainSurfacePane").style.zIndex = "350";
      map.getPane("rainSurfacePane")!.style.pointerEvents = "none";
      map.createPane("rainBoundaryPane").style.zIndex = "420";
      map.getPane("rainBoundaryPane")!.style.pointerEvents = "none";
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
      const surface = createRainSurface(boundary, points, selectedDay, selectedWindowIndex, metricMode);
      surfaceLayerRef.current = surface ? L.imageOverlay(surface.url, surface.bounds, {
        pane: "rainSurfacePane",
        opacity: 0.8,
        interactive: false,
      }).addTo(map) : null;
      boundaryLayerRef.current = L.geoJSON(boundary as GeoJSON.GeoJsonObject, {
        pane: "rainBoundaryPane",
        style: { color: "#173d66", weight: 1.05, opacity: 0.76, fillOpacity: 0 },
      }).addTo(map);
      if (boundaryState === "official") {
        map.fitBounds(boundaryLayerRef.current.getBounds(), { padding: [14, 14], animate: false });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [boundary, boundaryState, mapReady, metricMode, points, selectedDay, selectedWindowIndex]);

  const day = days[selectedDay] ?? days[0];
  const dayWindows = useMemo(
    () => windows.filter((window) => window.dayIndex === selectedDay),
    [selectedDay, windows],
  );
  const selectedWindow = dayWindows.find((window) => window.windowIndex === selectedWindowIndex) ?? null;
  const selectedPointData = useMemo(() => points.map((point) => ({
    point,
    window: getPointWindow(point, selectedDay, selectedWindowIndex),
  })).filter((entry) => entry.window), [points, selectedDay, selectedWindowIndex]);
  const sortedPoints = useMemo(() => [...points]
    .filter((point) => point.daily[selectedDay]?.rainMm !== null)
    .sort((a, b) => (b.daily[selectedDay]?.rainMm ?? -1) - (a.daily[selectedDay]?.rainMm ?? -1))
    .slice(0, 5), [points, selectedDay]);
  const highestPoint = sortedPoints[0];
  const selectedMaxProbability = selectedPointData.length
    ? Math.max(...selectedPointData.map(({ window }) => window?.probabilityMax ?? 0))
    : null;
  const selectedMeanRain = selectedWindow?.rainMeanMm ?? null;
  const dailyProbabilities = days.map((forecastDay) => forecastDay.probabilityMax ?? 0);
  const bangkokNow = getBangkokDateParts();
  const currentWindowIndex = Math.min(7, Math.floor(bangkokNow.hour / 3));
  const selectedDayIsToday = day?.dateKey === bangkokNow.dateKey;
  const peakWindowIndex = getPeakWindowIndex(windows, selectedDay);

  const selectDay = (index: number) => {
    selectedDayRef.current = index;
    setSelectedDay(index);
    const selectedDateIsToday = days[index]?.dateKey === bangkokNow.dateKey;
    setSelectedWindowIndex(selectedDateIsToday ? currentWindowIndex : getPeakWindowIndex(windows, index));
  };

  const retryForecast = () => {
    setDataState("loading");
    setReloadKey((value) => value + 1);
  };

  const dataStateLabel = dataState === "live"
    ? "ข้อมูลจริงอัปเดตแล้ว"
    : dataState === "degraded"
      ? "ข้อมูลอัปเดตบางส่วน"
      : dataState === "unavailable"
        ? "โหลดพยากรณ์ไม่สำเร็จ"
        : "กำลังโหลดพยากรณ์ฝน";

  return (
    <main className="app-shell rain-shell">
      <header className={`dashboard-banner rain-banner ${dataState}`} id="top">
        <div className="banner-copy">
          <span className="banner-kicker">BKK AIR FORECAST · RAIN</span>
          <h1>แผนที่พยากรณ์ <em>ฝนกรุงเทพฯ</em></h1>
          <p>เช็กโอกาสฝนและปริมาณฝนสะสมล่วงหน้า 1–5 วัน พร้อมช่วงเวลาที่ควรเฝ้าระวัง</p>
        </div>
        <OutlookNav active="rain" />
        <div className="banner-status" role="status" aria-live="polite">
          <span className={`status-dot ${dataState}`} aria-hidden="true" />
          <div>
            <span>{dataStateLabel}</span>
            <b>{formatFetchedAt(fetchedAt)}</b>
          </div>
        </div>
      </header>

      <nav className="day-tabs rain-day-tabs" aria-label="เลือกวันพยากรณ์ฝน">
        {days.map((forecastDay, index) => (
          <button
            key={forecastDay.dateKey}
            className={selectedDay === index ? "active" : ""}
            onClick={() => selectDay(index)}
            aria-pressed={selectedDay === index}
          >
            <b>{forecastDay.weekday} {forecastDay.date}</b>
            <i style={{ backgroundColor: rainAmountLevel(forecastDay.rainMeanMm).color }} />
            <small>{forecastDay.probabilityMax === null ? "รอข้อมูล" : `สูงสุด ${forecastDay.probabilityMax}% · ${forecastDay.rainMeanMm ?? "—"} มม.`}</small>
          </button>
        ))}
      </nav>

      <section className="workspace rain-workspace">
        <div className="map-card">
          <div className="rain-window-strip" aria-label="เลือกช่วงเวลาพยากรณ์ 3 ชั่วโมง">
            <div>
              <span>ช่วงเวลา</span>
              <b>{day?.weekday} {day?.date}</b>
            </div>
            <div className="rain-window-buttons">
              {(dayWindows.length ? dayWindows : Array.from({ length: 8 }, (_, index) => ({ windowIndex: index, label: `${String(index * 3).padStart(2, "0")}:00`, probabilityMax: null }))).map((window) => (
                <button
                  key={window.windowIndex}
                  className={selectedWindowIndex === window.windowIndex ? "active" : ""}
                  onClick={() => setSelectedWindowIndex(window.windowIndex)}
                  aria-pressed={selectedWindowIndex === window.windowIndex}
                  disabled={!dayWindows.length}
                >
                  <span>{window.label.split("–")[0]}</span>
                  <b>{window.probabilityMax === null ? "—" : `${window.probabilityMax}%`}</b>
                  {selectedDayIsToday && window.windowIndex === currentWindowIndex
                    ? <em>ตอนนี้</em>
                    : window.windowIndex === peakWindowIndex && <em>ช่วงเด่น</em>}
                </button>
              ))}
            </div>
          </div>

          <div className="map-wrap rain-map-wrap">
            <div ref={mapElementRef} className="map rain-map" role="region" aria-label={`แผนที่พยากรณ์ฝน ${day?.weekday ?? ""} ${day?.date ?? ""} ${selectedWindow?.label ?? ""}`} />
            <div className="layer-menu" ref={layerMenuRef}>
              <button
                className="layer-menu-trigger"
                type="button"
                onClick={() => setLayerMenuOpen((open) => !open)}
                aria-label="เลือกชั้นข้อมูลแผนที่ฝน"
                aria-expanded={layerMenuOpen}
                aria-controls="rain-layer-menu"
              >
                <span className="layer-symbol" aria-hidden="true"><i /><i /><i /></span>
              </button>
              <div className="layer-menu-panel rain-layer-panel" id="rain-layer-menu" hidden={!layerMenuOpen}>
                <strong>สีบนแผนที่</strong>
                <div className="rain-metric-options" role="group" aria-label="ตัวชี้วัดบนแผนที่">
                  <button aria-pressed={metricMode === "probability"} onClick={() => setMetricMode("probability")}>โอกาสฝน</button>
                  <button aria-pressed={metricMode === "rain"} onClick={() => setMetricMode("rain")}>ปริมาณฝน</button>
                </div>
                <div className="layer-static"><span aria-hidden="true">✓</span>พื้นผิว IDW เท่านั้น</div>
              </div>
            </div>

            <div className="map-metric rain-map-metric">
              <span>โอกาสฝนสูงสุด · 3 ชม.</span>
              <strong>{selectedMaxProbability ?? "—"}<small>%</small></strong>
              <b>{selectedMeanRain === null ? "รอข้อมูล" : `ฝนเฉลี่ย ${selectedMeanRain} มม.`}</b>
            </div>

            <div className={`surface-status rain-surface-status ${dataState}`} aria-live="polite">
              <b>{dataStateLabel}</b>
              <span>{points.length ? `พื้นผิว IDW · ${selectedWindow?.label ?? "ช่วงที่เลือก"}` : "ยังไม่มีข้อมูลพยากรณ์สำหรับช่วงนี้"}</span>
              <em>{boundaryState === "official" ? "ขอบเขต 50 เขต · สีเป็นการประมาณเชิงพื้นที่" : boundaryState === "fallback" ? "กำลังใช้ขอบเขตสำรอง" : "กำลังโหลดขอบเขตกรุงเทพฯ"}</em>
            </div>

            {dataState === "unavailable" && (
              <div className="rain-error-panel" role="alert">
                <strong>โหลดข้อมูลฝนไม่สำเร็จ</strong>
                <span>ระบบไม่แสดงค่าฝนจำลองแทนข้อมูลจริง</span>
                <button onClick={retryForecast}>ลองอีกครั้ง</button>
              </div>
            )}

            <div className="legend rain-legend" aria-label={metricMode === "probability" ? "คำอธิบายโอกาสฝน" : "คำอธิบายปริมาณฝนใน 3 ชั่วโมง"}>
              {metricMode === "probability" ? (
                <>
                  <span><i style={{ background: "#dcf7fa" }} />0%</span>
                  <span><i style={{ background: "#74deeb" }} />20%</span>
                  <span><i style={{ background: "#30a9dc" }} />40%</span>
                  <span><i style={{ background: "#2a69c2" }} />60%</span>
                  <span><i style={{ background: "#3d409d" }} />80%</span>
                  <small>โอกาสฝน</small>
                </>
              ) : (
                <>
                  <span><i style={{ background: "#dcf7fa" }} />0</span>
                  <span><i style={{ background: "#74deeb" }} />1</span>
                  <span><i style={{ background: "#30a9dc" }} />5</span>
                  <span><i style={{ background: "#2a69c2" }} />10</span>
                  <span><i style={{ background: "#3d409d" }} />20+</span>
                  <small>มม. / 3 ชม.</small>
                </>
              )}
            </div>
          </div>
        </div>

        <aside className="insights rain-insights" aria-label="สรุปพยากรณ์ฝนวันที่เลือก">
          <div className="average-card rain-average-card">
            <div
              className="average-ring rain-average-ring"
              style={{
                "--progress": `${(day?.probabilityMax ?? 0) * 3.6}deg`,
                "--metric-color": "#2a69c2",
              } as React.CSSProperties}
            >
              <span>{day?.probabilityMax ?? "—"}<small>%</small></span>
            </div>
            <div>
              <p>ภาพรวมฝน</p>
              <strong>{day?.rainMeanMm === null ? "รอข้อมูล" : `${rainAmountLevel(day?.rainMeanMm ?? null).label}`}</strong>
              <em>เฉลี่ย {day?.rainMeanMm ?? "—"} มม. · สูงสุด {day?.rainMaxMm ?? "—"} มม.</em>
            </div>
          </div>

          <div className="weather-card rain-weather-card">
            <p>ช่วงเวลาที่ควรเฝ้าระวัง</p>
            <div><span aria-hidden="true">◷</span><b>{day?.peakWindow ?? "ยังไม่มีข้อมูลช่วงเวลา"}</b></div>
            <div><span aria-hidden="true">≈</span><b>คาดว่ามีฝน {day?.wetHours ?? "—"} ชม. ตลอดวัน</b></div>
          </div>

          <div className="trend-card rain-trend-card">
            <div className="trend-heading">
              <p>แนวโน้ม 5 วัน</p>
              <span>โอกาสฝนสูงสุด</span>
            </div>
            <div className="trend-chart" role="group" aria-label="กราฟแนวโน้มโอกาสฝนสูงสุด 5 วัน">
              {dailyProbabilities.map((value, index) => (
                <button
                  key={days[index]?.dateKey ?? index}
                  className={selectedDay === index ? "active" : ""}
                  onClick={() => selectDay(index)}
                  aria-label={`${days[index]?.weekday ?? "วัน"} ${days[index]?.date ?? ""} โอกาสฝนสูงสุด ${days[index]?.probabilityMax ?? "ไม่มีข้อมูล"}${days[index]?.probabilityMax === null ? "" : " เปอร์เซ็นต์"}`}
                  aria-pressed={selectedDay === index}
                >
                  <span>{days[index]?.probabilityMax ?? "—"}</span>
                  <i style={{ height: `${Math.max(8, value)}%`, background: "linear-gradient(#4fc3e1, #3156ad)" }} />
                  <small>{days[index]?.weekday.slice(0, 2)}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="watch-card rain-watch-card">
            <p>พื้นที่แบบจำลองที่ควรติดตาม</p>
            <ol>
              {sortedPoints.length ? sortedPoints.map((point) => {
                const pointDay = point.daily[selectedDay];
                return (
                  <li key={point.id}>
                    <span>{point.label}</span>
                    <b>{pointDay?.rainMm ?? "—"} มม.</b>
                    <i style={{ background: rainAmountLevel(pointDay?.rainMm ?? null).color }} />
                  </li>
                );
              }) : <li className="rain-empty-row"><span>ยังไม่มีข้อมูลพื้นที่</span><b>—</b><i /></li>}
            </ol>
            <small>จุดประมาณการ 9 ตำแหน่ง ไม่ใช่สถานีตรวจวัดหรือค่ารายเขต</small>
          </div>

          <div className="forecast-note rain-forecast-note">
            <span aria-hidden="true">!</span>
            <p>
              <b>สรุปวันที่เลือก</b>
              {day?.probabilityMax === null ? "ยังโหลดข้อมูลไม่ได้" : `โอกาสฝนสูงสุด ${day.probabilityMax}% และฝนเฉลี่ย ${day.rainMeanMm ?? "—"} มม.${highestPoint ? ` พื้นที่แบบจำลองที่ควรติดตามคือ${highestPoint.label}` : ""}`}
              <small>{model} · อัปเดต {formatFetchedAt(fetchedAt)} · {disclaimer} <a href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">ที่มาข้อมูล</a></small>
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
