import { addDays, bangkokDateKey } from "./forecast/timestamps.ts";
import { FORECAST_DAYS } from "./forecast-horizon.ts";
import { METRO_REGION_ID, metroRegion, provinces, type RegionId } from "./provinces.ts";

export type ForecastStatus = "live" | "degraded" | "unavailable";
export type UpstreamStatus = "ok" | "timeout" | "error";
export type ForecastStation = {
  id: string; district: string; label: string; lat: number; lng: number; values: number[];
  observed?: number; observedAt?: string; sourceType?: string;
};
export type ForecastDay = {
  lead: number; date: string; weekday: string; forecastReliabilityScore: number; uncertainty: number;
  wind: string; weather: string; note: string; year: number;
  sourceMode?: "cams" | "extrapolated" | "placeholder"; coverageHours?: number;
  /** @deprecated Migration alias. This heuristic is not statistical confidence. */
  confidence?: number;
};

export type ForecastPayload = {
  province?: { id: RegionId; nameTh: string; shortNameTh: string; nameEn: string };
  dataMode?: "airbkk-cams" | "airbkk-air4thai-cams" | "air4thai-cams" | "cams-only";
  status: ForecastStatus | "fallback";
  issuedAt: string;
  model?: string;
  disclaimer?: string;
  sources?: string[];
  degradedReasons?: string[];
  dataQuality?: {
    acceptedStations?: number;
    observationAgeHours?: number;
    camsMinimumCoverageHours?: number;
    upstream?: Record<string, UpstreamStatus>;
    provinceCoverage?: number;
    [key: string]: unknown;
  };
  days: ForecastDay[];
  stations: ForecastStation[];
};

export function aggregateMetroForecast(payloads: ForecastPayload[]): ForecastPayload {
  const usable = payloads.filter((payload) => payload.status !== "unavailable");
  const primary = usable[0] ?? payloads[0];
  if (!primary) throw new Error("metropolitan forecast unavailable");
  return {
    ...primary,
    province: metroRegion,
    status: usable.length
      ? (payloads.length === provinces.length && payloads.every((payload) => payload.status === "live") ? "live" : "degraded")
      : "unavailable",
    model: "AirBKK + Air4Thai + CAMS Global · ภาพรวมกรุงเทพฯ และปริมณฑล 6 จังหวัด",
    disclaimer: "ภาพรวมรวมสถานีและกริดแบบจำลองจากทั้ง 6 จังหวัด ค่าบนแผนที่เป็นค่าพยากรณ์และการประมาณเชิงพื้นที่",
    sources: [...new Set(usable.flatMap((payload) => payload.sources ?? []))],
    degradedReasons: [...new Set(payloads.flatMap((payload) => payload.degradedReasons ?? []))],
    dataQuality: {
      ...primary.dataQuality,
      acceptedStations: usable.reduce((sum, payload) => sum + (payload.dataQuality?.acceptedStations ?? payload.stations.length), 0),
      provinceCoverage: usable.length,
    },
    stations: usable.flatMap((payload) => payload.stations.map((station) => ({
      ...station,
      id: `${payload.province?.id ?? METRO_REGION_ID}-${station.id}`,
    }))),
  };
}

function formatDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  return { date: `${day} ${months[month - 1]}`, weekday: weekdays[date.getUTCDay()], year: year + 543 };
}
export function buildForecastDayShells(timestamp = Date.now()): ForecastDay[] {
  const today = bangkokDateKey(timestamp);
  return Array.from({ length: FORECAST_DAYS }, (_, index) => ({
    lead: index + 1, ...formatDate(addDays(today, index + 1)), forecastReliabilityScore: 0, uncertainty: 0,
    wind: "รอข้อมูลสภาพอากาศ", weather: "รอข้อมูลล่าสุด",
    note: "Placeholder ระหว่างโหลดข้อมูล ไม่ใช่ค่าพยากรณ์", sourceMode: "placeholder" as const, coverageHours: 0,
  }));
}

export const forecastDays = buildForecastDayShells();
export const forecastStations: ForecastStation[] = [];
export const issuedAt = "รอข้อมูลล่าสุด";

export function getLevel(value: number) {
  if (value <= 15) return { label: "ดีมาก", color: "#38bdf8", className: "very-good" };
  if (value <= 25) return { label: "ดี", color: "#34d399", className: "good" };
  if (value <= 37.5) return { label: "ปานกลาง", color: "#facc15", className: "moderate" };
  if (value <= 75) return { label: "เริ่มมีผลกระทบ", color: "#fb923c", className: "unhealthy" };
  return { label: "มีผลกระทบ", color: "#f43f5e", className: "hazard" };
}
