import { observationAge } from "./observation-time.ts";
import { bangkokDateKey } from "./forecast/timestamps.ts";
import { waterRisk, type WaterStation } from "./water-levels.ts";

export type RainPoint = { id: string; name: string; mm: number; observedAt: string };
export type DamPoint = { id: string; name: string; date: string; storagePercent: number | null; inflowMillionM3: number | null; releasedMillionM3: number | null };
export type UpstreamBasin = { code: string; name: string; connection: string; rain: RainPoint[]; water: WaterStation[]; dams: DamPoint[] };
export type UpstreamPayload = { fetchedAt: string; status: "live" | "degraded" | "unavailable"; upstream: Record<"water" | "rain" | "dams", boolean>; basins: UpstreamBasin[]; source: string; sourcePage: string };

export function upstreamSummary(basin: UpstreamBasin, now = Date.now()) {
  const rain = basin.rain.filter(p => { const age = observationAge(p.observedAt, now); return age !== null && age <= 180; });
  const water = basin.water.map(p => { const age = observationAge(p.observedAt, now); return { ...p, status: p.value !== null && age !== null && age <= 60 ? "fresh" as const : "stale" as const }; });
  const fresh = water.filter(p => p.status === "fresh"), assessed = fresh.filter(p => waterRisk(p).priority >= 0);
  const attention = assessed.filter(p => ["high", "overflow"].includes(waterRisk(p).id));
  const dams = basin.dams.filter(p => { const age = observationAge(`${p.date}T00:00:00+07:00`, now); return p.date <= bangkokDateKey(now) && age !== null && age < 2880; });
  return { peakRain: [...rain].sort((a,b) => b.mm-a.mm)[0] ?? null, rainCount: rain.length, waterCount: fresh.length, waterTotal: water.length, assessedCount: assessed.length, waterAttention: attention.length, water: [...water].sort((a,b) => waterRisk(b).priority-waterRisk(a).priority || a.name.localeCompare(b.name,"th")), dams };
}
