import assert from "node:assert/strict";
import test from "node:test";
import { basinForStation, buildHydroBasins } from "../../app/lib/hydro/model.ts";
import { createHydroResponse } from "../../app/lib/hydro/response.ts";
import { collectWaterObservations } from "../../app/lib/collect-water-observations.ts";
import { normalizeCentralRain } from "../../app/lib/hydro/central-rain.ts";

const now = Date.parse("2026-10-02T12:00:00+07:00");
const observedAt = "2026-10-02T04:50:00.000Z";
const station = (id, lat, lng, capacityPercent, bank = 100, value = 99) => ({ id, name: `สถานี ${id}`, waterway: "แม่น้ำ", kind: "river", provinceId: "63", province: "ตาก", district: "", lat, lng, value, datum: "msl", bank, capacityPercent, ground: null, observedAt, ageMinutes: 10, status: "fresh", agency: "ทดสอบ" });
const ping = station("1", 17.241944, 98.971456, 80);
const central = station("2", 13.7, 100.5, 105);
const emptyBasin = code => ({ code, name: code, connection: "", rain: [], water: [], dams: [] });

test("central rainfall accepts only actual basin-10 stations inside the core and retains zero", () => {
  const point = (id, lat, lng, mm, code = 10) => ({ basin: { basin_code: code }, station: { id, tele_station_name: { th: `ฝน ${id}` }, tele_station_lat: lat, tele_station_long: lng }, rain_24h: mm, rainfall_datetime: "2026-10-02 11:50" });
  const rows = normalizeCentralRain({ result: "OK", data: [point(1, 13.7, 100.5, 0), point(2, 13.55, 100.2, 99), point(3, 13.7, 100.5, 50, 9), point(4, 13.7, 100.5, null)] }, now);
  assert.deepEqual(rows.map(row => [row.id, row.mm]), [["1", 0]]);
});

test("hydro summary assigns a station to one basin and separates high from exceeded", () => {
  assert.equal(basinForStation(ping), "06");
  assert.equal(basinForStation(central), "chao-phraya");
  assert.equal(basinForStation({ lat: 13.55, lng: 100.2 }), null, "metro territory outside the river basin is not counted as basin coverage");
  const basins = buildHydroBasins({
    fetchedAt: observedAt, historyStorage: "d1", centralRain: [], sources: { water: "live", rain: "unavailable", dams: "unavailable" }, lastKnownAt: {},
    water: { status: "live", fetchedAt: observedAt, stations: [ping, central], source: "ThaiWater", sourcePage: "" },
    upstream: { status: "degraded", fetchedAt: observedAt, upstream: { water: true, rain: false, dams: false }, basins: [{ ...emptyBasin("06"), water: [ping] }], source: "ThaiWater", sourcePage: "" },
  }, now);
  assert.equal(basins.length, 7);
  assert.deepEqual([basins[0].freshWater, basins[0].highWater, basins[0].exceededWater], [1, 0, 1]);
  assert.deepEqual([basins[1].freshWater, basins[1].highWater, basins[1].exceededWater], [1, 1, 0]);
  assert.equal(basins.reduce((sum, basin) => sum + basin.water.length, 0), 2);
  assert.equal(basins[0].peakRain, null);
  assert.equal(basins[0].rainSourceAvailable, false);
});

test("hydro API retains partial provider state and archives distinct water stations once", async () => {
  const raw = { waterlevel_data: { result: "OK", data: [{ basin: { basin_code: 6 }, station: { id: 1, tele_station_name: { th: "สถานีปิง" }, tele_station_lat: ping.lat, tele_station_long: ping.lng, min_bank: 100 }, geocode: { province_code: 63, province_name: { th: "ตาก" } }, waterlevel_msl: 101, storage_percent: 105, waterlevel_datetime: "2026-10-02 11:50" }] } };
  const recorded = [];
  const store = { kind: "local", async record(rows) { recorded.push(...rows); }, async read() { return []; } };
  const response = await createHydroResponse({ now, store, fetchImpl: async url => String(url).includes("waterlevel") ? Response.json(raw) : new Response(null, { status: 503 }) });
  const payload = await response.json();
  assert.equal(payload.upstream.status, "degraded");
  assert.deepEqual(payload.upstream.upstream, { water: true, rain: false, dams: false });
  assert.equal(payload.historyStorage, "local");
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].id, "1");
  assert.equal(payload.upstream.basins[0].water[0].value, 101);
});

