import assert from "node:assert/strict";
import test from "node:test";
import { forecastDetailIndex, forecastPeriod, forecastSamples } from "../../app/lib/forecast-content.ts";
import { placeReading } from "../../app/lib/place-outlook.ts";
import { buildAreaWatch } from "../../app/lib/area-watch.ts";
import { formatValue, getLegend, legendIndex } from "../../app/lib/map-intelligence.ts";

const today = "2026-10-02";
const tomorrow = "2026-10-03";
const daily = date => ({ key: `${date}:day`, date, day: 0, window: null, cadence: "day", label: "ตลอดวัน" });
const hourly = (date, hour) => ({ key: `${date}:h${hour}`, date, day: 0, window: hour, cadence: "hour", startHour: hour, endHour: hour + 1, label: `${hour}:00–${hour + 1}:00` });
const window = { key: `${today}:w21`, date: today, day: 0, window: 7, cadence: "window", startHour: 21, endHour: 24, label: "21:00–24:00" };
const steps = [daily(today), hourly(today, 22), window, hourly(today, 23), daily(tomorrow), ...Array.from({ length: 24 }, (_, i) => hourly(tomorrow, i))];
const values = steps.map((_, i) => i === 1 ? 0 : i === 3 ? null : i);
const data = { layer: "rain", status: "live", steps, points: [], model: "Test" };

test("small nonzero readings never round into a false zero and temperature alone does not imply a heat-index risk", () => {
  assert.equal(formatValue(0.004), "<0.1");
  assert.equal(formatValue(-0.004), ">−0.1");
  assert.equal(formatValue(0), "0");
  assert.equal(formatValue(null), "—");
  assert.equal(formatValue(0.1), "0.1");
  assert.equal(placeReading("heat", "secondary", 40, hourly(today, 22)).priority, -1);
  assert.equal(placeReading("heat", "primary", 52, hourly(today, 22)).priority, 3);
});

test("each value names its own source date even when the page is following today", () => {
  assert.equal(forecastPeriod(daily(tomorrow), today), "พรุ่งนี้ · ตลอดวัน");
  assert.equal(forecastPeriod(hourly(today, 22), today), "วันนี้ · 22:00–23:00");
  assert.equal(forecastPeriod(undefined, today), "ยังไม่มีช่วงพยากรณ์ที่ใช้ได้");
});

test("opening day detail prefers actual hours ahead of three-hour windows and keeps a real coarse fallback", () => {
  assert.equal(forecastDetailIndex({ ...data, steps: [daily(today), window, hourly(today, 22)] }, today), 2);
  assert.equal(forecastDetailIndex({ ...data, steps: [daily(today), window] }, today), 1);
  assert.equal(forecastDetailIndex({ ...data, steps: [daily(today)] }, today), -1);
  assert.equal(forecastDetailIndex(data, "2026-10-10"), -1);
  assert.equal(forecastDetailIndex({ ...data, status: "unavailable" }, today), -1);
});

test("next-hour graphs cross midnight using only actual hourly indices and preserve zero and gaps", () => {
  const samples = forecastSamples(data, values, 1, true, today);
  assert.equal(samples.length, 24);
  assert.deepEqual(samples.slice(0, 3).map(s => s.index), [1, 3, 5]);
  assert.equal(samples[0].value, 0);
  assert.equal(samples[1].value, null);
  assert.match(samples[2].label, /^พรุ่งนี้ · 0:00/);
  assert.ok(samples.every(s => steps[s.index].cadence === "hour"));
});

test("a selected day excludes other dates and cadences without substituting daily peaks", () => {
  assert.deepEqual(forecastSamples(data, values, 3, false, today).map(s => s.index), [1, 3]);
  assert.deepEqual(forecastSamples(data, values, 2, false, today).map(s => s.index), [2]);
  assert.deepEqual(forecastSamples(data, values, 4, false, today).map(s => s.index), [0, 4]);
  assert.equal(forecastSamples(data, [], 1, false, today)[0].value, null);
  assert.deepEqual(forecastSamples({ ...data, status: "unavailable" }, values, 1), []);
  assert.deepEqual(forecastSamples(data, values, -1), []);
  assert.equal(forecastSamples(data, values.map(() => NaN), 1)[0].value, null);
});

test("a next-day window spans 24 elapsed hours, regardless of three-hour cadence or absent source slots", () => {
  const coarseSteps = [today, tomorrow].flatMap(date => Array.from({ length: 8 }, (_, i) => ({ ...hourly(date, i * 3), cadence: "window", endHour: i * 3 + 3 })));
  const coarse = { ...data, steps: coarseSteps };
  assert.equal(forecastSamples(coarse, coarseSteps.map(() => 1), 7, true, today).length, 8);
  const sparse = { ...data, steps: [hourly(today, 23), hourly(tomorrow, 12), hourly(tomorrow, 23)] };
  assert.deepEqual(forecastSamples(sparse, [0, null, 20], 0, true, today).map(s => s.index), [0, 1]);
});

test("rain reading, map legend and area watches share daily 35/90 boundaries and never assess hourly totals as daily risk", () => {
  const day = daily(today);
  const legend = getLegend("rain", "secondary");
  for (const [amount, priority] of [[35, 1], [35.1, 2], [35.5, 2], [90, 2], [90.1, 3]]) {
    assert.equal(placeReading("rain", "secondary", amount, day).priority, priority);
    assert.equal(legendIndex("rain", "secondary", amount), priority);
    const selected = { ...data, steps: [day], points: [{ id: "bangkok-1", label: "กรุงเทพฯ", values: [0], secondary: [amount] }] };
    const watches = buildAreaWatch(selected, today, undefined, undefined, "secondary");
    assert.equal(watches.length, amount > 35 ? 1 : 0);
    if (watches.length) assert.equal(watches[0].severity, priority);
    assert.equal(placeReading("rain", "secondary", amount, hourly(today, 22)).priority, -1);
  }
  assert.equal(legend[1].max, 35);
  assert.equal(legend[2].max, 90);
});
