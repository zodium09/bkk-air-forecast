import { normalizeWaterLevels, WATER_SOURCE_API } from "./water-levels.ts";
import type { WaterHistoryStore } from "./water-history-store.ts";
import { fetchWithTimeout } from "./fetch-with-timeout.ts";

export async function collectWaterObservations(store: WaterHistoryStore, fetchImpl: typeof fetch = fetch) {
  const response = await fetchWithTimeout(fetchImpl, WATER_SOURCE_API, { headers: { Accept: "application/json" } }, 10000);
  if (!response.ok) throw new Error("water source unavailable");
  const now = Date.now();
  const payload = normalizeWaterLevels(await response.json(), now);
  if (!payload.stations.some(station => station.value !== null)) throw new Error("no valid water observations");
  await store.record(payload.stations, now);
  return { stations: payload.stations.filter(station => station.value !== null).length, fetchedAt: payload.fetchedAt };
}
