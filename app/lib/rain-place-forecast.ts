import { bangkokDate, type MapDataset, type MapPoint, type MapStep } from "./map-intelligence.ts";
import { placeArea, placeLabel, type MapPlace } from "./map-places.ts";

export const RAIN_PLACE_CACHE_SECONDS = 7200;
export const RAIN_PLACE_BATCH_SIZE = 50;
type RawPoint = { location_id?: number; latitude?: number; longitude?: number; utc_offset_seconds?: number;
  hourly_units?: Record<string, string>; daily_units?: Record<string, string>;
  hourly?: { time?: string[]; precipitation?: unknown[]; precipitation_probability?: unknown[] };
  daily?: { time?: string[]; precipitation_sum?: unknown[]; precipitation_probability_max?: unknown[] } };
type Snapshot = { at: string; rows: RawPoint[] | null; ttl: number };
const memory = new Map<string, { expires: number; snapshot: Snapshot }>();
const pending = new Map<string, Promise<Snapshot>>();

function wallTime(date: string, hour: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + hour * 3600000).toISOString().slice(0, 16);
}
function dateAfter(date: string, days: number) { return wallTime(date, days * 24).slice(0, 10); }

export function rainPlaceCacheTtl(now = new Date(), unavailable = false, forecastDate = bangkokDate(now)) {
  const tomorrow = dateAfter(forecastDate, 1);
  return Math.max(1, Math.min(unavailable ? 600 : RAIN_PLACE_CACHE_SECONDS, Math.floor((Date.parse(`${tomorrow}T00:00:00+07:00`) - now.getTime()) / 1000)));
}
export function rainPlaceSteps(today: string): MapStep[] {
  return Array.from({ length: 7 }, (_, day) => {
    const date = dateAfter(today, day);
    return [
      { key: `${date}:day`, date, day, label: "ทั้งวัน · 00:00–24:00 · 24 ชั่วโมง", window: null, cadence: "day" as const },
      ...Array.from({ length: 8 }, (_, window) => ({ key: `${date}:w${window}`, date, day, window,
        startHour: window * 3, endHour: window * 3 + 3, cadence: "window" as const,
        label: `${String(window * 3).padStart(2, "0")}:00–${String(window * 3 + 3).padStart(2, "0")}:00 · 3 ชั่วโมง` })),
      ...Array.from({ length: 24 }, (_, hour) => ({ key: `${date}:h${String(hour).padStart(2, "0")}`, date, day,
        window: hour, startHour: hour, endHour: hour + 1, cadence: "hour" as const,
        label: `${String(hour).padStart(2, "0")}:00–${String(hour + 1).padStart(2, "0")}:00 · 1 ชั่วโมง` })),
    ];
  }).flat();
}
function valid(value: unknown, probability = false): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && (!probability || value <= 100) ? value : null;
}

