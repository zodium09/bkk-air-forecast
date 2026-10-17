import { normalizeUpstream, UPSTREAM_SOURCES } from "../chao-phraya-upstream.ts";
import { fetchWithTimeout } from "../fetch-with-timeout.ts";
import { normalizeHydroWaterLevels, WATER_SOURCE_API } from "../water-levels.ts";
import type { WaterHistoryStore } from "../water-history-store.ts";
import type { HydroPayload } from "./model.ts";
import { normalizeCentralRain } from "./central-rain.ts";
import { canonicalWaterStations } from "./station-registry.ts";

type Snapshot = { water?: HydroPayload["water"]; centralRain?: HydroPayload["centralRain"]; basins?: { code: string; water?: HydroPayload["upstream"]["basins"][number]["water"]; rain?: HydroPayload["upstream"]["basins"][number]["rain"]; dams?: HydroPayload["upstream"]["basins"][number]["dams"] }[] };
function snapshotBasins(value: unknown): Snapshot["basins"] {
  if (!value || typeof value !== "object") return undefined;
  const basins = (value as Snapshot).basins;
  return Array.isArray(basins) ? basins.filter(basin => basin && typeof basin.code === "string") : undefined;
}

export async function createHydroResponse(options: { fetchImpl?: typeof fetch; now?: number; store?: WaterHistoryStore | null } = {}) {
  const now = options.now ?? Date.now();
  const fetchImpl = options.fetchImpl ?? fetch;
  const urls = { water: WATER_SOURCE_API, rain: UPSTREAM_SOURCES.rain, dams: UPSTREAM_SOURCES.dams };
  const entries = await Promise.all(Object.entries(urls).map(async ([key, url]) => {
    try {
      const response = await fetchWithTimeout(fetchImpl, url, { headers: { Accept: "application/json" } }, 10000);
      return [key, response.ok ? await response.json() : null] as const;
    } catch { return [key, null] as const; }
  }));
  const raw = Object.fromEntries(entries);
  let water = normalizeHydroWaterLevels(raw.water, now);
  const upstream = normalizeUpstream(raw, now);
  let centralRain = normalizeCentralRain(raw.rain, now);
  const live = { water: upstream.upstream.water, rain: upstream.upstream.rain, dams: upstream.upstream.dams };
  const sources: HydroPayload["sources"] = { water: live.water ? "live" : "unavailable", rain: live.rain ? "live" : "unavailable", dams: live.dams ? "live" : "unavailable" };
  const lastKnownAt: HydroPayload["lastKnownAt"] = {};
  for (const source of ["water", "rain", "dams"] as const) {
    if (live[source]) continue;
    try {
      const snapshot = await options.store?.readSnapshot?.(source);
      const stored = snapshot?.payload as Snapshot | undefined;
      const basins = snapshotBasins(stored);
      if (!snapshot || !basins || source === "water" && (!stored?.water || !Array.isArray(stored.water.stations))) continue;
      if (source === "water") water = stored!.water!;
      if (source === "rain" && Array.isArray(stored?.centralRain)) centralRain = stored.centralRain;
      for (const basin of upstream.basins) {
        const matching = basins.find(item => item.code === basin.code);
        if (source === "water" && Array.isArray(matching?.water)) basin.water = matching.water;
        if (source === "rain" && Array.isArray(matching?.rain)) basin.rain = matching.rain;
        if (source === "dams" && Array.isArray(matching?.dams)) basin.dams = matching.dams;
      }
      sources[source] = "last-known";
      lastKnownAt[source] = snapshot.receivedAt;
    } catch { /* A damaged snapshot is treated as unavailable. */ }
  }
  if (Object.values(sources).includes("last-known")) upstream.status = "degraded";
  let historyStorage: HydroPayload["historyStorage"] = "unavailable";
  if (options.store) {
    try {
      if (live.water) {
        const stations = canonicalWaterStations([...water.stations, ...upstream.basins.flatMap(basin => basin.water)]);
        await options.store.record(stations, now);
      }
      historyStorage = options.store.kind;
    } catch { /* Reading current measurements does not depend on archive writes. */ }
    for (const source of ["water", "rain", "dams"] as const) {
      if (!live[source]) continue;
      try {
        const basins = upstream.basins.map(basin => ({ code: basin.code, [source]: basin[source] }));
        await options.store.saveSnapshot?.(source, source === "water" ? { water, basins } : source === "rain" ? { centralRain, basins } : { basins }, new Date(now).toISOString());
      } catch { /* A snapshot failure must not hide current observations. */ }
    }
  }
  const payload: HydroPayload = { fetchedAt: new Date(now).toISOString(), water, upstream, centralRain, historyStorage, sources, lastKnownAt };
  const available = Object.values(sources).some(state => state !== "unavailable");
  return Response.json(payload, { headers: { "Cache-Control": available ? "public, max-age=60" : "no-store", ...(available ? { "CDN-Cache-Control": "public, max-age=300" } : {}) } });
}
