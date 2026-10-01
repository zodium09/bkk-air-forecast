import { fetchRoadFloods } from "../../lib/road-floods.ts";

export async function GET() {
  const payload = await fetchRoadFloods();
  return Response.json(payload, { headers: payload.status === "unavailable" ? { "Cache-Control": "no-store" } : { "Cache-Control": "public, max-age=60", "CDN-Cache-Control": "public, max-age=300" } });
}
