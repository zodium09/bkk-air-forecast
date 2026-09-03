import assert from "node:assert/strict";
import test from "node:test";
import { createForecastResponse, createMetroForecastResponse } from "../../app/api/forecast/route.ts";
import { createMetroRainForecastResponse, createRainForecastResponse } from "../../app/api/rain-forecast/route.ts";

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

test("metro PM endpoint uses one regional CAMS domain and one Air4Thai download", async () => {
  const requested = [];
  const baseFetch = forecastFetch({
    air4thai: json(air4ThaiPayload(1, {
      areaTH: "ต.หน้าเมือง อ.เมือง, ราชบุรี",
      baseLat: 13.53,
      baseLng: 99.82,
    })),
  });
  const payload = await (await createMetroForecastResponse({
    fetchImpl: async (input, init) => {
      requested.push(String(input));
      return baseFetch(input, init);
    },
    now: () => NOW,
  })).json();
  assert.equal(payload.province.id, "metro");
  assert.equal(payload.dataQuality.provinceCoverage, 6);
  assert.equal(payload.stations.length, 54);
  assert.equal(payload.dataQuality.windMethod, "anisotropic upwind residual interpolation");
  assert.equal(payload.dataQuality.analysisDomain.includes("ราชบุรี"), true);
  assert.equal(payload.dataQuality.analysisDomain.includes("ฉะเชิงเทรา"), true);
  assert.equal(payload.dataQuality.air4thaiRegionalStations, 1);
  assert.ok(payload.dataQuality.regionalObservationStations >= 1);
  assert.equal(payload.days[0].year, 2569);
  assert.equal(requested.filter((url) => url.includes("air4thai.pcd.go.th")).length, 1);
  assert.equal(requested.filter((url) => url.includes("air-quality-api")).length, 1);
  assert.equal(requested.filter((url) => url.includes("api.open-meteo.com/v1/forecast")).length, 1);
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

function localizedRainRaw() {
  return rainRaw(9).map((location, index) => {
    const probability = index === 0 ? 100 : 0;
    const rain = index === 0 ? 1 : 0;
    return {
      ...location,
      hourly: {
        ...location.hourly,
        precipitation_probability: location.hourly.time.map(() => probability),
        precipitation: location.hourly.time.map(() => rain),
        rain: location.hourly.time.map(() => rain),
      },
      daily: {
        ...location.daily,
        precipitation_probability_max: location.daily.time.map(() => probability),
        precipitation_sum: location.daily.time.map(() => rain * 24),
        precipitation_hours: location.daily.time.map(() => rain ? 24 : 0),
      },
    };
  });
}

function tmdRainRaw(value = 2) {
  const dates = ["2026-08-21", "2026-08-22"];
  const times = dates.flatMap((date) => Array.from({ length: 24 }, (_, hour) => `${date}T${String(hour).padStart(2, "0")}:00:00+07:00`));
  return { WeatherForecasts: Array.from({ length: 9 }, (_, index) => ({
    location: { lat: 13.64 + Math.floor(index / 3) * 0.16, lon: 100.34 + (index % 3) * 0.27 },
    forecasts: times.map((time) => ({ time, data: { rain: value, cond: 6 } })),
  })) };
}

function tmdDailyRainRaw(value = 18) {
  const dates = ["2026-08-21", "2026-08-22", "2026-08-23", "2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27"];
  return { weather_forecast: { locations: Array.from({ length: 9 }, (_, index) => ({
    location: { lat: 13.64 + Math.floor(index / 3) * 0.16, lon: 100.34 + (index % 3) * 0.27 },
    forecasts: dates.map((time, dayIndex) => ({ time: `${time}T00:00:00+07:00`, data: { rain: value + dayIndex } })),
  })) } };
}

test("TMD NWP overlays rainfall without exposing the token in the URL", async () => {
  const requested = [];
  const response = await createRainForecastResponse({
    tmdToken: "test-secret-token",
    now: () => NOW,
    fetchImpl: async (input, init = {}) => {
      requested.push({ url: String(input), authorization: new Headers(init.headers).get("authorization") });
      return String(input).includes("data.tmd.go.th") ? json(tmdRainRaw()) : json(rainRaw(9));
    },
  });
  const payload = await response.json();
  assert.equal(payload.status, "live");
  assert.equal(payload.dataQuality.provider, "tmd-nwp-hybrid");
  assert.equal(payload.dataQuality.tmdStatus, "live");
  assert.equal(payload.dataQuality.tmdAcceptedPoints, 9);
  assert.equal(payload.dataQuality.tmdCadenceHours, 1);
  assert.equal(payload.dataQuality.tmdProduct, "hourly-48h");
  assert.equal(payload.days.length, 2);
  assert.equal(payload.windows.length, 16);
  assert.equal(payload.days[0].rainMeanMm, 48);
  assert.ok(payload.sources.includes("กรมอุตุนิยมวิทยา (TMD NWP)"));
  assert.equal(requested.some((request) => request.url.includes("test-secret-token")), false);
  assert.equal(requested.filter((request) => request.url.includes("data.tmd.go.th")).length, 3);
  assert.equal(requested.find((request) => request.url.includes("data.tmd.go.th")).authorization, "Bearer test-secret-token");
});

test("TMD NWP failure falls back to Open-Meteo without hiding the forecast", async () => {
  const payload = await (await createRainForecastResponse({
    tmdToken: "expired-token",
    fetchImpl: async (input) => String(input).includes("data.tmd.go.th") ? json({}, 401) : json(rainRaw(9)),
  })).json();
  assert.equal(payload.status, "live");
  assert.equal(payload.dataQuality.provider, "best-match");
  assert.equal(payload.dataQuality.providerFallback, true);
  assert.equal(payload.dataQuality.tmdStatus, "unavailable");
  assert.equal(payload.dataQuality.tmdFailureReason, "http_401");
  assert.equal(payload.points.length, 9);
});

test("TMD Daily supplies seven days of 24-hour accumulated rainfall", async () => {
  const requested = [];
  const payload = await (await createRainForecastResponse({
    forecastMode: "accumulation",
    forecastSource: "tmd",
    tmdToken: "daily-token",
    fetchImpl: async (input, init = {}) => {
      requested.push({ url: String(input), authorization: new Headers(init.headers).get("authorization") });
      return String(input).includes("/daily/at") ? json(tmdDailyRainRaw()) : json(rainRaw(9));
    },
  })).json();
  assert.equal(payload.status, "live");
  assert.equal(payload.days.length, 7);
  assert.equal(payload.dataQuality.requestedMode, "accumulation");
  assert.equal(payload.dataQuality.provider, "tmd-nwp-daily");
  assert.equal(payload.dataQuality.tmdProduct, "daily-7d");
  assert.equal(payload.days[0].rainMeanMm, 18);
  assert.equal(payload.days[6].rainMeanMm, 24);
  assert.equal(requested.filter((request) => request.url.includes("/daily/at")).length, 3);
  assert.ok(requested.filter((request) => request.url.includes("/daily/at")).every((request) => request.url.includes("duration=7")));
  assert.equal(requested.find((request) => request.url.includes("/daily/at")).authorization, "Bearer daily-token");
});

test("Open-Meteo rain mode bypasses TMD even when a TMD token is configured", async () => {
  const requested = [];
  const payload = await (await createRainForecastResponse({
    forecastSource: "open-meteo",
    tmdToken: "configured-token",
    fetchImpl: async (input) => {
      requested.push(String(input));
      return json(rainRaw(9));
    },
  })).json();
  assert.equal(payload.status, "live");
  assert.equal(payload.dataQuality.requestedSource, "open-meteo");
  assert.equal(payload.dataQuality.provider, "best-match");
  assert.equal(payload.dataQuality.providerFallback, false);
  assert.equal(payload.dataQuality.tmdStatus, "not-configured");
  assert.equal(requested.some((url) => url.includes("data.tmd.go.th")), false);
});

test("rain provider failover uses GFS after Best Match fails", async () => {
  let calls = 0;
  const response = await createRainForecastResponse({ forecastSource: "open-meteo", fetchImpl: async () => ++calls === 1 ? json({}, 500) : json(rainRaw(9)) });
  const payload = await response.json();
  assert.equal(payload.status, "live");
  assert.equal(payload.dataQuality.provider, "gfs");
  assert.equal(payload.dataQuality.providerFallback, true);
  assert.equal(payload.days.length, 7);
  assert.equal(payload.windows.length, 56);
  assert.equal(payload.windows[0].label, "00.00");
  assert.equal(payload.windows[7].label, "21.00");
  assert.ok(payload.points.every((point) => point.daily.length === 7));
});

test("metro rain endpoint consolidates six province forecasts into 54 points", async () => {
  let calls = 0;
  const payload = await (await createMetroRainForecastResponse({
    fetchImpl: async () => { calls += 1; return json(rainRaw(9)); },
  })).json();
  assert.equal(payload.province.id, "metro");
  assert.equal(payload.status, "live");
  assert.equal(payload.points.length, 54);
  assert.equal(payload.dataQuality.expectedPoints, 54);
  assert.equal(calls, 6);
});

test("an isolated 100% rain point does not become a 100% province-wide summary", async () => {
  const payload = await (await createRainForecastResponse({
    fetchImpl: async () => json(localizedRainRaw()),
  })).json();
  assert.equal(payload.points[0].windows[0].pointProbabilityPeak, 100);
  assert.equal(payload.windows[0].areaMeanProbabilityPeak, 11);
  assert.equal(payload.days[0].dailyAreaMeanProbability, 11);
});

test("daily rain chance is the all-hour mean rather than the daily maximum", async () => {
  const raw = rainRaw(9).map((location) => ({
    ...location,
    hourly: {
      ...location.hourly,
      precipitation_probability: location.hourly.time.map((_, index) => index % 24 === 0 ? 100 : 0),
    },
    daily: { ...location.daily, precipitation_probability_max: location.daily.time.map(() => 100) },
  }));
  const payload = await (await createRainForecastResponse({ forecastSource: "open-meteo", fetchImpl: async () => json(raw) })).json();
  assert.equal(payload.days[0].dailyAreaMeanProbability, 4);
  assert.notEqual(payload.days[0].dailyAreaMeanProbability, 100);
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
