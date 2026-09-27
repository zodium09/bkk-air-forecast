import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { directRainPoint, matchRainResponses, rainPlaceSteps, rainPlaceUrl, fetchRainPlaces, rainPlaceCacheTtl } from "../../app/lib/rain-place-forecast.ts";
import { createPlacePoints, sortedPlaceReadings } from "../../app/lib/place-outlook.ts";
import { environmentRequest } from "../../app/lib/dashboard-controls.ts";
import { buildAreaWatch } from "../../app/lib/area-watch.ts";
const catalog = JSON.parse(await readFile(new URL("../../app/data/map-places.json", import.meta.url), "utf8"));
const boundary = JSON.parse(await readFile(new URL("../../app/data/bangkok-districts.json", import.meta.url), "utf8"));
const places = catalog.places.filter((p) => p.provinceId === "bangkok").slice(0, 3);
const steps = rainPlaceSteps("2026-09-27");
const stepIndex = (key) => steps.findIndex((s) => s.key === `2026-09-27:${key}`);
function raw(id = 0) {
  const time = Array.from({ length: 192 }, (_, i) => new Date(Date.UTC(2026, 8, 27, i)).toISOString().slice(0, 16));
  return { ...(id ? { location_id: id } : {}), latitude: 13.743409, longitude: 100.495865, utc_offset_seconds: 25200,
    hourly_units: { precipitation: "mm", precipitation_probability: "%" }, daily_units: { precipitation_sum: "mm", precipitation_probability_max: "%" },
    hourly: { time, precipitation: time.map((_, i) => i), precipitation_probability: time.map(() => 70) },
    daily: { time: time.filter((_, i) => i % 24 === 0).map((t) => t.slice(0, 10)), precipitation_sum: Array(8).fill(123), precipitation_probability_max: Array(8).fill(95) } };
}
test("direct amounts use the preceding-hour endpoint, including midnight and the final forecast day", () => {
  const point = directRainPoint(places[0], raw(), steps);
  assert.equal(steps.length, 7 * 33);
  assert.equal(point.secondary[stepIndex("h06")], 7);
  assert.equal(point.secondary[stepIndex("h00")], 1);
  assert.equal(point.secondary[stepIndex("h23")], 24);
  assert.equal(point.secondary[stepIndex("w2")], 7 + 8 + 9);
  assert.equal(point.secondary[stepIndex("day")], 300);
  assert.equal(point.secondary[steps.findIndex((s) => s.key === "2026-10-03:h23")], 168);
  assert.deepEqual(point.forecastGrid, { lat: 13.743409, lng: 100.495865 });
  assert.equal(point.lat, places[0].lat);
  assert.equal(point.lng, places[0].lng);
});
test("probability remains independent from mm and multi-hour probability is the maximum single-hour value", () => {
  const source = raw(); source.hourly.precipitation_probability[8] = 90;
  const point = directRainPoint(places[0], source, steps);
  assert.equal(point.values[stepIndex("w2")], 90);
  assert.equal(point.values[stepIndex("day")], 90);
  assert.equal(point.secondary[stepIndex("w2")], 24);
  source.hourly.precipitation_probability.fill(null);
  const withoutChance = directRainPoint(places[0], source, steps);
  assert.equal(withoutChance.values[stepIndex("h06")], null);
  assert.equal(withoutChance.secondary[stepIndex("h06")], 7);
});
test("zero stays zero; incomplete accumulation windows and invalid units never become invented amounts", () => {
  const source = raw(); source.hourly.precipitation.fill(0);
  assert.equal(directRainPoint(places[0], source, steps).secondary[stepIndex("h06")], 0);
  source.hourly.precipitation[8] = null;
  let point = directRainPoint(places[0], source, steps);
  assert.equal(point.secondary[stepIndex("w2")], null);
  assert.equal(point.secondary[stepIndex("h06")], 0);
  source.hourly_units.precipitation = "%";
  point = directRainPoint(places[0], source, steps);
  assert.equal(point.secondary[stepIndex("h06")], null);
  assert.equal(point.secondary[stepIndex("day")], null);
  source.utc_offset_seconds = 0;
  assert.ok(directRainPoint(places[0], source, steps).secondary.every((v) => v === null));
  assert.doesNotThrow(() => directRainPoint(places[0], { ...raw(), hourly: { time: "invalid" } }, steps));
});
test("response IDs survive reordering and partial failure without assigning another location's values", () => {
  const matched = matchRainResponses([raw(2), raw(), raw(1)], 3);
  assert.equal(matched[0].location_id, undefined);
  assert.equal(matched[1].location_id, 1);
  assert.equal(matched[2].location_id, 2);
  const sparse = matchRainResponses([raw(2)], 3);
  assert.equal(sparse[0], undefined); assert.equal(sparse[1], undefined);
  assert.equal(sparse[2].location_id, 2);
  assert.equal(matchRainResponses([raw(1), raw(1)], 3)[1], undefined);
  assert.ok(matchRainResponses([raw(), raw()], 3).every((v) => v === undefined));
});
test("named provider points preserve exact source values and missing locations without IDW", () => {
  const source = directRainPoint(places[0], raw(), steps);
  const data = { layer: "rain", valueMethod: "provider", status: "live", steps, points: [source] };
  const displayed = createPlacePoints(data, boundary, places);
  assert.equal(displayed[0].secondary[stepIndex("h06")], 7);
  assert.deepEqual(displayed[0].forecastGrid, source.forecastGrid);
  assert.ok(displayed.slice(1).every((p) => p.secondary.every((v) => v === null)));
  assert.equal(sortedPlaceReadings(displayed, stepIndex("h06"), "rain", "secondary", steps[stepIndex("h06")]).at(-1).title, "ไม่มีข้อมูลพยากรณ์");
  assert.equal(createPlacePoints({ ...data, status: "unavailable", points: [] }, boundary, places).length, places.length);
  assert.ok(createPlacePoints({ ...data, points: [{ ...source, lat: source.lat + .001 }] }, boundary, places).every((p) => p.secondary.every((v) => v === null)));
});
test("requests share a single amount/probability feed and include next-day midnight for all seven displayed days", () => {
  assert.deepEqual(environmentRequest("rain", "metro", "estimate", "tmd", "primary", true), environmentRequest("rain", "metro", "forecast", "open-meteo", "secondary", true));
  const url = new URL(rainPlaceUrl(places, "2026-09-27"));
  assert.equal(url.searchParams.get("latitude"), places.map((p) => p.lat).join(","));
  assert.equal(url.searchParams.get("end_date"), "2026-10-04");
  assert.equal(url.searchParams.get("cell_selection"), "nearest");
});
test("fixed batches are reused across province requests and concurrent loads; failed source does not trigger retry bursts", async () => {
  let calls = 0;
  const fetcher = async () => { calls++; await new Promise((r) => setTimeout(r, 5)); return Response.json(places.map((_, i) => raw(i))); };
  const options = { fetcher, now: new Date("2026-09-27T12:00:00+07:00") };
  const [all, one] = await Promise.all([fetchRainPlaces(places, places, options), fetchRainPlaces(places, places.slice(1, 2), options)]);
  assert.equal(calls, 1); assert.equal(all.status, "live"); assert.equal(one.points.length, 1);
  assert.equal(all.quality.uniqueGrids, 1); // Identical upstream cells are valid; they are not independent street sensors.
  assert.equal(all.points.length, 3);
  const unavailable = await fetchRainPlaces(places, places, { ...options, cache: false, fetcher: async () => { calls++; return new Response("Rate limit", { status: 429 }); } });
  assert.equal(calls, 2); assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.points.length, 3); assert.ok(unavailable.points.every((p) => p.secondary.every((v) => v === null)));
});
test("rain watch keeps the selected three-hour period and never applies daily heavy-rain thresholds to hourly totals", () => {
  const point = directRainPoint(places[0], raw(), steps);
  const data = { layer: "rain", valueMethod: "provider", status: "live", model: "Open-Meteo", steps, points: [point] };
  const window = buildAreaWatch(data, "2026-09-27", 6, "window");
  assert.equal(window[0].step.key, "2026-09-27:w2");
  assert.equal(window[0].severity, 1);
  const day = buildAreaWatch(data, "2026-09-27");
  assert.equal(day[0].severity, 3);
  assert.equal(day[0].value, 300);
});
test("edge TTL ends at Bangkok midnight rather than serving yesterday's forecast after date rollover", () => {
  assert.equal(rainPlaceCacheTtl(new Date("2026-09-27T23:59:30+07:00")), 30);
  assert.equal(rainPlaceCacheTtl(new Date("2026-09-28T00:00:01+07:00"), false, "2026-09-27"), 1);
  assert.equal(rainPlaceCacheTtl(new Date("2026-09-27T12:00:00+07:00")), 7200);
  assert.equal(rainPlaceCacheTtl(new Date("2026-09-27T12:00:00+07:00"), true), 600);
});
