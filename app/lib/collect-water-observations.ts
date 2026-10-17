import { normalizeHydroWaterLevels, WATER_SOURCE_API } from "./water-levels.ts";
import { canonicalWaterStations } from "./hydro/station-registry.ts";
import { normalizeUpstream } from "./chao-phraya-upstream.ts";
import type { WaterHistoryStore } from "./water-history-store.ts";
import { fetchWithTimeout } from "./fetch-with-timeout.ts";

export async function collectWaterObservations(store: WaterHistoryStore, fetchImpl: typeof fetch = fetch, now = Date.now()) {
  const wallStarted = Date.now();
  const run = { runId: crypto.randomUUID(), sourceId: "water" as const, startedAt: new Date(now).toISOString(), endedAt: new Date(now).toISOString(), status: "failed" as "success" | "failed", accepted: 0, rejected: 0, latestObservedAt: null as string | null, error: null as string | null };
  try {
  const response = await fetchWithTimeout(fetchImpl, WATER_SOURCE_API, { headers: { Accept: "application/json" } }, 10000);
  if (!response.ok) throw new Error("water source unavailable");
  const raw = await response.json();
  const payload = normalizeHydroWaterLevels(raw, now);
  const upstream = normalizeUpstream({ water: raw }, now);
  const stations = canonicalWaterStations([...payload.stations, ...upstream.basins.flatMap(basin => basin.water)]);
  const accepted = stations.filter(station => station.value !== null && Number.isFinite(station.value) && station.observedAt && Number.isFinite(Date.parse(station.observedAt)) && Date.parse(station.observedAt) <= now + 300000 && now - Date.parse(station.observedAt) <= 86400000);
  run.accepted = accepted.length;
  run.rejected = stations.length - accepted.length;
  run.latestObservedAt = accepted.map(station => new Date(station.observedAt!).toISOString()).sort().at(-1) ?? null;
  if (!accepted.length) throw new Error("no valid water observations");
  await store.record(stations, now);
  run.status = "success";
  return { stations: stations.filter(station => station.value !== null).length, fetchedAt: payload.fetchedAt };
  } catch (error) {
    run.error = error instanceof Error && error.message === "no valid water observations" ? error.message : "water collection failed";
    throw error;
  } finally {
    run.endedAt = new Date(now + Math.max(0, Date.now() - wallStarted)).toISOString();
    await store.saveRun?.(run);
  }
}
