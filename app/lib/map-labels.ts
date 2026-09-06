import { boundaryContains, type MapBoundary } from "./map-surface.ts";

export type GeographicLabel = {
  name: string;
  lat: number;
  lng: number;
  kind: "province" | "district";
  area: number;
};
const labelCache = new WeakMap<MapBoundary, GeographicLabel[]>();

/** Place names come from the verified geographic features, never from model sample names. */
export function boundaryLabels(boundary: MapBoundary): GeographicLabel[] {
  const cached = labelCache.get(boundary);
  if (cached) return cached;
  const labels = boundary.features.flatMap((feature) => {
    const raw = feature.properties.NAME_T ?? feature.properties.PROV_NAM_T;
    if (typeof raw !== "string" || !raw.trim()) return [];
    const kind = feature.properties.NAME_T
      ? ("district" as const)
      : ("province" as const);
    const polygons =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates as number[][][]]
        : feature.geometry.type === "MultiPolygon"
          ? (feature.geometry.coordinates as number[][][][])
          : [];
    const ring = [...polygons].sort(
      (a, b) => Math.abs(ringArea(b[0])) - Math.abs(ringArea(a[0])),
    )[0]?.[0];
    if (!ring?.length) return [];
    const minLat = Math.min(...ring.map((p) => p[1])),
      maxLat = Math.max(...ring.map((p) => p[1])),
      minLng = Math.min(...ring.map((p) => p[0])),
      maxLng = Math.max(...ring.map((p) => p[0]));
    const scope: MapBoundary = {
      type: "FeatureCollection",
      features: [feature],
    };
    const fractions = [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9];
    for (const y of fractions)
      for (const x of fractions) {
        const lat = minLat + (maxLat - minLat) * y,
          lng = minLng + (maxLng - minLng) * x;
        if (boundaryContains(scope, lat, lng))
          return [
            {
              name: raw.replace(/^เขต/, ""),
              lat,
              lng,
              kind,
              area: (maxLat - minLat) * (maxLng - minLng),
            },
          ];
      }
    return [];
  });
  labelCache.set(boundary, labels);
  return labels;
}

function ringArea(ring: number[][] | undefined): number {
  if (!ring) return 0;
  return (
    ring.reduce((sum, p, i) => {
      const next = ring[(i + 1) % ring.length];
      return sum + p[0] * next[1] - next[0] * p[1];
    }, 0) / 2
  );
}
