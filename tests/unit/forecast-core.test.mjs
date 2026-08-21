import assert from "node:assert/strict";
import test from "node:test";
import { parseBangkokTimestamp } from "../../app/lib/forecast/timestamps.ts";
import { deduplicateStations, filterFreshStations, filterOutliers, isValidStation } from "../../app/lib/forecast/quality-control.ts";
import { spatialIdw } from "../../app/lib/forecast/interpolation.ts";
import { buildCamsDailyForecast, calculateReliabilityScore } from "../../app/lib/forecast/forecast-model.ts";

test("Bangkok timestamps parse to UTC across midnight and reject invalid input", () => {
  assert.equal(parseBangkokTimestamp("2026-08-21 00:00:00"), Date.UTC(2026, 7, 20, 17));
  assert.equal(parseBangkokTimestamp("2026-08-21 00:15"), Date.UTC(2026, 7, 20, 17, 15));
  assert.ok(Number.isNaN(parseBangkokTimestamp("not-a-timestamp")));
});

test("station validation rejects stale, future, negative, excessive, and duplicate records", () => {
  const now = Date.UTC(2026, 7, 21, 3);
  const base = { id: "A", lat: 13.75, lng: 100.5, pm25: 25, timestamp: now - 60_000 };
  assert.equal(isValidStation({ ...base, pm25: -1 }), false);
  assert.equal(isValidStation({ ...base, pm25: 501 }), false);
  assert.equal(filterFreshStations([{ ...base, timestamp: now - 7 * 3_600_000 }], now).rejected, 1);
  assert.equal(filterFreshStations([{ ...base, timestamp: now + 2 * 3_600_000 }], now).rejected, 1);
  const deduplicated = deduplicateStations([base, { ...base, pm25: 30, timestamp: now }]);
  assert.equal(deduplicated.rejected, 1);
  assert.equal(deduplicated.records[0].pm25, 30);
});

test("outlier QC retains a locally corroborated hotspot", () => {
  const ordinary = Array.from({ length: 8 }, (_, index) => ({ id: `n${index}`, lat: 13.6 + index * 0.04, lng: 100.3, pm25: 20 + index, timestamp: 1 }));
  const hotspot = [0, 1, 2].map((index) => ({ id: `h${index}`, lat: 13.9 + index * 0.001, lng: 100.7, pm25: 115 + index, timestamp: 1 }));
  const result = filterOutliers([...ordinary, ...hotspot]);
  assert.ok(result.records.some((record) => record.id === "h1"));
});

test("IDW returns the station value, a finite midpoint, and null without anchors", () => {
  const anchors = [{ lat: 13.7, lng: 100.5, value: 20 }, { lat: 13.9, lng: 100.7, value: 40 }];
  assert.equal(spatialIdw(13.7, 100.5, anchors), 20);
  assert.ok(Number.isFinite(spatialIdw(13.8, 100.6, anchors)));
  assert.equal(spatialIdw(13.8, 100.6, []), null);
});

test("CAMS aggregation reports full and partial coverage and extrapolates safely with null current", () => {
  const dates = ["2026-08-22", "2026-08-23"];
  const fullTimes = dates.flatMap((date) => Array.from({ length: 24 }, (_, hour) => `${date}T${String(hour).padStart(2, "0")}:00`));
  const full = buildCamsDailyForecast({ current: 20, hourly: { time: fullTimes, pm2_5: fullTimes.map(() => 30) } }, dates);
  assert.deepEqual(full.coverage, [24, 24]);
  assert.deepEqual(full.extrapolated, [false, false]);
  const partialTimes = Array.from({ length: 4 }, (_, hour) => `${dates[0]}T0${hour}:00`);
  const partial = buildCamsDailyForecast({ current: null, hourly: { time: partialTimes, pm2_5: [10, 11, 12, 13] } }, dates);
  assert.deepEqual(partial.coverage, [4, 0]);
  assert.deepEqual(partial.extrapolated, [true, true]);
  assert.ok(partial.values.every(Number.isFinite));
});

test("reliability score decreases with lead time, missing sources, low coverage, and older observations", () => {
  const high = calculateReliabilityScore({ leadDays: 1, sourceAvailability: 1, camsCoverageHours: 24, observationAgeHours: 0 });
  const low = calculateReliabilityScore({ leadDays: 5, sourceAvailability: 2 / 3, camsCoverageHours: 4, observationAgeHours: 6 });
  assert.ok(high > low);
  assert.ok(high <= 95 && low >= 20);
});
