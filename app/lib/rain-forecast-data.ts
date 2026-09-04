import { FORECAST_DAYS } from "./forecast-horizon.ts";
import type { RainForecastMode, RainForecastSource } from "./rain-forecast-provider.ts";
import { metroRegion, provinces, type RegionId } from "./provinces.ts";

export type RainStatus = "live" | "degraded" | "unavailable";

export type RainDay = {
  lead: number;
  dateKey: string;
  date: string;
  weekday: string;
  year: number;
  dailyAreaMeanProbability: number | null;
  dailyAreaMaxProbability: number | null;
  rainMeanMm: number | null;
  rainWatchMm: number | null;
  rainMaxMm: number | null;
  wetHours: number | null;
  peakWindow: string | null;
  weatherCode: number | null;
};

export type RainWindow = {
  dayIndex: number;
  windowIndex: number;
  start: string;
  end: string;
  label: string;
  areaMeanProbabilityPeak: number | null;
  rainMeanMm: number | null;
  rainMaxMm: number | null;
};

export type RainPointDay = {
  pointProbabilityMax: number | null;
  pointProbabilityMean: number | null;
  rainMm: number | null;
  wetHours: number | null;
  weatherCode: number | null;
};

export type RainPointWindow = {
  dayIndex: number;
  windowIndex: number;
  pointProbabilityPeak: number | null;
  rainMm: number | null;
};

export type RainPoint = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  daily: RainPointDay[];
  windows: RainPointWindow[];
};

export type RainForecastPayload = {
  province: { id: RegionId; nameTh: string; shortNameTh: string; nameEn: string };
  status: RainStatus;
  fetchedAt: string;
  model: string;
  disclaimer: string;
  sources: string[];
  dataQuality: {
    expectedPoints: number;
    acceptedPoints: number;
    coverageHours: number;
    rejectedPoints?: number;
    minimumHourlyCoverage?: number;
    requestedMode?: RainForecastMode;
    requestedSource?: RainForecastSource;
    provider?: string;
    providerFallback?: boolean;
    tmdStatus?: "live" | "unavailable" | "not-configured";
    tmdAcceptedPoints?: number;
    tmdForecastValues?: number;
    tmdCadenceHours?: number | null;
    tmdProduct?: "hourly-48h" | "daily-7d";
    tmdFailureReason?: string;
    deliveryFallback?: boolean;
    providersTried?: string[];
    error?: string;
  };
  days: RainDay[];
  windows: RainWindow[];
  points: RainPoint[];
};

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function formatRainDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  return { date: `${day} ${months[month - 1]}`, weekday: weekdays[date.getUTCDay()], year: year + 543 };
}
export function buildRainDayShells(startDateKey?: string): RainDay[] {
  const bangkokToday = startDateKey ?? new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date());

  return Array.from({ length: FORECAST_DAYS }, (_, index) => {
    const dateKey = addDays(bangkokToday, index);
    const formatted = formatRainDate(dateKey);
    return {
      lead: index + 1,
      dateKey,
      ...formatted,
      dailyAreaMeanProbability: null,
      dailyAreaMaxProbability: null,
      rainMeanMm: null,
      rainWatchMm: null,
      rainMaxMm: null,
      wetHours: null,
      peakWindow: null,
      weatherCode: null,
    };
  });
}

function meanNullable(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return valid.length ? Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10 : null;
}

function maxNullable(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return valid.length ? Math.max(...valid) : null;
}

