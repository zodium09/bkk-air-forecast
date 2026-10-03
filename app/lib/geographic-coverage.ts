type Geometry = { type: string; coordinates: unknown };
export type Coverage = { features: { geometry: Geometry }[] };

function inRing(lng: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = ring[i], [px, py] = ring[j];
    const cross = (lng - px) * (y - py) - (lat - py) * (x - px);
    if (Math.abs(cross) < 1e-10 && lng >= Math.min(x, px) && lng <= Math.max(x, px) && lat >= Math.min(y, py) && lat <= Math.max(y, py)) return true;
    if ((y > lat) !== (py > lat) && lng < (px - x) * (lat - y) / (py - y) + x) inside = !inside;
  }
  return inside;
}

/** Coverage includes exterior edges and excludes polygon holes. No rectangle fallback. */
export function coverageContains(coverage: Coverage, lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return coverage.features.some(({ geometry }) => {
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates as number[][][]] : geometry.type === "MultiPolygon" ? geometry.coordinates as number[][][][] : [];
    return polygons.some(rings => rings.length > 0 && inRing(lng, lat, rings[0]) && !rings.slice(1).some(ring => inRing(lng, lat, ring)));
  });
}
