import { buildSurveillanceSnapshot } from "../../../../lib/surveillance";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = buildSurveillanceSnapshot();
  const event = snapshot.events.find((item) => item.id === id);
  if (!event) return Response.json({ error: "surveillance_event_not_found" }, { status: 404 });
  return Response.json({ generatedAt: snapshot.generatedAt, mode: snapshot.mode, event }, { headers: { "Cache-Control": "no-store", "X-Surveillance-Mode": "shadow-synthetic" } });
}
