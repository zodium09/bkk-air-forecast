import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createFileHistoryStore, createD1HistoryStore } from '../../app/lib/water-history-store.ts';
import { collectWaterObservations } from '../../app/lib/collect-water-observations.ts';
import { createIngestionHealthResponse } from '../../app/lib/ingestion-health.ts';

const now = Date.parse('2026-10-15T06:00:00Z');
const station = value => ({ id: '123', value, datum: 'msl', observedAt: new Date(now).toISOString() });
const run = { runId: 'test', sourceId: 'water', startedAt: new Date(now).toISOString(), endedAt: new Date(now).toISOString(), status: 'success', accepted: 1, rejected: 0, latestObservedAt: new Date(now).toISOString(), error: null };
function database(sqlite) {
  return { async exec(sql) { sqlite.exec(sql); }, prepare(sql) { let values = []; const statement = { bind(...args) { values = args; return statement; }, async all() { return { results: sqlite.prepare(sql).all(...values) }; }, run() { sqlite.prepare(sql).run(...values); } }; return statement; }, async batch(statements) { sqlite.exec('BEGIN'); try { for (const statement of statements) statement.run(); sqlite.exec('COMMIT'); } catch(error) { sqlite.exec('ROLLBACK'); throw error; } } };
}

test('D1 preserves legacy value, corrections and reverts; repeated zero does not add a revision', async () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    sqlite.exec(await fs.readFile('drizzle/0000_last_proemial_gods.sql', 'utf8'));
    sqlite.prepare('INSERT INTO water_observations VALUES (?, ?, ?, ?)').run('123', 'msl', new Date(now).toISOString(), -1);
    const migration = await fs.readFile('drizzle/0001_productive_daredevil.sql', 'utf8');
    sqlite.exec(migration);
    const backfill = await fs.readFile('scripts/backfill-water-revisions.sql', 'utf8');
    sqlite.exec(backfill); sqlite.exec(backfill);
    const store = createD1HistoryStore(database(sqlite));
    for (const value of [0, 0, -1, null]) await store.record([station(value)], now);
    const revisions = sqlite.prepare('SELECT value, ingested_at FROM water_observation_revisions ORDER BY revision').all();
    assert.deepEqual(revisions.map(row => row.value), [-1, 0, -1]);
    assert.equal(revisions[0].ingested_at, null);
    assert.equal((await store.read('123', 'msl', now, now))[0].value, -1);
    await store.saveRun(run);
    assert.deepEqual(await store.readRuns(), [run]);
  } finally { sqlite.close(); }
});

test('file correction journal survives reopen and preserves original lines', async () => {
  const root = path.resolve('output'); await fs.mkdir(root, { recursive: true });
  const directory = await fs.mkdtemp(path.join(root, 'revision-test-'));
  try {
    const original = JSON.stringify({ stationId: '123', datum: 'msl', observedAt: new Date(now).toISOString(), value: -1 }) + '\n';
    await fs.writeFile(path.join(directory, '2026-10-15.ndjson'), original);
    const store = createFileHistoryStore(directory);
    for (const value of [0, 0, -1, null]) await store.record([station(value)], now);
    const contents = await fs.readFile(path.join(directory, '2026-10-15.ndjson'), 'utf8');
    assert.ok(contents.startsWith(original));
    assert.deepEqual(contents.trim().split('\n').map(line => JSON.parse(line).value), [-1, 0, -1]);
    await store.saveRun(run);
    const reopened = createFileHistoryStore(directory);
    assert.deepEqual(await reopened.readRuns(), [run]);
    assert.equal((await reopened.read('123', 'msl', now, now))[0].value, -1);
  } finally { assert.ok(directory.startsWith(root + path.sep)); await fs.rm(directory, { recursive: true, force: true }); }
});

test('collector persists failed run without exposing upstream errors', async () => {
  const runs = [];
  await assert.rejects(collectWaterObservations({ async saveRun(run) { runs.push(run); } }, async () => { throw new Error('private upstream URL'); }, now));
  assert.equal(runs.length, 1); assert.equal(runs[0].status, 'failed');
  assert.equal(runs[0].accepted, 0); assert.equal(runs[0].latestObservedAt, null);
  assert.equal(runs[0].error, 'water collection failed');
});

test('collector records a successful run with zero value and source observation time', async () => {
  const runs = []; const recorded = [];
  const raw = { waterlevel_data: { result: 'OK', data: [{ waterlevel_datetime: '2026-10-15 12:55', waterlevel_msl: 0, station: { id: 123, tele_station_name: { th: 'สถานีทดสอบ' }, tele_station_lat: 13.75, tele_station_long: 100.5 }, geocode: { province_code: '10' } }] } };
  await collectWaterObservations({ async record(stations) { recorded.push(...stations); }, async saveRun(run) { runs.push(run); } }, async () => Response.json(raw), now);
  assert.equal(recorded[0].value, 0);
  assert.equal(runs[0].status, 'success');
  assert.equal(runs[0].accepted, 1);
  assert.equal(runs[0].latestObservedAt, '2026-10-15T05:55:00.000Z');
});

test('health reads journal only, marks stale and failed, preserves last success and missing storage', async () => {
  const store = { kind: 'local', async readRuns() { return [run]; }, async record() { assert.fail('must not collect'); } };
  assert.equal((await (await createIngestionHealthResponse(store, now)).json()).status, 'available');
  assert.equal((await (await createIngestionHealthResponse(store, now + 16 * 60000)).json()).status, 'stale');
  store.readRuns = async () => [{ ...run, runId: 'failed', status: 'failed' }, run];
  const response = await createIngestionHealthResponse(store, now);
  const payload = await response.json();
  assert.equal(payload.status, 'failed'); assert.equal(payload.lastSuccessAt, run.endedAt);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await createIngestionHealthResponse(null, now)).status, 503);
  store.readRuns = async () => [];
  assert.equal((await (await createIngestionHealthResponse(store, now)).json()).status, 'unknown');
});
