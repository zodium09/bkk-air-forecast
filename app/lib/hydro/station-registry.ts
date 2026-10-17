import boundaries from "../../data/chao-phraya-upstream-basins.json" with { type: "json" };
import geography from "../../data/chao-phraya-geography.json" with { type: "json" };
import { coverageContains } from "../geographic-coverage.ts";
import type { WaterStation } from "../water-levels.ts";

const basinCodes = ["06", "07", "08", "09", "11", "12"] as const;
export type CanonicalBasinId = "chao-phraya" | typeof basinCodes[number];
const polygons = basinCodes.map(code => ({ code, polygon: { features: boundaries.features.filter(feature => feature.properties.MB_CODE === code) } }));

/** Coordinates determine coverage; administrative names never substitute for a basin. */
export function canonicalBasinForStation(station: { lat: number; lng: number }): CanonicalBasinId | null {
  if (!Number.isFinite(station.lat) || !Number.isFinite(station.lng)) return null;
  for (const basin of polygons) if (coverageContains(basin.polygon, station.lat, station.lng)) return basin.code;
  return coverageContains(geography.core, station.lat, station.lng) ? "chao-phraya" : null;
}

export function canonicalStation(station: WaterStation) {
  const basinId = canonicalBasinForStation(station);
  return { canonicalId: `thaiwater:waterlevel:${station.id}`, sourceId: "thaiwater:waterlevel" as const, sourceStationId: station.id, aliases: [station.id], name: station.name, agency: station.agency, lat: station.lat, lng: station.lng, datum: station.datum, basinId, reachId: null, mapping: basinId ? "polygon" as const : "unknown" as const, sourceValidity: station.status, observedAt: station.observedAt };
}

/** Resolve one source ID once before assigning basins. Never merge IDs from other providers. */
export function canonicalWaterStations(stations: WaterStation[]) {
  const unique = new Map<string, WaterStation>();
  for (const station of stations) {
    const previous = unique.get(station.id);
    if (!previous || station.value !== null && (previous.value === null || (station.observedAt ?? "") > (previous.observedAt ?? ""))) unique.set(station.id, station);
  }
  return [...unique.values()];
}
