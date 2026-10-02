import { buildSurveillanceSnapshot } from "../../../lib/surveillance";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = buildSurveillanceSnapshot();
  return Response.json({ generatedAt: snapshot.generatedAt, timezone: snapshot.timezone, mode: snapshot.mode, dispatchEnabled: false, persistenceEnabled: false, sources: snapshot.sources }, { headers: { "Cache-Control": "no-store", "X-Surveillance-Mode": "shadow-synthetic" } });
}
