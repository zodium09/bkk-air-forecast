import { normalizeWaterLevels, WATER_SOURCE_API } from "../../lib/water-levels.ts";

export async function createWaterLevelsResponse(options: { fetchImpl?: typeof fetch; now?: () => number; timeoutMs?: number } = {}) {
  const now = options.now?.() ?? Date.now();
  try {
    const response = await (options.fetchImpl ?? fetch)(WATER_SOURCE_API, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(options.timeoutMs ?? 10000) });
    if (!response.ok) throw new Error("water source unavailable");
    const payload = normalizeWaterLevels(await response.json(), now);
    return Response.json(payload, { headers: payload.stations.some((station) => station.value !== null) ? { "Cache-Control": "public, max-age=60", "CDN-Cache-Control": "public, max-age=300" } : { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(normalizeWaterLevels(null, now), { headers: { "Cache-Control": "no-store" } });
  }
}
export async function GET() { return createWaterLevelsResponse(); }
