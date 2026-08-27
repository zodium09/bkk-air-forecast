import assert from "node:assert/strict";
import test from "node:test";
import { createTmdRadarResponse } from "../../app/api/tmd-radar/route.ts";

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": "application/json" },
});

function overlay(group, time, url, opacity = 0.88) {
  return {
    bounds: [[4.05, 90.69], [22.72, 110.68]],
    group,
    opacity,
    product_kind: "rainrate",
    unit: "mm/h",
    url,
    valid_dt_iso: time,
  };
}

function catalog() {
  const observed = ["12:30", "12:45", "13:00", "13:15"].map((time) => overlay(
    "02 Rain Rate Overlay",
    `2026-08-23T${time}:00`,
    `/products/leaflet_overlay_rainrate/rain-${time.replace(":", "")}.png`,
  ));
  const nowcast = [15, 30, 60, 180].map((lead) => {
    const timestamp = new Date(Date.UTC(2026, 7, 23, 13, 15 + lead)).toISOString().slice(0, 19);
    return overlay(
      "05 Rain Rate Nowcast Overlay",
      timestamp,
      `/products/leaflet_overlay_nowcast_rainrate/rain-t${lead}.png`,
    );
  });
  return { overlays: [...observed, ...nowcast] };
}

test("TMD radar adapter returns validated observed and nowcast frames", async () => {
  const now = Date.UTC(2026, 7, 23, 13, 30);
  const response = await createTmdRadarResponse({ fetchImpl: async () => json(catalog()), now: () => now });
  const payload = await response.json();
  assert.equal(payload.status, "live");
  assert.equal(payload.ageMinutes, 15);
  assert.equal(payload.observedFrames.length, 4);
  assert.deepEqual(payload.nowcastFrames.map((frame) => frame.leadMinutes), [15, 30, 60, 180]);
  assert.match(payload.observedFrames[0].imageUrl, /^https:\/\/radargis\.tmd\.go\.th\/products\//);
  assert.equal(response.headers.get("X-TMD-Radar-Status"), "live");
});

test("TMD radar adapter degrades at 31-90 minutes and hides stale frames after 90 minutes", async () => {
  const degraded = await (await createTmdRadarResponse({
    fetchImpl: async () => json(catalog()),
    now: () => Date.UTC(2026, 7, 23, 13, 55),
  })).json();
  assert.equal(degraded.status, "degraded");
  assert.equal(degraded.ageMinutes, 40);

  const stale = await (await createTmdRadarResponse({
    fetchImpl: async () => json(catalog()),
    now: () => Date.UTC(2026, 7, 23, 14, 46),
  })).json();
  assert.equal(stale.status, "unavailable");
  assert.deepEqual(stale.observedFrames, []);
  assert.deepEqual(stale.nowcastFrames, []);
});

test("TMD radar keeps observed frames available when nowcast is temporarily missing", async () => {
  const observedOnly = { overlays: catalog().overlays.filter((item) => item.group === "02 Rain Rate Overlay") };
  const payload = await (await createTmdRadarResponse({
    fetchImpl: async () => json(observedOnly),
    now: () => Date.UTC(2026, 7, 23, 13, 30),
  })).json();
  assert.equal(payload.status, "degraded");
  assert.equal(payload.reason, "missing-nowcast");
  assert.equal(payload.observedFrames.length, 4);
  assert.deepEqual(payload.nowcastFrames, []);
});

test("TMD radar adapter fails safely for invalid or unavailable upstream data", async () => {
  const malformed = await (await createTmdRadarResponse({ fetchImpl: async () => json({ overlays: [] }) })).json();
  assert.equal(malformed.status, "unavailable");
  const failed = await (await createTmdRadarResponse({ fetchImpl: async () => json({}, 503) })).json();
  assert.equal(failed.status, "unavailable");
});
