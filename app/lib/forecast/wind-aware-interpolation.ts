import { spatialIdw, type SpatialAnchor } from "./interpolation.ts";

export type WindField = {
  speedKmh: number | null;
  directionDeg: number | null;
};

export type ResidualSample = {
  lat: number;
  lng: number;
  residual: number;
  ageHours: number;
};

export type WindAwareEstimate = {
  value: number;
  background: number;
  correction: number;
  usedSamples: number;
  influenceDistanceKm: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function localVectorKm(targetLat: number, targetLng: number, sourceLat: number, sourceLng: number) {
  const meanLatitude = ((targetLat + sourceLat) / 2) * Math.PI / 180;
  return {
    east: (sourceLng - targetLng) * Math.cos(meanLatitude) * 111.32,
    north: (sourceLat - targetLat) * 110.57,
  };
}

export function windAwareResidual(
  targetLat: number,
  targetLng: number,
  samples: ResidualSample[],
  wind: WindField,
  leadHours: number,
) {
  const speedKmh = typeof wind.speedKmh === "number" && Number.isFinite(wind.speedKmh) ? Math.max(0, wind.speedKmh) : 0;
  const directionDeg = typeof wind.directionDeg === "number" && Number.isFinite(wind.directionDeg)
    ? ((wind.directionDeg % 360) + 360) % 360
    : null;
  const calmOrUnknown = speedKmh < 3.6 || directionDeg === null;
  const influenceDistanceKm = calmOrUnknown ? 50 : clamp(speedKmh * 8, 60, 180);
  const directionRad = (directionDeg ?? 0) * Math.PI / 180;
  // Meteorological direction is where the wind comes from. This vector points
  // from the target toward the upwind source sector.
  const upwindEast = Math.sin(directionRad);
  const upwindNorth = Math.cos(directionRad);

  const candidates = samples.flatMap((sample) => {
    if (![sample.lat, sample.lng, sample.residual, sample.ageHours].every(Number.isFinite)) return [];
    const vector = localVectorKm(targetLat, targetLng, sample.lat, sample.lng);
    const distance = Math.hypot(vector.east, vector.north);
    if (distance > influenceDistanceKm) return [];
    if (distance < 0.12) {
      return [{ sample, distance: 0.12, directionalFactor: 1 }];
    }
    if (calmOrUnknown) return [{ sample, distance, directionalFactor: 1 }];
    const along = vector.east * upwindEast + vector.north * upwindNorth;
    const cross = Math.abs(vector.east * upwindNorth - vector.north * upwindEast);
    const effectiveDistance = along >= 0
      ? Math.hypot(along / 1.8, cross * 1.8)
      : Math.hypot(Math.abs(along) * 2.5, cross * 1.8);
    return [{ sample, distance: Math.max(0.12, effectiveDistance), directionalFactor: along >= 0 ? 1 : 0.15 }];
  }).sort((a, b) => a.distance - b.distance).slice(0, 12);

  if (!candidates.length) return { correction: 0, usedSamples: 0, influenceDistanceKm };
  let weighted = 0;
  let weightSum = 0;
  for (const candidate of candidates) {
    const temporalDecay = Math.exp(-(Math.max(0, candidate.sample.ageHours) + Math.max(0, leadHours)) / 48);
    const weight = candidate.directionalFactor * temporalDecay / Math.pow(candidate.distance, 2);
    weighted += clamp(candidate.sample.residual, -60, 60) * weight;
    weightSum += weight;
  }
  return {
    correction: weightSum ? clamp(weighted / weightSum, -60, 60) : 0,
    usedSamples: candidates.length,
    influenceDistanceKm,
  };
}

export function estimateWindAwarePm25(input: {
  lat: number;
  lng: number;
  backgroundAnchors: SpatialAnchor[];
  residualSamples: ResidualSample[];
  wind: WindField;
  leadHours: number;
}): WindAwareEstimate | null {
  const background = spatialIdw(input.lat, input.lng, input.backgroundAnchors, {
    maxDistanceKm: 120,
    maxNeighbors: 8,
    minNeighbors: 1,
  });
  if (background === null) return null;
  const residual = windAwareResidual(input.lat, input.lng, input.residualSamples, input.wind, input.leadHours);
  return {
    value: Math.round(clamp(background + residual.correction, 0, 500) * 10) / 10,
    background,
    correction: residual.correction,
    usedSamples: residual.usedSamples,
    influenceDistanceKm: residual.influenceDistanceKm,
  };
}
