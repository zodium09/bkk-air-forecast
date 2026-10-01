import { observationAge, observationNumber, observationTime } from "./observation-time.ts";
import { fetchWithTimeout } from "./fetch-with-timeout.ts";

export const ROAD_FLOOD_SOURCE = "https://weather.bangkok.go.th/flood/";
export const ROAD_FLOOD_API = "https://weather.bangkok.go.th/Flood/PageMap/GetData?id=0";
export type RoadFloodStation = {
  id: string; code: string; name: string; road: string; district: string; kind: "road" | "tunnel";
  direction: string; lat: number; lng: number; value: number | null; observedAt: string | null;
  sourceStatus: string; status: "fresh" | "stale" | "unavailable";
  level: "normal" | "minor" | "flood" | "unknown";
};
export type RoadFloodPayload = { status: "live" | "degraded" | "unavailable"; fetchedAt: string; sourcePage: string; stations: RoadFloodStation[] };
const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" ? v as Record<string, unknown> : {};
const string = (v: unknown) => typeof v === "string" ? v.trim() : "";

export function normalizeRoadFloods(raw: unknown, now = Date.now()): RoadFloodPayload {
  const feed = object(raw);
  // dtTbl holds separate inlet/outlet records. Station ids, rather than repeated tunnel codes, retain their identity.
  const rows = Array.isArray(feed.dtTbl) ? feed.dtTbl : [];
  const stations = new Map<string, RoadFloodStation>();
  for (const rawRow of rows) {
    const row = object(rawRow);
    const lat = observationNumber(row.latitude, 13.4, 14.1), lng = observationNumber(row.longitude, 100.2, 101);
    const code = string(row.flood_code), name = string(row.flood_shortname) || string(row.flood_name);
    if (lat === null || lng === null || !name || !code || row.flood_id === null || row.flood_id === undefined) continue;
    const timestamp = observationTime(row.site_timestamp);
    const observedAt = timestamp === null ? null : new Date(timestamp).toISOString();
    const age = observationAge(observedAt, now);
    const sourceStatus = string(row.chkStatustxt);
    const available = ["ปกติ", "น้ำท่วมเล็กน้อย", "น้ำท่วมขังเล็กน้อย", "น้ำท่วม"].includes(sourceStatus) && row.sensor !== "ขัดข้อง";
    const reading = observationNumber(row.flood, 0, 500);
    const value = available && age !== null && age <= 360 ? reading : null;
    const status = value === null ? "unavailable" : age! <= 30 ? "fresh" : "stale";
    const station: RoadFloodStation = {
      id: `bma-${row.flood_id}`, code, name: name.replace(/\s*\*$/, ""), road: string(row.road_name), district: string(row.districtName),
      kind: code.startsWith("TN.") ? "tunnel" : "road", direction: code.startsWith("TN.") ? string(row.tunnel_sub_name) : "",
      lat, lng, value, observedAt, sourceStatus, status,
      // Preserve the agency's classification; never invent a travel-safety conclusion from the depth.
      level: status !== "fresh" ? "unknown" : sourceStatus === "ปกติ" ? "normal" : sourceStatus === "น้ำท่วม" ? "flood" : "minor",
    };
    const old = stations.get(station.id);
    if (!old || value !== null && (old.value === null || (observedAt ?? "") > (old.observedAt ?? ""))) stations.set(station.id, station);
  }
  const values = [...stations.values()];
  return { status: !values.some(s => s.status === "fresh") ? "unavailable" : values.every(s => s.status === "fresh") ? "live" : "degraded", fetchedAt: new Date(now).toISOString(), sourcePage: ROAD_FLOOD_SOURCE, stations: values };
}

export async function fetchRoadFloods(options: { fetchImpl?: typeof fetch; now?: number; timeoutMs?: number } = {}) {
  try {
    const response = await fetchWithTimeout(options.fetchImpl ?? fetch, ROAD_FLOOD_API, { headers: { Accept: "application/json" } }, options.timeoutMs ?? 10000);
    if (!response.ok) throw new Error("upstream");
    return normalizeRoadFloods(await response.json(), options.now ?? Date.now());
  } catch { return normalizeRoadFloods(null, options.now ?? Date.now()); }
}

export function currentRoadFloods(stations: RoadFloodStation[], now = Date.now()) {
  return stations.map(station => {
    const age = observationAge(station.observedAt, now);
    if (age === null || age > 360) return { ...station, value: null, status: "unavailable" as const, level: "unknown" as const };
    return station.status === "fresh" && (age === null || age > 30) ? { ...station, status: "stale" as const, level: "unknown" as const } : station;
  });
}
