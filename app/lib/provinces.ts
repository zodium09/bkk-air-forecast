export const DEFAULT_PROVINCE_ID = "bangkok";
export const METRO_REGION_ID = "metro";
export const DEFAULT_REGION_ID = METRO_REGION_ID;

export const provinces = [
  {
    id: "bangkok",
    code: "10",
    nameTh: "กรุงเทพมหานคร",
    shortNameTh: "กรุงเทพฯ",
    nameEn: "Bangkok",
    center: { lat: 13.7563, lng: 100.5018 },
    bounds: { minLat: 13.60, maxLat: 13.97, minLng: 100.31, maxLng: 100.92 },
  },
  {
    id: "nonthaburi",
    code: "12",
    nameTh: "นนทบุรี",
    shortNameTh: "นนทบุรี",
    nameEn: "Nonthaburi",
    center: { lat: 13.8621, lng: 100.5144 },
    bounds: { minLat: 13.78, maxLat: 14.12, minLng: 100.26, maxLng: 100.58 },
  },
  {
    id: "pathum-thani",
    code: "13",
    nameTh: "ปทุมธานี",
    shortNameTh: "ปทุมธานี",
    nameEn: "Pathum Thani",
    center: { lat: 14.0208, lng: 100.5250 },
    bounds: { minLat: 13.91, maxLat: 14.29, minLng: 100.30, maxLng: 100.95 },
  },
  {
    id: "samut-prakan",
    code: "11",
    nameTh: "สมุทรปราการ",
    shortNameTh: "สมุทรปราการ",
    nameEn: "Samut Prakan",
    center: { lat: 13.5991, lng: 100.5998 },
    bounds: { minLat: 13.43, maxLat: 13.76, minLng: 100.44, maxLng: 100.96 },
  },
  {
    id: "samut-sakhon",
    code: "74",
    nameTh: "สมุทรสาคร",
    shortNameTh: "สมุทรสาคร",
    nameEn: "Samut Sakhon",
    center: { lat: 13.5475, lng: 100.2744 },
    bounds: { minLat: 13.42, maxLat: 13.72, minLng: 100.02, maxLng: 100.42 },
  },
  {
    id: "nakhon-pathom",
    code: "73",
    nameTh: "นครปฐม",
    shortNameTh: "นครปฐม",
    nameEn: "Nakhon Pathom",
    center: { lat: 13.8199, lng: 100.0622 },
    bounds: { minLat: 13.64, maxLat: 14.18, minLng: 99.80, maxLng: 100.34 },
  },
] as const;

export type ProvinceId = (typeof provinces)[number]["id"];
export type Province = (typeof provinces)[number];
export type ProvincePoint = { id: string; label: string; lat: number; lng: number };
export type RegionId = ProvinceId | typeof METRO_REGION_ID;

export const metroRegion = {
  id: METRO_REGION_ID,
  nameTh: "กรุงเทพมหานครและปริมณฑล",
  shortNameTh: "กรุงเทพฯ–ปริมณฑล",
  nameEn: "Bangkok Metropolitan Region",
  bounds: { minLat: 13.42, maxLat: 14.29, minLng: 99.80, maxLng: 100.96 },
} as const;

export function getProvince(value: unknown): Province {
  return provinces.find((province) => province.id === value) ?? provinces[0];
}

export function getRegion(value: unknown) {
  if (value === METRO_REGION_ID) return metroRegion;
  return provinces.find((province) => province.id === value) ?? metroRegion;
}

export function getProvincePoints(value: unknown): ProvincePoint[] {
  const province = getProvince(value);
  const { minLat, maxLat, minLng, maxLng } = province.bounds;
  const latPadding = (maxLat - minLat) * 0.22;
  const lngPadding = (maxLng - minLng) * 0.22;
  const latitudes = [minLat + latPadding, (minLat + maxLat) / 2, maxLat - latPadding];
  const longitudes = [minLng + lngPadding, (minLng + maxLng) / 2, maxLng - lngPadding];
  const labels = [
    "ตะวันตกเฉียงใต้", "ตอนใต้", "ตะวันออกเฉียงใต้",
    "ฝั่งตะวันตก", `ใจกลาง${province.shortNameTh}`, "ฝั่งตะวันออก",
    "ตะวันตกเฉียงเหนือ", "ตอนเหนือ", "ตะวันออกเฉียงเหนือ",
  ];
  return latitudes.flatMap((lat, row) => longitudes.map((lng, column) => ({
    id: `${province.id}-${row}-${column}`,
    label: labels[row * 3 + column],
    lat: Math.round(lat * 10_000) / 10_000,
    lng: Math.round(lng * 10_000) / 10_000,
  })));
}

export function buildFallbackBoundary(value: unknown) {
  if (value === METRO_REGION_ID) {
    return {
      type: "FeatureCollection" as const,
      features: provinces.flatMap((province) => buildFallbackBoundary(province.id).features),
    };
  }
  const province = getProvince(value);
  const { minLat, maxLat, minLng, maxLng } = province.bounds;
  return {
    type: "FeatureCollection" as const,
    features: [{
      type: "Feature" as const,
      properties: { PROV_CODE: province.code, PROV_NAM_T: `${province.nameTh} (ขอบเขตสำรอง)` },
      geometry: {
        type: "Polygon" as const,
        coordinates: [[
          [minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat],
        ]],
      },
    }],
  };
}