/** Each requested location has its own response. Grid centers are provenance, never relocation targets. */
export function directRainPoint(place: MapPlace, raw: RawPoint | undefined, steps: MapStep[]): MapPoint {
  const base: MapPoint = { id: `place-${place.id}`, label: placeLabel(place), area: placeArea(place), place,
    lat: place.lat, lng: place.lng, method: "provider", values: steps.map(() => null), secondary: steps.map(() => null) };
  if (!raw || raw.utc_offset_seconds !== 25200 || !Number.isFinite(raw.latitude) || !Number.isFinite(raw.longitude) || Math.abs(raw.latitude!) > 90 || Math.abs(raw.longitude!) > 180) return base;
  base.forecastGrid = { lat: raw.latitude!, lng: raw.longitude! };
  base.source = "Open-Meteo Best Match";
  const hourlyIndex = new Map((Array.isArray(raw.hourly?.time) ? raw.hourly.time : []).map((time, index) => [time, index]));
  const amount = (date: string, startHour: number) => {
    // Open-Meteo timestamps mark the END of the preceding accumulation hour.
    const i = hourlyIndex.get(wallTime(date, startHour + 1));
    return i === undefined || raw.hourly_units?.precipitation !== "mm" ? null : valid(raw.hourly?.precipitation?.[i]);
  };
  const chance = (date: string, startHour: number) => {
    const i = hourlyIndex.get(wallTime(date, startHour + 1));
    return i === undefined || raw.hourly_units?.precipitation_probability !== "%" ? null : valid(raw.hourly?.precipitation_probability?.[i], true);
  };
  for (const [index, step] of steps.entries()) {
    {
      // All displayed periods share the same hourly endpoints. Daily source aggregates can use different hour bins.
      const start = step.window === null ? 0 : step.startHour!;
      const end = step.window === null ? 24 : step.endHour!;
      const hours = Array.from({ length: end - start }, (_, i) => start + i);
      const amounts = hours.map((h) => amount(step.date, h));
      const probabilities = hours.map((h) => chance(step.date, h));
      base.secondary[index] = amounts.every((v) => v !== null) ? Number(amounts.reduce((sum, v) => sum + v!, 0).toFixed(3)) : null;
      // This is the maximum SINGLE-HOUR probability, not a derived event probability for the window.
      base.values[index] = probabilities.every((v) => v !== null) ? Math.max(...probabilities as number[]) : null;
    }
  }
  return base;
}

export function matchRainResponses(payload: unknown, count: number): (RawPoint | undefined)[] {
  const rows = Array.isArray(payload) ? payload : count === 1 && payload && typeof payload === "object" ? [payload] : [];
  const matched: (RawPoint | undefined)[] = Array(count).fill(undefined);
  const duplicates = new Set<number>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    // The API omits the zero location_id; explicit ids on other rows still identify their request slots.
    const id = row.location_id ?? 0;
    if (!Number.isInteger(id) || id < 0 || id >= count) continue;
    if (matched[id]) { duplicates.add(id); continue; }
    matched[id] = row;
  }
  for (const id of duplicates) matched[id] = undefined;
  return matched;
}
export function rainPlaceUrl(places: MapPlace[], today: string) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  const params = { latitude: places.map((p) => p.lat).join(","), longitude: places.map((p) => p.lng).join(","),
    hourly: "precipitation,precipitation_probability",
    timezone: "Asia/Bangkok", cell_selection: "nearest", start_date: today, end_date: dateAfter(today, 7) };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
