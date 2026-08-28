import type { ForecastStation } from "../forecast-data.ts";
import { provinces, type ProvinceId } from "../provinces.ts";

type Coordinate = [number, number];
type PolygonCoordinates = Coordinate[][];

export type MapBoundaryCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: {
      type: "Polygon" | "MultiPolygon";
      coordinates: PolygonCoordinates | PolygonCoordinates[];
    };
  }>;
};

function pointOnSegment(point: Coordinate, start: Coordinate, end: Coordinate) {
  const [x, y] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1);
  if (Math.abs(cross) > 1e-10) return false;
  return x >= Math.min(x1, x2) - 1e-10 && x <= Math.max(x1, x2) + 1e-10
    && y >= Math.min(y1, y2) - 1e-10 && y <= Math.max(y1, y2) + 1e-10;
}

function pointInRing(point: Coordinate, ring: Coordinate[]) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const start = ring[previous];
    const end = ring[index];
    if (pointOnSegment(point, start, end)) return true;
    const intersects = (end[1] > point[1]) !== (start[1] > point[1])
      && point[0] < ((start[0] - end[0]) * (point[1] - end[1])) / (start[1] - end[1]) + end[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: Coordinate, polygon: PolygonCoordinates) {
  if (!polygon.length || !pointInRing(point, polygon[0])) return false;
  return !polygon.slice(1).some((hole) => pointInRing(point, hole));
}

function provinceIdForFeature(feature: MapBoundaryCollection["features"][number]): ProvinceId | null {
  const code = String(feature.properties.PROV_CODE ?? "");
  const province = provinces.find((candidate) => candidate.code === code);
  if (province) return province.id;

  // The metropolitan boundary endpoint combines Bangkok district features
  // (NAME_T/NAME_E) with surrounding province features (PROV_CODE).
  if ("NAME_T" in feature.properties || "NAME_E" in feature.properties) return "bangkok";
  return null;
}

function featureContainsPoint(feature: MapBoundaryCollection["features"][number], point: Coordinate) {
  const polygons = feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates as PolygonCoordinates]
    : feature.geometry.coordinates as PolygonCoordinates[];
  return polygons.some((polygon) => pointInPolygon(point, polygon));
}

function distanceSquared(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const meanLatitude = ((a.lat + b.lat) / 2) * Math.PI / 180;
  const dx = (a.lng - b.lng) * Math.cos(meanLatitude);
  const dy = a.lat - b.lat;
  return dx * dx + dy * dy;
}

function spreadStations(stations: ForecastStation[], provinceId: ProvinceId, count: number) {
  if (stations.length <= count) return stations;
  const center = provinces.find((province) => province.id === provinceId)!.center;
  const selected = [stations.reduce((closest, station) =>
    distanceSquared(station, center) < distanceSquared(closest, center) ? station : closest,
  )];

  while (selected.length < count) {
    const remaining = stations.filter((station) => !selected.includes(station));
    const next = remaining.reduce((best, station) => {
      const stationGap = Math.min(...selected.map((picked) => distanceSquared(station, picked)));
      const bestGap = Math.min(...selected.map((picked) => distanceSquared(best, picked)));
      return stationGap > bestGap ? station : best;
    });
    selected.push(next);
  }
  return selected;
}

export function isStationInsideProvince(
  station: Pick<ForecastStation, "lat" | "lng">,
  provinceId: ProvinceId,
  boundary: MapBoundaryCollection,
) {
  const point: Coordinate = [station.lng, station.lat];
  return boundary.features.some((feature) =>
    provinceIdForFeature(feature) === provinceId && featureContainsPoint(feature, point),
  );
}

/** Select only in-boundary labels, keeping 2–4 well-spaced labels per province when available. */
export function selectMapLabelStations(
  stations: ForecastStation[],
  boundary: MapBoundaryCollection,
  options: { minPerProvince?: number; maxPerProvince?: number } = {},
) {
  const minPerProvince = Math.max(1, options.minPerProvince ?? 2);
  const maxPerProvince = Math.max(minPerProvince, options.maxPerProvince ?? 4);

  return provinces.flatMap((province) => {
    const provincePrefixed = stations.filter((station) => station.id.startsWith(`${province.id}-`));
    const candidatePool = provincePrefixed.length ? provincePrefixed : stations;
    const inside = candidatePool.filter((station) => isStationInsideProvince(station, province.id, boundary));
    if (!inside.length) return [];
    const desiredCount = Math.min(
      inside.length,
      Math.max(minPerProvince, Math.min(maxPerProvince, Math.ceil(inside.length / 2))),
    );
    return spreadStations(inside, province.id, desiredCount);
  });
}
export type MapLabelLocation = {
  id: string;
  provinceId: ProvinceId;
  provinceName: string;
  lat: number;
  lng: number;
};

function spreadLocations(
  locations: Array<{ lat: number; lng: number }>,
  provinceId: ProvinceId,
  count: number,
) {
  if (locations.length <= count) return locations;
  const center = provinces.find((province) => province.id === provinceId)!.center;
  const selected = [locations.reduce((closest, location) =>
    distanceSquared(location, center) < distanceSquared(closest, center) ? location : closest,
  )];

  while (selected.length < count) {
    const remaining = locations.filter((location) => !selected.includes(location));
    const next = remaining.reduce((best, location) => {
      const locationGap = Math.min(...selected.map((picked) => distanceSquared(location, picked)));
      const bestGap = Math.min(...selected.map((picked) => distanceSquared(best, picked)));
      return locationGap > bestGap ? location : best;
    });
    selected.push(next);
  }
  return selected;
}

/**
 * Build label positions independently from the buffered IDW anchors.
 * Every returned point is tested against the official province geometry.
 */
export function selectMapLabelLocations(
  boundary: MapBoundaryCollection,
  options: { labelsPerProvince?: number } = {},
): MapLabelLocation[] {
  const labelsPerProvince = Math.max(2, Math.min(4, options.labelsPerProvince ?? 3));

  return provinces.flatMap((province) => {
    const provinceFeatures = boundary.features.filter((feature) => provinceIdForFeature(feature) === province.id);
    if (!provinceFeatures.length) return [];

    const outerCoordinates = provinceFeatures.flatMap((feature) => {
      const polygons = feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates as PolygonCoordinates]
        : feature.geometry.coordinates as PolygonCoordinates[];
      return polygons.flatMap((polygon) => polygon[0] ?? []);
    });
    if (!outerCoordinates.length) return [];

    const lngs = outerCoordinates.map(([lng]) => lng);
    const lats = outerCoordinates.map(([, lat]) => lat);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const gridSize = 11;
    const candidates = Array.from({ length: gridSize * gridSize }, (_, index) => {
      const row = Math.floor(index / gridSize);
      const column = index % gridSize;
      return {
        lng: minLng + (maxLng - minLng) * ((column + 1) / (gridSize + 1)),
        lat: minLat + (maxLat - minLat) * ((row + 1) / (gridSize + 1)),
      };
    }).filter((location) => provinceFeatures.some((feature) =>
      featureContainsPoint(feature, [location.lng, location.lat]),
    ));

    if (isStationInsideProvince(province.center, province.id, boundary)) {
      candidates.push(province.center);
    }

    return spreadLocations(candidates, province.id, Math.min(labelsPerProvince, candidates.length))
      .map((location, index) => ({
        id: `${province.id}-label-${index + 1}`,
        provinceId: province.id,
        provinceName: province.nameTh,
        lat: location.lat,
        lng: location.lng,
      }));
  });
}
