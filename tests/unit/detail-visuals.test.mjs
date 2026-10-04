import assert from "node:assert/strict";
import test from "node:test";
import { capacityReading, detailNumber, windyRadarLinks } from "../../app/lib/detail-visuals.ts";

test("capacity meters preserve actual zero and overflow, without converting missing or invalid inputs to zero", () => {
  assert.deepEqual(capacityReading(0), { value: 0, fill: 0, overflow: 0 });
  assert.deepEqual(capacityReading(68.4), { value: 68.4, fill: 68.4, overflow: 0 });
  const excess = capacityReading(130.2);
  assert.equal(excess.value, 130.2);
  assert.equal(excess.fill, 100);
  assert.ok(Math.abs(excess.overflow - 30.2) < 1e-9);
  for (const missing of [null, NaN, Infinity, -1]) assert.equal(capacityReading(missing), null);
});

test("detailed volumes retain thousandths, and small positive values never read as zero", () => {
  assert.equal(detailNumber(0), "0");
  assert.equal(detailNumber(.023), "0.023");
  assert.equal(detailNumber(47.567), "47.567");
  assert.equal(detailNumber(.0009), "<0.001");
  for (const missing of [null,NaN,Infinity]) assert.equal(detailNumber(missing), "—");
});

test("Windy embeds select rain radar, explicit metric units and approximate area coordinates", () => {
  const links = windyRadarLinks("bangkok", { lat:13.756321, lng:100.501845 });
  const url = new URL(links.embed);
  assert.equal(url.origin, "https://embed.windy.com");
  assert.equal(url.pathname, "/embed.html");
  for (const [key, value] of Object.entries({overlay:"radar",product:"radar",metricRain:"mm",metricTemp:"°C",metricWind:"km/h",lat:"13.8",lon:"100.5",zoom:"9"})) assert.equal(url.searchParams.get(key), value);
  assert.equal(links.full, "https://www.windy.com/-Weather-radar-radar?radar,13.8,100.5,9");
  assert.ok(!links.embed.includes("13.756321"));
});

test("missing, nonfinite or out-of-area positions fall back to the selected region", () => {
  const fallback = windyRadarLinks("bangkok", null);
  for (const point of [{lat:NaN,lng:100.5},{lat:13.8,lng:Infinity},{lat:0,lng:0}]) assert.deepEqual(windyRadarLinks("bangkok", point), fallback);
  for (const region of ["metro", "chao-phraya"]) {
    const url = new URL(windyRadarLinks(region,null).embed);
    assert.ok(Number.isFinite(Number(url.searchParams.get("lat"))));
    assert.ok(Number.isFinite(Number(url.searchParams.get("lon"))));
  }
});
