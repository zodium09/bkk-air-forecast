import { normalizeWaterLevels, WATER_SOURCE_API } from "../../lib/water-levels.ts";
import { getWaterHistoryStore, type WaterHistoryStore } from "../../lib/water-history-store.ts";

export async function createWaterLevelsResponse(options: { fetchImpl?: typeof fetch; now?: () => number; timeoutMs?: number; store?: WaterHistoryStore | null } = {}) {
  const now = options.now?.() ?? Date.now();
  try {
    const response = await (options.fetchImpl ?? fetch)(WATER_SOURCE_API, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(options.timeoutMs ?? 10000) });
    if (!response.ok) throw new Error("water source unavailable");
    const payload = normalizeWaterLevels(await response.json(), now);
    let historyStorage = "unavailable";
    try { if (options.store) { await options.store.record(payload.stations, now); historyStorage = options.store.kind; } } catch { /* Archive failures never hide current readings. */ }
    return Response.json({ ...payload, historyStorage }, { headers: payload.stations.some((station) => station.value !== null) ? { "Cache-Control": "public, max-age=60", "CDN-Cache-Control": "public, max-age=300" } : { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(normalizeWaterLevels(null, now), { headers: { "Cache-Control": "no-store" } });
  }
}
export async function GET() { return createWaterLevelsResponse({ store: getWaterHistoryStore() }); }
