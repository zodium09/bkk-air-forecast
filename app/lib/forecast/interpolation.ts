export type SpatialAnchor = { lat: number; lng: number; value: number };

export function spatialIdw(lat: number, lng: number, anchors: SpatialAnchor[]): number | null {
  if (!anchors.length) return null;
  const longitudeScale = Math.cos((lat * Math.PI) / 180);
  let weighted = 0;
  let weightSum = 0;
  for (const anchor of anchors) {
    if (![anchor.lat, anchor.lng, anchor.value].every(Number.isFinite)) continue;
    const dx = (lng - anchor.lng) * longitudeScale;
    const dy = lat - anchor.lat;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared < 0.000001) return anchor.value;
    const weight = 1 / distanceSquared;
    weighted += anchor.value * weight;
    weightSum += weight;
  }
  return weightSum ? weighted / weightSum : null;
}