async function edgeCache(): Promise<Cache | undefined> {
  try { return (globalThis.caches as CacheStorage & { default?: Cache })?.default; } catch { return undefined; }
}
async function batchSnapshot(places: MapPlace[], today: string, fetcher: typeof fetch, useCache: boolean): Promise<Snapshot> {
  const url = rainPlaceUrl(places, today);
  const saved = useCache ? memory.get(url) : undefined;
  if (saved && saved.expires > Date.now()) return saved.snapshot;
  if (useCache && pending.has(url)) return pending.get(url)!;
  const load = async () => {
    const cache = useCache ? await edgeCache() : undefined;
    const cacheUrl = new URL(url); cacheUrl.searchParams.set("bkk-rain-cache-version", "2");
    const key = new Request(cacheUrl);
    if (cache) { try { const hit = await cache.match(key); if (hit) return await hit.json() as Snapshot; } catch { /* Optional cache. */ } }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    let rows: RawPoint[] | null = null;
    try {
      const response = await fetcher(url, { signal: controller.signal });
      if (response.ok) { const payload: unknown = await response.json(); rows = Array.isArray(payload) ? payload : places.length === 1 ? [payload as RawPoint] : null; }
    } catch { /* Missing upstream data must remain missing. No neighboring value or retry burst. */ }
    finally { clearTimeout(timer); }
    const steps = rainPlaceSteps(today);
    const complete = matchRainResponses(rows, places.length).every((raw, i) => {
      const point = directRainPoint(places[i], raw, steps);
      return point.secondary.every((value) => value !== null) && point.values.every((value) => value !== null);
    });
    const ttl = complete ? RAIN_PLACE_CACHE_SECONDS : 600;
    const snapshot = { at: new Date().toISOString(), rows, ttl };
    if (cache) { try { await cache.put(key, new Response(JSON.stringify(snapshot), { headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${ttl}` } })); } catch { /* Optional cache. */ } }
    return snapshot;
  };
  const promise = load();
  if (useCache) pending.set(url, promise);
  try {
    const snapshot = await promise;
    if (useCache) {
      memory.set(url, { snapshot, expires: Date.now() + snapshot.ttl * 1000 });
      // Keep only the current forecast date; discard old URLs across midnight.
      for (const key of memory.keys()) if (new URL(key).searchParams.get("start_date") !== today) memory.delete(key);
    }
    return snapshot;
  } finally { if (useCache) pending.delete(url); }
}

/** Stable catalog batches share caches across province filters; four requests at a time. */
export async function fetchRainPlaces(catalog: MapPlace[], requested: MapPlace[], options: { fetcher?: typeof fetch; now?: Date; cache?: boolean } = {}): Promise<MapDataset> {
  const today = bangkokDate(options.now);
  const steps = rainPlaceSteps(today);
  const wanted = new Set(requested.map((p) => p.id));
  const batches = Array.from({ length: Math.ceil(catalog.length / RAIN_PLACE_BATCH_SIZE) }, (_, i) => catalog.slice(i * RAIN_PLACE_BATCH_SIZE, (i + 1) * RAIN_PLACE_BATCH_SIZE))
    .filter((batch) => batch.some((p) => wanted.has(p.id)));
  const points = new Map<string, MapPoint>();
  const timestamps: string[] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, batches.length) }, async () => {
    while (cursor < batches.length) {
      const batch = batches[cursor++];
      const snapshot = await batchSnapshot(batch, today, options.fetcher ?? fetch, options.cache !== false);
      const rows = matchRainResponses(snapshot.rows, batch.length);
      timestamps.push(snapshot.at);
      for (const [i, place] of batch.entries()) if (wanted.has(place.id)) points.set(place.id, directRainPoint(place, rows[i], steps));
    }
  }));
  const ordered = requested.map((p) => points.get(p.id) ?? directRainPoint(p, undefined, steps));
  const available = ordered.filter((p) => p.secondary.some((v) => v !== null)).length;
  const complete = ordered.every((p) => p.secondary.every((v) => v !== null) && p.values.every((v) => v !== null));
  const timestamp = timestamps.sort()[0] ?? new Date().toISOString();
  return { layer: "rain", valueMethod: "provider", status: available === 0 ? "unavailable" : complete ? "live" : "degraded",
    timestamp, timestampLabel: "รับข้อมูลต้นทาง",
    model: "Open-Meteo Best Match", sources: ["Open-Meteo"],
    notes: ["ขอข้อมูลตามพิกัดสถานที่โดยตรง ไม่มีการคำนวณ IDW ในแอป", "พยากรณ์จากกริดแบบจำลอง ไม่ใช่ค่าตรวจวัดบนถนน หลายสถานที่อาจใช้กริดเดียวกัน", "ปริมาณฝนเป็นผลรวมค่าพยากรณ์รายชั่วโมงของจุดเดียวกันตามช่วงที่เลือก ทั้งวันรวม 00:00–24:00 เวลาไทย", "โอกาสฝนเป็นข้อมูลแยกกันและไม่ได้ใช้คำนวณปริมาณฝน ช่วงหลายชั่วโมง/ทั้งวันแสดงค่าสูงสุดรายชั่วโมง"],
    steps, points: ordered, quality: { provider: "Open-Meteo Best Match", sourceMode: "direct-location-forecast", availablePoints: available,
      totalPoints: requested.length, uniqueGrids: new Set(ordered.filter((p) => p.forecastGrid).map((p) => `${p.forecastGrid!.lat},${p.forecastGrid!.lng}`)).size,
      refreshIntervalMinutes: RAIN_PLACE_CACHE_SECONDS / 60, confidenceLabel: "พยากรณ์จากกริดต้นทาง" } };
}
