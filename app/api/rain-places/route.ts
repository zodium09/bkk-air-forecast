import { mapPlaceCatalog as catalogData } from "../../lib/map-place-catalog";
import type { MapPlaceCatalog } from "../../lib/map-places";
import { regionPlaces } from "../../lib/map-places";
import { CHAO_PHRAYA_REGION_ID, DEFAULT_REGION_ID, getRegion } from "../../lib/provinces";
import { fetchRainPlaces, rainPlaceCacheTtl } from "../../lib/rain-place-forecast";

export async function GET(request: Request) {
  const region = getRegion(new URL(request.url).searchParams.get("province") ?? DEFAULT_REGION_ID).id;
  const catalog = catalogData as MapPlaceCatalog;
  const placeId = new URL(request.url).searchParams.get("place");
  const inArea = regionPlaces(catalog.places, region);
  const requested = region === CHAO_PHRAYA_REGION_ID ? inArea.filter(p => p.overview || p.id === placeId) : inArea;
  const stableCatalog = [...catalog.places.filter(p => p.overview), ...catalog.places.filter(p => !p.overview)];
  const data = await fetchRainPlaces(stableCatalog, requested);
  if (region === CHAO_PHRAYA_REGION_ID) {
    data.quality.referenceScope = "overview";
    data.notes.unshift("ภาพรวมใช้จุดอ้างอิงหลักรายเขต/อำเภอ เลือกจังหวัดหรือค้นหาพื้นที่เพื่อเพิ่มพยากรณ์ตามจุดนั้น");
  }
  const ttl = rainPlaceCacheTtl(new Date(), data.status !== "live", data.steps[0].date);
  return Response.json(data, { headers: {
    "Cache-Control": `public, max-age=${Math.min(60, ttl)}`,
    "CDN-Cache-Control": `public, max-age=${ttl}`,
  } });
}
