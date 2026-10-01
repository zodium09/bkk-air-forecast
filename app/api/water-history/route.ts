import { getWaterHistoryStore, type WaterHistoryStore, type WaterHistoryPayload } from "../../lib/water-history-store.ts";

export async function createWaterHistoryResponse(request: Request, store: WaterHistoryStore | null, now = Date.now()) {
  const query = new URL(request.url).searchParams;
  const stationId = query.get("station") ?? "";
  if (!/^[a-zA-Z0-9_-]{1,96}$/.test(stationId)) return Response.json({ error: "invalid station" }, { status: 400 });
  const datum = query.get("datum") === "gauge" ? "gauge" : "msl";
  const hours = query.get("hours") === "72" ? 72 : 24;
  const payload: WaterHistoryPayload = { stationId, datum, hours, points: [], storage: "unavailable", fetchedAt: new Date(now).toISOString() };
  try {
    if (store) { payload.points = await store.read(stationId, datum, now - hours * 3600000, now); payload.storage = store.kind; }
  } catch { /* Current water observations remain available even when the archive is down. */ }
  return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
}
export async function GET(request: Request) { return createWaterHistoryResponse(request, getWaterHistoryStore()); }
