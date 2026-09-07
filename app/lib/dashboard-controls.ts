import type { DataMode, EnvironmentLayer, MapStep, Metric } from "./map-intelligence.ts";
import type { RegionId } from "./provinces.ts";
export type WeatherSource = "open-meteo" | "tmd";

export function environmentRequest(layer: EnvironmentLayer, province: RegionId, mode: DataMode, source: WeatherSource, metric: Metric) {
  const params = new URLSearchParams({ province });
  if (layer !== "air") params.set("source", source);
  if (layer === "rain") params.set("mode", metric === "secondary" ? "accumulation" : "chance");
  const url = `/api/${layer === "air" ? "forecast" : `${layer}-forecast`}?${params}`;
  return { url, key: `${url}:${layer === "air" ? mode : "forecast"}` };
}

/** Do not interleave daily aggregates with three-hour samples during playback. */
export function timelineIndices(steps: MapStep[], index: number) {
  const hourly = steps[index]?.window != null;
  return steps.flatMap((step, i) => (step.window != null) === hourly ? [i] : []);
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
  const exact = steps.findIndex((s) => s.date === date && s.window === window);
  return exact >= 0 ? exact : steps.findIndex((s) => s.date === date);
}

export function nextTimelineIndex(steps: MapStep[], index: number) {
  const indices = timelineIndices(steps, index);
  return indices[(indices.indexOf(index) + 1) % indices.length] ?? 0;
}
