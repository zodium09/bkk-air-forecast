import test from "node:test";
import assert from "node:assert/strict";
import { forecastWindowState, nextForecastHours } from "../../app/lib/hydro/weather-context.ts";

test("forecast windows use Bangkok time and treat 24:00 as the following midnight", () => {
  const justBeforeMidnight = Date.parse("2026-10-17T23:59:00+07:00");
  const midnight = Date.parse("2026-10-18T00:00:00+07:00");
  assert.equal(forecastWindowState("2026-10-17", "21:00", "00:00", justBeforeMidnight), "current");
  assert.equal(forecastWindowState("2026-10-17", "21:00", "00:00", midnight), "elapsed");
  assert.equal(forecastWindowState("2026-10-18", "00:00", "03:00", midnight), "current");
  assert.equal(forecastWindowState("2026-10-18", "03:00", "06:00", midnight), "future");
});

test("hourly outlook crosses Bangkok midnight and keeps true zero separate from missing cells", () => {
  const now = Date.parse("2026-10-17T23:30:00+07:00");
  const points = [
    { hourly: [{ time: "2026-10-18T00:00", rainMm: 0 }, { time: "2026-10-18T01:00", rainMm: null }] },
    { hourly: [{ time: "2026-10-18T00:00", rainMm: 2 }, { time: "2026-10-18T01:00", rainMm: null }] },
  ];
  assert.deepEqual(nextForecastHours(points, now, 2), [
    { key: "2026-10-18T00:00", rainMm: 1, samples: 2 },
    { key: "2026-10-18T01:00", rainMm: null, samples: 0 },
  ]);
  assert.equal(nextForecastHours([{ hourly: [{ time: "2026-10-18T00:00", rainMm: 0 }] }], now, 1)[0].rainMm, 0);
});
