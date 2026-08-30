import assert from "node:assert/strict";
import test from "node:test";
import { createHeatForecastResponse, createMetroHeatForecastResponse } from "../../app/api/heat-forecast/route.ts";
import { calculateHeatIndexC, getHeatRisk } from "../../app/lib/heat-forecast-data.ts";
import { getProvincePoints } from "../../app/lib/provinces.ts";

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const dates = ["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"];
const times = dates.flatMap((date) => Array.from({ length: 24 }, (_, hour) => `${date}T${String(hour).padStart(2, "0")}:00`));

function heatRaw(pointCount = 9, missingCount = 0) {
  return Array.from({ length: pointCount }, (_, pointIndex) => ({
    latitude: 13.6 + pointIndex * 0.02,
    longitude: 100.3 + pointIndex * 0.02,
    hourly: {
      time: times,
      temperature_2m: times.map((time) => pointIndex < missingCount ? null : 30 + pointIndex * 0.2 + (Number(time.slice(11, 13)) === 14 ? 5 : 0)),
      relative_humidity_2m: times.map((time) => Number(time.slice(11, 13)) === 14 ? 70 : 60),
    },
  }));
}

function tmdHeatRaw() {
  const points = getProvincePoints("bangkok");
  const tmdTimes = times.slice(0, 48).map((time) => `${time}:00+07:00`);
  return { WeatherForecasts: points.map((point) => ({
    location: { lat: point.lat, lon: point.lng },
    forecasts: tmdTimes.map((time) => ({ time, data: { tc: 36, rh: 75 } })),
  })) };
}

test("Rothfusz Heat Index calculation uses same-hour temperature and humidity", () => {
  assert.ok(Math.abs(calculateHeatIndexC(32.2, 70) - 41.1) < 0.4);
  assert.ok(Math.abs(calculateHeatIndexC(35, 60) - 45.1) < 0.6);
});

test("Thai public-health Heat Index thresholds are exact at boundaries", () => {
  assert.equal(getHeatRisk(26.9).key, "normal");
  assert.equal(getHeatRisk(27).key, "watch");
  assert.equal(getHeatRisk(33).key, "warning");
  assert.equal(getHeatRisk(42).key, "danger");
  assert.equal(getHeatRisk(52).key, "extreme");
});

test("heat endpoint returns seven days and 56 three-hour windows for nine model points", async () => {
  const payload = await (await createHeatForecastResponse({ fetchImpl: async () => json(heatRaw()) })).json();
  assert.equal(payload.status, "live");
  assert.equal(payload.days.length, 7);
  assert.equal(payload.windows.length, 56);
  assert.equal(payload.points.length, 9);
  assert.ok(payload.points.every((point) => point.windows.length === 56));
  assert.ok(payload.days.every((day) => day.maxTemperatureC !== null && day.maxHeatIndexC !== null));
  assert.ok(payload.days[0].maxHeatIndexC > payload.days[0].maxTemperatureC);
  assert.equal(payload.windows[0].label, "00:00–03:00 น.");
  assert.equal(payload.windows[7].label, "21:00–00:00 น.");
  assert.ok(payload.windows[4].maxHeatIndexC > payload.windows[3].maxHeatIndexC);
  assert.equal(payload.windows[4].peakHour, "14:00 น.");
});

test("TMD temperature and humidity overlay the first 48 hours without exposing token", async () => {
  const requested = [];
  const payload = await (await createHeatForecastResponse({
    tmdToken: "heat-secret",
    fetchImpl: async (input, init = {}) => {
      requested.push({ url: String(input), authorization: new Headers(init.headers).get("authorization") });
      return String(input).includes("data.tmd.go.th") ? json(tmdHeatRaw()) : json(heatRaw());
    },
  })).json();
  assert.equal(payload.dataQuality.provider, "tmd-nwp-hybrid");
  assert.equal(payload.dataQuality.tmdStatus, "live");
  assert.equal(payload.dataQuality.tmdAcceptedPoints, 9);
  assert.ok(payload.days[0].maxHeatIndexC > 50);
  assert.ok(payload.windows.slice(0, 16).every((window) => window.maxHeatIndexC > 50));
  assert.ok(payload.windows[16].maxHeatIndexC < 50);
  assert.equal(requested.some((request) => request.url.includes("heat-secret")), false);
  assert.equal(requested.find((request) => request.url.includes("data.tmd.go.th")).authorization, "Bearer heat-secret");
});

test("heat endpoint fails over to GFS and rejects insufficient coverage", async () => {
  let calls = 0;
  const recovered = await (await createHeatForecastResponse({ fetchImpl: async () => ++calls === 1 ? json({}, 500) : json(heatRaw()) })).json();
  assert.equal(recovered.status, "live");
  assert.equal(recovered.dataQuality.provider, "gfs");
  const unavailable = await (await createHeatForecastResponse({ fetchImpl: async () => json(heatRaw(9, 4)) })).json();
  assert.equal(unavailable.status, "unavailable");
  assert.deepEqual(unavailable.points, []);
});

test("metro heat endpoint aggregates six provinces into 54 model points", async () => {
  let calls = 0;
  const payload = await (await createMetroHeatForecastResponse({ fetchImpl: async () => { calls += 1; return json(heatRaw()); }, tmdToken: null })).json();
  assert.equal(payload.province.id, "metro");
  assert.equal(payload.status, "live");
  assert.equal(payload.points.length, 54);
  assert.equal(payload.windows.length, 56);
  assert.ok(payload.points.every((point) => point.windows.length === 56));
  assert.equal(payload.dataQuality.expectedPoints, 54);
  assert.equal(calls, 6);
});
