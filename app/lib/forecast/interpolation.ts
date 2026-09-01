export type SpatialAnchor = { lat: number; lng: number; value: number };

export type SpatialIdwOptions = {
  maxDistanceKm?: number;
  maxNeighbors?: number;
  minNeighbors?: number;
  power?: number;
  smoothingKm?: number;
};

function distanceKm(lat: number, lng: number, anchor: SpatialAnchor) {
  const meanLatitude = ((lat + anchor.lat) / 2) * Math.PI / 180;
  const dx = (lng - anchor.lng) * Math.cos(meanLatitude) * 111.32;
  const dy = (lat - anchor.lat) * 110.57;
  return Math.hypot(dx, dy);
}

export function spatialIdw(
  lat: number,
  lng: number,
  anchors: SpatialAnchor[],
  options: SpatialIdwOptions = {},
): number | null {
  if (!anchors.length) return null;
  const maxDistanceKm = options.maxDistanceKm ?? Number.POSITIVE_INFINITY;
  const maxNeighbors = options.maxNeighbors ?? Number.POSITIVE_INFINITY;
  const minNeighbors = options.minNeighbors ?? 1;
  const power = options.power ?? 2;
  const smoothingKm = Math.max(0, options.smoothingKm ?? 0);
  const candidates = anchors
    .filter((anchor) => [anchor.lat, anchor.lng, anchor.value].every(Number.isFinite))
    .map((anchor) => ({ anchor, distance: distanceKm(lat, lng, anchor) }))
    .filter(({ distance }) => distance <= maxDistanceKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxNeighbors);
  if (smoothingKm === 0 && candidates[0]?.distance < 0.12) return candidates[0].anchor.value;
  if (candidates.length < minNeighbors) return null;

  let weighted = 0;
  let weightSum = 0;
  for (const { anchor, distance } of candidates) {
    const effectiveDistance = Math.hypot(Math.max(distance, 0.12), smoothingKm);
    const weight = 1 / Math.pow(effectiveDistance, power);
    weighted += anchor.value * weight;
    weightSum += weight;
  }
  return weightSum ? weighted / weightSum : null;
}
