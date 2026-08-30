import { FORECAST_DAYS } from "./forecast-horizon.ts";
import { metroRegion, provinces, type RegionId } from "./provinces.ts";

export type HeatStatus = "live" | "degraded" | "unavailable";

export type HeatPointDay = {
  maxTemperatureC: number | null;
  maxHeatIndexC: number | null;
  peakHour: string | null;
};

export type HeatPoint = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  daily: HeatPointDay[];
};

export type HeatDay = {
  lead: number;
  dateKey: string;
  date: string;
  weekday: string;
  year: number;
  maxTemperatureC: number | null;
  maxHeatIndexC: number | null;
  pointMaxTemperatureC: number | null;
  pointMaxHeatIndexC: number | null;
  peakHour: string | null;
};

export type HeatForecastPayload = {
  province: { id: RegionId; nameTh: string; shortNameTh: string; nameEn: string };
  status: HeatStatus;
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
    tmdFailureReason?: string;
    providersTried?: string[];
    error?: string;
  };
  days: HeatDay[];
  points: HeatPoint[];
};

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

/** NOAA/NWS Rothfusz regression. Input and output are Celsius. */
export function calculateHeatIndexC(temperatureC: number, relativeHumidity: number) {
  if (!Number.isFinite(temperatureC) || !Number.isFinite(relativeHumidity)) return null;
  const rh = Math.max(0, Math.min(100, relativeHumidity));
  const temperatureF = temperatureC * 9 / 5 + 32;
  const simple = 0.5 * (temperatureF + 61 + ((temperatureF - 68) * 1.2) + (rh * 0.094));
  const initial = (simple + temperatureF) / 2;
  if (initial < 80) return rounded((simple - 32) * 5 / 9);

  let heatIndexF = -42.379
    + 2.04901523 * temperatureF
    + 10.14333127 * rh
    - 0.22475541 * temperatureF * rh
    - 0.00683783 * temperatureF ** 2
    - 0.05481717 * rh ** 2
    + 0.00122874 * temperatureF ** 2 * rh
    + 0.00085282 * temperatureF * rh ** 2
    - 0.00000199 * temperatureF ** 2 * rh ** 2;

  if (rh < 13 && temperatureF >= 80 && temperatureF <= 112) {
    heatIndexF -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(temperatureF - 95)) / 17);
  } else if (rh > 85 && temperatureF >= 80 && temperatureF <= 87) {
    heatIndexF += ((rh - 85) / 10) * ((87 - temperatureF) / 5);
  }
  return rounded((heatIndexF - 32) * 5 / 9);
}

export function getHeatRisk(value: number | null) {
  if (value === null) return { key: "unavailable", label: "รอข้อมูล", color: "#94a3b8", guidance: "ยังประเมินความเสี่ยงไม่ได้" } as const;
  if (value < 27) return { key: "normal", label: "ต่ำกว่าเกณฑ์เฝ้าระวัง", color: "#38bdf8", guidance: "ทำกิจกรรมได้ตามปกติและดื่มน้ำสม่ำเสมอ" } as const;
  if (value < 33) return { key: "watch", label: "เฝ้าระวัง", color: "#22c55e", guidance: "พักเป็นระยะและดื่มน้ำบ่อยขึ้น" } as const;
  if (value < 42) return { key: "warning", label: "เตือนภัย", color: "#eab308", guidance: "ลดกิจกรรมกลางแจ้งช่วงร้อนจัด" } as const;
  if (value < 52) return { key: "danger", label: "อันตราย", color: "#f97316", guidance: "หลีกเลี่ยงแดดจัดและเฝ้าระวังอาการผิดปกติ" } as const;
  return { key: "extreme", label: "อันตรายมาก", color: "#dc2626", guidance: "งดกิจกรรมกลางแจ้งที่ไม่จำเป็นและดูแลกลุ่มเสี่ยงใกล้ชิด" } as const;
}

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function formatHeatDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  return { date: `${day} ${months[month - 1]}`, weekday: weekdays[date.getUTCDay()], year: year + 543 };
}

export function buildHeatDayShells(startDateKey?: string): HeatDay[] {
  const today = startDateKey ?? new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date());
  return Array.from({ length: FORECAST_DAYS }, (_, index) => {
    const dateKey = addDays(today, index);
    return { lead: index + 1, dateKey, ...formatHeatDate(dateKey), maxTemperatureC: null, maxHeatIndexC: null, pointMaxTemperatureC: null, pointMaxHeatIndexC: null, peakHour: null };
  });
}

function mean(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return valid.length ? rounded(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null;
}

function max(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return valid.length ? rounded(Math.max(...valid)) : null;
}

export function aggregateMetroHeat(payloads: HeatForecastPayload[]): HeatForecastPayload {
  const usable = payloads.filter((payload) => payload.status !== "unavailable");
  const primary = usable[0] ?? payloads[0];
  if (!primary) throw new Error("metropolitan heat forecast unavailable");
  if (!usable.length) return { ...primary, province: metroRegion, points: [] };
  const days = primary.days.map((baseDay, dayIndex) => {
    const matches = usable.map((payload) => payload.days[dayIndex]).filter(Boolean);
    const hottest = [...matches].sort((a, b) => (b.pointMaxHeatIndexC ?? -999) - (a.pointMaxHeatIndexC ?? -999))[0];
    return {
      ...baseDay,
      maxTemperatureC: mean(matches.map((day) => day.maxTemperatureC)),
      maxHeatIndexC: mean(matches.map((day) => day.maxHeatIndexC)),
      pointMaxTemperatureC: max(matches.map((day) => day.pointMaxTemperatureC)),
      pointMaxHeatIndexC: max(matches.map((day) => day.pointMaxHeatIndexC)),
      peakHour: hottest?.peakHour ?? null,
    };
  });
  return {
    ...primary,
    province: metroRegion,
    status: payloads.length === provinces.length && payloads.every((payload) => payload.status === "live") ? "live" : "degraded",
    fetchedAt: usable.map((payload) => payload.fetchedAt).sort().at(-1) ?? primary.fetchedAt,
    model: "TMD NWP (เมื่อพร้อม) + Open-Meteo · 54-point metropolitan grid",
    disclaimer: "อุณหภูมิสูงสุดและ Heat Index เป็นค่าประมาณจากแบบจำลอง 54 จุดใน 6 จังหวัด ใช้เพื่อวางแผนเบื้องต้น ไม่ใช่ประกาศเตือนภัยทางการ",
    sources: [...new Set(usable.flatMap((payload) => payload.sources))],
    dataQuality: {
      ...primary.dataQuality,
      expectedPoints: usable.reduce((sum, payload) => sum + payload.dataQuality.expectedPoints, 0),
      acceptedPoints: usable.reduce((sum, payload) => sum + payload.dataQuality.acceptedPoints, 0),
      rejectedPoints: usable.reduce((sum, payload) => sum + (payload.dataQuality.rejectedPoints ?? 0), 0),
      coverageHours: Math.min(...usable.map((payload) => payload.dataQuality.coverageHours)),
    },
    days,
    points: usable.flatMap((payload) => payload.points.map((point) => ({ ...point, id: `${payload.province.id}-${point.id}`, label: `${payload.province.shortNameTh} · ${point.label}` }))),
  };
}
