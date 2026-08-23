import { getProvince } from "../../lib/provinces.ts";

const PROVINCE_LAYER = "https://gisportal.dmr.go.th/arcgis/rest/services/Data_Production/WAB_VIEW/MapServer/8/query";

export async function GET(request: Request) {
  const province = getProvince(new URL(request.url).searchParams.get("province"));
  const url = new URL(PROVINCE_LAYER);
  url.searchParams.set("where", `PROV_CODE='${province.code}'`);
  url.searchParams.set("outFields", "PROV_CODE,PROV_NAM_T,PROV_NAM_E");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("geometryPrecision", "5");
  url.searchParams.set("f", "geojson");

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`province boundary returned ${response.status}`);
    const boundary = await response.json();
    if (boundary?.type !== "FeatureCollection" || !Array.isArray(boundary.features) || boundary.features.length === 0) {
      throw new Error("invalid province boundary response");
    }
    return Response.json(boundary, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        "X-Boundary-Source": "DMR province boundary MapServer/8",
        "X-Province": province.id,
      },
    });
  } catch {
    return Response.json({ error: `${province.nameEn} boundary is temporarily unavailable` }, {
      status: 502,
      headers: { "Cache-Control": "no-store", "X-Province": province.id },
    });
  }
}
