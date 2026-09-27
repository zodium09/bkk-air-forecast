import catalogData from "../../data/map-places.json";
import type { MapPlaceCatalog } from "../../lib/map-places";
import { regionPlaces } from "../../lib/map-places";
import { getRegion } from "../../lib/provinces";
import { fetchRainPlaces, rainPlaceCacheTtl } from "../../lib/rain-place-forecast";

export async function GET(request: Request) {
  const region = getRegion(new URL(request.url).searchParams.get("province") ?? "metro").id;
  const catalog = catalogData as MapPlaceCatalog;
  const data = await fetchRainPlaces(catalog.places, regionPlaces(catalog.places, region));
  const ttl = rainPlaceCacheTtl(new Date(), data.status !== "live", data.steps[0].date);
  return Response.json(data, { headers: {
    "Cache-Control": `public, max-age=${Math.min(60, ttl)}`,
    "CDN-Cache-Control": `public, max-age=${ttl}`,
  } });
}
