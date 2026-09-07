import assert from "node:assert/strict";
import test from "node:test";
import { environmentRequest, indexForDate, timelineIndices, timelineKeyIndex, nextTimelineIndex } from "../../app/lib/dashboard-controls.ts";
import { normalizeWeather } from "../../app/lib/map-intelligence.ts";
const steps = [
  { key: "d1", date: "2026-09-07", window: null },
  { key: "d1:0", date: "2026-09-07", window: 0 },
  { key: "d1:1", date: "2026-09-07", window: 1 },
  { key: "d2", date: "2026-09-08", window: null },
  { key: "d2:0", date: "2026-09-08", window: 0 },
];
test("provider filters and rain metrics have distinct requests and cache identities", () => {
  const rain = environmentRequest("rain", "bangkok", "forecast", "tmd", "primary");
  assert.equal(rain.url, "/api/rain-forecast?province=bangkok&source=tmd&mode=chance");
  const accumulated = environmentRequest("rain", "bangkok", "forecast", "tmd", "secondary");
  assert.match(accumulated.url, /mode=accumulation$/);
  assert.notEqual(rain.key, accumulated.key);
  assert.notEqual(rain.key, environmentRequest("rain", "bangkok", "forecast", "open-meteo", "primary").key);
  assert.notEqual(rain.key, environmentRequest("rain", "metro", "forecast", "tmd", "primary").key);
  assert.equal(environmentRequest("heat", "metro", "estimate", "open-meteo", "primary").url, "/api/heat-forecast?province=metro&source=open-meteo");
  assert.equal(environmentRequest("air", "metro", "forecast", "tmd", "primary").key, environmentRequest("air", "metro", "forecast", "open-meteo", "primary").key);
  assert.notEqual(environmentRequest("air", "metro", "forecast", "tmd", "primary").key, environmentRequest("air", "metro", "observation", "tmd", "primary").key);
});
test("slider and playback retain cadence across day boundaries and wrap safely", () => {
  assert.deepEqual(timelineIndices(steps, 0), [0, 3]);
  assert.deepEqual(timelineIndices(steps, 1), [1, 2, 4]);
  assert.equal(nextTimelineIndex(steps, 0), 3);
  assert.equal(nextTimelineIndex(steps, 3), 0);
  assert.equal(nextTimelineIndex(steps, 2), 4);
  assert.equal(nextTimelineIndex(steps, 4), 1);
  assert.equal(nextTimelineIndex([], 0), 0);
});
test("date filter preserves time when present and falls back to an available day", () => {
  assert.equal(indexForDate(steps, 1, "2026-09-08"), 4);
  assert.equal(indexForDate(steps, 2, "2026-09-08"), 3);
  assert.equal(indexForDate(steps, 0, "2026-09-09"), -1);
});
test("keyboard boundaries, jumps and unrelated form keys are handled", () => {
  assert.equal(timelineKeyIndex("ArrowLeft", 0, 56), 0);
  assert.equal(timelineKeyIndex("ArrowRight", 55, 56), 55);
  assert.equal(timelineKeyIndex("Home", 25, 56), 0);
  assert.equal(timelineKeyIndex("End", 25, 56), 55);
  assert.equal(timelineKeyIndex("PageUp", 3, 56), 11);
  assert.equal(timelineKeyIndex("PageDown", 3, 56), 0);
  assert.equal(timelineKeyIndex("Tab", 3, 56), null);
  assert.equal(timelineKeyIndex("Home", 0, 0), null);
});
test("TMD daily totals do not expose hourly detail the source did not supply", () => {
  const payload = { status: "live", fetchedAt: "", model: "TMD", sources: [], disclaimer: "", dataQuality: { tmdProduct: "daily-7d", tmdStatus: "live" }, days: [{ dateKey: "2026-09-07" }], windows: [{ dayIndex: 0, windowIndex: 0, start: "00:00", end: "03:00" }], points: [{ id: "p", label: "P", lat: 13.7, lng: 100.5, daily: [{ rainMm: 0 }], windows: [] }] };
  const result = normalizeWeather(payload, "rain");
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].window, null);
  assert.equal(result.points[0].secondary[0], 0);
  assert.equal(result.points[0].values[0], null);
  assert.equal(normalizeWeather({ ...payload, dataQuality: { tmdStatus: "unavailable" } }, "rain").steps.length, 2);
});
