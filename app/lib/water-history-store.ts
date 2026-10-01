import type { WaterStation } from "./water-levels.ts";

export type WaterHistoryPoint = { observedAt: string; value: number };
export type WaterHistoryPayload = { stationId: string; datum: "msl" | "gauge"; hours: number; points: WaterHistoryPoint[]; storage: "local" | "d1" | "unavailable"; fetchedAt: string };
type StoredReading = { stationId: string; datum: "msl" | "gauge"; observedAt: string; value: number };
type Statement = { bind(...values: unknown[]): Statement; all<T>(): Promise<{ results: T[] }> };
export type ObservationDatabase = { prepare(query: string): Statement; batch(statements: Statement[]): Promise<unknown>; exec(query: string): Promise<unknown> };
export type WaterHistoryStore = { kind: "local" | "d1"; record(stations: WaterStation[], now: number): Promise<void>; read(stationId: string, datum: "msl" | "gauge", from: number, to: number): Promise<WaterHistoryPoint[]> };
const RETENTION = 90 * 86400000;
const runtime = () => globalThis as typeof globalThis & { __bkkObservationRuntime?: { cloudflare: boolean; db?: ObservationDatabase } };
export function setObservationRuntime(db?: ObservationDatabase) { runtime().__bkkObservationRuntime = { cloudflare: true, db }; }
const key = (row: StoredReading) => `${row.stationId}|${row.datum}|${row.observedAt}`;
function readings(stations: WaterStation[], now: number): StoredReading[] {
  return stations.flatMap(station => {
    const timestamp = station.observedAt ? Date.parse(station.observedAt) : NaN;
    return station.value !== null && Number.isFinite(station.value) && Number.isFinite(timestamp) && timestamp <= now + 300000 && now - timestamp <= 86400000
      ? [{ stationId: station.id, datum: station.datum, observedAt: new Date(timestamp).toISOString(), value: station.value }] : [];
  });
}
export function uniqueHistory(points: WaterHistoryPoint[]) {
  return [...new Map(points.filter(point => Number.isFinite(point.value) && Number.isFinite(Date.parse(point.observedAt))).map(point => [point.observedAt, point])).values()].sort((a,b) => a.observedAt.localeCompare(b.observedAt));
}

export function createD1HistoryStore(db: ObservationDatabase): WaterHistoryStore {
  let ready: Promise<unknown> | undefined;
  const initialize = () => ready ??= db.exec("CREATE TABLE IF NOT EXISTS water_observations (station_id TEXT NOT NULL, datum TEXT NOT NULL, observed_at TEXT NOT NULL, value REAL NOT NULL, PRIMARY KEY (station_id, datum, observed_at)); CREATE INDEX IF NOT EXISTS water_observations_time ON water_observations(observed_at);");
  let prunedDay = "";
  return {
    kind: "d1",
    async record(stations, now) {
      await initialize();
      const rows = readings(stations, now);
      for (let offset = 0; offset < rows.length; offset += 50) {
        await db.batch(rows.slice(offset, offset + 50).map(row => db.prepare("INSERT INTO water_observations (station_id, datum, observed_at, value) VALUES (?, ?, ?, ?) ON CONFLICT(station_id, datum, observed_at) DO UPDATE SET value=excluded.value").bind(row.stationId,row.datum,row.observedAt,row.value)));
      }
      const day = new Date(now).toISOString().slice(0,10);
      if (prunedDay !== day) { await db.batch([db.prepare("DELETE FROM water_observations WHERE observed_at < ?").bind(new Date(now - RETENTION).toISOString())]); prunedDay = day; }
    },
    async read(stationId, datum, from, to) {
      await initialize();
      const result = await db.prepare("SELECT observed_at AS observedAt, value FROM water_observations WHERE station_id=? AND datum=? AND observed_at>=? AND observed_at<=? ORDER BY observed_at LIMIT 4000").bind(stationId,datum,new Date(from).toISOString(),new Date(to).toISOString()).all<WaterHistoryPoint>();
      return uniqueHistory(result.results);
    },
  };
}

/** Local daily append journals survive process restarts. Cloudflare always uses its D1 binding. */
export function createFileHistoryStore(directory: string): WaterHistoryStore {
  let queue = Promise.resolve();
  let prunedDay = "";
  const path = (day: string) => `${directory}/${day}.ndjson`;
  async function rows(day: string): Promise<StoredReading[]> {
    const fs = await import("node:fs/promises");
    try {
      const contents = await fs.readFile(path(day), "utf8");
      return contents.split("\n").flatMap(line => {
        try { const row = JSON.parse(line) as StoredReading; return row && typeof row.stationId === "string" && (row.datum === "msl" || row.datum === "gauge") && Number.isFinite(row.value) && typeof row.observedAt === "string" && Number.isFinite(Date.parse(row.observedAt)) ? [row] : []; } catch { return []; }
      });
    } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  }
  return {
    kind: "local",
    async record(stations, now) {
      const operation = queue.then(async () => {
        const fs = await import("node:fs/promises");
        await fs.mkdir(directory, { recursive: true });
        const grouped = Map.groupBy(readings(stations, now), row => row.observedAt.slice(0,10));
        for (const [day, incoming] of grouped) {
          const previous = new Set((await rows(day)).map(key));
          const additions = incoming.filter(row => { if (previous.has(key(row))) return false; previous.add(key(row)); return true; });
          if (additions.length) await fs.appendFile(path(day), additions.map(row => JSON.stringify(row)).join("\n") + "\n", "utf8");
        }
        const day = new Date(now).toISOString().slice(0,10);
        if (prunedDay !== day) {
          const cutoff = new Date(now - RETENTION).toISOString().slice(0,10);
          for (const name of await fs.readdir(directory)) {
            // Only the store's own flat daily journals can be removed. Never recurse or accept external paths.
            if (/^\d{4}-\d{2}-\d{2}\.ndjson$/.test(name) && name.slice(0,10) < cutoff) await fs.unlink(`${directory}/${name}`);
          }
          prunedDay = day;
        }
      });
      queue = operation.catch(() => undefined);
      await operation;
    },
    async read(stationId, datum, from, to) {
      const result: WaterHistoryPoint[] = [];
      for (let timestamp = Math.floor(from / 86400000) * 86400000; timestamp <= to; timestamp += 86400000) {
        const stored = await rows(new Date(timestamp).toISOString().slice(0,10));
        for (const row of stored) {
          const time = Date.parse(row.observedAt);
          if (row.stationId === stationId && row.datum === datum && time >= from && time <= to) result.push({ observedAt: row.observedAt, value: row.value });
        }
      }
      return uniqueHistory(result).slice(-4000);
    },
  };
}

let fileStore: WaterHistoryStore | undefined;
const d1Stores = new WeakMap<ObservationDatabase, WaterHistoryStore>();
export function getWaterHistoryStore(): WaterHistoryStore | null {
  const state = runtime().__bkkObservationRuntime;
  if (state?.db) {
    let store = d1Stores.get(state.db);
    if (!store) { store = createD1HistoryStore(state.db); d1Stores.set(state.db, store); }
    return store;
  }
  if (state?.cloudflare) return null;
  return fileStore ??= createFileHistoryStore(`${process.cwd().replace(/\\/g,"/")}/.data/water-history`);
}
