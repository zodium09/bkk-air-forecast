import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAtmosphere, meanWindDirection, coldWindSignal } from "../../app/lib/air-atmosphere.ts";
import { atmosphereRequest, atmosphereCacheTtl, buildAtmosphereUrl, createAtmosphereResponse } from "../../app/api/air-atmosphere/route.ts";

const now = Date.parse("2026-10-02T10:00:00+07:00");
const point = { lat: 13.76, lng: 100.5 };
function fixture() {
  const time = Array.from({ length: 264 }, (_, i) => new Date(Date.parse("2026-09-30T00:00:00Z") + i * 3600000).toISOString().slice(0, 16));
  return { latitude: 13.765, longitude: 100.5469, utc_offset_seconds: 25200,
    hourly_units: { temperature_2m: "°C", relative_humidity_2m: "%", precipitation: "mm", wind_speed_10m: "km/h", wind_direction_10m: "°", pressure_msl: "hPa", boundary_layer_height: "m" },
    hourly: { time, temperature_2m: time.map(t => t.startsWith("2026-10-03") ? 24 : 27), relative_humidity_2m: time.map(() => 75), precipitation: time.map(() => 0), wind_speed_10m: time.map(() => 10), wind_direction_10m: time.map(() => 45), pressure_msl: time.map(t => t.startsWith("2026-10-03") ? 1015 : 1012), boundary_layer_height: time.map(() => 250) },
  };
}
test("weather preserves exact units, forecast grid, true zero and source coverage", () => {
  const data = normalizeAtmosphere(fixture(), point, now);
  assert.equal(data.status, "live");
  assert.equal(data.days.length, 10);
  assert.deepEqual(data.grid, { lat: 13.765, lng: 100.5469 });
  assert.equal(data.days.find(d => d.date === "2026-10-02").rainMm, 0);
  assert.equal(data.days.find(d => d.date === "2026-10-02").windKmh, 10);
  assert.equal(data.days.find(d => d.date === "2026-10-02").coverage.rainMm, 24);
});
test("daily rain aligns preceding-hour totals from 01:00 through next midnight", () => {
  const raw = fixture();
  raw.hourly.precipitation[raw.hourly.time.indexOf("2026-10-02T00:00")] = 9;
  raw.hourly.precipitation[raw.hourly.time.indexOf("2026-10-03T00:00")] = 2;
  const data = normalizeAtmosphere(raw, point, now);
  assert.equal(data.days.find(d => d.date === "2026-10-02").rainMm, 2);
  assert.equal(data.days.find(d => d.date === "2026-10-01").rainMm, 9);
  raw.hourly.precipitation[raw.hourly.time.indexOf("2026-10-02T05:00")] = null;
  assert.equal(normalizeAtmosphere(raw, point, now).days.find(d => d.date === "2026-10-02").rainMm, null);
});
test("circular mean handles north crossing, cancellation and calm without fabricated direction", () => {
  assert.ok(meanWindDirection(Array.from({ length: 24 }, (_, i) => ({ windKmh: 10, windFromDeg: i % 2 ? 359 : 1 }))) < 0.01);
  assert.equal(meanWindDirection(Array.from({ length: 24 }, (_, i) => ({ windKmh: 10, windFromDeg: i % 2 ? 180 : 0 }))), null);
  assert.equal(meanWindDirection(Array.from({ length: 24 }, () => ({ windKmh: 0, windFromDeg: 0 }))), null);
});
test("incomplete coverage, invalid values, wrong units and UTC times remain missing", () => {
  const raw = fixture();
  raw.hourly_units.wind_speed_10m = "m/s";
  assert.equal(normalizeAtmosphere(raw, point, now).days[2].windKmh, null);
  raw.hourly_units.wind_speed_10m = "km/h";
  raw.hourly.wind_speed_10m = raw.hourly.time.map(t => t.startsWith("2026-10-02") && Number(t.slice(11, 13)) > 16 ? null : 10);
  assert.equal(normalizeAtmosphere(raw, point, now).days[2].windKmh, null);
  raw.utc_offset_seconds = 0;
  assert.equal(normalizeAtmosphere(raw, point, now).status, "unavailable");
  assert.equal(normalizeAtmosphere(null, point, now).days[2].humidityPct, null);
  raw.utc_offset_seconds = 25200;
  raw.hourly.relative_humidity_2m[48] = 101;
  raw.hourly.temperature_2m[48] = "27";
  const data = normalizeAtmosphere(raw, point, now);
  assert.equal(data.hours[48].humidityPct, null);
  assert.equal(data.hours[48].temperatureC, null);
});
test("cold-wind heuristic requires northerly flow, cooling and rising pressure together", () => {
  const data = normalizeAtmosphere(fixture(), point, now), previous = data.days[2], day = data.days[3];
  assert.equal(coldWindSignal(day, previous).status, "signal");
  assert.equal(coldWindSignal({ ...day, morningMinC: 27 }, previous).status, "northerly");
  assert.equal(coldWindSignal({ ...day, northerlyFraction: 0 }, previous).status, "none");
  assert.equal(coldWindSignal({ ...day, pressureHpa: null }, previous).status, "unknown");
  assert.equal(coldWindSignal(day, { ...previous, date: "2026-09-30" }).status, "unknown");
});
test("stagnation uses paired wind/layer readings and exposes incomplete denominator", () => {
  const raw = fixture(); raw.hourly.wind_speed_10m.fill(3);
  raw.hourly.boundary_layer_height[48] = null;
  const day = normalizeAtmosphere(raw, point, now).days[2];
  assert.equal(day.stagnantHours, 23); assert.equal(day.mixingHours, 23);
});
test("request validation bounds coordinates, normalizes cache identity and requests the actual GFS fields", () => {
  const a = atmosphereRequest(new URL("http://localhost/api/air-atmosphere?lat=13.7563&lng=100.5018"));
  const b = atmosphereRequest(new URL("http://localhost/api/air-atmosphere?lat=13.757&lng=100.5019&irrelevant=x"));
  assert.equal(a.key, b.key);
  for (const query of ["lat=&lng=100.5", "lat=13.75", "province=unknown", "lat=90&lng=180", "lat=NaN&lng=100.5"]) assert.equal(atmosphereRequest(new URL(`http://localhost/?${query}`)), null);
  const url = new URL(buildAtmosphereUrl(point));
  assert.equal(url.searchParams.get("timezone"), "Asia/Bangkok");
  assert.equal(url.searchParams.get("wind_speed_unit"), "kmh");
  assert.match(url.searchParams.get("hourly"), /boundary_layer_height/);
});
test("API failure never invents weather, rejects bad input without upstream fetch and avoids caching missing data", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error("offline"); };
  const bad = await createAtmosphereResponse(new Request("http://localhost/api/air-atmosphere?lat=0&lng=0"), { fetchImpl, now: () => now });
  assert.equal(bad.status, 400); assert.equal(calls, 0);
  const response = await createAtmosphereResponse(new Request("http://localhost/api/air-atmosphere"), { fetchImpl, now: () => now });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal((await response.json()).status, "unavailable");
  const live = await createAtmosphereResponse(new Request("http://localhost/api/air-atmosphere"), { fetchImpl: async () => Response.json(fixture()), now: () => now });
  assert.equal((await live.json()).status, "live");
});
test("weather cache expires at Bangkok midnight rather than holding yesterday's horizon", () => {
  assert.equal(atmosphereCacheTtl(now), 900);
  assert.equal(atmosphereCacheTtl(Date.parse("2026-10-02T23:59:40+07:00")), 20);
});
