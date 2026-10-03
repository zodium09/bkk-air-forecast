import { selectAirObservation, type AirObservationPayload } from "./air-observations.ts";
import { currentWaterStations, waterStationsForArea, waterRisk, type WaterPayload } from "./water-levels.ts";
import type { RegionId } from "./provinces.ts";
import type { RainPosition } from "./rain-nearby.ts";

/** Use fresh observations in their own scope; never average water datums or turn gaps into zero. */
export function localWaterReading(payload: WaterPayload | null, region: RegionId, place: RainPosition | null, now: number) {
  const stations = waterStationsForArea(currentWaterStations(payload?.stations ?? [], now), region, place)
    .filter(station => station.status === "fresh" && station.value !== null && (!place || station.distanceKm !== null && station.distanceKm <= 8));
  const station = place ? stations[0] ?? null : null;
  const attention = stations.filter(item => waterRisk(item).priority > 0);
  return { stations, station, attention, value: station?.value ?? null };
}

export function localAirReading(payload: AirObservationPayload | null, region: RegionId, place: RainPosition | null, now: number) {
  return selectAirObservation(payload?.stations ?? [], region, place, now);
}
