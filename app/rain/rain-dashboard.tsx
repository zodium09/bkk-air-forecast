"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OutlookNav from "../components/outlook-nav";
import ProvinceSelector from "../components/province-selector";
import LocationForecastCard, { type LocationSelection } from "../components/location-forecast-card";
import {
  buildRainDayShells,
  rainAmountLevel,
  type RainForecastPayload,
  type RainPoint,
} from "../lib/rain-forecast-data";
import {
  formatProbabilityContext,
  getDailyRainNarrative,
  getRainAdvisory,
  getRainLikelihood,
  getRainWatchLevel,
} from "../lib/rain-communication";
import { buildRainForecastUrl, rainForecastProviders } from "../lib/rain-forecast-provider";
import { FORECAST_DAYS } from "../lib/forecast-horizon";
import { spatialIdw } from "../lib/forecast/interpolation";
import { selectMapLabelLocations } from "../lib/forecast/map-labels";
import type { TmdRadarMode, TmdRadarPayload } from "../lib/tmd-radar-data";
import { METRO_REGION_ID, buildFallbackBoundary, getRegion, type RegionId } from "../lib/provinces";
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
type MetricMode = "probability" | "rain" | "daily-rain";
type RainViewMode = "forecast" | "watch";

const probabilityStops = [
  { value: 0, color: [255, 255, 255] },
  { value: 25, color: [186, 230, 253] },
  { value: 50, color: [56, 189, 248] },
  { value: 75, color: [37, 99, 235] },
  { value: 100, color: [109, 40, 217] },
];

const rainSurfaceCache = new Map<string, ReturnType<typeof createRainSurface>>();
const MAX_RAIN_SURFACES = 24;

const rainStops = [
  { value: 0, color: [255, 255, 255] },
  { value: 1, color: [186, 230, 253] },
  { value: 5, color: [56, 189, 248] },
  { value: 10, color: [37, 99, 235] },
  { value: 20, color: [109, 40, 217] },
];

const dailyRainStops = [
  { value: 0, color: [255, 255, 255] },
  { value: 10, color: [56, 189, 248] },
  { value: 35, color: [37, 99, 235] },
  { value: 90, color: [234, 88, 12] },
  { value: 150, color: [185, 28, 28] },
];

function getRainChanceColor(prob: number | null) {
  if (prob === null) return "#cbd5e1";
  if (prob <= 20) return "#94a3b8";
  if (prob <= 45) return "#38bdf8";
  if (prob <= 75) return "#2563eb";
  return "#6d28d9";
}

function buildSvgCurve(pts: Array<{ x: number; y: number }>) {
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
  const stops = mode === "probability" ? probabilityStops : mode === "daily-rain" ? dailyRainStops : rainStops;
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
  if (mode === "daily-rain") return point.daily[dayIndex]?.rainMm ?? null;
  const window = getPointWindow(point, dayIndex, windowIndex);
  return mode === "probability" ? window?.pointProbabilityPeak ?? null : window?.rainMm ?? null;
}

function getWeatherSymbol(weatherCode: number | null, probability: number | null, rainMm: number | null) {
  if (weatherCode !== null && weatherCode >= 95 && ((rainMm ?? 0) >= 0.1 || (probability ?? 0) >= 50)) {
    return { emoji: "⛈️", label: "เสี่ยงพายุฝนฟ้าคะนอง", severity: 6 };
  }
  if ((rainMm ?? 0) >= 5) {
    return { emoji: "🌧️", label: "ฝนปานกลางถึงหนัก", severity: 5 };
  }
  if ((rainMm ?? 0) >= 0.1 || (probability ?? 0) >= 55) {
    return { emoji: "🌦️", label: "มีฝนเป็นบางแห่ง", severity: 4 };
  }
  if (weatherCode !== null && weatherCode >= 45 && weatherCode <= 48) return { emoji: "🌫️", label: "มีหมอก", severity: 3 };
  if (weatherCode === 3 || (probability ?? 0) >= 30) return { emoji: "☁️", label: "เมฆมาก", severity: 2 };
  if (weatherCode === 1 || weatherCode === 2) return { emoji: "⛅", label: "มีเมฆบางส่วน", severity: 1 };
  return { emoji: "☀️", label: "ท้องฟ้าโปร่งถึงมีเมฆเล็กน้อย", severity: 0 };
}

function selectWeatherMarkers(points: RainPoint[], dayIndex: number, windowIndex: number, boundary: BoundaryCollection, viewMode: RainViewMode) {
  const probabilityValues = points
    .map((point) => ({ point, value: getPointValue(point, dayIndex, windowIndex, "probability") }))
    .filter((entry): entry is { point: RainPoint; value: number } => entry.value !== null);
  const rainValues = points
    .map((point) => ({ point, value: getPointValue(point, dayIndex, windowIndex, viewMode === "watch" ? "daily-rain" : "rain") }))
    .filter((entry): entry is { point: RainPoint; value: number } => entry.value !== null);

  return selectMapLabelLocations(boundary).map((location) => {
    const probabilityValue = interpolateIdw(location.lng, location.lat, probabilityValues);
    const rainValue = interpolateIdw(location.lng, location.lat, rainValues);
    const probability = probabilityValue === null ? null : Math.round(probabilityValue);
    const rainMm = rainValue === null ? null : Math.round(rainValue * 10) / 10;
    const nearestPoint = points.reduce((nearest, point) => {
      const pointDistance = (point.lat - location.lat) ** 2 + (point.lng - location.lng) ** 2;
      const nearestDistance = (nearest.lat - location.lat) ** 2 + (nearest.lng - location.lng) ** 2;
      return pointDistance < nearestDistance ? point : nearest;
    });
    const weatherCode = nearestPoint.daily[dayIndex]?.weatherCode ?? null;
    return {
      location,
      probability,
      rainMm,
      symbol: getWeatherSymbol(weatherCode, probability, rainMm),
      viewMode,
    };
  });
}

function interpolateIdw(lng: number, lat: number, values: Array<{ point: RainPoint; value: number }>) {
  return spatialIdw(lat, lng, values.map(({ point, value }) => ({
    lat: point.lat,
    lng: point.lng,
    value,
  })), {
    maxDistanceKm: 55,
    maxNeighbors: 12,
    minNeighbors: 3,
  });
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
      const value = interpolateIdw(lng, lat, values);
      if (value === null) continue;
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

function formatRadarTime(value: string | null) {
  if (!value) return "ไม่พบเวลาตรวจล่าสุด";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "ไม่พบเวลาตรวจล่าสุด";
  return new Intl.DateTimeFormat("th-TH-u-nu-latn", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(date).replace(".", "");
}

function radarFreshnessLabel(ageMinutes: number | null) {
  if (ageMinutes === null) return "ตรวจสอบความสดไม่ได้";
  if (ageMinutes <= 1) return "ข้อมูลล่าสุด";
  return `${ageMinutes} นาทีที่แล้ว`;
}

function radarProblemLabel(payload: TmdRadarPayload | null, imageError: boolean) {
  if (imageError) return "โหลดภาพเรดาร์จาก TMD ไม่สำเร็จ";
  if (payload?.reason === "stale") return "ข้อมูลเรดาร์ล่าสุดเกิน 90 นาที";
  if (payload?.reason === "missing-observed") return "TMD ยังไม่เผยแพร่เฟรมตรวจจริง";
  if (payload?.reason === "upstream-error") return "เชื่อมต่อ TMD RadarGIS ไม่สำเร็จ";
  return "เรดาร์ยังไม่พร้อมใช้งาน";
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
      (b.areaMeanProbabilityPeak ?? -1) - (a.areaMeanProbabilityPeak ?? -1),
    )[0];
  return peak?.windowIndex ?? 0;
}

async function fetchRainForecastPayload(provinceId: RegionId, forceRefresh = false) {
  let unavailablePayload: RainForecastPayload | null = null;

  try {
    const query = new URLSearchParams({ horizon: String(FORECAST_DAYS), province: provinceId });
    const response = await fetch(`/api/rain-forecast?${query}`, { cache: forceRefresh ? "no-cache" : "default" });
    if (response.ok) {
      const payload = await response.json() as RainForecastPayload;
      if (payload.status !== "unavailable") return payload;
      unavailablePayload = payload;
    }
  } catch {
    // The browser-to-provider fallback below keeps the page usable during a server-side upstream outage.
  }

  if (provinceId === METRO_REGION_ID) {
    if (unavailablePayload) return unavailablePayload;
    throw new Error("metropolitan rain forecast unavailable");
  }

  for (const provider of rainForecastProviders) {
    try {
      const upstreamResponse = await fetch(buildRainForecastUrl(provider.url, provinceId), {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!upstreamResponse.ok) continue;
      const raw = await upstreamResponse.json();
      const normalizedResponse = await fetch("/api/rain-forecast", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id, province: provinceId, raw }),
      });
      if (!normalizedResponse.ok) continue;
      const payload = await normalizedResponse.json() as RainForecastPayload;
      if (payload.status !== "unavailable") return payload;
      unavailablePayload = payload;
    } catch {
      // Try the next real forecast model before showing the unavailable state.
    }
  }

  if (unavailablePayload) return unavailablePayload;
  throw new Error("rain forecast unavailable");
}