test("hydro API includes core Chao Phraya station rain without converting it into a basin average", async () => {
  const rain = { result: "OK", data: [{ basin: { basin_code: 10 }, station: { id: 9, tele_station_name: { th: "ฝนเจ้าพระยา" }, tele_station_lat: 13.7, tele_station_long: 100.5 }, rain_24h: 0, rainfall_datetime: "2026-10-02 11:50" }] };
  const response = await createHydroResponse({ now, fetchImpl: async url => String(url).includes("rain_24h") ? Response.json(rain) : new Response(null, { status: 503 }) });
  const payload = await response.json();
  assert.equal(payload.sources.rain, "live");
  assert.deepEqual(payload.centralRain.map(point => [point.name, point.mm]), [["ฝนเจ้าพระยา", 0]]);
  assert.equal(buildHydroBasins(payload, now)[0].peakRain.mm, 0);
});

test("scheduled collection includes full-basin upstream stations outside the old province filter", async () => {
  const raw = { waterlevel_data: { result: "OK", data: [{ basin: { basin_code: 6 }, station: { id: 1, tele_station_name: { th: "สถานีปิง" }, tele_station_lat: ping.lat, tele_station_long: ping.lng }, geocode: { province_code: 63, province_name: { th: "ตาก" } }, waterlevel_msl: 101, waterlevel_datetime: "2026-10-02 11:50" }] } };
  const recorded = [];
  const store = { kind: "local", async record(rows) { recorded.push(...rows); }, async read() { return []; } };
  const result = await collectWaterObservations(store, async () => Response.json(raw), now);
  assert.equal(result.stations, 1);
  assert.equal(recorded.length, 1);
});

test("provider outage reads a stored snapshot but expires its current signal against the clock", async () => {
  const raw = { waterlevel_data: { result: "OK", data: [{ basin: { basin_code: 6 }, station: { id: 1, tele_station_name: { th: "สถานีปิง" }, tele_station_lat: ping.lat, tele_station_long: ping.lng, min_bank: 100 }, geocode: { province_code: 63, province_name: { th: "ตาก" } }, waterlevel_msl: 101, storage_percent: 105, waterlevel_datetime: "2026-10-02 11:50" }] } };
  const saved = new Map();
  const store = { kind: "local", async record() {}, async read() { return []; }, async saveSnapshot(id, payload, receivedAt) { saved.set(id, { payload, receivedAt }); }, async readSnapshot(id) { return saved.get(id) ?? null; } };
  const first = await createHydroResponse({ now, store, fetchImpl: async url => String(url).includes("waterlevel") ? Response.json(raw) : new Response(null, { status: 503 }) });
  assert.equal((await first.json()).sources.water, "live");
  const later = await createHydroResponse({ now: now + 2 * 3600000, store, fetchImpl: async () => { throw new Error("offline"); } });
  const payload = await later.json();
  assert.equal(payload.sources.water, "last-known");
  assert.equal(payload.lastKnownAt.water, new Date(now).toISOString());
  assert.equal(payload.upstream.basins[0].water[0].observedAt, observedAt);
  const basins = buildHydroBasins(payload, now + 2 * 3600000);
  assert.equal(basins[1].freshWater, 0);
  assert.equal(basins[1].exceededWater, 0);
  assert.equal(basins[1].water[0].status, "stale");
});
