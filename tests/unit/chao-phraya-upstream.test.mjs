import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUpstream, upstreamSummary } from "../../app/lib/chao-phraya-upstream.ts";
import { createUpstreamResponse } from "../../app/api/chao-phraya-upstream/route.ts";

const now = Date.parse("2026-10-02T12:00:00+07:00");
const station = { id: 1, tele_station_name: { th: "สถานีปิง" }, tele_station_lat: 17.241944, tele_station_long: 98.971456, min_bank: 100, ground_level: 90 };
const basin = { basin_code: 6 };
const rain = (overrides = {}) => ({ basin, station, rain_24h: 0, rainfall_datetime: "2026-10-02 11:50", ...overrides });
const water = (overrides = {}) => ({ basin, station, waterlevel_msl: 101, storage_percent: 105, waterlevel_datetime: "2026-10-02 11:50", geocode: { province_code: 63, province_name: { th: "ตาก" } }, ...overrides });
const dam = (overrides = {}) => ({ basin, dam: { id: 1, dam_name: { th: "ภูมิพล" }, dam_lat: station.tele_station_lat, dam_long: station.tele_station_long }, dam_date: "2026-10-02", dam_storage_percent: 66.66, dam_inflow: 69.31, dam_released: 0, ...overrides });
const sources = (r = [rain()], w = [water()], d = [dam()]) => ({ rain: { result: "OK", data: r }, water: { waterlevel_data: { result: "OK", data: w } }, dams: { data: { dam_daily: d } } });

test("six upstream basins preserve observation times and daily reservoir units including zero release", () => {
  const payload = normalizeUpstream(sources(), now);
  assert.equal(payload.status, "live");
  assert.equal(payload.basins.length, 6);
  const ping = payload.basins[0], summary = upstreamSummary(ping, now);
  assert.equal(summary.peakRain.mm, 0);
  assert.equal(summary.peakRain.observedAt, "2026-10-02T04:50:00.000Z");
  assert.equal(summary.waterAttention, 1);
  assert.equal(summary.assessedCount, 1);
  assert.equal(summary.dams[0].inflowMillionM3, 69.31);
  assert.equal(summary.dams[0].releasedMillionM3, 0);
  assert.equal(summary.dams[0].date, "2026-10-02");
  assert.equal(upstreamSummary(payload.basins[1], now).peakRain, null);
});

test("wrong basin geometry, malformed values, stale and future dates cannot produce current signals", () => {
  const payload = normalizeUpstream(sources([
    rain({ basin: { basin_code: 7 } }), rain({ rainfall_datetime: "2026-10-02 07:00" }),
    rain({ rainfall_datetime: "2026-10-02 13:00" }), rain({ rain_24h: null }), rain({ rain_24h: true }),
  ], [water({ waterlevel_datetime: "2026-10-02 09:00" }), water({ station: { ...station, id: 2 }, waterlevel_msl: null, waterlevel_m: null })], [
    dam({ dam_date: "2026-10-03" }), dam({ dam_date: "2026-09-30" }), dam({ dam_date: "2026-02-30" }),
  ]), now);
  const summary = upstreamSummary(payload.basins[0], now);
  assert.equal(summary.peakRain, null);
  assert.equal(summary.waterAttention, 0);
  assert.equal(summary.assessedCount, 0);
  assert.equal(summary.waterCount, 0);
  assert.equal(summary.dams.length, 0);
  assert.equal(payload.basins[1].rain.length, 0);
  assert.equal(upstreamSummary(payload.basins[0], now + 86400000).waterCount, 0);
});

test("latest duplicate wins while invalid future records cannot displace valid measurements", () => {
  const payload = normalizeUpstream(sources([
    rain({ rain_24h: 10 }), rain({ rain_24h: 20, rainfall_datetime: "2026-10-02 11:55" }), rain({ rain_24h: 900, rainfall_datetime: "2026-10-02 13:00" }),
  ], [water(), water({ waterlevel_msl: 90, waterlevel_datetime: "2026-10-02 11:55" })], [dam({ dam_date: "2026-10-01", dam_released: 12 }), dam()]), now);
  assert.equal(payload.basins[0].rain.length, 1);
  assert.equal(payload.basins[0].rain[0].mm, 20);
  assert.equal(payload.basins[0].water[0].value, 90);
  assert.equal(payload.basins[0].dams[0].releasedMillionM3, 0);
  assert.equal(upstreamSummary(payload.basins[0], now + 4 * 3600000).peakRain, null);
  assert.equal(upstreamSummary(payload.basins[0], now + 48 * 3600000).dams.length, 0);
});

test("independent provider failure retains available feeds; total failure is uncached and missing", async () => {
  const fixture = sources();
  const partial = await createUpstreamResponse({ now, fetchImpl: async url => {
    if (String(url).includes("waterlevel")) throw new Error("offline");
    return Response.json(String(url).includes("rain_24h") ? fixture.rain : fixture.dams);
  } });
  const payload = await partial.json();
  assert.equal(payload.status, "degraded");
  assert.deepEqual(payload.upstream, { water: false, rain: true, dams: true });
  assert.equal(payload.basins[0].water.length, 0);
  assert.equal(payload.basins[0].rain[0].mm, 0);
  const failed = await createUpstreamResponse({ now, fetchImpl: async () => { throw new Error("offline"); } });
  assert.equal(failed.headers.get("Cache-Control"), "no-store");
  assert.equal((await failed.json()).status, "unavailable");
});

test("cross-agency reservoir aliases count once; contradictory storage zero is missing without discarding zero release", () => {
  const duplicate = dam({
    dam: { id: 43, dam_name: { th: "เขื่อนภูมิพล" }, dam_lat: 17.241944, dam_long: 98.975278 },
    dam_date: "2026-10-01", dam_storage: 9020.41, dam_storage_percent: 0,
  });
  for (const records of [[duplicate, dam()], [dam(), duplicate]]) {
    const ping = normalizeUpstream(sources([], [], records), now).basins[0];
    assert.equal(ping.dams.length, 1);
    assert.equal(ping.dams[0].date, "2026-10-02");
    assert.equal(ping.dams[0].storagePercent, 66.66);
  }
  const point = normalizeUpstream(sources([], [], [duplicate]), now).basins[0].dams[0];
  assert.equal(point.storagePercent, null);
  assert.equal(point.releasedMillionM3, 0);
  const empty = normalizeUpstream(sources([], [], [dam({ dam_storage: 0, dam_storage_percent: 0 })]), now).basins[0].dams[0];
  assert.equal(empty.storagePercent, 0);
  const other = dam({ dam: { id: 2, dam_name: { th: "ภูมิพลสอง" }, dam_lat: 17.261944, dam_long: 98.971456 } });
  assert.equal(normalizeUpstream(sources([], [], [dam(), other]), now).basins[0].dams.length, 2);
});
