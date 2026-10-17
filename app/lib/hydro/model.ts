import { canonicalBasinForStation, canonicalWaterStations } from "./station-registry.ts";
import { observationAge } from "../observation-time.ts";
import { bangkokDateKey } from "../forecast/timestamps.ts";
import { upstreamBasins } from "../chao-phraya-upstream.ts";
import type { UpstreamPayload, UpstreamBasin } from "../upstream-watch-data.ts";
import { currentWaterStations, waterRisk, type WaterPayload, type WaterStation } from "../water-levels.ts";

export const HYDRO_BASINS = [
  { id: "chao-phraya", name: "เจ้าพระยาตอนกลาง–ล่าง", connection: "จากปากน้ำโพสู่ปากอ่าว" },
  ...upstreamBasins.map(basin => ({ id: basin.code, name: basin.name, connection: basin.connection })),
] as const;
export type HydroBasinId = (typeof HYDRO_BASINS)[number]["id"];
export type HydroSourceState = "live" | "last-known" | "unavailable";
export type HydroPayload = { fetchedAt: string; water: WaterPayload; upstream: UpstreamPayload; centralRain: UpstreamBasin["rain"]; historyStorage: "local" | "d1" | "unavailable"; sources: Record<"water" | "rain" | "dams", HydroSourceState>; lastKnownAt: Partial<Record<"water" | "rain" | "dams", string>> };
export type HydroBasin = {
  id: HydroBasinId; name: string; connection: string; water: WaterStation[];
  rain: UpstreamBasin["rain"]; dams: UpstreamBasin["dams"];
  waterSourceAvailable: boolean; rainSourceAvailable: boolean; damSourceAvailable: boolean;
  freshWater: number; assessedWater: number; highWater: number; exceededWater: number;
  peakRain: UpstreamBasin["rain"][number] | null;
};

export function basinForStation(station: Pick<WaterStation, "lat" | "lng">): HydroBasinId | null {
  return canonicalBasinForStation(station);
}

/** Same station and readiness rules drive the summary, explorer, and detail pages. */
export function buildHydroBasins(payload: HydroPayload, now = Date.now()): HydroBasin[] {
  const allWater = currentWaterStations(canonicalWaterStations([...payload.water.stations, ...payload.upstream.basins.flatMap(basin => basin.water)]), now);
  const sourceByCode = new Map(payload.upstream.basins.map(basin => [basin.code, basin]));
  return HYDRO_BASINS.map(meta => {
    const upstream = meta.id === "chao-phraya" ? null : sourceByCode.get(meta.id);
    const water = allWater.filter(station => basinForStation(station) === meta.id);
    const rain = (meta.id === "chao-phraya" ? payload.centralRain : upstream?.rain ?? []).filter(point => {
      const age = observationAge(point.observedAt, now);
      return age !== null && age <= 180;
    });
    const fresh = water.filter(station => station.status === "fresh");
    const assessed = fresh.filter(station => waterRisk(station).id !== "unknown");
    const peakRain = [...rain].sort((a, b) => b.mm - a.mm)[0] ?? null;
    const dams = (upstream?.dams ?? []).filter(dam => {
      const age = observationAge(`${dam.date}T00:00:00+07:00`, now);
      return dam.date <= bangkokDateKey(now) && age !== null && age < 2880;
    });
    return {
      ...meta, water, rain, dams,
      waterSourceAvailable: payload.sources.water !== "unavailable",
      rainSourceAvailable: payload.sources.rain !== "unavailable",
      damSourceAvailable: meta.id === "chao-phraya" ? false : payload.sources.dams !== "unavailable",
      freshWater: fresh.length, assessedWater: assessed.length,
      highWater: assessed.filter(station => waterRisk(station).id === "high").length,
      exceededWater: assessed.filter(station => waterRisk(station).id === "overflow").length,
      peakRain,
    };
  });
}

export function hydroStation(basins: HydroBasin[], id: string, basinId?: string) {
  return basins.filter(basin => !basinId || basin.id === basinId).flatMap(basin => basin.water.map(station => ({ basin, station }))).find(item => item.station.id === id) ?? null;
}
