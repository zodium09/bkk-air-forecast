import { getProvincePoints, provinces, type ProvincePoint } from "../provinces.ts";

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

export function isInsideRegionalInfluenceDomain(lat: number, lng: number) {
  return lat >= REGIONAL_INFLUENCE_BOUNDS.minLat && lat <= REGIONAL_INFLUENCE_BOUNDS.maxLat &&
    lng >= REGIONAL_INFLUENCE_BOUNDS.minLng && lng <= REGIONAL_INFLUENCE_BOUNDS.maxLng;
}

/** A 7x7 grid is close to the native ~45 km CAMS Global spacing in this latitude band. */
export function getRegionalCamsPoints(): ProvincePoint[] {
  const rows = 7;
  const columns = 7;
  const latStep = (REGIONAL_INFLUENCE_BOUNDS.maxLat - REGIONAL_INFLUENCE_BOUNDS.minLat) / (rows - 1);
  const lngStep = (REGIONAL_INFLUENCE_BOUNDS.maxLng - REGIONAL_INFLUENCE_BOUNDS.minLng) / (columns - 1);
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => ({
      id: `regional-cams-${row}-${column}`,
      label: `กริดภูมิภาค ${row + 1}-${column + 1}`,
      lat: Math.round((REGIONAL_INFLUENCE_BOUNDS.minLat + row * latStep) * 10_000) / 10_000,
      lng: Math.round((REGIONAL_INFLUENCE_BOUNDS.minLng + column * lngStep) * 10_000) / 10_000,
    })),
  ).flat();
}

export function getMetroAnalysisTargets(): ProvincePoint[] {
  return provinces.flatMap((province) => getProvincePoints(province.id).map((point) => ({
    ...point,
    id: `${province.id}-${point.id}`,
    label: `${province.shortNameTh} · ${point.label}`,
  })));
}
