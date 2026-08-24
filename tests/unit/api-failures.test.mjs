import assert from "node:assert/strict";
import test from "node:test";
import { createForecastResponse } from "../../app/api/forecast/route.ts";
import { createRainForecastResponse } from "../../app/api/rain-forecast/route.ts";

const NOW = Date.UTC(2026, 7, 21, 3);
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

function airPayload() {
  return { status: "Success", message: Array.from({ length: 24 }, (_, index) => ({
    MeasIndex: String(index + 1), District: `เขต${index + 1}`, Area: `สถานี ${index + 1}`,
    Lat: String(13.58 + (index % 6) * 0.07), Long: String(100.32 + Math.floor(index / 6) * 0.12),
    DateTime: "2026-08-21 09:00:00", Type: "sensor", "PM2.5": 20 + (index % 8),
  })) };
}

function air4ThaiPayload(count = 0, options = {}) {
  const areaTH = options.areaTH ?? "แขวงตัวอย่าง เขตตัวอย่าง, กรุงเทพฯ";
  const baseLat = options.baseLat ?? 13.62;
  const baseLng = options.baseLng ?? 100.32;
  return { stations: Array.from({ length: count }, (_, index) => ({
    stationID: `pcd-${index + 1}`,
    nameTH: `สถานี Air4Thai ${index + 1}`,
    areaTH,
    lat: String(baseLat + (index % 6) * 0.07),
    long: String(baseLng + Math.floor(index / 6) * 0.12),
    AQILast: { date: "2026-08-21", time: "09:00", PM25: { value: String(18 + (index % 6)) } },
  })) };
}
function camsPayload(hoursPerDay = 24) {
  const dates = ["2026-08-22", "2026-08-23", "2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"];
  const times = dates.flatMap((date) => Array.from({ length: hoursPerDay }, (_, hour) => `${date}T${String(hour).padStart(2, "0")}:00`));
  return Array.from({ length: 9 }, (_, index) => ({
    latitude: 13.64 + Math.floor(index / 3) * 0.16, longitude: 100.34 + (index % 3) * 0.27,
    current: { time: "2026-08-21T10:00", pm2_5: 22 }, hourly: { time: times, pm2_5: times.map(() => 25 + index) },
  }));
}

function weatherPayload() {
  const time = ["2026-08-22", "2026-08-23", "2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"];
  return { daily: { time, wind_speed_10m_max: time.map(() => 12), wind_direction_10m_dominant: time.map(() => 180), precipitation_probability_max: time.map(() => 40) } };
}

function forecastFetch(overrides = {}) {
  return async (input) => {
    const url = String(input);
    if (url.includes("official.airbkk.com")) return overrides.airbkk ?? json(airPayload());
    if (url.includes("air4thai.pcd.go.th")) return overrides.air4thai ?? json(air4ThaiPayload());    if (url.includes("air-quality-api")) return overrides.cams ?? json(camsPayload());
    if (url.includes("api.open-meteo.com/v1/forecast")) return overrides.weather ?? json(weatherPayload());
    throw new Error(`unexpected URL ${url}`);
  };
}

test("PM API is live when all sources are complete", async () => {
  const payload = await (await createForecastResponse({ fetchImpl: forecastFetch(), now: () => NOW })).json();
  assert.equal(payload.status, "live");
  assert.deepEqual(payload.dataQuality.upstream, { airbkk: "ok", air4thai: "ok", cams: "ok", weather: "ok" });
  assert.equal(payload.stations.length, 24);
  assert.equal(payload.days.length, 7);
  assert.ok(payload.stations.every((station) => station.values.length === 7));
});

