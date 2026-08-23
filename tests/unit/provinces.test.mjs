import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PROVINCE_ID, buildFallbackBoundary, getProvince, getProvincePoints, provinces } from "../../app/lib/provinces.ts";

test("province catalogue contains Bangkok and its five metropolitan neighbours", () => {
  assert.equal(DEFAULT_PROVINCE_ID, "bangkok");
  assert.equal(provinces.length, 6);
  assert.deepEqual(provinces.map((province) => province.code).sort(), ["10", "11", "12", "13", "73", "74"]);
  assert.equal(getProvince("unknown").id, "bangkok");
});

test("every province supplies a finite nine-point model grid and fallback boundary", () => {
  for (const province of provinces) {
    const points = getProvincePoints(province.id);
    assert.equal(points.length, 9);
    assert.ok(points.every((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)));
    const fallback = buildFallbackBoundary(province.id);
    assert.equal(fallback.features[0].properties.PROV_CODE, province.code);
    assert.equal(fallback.features[0].geometry.coordinates[0].length, 5);
  }
});
