import assert from "node:assert/strict";
import test from "node:test";
import { chartScale, dailyIndex, overviewDates, overviewValue, sourceState } from "../../app/lib/environment-overview.ts";

const date = "2026-10-01";
const day = { key: `${date}:day`, date, window: null, cadence: "day" };
const hour = { ...day, key: `${date}:h06`, window: 2, cadence: "hour" };
const place = { id: "road-1", lat: 13.75, lng: 100.5 };
const boundary = { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[100.3, 13.6], [100.7, 13.6], [100.7, 13.9], [100.3, 13.9], [100.3, 13.6]]] } }] };
const data = { layer: "rain", status: "live", valueMethod: "provider", steps: [hour, day], points: [{ id: "source-1", ...place, place, values: [70, 60], secondary: [4, 0] }, { id: "source-2", lat: 13.8, lng: 100.55, values: [90, null], secondary: [8, null] }] };

test("overview uses the exact daily date, never an hourly value or a neighboring date", () => {
  assert.equal(dailyIndex(data, date), 1);
  assert.equal(overviewValue(data, date, "secondary"), 0);
  assert.equal(overviewValue(data, "2026-10-02", "secondary"), null);
  assert.equal(overviewValue({ ...data, steps: [hour] }, date, "secondary"), null);
  assert.equal(overviewValue({ ...data, status: "unavailable" }, date, "secondary"), null);
});

test("a personal rain reading needs matching provider coordinates, identity and supported geography", () => {
  assert.equal(overviewValue(data, date, "secondary", place, boundary), 0);
  assert.equal(overviewValue(data, date, "secondary", place, null), null);
  assert.equal(overviewValue(data, date, "secondary", { ...place, lat: 13.751 }, boundary), null);
  assert.equal(overviewValue(data, date, "secondary", { ...place, id: "another-road" }, boundary), null);
  assert.equal(overviewValue(data, date, "secondary", { ...place, lat: 16 }, boundary), null);
});

test("personal air or heat cannot invent an estimate with insufficient neighbors", () => {
  assert.equal(overviewValue({ ...data, layer: "heat", valueMethod: "idw" }, date, "primary", place, boundary), null);
});

test("the seven-day horizon excludes old, unavailable and hourly-only periods and deduplicates dates", () => {
  const days = Array.from({ length: 9 }, (_, index) => ({ ...day, date: `2026-10-${String(index + 1).padStart(2, "0")}` }));
  const horizon = overviewDates([{ ...data, steps: [...days, { ...day, date: "2026-09-30" }] }, data, { ...data, status: "unavailable", steps: [{ ...day, date: "2026-10-10" }] }], date);
  assert.deepEqual(horizon, days.slice(0, 7).map((item) => item.date));
  assert.deepEqual(overviewDates([{ ...data, steps: [hour] }], date), []);
});

test("source readiness distinguishes loading, degraded, failure and unavailability", () => {
  assert.equal(sourceState(data, true, ""), "กำลังโหลด");
  assert.equal(sourceState(data, false, ""), "ข้อมูลพร้อม");
  assert.equal(sourceState({ ...data, status: "degraded" }, false, ""), "ข้อมูลบางส่วน / แหล่งสำรอง");
  assert.equal(sourceState(data, false, "request failed"), "ไม่มีข้อมูล");
  assert.equal(sourceState({ ...data, status: "unavailable" }, false, ""), "ไม่มีข้อมูล");
});

test("forecast chart keeps a zero baseline and enough headroom for the largest value", () => {
  const scale = chartScale([null, 0, 3, 35.5, 92]);
  assert.equal(scale.min, 0);
  assert.ok(scale.max > 92);
  assert.ok(chartScale([0, 0]).max > 0);
});

test("chart scale ignores missing and non-finite values and retains negative temperatures", () => {
  assert.deepEqual(chartScale([null, NaN, Infinity]), chartScale([]));
  const scale = chartScale([-8, 0, 4]);
  assert.ok(scale.min <= -8);
  assert.ok(scale.max > 4);
});
