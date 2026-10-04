import { getRegion, type RegionId } from "./provinces.ts";

/** A gauge stops at 100%, while the reported number can legitimately exceed it. */
export function capacityReading(value: number | null) {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  return { value, fill: Math.min(100, value), overflow: Math.max(0, value - 100) };
}

export function detailNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value !== 0 && Math.abs(value) < .001) return value > 0 ? "<0.001" : ">−0.001";
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 }).format(value);
}

export function windyRadarLinks(region: RegionId, position: { lat: number; lng: number } | null) {
  const area = getRegion(region), bounds = area.bounds;
  const inArea = position && Number.isFinite(position.lat) && Number.isFinite(position.lng)
    && position.lat >= bounds.minLat && position.lat <= bounds.maxLat
    && position.lng >= bounds.minLng && position.lng <= bounds.maxLng;
  const center = "center" in area ? area.center : { lat: (bounds.minLat + bounds.maxLat) / 2, lng: (bounds.minLng + bounds.maxLng) / 2 };
  const point = inArea ? position : center;
  // The third-party map receives an approximate area, rather than exact GPS coordinates.
  const lat = point.lat.toFixed(1), lon = point.lng.toFixed(1), zoom = inArea ? "9" : "7";
  const parameters = new URLSearchParams({ type: "map", location: "coordinates", metricRain: "mm", metricTemp: "°C", metricWind: "km/h", zoom, overlay: "radar", product: "radar", level: "surface", lat, lon });
  return {
    embed: `https://embed.windy.com/embed.html?${parameters}`,
    full: `https://www.windy.com/-Weather-radar-radar?radar,${lat},${lon},${zoom}`,
  };
}
