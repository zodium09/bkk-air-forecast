import type { WaterStation } from "./water-levels.ts";

export type WaterHistoryPoint = { observedAt: string; value: number };
export type WaterHistoryPayload = { stationId: string; datum: "msl" | "gauge"; hours: number; points: WaterHistoryPoint[]; storage: "local" | "d1" | "unavailable"; fetchedAt: string };
type StoredReading = { stationId: string; datum: "msl" | "gauge"; observedAt: string; value: number };
type Statement = { bind(...values: unknown[]): Statement; all<T>(): Promise<{ results: T[] }> };
export type ObservationDatabase = { prepare(query: string): Statement; batch(statements: Statement[]): Promise<unknown>; exec(query: string): Promise<unknown> };
export type HydroSourceId = "water" | "rain" | "dams";
export type IngestionRun = { runId: string; sourceId: HydroSourceId; startedAt: string; endedAt: string; status: "success" | "failed"; accepted: number; rejected: number; latestObservedAt: string | null; error: string | null };
export type WaterHistoryStore = { kind: "local" | "d1"; record(stations: WaterStation[], now: number): Promise<void>; read(stationId: string, datum: "msl" | "gauge", from: number, to: number): Promise<WaterHistoryPoint[]>; saveRun?(run: IngestionRun): Promise<void>; readRuns?(): Promise<IngestionRun[]>; saveSnapshot?(source: HydroSourceId, payload: unknown, receivedAt: string): Promise<void>; readSnapshot?(source: HydroSourceId): Promise<{ payload: unknown; receivedAt: string } | null> };
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
  let prunedDay = "";
  return {
    kind: "d1",
    async record(stations, now) {
      const rows = readings(stations, now);
      for (let offset = 0; offset < rows.length; offset += 50) {
        await db.batch(rows.slice(offset, offset + 50).flatMap(row => [db.prepare("INSERT OR IGNORE INTO water_observation_revisions (station_id, datum, observed_at, value, ingested_at, revision) SELECT station_id, datum, observed_at, value, NULL, 1 FROM water_observations WHERE station_id=? AND datum=? AND observed_at=?").bind(row.stationId,row.datum,row.observedAt), db.prepare("INSERT INTO water_observation_revisions (station_id, datum, observed_at, value, ingested_at, revision) SELECT ?, ?, ?, ?, ?, COALESCE(MAX(revision), 0)+1 FROM water_observation_revisions WHERE station_id=? AND datum=? AND observed_at=? HAVING COUNT(*)=0 OR (SELECT value FROM water_observation_revisions WHERE station_id=? AND datum=? AND observed_at=? ORDER BY revision DESC LIMIT 1) != ?").bind(row.stationId,row.datum,row.observedAt,row.value,new Date(now).toISOString(),row.stationId,row.datum,row.observedAt,row.stationId,row.datum,row.observedAt,row.value), db.prepare("INSERT INTO water_observations (station_id, datum, observed_at, value) VALUES (?, ?, ?, ?) ON CONFLICT(station_id, datum, observed_at) DO UPDATE SET value=excluded.value").bind(row.stationId,row.datum,row.observedAt,row.value)]));
      }
      const day = new Date(now).toISOString().slice(0,10);
      if (prunedDay !== day) { await db.batch([db.prepare("DELETE FROM water_observations WHERE observed_at < ?").bind(new Date(now - RETENTION).toISOString())]); prunedDay = day; }
    },
    async read(stationId, datum, from, to) {
      const result = await db.prepare("SELECT observed_at AS observedAt, value FROM water_observations WHERE station_id=? AND datum=? AND observed_at>=? AND observed_at<=? ORDER BY observed_at LIMIT 4000").bind(stationId,datum,new Date(from).toISOString(),new Date(to).toISOString()).all<WaterHistoryPoint>();
      return uniqueHistory(result.results);
    },
    async saveRun(run) { await db.batch([db.prepare("INSERT OR IGNORE INTO ingestion_runs (run_id, ended_at, payload) VALUES (?, ?, ?)").bind(run.runId,run.endedAt,JSON.stringify(run))]); },
    async readRuns() { const result = await db.prepare("SELECT payload FROM ingestion_runs ORDER BY ended_at DESC, run_id DESC LIMIT 100").all<{payload: string}>(); return result.results.map(row => JSON.parse(row.payload) as IngestionRun); },
    async saveSnapshot(source, payload, receivedAt) {
      await db.batch([db.prepare("INSERT INTO hydro_snapshots (source_id, received_at, payload) VALUES (?, ?, ?) ON CONFLICT(source_id) DO UPDATE SET received_at=excluded.received_at, payload=excluded.payload").bind(source,receivedAt,JSON.stringify(payload))]);
    },
    async readSnapshot(source) {
      const result = await db.prepare("SELECT received_at AS receivedAt, payload FROM hydro_snapshots WHERE source_id=?").bind(source).all<{ receivedAt: string; payload: string }>();
      const row = result.results[0];
      if (!row) return null;
      try { return { receivedAt: row.receivedAt, payload: JSON.parse(row.payload) }; } catch { return null; }
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
          const previous = new Map((await rows(day)).map(row => [key(row), row.value]));
          const additions = incoming.filter(row => { if (previous.get(key(row)) === row.value) return false; previous.set(key(row), row.value); return true; });
          if (additions.length) await fs.appendFile(path(day), additions.map(row => JSON.stringify({ ...row, ingestedAt: new Date(now).toISOString() })).join("\n") + "\n", "utf8");
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
    async saveRun(run) {
      const operation = queue.then(async () => { const fs = await import("node:fs/promises"); await fs.mkdir(directory,{recursive:true}); await fs.appendFile(`${directory}/ingestion-runs.ndjson`,JSON.stringify(run)+"\n","utf8"); });
      queue = operation.catch(() => undefined); await operation;
    },
    async readRuns() {
      const fs = await import("node:fs/promises");
      try { return (await fs.readFile(`${directory}/ingestion-runs.ndjson`,"utf8")).trim().split("\n").flatMap(line => { try { return [JSON.parse(line) as IngestionRun]; } catch { return []; } }).sort((a,b) => b.endedAt.localeCompare(a.endedAt)).slice(0,100); }
      catch(error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
    },
    async saveSnapshot(source, payload, receivedAt) {
      const operation = queue.then(async () => {
        const fs = await import("node:fs/promises");
        await fs.mkdir(directory, { recursive: true });
        const destination = `${directory}/snapshot-${source}.json`;
        const temporary = `${destination}.tmp`;
        await fs.writeFile(temporary, JSON.stringify({ receivedAt, payload }), "utf8");
        await fs.rename(temporary, destination);
      });
      queue = operation.catch(() => undefined);
      await operation;
    },
    async readSnapshot(source) {
      const fs = await import("node:fs/promises");
      try {
        const result = JSON.parse(await fs.readFile(`${directory}/snapshot-${source}.json`, "utf8"));
        return typeof result?.receivedAt === "string" && Number.isFinite(Date.parse(result.receivedAt)) ? result : null;
      } catch { return null; }
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
