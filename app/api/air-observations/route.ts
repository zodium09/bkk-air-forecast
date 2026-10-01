import { fetchAirObservations } from "../../lib/air-observations.ts";

export async function GET() {
  const payload = await fetchAirObservations();
  return Response.json(payload, { headers: payload.status === "unavailable" ? { "Cache-Control": "no-store" } : { "Cache-Control": "public, max-age=60", "CDN-Cache-Control": "public, max-age=300" } });
}
