import { prepareSpatialIdw, spatialIdw } from "./forecast/interpolation.ts";
import {
  getLegend,
  legendIndex,
  pointValue,
  valueColor,
  type EnvironmentLayer,
  type MapPoint,
  type Metric,
} from "./map-intelligence.ts";

export type MapBoundary = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: { type: string; coordinates: number[][][] | number[][][][] };
  }[];
};
export type MapSurface = {
  url: string;
  mask: HTMLCanvasElement;
  values: Float32Array;
  width: number;
  height: number;
  bounds: [[number, number], [number, number]];
};
const surfaceCache = new WeakMap<
  MapPoint[],
  Map<MapBoundary, Map<string, MapSurface | null>>
>();
const highlightedSurfaces = new WeakMap<MapSurface, Map<number, string>>();
const idwOptions = {
  maxDistanceKm: 50,
  maxNeighbors: 12,
  minNeighbors: 3,
  power: 1.55,
  smoothingKm: 3.5,
};

export function boundaryContains(
  boundary: MapBoundary,
  lat: number,
  lng: number,
): boolean {
  const inRing = (ring: number[][]) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x, y] = ring[i],
        [px, py] = ring[j];
      if (y > lat !== py > lat && lng < ((px - x) * (lat - y)) / (py - y) + x)
        inside = !inside;
    }
    return inside;
  };
  return boundary.features.some((f) => {
    const polygons =
      f.geometry.type === "Polygon"
        ? [f.geometry.coordinates as number[][][]]
        : f.geometry.type === "MultiPolygon"
          ? (f.geometry.coordinates as number[][][][])
          : [];
    return polygons.some(
      (p) => !!p[0] && inRing(p[0]) && !p.slice(1).some(inRing),
    );
  });
}

export function interpolateMapValue(
  points: MapPoint[],
  index: number,
  metric: Metric,
  lat: number,
  lng: number,
): number | null {
  return spatialIdw(
    lat,
    lng,
    points.flatMap((p) => {
      const value = pointValue(p, index, metric);
      return value === null ? [] : [{ lat: p.lat, lng: p.lng, value }];
    }),
    idwOptions,
  );
}

export function prepareMapInterpolation(points: MapPoint[], lat: number, lng: number) {
  const interpolate = prepareSpatialIdw(lat, lng, points, idwOptions);
  return (index: number, metric: Metric) => interpolate((neighbor) => pointValue(points[neighbor], index, metric));
}

/** Subtle lightness variation within each legend band preserves its risk classification. */
function rasterColor(
  layer: EnvironmentLayer,
  metric: Metric,
  value: number,
): number[] {
  const bands = getLegend(layer, metric),
    band = legendIndex(layer, metric, value);
  const low = band > 0 ? bands[band - 1].max : 0;
  const high = Number.isFinite(bands[band].max)
    ? bands[band].max
    : low + (layer === "rain" && metric === "primary" ? 20 : 40);
  const ratio = Math.max(
    0,
    Math.min(1, (value - low) / Math.max(1, high - low)),
  );
  const color = valueColor(layer, metric, value).slice(1);
  return [0, 2, 4].map((i) =>
    Math.round(parseInt(color.slice(i, i + 2), 16) * (0.85 + ratio * 0.15)),
  );
}

export function surfaceDisplayUrl(
  surface: MapSurface,
  layer: EnvironmentLayer,
  metric: Metric,
  band: number | null,
): string {
  if (band === null) return surface.url;
  let cache = highlightedSurfaces.get(surface);
  if (!cache) {
    cache = new Map();
    highlightedSurfaces.set(surface, cache);
  }
  if (cache.has(band)) return cache.get(band)!;
  const canvas = document.createElement("canvas");
  canvas.width = surface.width;
  canvas.height = surface.height;
  const context = canvas.getContext("2d");
  if (!context) return surface.url;
  const pixels = context.createImageData(surface.width, surface.height);
  surface.values.forEach((value, i) => {
    if (!Number.isFinite(value)) return;
    pixels.data.set(
      [
        ...rasterColor(layer, metric, value),
        legendIndex(layer, metric, value) === band ? 240 : 35,
      ],
      i * 4,
    );
  });
  context.putImageData(pixels, 0, 0);
  const url = canvas.toDataURL();
  cache.set(band, url);
  return url;
}

