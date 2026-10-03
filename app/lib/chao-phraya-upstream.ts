import boundaries from "../data/chao-phraya-upstream-basins.json" with { type: "json" };
import { coverageContains } from "./geographic-coverage.ts";
import { observationAge, observationNumber, observationTime } from "./observation-time.ts";
import { type WaterStation } from "./water-levels.ts";

export const UPSTREAM_SOURCES = {
  water: "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load",
  rain: "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/rain_24h",
  dams: "https://api-v3.thaiwater.net/api/v1/thaiwater30/analyst/dam",
};
export const upstreamBasins = [
  { code: "06", name: "ปิง", connection: "ปิงและวัง → ปากน้ำโพ" },
  { code: "07", name: "วัง", connection: "วัง → ปิง → ปากน้ำโพ" },
  { code: "08", name: "ยม", connection: "ยม → น่าน → ปากน้ำโพ" },
  { code: "09", name: "น่าน", connection: "น่านและยม → ปากน้ำโพ" },
  { code: "11", name: "สะแกกรัง", connection: "สะแกกรัง → เจ้าพระยา" },
  { code: "12", name: "ป่าสัก", connection: "ป่าสัก → เจ้าพระยาที่อยุธยา" },
] as const;
export { upstreamSummary } from "./upstream-watch-data.ts";
export type { UpstreamBasin, UpstreamPayload } from "./upstream-watch-data.ts";
import type { DamPoint, UpstreamBasin, UpstreamPayload } from "./upstream-watch-data.ts";
const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" ? v as Record<string, unknown> : {};
const thai = (v: unknown) => { const t = typeof v === "string" ? v : object(v).th; return typeof t === "string" ? t.trim() : ""; };
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const numeric = (v: unknown, min = 0, max = 1e8) => observationNumber(v, min, max);
const code = (row: Record<string, unknown>) => String(object(row.basin).basin_code ?? "").padStart(2, "0");
function inBasin(code: string, lat: number | null, lng: number | null) {
  return lat !== null && lng !== null && coverageContains({ features: boundaries.features.filter(f => f.properties.MB_CODE === code) }, lat, lng);
}
function timestamp(v: unknown, now: number) {
  const time = observationTime(v), iso = time === null ? null : new Date(time).toISOString();
  const age = observationAge(iso, now);
  return age === null ? null : { iso: iso!, age };
}
function damNameKey(name: string) {
  return name.replace(/^เขื่อน\s*/, "").replace(/\s/g, "");
}
function sameReservoir(a: { point: DamPoint; lat: number; lng: number }, b: { point: DamPoint; lat: number; lng: number }) {
  if (a.point.id === b.point.id) return true;
  const first = damNameKey(a.point.name), second = damNameKey(b.point.name);
  const relatedNames = Math.min(first.length, second.length) >= 3 && (first.startsWith(second) || second.startsWith(first));
  const distanceKm = Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * Math.cos(a.lat * Math.PI / 180));
  return relatedNames && distanceKm <= 1;
}

