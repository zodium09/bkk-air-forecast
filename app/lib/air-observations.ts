import { regionContains, provinces, type ProvinceId, type RegionId } from "./provinces.ts";
import { observationAge, observationNumber, observationTime } from "./observation-time.ts";
import { fetchWithTimeout } from "./fetch-with-timeout.ts";

export const AIR_OBSERVATION_SOURCES = { airbkk: "https://official.airbkk.com/airbkk/Api", air4thai: "https://air4thai.pcd.go.th/services/getNewAQI_JSON.php" };
export type AirObservation = {
  id: string; name: string; area: string; provinceId: ProvinceId; lat: number; lng: number;
  value: number | null; observedAt: string | null; source: "AirBKK" | "Air4Thai";
  sourceLevel: string | null; averagingHours: number | null;
  status: "fresh" | "stale" | "unavailable";
};
export type AirObservationPayload = {
  status: "live" | "degraded" | "unavailable"; fetchedAt: string; stations: AirObservation[];
  upstream: { airbkk: boolean; air4thai: boolean };
};
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const string = (value: unknown) => typeof value === "string" ? value.trim() : "";

export function normalizeAirObservations(airbkk: unknown, air4thai: unknown, now = Date.now()): AirObservationPayload {
  const bkk = object(airbkk), pcd = object(air4thai);
  const upstream = { airbkk: bkk.status === "Success" && Array.isArray(bkk.message), air4thai: Array.isArray(pcd.stations) };
  const stations = new Map<string, AirObservation>();
  function accept(raw: unknown, source: AirObservation["source"]) {
    const row = object(raw), last = object(row.AQILast), pm25 = object(last.PM25);
    const lat = observationNumber(source === "AirBKK" ? row.Lat : row.lat, 12, 18);
    const lng = observationNumber(source === "AirBKK" ? row.Long : row.long, 98, 102);
    const area = string(source === "AirBKK" ? row.District : row.areaTH);
    const province = source === "AirBKK" ? provinces[0] : provinces.find(p => area.includes(p.id === "bangkok" ? "กรุงเทพ" : p.nameTh));
    const id = row[source === "AirBKK" ? "MeasIndex" : "stationID"];
    if (!province || id === null || id === undefined || !String(id).trim() || lat === null || lng === null) return;
    const { bounds } = province;
    if (lat < bounds.minLat || lat > bounds.maxLat || lng < bounds.minLng || lng > bounds.maxLng || !regionContains(province.id, lat, lng, province.id)) return;
    const time = observationTime(source === "AirBKK" ? row.DateTime : `${string(last.date)} ${string(last.time)}`);
    const observedAt = time === null ? null : new Date(time).toISOString();
    const age = observationAge(observedAt, now);
    const rawValue = observationNumber(source === "AirBKK" ? row["PM2.5"] : pm25.value, 0, 500);
    const value = age !== null && age <= 360 ? rawValue : null;
    const sourceLevel = string(source === "AirBKK" ? row["PM2.5_aqi"] : pm25.color);
    const station: AirObservation = {
      id: `${source.toLowerCase()}-${id}`, name: string(source === "AirBKK" ? row.Area : row.nameTH) || area, area,
      provinceId: province.id, lat, lng, value, observedAt, source,
      sourceLevel: ["blue", "green", "yellow", "orange", "red"].includes(sourceLevel) ? sourceLevel : null,
      // Neither public contract explicitly supplies an averaging period. Never infer it from the update frequency.
      averagingHours: null, status: value === null ? "unavailable" : age! <= 90 ? "fresh" : "stale",
    };
    const old = stations.get(station.id);
    if (!old || value !== null && (old.value === null || (observedAt ?? "") > (old.observedAt ?? ""))) stations.set(station.id, station);
  }
  if (upstream.airbkk) (bkk.message as unknown[]).forEach(row => accept(row, "AirBKK"));
  if (upstream.air4thai) (pcd.stations as unknown[]).forEach(row => accept(row, "Air4Thai"));
  // Only identical physical stations with matching source periods are deduplicated; keep the newest usable sample.
  const ordered = [...stations.values()].sort((a, b) => (b.observedAt ?? "").localeCompare(a.observedAt ?? "") || a.source.localeCompare(b.source));
  const unique = ordered.filter((station, index) => !ordered.slice(0, index).some(previous => previous.value !== null && station.averagingHours !== null && previous.averagingHours === station.averagingHours && Math.hypot(previous.lat - station.lat, previous.lng - station.lng) < .0007));
  const fresh = unique.filter(station => station.status === "fresh");
  return { status: !fresh.length ? "unavailable" : upstream.airbkk && upstream.air4thai ? "live" : "degraded", fetchedAt: new Date(now).toISOString(), stations: unique, upstream };
}

export async function fetchAirObservations(options: { fetchImpl?: typeof fetch; now?: number; timeoutMs?: number } = {}) {
  const fetcher = options.fetchImpl ?? fetch;
  const load = async (url: string, init: RequestInit = {}) => {
    try { const response = await fetchWithTimeout(fetcher, url, { headers: { Accept: "application/json" }, ...init }, options.timeoutMs ?? 9000); return response.ok ? await response.json() : null; } catch { return null; }
  };
  const [airbkk, air4thai] = await Promise.all([
    load(AIR_OBSERVATION_SOURCES.airbkk, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: "{}" }),
    load(AIR_OBSERVATION_SOURCES.air4thai),
  ]);
  return normalizeAirObservations(airbkk, air4thai, options.now ?? Date.now());
}

export function selectAirObservation(stations: AirObservation[], region: RegionId, place: { lat: number; lng: number } | null, now = Date.now()) {
  const inArea = stations.filter(station => regionContains(region, station.lat, station.lng, station.provinceId));
  const usable = inArea.filter(station => station.value !== null && observationAge(station.observedAt, now) !== null && observationAge(station.observedAt, now)! <= 90);
  const distance = (s: AirObservation) => place ? Math.hypot((s.lat - place.lat) * 111, (s.lng - place.lng) * 108) : 0;
  const nearest = place ? [...usable].sort((a,b) => distance(a) - distance(b))[0] : null;
  // A station reading is never presented as a reading at a different place.
  const selected = nearest && distance(nearest) <= 30 ? nearest : null;
  const candidates = place ? selected ? [selected] : [] : usable;
  // Unknown periods from different agencies cannot be averaged together. Prefer one clearly named source group.
  const groups = Map.groupBy(candidates, station => station.averagingHours === null ? station.source : String(station.averagingHours));
  const shown = [...groups.values()].sort((a,b) => b.length-a.length)[0] ?? [];
  const value = shown.length ? shown.reduce((sum,s) => sum + s.value!,0) / shown.length : null;
  return { value, station: selected, stations: usable, sources: [...new Set(shown.map(s=>s.source))], count: shown.length, distanceKm: selected ? distance(selected) : null, observedAt: shown.map(s => s.observedAt).filter((v): v is string => !!v).sort()[0] ?? null };
}
