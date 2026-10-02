import { buildSurveillanceSnapshot, type SurveillanceHazard, type SurveillanceSignalKind } from "../../../lib/surveillance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const snapshot = buildSurveillanceSnapshot();
  const params = new URL(request.url).searchParams;
  const area = params.get("area");
  const hazard = params.get("hazard") as SurveillanceHazard | null;
  const signal = params.get("signal") as SurveillanceSignalKind | null;
  const includeHistory = params.get("history") === "true";
  const events = snapshot.events.filter((event) => {
    if (!includeHistory && event.status !== "active") return false;
    if (area && event.area.id !== area) return false;
    if (hazard && event.hazard !== hazard) return false;
    if (signal && event.signalKind !== signal) return false;
    return true;
  });
  return Response.json({ ...snapshot, events }, { headers: { "Cache-Control": "no-store", "X-Surveillance-Mode": "shadow-synthetic" } });
}
