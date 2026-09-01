import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_PROVINCE_ID, DEFAULT_REGION_ID, buildFallbackBoundary, getProvince, getProvincePoints, getRegion, provinces } from "../../app/lib/provinces.ts";
import { getMetroAnalysisTargets, getRegionalCamsPoints, isInsideRegionalInfluenceDomain } from "../../app/lib/forecast/influence-domain.ts";

const bangkokBoundary = JSON.parse(readFileSync(new URL("../../app/data/bangkok-districts.json", import.meta.url), "utf8"));
const metroBoundary = JSON.parse(readFileSync(new URL("../../app/data/metro-provinces.json", import.meta.url), "utf8"));

function insideRing(lng, lat, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [currentLng, currentLat] = ring[index];
    const [previousLng, previousLat] = ring[previous];
    if ((currentLat > lat) !== (previousLat > lat) && lng < ((previousLng - currentLng) * (lat - currentLat)) / (previousLat - currentLat) + currentLng) inside = !inside;
  }
  return inside;
}

function insideFeatures(point, features) {
  return features.some((feature) => {
    const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    return polygons.some((rings) => insideRing(point.lng, point.lat, rings[0]) && !rings.slice(1).some((ring) => insideRing(point.lng, point.lat, ring)));
  });
}

test("province catalogue contains Bangkok and its five metropolitan neighbours", () => {
  assert.equal(DEFAULT_PROVINCE_ID, "bangkok");
  assert.equal(provinces.length, 6);
  assert.deepEqual(provinces.map((province) => province.code).sort(), ["10", "11", "12", "13", "73", "74"]);
  assert.equal(getProvince("unknown").id, "bangkok");
});

test("every province supplies nine irregular samples inside its verified boundary", () => {
  for (const province of provinces) {
    const points = getProvincePoints(province.id);
    const features = province.id === "bangkok"
      ? bangkokBoundary.features
      : metroBoundary.features.filter((feature) => String(feature.properties.PROV_CODE) === province.code);
    assert.equal(points.length, 9);
    assert.ok(points.every((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)));
    assert.ok(points.every((point) => insideFeatures(point, features)));
    assert.ok(new Set(points.map((point) => point.lat)).size > 3);
    assert.ok(new Set(points.map((point) => point.lng)).size > 3);
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
