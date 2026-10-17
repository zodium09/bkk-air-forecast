import type { WaterHistoryStore } from "./water-history-store.ts";

/** Archive inspection only: never contacts upstream or triggers collection. */
export async function createIngestionHealthResponse(store: WaterHistoryStore | null, now = Date.now()) {
  const headers = { "Cache-Control": "no-store" };
  if (!store?.readRuns) return Response.json({ storage: "unavailable", status: "unavailable", runs: [] }, { headers, status: 503 });
  try {
    const runs = await store.readRuns();
    const latest = runs[0] ?? null;
    const lastSuccess = runs.find(run => run.status === "success") ?? null;
    const ageMs = latest ? now - Date.parse(latest.endedAt) : null;
    return Response.json({ storage: store.kind, sourceId: "water", status: !latest ? "unknown" : latest.status === "failed" ? "failed" : ageMs !== null && (ageMs < -300000 || ageMs > 15 * 60000) ? "stale" : "available", lastSuccessAt: lastSuccess?.endedAt ?? null, latestObservedAt: lastSuccess?.latestObservedAt ?? null, observationLagMs: lastSuccess?.latestObservedAt ? now - Date.parse(lastSuccess.latestObservedAt) : null, runs }, { headers });
  } catch {
    return Response.json({ storage: store.kind, status: "unavailable", runs: [] }, { headers, status: 503 });
  }
}