/** Published basin codes are checked against the DWR 22-basin polygons. */
export function normalizeUpstream(raw: { water?: unknown; rain?: unknown; dams?: unknown }, now = Date.now()): UpstreamPayload {
  const w = object(object(raw.water).waterlevel_data), r = object(raw.rain), d = object(object(raw.dams).data);
  const upstream = { water: w.result === "OK" && Array.isArray(w.data), rain: r.result === "OK" && Array.isArray(r.data), dams: Array.isArray(d.dam_daily) };
  const basins: UpstreamBasin[] = upstreamBasins.map(b => ({ ...b, rain: [], water: [], dams: [] }));
  const byCode = new Map(basins.map(b => [b.code, b]));
  const reservoirs = new Map<string, { point: DamPoint; lat: number; lng: number }[]>();
  for (const item of upstream.rain ? list(r.data) : []) {
    const row = object(item), station = object(row.station), basin = byCode.get(code(row));
    const lat = numeric(station.tele_station_lat, 5, 21), lng = numeric(station.tele_station_long, 97, 106);
    const time = timestamp(row.rainfall_datetime, now), mm = numeric(row.rain_24h, 0, 2000);
    const name = thai(station.tele_station_name), id = String(station.id ?? "");
    if (!basin || !id || !name || !time || time.age > 180 || mm === null || !inBasin(basin.code, lat, lng)) continue;
    const point = { id, name, mm, observedAt: time.iso }, previous = basin.rain.findIndex(p => p.id === id);
    if (previous < 0) basin.rain.push(point); else if (point.observedAt > basin.rain[previous].observedAt) basin.rain[previous] = point;
  }
  for (const item of upstream.water ? list(w.data) : []) {
    const row = object(item), station = object(row.station), basin = byCode.get(code(row)), geocode = object(row.geocode);
    const lat = numeric(station.tele_station_lat, 5, 21), lng = numeric(station.tele_station_long, 97, 106);
    const time = timestamp(row.waterlevel_datetime, now), name = thai(station.tele_station_name), id = String(station.id ?? "");
    if (!basin || !id || !name || !time || time.age > 1440 || !inBasin(basin.code, lat, lng)) continue;
    const msl = numeric(row.waterlevel_msl, -100, 5000), gauge = numeric(row.waterlevel_m, -100, 5000), value = msl ?? gauge;
    const point: WaterStation = { id, name, waterway: thai(row.river_name) || "ต้นทางไม่ระบุทางน้ำ", kind: "river", provinceId: String(geocode.province_code ?? ""), province: thai(geocode.province_name), district: thai(geocode.amphoe_name), lat: lat!, lng: lng!, value, datum: msl !== null ? "msl" : "gauge", bank: msl !== null ? numeric(station.min_bank, -100, 5000) : null, ground: msl !== null ? numeric(station.ground_level, -100, 5000) : null, capacityPercent: numeric(row.storage_percent, -100, 1000), observedAt: time.iso, ageMinutes: time.age, status: value === null ? "unavailable" : time.age <= 60 ? "fresh" : "stale", agency: thai(object(row.agency).agency_name) || "ต้นทางไม่ระบุหน่วยงาน" };
    const previous = basin.water.findIndex(p => p.id === id);
    if (previous < 0) basin.water.push(point); else if (point.value !== null && (basin.water[previous].value === null || point.observedAt! > basin.water[previous].observedAt!)) basin.water[previous] = point;
  }
  for (const item of upstream.dams ? list(d.dam_daily) : []) {
    const row = object(item), dam = object(row.dam), basin = byCode.get(code(row)), date = row.dam_date;
    const time = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? timestamp(`${date} 00:00`, now) : null;
    const lat = numeric(dam.dam_lat, 5, 21), lng = numeric(dam.dam_long, 97, 106), id = String(dam.id ?? ""), name = thai(dam.dam_name);
    if (!basin || !id || !name || !time || time.age >= 2880 || !inBasin(basin.code, lat, lng)) continue;
    const publishedPercent = numeric(row.dam_storage_percent, 0, 200);
    // Some agency records use 0% while reporting a positive stored volume.
    // Keep the contradictory percentage missing; actual zero flow remains valid.
    const storagePercent = publishedPercent === 0 && (numeric(row.dam_storage) ?? 0) > 0 ? null : publishedPercent;
    const point: DamPoint = { id, name, date: date as string, storagePercent, inflowMillionM3: numeric(row.dam_inflow), releasedMillionM3: numeric(row.dam_released) };
    const candidate = { point, lat: lat!, lng: lng! }, entries = reservoirs.get(basin.code) ?? [];
    const previous = entries.findIndex(entry => sameReservoir(entry, candidate));
    const completeness = (p: DamPoint) => [p.storagePercent, p.inflowMillionM3, p.releasedMillionM3].filter(v => v !== null).length;
    if (previous < 0) entries.push(candidate);
    else if (point.date > entries[previous].point.date || (point.date === entries[previous].point.date && completeness(point) > completeness(entries[previous].point))) entries[previous] = candidate;
    reservoirs.set(basin.code, entries);
  }
  for (const basin of basins) basin.dams = (reservoirs.get(basin.code) ?? []).map(entry => entry.point);
  const any = basins.some(b => b.rain.length || b.water.some(s => s.value !== null) || b.dams.length);
  return { fetchedAt: new Date(now).toISOString(), status: !any ? "unavailable" : Object.values(upstream).every(Boolean) ? "live" : "degraded", upstream, basins, source: "ThaiWater · คลังข้อมูลน้ำแห่งชาติ", sourcePage: "https://www.thaiwater.net/water" };
}
