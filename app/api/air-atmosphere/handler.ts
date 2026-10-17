import { normalizeAtmosphere, type AtmospherePayload } from "../../lib/air-atmosphere.ts";
import { CHAO_PHRAYA_REGION_ID, DEFAULT_REGION_ID, getProvince, isCombinedRegion, provinces, regionContains } from "../../lib/provinces.ts";
import { fetchWithTimeout } from "../../lib/fetch-with-timeout.ts";
import { addDays, bangkokDateKey } from "../../lib/forecast/timestamps.ts";

const cache = new Map<string, { at: number; payload: AtmospherePayload }>();
const pending = new Map<string, Promise<AtmospherePayload>>();
export function atmosphereCacheTtl(now: number) {
  const midnight = Date.parse(`${addDays(bangkokDateKey(now), 1)}T00:00:00+07:00`);
  return Math.max(1, Math.min(900, Math.floor((midnight - now) / 1000)));
}
export function atmosphereRequest(url: URL) {
  const region = url.searchParams.get("province") ?? DEFAULT_REGION_ID;
  if (!isCombinedRegion(region) && !provinces.some(p => p.id === region)) return null;
  const hasLat = url.searchParams.has("lat"), hasLng = url.searchParams.has("lng");
  if (hasLat !== hasLng) return null;
  const center = getProvince(region).center;
  let lat = center.lat as number, lng = center.lng as number;
  if (hasLat) {
    if (!url.searchParams.get("lat")?.trim() || !url.searchParams.get("lng")?.trim()) return null;
    lat = Number(url.searchParams.get("lat")); lng = Number(url.searchParams.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !regionContains(CHAO_PHRAYA_REGION_ID, lat, lng)) return null;
  }
  // Weather is a regional model grid, not a street sensor. Canonical 0.02° references bound duplicate requests.
  const point = { lat: Math.round(lat * 50) / 50, lng: Math.round(lng * 50) / 50 };
  return { point, key: `${point.lat},${point.lng}`, personal: hasLat, region };
}
export function buildAtmosphereUrl(point: { lat: number; lng: number }) {
  const url = new URL("https://api.open-meteo.com/v1/gfs");
  url.search = new URLSearchParams({ latitude: String(point.lat), longitude: String(point.lng), hourly: "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,pressure_msl,boundary_layer_height", timezone: "Asia/Bangkok", wind_speed_unit: "kmh", past_days: "2", forecast_days: "9" }).toString();
  return url.toString();
}
export async function createAtmosphereResponse(request: Request, options: { fetchImpl?: typeof fetch; now?: () => number; timeoutMs?: number } = {}) {
  const context = atmosphereRequest(new URL(request.url));
  if (!context) return Response.json({ error: "พิกัดหรือจังหวัดไม่อยู่ในพื้นที่บริการ" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const now = options.now?.() ?? Date.now();
  const fetchImpl = options.fetchImpl ?? fetch;
  const useCache = !options.fetchImpl;
  const cacheKey = `${bangkokDateKey(now)}:${context.key}`;
  const saved = useCache ? cache.get(cacheKey) : undefined;
  let payload: AtmospherePayload;
  if (saved && now - saved.at < 900000 && now >= saved.at) payload = saved.payload;
  else {
    let task = useCache ? pending.get(cacheKey) : undefined;
    if (!task) {
      task = (async () => {
        try {
          const response = await fetchWithTimeout(fetchImpl, buildAtmosphereUrl(context.point), { headers: { Accept: "application/json" } }, options.timeoutMs ?? 12000);
          if (!response.ok) throw new Error("weather unavailable");
          return normalizeAtmosphere(await response.json(), context.point, now);
        } catch { return normalizeAtmosphere(null, context.point, now); }
      })();
      if (useCache) pending.set(cacheKey, task);
    }
    payload = await task;
    if (useCache) {
      pending.delete(cacheKey);
      if (payload.status !== "unavailable") {
        if (cache.size >= 96) cache.delete(cache.keys().next().value!);
        cache.set(cacheKey, { at: now, payload });
      }
    }
  }
  // Precise query coordinates are not echoed or written to persistent storage.
  const ttl = atmosphereCacheTtl(now);
  return Response.json(payload, { headers: payload.status === "unavailable" ? { "Cache-Control": "no-store" } : { "Cache-Control": `public, max-age=${Math.min(60, ttl)}`, "CDN-Cache-Control": `public, max-age=${ttl}` } });
}
export async function GET(request: Request) { return createAtmosphereResponse(request); }
