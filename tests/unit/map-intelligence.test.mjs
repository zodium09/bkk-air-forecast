import assert from "node:assert/strict";
import test from "node:test";
import { buildForecastDayShells } from "../../app/lib/forecast-data.ts";
import {
  normalizeAir,
  normalizeWeather,
  closestPoint,
  pointValue,
  relativeDay,
  legendIndex,
} from "../../app/lib/map-intelligence.ts";

const air = {
  status: "degraded",
  issuedAt: "5 ก.ย. 2569 19:00",
  model: "CAMS",
  days: buildForecastDayShells(Date.parse("2026-09-05T10:00:00Z")).map(
    (day, i) => ({ ...day, sourceMode: i < 5 ? "cams" : "extrapolated" }),
  ),
  stations: [
    {
      id: "measured",
      label: "Station",
      lat: 13.7,
      lng: 100.5,
      observed: 0,
      observedAt: "2026-09-05 17:00:00",
      values: [15, 20, 25, 30, 35, 40, 45],
    },
    {
      id: "model",
      label: "Model point",
      lat: 13.8,
      lng: 100.6,
      values: [35, 30, 25, 20, 15, 10, 5],
    },
  ],
};
test("observation mode never presents model output as measured, and preserves a measured zero", () => {
  const result = normalizeAir(air, "observation");
  assert.deepEqual(
    result.points.map((p) => p.id),
    ["measured"],
  );
  assert.equal(result.points[0].values[0], 0);
  assert.equal(result.points[0].observedAt, "2026-09-05 17:00:00");
  assert.equal(result.steps.length, 1);
});
test("air dates start tomorrow, retain extrapolation status and do not fabricate hourly steps", () => {
  const result = normalizeAir(air, "forecast");
  assert.equal(result.steps[0].date, "2026-09-06");
  assert.equal(result.steps[6].date, "2026-09-12");
  assert.equal(result.steps[6].sourceMode, "extrapolated");
  assert.ok(result.steps.every((s) => s.window === null));
});
test("unavailable and placeholder forecasts never leave numeric map values visible", () => {
  assert.equal(
    normalizeAir({ ...air, status: "unavailable" }, "forecast").points.length,
    0,
  );
  const payload = {
    ...air,
    days: air.days.map((d) => ({ ...d, sourceMode: "placeholder" })),
  };
  assert.equal(normalizeAir(payload, "forecast").points[0].values[0], null);
});
test("rain aligns daily and available windows by identifier, preserving missing probability and zero rain", () => {
  const result = normalizeWeather(
    {
      status: "live",
      fetchedAt: "2026-09-05T12:00:00Z",
      model: "Open-Meteo",
      sources: [],
      dataQuality: {},
      disclaimer: "",
      days: [{ dateKey: "2026-09-05" }],
      windows: [
        {
          dayIndex: 0,
          windowIndex: 2,
          start: "06:00",
          end: "09:00",
          label: "06.00",
        },
        {
          dayIndex: 0,
          windowIndex: 6,
          start: "18:00",
          end: "21:00",
          label: "18.00",
        },
      ],
      points: [
        {
          id: "p",
          label: "point",
          lat: 13.7,
          lng: 100.5,
          daily: [{ pointProbabilityMax: 80, rainMm: 7 }],
          windows: [
            {
              dayIndex: 0,
              windowIndex: 6,
              pointProbabilityPeak: 60,
              rainMm: 7,
            },
            {
              dayIndex: 0,
              windowIndex: 2,
              pointProbabilityPeak: null,
              rainMm: 0,
            },
          ],
        },
      ],
    },
    "rain",
  );
  assert.deepEqual(result.points[0].values, [80, null, 60]);
  assert.deepEqual(result.points[0].secondary, [7, 0, 7]);
  assert.equal(result.steps[1].label, "06:00–09:00");
  assert.equal(result.steps[2].startHour, 18);
  assert.equal(pointValue(result.points[0], 1, "secondary"), 0);
});
test("heat index and air temperature stay separate at daily and window resolution", () => {
  const result = normalizeWeather(
    {
      status: "live",
      fetchedAt: "",
      model: "weather",
      sources: [],
      dataQuality: {},
      disclaimer: "",
      days: [{ dateKey: "2026-09-05" }],
      windows: [{ dayIndex: 0, windowIndex: 4, start: "12:00", end: "15:00" }],
      points: [
        {
          id: "p",
          label: "p",
          lat: 13.7,
          lng: 100.5,
          daily: [{ maxHeatIndexC: 42, maxTemperatureC: 34 }],
          windows: [
            {
              dayIndex: 0,
              windowIndex: 4,
              maxHeatIndexC: 39,
              maxTemperatureC: 32,
            },
          ],
        },
      ],
    },
    "heat",
  );
  assert.equal(pointValue(result.points[0], 1, "primary"), 39);
  assert.equal(pointValue(result.points[0], 1, "secondary"), 32);
  assert.equal(legendIndex("heat", "primary", 42), 3);
});
test("a map selection beyond supported nearby points has no local value", () => {
  const points = normalizeAir(air, "forecast").points;
  assert.equal(closestPoint(points, 15, 102), null);
  assert.equal(closestPoint(points, 13.701, 100.501)?.id, "measured");
});
test("tomorrow labels handle month and year boundaries in Bangkok time", () => {
  assert.equal(relativeDay("2027-01-01", "2026-12-31"), "พรุ่งนี้");
  assert.equal(relativeDay("2026-10-01", "2026-09-30"), "พรุ่งนี้");
});
