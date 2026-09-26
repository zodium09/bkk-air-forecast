import catalog from "../../data/map-places.json";

// Static public geography: no upstream geocoder or user coordinates are needed.
export function GET() {
  return Response.json(catalog, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