test("weather timeout degrades PM forecast without hiding the heatmap data", async () => {
  const timeout = Promise.reject(new DOMException("timed out", "TimeoutError"));
  const payload = await (await createForecastResponse({ fetchImpl: forecastFetch({ weather: timeout }), now: () => NOW })).json();
  assert.equal(payload.status, "degraded");
  assert.equal(payload.dataQuality.upstream.weather, "timeout");
  assert.ok(payload.degradedReasons.includes("weather_unavailable"));
  assert.equal(payload.stations.length, 24);
});

test("metro PM forecast uses province CAMS grid without calling Bangkok stations", async () => {
  const requested = [];
  const fetchImpl = async (input) => {
    const url = String(input);
    requested.push(url);
    if (url.includes("air-quality-api")) return json(camsPayload());
    if (url.includes("api.open-meteo.com/v1/forecast")) return json(weatherPayload());
    throw new Error(`unexpected URL ${url}`);
  };
  const payload = await (await createForecastResponse({ fetchImpl, now: () => NOW, provinceId: "nonthaburi" })).json();
  assert.equal(payload.province.id, "nonthaburi");
  assert.equal(payload.dataMode, "cams-only");
  assert.equal(payload.status, "degraded");
  assert.equal(payload.stations.length, 9);
  assert.ok(payload.stations.every((station) => station.values.length === 7 && station.sourceType === "CAMS model grid"));
  assert.equal(requested.some((url) => url.includes("official.airbkk.com")), false);
});

test("Air4Thai replaces AirBKK observations when AirBKK times out", async () => {
  const timeout = Promise.reject(new DOMException("timed out", "TimeoutError"));
  const payload = await (await createForecastResponse({
    fetchImpl: forecastFetch({ airbkk: timeout, air4thai: json(air4ThaiPayload(24)) }),
    now: () => NOW,
  })).json();
  assert.equal(payload.status, "degraded");
  assert.equal(payload.dataMode, "air4thai-cams");
  assert.equal(payload.dataQuality.upstream.airbkk, "timeout");
  assert.equal(payload.dataQuality.air4thaiStations, 24);
  assert.equal(payload.stations.length, 24);
  assert.ok(payload.sources.includes("Air4Thai PCD observations"));
  assert.ok(payload.stations.every((station) => station.sourceType === "Air4Thai PCD"));
});
test("AirBKK timeout degrades to a CAMS-only Bangkok forecast", async () => {
  const timeout = Promise.reject(new DOMException("timed out", "TimeoutError"));
  const payload = await (await createForecastResponse({ fetchImpl: forecastFetch({ airbkk: timeout }), now: () => NOW })).json();
  assert.equal(payload.status, "degraded");
  assert.equal(payload.dataMode, "cams-only");
  assert.equal(payload.dataQuality.upstream.airbkk, "timeout");
  assert.ok(payload.degradedReasons.includes("airbkk_timeout"));
  assert.equal(payload.stations.length, 9);
  assert.ok(payload.stations.every((station) => station.sourceType === "CAMS model grid"));
  assert.ok(payload.days.every((day) => day.sourceMode !== "placeholder"));
});

test("CAMS timeout returns unavailable without demo values", async () => {
  const timeout = Promise.reject(new DOMException("timed out", "TimeoutError"));
  const payload = await (await createForecastResponse({ fetchImpl: forecastFetch({ cams: timeout }), now: () => NOW })).json();
  assert.equal(payload.status, "unavailable");
  assert.equal(payload.dataQuality.upstream.cams, "timeout");
  assert.deepEqual(payload.stations, []);
  assert.ok(payload.days.every((day) => day.sourceMode === "placeholder"));
  assert.equal("stack" in payload.dataQuality, false);
});
test("malformed AirBKK, HTTP 500, and partial CAMS coverage map to explicit states", async () => {
  const malformed = await (await createForecastResponse({ fetchImpl: forecastFetch({ airbkk: json({ status: "Success", message: null }) }), now: () => NOW })).json();
  assert.equal(malformed.status, "degraded");
  assert.equal(malformed.dataMode, "cams-only");
  assert.equal(malformed.dataQuality.upstream.airbkk, "error");
  const http500 = await (await createForecastResponse({ fetchImpl: forecastFetch({ airbkk: json({}, 500) }), now: () => NOW })).json();
  assert.equal(http500.status, "degraded");
  assert.equal(http500.dataMode, "cams-only");
  const partial = await (await createForecastResponse({ fetchImpl: forecastFetch({ cams: json(camsPayload(4)) }), now: () => NOW })).json();
  assert.equal(partial.status, "degraded");
  assert.ok(partial.degradedReasons.includes("cams_partial_coverage"));
});

