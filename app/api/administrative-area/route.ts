import { NextRequest, NextResponse } from "next/server";

type ArcGisResponse = {
  features?: Array<{ attributes?: Record<string, unknown> }>;
};

export type AdministrativeArea = {
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  label: string;
  source: "BMA" | "DMR";
};

const BMA_SUBDISTRICT = "https://bmagis.bangkok.go.th/arcgis/rest/services/Hosted/FGDS_BMA_SUBDISTRICT_POLYGON/FeatureServer/0/query";
const DMR_TAMBON = "https://gisportal.dmr.go.th/arcgis/rest/services/Data_Production/WAB_VIEW/MapServer/10/query";

function clean(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function formatLabel(area: Pick<AdministrativeArea, "subdistrict" | "district" | "province">) {
  return [area.subdistrict, area.district, area.province].filter(Boolean).join(" · ");
}

async function queryArcGis(url: string, lat: number, lng: number, fields: string) {
  const query = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: fields,
    returnGeometry: "false",
    f: "json",
  });
  const response = await fetch(`${url}?${query}`, {
    headers: { "User-Agent": "BKK-Air-Forecast/1.0" },
    next: { revalidate: 604800 },
    signal: AbortSignal.timeout(4500),
  });
  if (!response.ok) throw new Error("administrative boundary unavailable");
  return response.json() as Promise<ArcGisResponse>;
}

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 13 || lat > 15 || lng < 99.5 || lng > 101.8) {
    return NextResponse.json({ error: "invalid coordinates" }, { status: 400 });
  }

  try {
    // The official BMA layer contains the complete khwaeng–khet hierarchy.
    if (lat >= 13.45 && lat <= 14.05 && lng >= 100.30 && lng <= 100.98) {
      const bma = await queryArcGis(BMA_SUBDISTRICT, lat, lng, "sname,dname,pname");
      const attributes = bma.features?.[0]?.attributes;
      if (attributes) {
        const area = {
          subdistrict: clean(attributes.sname),
          district: clean(attributes.dname),
          province: clean(attributes.pname) ?? "กรุงเทพมหานคร",
        };
        if (area.subdistrict || area.district) {
          return NextResponse.json({ ...area, label: formatLabel(area), source: "BMA" } satisfies AdministrativeArea, {
            headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000" },
          });
        }
      }
    }

    const dmr = await queryArcGis(DMR_TAMBON, lat, lng, "TAM_NAM_T,AMPHOE_T,PROV_NAM_T");
    const attributes = dmr.features?.[0]?.attributes;
    if (!attributes) return NextResponse.json({ error: "area not found" }, { status: 404 });
    const area = {
      subdistrict: clean(attributes.TAM_NAM_T),
      district: clean(attributes.AMPHOE_T),
      province: clean(attributes.PROV_NAM_T),
    };
    return NextResponse.json({ ...area, label: formatLabel(area), source: "DMR" } satisfies AdministrativeArea, {
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000" },
    });
  } catch {
    return NextResponse.json({ error: "administrative lookup unavailable" }, { status: 503 });
  }
}
