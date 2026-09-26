export type SpatialAnchor = { lat: number; lng: number; value: number };

export type SpatialIdwOptions = {
  maxDistanceKm?: number;
  maxNeighbors?: number;
  minNeighbors?: number;
  power?: number;
  smoothingKm?: number;
};

function distanceKm(lat: number, lng: number, anchor: { lat: number; lng: number }) {
  const meanLatitude = ((lat + anchor.lat) / 2) * Math.PI / 180;
  const dx = (lng - anchor.lng) * Math.cos(meanLatitude) * 111.32;
  const dy = (lat - anchor.lat) * 110.57;
  return Math.hypot(dx, dy);
}

/** Reuse geographic distances across hours while choosing valid neighbors per reading. */
export function prepareSpatialIdw(
  lat: number,
  lng: number,
  anchors: { lat: number; lng: number }[],
  options: SpatialIdwOptions = {},
) {
  const maxDistanceKm = options.maxDistanceKm ?? Number.POSITIVE_INFINITY;
  const maxNeighbors = options.maxNeighbors ?? Number.POSITIVE_INFINITY;
  const minNeighbors = options.minNeighbors ?? 1;
  const power = options.power ?? 2;
  const smoothingKm = Math.max(0, options.smoothingKm ?? 0);
  const neighbors = anchors
    .map((anchor, index) => ({ anchor, index, distance: distanceKm(lat, lng, anchor) }))
    .filter(({ anchor }) => [anchor.lat, anchor.lng].every(Number.isFinite))
    .filter(({ distance }) => distance <= maxDistanceKm)
    .sort((a, b) => a.distance - b.distance)
    .map(({ index, distance }) => ({ index, distance, weight: 1 / Math.pow(Math.hypot(Math.max(distance, 0.12), smoothingKm), power) }));
  return (read: (index: number) => number | null): number | null => {
    let weighted = 0, weightSum = 0, count = 0;
    for (const { index, distance, weight } of neighbors) {
      if (count >= maxNeighbors) break;
      const value = read(index);
      if (value === null || !Number.isFinite(value)) continue;
      if (smoothingKm === 0 && count === 0 && distance < 0.12) return value;
      weighted += value * weight;
      weightSum += weight;
      count++;
    }
    return count >= minNeighbors && weightSum ? weighted / weightSum : null;
  };
}

export function spatialIdw(lat: number, lng: number, anchors: SpatialAnchor[], options: SpatialIdwOptions = {}): number | null {
  return prepareSpatialIdw(lat, lng, anchors, options)((index) => anchors[index].value);
}
