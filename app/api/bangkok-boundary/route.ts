import bangkokBoundarySnapshot from "../../data/bangkok-districts.json";

const DISTRICT_GEOJSON_URL =
  "https://bmagis.bangkok.go.th/arcgis/rest/services/BMA/DISTRICT/MapServer/0/query" +
  "?where=1%3D1&outFields=OBJECTID%2CNAME_T%2CNAME_E&returnGeometry=true" +
  "&outSR=4326&geometryPrecision=5&maxAllowableOffset=0.0005&f=geojson";

export async function GET() {
  try {
    const response = await fetch(DISTRICT_GEOJSON_URL, {
      headers: { Accept: "application/geo+json, application/json" },
    });

    if (!response.ok) {
      throw new Error(`BMA boundary returned ${response.status}`);
    }

    const boundary = await response.json();
    if (boundary?.type !== "FeatureCollection" || !Array.isArray(boundary.features)) {
      throw new Error("Invalid BMA boundary response");
    }

    return Response.json(boundary, {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=604800",
        "CDN-Cache-Control": "public, max-age=604800, stale-while-revalidate=604800",
        "X-Boundary-Source": "BMA GIS DISTRICT MapServer/0",
      },
    });
  } catch {
    return Response.json(bangkokBoundarySnapshot, {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=604800",
        "CDN-Cache-Control": "public, max-age=604800, stale-while-revalidate=604800",
        "X-Boundary-Source": "BMA GIS verified snapshot",
        "X-Boundary-State": "snapshot",
      },
    });
  }
}