async function fetchRainRegionPayload(regionId: RegionId, forceRefresh = false) {
  return fetchRainForecastPayload(regionId, forceRefresh);
}
async function fetchRainRegionBoundary(regionId: RegionId): Promise<{ boundary: BoundaryCollection; state: "official" | "fallback" }> {
  const url = regionId === "bangkok" ? "/api/bangkok-boundary" : `/api/province-boundary?province=${regionId}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("boundary unavailable");
    return { boundary: await response.json() as BoundaryCollection, state: "official" };
  } catch {
    return { boundary: buildFallbackBoundary(regionId) as BoundaryCollection, state: "fallback" };
  }
}async function fetchTmdRadarPayload(forceRefresh = false, signal?: AbortSignal) {
  const response = await fetch("/api/tmd-radar", {
    cache: forceRefresh ? "reload" : "default",
    signal,
  });
  if (!response.ok) throw new Error("TMD radar unavailable");
  return response.json() as Promise<TmdRadarPayload>;
}

export default function RainDashboard() {
  const [selectedProvinceId, setSelectedProvinceId] = useState<RegionId>("bangkok");
  const [viewMode, setViewMode] = useState<RainViewMode>("forecast");
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
  const [basemap, setBasemap] = useState<"street" | "satellite">("street");
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [showForecastSurface, setShowForecastSurface] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [radarEnabled, setRadarEnabled] = useState(false);
  const [radarMode, setRadarMode] = useState<TmdRadarMode>("observed");
  const [radarPayload, setRadarPayload] = useState<TmdRadarPayload | null>(null);
  const [radarLoadState, setRadarLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [radarFrameIndex, setRadarFrameIndex] = useState(0);
  const [radarOpacity, setRadarOpacity] = useState(0.76);
  const [radarImageError, setRadarImageError] = useState(false);
  const [boundary, setBoundary] = useState<BoundaryCollection | null>(null);
  const [boundaryState, setBoundaryState] = useState<"loading" | "official" | "fallback">("loading");
  const [mapReady, setMapReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState<LocationSelection | null>(null);
  const [locationError, setLocationError] = useState("");
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const layerMenuRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const tileLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const surfaceLayerRef = useRef<import("leaflet").ImageOverlay | null>(null);
  const radarLayerRef = useRef<import("leaflet").ImageOverlay | null>(null);
  const boundaryLayerRef = useRef<import("leaflet").GeoJSON | null>(null);
  const labelsLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const selectedLocationLayerRef = useRef<import("leaflet").CircleMarker | null>(null);
  const radarAbortRef = useRef<AbortController | null>(null);
  const selectedDayRef = useRef(0);
  const selectedRegion = getRegion(selectedProvinceId);
  const effectiveMetricMode: MetricMode = viewMode === "watch" ? "daily-rain" : metricMode;

  const loadForecast = useCallback((forceRefresh = false) => {
    let active = true;
    fetchRainRegionPayload(selectedProvinceId, forceRefresh)
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
  }, [selectedProvinceId]);

  useEffect(() => loadForecast(reloadKey > 0), [loadForecast, reloadKey]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const searchParams = new URLSearchParams(window.location.search);
    const requestedProvince = searchParams.get("province");
    const requestedMode = searchParams.get("mode");
    Promise.resolve().then(() => {
      setSelectedProvinceId(requestedProvince ? getRegion(requestedProvince).id : "bangkok");
      setViewMode(requestedMode === "watch" ? "watch" : "forecast");
    });
  }, []);

  const loadRadar = useCallback((forceRefresh = false) => {
    radarAbortRef.current?.abort();
    const controller = new AbortController();
    radarAbortRef.current = controller;
    setRadarLoadState("loading");
    setRadarImageError(false);
    fetchTmdRadarPayload(forceRefresh, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return;
        setRadarPayload(payload);
        setRadarLoadState(payload.status === "unavailable" ? "error" : "ready");
        setRadarFrameIndex(payload.observedFrames.length ? payload.observedFrames.length - 1 : 0);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setRadarPayload(null);
        setRadarLoadState("error");
      });
  }, []);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const selectPoint = (event: import("leaflet").LeafletMouseEvent) => {
      setSelectedLocation({ lat: event.latlng.lat, lng: event.latlng.lng, source: "map" });
      setLocationError("");
    };
    map.on("click", selectPoint);
    return () => { map.off("click", selectPoint); };
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (selectedLocationLayerRef.current) {
      map.removeLayer(selectedLocationLayerRef.current);
      selectedLocationLayerRef.current = null;
    }
    if (!selectedLocation) return;
    let cancelled = false;
    import("leaflet").then((leafletModule) => {
      if (cancelled || !mapInstanceRef.current) return;
      selectedLocationLayerRef.current = leafletModule.default.circleMarker([selectedLocation.lat, selectedLocation.lng], {
        pane: "selectedLocationPane",
        radius: 8,
        color: "#ffffff",
        weight: 3,
        fillColor: "#2563eb",
        fillOpacity: 1,
      }).addTo(map);
    });
    return () => { cancelled = true; };
  }, [mapReady, selectedLocation]);

  useEffect(() => {
    let active = true;
    fetchRainRegionBoundary(selectedProvinceId).then((result) => {
      if (!active) return;
      setBoundary(result.boundary);
      setBoundaryState(result.state);
    });
    return () => {
      active = false;
    };
  }, [selectedProvinceId]);

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
        minZoom: 8,
        maxZoom: 15,
      }).setView([13.765, 100.595], 10);
      tileLayerRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      map.createPane("rainSurfacePane").style.zIndex = "350";
      map.getPane("rainSurfacePane")!.style.pointerEvents = "none";
      map.createPane("tmdRadarPane").style.zIndex = "390";
      map.getPane("tmdRadarPane")!.style.pointerEvents = "none";
      map.createPane("rainBoundaryPane").style.zIndex = "420";
      map.getPane("rainBoundaryPane")!.style.pointerEvents = "none";
      map.createPane("selectedLocationPane").style.zIndex = "680";
      mapInstanceRef.current = map;
      setMapReady(true);
      window.setTimeout(() => map.invalidateSize(), 80);
    });
    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        surfaceLayerRef.current = null;
        radarLayerRef.current = null;
        boundaryLayerRef.current = null;
        labelsLayerRef.current = null;
        selectedLocationLayerRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    import("leaflet").then((leafletModule) => {
      const L = leafletModule.default;
      const url = basemap === "satellite"
        ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
      const attr = basemap === "satellite"
        ? "&copy; Esri, Earthstar Geographics"
        : "&copy; OpenStreetMap contributors";
      tileLayerRef.current = L.tileLayer(url, { attribution: attr, maxZoom: 19 }).addTo(map);
    });
  }, [basemap, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !boundary) return;
    let cancelled = false;
    import("leaflet").then((leafletModule) => {
      if (cancelled || !mapInstanceRef.current) return;
      const L = leafletModule.default;
      const map = mapInstanceRef.current;
      if (surfaceLayerRef.current) map.removeLayer(surfaceLayerRef.current);
      if (boundaryLayerRef.current) map.removeLayer(boundaryLayerRef.current);
      const dataVersion = points.map((point) => `${point.id}:${point.daily.map((daily) => daily.rainMm).join(",")}:${point.windows.map((window) => `${window.pointProbabilityPeak}:${window.rainMm}`).join(",")}`).join("|");
      const cacheKey = `${selectedProvinceId}:${selectedDay}:${selectedWindowIndex}:${effectiveMetricMode}:${dataVersion}:${boundaryState}:${boundary.features.length}`;
      let surface = rainSurfaceCache.get(cacheKey);
      if (!rainSurfaceCache.has(cacheKey)) {
        surface = createRainSurface(boundary, points, selectedDay, selectedWindowIndex, effectiveMetricMode);
        rainSurfaceCache.set(cacheKey, surface);
        if (rainSurfaceCache.size > MAX_RAIN_SURFACES) rainSurfaceCache.delete(rainSurfaceCache.keys().next().value!);
      } else {
        rainSurfaceCache.delete(cacheKey);
        rainSurfaceCache.set(cacheKey, surface ?? null);
      }
      surfaceLayerRef.current = showForecastSurface && surface ? L.imageOverlay(surface.url, surface.bounds, {
        pane: "rainSurfacePane",
        opacity: 0.8,
        interactive: false,
      }).addTo(map) : null;
      boundaryLayerRef.current = L.geoJSON(boundary as GeoJSON.GeoJsonObject, {
        pane: "rainBoundaryPane",
        style: { color: "#173d66", weight: 1.05, opacity: 0.76, fillOpacity: 0 },
      }).addTo(map);
      map.fitBounds(boundaryLayerRef.current.getBounds(), { padding: [14, 14], animate: false });
    });
    return () => {
      cancelled = true;
    };
  }, [boundary, boundaryState, effectiveMetricMode, mapReady, points, selectedDay, selectedProvinceId, selectedWindowIndex, showForecastSurface]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const frames = radarMode === "observed" ? radarPayload?.observedFrames ?? [] : radarPayload?.nowcastFrames ?? [];
    const safeFrameIndex = Math.min(radarFrameIndex, Math.max(0, frames.length - 1));
    const frame = frames[safeFrameIndex];
    let cancelled = false;
    import("leaflet").then((leafletModule) => {
      if (cancelled || !mapInstanceRef.current) return;
      if (radarLayerRef.current) {
        map.removeLayer(radarLayerRef.current);
        radarLayerRef.current = null;
      }
      if (!radarEnabled || radarLoadState !== "ready" || !frame) return;
      const layer = leafletModule.default.imageOverlay(frame.imageUrl, frame.bounds, {
        pane: "tmdRadarPane",
        opacity: radarOpacity,
        interactive: false,
        alt: `${frame.label} จากกรมอุตุนิยมวิทยา`,
      });
      layer.once("error", () => setRadarImageError(true));
      layer.addTo(map);
      radarLayerRef.current = layer;
    });
    return () => {
      cancelled = true;
    };
  }, [mapReady, radarEnabled, radarFrameIndex, radarLoadState, radarMode, radarOpacity, radarPayload]);

  useEffect(() => {
    if (!mapReady || !mapElementRef.current || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(mapElementRef.current);
    return () => observer.disconnect();
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (labelsLayerRef.current) {
      map.removeLayer(labelsLayerRef.current);
      labelsLayerRef.current = null;
    }
    if (!showLabels || !points.length || !boundary) return;

    let cancelled = false;
    import("leaflet").then((leafletModule) => {
      if (cancelled || !mapInstanceRef.current) return;
      const L = leafletModule.default;
      const markers = selectWeatherMarkers(points, selectedDay, selectedWindowIndex, boundary, viewMode).map(({ location, probability, rainMm, symbol }) => {
        const icon = L.divIcon({
          className: "weather-emoji-wrapper",
          html: `
            <div class="weather-emoji-badge">
              <span>${symbol.emoji}</span>
            </div>
          `,
          iconSize: [42, 42],
          iconAnchor: [21, 21],
        });
        const marker = L.marker([location.lat, location.lng], { icon, interactive: true, keyboard: false });
        marker.bindTooltip(
          viewMode === "watch"
            ? `<strong>${location.provinceName}</strong><br>${getRainWatchLevel(rainMm, rainMm).label}<br>ฝนสะสม ${rainMm ?? "—"} มม./24 ชม.`
            : `<strong>${location.provinceName}</strong><br>${symbol.label}<br>แนวโน้มฝน ${probability ?? "—"}% · ${rainMm ?? "—"} มม./3 ชม.`,
          { direction: "top", offset: [0, -18], opacity: 0.96 },
        );
        return marker;
      });

      const group = L.layerGroup(markers);
      group.addTo(map);
      labelsLayerRef.current = group;
    });

    return () => {
      cancelled = true;
    };
  }, [boundary, mapReady, points, selectedDay, selectedWindowIndex, showLabels, viewMode]);

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
  const selectedAreaProbability = selectedWindow?.areaMeanProbabilityPeak ?? null;
  const selectedWetCoverage = selectedPointData.length
    ? Math.round(selectedPointData.filter(({ window }) => (window?.rainMm ?? 0) >= 0.1).length / selectedPointData.length * 100)
    : null;
  const selectedMeanRain = selectedWindow?.rainMeanMm ?? null;
  const dailyProbabilities = days.map((forecastDay) => forecastDay.dailyPeakAreaMeanProbability ?? 0);
  const dailyLikelihood = getRainLikelihood(day?.dailyPeakAreaMeanProbability);
  const rainWatchLevel = getRainWatchLevel(day?.rainMeanMm, day?.rainMaxMm);
  const rainWatchDays = useMemo(() => days.map((forecastDay, index) => ({
    index,
    day: forecastDay,
    level: getRainWatchLevel(forecastDay.rainMeanMm, forecastDay.rainMaxMm),
  })), [days]);
  const highestRainWatch = useMemo(() => [...rainWatchDays]
    .sort((a, b) => b.level.rank - a.level.rank || (b.day.rainMaxMm ?? -1) - (a.day.rainMaxMm ?? -1))[0], [rainWatchDays]);
  const rainWatchCount = rainWatchDays.filter(({ level }) => level.rank >= 3).length;
  const selectedWindowLikelihood = getRainLikelihood(selectedAreaProbability);
  const dailyNarrative = getDailyRainNarrative(day);
  const probabilityContext = formatProbabilityContext(day?.dailyPeakAreaMeanProbability, selectedDay);
  const bangkokNow = getBangkokDateParts();
  const currentWindowIndex = Math.min(7, Math.floor(bangkokNow.hour / 3));
  const selectedDayIsToday = day?.dateKey === bangkokNow.dateKey;
  const peakWindowIndex = getPeakWindowIndex(windows, selectedDay);
  const radarFrames = radarMode === "observed" ? radarPayload?.observedFrames ?? [] : radarPayload?.nowcastFrames ?? [];
  const safeRadarFrameIndex = Math.min(radarFrameIndex, Math.max(0, radarFrames.length - 1));
  const selectedRadarFrame = radarFrames[safeRadarFrameIndex] ?? null;
  const selectedRainSeries = useMemo(() => Array.from({ length: 8 }, (_, windowIndex) => {
    const rainValues = points
      .map((point) => ({ point, value: getPointValue(point, selectedDay, windowIndex, "rain") }))
      .filter((entry): entry is { point: RainPoint; value: number } => entry.value !== null);
    const probabilityValues = points
      .map((point) => ({ point, value: getPointValue(point, selectedDay, windowIndex, "probability") }))
      .filter((entry): entry is { point: RainPoint; value: number } => entry.value !== null);
    const label = dayWindows.find((window) => window.windowIndex === windowIndex)?.start.slice(11, 16)
      ?? `${String(windowIndex * 3).padStart(2, "0")}:00`;
    return {
      label,
      primary: selectedLocation && rainValues.length >= 3
        ? interpolateIdw(selectedLocation.lng, selectedLocation.lat, rainValues)
        : null,
      secondary: selectedLocation && probabilityValues.length >= 3
        ? interpolateIdw(selectedLocation.lng, selectedLocation.lat, probabilityValues)
        : null,
    };
  }), [dayWindows, points, selectedDay, selectedLocation]);

  const selectDay = (index: number) => {
    selectedDayRef.current = index;
    setSelectedDay(index);
  };

  const selectViewMode = (mode: RainViewMode) => {
    setViewMode(mode);
    if (mode === "watch") {
      setRadarEnabled(false);
      setShowForecastSurface(true);
    }
    const url = new URL(window.location.href);
    if (mode === "watch") url.searchParams.set("mode", "watch");
    else url.searchParams.delete("mode");
    window.history.replaceState({}, "", url);
  };

  const retryForecast = () => {
    setDataState("loading");
    setReloadKey((value) => value + 1);
  };

  const selectProvince = (provinceId: RegionId) => {
    selectedDayRef.current = 0;
    setDataState("loading");
    setBoundaryState("loading");
    setSelectedDay(0);
    setSelectedLocation(null);
    setLocationError("");
    setSelectedProvinceId(provinceId);
    const url = new URL(window.location.href);
    url.searchParams.set("province", provinceId);
    window.history.replaceState({}, "", url);
  };

  const locateMe = () => {
    if (!("geolocation" in navigator)) {
      setLocationError("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    setLocationError("กำลังค้นหาตำแหน่ง…");
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const metroBounds = getRegion(METRO_REGION_ID).bounds;
      const insideMetro = coords.latitude >= metroBounds.minLat
        && coords.latitude <= metroBounds.maxLat
        && coords.longitude >= metroBounds.minLng
        && coords.longitude <= metroBounds.maxLng;
      if (!insideMetro) {
        setLocationError("ตำแหน่งอยู่นอกพื้นที่กรุงเทพฯ และปริมณฑลที่รองรับ");
        return;
      }
      if (selectedProvinceId !== METRO_REGION_ID) {
        setSelectedProvinceId(METRO_REGION_ID);
        const url = new URL(window.location.href);
        url.searchParams.set("province", METRO_REGION_ID);
        window.history.replaceState({}, "", url);
      }
      setSelectedLocation({ lat: coords.latitude, lng: coords.longitude, source: "gps" });
      setLocationError("");
      mapInstanceRef.current?.setView([coords.latitude, coords.longitude], 12);
    }, (error) => {
      setLocationError(error.code === error.PERMISSION_DENIED
        ? "ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง กรุณาแตะจุดบนแผนที่แทน"
        : "ค้นหาตำแหน่งไม่สำเร็จ กรุณาลองใหม่หรือแตะบนแผนที่");
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  };

  const toggleRadar = (enabled: boolean) => {
    setRadarEnabled(enabled);
    setRadarImageError(false);
    if (enabled) {
      setShowForecastSurface(false);
      if (radarLoadState === "idle") loadRadar();
    }
  };

  const selectRadarMode = (mode: TmdRadarMode) => {
    setRadarMode(mode);
    const frames = mode === "observed" ? radarPayload?.observedFrames ?? [] : radarPayload?.nowcastFrames ?? [];
    setRadarFrameIndex(mode === "observed" ? Math.max(0, frames.length - 1) : 0);
    setRadarImageError(false);
  };

  const dataStateLabel = dataState === "live"
    ? "แบบจำลองอัปเดตแล้ว"
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
          <h1>แผนที่พยากรณ์ <em>ฝน · {selectedRegion.shortNameTh}</em></h1>
          <p>{viewMode === "watch" ? "เฝ้าระวังฝนสะสมรายวันล่วงหน้า 1–7 วันจากแบบจำลอง พร้อมระดับเพื่อการวางแผน" : "เช็กแนวโน้ม ปริมาณ และช่วงเวลาฝนล่วงหน้า 1–7 วัน พร้อมเรดาร์ตรวจฝนปัจจุบัน"}</p>
        </div>
        <ProvinceSelector value={selectedProvinceId} onChange={selectProvince} />
        <OutlookNav active="rain" province={selectedProvinceId} />
        <div className="banner-status" role="status" aria-live="polite">
          <span className={`status-dot ${dataState}`} aria-hidden="true" />
          <div>
            <span>{dataStateLabel}</span>
            <b>{formatFetchedAt(fetchedAt)}</b>
          </div>
        </div>
      </header>

      <section className="workspace rain-workspace">
        {/* LEFT CONTROL PANEL */}
        <aside className="rain-control-panel" aria-label="แถบเลือกวันและเวลาพยากรณ์">
          <div className="rain-view-mode" role="group" aria-label="เลือกโหมดหน้าฝน">
            <button type="button" aria-pressed={viewMode === "forecast"} onClick={() => selectViewMode("forecast")}>
              <span aria-hidden="true">☂</span>
              <span><b>พยากรณ์ทั่วไป</b><small>แนวโน้มและช่วงเวลา</small></span>
            </button>
            <button type="button" aria-pressed={viewMode === "watch"} onClick={() => selectViewMode("watch")}>
              <span aria-hidden="true">≋</span>
              <span><b>เฝ้าระวังฝนสะสม</b><small>ปริมาณรวม 24 ชม.</small></span>
            </button>
          </div>
          {/* Section 1: 7-Day Outlook Selector */}
          <div className="rain-panel-section">
            <div className="rain-panel-title">
              <span>📅 เลือกวันพยากรณ์</span>
              <small>7 วันล่วงหน้า</small>
            </div>
            <nav className="rain-sidebar-days" aria-label="เลือกวันพยากรณ์ฝน">
              {days.map((forecastDay, index) => {
                const isActive = selectedDay === index;
                const prob = forecastDay.dailyPeakAreaMeanProbability;
                const likelihood = getRainLikelihood(prob);
                const watchLevel = getRainWatchLevel(forecastDay.rainMeanMm, forecastDay.rainMaxMm);
                const dayContext = formatProbabilityContext(prob, index);
                return (
                  <button
                    key={forecastDay.dateKey}
                    className={`rain-sidebar-day-btn ${isActive ? "active" : ""}`}
                    onClick={() => selectDay(index)}
                    aria-pressed={isActive}
                    aria-label={viewMode === "watch"
                      ? `${forecastDay.weekday} ${forecastDay.date} ระดับ${watchLevel.label} ฝนสะสมสูงสุด ${forecastDay.rainMaxMm ?? "ไม่มีข้อมูล"} มิลลิเมตร`
                      : `${forecastDay.weekday} ${forecastDay.date} แนวโน้มฝน${likelihood.label} ฝนเฉลี่ย ${forecastDay.rainMeanMm ?? "ไม่มีข้อมูล"} มิลลิเมตร ${dayContext}`}
                  >
                    <div className="day-btn-left">
                      <b className="day-name">{forecastDay.weekday}</b>
                      <span className="day-date">{forecastDay.date}</span>
                    </div>
                    <div className="day-btn-right">
                      <span className="day-prob-badge" style={{ color: isActive ? "#ffffff" : viewMode === "watch" ? watchLevel.color : getRainChanceColor(prob) }}>
                        {viewMode === "watch" ? watchLevel.label : likelihood.label}
                      </span>
                      <small className="day-peak-time">
                        {forecastDay.rainMeanMm === null ? "—" : viewMode === "watch" ? `สูงสุด ${forecastDay.rainMaxMm ?? forecastDay.rainMeanMm} มม.` : `เฉลี่ย ${forecastDay.rainMeanMm} มม.`}
                      </small>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {viewMode === "forecast" ? <>
          {/* Section 2: 24-Hour Timeline & Line Curve */}
          <div className="rain-panel-section rain-timeline-section">
            <div className="rain-panel-title">
              <span>⏱️ ไทม์ไลน์ 24 ชม.</span>
              <small>{day?.weekday} {day?.date}</small>
            </div>

            <div className="rain-sidebar-graph-wrap">
              {(() => {
                const windows = dayWindows.length ? dayWindows : Array.from({ length: 8 }, (_, index) => ({ windowIndex: index, label: `${String(index * 3).padStart(2, "0")}:00`, areaMeanProbabilityPeak: null }));
                const svgPts = windows.map((w, i) => {
                  const x = i * (240 / 7);
                  const val = w.areaMeanProbabilityPeak ?? 0;
                  const y = 32 - (val / 100) * 22;
                  return { x, y };
                });
                const lineD = buildSvgCurve(svgPts);
                const areaD = lineD ? `${lineD} L 240 42 L 0 42 Z` : "";
                return (
                  <>
                    <svg className="rain-sidebar-svg" viewBox="0 0 240 42" preserveAspectRatio="none" aria-hidden="true">
                      <defs>
                        <linearGradient id="panelLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#38bdf8" />
                          <stop offset="50%" stopColor="#2563eb" />
                          <stop offset="100%" stopColor="#7c3aed" />
                        </linearGradient>
                        <linearGradient id="panelAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {areaD && <path d={areaD} fill="url(#panelAreaGrad)" />}
                      {lineD && <path d={lineD} stroke="url(#panelLineGrad)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
                    </svg>
                    <div className="rain-hourly-chart" role="group" aria-label="กราฟแนวโน้มฝนระดับพื้นที่ 24 ชั่วโมงของวันที่เลือก">
                      {windows.map((w, i) => {
                        const val = w.areaMeanProbabilityPeak;
                        const leftPct = (i / 7) * 100;
                        const alignClass = i === 0 ? "align-left" : i === 7 ? "align-right" : "align-center";
                        return (
                          <button
                            key={w.windowIndex}
                            className={`${selectedWindowIndex === w.windowIndex ? "active" : ""} ${alignClass}`}
                            style={{ left: `${leftPct}%` }}
                            onClick={() => setSelectedWindowIndex(w.windowIndex)}
                            aria-label={`ช่วง ${w.label} แนวโน้มฝน${getRainLikelihood(val).label} ${formatProbabilityContext(val, selectedDay)}`}
                          >
                            <i className="sidebar-line-dot" style={{ backgroundColor: getRainChanceColor(val) }} />
                            <small>{w.label.slice(0, 2)}</small>
                          </button>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* 8-Window Time Selector 2-Column Grid */}
            <div className="rain-panel-windows" role="group" aria-label="เลือกช่วงเวลา 3 ชั่วโมง">
              {(dayWindows.length ? dayWindows : Array.from({ length: 8 }, (_, index) => ({ windowIndex: index, label: `${String(index * 3).padStart(2, "0")}:00`, areaMeanProbabilityPeak: null }))).map((window) => {
                const isActive = selectedWindowIndex === window.windowIndex;
                const val = window.areaMeanProbabilityPeak;
                const isNow = selectedDayIsToday && window.windowIndex === currentWindowIndex;
                const isPeak = window.windowIndex === peakWindowIndex;
                return (
                  <button
                    key={window.windowIndex}
                    className={`panel-window-btn ${isActive ? "active" : ""}`}
                    onClick={() => setSelectedWindowIndex(window.windowIndex)}
                    aria-pressed={isActive}
                    disabled={!dayWindows.length}
                    title={`ช่วง ${window.label}: แนวโน้มฝน${getRainLikelihood(val).label} · ${formatProbabilityContext(val, selectedDay)}`}
                  >
                    <div className="window-time-wrap">
                      <i className="window-color-dot" style={{ backgroundColor: isActive ? "#ffffff" : getRainChanceColor(val) }} />
                      <span className="window-clock">{window.label}</span>
                    </div>
                    <div className="window-val-wrap">
                      <b className="window-prob">{getRainLikelihood(val).label}</b>
                      <small className="window-prob-secondary">
                        {val === null ? "—" : selectedDay >= 2 ? formatProbabilityContext(val, selectedDay).replace("ช่วงแบบจำลอง ", "") : `${val}%`}
                      </small>
                      {isNow && <em className="badge-now">ตอนนี้</em>}
                      {isPeak && !isNow && <em className="badge-peak">ช่วงเด่น</em>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Daily Weather Highlights in Left Panel */}
          <div className="rain-panel-section rain-highlights-section">
            <div className="rain-panel-title">
              <span>⚡ สรุปช่วงเวลาสำคัญ</span>
            </div>
            <div className="rain-highlights-list">
              <div>
                <span className="highlight-icon" aria-hidden="true">◷</span>
                <div>
                  <small>ช่วงที่สัญญาณฝนเด่น</small>
                  <b>{day?.peakWindow ?? "ยังไม่มีข้อมูลช่วงเวลา"}</b>
                </div>
              </div>
              <div>
                <span className="highlight-icon" aria-hidden="true">≈</span>
                <div>
                  <small>ช่วงเวลาที่คาดว่ามีฝน</small>
                  <b>เฉลี่ยประมาณ {day?.wetHours ?? "—"} ชม. · อาจไม่ต่อเนื่อง</b>
                </div>
              </div>
            </div>
          </div>
          </> : (
            <div className="rain-panel-section rain-watch-summary" aria-live="polite">
              <div className="rain-panel-title">
                <span>≋ สรุปฝนสะสม 24 ชม.</span>
                <small>{day?.weekday} {day?.date}</small>
              </div>
              <div className="rain-watch-level" style={{ "--watch-color": rainWatchLevel.color } as React.CSSProperties}>
                <span aria-hidden="true" />
                <div>
                  <small>ระดับเพื่อการวางแผน</small>
                  <b>{rainWatchLevel.label}</b>
                  <em>{rainWatchLevel.rainClass}</em>
                </div>
              </div>
              <dl className="rain-watch-metrics">
                <div><dt>เฉลี่ยทั้งพื้นที่</dt><dd>{day?.rainMeanMm ?? "—"}<small>มม.</small></dd></div>
                <div><dt>สูงสุดบางจุด</dt><dd>{day?.rainMaxMm ?? "—"}<small>มม.</small></dd></div>
                <div><dt>ช่วงมีฝน</dt><dd>{day?.wetHours ?? "—"}<small>ชม.</small></dd></div>
              </dl>
              <p>{rainWatchLevel.guidance}</p>
              <div className="rain-watch-scale" aria-label="เกณฑ์ปริมาณฝนสะสม 24 ชั่วโมง">
                <span><i className="light" />0.1–10<small>เล็กน้อย</small></span>
                <span><i className="moderate" />10.1–35<small>ปานกลาง</small></span>
                <span><i className="heavy" />35.1–90<small>หนัก</small></span>
                <span><i className="very-heavy" />&gt;90<small>หนักมาก</small></span>
              </div>
              <small className="rain-watch-disclaimer">ระดับนี้คำนวณจากค่าสูงสุดของจุดแบบจำลอง ไม่ใช่ประกาศเตือนภัย</small>
            </div>
          )}
        </aside>

        {/* CENTER MAP CANVAS */}
        <div className="map-card rain-map-card">
          <div className="map-wrap rain-map-wrap">
            <div ref={mapElementRef} className="map rain-map" data-basemap={basemap} role="region" aria-label={radarEnabled && selectedRadarFrame ? `แผนที่เรดาร์ฝน TMD ${selectedRegion.nameTh} ${selectedRadarFrame.label}` : viewMode === "watch" ? `แผนที่เฝ้าระวังฝนสะสม 24 ชั่วโมง ${selectedRegion.nameTh} ${day?.weekday ?? ""} ${day?.date ?? ""}` : `แผนที่พยากรณ์ฝน ${selectedRegion.nameTh} ${day?.weekday ?? ""} ${day?.date ?? ""} ${selectedWindow?.label ?? ""}`} />
            <div className="map-location-tools rain" aria-label="เครื่องมือเลือกตำแหน่งพยากรณ์ฝน">
              <button type="button" onClick={locateMe}><span aria-hidden="true">⌖</span> ตำแหน่งของฉัน</button>
              <small>{locationError || (selectedLocation ? "แตะจุดอื่นบนแผนที่เพื่อเปลี่ยน" : "แตะแผนที่เพื่อดูกราฟรายจุด")}</small>
            </div>
            {viewMode === "forecast" && selectedDayIsToday && !radarEnabled && (
              <button className="radar-now-cta" type="button" onClick={() => toggleRadar(true)}>
                <b>ตอนนี้ฝนตกไหม?</b>
                <span>เปิดเรดาร์ตรวจจริงและแนวโน้ม 0–3 ชม.</span>
              </button>
            )}
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
                <strong>ชั้นข้อมูลแผนที่</strong>
                <label className="layer-toggle radar-layer-toggle" htmlFor="rain-forecast-surface-toggle" aria-label="แสดงแบบจำลองพยากรณ์ฝนบนแผนที่">
                  <input id="rain-forecast-surface-toggle" type="checkbox" checked={showForecastSurface} onChange={(event) => setShowForecastSurface(event.target.checked)} disabled={dataState === "unavailable"} />
                  <span aria-hidden="true" />
                  <span className="layer-toggle-copy"><b>{viewMode === "watch" ? "ฝนสะสมรายวัน" : "แบบจำลองพยากรณ์"}</b><small>IDW พื้นที่รวม · {points.length} จุดพร้อม buffer</small></span>
                </label>
                {showForecastSurface && viewMode === "forecast" && (
                  <div className="rain-metric-options" role="group" aria-label="ตัวชี้วัดแบบจำลองบนแผนที่">
                    <button aria-pressed={metricMode === "probability"} onClick={() => setMetricMode("probability")}>แนวโน้มฝน</button>
                    <button aria-pressed={metricMode === "rain"} onClick={() => setMetricMode("rain")}>ปริมาณฝน</button>
                  </div>
                )}
                <label className="layer-toggle radar-layer-toggle" htmlFor="tmd-radar-layer-toggle" aria-label="แสดงเรดาร์ฝน TMD บนแผนที่">
                  <input id="tmd-radar-layer-toggle" type="checkbox" checked={radarEnabled} onChange={(event) => toggleRadar(event.target.checked)} />
                  <span aria-hidden="true" />
                  <span className="layer-toggle-copy"><b>เรดาร์ฝน TMD</b><small>ฝนที่ตรวจพบตอนนี้และแนวโน้ม 0–3 ชม.</small></span>
                </label>
                <label className="layer-toggle radar-layer-toggle" htmlFor="rain-labels-toggle" aria-label="แสดงสัญลักษณ์สภาพอากาศบนแผนที่">
                  <input id="rain-labels-toggle" type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} />
                  <span aria-hidden="true" />
                  <span className="layer-toggle-copy"><b>สัญลักษณ์สภาพอากาศ</b><small>{viewMode === "watch" ? "ระดับฝนสะสม 24 ชม. ของจุดแบบจำลอง" : "3 ตำแหน่งต่อจังหวัด · อยู่ภายในขอบเขต · วางเมาส์ดูรายละเอียด"}</small></span>
                </label>
                <div className="basemap-layer-section">
                  <small className="basemap-section-title">แผนที่ฐาน (Basemap)</small>
                  <div className="basemap-switcher-grid" role="group" aria-label="เลือกแผนที่ฐาน">
                    <button
                      type="button"
                      className={`basemap-option-btn ${basemap === "street" ? "active" : ""}`}
                      onClick={() => setBasemap("street")}
                      aria-pressed={basemap === "street"}
                    >
                      🗺️ แผนที่ถนน
                    </button>
                    <button
                      type="button"
                      className={`basemap-option-btn ${basemap === "satellite" ? "active" : ""}`}
                      onClick={() => setBasemap("satellite")}
                      aria-pressed={basemap === "satellite"}
                    >
                      🛰️ ดาวเทียม
                    </button>
                  </div>
                </div>
                {radarEnabled && (
                  <div className="radar-layer-controls">
                    {radarLoadState === "loading" ? (
                      <div className="radar-layer-message" role="status">กำลังโหลดชั้นเรดาร์…</div>
                    ) : radarLoadState === "error" || radarImageError ? (
                      <div className="radar-layer-message error" role="alert">
                        <span>{radarProblemLabel(radarPayload, radarImageError)}</span>
                        <button type="button" onClick={() => loadRadar(true)}>ลองโหลดเรดาร์ใหม่</button>
                      </div>
                    ) : (
                      <>
                        <div className="radar-mode-options" role="group" aria-label="เลือกชนิดข้อมูลเรดาร์">
                          <button type="button" aria-pressed={radarMode === "observed"} onClick={() => selectRadarMode("observed")}>ฝนตรวจพบ</button>
                          <button type="button" aria-pressed={radarMode === "nowcast"} onClick={() => selectRadarMode("nowcast")} disabled={!radarPayload?.nowcastFrames.length}>แนวโน้ม 0–3 ชม.</button>
                        </div>
                        <div className="radar-frame-meta" aria-live="polite">
                          <b>{selectedRadarFrame?.label ?? "รอเฟรมเรดาร์"}</b>
                          <span>{selectedRadarFrame ? `${formatRadarTime(selectedRadarFrame.validAt)} น. · ${radarFreshnessLabel(radarPayload?.ageMinutes ?? null)}` : "ไม่มีเฟรมที่เลือก"}</span>
                        </div>
                        <div className="radar-frame-picker">
                          <button type="button" onClick={() => setRadarFrameIndex((index) => Math.max(0, index - 1))} disabled={safeRadarFrameIndex <= 0} aria-label="เฟรมเรดาร์ก่อนหน้า">‹</button>
                          <input
                            type="range"
                            min="0"
                            max={Math.max(0, radarFrames.length - 1)}
                            value={safeRadarFrameIndex}
                            onChange={(event) => setRadarFrameIndex(Number(event.target.value))}
                            disabled={radarFrames.length <= 1}
                            aria-label="เลือกเวลาเรดาร์"
                          />
                          <button type="button" onClick={() => setRadarFrameIndex((index) => Math.min(radarFrames.length - 1, index + 1))} disabled={safeRadarFrameIndex >= radarFrames.length - 1} aria-label="เฟรมเรดาร์ถัดไป">›</button>
                        </div>
                        <label className="radar-opacity-control">
                          <span>ความทึบ {Math.round(radarOpacity * 100)}%</span>
                          <input type="range" min="0.35" max="0.9" step="0.05" value={radarOpacity} onChange={(event) => setRadarOpacity(Number(event.target.value))} />
                        </label>
                        <a className="radar-source-link" href={radarPayload?.sourcePage ?? "https://radargis.tmd.go.th/"} target="_blank" rel="noreferrer">เปิดข้อมูลต้นทาง TMD RadarGIS</a>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className={`map-metric rain-map-metric ${viewMode === "watch" ? "rain-watch-map-metric" : ""}`}>
              {viewMode === "watch" ? (
                <>
                  <span>ฝนสะสมสูงสุดบางจุด · 24 ชม.</span>
                  <strong style={{ color: rainWatchLevel.color }}>{day?.rainMaxMm ?? "—"}<small>มม.</small></strong>
                  <b>{rainWatchLevel.label} · {rainWatchLevel.rainClass}</b>
                  <small className="rain-probability-note">เฉลี่ยทั้งพื้นที่ {day?.rainMeanMm ?? "—"} มม. · ระดับเพื่อการวางแผน</small>
                </>
              ) : (
                <>
                  <span>แนวโน้มฝนในพื้นที่ · 3 ชม.</span>
                  <strong className="rain-trend-label" style={{ color: selectedWindowLikelihood.color }}>{selectedWindowLikelihood.label}</strong>
                  <b>{selectedMeanRain === null ? "รอข้อมูล" : `เฉลี่ย ${selectedMeanRain} มม. · จุดตัวอย่างมีฝน ${selectedWetCoverage ?? "—"}%`}</b>
                  <small className="rain-probability-note">{formatProbabilityContext(selectedAreaProbability, selectedDay)} · ไม่ได้หมายถึงฝนทุกแห่ง</small>
                </>
              )}
            </div>

            <div className={`surface-status rain-surface-status ${radarEnabled ? radarPayload?.status ?? radarLoadState : dataState}`} aria-live="polite">
              <b>{radarEnabled ? radarLoadState === "loading" ? "กำลังโหลดเรดาร์ TMD" : radarLoadState === "error" || radarImageError ? "เรดาร์ไม่พร้อมใช้งาน" : radarMode === "observed" ? "ฝนที่ตรวจพบตอนนี้" : "แนวโน้มฝน 0–3 ชม." : dataStateLabel}</b>
              <span>{radarEnabled ? selectedRadarFrame ? `${selectedRadarFrame.label} · ${formatRadarTime(selectedRadarFrame.validAt)} น.` : "ยังไม่มีเฟรมเรดาร์" : points.length ? viewMode === "watch" ? `พื้นผิวฝนสะสมรายวัน · ${day?.weekday ?? ""} ${day?.date ?? ""}` : `พื้นผิว IDW · ${selectedWindow?.label ?? "ช่วงที่เลือก"}` : "ยังไม่มีข้อมูลพยากรณ์สำหรับช่วงนี้"}</span>
              <em>{radarEnabled ? radarPayload?.reason === "missing-nowcast" ? `เฟรมตรวจจริงพร้อม · Nowcast รออัปเดต · ${radarFreshnessLabel(radarPayload.ageMinutes)}` : radarPayload?.status === "degraded" ? `ข้อมูลช้ากว่าปกติ · ${radarFreshnessLabel(radarPayload.ageMinutes)}` : "Rain Rate · mm/h · ข้อมูลกึ่งเวลาจริง" : boundaryState === "official" ? `${selectedProvinceId === METRO_REGION_ID ? "ขอบเขตกรุงเทพฯ และปริมณฑล 6 จังหวัด" : selectedProvinceId === "bangkok" ? "ขอบเขต 50 เขต" : `ขอบเขตจังหวัด${selectedRegion.nameTh}`} · IDW จากจุดใกล้เคียงข้ามเขตและเว้นพื้นที่ไร้ข้อมูล` : boundaryState === "fallback" ? "กำลังใช้ขอบเขตสำรอง" : `กำลังโหลดขอบเขต${selectedRegion.nameTh}`}</em>
            </div>

            {dataState === "unavailable" && (
              <div className="rain-error-panel" role="alert">
                <strong>โหลดข้อมูลฝนไม่สำเร็จ</strong>
                <span>ระบบไม่สร้างค่าทดแทนเมื่อแบบจำลองไม่พร้อม</span>
                <button onClick={retryForecast}>ลองอีกครั้ง</button>
              </div>
            )}

            <div className={`legend rain-legend ${radarEnabled ? "radar-legend" : ""}`} aria-label={radarEnabled ? "คำอธิบายชั้นเรดาร์ฝน TMD" : viewMode === "watch" ? "เกณฑ์ฝนสะสม 24 ชั่วโมง" : metricMode === "probability" ? "คำอธิบายแนวโน้มฝน" : "คำอธิบายปริมาณฝนใน 3 ชั่วโมง"}>
              {radarEnabled ? (
                <>
                  <span><i style={{ background: "#2563eb" }} />TMD RadarGIS</span>
                  <span>{radarMode === "observed" ? "ฝนตรวจพบตอนนี้" : "แนวโน้ม 0–3 ชม."}</span>
                  <small>Rain Rate · mm/h · สีตามข้อมูลต้นทาง</small>
                </>
              ) : viewMode === "watch" ? (
                <>
                  <span><i className="rain-scale-white" style={{ background: "#ffffff" }} />0–10 เล็กน้อย</span>
                  <span><i style={{ background: "#2563eb" }} />10.1–35 ปานกลาง</span>
                  <span><i style={{ background: "#ea580c" }} />35.1–90 หนัก</span>
                  <span><i style={{ background: "#b91c1c" }} />&gt;90 หนักมาก</span>
                  <small>มม. / 24 ชม. · เกณฑ์ปริมาณฝน</small>
                </>
              ) : metricMode === "probability" ? (
                <>
                  <span><i className="rain-scale-white" style={{ background: "#ffffff" }} />0–20%</span>
                  <span><i style={{ background: "#bae6fd" }} />21–45%</span>
                  <span><i style={{ background: "#38bdf8" }} />46–65%</span>
                  <span><i style={{ background: "#2563eb" }} />66–80%</span>
                  <span><i style={{ background: "#6d28d9" }} />&gt;80%</span>
                  <small>แนวโน้มฝนระดับพื้นที่</small>
                </>
              ) : (
                <>
                  <span><i className="rain-scale-white" style={{ background: "#ffffff" }} />0</span>
                  <span><i style={{ background: "#bae6fd" }} />0.1–2.5</span>
                  <span><i style={{ background: "#38bdf8" }} />2.6–5</span>
                  <span><i style={{ background: "#2563eb" }} />5.1–10</span>
                  <span><i style={{ background: "#6d28d9" }} />&gt;10 มม.</span>
                  <small>มม. / 3 ชม.</small>
                </>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT INSIGHTS SIDEBAR */}
        <aside className="insights rain-insights" aria-label="สรุปพยากรณ์ฝนวันที่เลือก">
          {viewMode === "forecast" && (
            <LocationForecastCard
              kind="rain"
              selection={selectedLocation}
              series={selectedRainSeries}
              onClear={() => {
                setSelectedLocation(null);
                setLocationError("");
              }}
            />
          )}
          <div className="average-card rain-average-card">
            <div
              className="average-ring rain-average-ring"
              style={{
                "--progress": `${viewMode === "watch" ? Math.min(100, ((day?.rainMaxMm ?? 0) / 90) * 100) * 3.6 : (day?.dailyPeakAreaMeanProbability ?? 0) * 3.6}deg`,
                "--metric-color": viewMode === "watch" ? rainWatchLevel.color : "#2a69c2",
              } as React.CSSProperties}
            >
              <span>{viewMode === "watch" ? rainWatchLevel.label : dailyLikelihood.label}<small>{viewMode === "watch" ? "24 ชม." : "แนวโน้ม"}</small></span>
            </div>
            <div>
              <p>{viewMode === "watch" ? "ระดับเฝ้าระวังฝนสะสม" : "แนวโน้มฝนระดับพื้นที่"}</p>
              <strong>{viewMode === "watch" ? `${rainWatchLevel.label} · ${rainWatchLevel.rainClass}` : dailyNarrative}</strong>
              <em>{viewMode === "watch" ? `เฉลี่ย ${day?.rainMeanMm ?? "—"} มม. · สูงสุดบางจุด ${day?.rainMaxMm ?? "—"} มม.` : `เด่น ${day?.peakWindow ?? "—"} · เฉลี่ย ${day?.rainMeanMm ?? "—"} มม. · ${probabilityContext}`}</em>
              <small className="rain-summary-note">{viewMode === "watch" ? rainWatchLevel.guidance : "ค่านี้สรุปช่วง 3 ชม. ที่แบบจำลองให้สัญญาณสูงสุด ไม่ได้หมายถึงฝนทุกแห่ง"}</small>
            </div>
          </div>

          {(() => {
            if (viewMode === "watch") {
              return (
                <div className="advisory-card rain-advisory-card">
                  <div className="advisory-header">
                    <span className="advisory-icon">🌧️</span>
                    <div className="advisory-title-wrap">
                      <b>ความหมายของระดับ{rainWatchLevel.label}</b>
                      <span className="advisory-risk-badge" style={{ backgroundColor: rainWatchLevel.color }}>
                        {rainWatchLevel.rainClass}
                      </span>
                    </div>
                  </div>
                  <p className="advisory-desc">{rainWatchLevel.guidance} ปริมาณอาจต่างกันในแต่ละพื้นที่ จึงควรเทียบเรดาร์และประกาศทางการใกล้เวลา</p>
                  <div className="rain-advisory-dimensions" aria-label="สรุปฝนสะสมเฉลี่ย สูงสุด และช่วงมีฝน">
                    <span><small>เฉลี่ย</small><b>{day?.rainMeanMm ?? "—"} มม.</b></span>
                    <span><small>สูงสุดบางจุด</small><b>{day?.rainMaxMm ?? "—"} มม.</b></span>
                    <span><small>ช่วงมีฝน</small><b>{day?.wetHours ?? "—"} ชม.</b></span>
                  </div>
                </div>
              );
            }
            const adv = getRainAdvisory(day, selectedMeanRain, selectedWetCoverage);
            return (
              <div className="advisory-card rain-advisory-card">
                <div className="advisory-header">
                  <span className="advisory-icon">{adv.icon}</span>
                  <div className="advisory-title-wrap">
                    <b>{adv.title}</b>
                    <span className="advisory-risk-badge" style={{ backgroundColor: adv.riskColor }}>
                      {adv.risk}
                    </span>
                  </div>
                </div>
                <p className="advisory-desc">{adv.desc}</p>
                <div className="rain-advisory-dimensions" aria-label="สรุปแนวโน้ม ปริมาณ และผลกระทบ">
                  <span><small>แนวโน้ม</small><b>{adv.likelihood}</b></span>
                  <span><small>ปริมาณ</small><b>{adv.intensity}</b></span>
                  <span><small>ผลกระทบ</small><b>{adv.impact}</b></span>
                </div>
              </div>
            );
          })()}

          <div className="trend-card rain-trend-card">
            <div className="trend-heading">
              <p>{viewMode === "watch" ? "เฝ้าระวังฝนสะสม 7 วัน" : "แนวโน้ม 7 วัน"}</p>
              <span>{viewMode === "watch" ? "เทียบปริมาณสูงสุดของจุดแบบจำลองรายวัน" : "วันนี้–พรุ่งนี้ละเอียด · วันที่ 3–7 เป็นแนวโน้ม"}</span>
            </div>
            <div className="trend-chart" role="group" aria-label={viewMode === "watch" ? "กราฟเฝ้าระวังฝนสะสม 7 วัน" : "กราฟแนวโน้มฝนระดับพื้นที่ 7 วัน"}>
              {(viewMode === "watch" ? days.map((item) => item.rainMaxMm ?? 0) : dailyProbabilities).map((value, index) => {
                const watchLevel = getRainWatchLevel(days[index]?.rainMeanMm, days[index]?.rainMaxMm);
                return (
                <button
                  key={days[index]?.dateKey ?? index}
                  className={selectedDay === index ? "active" : ""}
                  onClick={() => selectDay(index)}
                  aria-label={viewMode === "watch" ? `${days[index]?.weekday ?? "วัน"} ${days[index]?.date ?? ""} ${watchLevel.label} ฝนสะสมสูงสุด ${days[index]?.rainMaxMm ?? "—"} มิลลิเมตร` : `${days[index]?.weekday ?? "วัน"} ${days[index]?.date ?? ""} แนวโน้มฝน${getRainLikelihood(days[index]?.dailyPeakAreaMeanProbability).label} ${formatProbabilityContext(days[index]?.dailyPeakAreaMeanProbability, index)}`}
                  aria-pressed={selectedDay === index}
                >
                  <span>{viewMode === "watch" ? `${days[index]?.rainMaxMm ?? "—"}` : getRainLikelihood(days[index]?.dailyPeakAreaMeanProbability).label}</span>
                  <i style={{ height: `${viewMode === "watch" ? Math.max(8, Math.min(100, (value / 90) * 100)) : Math.max(8, value)}%`, background: viewMode === "watch" ? watchLevel.color : "linear-gradient(#4fc3e1, #3156ad)" }} />
                  <small>{days[index]?.weekday.slice(0, 2)}</small>
                </button>
                );
              })}
            </div>
          </div>

          <div className="watch-card rain-watch-card">
            <p>{viewMode === "watch" ? "จุดแบบจำลองฝนสะสมสูงสุด" : "พื้นที่แบบจำลองที่ควรติดตาม"}</p>
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
            <small>{viewMode === "watch" ? "เรียงตามฝนสะสม 24 ชั่วโมง · เป็นจุดแบบจำลอง ไม่ใช่สถานีตรวจวัด" : "จุดประมาณการ 9 ตำแหน่ง ไม่ใช่สถานีตรวจวัดหรือค่ารายเขต"}</small>
          </div>

          <div className="forecast-note rain-forecast-note">
            <span aria-hidden="true">!</span>
            <p>
              <b>{viewMode === "watch" ? "ภาพรวมเฝ้าระวัง 7 วัน" : "สรุปวันที่เลือก"}</b>
              {viewMode === "watch" ? `${rainWatchCount ? `พบ ${rainWatchCount} วันที่แตะระดับเฝ้าระวังขึ้นไป` : "ยังไม่พบวันที่แตะระดับเฝ้าระวัง"}${highestRainWatch ? ` วันที่สูงสุดคือ${highestRainWatch.day.weekday} ${highestRainWatch.day.date} (${highestRainWatch.level.label} ${highestRainWatch.day.rainMaxMm ?? "—"} มม.)` : ""}` : day?.dailyPeakAreaMeanProbability === null ? "ยังโหลดข้อมูลไม่ได้" : `${dailyNarrative} เด่นช่วง ${day.peakWindow ?? "—"} ปริมาณเฉลี่ย ${day.rainMeanMm ?? "—"} มม. · ${probabilityContext}${highestPoint ? ` จุดแบบจำลองที่มีปริมาณสูงสุดคือ${highestPoint.label}` : ""}`}
              <small className="rain-model-explainer">{viewMode === "watch" ? "ระดับเฝ้าระวังคำนวณจากฝนสะสมสูงสุดของจุดแบบจำลองเพื่อช่วยวางแผน ไม่ใช่ประกาศเตือนภัยจากหน่วยงานรัฐ" : "เปอร์เซ็นต์คือค่าสูงสุดของค่าเฉลี่ยจุดแบบจำลองในช่วง 3 ชั่วโมง ไม่ใช่สัดส่วนพื้นที่และไม่ยืนยันว่าจะตก ณ ตำแหน่งของคุณ"}</small>
              <small>{model} · อัปเดต {formatFetchedAt(fetchedAt)} · {viewMode === "watch" ? "ปริมาณฝนสะสมเป็นผลรวมรายวันจากจุดแบบจำลอง และอาจต่างจากค่าตรวจวัดจริง" : disclaimer} <a href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">ที่มาข้อมูล</a></small>
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