/** Display interpolation retains the original bounded IDW policy. It does not create new model resolution. */
export function createMapSurface(
  boundary: MapBoundary,
  points: MapPoint[],
  index: number,
  layer: EnvironmentLayer,
  metric: Metric,
): MapSurface | null {
  let boundaries = surfaceCache.get(points);
  if (!boundaries) {
    boundaries = new Map();
    surfaceCache.set(points, boundaries);
  }
  let cache = boundaries.get(boundary);
  if (!cache) {
    cache = new Map();
    boundaries.set(boundary, cache);
  }
  const key = `${layer}:${metric}:${index}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const anchors = points.flatMap((p) => {
    const value = pointValue(p, index, metric);
    return value === null ? [] : [{ lat: p.lat, lng: p.lng, value }];
  });
  if (anchors.length < 3) {
    cache.set(key, null);
    return null;
  }
  const polygons = boundary.features.flatMap((f) =>
    f.geometry.type === "Polygon"
      ? [f.geometry.coordinates as number[][][]]
      : f.geometry.type === "MultiPolygon"
        ? (f.geometry.coordinates as number[][][][])
        : [],
  );
  const coordinates = polygons.flat(2);
  if (!coordinates.length) return null;
  const minLat = Math.min(...coordinates.map((p) => p[1])),
    maxLat = Math.max(...coordinates.map((p) => p[1])),
    minLng = Math.min(...coordinates.map((p) => p[0])),
    maxLng = Math.max(...coordinates.map((p) => p[0]));
  const width = 220,
    height = Math.min(
      300,
      Math.max(80, Math.round((width * (maxLat - minLat)) / (maxLng - minLng))),
    );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.fillStyle = "#fff";
  for (const polygon of polygons) {
    context.beginPath();
    for (const ring of polygon) {
      ring.forEach(([lng, lat], i) => {
        const x = ((lng - minLng) / (maxLng - minLng)) * width,
          y = ((maxLat - lat) / (maxLat - minLat)) * height;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
    }
    context.fill("evenodd");
  }
  const boundaryPixels = context.getImageData(0, 0, width, height).data;
  const pixels = context.createImageData(width, height);
  const values = new Float32Array(width * height).fill(NaN);
  const mask = document.createElement("canvas");
  mask.width = width;
  mask.height = height;
  const maskContext = mask.getContext("2d");
  if (!maskContext) return null;
  const maskPixels = maskContext.createImageData(width, height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      if (!boundaryPixels[offset + 3]) continue;
      const value = spatialIdw(
        maxLat - ((y + 0.5) / height) * (maxLat - minLat),
        minLng + ((x + 0.5) / width) * (maxLng - minLng),
        anchors,
        idwOptions,
      );
      if (value === null) continue;
      values[y * width + x] = value;
      pixels.data.set([...rasterColor(layer, metric, value), 220], offset);
      maskPixels.data.set([255, 255, 255, 255], offset);
    }
  context.putImageData(pixels, 0, 0);
  maskContext.putImageData(maskPixels, 0, 0);
  const surface: MapSurface = {
    url: canvas.toDataURL(),
    mask,
    values,
    width,
    height,
    bounds: [
      [minLat, minLng],
      [maxLat, maxLng],
    ],
  };
  cache.set(key, surface);
  if (cache.size > 18) cache.delete(cache.keys().next().value!);
  return surface;
}

export function sampleMapSurface(
  surface: MapSurface,
  lat: number,
  lng: number,
): number | null {
  const [[minLat, minLng], [maxLat, maxLng]] = surface.bounds;
  if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) return null;
  const x = Math.min(
    surface.width - 1,
    Math.floor(((lng - minLng) / (maxLng - minLng)) * surface.width),
  );
  const y = Math.min(
    surface.height - 1,
    Math.floor(((maxLat - lat) / (maxLat - minLat)) * surface.height),
  );
  const value = surface.values[y * surface.width + x];
  return Number.isFinite(value) ? value : null;
}
