import riverGeography from "../../data/chao-phraya-geography.json" with { type: "json" };
import { coverageContains } from "../geographic-coverage.ts";
import { observationAge, observationNumber, observationTime } from "../observation-time.ts";
import type { RainPoint } from "../upstream-watch-data.ts";

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const thai = (value: unknown) => typeof value === "string" ? value.trim() : typeof object(value).th === "string" ? String(object(value).th).trim() : "";

/** Basin 10 stations inside the recorded DWR core, never a basin-wide estimate. */
export function normalizeCentralRain(raw: unknown, now = Date.now()): RainPoint[] {
  const feed = object(raw);
  if (feed.result !== "OK" || !Array.isArray(feed.data)) return [];
  const stations = new Map<string, RainPoint>();
  for (const item of feed.data) {
    const row = object(item), station = object(row.station), basin = object(row.basin);
    if (String(basin.basin_code ?? "") !== "10") continue;
    const lat = observationNumber(station.tele_station_lat, 5, 21), lng = observationNumber(station.tele_station_long, 97, 106);
    const id = String(station.id ?? ""), name = thai(station.tele_station_name);
    const mm = observationNumber(row.rain_24h, 0, 2000), timestamp = observationTime(row.rainfall_datetime);
    const observedAt = timestamp === null ? null : new Date(timestamp).toISOString();
    const age = observationAge(observedAt, now);
    if (!id || !name || lat === null || lng === null || mm === null || age === null || age > 180 || !coverageContains(riverGeography.core, lat, lng)) continue;
    const point = { id, name, mm, observedAt: observedAt! };
    const previous = stations.get(id);
    if (!previous || point.observedAt > previous.observedAt) stations.set(id, point);
  }
  return [...stations.values()];
}
