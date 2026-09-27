import { bangkokDate, type DataMode, type EnvironmentLayer, type MapStep, type Metric } from "./map-intelligence.ts";
import type { RegionId } from "./provinces.ts";
export type WeatherSource = "open-meteo" | "tmd";

export function environmentRequest(layer: EnvironmentLayer, province: RegionId, mode: DataMode, source: WeatherSource, metric: Metric, directRain = false) {
  const params = new URLSearchParams({ province });
  if (layer === "rain" && directRain) {
    const url = `/api/rain-places?${params}`;
    return { url, key: url };
  }
  if (layer !== "air") params.set("source", source);
  if (layer === "rain") params.set("mode", metric === "secondary" ? "accumulation" : "chance");
  const url = `/api/${layer === "air" ? "forecast" : `${layer}-forecast`}?${params}`;
  return { url, key: `${url}:${layer === "air" ? mode : "forecast"}` };
}

/** Default to the real Bangkok date/hour, even when a cached horizon starts yesterday. */
export function currentForecastIndex(steps: MapStep[], now = new Date()) {
  const date = bangkokDate(now);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hourCycle: "h23" }).format(now));
  const hourly = steps.findIndex((step) => step.date === date && step.cadence === "hour" && step.startHour === hour);
  if (hourly >= 0) return hourly;
  const window = steps.findIndex((step) => step.date === date && step.window !== null && step.cadence !== "hour" && step.startHour !== undefined && step.endHour !== undefined && step.startHour <= hour && hour < step.endHour);
  if (window >= 0) return window;
  const daily = steps.findIndex((step) => step.date === date && step.window === null);
  if (daily >= 0) return daily;
  // Daily-only sources may begin tomorrow. Select an available period honestly.
  const currentSlot = date + ":" + String(hour).padStart(2, "0");
  let next = -1, previous = -1, nextSlot = "", previousSlot = "";
  steps.forEach((step, i) => {
    const slot = step.date + ":" + String(step.startHour ?? 0).padStart(2, "0");
    if (slot >= currentSlot && (next < 0 || slot < nextSlot)) { next = i; nextSlot = slot; }
    if (slot < currentSlot && (previous < 0 || slot > previousSlot)) { previous = i; previousSlot = slot; }
  });
  return next >= 0 ? next : previous;
}

/** Do not interleave daily aggregates with three-hour samples during playback. */
export function timelineIndices(steps: MapStep[], index: number) {
  const cadence = steps[index]?.cadence ?? (steps[index]?.window != null ? "window" : "day");
  return steps.flatMap((step, i) => (step.cadence ?? (step.window != null ? "window" : "day")) === cadence ? [i] : []);
}
export function timelineKeyIndex(key: string, position: number, length: number) {
  if (!length) return null;
  const deltas: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -8, PageUp: 8 };
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  return key in deltas ? Math.max(0, Math.min(length - 1, position + deltas[key])) : null;
}
export function indexForDate(steps: MapStep[], index: number, date: string) {
  const window = steps[index]?.window ?? null;
  const exact = steps.findIndex((s) => s.date === date && s.window === window && s.cadence === steps[index]?.cadence);
  return exact >= 0 ? exact : steps.findIndex((s) => s.date === date);
}

export function nextTimelineIndex(steps: MapStep[], index: number) {
  const indices = timelineIndices(steps, index);
  return indices[(indices.indexOf(index) + 1) % indices.length] ?? 0;
}
