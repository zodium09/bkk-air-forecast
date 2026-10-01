import { average, pointValue, type MapDataset, type Metric } from "./map-intelligence.ts";
import { boundaryContains, interpolateMapValue, type MapBoundary } from "./map-surface.ts";
import type { MapPlace } from "./map-places.ts";

/** Overview values always refer to a real daily period on the requested date. */
export function dailyIndex(data: MapDataset | null, date: string) {
  if (!data || data.status === "unavailable") return -1;
  return data.steps.findIndex((step) => step.date === date && step.window === null);
}

export function overviewValue(data: MapDataset | null, date: string, metric: Metric, place: MapPlace | null = null, boundary: MapBoundary | null = null) {
  const index = dailyIndex(data, date);
  return overviewStepValue(data, index, metric, place, boundary);
}

/** Shared current-period reading. A missing period never becomes a zero. */
export function overviewStepValue(data: MapDataset | null, index: number, metric: Metric, place: MapPlace | null = null, boundary: MapBoundary | null = null) {
  if (!data || data.status === "unavailable" || index < 0 || !data.steps[index]) return null;
  if (!place) return average(data.points.map((point) => pointValue(point, index, metric)));
  if (!boundary || !boundaryContains(boundary, place.lat, place.lng)) return null;
  if (data.valueMethod === "provider") {
    const point = data.points.find((candidate) => candidate.place?.id === place.id && candidate.lat === place.lat && candidate.lng === place.lng);
    return point ? pointValue(point, index, metric) : null;
  }
  return interpolateMapValue(data.points, index, metric, place.lat, place.lng);
}

export function overviewDates(datasets: (MapDataset | null)[], today: string) {
  return [...new Set(datasets.flatMap((data) => data?.status === "unavailable" ? [] : data?.steps.filter((step) => step.window === null && step.date >= today).map((step) => step.date) ?? []))].sort().slice(0, 7);
}

export function sourceState(data: MapDataset | null, loading: boolean, error: string) {
  if (loading) return "กำลังโหลด";
  if (error || !data || data.status === "unavailable") return "ไม่มีข้อมูล";
  return data.status === "live" ? "ข้อมูลพร้อม" : "ข้อมูลบางส่วน / แหล่งสำรอง";
}

export function overviewTimestamp(data: MapDataset | null) {
  if (!data?.timestamp) return "ยังไม่มีเวลาอ้างอิง";
  if (!/^\d{4}-\d{2}-\d{2}T/.test(data.timestamp)) return data.timestamp;
  const date = new Date(data.timestamp);
  if (!Number.isFinite(date.getTime())) return "ยังไม่มีเวลาอ้างอิง";
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(date);
}

/** A shared zero baseline makes forecast bars honest; negative values remain visible. */
export function chartScale(values: (number | null)[]) {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  const minimum = Math.min(0, ...finite);
  const maximum = Math.max(0, ...finite);
  const span = maximum - minimum || 1;
  const power = 10 ** Math.floor(Math.log10(span));
  const tick = span / power > 5 ? power * 2 : span / power > 2 ? power : power / 2;
  return { min: Math.floor(minimum / tick) * tick, max: Math.max(tick, Math.ceil((maximum + span * .18) / tick) * tick) };
}
