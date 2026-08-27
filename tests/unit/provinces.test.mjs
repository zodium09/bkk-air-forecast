import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PROVINCE_ID, DEFAULT_REGION_ID, buildFallbackBoundary, getProvince, getProvincePoints, getRegion, provinces } from "../../app/lib/provinces.ts";
import { getMetroAnalysisTargets, getRegionalCamsPoints, isInsideRegionalInfluenceDomain } from "../../app/lib/forecast/influence-domain.ts";

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
    assert.ok(points.some((point) => point.lat < province.bounds.minLat && point.lng < province.bounds.minLng));
    assert.ok(points.some((point) => point.lat > province.bounds.maxLat && point.lng > province.bounds.maxLng));
    const fallback = buildFallbackBoundary(province.id);
    assert.equal(fallback.features[0].properties.PROV_CODE, province.code);
    assert.equal(fallback.features[0].geometry.coordinates[0].length, 5);
  }
});

test("metropolitan overview is the default region and covers all six provinces", () => {
  assert.equal(DEFAULT_REGION_ID, "metro");
  assert.equal(getRegion("metro").nameEn, "Bangkok Metropolitan Region");
  const fallback = buildFallbackBoundary("metro");
  assert.equal(fallback.features.length, provinces.length);
});

test("regional influence domain uses a CAMS-scale grid and combined metro targets", () => {
  const camsPoints = getRegionalCamsPoints();
  assert.equal(camsPoints.length, 49);
  assert.ok(camsPoints.every((point) => isInsideRegionalInfluenceDomain(point.lat, point.lng)));
  assert.equal(getMetroAnalysisTargets().length, 54);
});