function mostCommonNullable(values: Array<number | null | undefined>) {
  const counts = new Map<number, number>();
  values.forEach((value) => {
    if (typeof value === "number" && Number.isFinite(value)) counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function distanceKm(a: Pick<RainPoint, "lat" | "lng">, b: Pick<RainPoint, "lat" | "lng">) {
  const toRadians = (value: number) => value * Math.PI / 180;
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(b.lng - a.lng);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const haversine = sinLat ** 2 + Math.cos(lat1) * Math.cos(lat2) * sinLng ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

/**
 * Highest daily accumulation supported by at least two nearby model points.
 * This prevents one isolated grid-point maximum from defining a regional watch tier.
 */
export function getCorroboratedRainMm(points: RainPoint[], dayIndex: number, maxDistanceKm = 30) {
  const values = points
    .map((point) => ({ point, value: point.daily[dayIndex]?.rainMm }))
    .filter((entry): entry is { point: RainPoint; value: number } => typeof entry.value === "number" && Number.isFinite(entry.value));
  let corroborated: number | null = null;
  for (let first = 0; first < values.length; first += 1) {
    for (let second = first + 1; second < values.length; second += 1) {
      if (distanceKm(values[first].point, values[second].point) > maxDistanceKm) continue;
      const pairValue = Math.min(values[first].value, values[second].value);
      corroborated = corroborated === null ? pairValue : Math.max(corroborated, pairValue);
    }
  }
  return corroborated === null ? null : Math.round(corroborated * 10) / 10;
}

export function aggregateMetroRain(payloads: RainForecastPayload[]): RainForecastPayload {
  const usable = payloads.filter((payload) => payload.status !== "unavailable");
  const primary = usable[0] ?? payloads[0];
  if (!primary) throw new Error("metropolitan rain forecast unavailable");
  if (!usable.length) return { ...primary, province: metroRegion, points: [], windows: [] };

  const requestedSource = primary.dataQuality.requestedSource ?? "tmd";
  const requestedMode = primary.dataQuality.requestedMode ?? "chance";
  const allPoints = usable.flatMap((payload) => payload.points.map((point) => ({
    ...point,
    id: `${payload.province.id}-${point.id}`,
    label: `${payload.province.shortNameTh} · ${point.label}`,
  })));
  const windows = primary.windows.map((baseWindow) => {
    const matches = allPoints
      .map((point) => point.windows.find((window) =>
        window.dayIndex === baseWindow.dayIndex && window.windowIndex === baseWindow.windowIndex,
      ))
      .filter((window): window is RainPointWindow => Boolean(window));
    const probabilityMean = meanNullable(matches.map((window) => window.pointProbabilityPeak));
    return {
      ...baseWindow,
      areaMeanProbabilityPeak: probabilityMean === null ? null : Math.round(probabilityMean),
      rainMeanMm: meanNullable(matches.map((window) => window.rainMm)),
      rainMaxMm: maxNullable(matches.map((window) => window.rainMm)),
    };
  });
  const days = primary.days.map((baseDay, dayIndex) => {
    const pointDays = allPoints.map((point) => point.daily[dayIndex]).filter(Boolean);
    const dailyProbabilities = pointDays.map((day) => day.pointProbabilityMax);
    const dailyProbabilityMean = meanNullable(dailyProbabilities);
    const rainValues = pointDays.map((day) => day.rainMm);
    const rainMeanMm = meanNullable(rainValues);
    const corroboratedRainMm = getCorroboratedRainMm(allPoints, dayIndex);
    const peak = windows
      .filter((window) => window.dayIndex === dayIndex)
      .sort((a, b) => requestedMode === "chance"
        ? (b.areaMeanProbabilityPeak ?? -1) - (a.areaMeanProbabilityPeak ?? -1) || (b.rainMeanMm ?? -1) - (a.rainMeanMm ?? -1)
        : (b.rainMeanMm ?? -1) - (a.rainMeanMm ?? -1) || (b.areaMeanProbabilityPeak ?? -1) - (a.areaMeanProbabilityPeak ?? -1))[0];
    return {
      ...baseDay,
      dailyAreaMeanProbability: dailyProbabilityMean === null ? null : Math.round(dailyProbabilityMean),
      dailyAreaMaxProbability: maxNullable(dailyProbabilities),
      rainMeanMm,
      rainWatchMm: maxNullable([rainMeanMm, corroboratedRainMm]),
      rainMaxMm: maxNullable(rainValues),
      wetHours: meanNullable(pointDays.map((day) => day.wetHours)),
      peakWindow: peak?.label ?? null,
      weatherCode: mostCommonNullable(pointDays.map((day) => day.weatherCode)),
    };
  });
  const liveTmdPayloads = usable.filter((payload) => payload.dataQuality.tmdStatus === "live");
  const tmdStatus = requestedSource === "open-meteo"
    ? "not-configured"
    : liveTmdPayloads.length === usable.length
      ? "live"
      : liveTmdPayloads.length || usable.some((payload) => payload.dataQuality.tmdStatus === "unavailable")
        ? "unavailable"
        : "not-configured";
  const model = requestedSource === "open-meteo"
    ? "Open-Meteo Best Match / GFS · 54 boundary-aware metropolitan samples"
    : tmdStatus === "live"
      ? requestedMode === "accumulation"
        ? "TMD NWP Daily (7 days) + Open-Meteo supporting fields · 54 boundary-aware metropolitan samples"
        : "TMD NWP 3 km (0–48h) + Open-Meteo probability / days 3–7 · 54 boundary-aware metropolitan samples"
      : "Open-Meteo Best Match / GFS (temporary TMD fallback) · 54 boundary-aware metropolitan samples";
  return {
    ...primary,
    province: metroRegion,
    status: payloads.length === provinces.length && payloads.every((payload) => payload.status === "live") ? "live" : "degraded",
    fetchedAt: usable.map((payload) => payload.fetchedAt).sort().at(-1) ?? primary.fetchedAt,
    model,
    disclaimer: "โอกาสฝนรายวันใช้ค่าสูงสุดตามเวลาของแต่ละจุด แล้วหาค่าเฉลี่ยจาก 54 จุดใน 6 จังหวัด ส่วนระดับเฝ้าระวังต้องมีจุดใกล้กันสนับสนุน ไม่ใช้ค่าสูงสุดโดดเดี่ยวแทนทั้งพื้นที่",
    sources: [...new Set(usable.flatMap((payload) => payload.sources))],
    dataQuality: {
      ...primary.dataQuality,
      requestedMode,
      requestedSource,
      provider: requestedSource === "tmd" && liveTmdPayloads.length
        ? requestedMode === "accumulation" ? "tmd-nwp-daily" : "tmd-nwp-hybrid"
        : primary.dataQuality.provider,
      providerFallback: usable.some((payload) => payload.dataQuality.providerFallback),
      tmdStatus,
      tmdAcceptedPoints: usable.reduce((sum, payload) => sum + (payload.dataQuality.tmdAcceptedPoints ?? 0), 0),
      tmdForecastValues: usable.reduce((sum, payload) => sum + (payload.dataQuality.tmdForecastValues ?? 0), 0),
      tmdCadenceHours: liveTmdPayloads.length
        ? Math.max(...liveTmdPayloads.map((payload) => payload.dataQuality.tmdCadenceHours ?? 0)) || null
        : null,
      tmdProduct: liveTmdPayloads[0]?.dataQuality.tmdProduct,
      expectedPoints: usable.reduce((sum, payload) => sum + payload.dataQuality.expectedPoints, 0),
      acceptedPoints: usable.reduce((sum, payload) => sum + payload.dataQuality.acceptedPoints, 0),
      rejectedPoints: usable.reduce((sum, payload) => sum + (payload.dataQuality.rejectedPoints ?? 0), 0),
      coverageHours: Math.min(...usable.map((payload) => payload.dataQuality.coverageHours)),
    },
    days,
    windows,
    points: allPoints,
  };
}

export function rainAmountLevel(value: number | null) {
  if (value === null) return { label: "ไม่มีข้อมูล", color: "#94a3b8" };
  if (value < 0.1) return { label: "ไม่มีฝน", color: "#d9f3f8" };
  if (value <= 10) return { label: "ฝนเล็กน้อย", color: "#45c5dd" };
  if (value <= 35) return { label: "ฝนปานกลาง", color: "#2879d0" };
  if (value <= 90) return { label: "ฝนหนัก", color: "#3546a8" };
  return { label: "ฝนหนักมาก", color: "#6d28a8" };
}
