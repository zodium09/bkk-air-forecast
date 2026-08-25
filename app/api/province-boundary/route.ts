import { METRO_REGION_ID, getProvince, provinces } from "../../lib/provinces.ts";

const PROVINCE_LAYER = "https://gisportal.dmr.go.th/arcgis/rest/services/Data_Production/WAB_VIEW/MapServer/8/query";
const DISTRICT_GEOJSON_URL =
  "https://bmagis.bangkok.go.th/arcgis/rest/services/BMA/DISTRICT/MapServer/0/query" +
  "?where=1%3D1&outFields=OBJECTID%2CNAME_T%2CNAME_E&returnGeometry=true" +
  "&outSR=4326&geometryPrecision=5&maxAllowableOffset=0.0005&f=geojson";

export const maxDuration = 30;
const BOUNDARY_REVALIDATE_SECONDS = 60 * 60 * 24 * 7;
const BOUNDARY_TIMEOUT_MS = 20_000;

function buildProvinceBoundaryUrl(where: string) {
  const url = new URL(PROVINCE_LAYER);
  url.searchParams.set("where", where);
  url.searchParams.set("outFields", "PROV_CODE,PROV_NAM_T,PROV_NAM_E");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("geometryPrecision", "5");
  url.searchParams.set("f", "geojson");
  return url;
}

async function fetchBoundary(url: URL | string) {
  const response = await fetch(url, {
    headers: { Accept: "application/geo+json, application/json" },
    signal: AbortSignal.timeout(BOUNDARY_TIMEOUT_MS),
    next: { revalidate: BOUNDARY_REVALIDATE_SECONDS },
  });
  if (!response.ok) throw new Error(`boundary returned ${response.status}`);
  const boundary = await response.json();
  if (boundary?.type !== "FeatureCollection" || !Array.isArray(boundary.features) || boundary.features.length === 0) {
    throw new Error("invalid boundary response");
  }
  return boundary as { type: "FeatureCollection"; features: unknown[] };
}

export async function GET(request: Request) {
  const provinceId = new URL(request.url).searchParams.get("province");
  try {
    if (provinceId === METRO_REGION_ID) {
      const surroundingCodes = provinces.filter((province) => province.id !== "bangkok").map((province) => `'${province.code}'`).join(",");
      const [bangkok, surrounding] = await Promise.all([
        fetchBoundary(DISTRICT_GEOJSON_URL),
        fetchBoundary(buildProvinceBoundaryUrl(`PROV_CODE IN (${surroundingCodes})`)),
      ]);
      return Response.json({ type: "FeatureCollection", features: [...bangkok.features, ...surrounding.features] }, {
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=604800",
          "CDN-Cache-Control": "public, max-age=604800, stale-while-revalidate=604800",
          "X-Boundary-Source": "BMA districts + DMR metropolitan provinces",
          "X-Province": METRO_REGION_ID,
        },
      });
    }

    const province = getProvince(provinceId);
    const boundary = await fetchBoundary(buildProvinceBoundaryUrl(`PROV_CODE='${province.code}'`));
    return Response.json(boundary, {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=604800",
        "CDN-Cache-Control": "public, max-age=604800, stale-while-revalidate=604800",
        "X-Boundary-Source": "DMR province boundary MapServer/8",
        "X-Province": province.id,
      },
    });
  } catch {
    const province = provinceId === METRO_REGION_ID ? null : getProvince(provinceId);
    return Response.json({ error: `${province?.nameEn ?? "Metropolitan"} boundary is temporarily unavailable` }, {
      status: 502,
      headers: { "Cache-Control": "no-store", "X-Province": province?.id ?? METRO_REGION_ID },
    });
  }
}
