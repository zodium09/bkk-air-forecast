import { FORECAST_DAYS } from "./forecast-horizon.ts";
import { metroRegion, provinces, type RegionId } from "./provinces.ts";

export type RainStatus = "live" | "degraded" | "unavailable";

export type RainDay = {
  lead: number;
  dateKey: string;
  date: string;
  weekday: string;
  year: number;
  probabilityMax: number | null;
  rainMeanMm: number | null;
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
  probabilityMax: number | null;
  rainMeanMm: number | null;
  rainMaxMm: number | null;
};

export type RainPointDay = {
  probabilityMax: number | null;
  rainMm: number | null;
  wetHours: number | null;
  weatherCode: number | null;
};

export type RainPointWindow = {
  dayIndex: number;
  windowIndex: number;
  probabilityMax: number | null;
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
    provider?: string;
    providerFallback?: boolean;
    tmdStatus?: "live" | "unavailable" | "not-configured";
    tmdAcceptedPoints?: number;
    tmdForecastValues?: number;
    tmdCadenceHours?: number | null;
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
      probabilityMax: null,
      rainMeanMm: null,
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

export function aggregateMetroRain(payloads: RainForecastPayload[]): RainForecastPayload {
  const usable = payloads.filter((payload) => payload.status !== "unavailable");
  const primary = usable[0] ?? payloads[0];
  if (!primary) throw new Error("metropolitan rain forecast unavailable");
  if (!usable.length) return { ...primary, province: metroRegion, points: [], windows: [] };

  const windows = primary.windows.map((baseWindow) => {
    const matches = usable.map((payload) => payload.windows.find((window) =>
      window.dayIndex === baseWindow.dayIndex && window.windowIndex === baseWindow.windowIndex,
    )).filter(Boolean);
    return {
      ...baseWindow,
      probabilityMax: maxNullable(matches.map((window) => window?.probabilityMax)),
      rainMeanMm: meanNullable(matches.map((window) => window?.rainMeanMm)),
      rainMaxMm: maxNullable(matches.map((window) => window?.rainMaxMm)),
    };
  });
  const days = primary.days.map((baseDay, dayIndex) => {
    const matches = usable.map((payload) => payload.days[dayIndex]).filter(Boolean);
    const peak = windows
      .filter((window) => window.dayIndex === dayIndex)
      .sort((a, b) => (b.rainMeanMm ?? -1) - (a.rainMeanMm ?? -1) || (b.probabilityMax ?? -1) - (a.probabilityMax ?? -1))[0];
    return {
      ...baseDay,
      probabilityMax: maxNullable(matches.map((day) => day?.probabilityMax)),
      rainMeanMm: meanNullable(matches.map((day) => day?.rainMeanMm)),
      rainMaxMm: maxNullable(matches.map((day) => day?.rainMaxMm)),
      wetHours: meanNullable(matches.map((day) => day?.wetHours)),
      peakWindow: peak?.label ?? null,
    };
  });
  return {
    ...primary,
    province: metroRegion,
    status: payloads.length === provinces.length && payloads.every((payload) => payload.status === "live") ? "live" : "degraded",
    fetchedAt: usable.map((payload) => payload.fetchedAt).sort().at(-1) ?? primary.fetchedAt,
    model: "Open-Meteo Best Match / GFS · 54-point metropolitan grid",
    disclaimer: "ภาพรวมพยากรณ์ฝนจากกริด 9 จุดต่อจังหวัด รวม 6 จังหวัด ไม่ใช่เรดาร์ฝนหรือประกาศเตือนภัย",
    sources: [...new Set(usable.flatMap((payload) => payload.sources))],
    dataQuality: {
      ...primary.dataQuality,
      expectedPoints: usable.reduce((sum, payload) => sum + payload.dataQuality.expectedPoints, 0),
      acceptedPoints: usable.reduce((sum, payload) => sum + payload.dataQuality.acceptedPoints, 0),
      rejectedPoints: usable.reduce((sum, payload) => sum + (payload.dataQuality.rejectedPoints ?? 0), 0),
      coverageHours: Math.min(...usable.map((payload) => payload.dataQuality.coverageHours)),
    },
    days,
    windows,
    points: usable.flatMap((payload) => payload.points.map((point) => ({
      ...point,
      id: `${payload.province.id}-${point.id}`,
      label: `${payload.province.shortNameTh} · ${point.label}`,
    }))),
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