test("a genuinely hanging PM upstream is aborted within the configured timeout", async () => {
  const hanging = (_input, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true }));
  const started = performance.now();
  const payload = await (await createForecastResponse({ fetchImpl: hanging, now: () => NOW, timeouts: { airbkk: 20, air4thai: 20, cams: 20, weather: 20 } })).json();
  assert.equal(payload.status, "unavailable");
  assert.ok(performance.now() - started < 500);
});

function rainRaw(pointCount = 9, corruptCount = 0) {
  const dates = ["2026-08-21", "2026-08-22", "2026-08-23", "2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27"];
  const times = dates.flatMap((date) => Array.from({ length: 24 }, (_, hour) => `${date}T${String(hour).padStart(2, "0")}:00`));
  return Array.from({ length: pointCount }, (_, index) => {
    const values = times.map(() => index < corruptCount ? null : 1);
    return { latitude: 13.64, longitude: 100.34, hourly: { time: times, precipitation_probability: times.map(() => 60), precipitation: values, rain: values, showers: times.map(() => 0), weather_code: times.map(() => 61) }, daily: { time: dates, precipitation_sum: dates.map(() => 5), precipitation_probability_max: dates.map(() => 60), precipitation_hours: dates.map(() => 4), weather_code: dates.map(() => 61) } };
  });
}

test("rain provider failover uses GFS after Best Match fails", async () => {
  let calls = 0;
  const response = await createRainForecastResponse({ fetchImpl: async () => ++calls === 1 ? json({}, 500) : json(rainRaw(9)) });
  const payload = await response.json();
  assert.equal(payload.status, "live");
  assert.equal(payload.dataQuality.provider, "gfs");
  assert.equal(payload.dataQuality.providerFallback, true);
  assert.equal(payload.days.length, 7);
  assert.equal(payload.windows.length, 56);
  assert.ok(payload.points.every((point) => point.daily.length === 7));
});

test("rain forecast uses coordinates and metadata for the selected metro province", async () => {
  let requestedUrl = "";
  const response = await createRainForecastResponse({
    provinceId: "samut-sakhon",
    fetchImpl: async (input) => { requestedUrl = String(input); return json(rainRaw(9)); },
  });
  const payload = await response.json();
  assert.equal(payload.province.id, "samut-sakhon");
  assert.equal(payload.points.length, 9);
  assert.match(payload.model, /Samut Sakhon/);
  assert.match(requestedUrl, /latitude=/);
  assert.doesNotMatch(requestedUrl, /13\.64%2C13\.64%2C13\.64/);
});

test("rain coverage yields live at 9, degraded at 6-8, and unavailable below 6", async () => {
  for (const [count, expected] of [[9, "live"], [7, "degraded"], [5, "unavailable"]]) {
    const response = await createRainForecastResponse({ fetchImpl: async () => json(rainRaw(count)) });
    assert.equal((await response.json()).status, expected);
  }
});

test("rain returns unavailable when both providers fail or hourly values are missing", async () => {
  const bothFail = await (await createRainForecastResponse({ fetchImpl: async () => json({}, 500) })).json();
  assert.equal(bothFail.status, "unavailable");
  const missing = await (await createRainForecastResponse({ fetchImpl: async () => json(rainRaw(9, 4)) })).json();
  assert.equal(missing.status, "unavailable");
});
