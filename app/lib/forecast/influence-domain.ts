import { METRO_REGION_ID, getRegion, getRegionProvinces, getProvincePoints, type ProvincePoint, type RegionId } from "../provinces.ts";

export const REGIONAL_INFLUENCE_BOUNDS = {
  minLat: 12.65,
  maxLat: 15.25,
  minLng: 99.15,
  maxLng: 101.85,
} as const;

export const REGIONAL_INFLUENCE_AREAS = [
  "กรุงเทพมหานครและปริมณฑล",
  "พระนครศรีอยุธยา",
  "อ่างทอง",
  "สุพรรณบุรี",
  "ราชบุรี",
  "สมุทรสงคราม",
  "เพชรบุรีตอนบน",
  "ลพบุรีตอนล่าง",
  "สระบุรี",
  "นครนายก",
  "ฉะเชิงเทรา",
  "ปราจีนบุรี",
  "ชลบุรีตอนบน",
  "อ่าวไทยตอนบน",
] as const;

export function regionalInfluenceBounds(region: RegionId = METRO_REGION_ID) {
  if (region === METRO_REGION_ID) return REGIONAL_INFLUENCE_BOUNDS;
  const b = getRegion(region).bounds;
  return { minLat: b.minLat - 1.2, maxLat: b.maxLat + 1.2, minLng: b.minLng - 1.2, maxLng: b.maxLng + 1.2 };
}
export function isInsideRegionalInfluenceDomain(lat: number, lng: number, region: RegionId = METRO_REGION_ID) {
  const b = regionalInfluenceBounds(region);
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

/** A 7x7 grid is close to the native ~45 km CAMS Global spacing in this latitude band. */
export function getRegionalCamsPoints(region: RegionId = METRO_REGION_ID): ProvincePoint[] {
  const b = regionalInfluenceBounds(region);
  const rows = region === METRO_REGION_ID ? 7 : Math.ceil((b.maxLat - b.minLat) / .4) + 1;
  const columns = region === METRO_REGION_ID ? 7 : Math.ceil((b.maxLng - b.minLng) / .4) + 1;
  const latStep = (b.maxLat - b.minLat) / (rows - 1);
  const lngStep = (b.maxLng - b.minLng) / (columns - 1);
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => ({
      id: `regional-cams-${row}-${column}`,
      label: `กริดภูมิภาค ${row + 1}-${column + 1}`,
      lat: Math.round((b.minLat + row * latStep) * 10_000) / 10_000,
      lng: Math.round((b.minLng + column * lngStep) * 10_000) / 10_000,
    })),
  ).flat();
}

export function getMetroAnalysisTargets(region: RegionId = METRO_REGION_ID): ProvincePoint[] {
  return getRegionProvinces(region).flatMap((province) => getProvincePoints(province.id).map((point) => ({
    ...point,
    id: `${province.id}-${point.id}`,
    label: `${province.shortNameTh} · ${point.label}`,
  })));
}
