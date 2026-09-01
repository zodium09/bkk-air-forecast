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

type ProvinceSamplePoint = Omit<ProvincePoint, "id">;

// Nine centroidal samples per province, generated inside the verified BMA/DMR
// boundaries. The irregular spacing follows each province's actual shape and
// avoids the visible rows and bullseyes produced by the former buffered 3x3 box.
const provinceSamplePoints: Record<ProvinceId, ProvinceSamplePoint[]> = {
  bangkok: [
    { label: "ตอนเหนือ", lat: 13.8834, lng: 100.6163 },
    { label: "ตะวันออกเฉียงเหนือ", lat: 13.8795, lng: 100.8596 },
    { label: "เหนือฝั่งตะวันออก", lat: 13.8527, lng: 100.7334 },
    { label: "ตอนกลาง", lat: 13.7797, lng: 100.5543 },
    { label: "ฝั่งตะวันออก", lat: 13.7644, lng: 100.8240 },
    { label: "ฝั่งตะวันตก", lat: 13.7414, lng: 100.3864 },
    { label: "ตอนกลางฝั่งตะวันออก", lat: 13.7260, lng: 100.6612 },
    { label: "ตอนใต้", lat: 13.6915, lng: 100.4840 },
    { label: "ใต้ฝั่งตะวันตก", lat: 13.5994, lng: 100.4230 },
  ],
  nonthaburi: [
    { label: "ตอนเหนือ", lat: 14.0891, lng: 100.3068 },
    { label: "ตะวันตกเฉียงเหนือ", lat: 14.0041, lng: 100.3098 },
    { label: "ตอนกลาง", lat: 13.9484, lng: 100.3908 },
    { label: "ฝั่งตะวันตก", lat: 13.9191, lng: 100.3170 },
    { label: "ตอนกลางฝั่งตะวันออก", lat: 13.9191, lng: 100.4545 },
    { label: "ฝั่งตะวันออก", lat: 13.9074, lng: 100.5258 },
    { label: "ตะวันตกเฉียงใต้", lat: 13.8488, lng: 100.3475 },
    { label: "ตอนใต้", lat: 13.8488, lng: 100.4137 },
    { label: "ตะวันออกเฉียงใต้", lat: 13.8371, lng: 100.4850 },
  ],
  "pathum-thani": [
    { label: "ตะวันออกเฉียงเหนือ", lat: 14.2053, lng: 100.8717 },
    { label: "ตอนเหนือ", lat: 14.1515, lng: 100.7580 },
    { label: "ตอนกลาง", lat: 14.0887, lng: 100.6608 },
    { label: "ฝั่งตะวันออก", lat: 14.0887, lng: 100.8468 },
    { label: "ตอนกลางฝั่งตะวันตก", lat: 14.0768, lng: 100.5317 },
    { label: "ฝั่งตะวันตก", lat: 14.0499, lng: 100.4068 },
    { label: "ตะวันตกเฉียงใต้", lat: 13.9901, lng: 100.5514 },
    { label: "ตะวันออกเฉียงใต้", lat: 13.9901, lng: 100.8458 },
    { label: "ตอนใต้", lat: 13.9811, lng: 100.7125 },
  ],
  "samut-prakan": [
    { label: "ตะวันออกเฉียงเหนือ", lat: 13.6716, lng: 100.7964 },
    { label: "ตอนเหนือ", lat: 13.6435, lng: 100.7101 },
    { label: "ตะวันตกเฉียงเหนือ", lat: 13.6415, lng: 100.5685 },
    { label: "ฝั่งตะวันออก", lat: 13.6355, lng: 100.9000 },
    { label: "ตอนกลางฝั่งตะวันออก", lat: 13.5874, lng: 100.8266 },
    { label: "ตอนกลางฝั่งตะวันตก", lat: 13.5733, lng: 100.6159 },
    { label: "ตอนกลาง", lat: 13.5493, lng: 100.7152 },
    { label: "ฝั่งตะวันตก", lat: 13.5473, lng: 100.5030 },
    { label: "ตอนใต้", lat: 13.5192, lng: 100.8180 },
  ],
  "samut-sakhon": [
    { label: "ตะวันออกเฉียงเหนือ", lat: 13.6640, lng: 100.2904 },
    { label: "ตอนเหนือ", lat: 13.6392, lng: 100.1760 },
    { label: "ตะวันตกเฉียงเหนือ", lat: 13.6093, lng: 100.0844 },
    { label: "ฝั่งตะวันออก", lat: 13.5919, lng: 100.3270 },
    { label: "ตอนกลาง", lat: 13.5746, lng: 100.2316 },
    { label: "ฝั่งตะวันตก", lat: 13.5398, lng: 100.1008 },
    { label: "ตะวันออกเฉียงใต้", lat: 13.5248, lng: 100.3525 },
    { label: "ตอนใต้", lat: 13.5025, lng: 100.2125 },
    { label: "ตะวันตกเฉียงใต้", lat: 13.4727, lng: 100.1145 },
  ],
  "nakhon-pathom": [
    { label: "ตะวันออกเฉียงเหนือ", lat: 14.0971, lng: 100.2060 },
    { label: "ตอนเหนือ", lat: 14.0883, lng: 100.0462 },
    { label: "ตะวันตกเฉียงเหนือ", lat: 14.0219, lng: 99.9160 },
    { label: "ตอนกลาง", lat: 13.9689, lng: 100.0800 },
    { label: "ฝั่งตะวันออก", lat: 13.9424, lng: 100.2225 },
    { label: "ฝั่งตะวันตก", lat: 13.8584, lng: 99.9858 },
    { label: "ตอนกลางฝั่งตะวันออก", lat: 13.8451, lng: 100.1404 },
    { label: "ตะวันออกเฉียงใต้", lat: 13.7655, lng: 100.2527 },
    { label: "ตอนใต้", lat: 13.7346, lng: 100.0851 },
  ],
};

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
  return provinceSamplePoints[province.id].map((point, index) => ({
    ...point,
    id: `${province.id}-sample-${index + 1}`,
  }));
}

type FallbackBoundaryCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: { PROV_CODE: string; PROV_NAM_T: string };
    geometry: { type: "Polygon"; coordinates: Array<Array<[number, number]>> };
  }>;
};

export function buildFallbackBoundary(value: unknown): FallbackBoundaryCollection {
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
