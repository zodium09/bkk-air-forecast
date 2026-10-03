import assert from "node:assert/strict";
import test from "node:test";
import { coverageContains } from "../../app/lib/geographic-coverage.ts";
import { DEFAULT_REGION_ID, chaoPhrayaBoundary, chaoPhrayaCoreBoundary, getProvincePoints, getRegionProvinces, getVerifiedRiverBoundary, metroProvinces, provinces, regionContains } from "../../app/lib/provinces.ts";
import { mapPlaceCatalog } from "../../app/lib/map-place-catalog.ts";
import { regionPlaces } from "../../app/lib/map-places.ts";
import { getMetroAnalysisTargets, getRegionalCamsPoints } from "../../app/lib/forecast/influence-domain.ts";
import { atmosphereRequest } from "../../app/api/air-atmosphere/route.ts";

test("primary scope retains metro and adds only the 13 clipped provinces", () => {
  assert.equal(DEFAULT_REGION_ID, "chao-phraya");
  assert.equal(provinces.length, 19);
  assert.equal(getRegionProvinces("metro").length, 6);
  assert.equal(getRegionProvinces(DEFAULT_REGION_ID).length, 19);
  assert.equal(new Set(provinces.map(p => p.id)).size, 19);
  assert.deepEqual(provinces.filter(p => p.scopeNote).map(p => p.code).sort(), ["14","15","16","17","18","19","26","60","61","62","66","67","72"]);
  for (const p of provinces) {
    const points = getProvincePoints(p.id);
    assert.ok(points.length >= 6 && points.length <= 18);
    assert.ok(points.every(v => coverageContains(chaoPhrayaBoundary, v.lat, v.lng)), p.id);
    if (p.scopeNote) {
      assert.ok(points.every(v => coverageContains(chaoPhrayaCoreBoundary, v.lat, v.lng)), p.id);
      assert.ok(points.every(v => coverageContains(getVerifiedRiverBoundary(p.id), v.lat, v.lng)), p.id);
      assert.ok(regionContains(p.id, p.center.lat, p.center.lng));
    }
  }
  assert.equal(getMetroAnalysisTargets(DEFAULT_REGION_ID).length, 149);
  assert.ok(getRegionalCamsPoints(DEFAULT_REGION_ID).some(p => p.lat > 16));
});

test("basin polygons reject out-of-basin coordinates inside their bounding rectangle", () => {
  assert.equal(regionContains(DEFAULT_REGION_ID, 16.1, 101.08), false);
  assert.equal(regionContains(DEFAULT_REGION_ID, 18.79, 98.99), false);
  assert.equal(regionContains(DEFAULT_REGION_ID, 13.5475, 100.2744), true); // retained Samut Sakhon
  assert.equal(regionContains("saraburi", 14.53, 101.4, "saraburi"), false);
  assert.equal(regionContains(DEFAULT_REGION_ID, NaN, 100.5), false);
});

test("public locality references stay inside the basin and retain all original metro IDs", () => {
  assert.equal(mapPlaceCatalog.places.length, 1127);
  assert.equal(new Set(mapPlaceCatalog.places.map(p => p.id)).size, 1127);
  const original = regionPlaces(mapPlaceCatalog.places, "metro");
  assert.equal(original.length, 487);
  assert.equal(original.filter(p => p.overview).length, 79);
  for (const p of provinces.filter(p => p.scopeNote)) {
    const places = regionPlaces(mapPlaceCatalog.places, p.id);
    assert.ok(places.length > 0, p.id);
    assert.ok(places.every(v => coverageContains(chaoPhrayaCoreBoundary, v.lat, v.lng)));
    for (const district of new Set(places.map(v => v.district))) assert.equal(places.filter(v => v.district === district && v.overview).length, 1, `${p.id} ${district}`);
  }
  assert.ok(metroProvinces.every(p => regionPlaces(mapPlaceCatalog.places, p.id).length > 0));
});

test("geographic membership respects polygon holes, disjoint islands and outer edges", () => {
  const polygon = { features: [{ geometry: { type: "MultiPolygon", coordinates: [[[[0,0],[4,0],[4,4],[0,4],[0,0]],[[1,1],[2,1],[2,2],[1,2],[1,1]]],[[[6,6],[7,6],[7,7],[6,7],[6,6]]]] } }] };
  assert.equal(coverageContains(polygon, 3, 3), true);
  assert.equal(coverageContains(polygon, 1.5, 1.5), false);
  assert.equal(coverageContains(polygon, 6.5, 6.5), true);
  assert.equal(coverageContains(polygon, 5, 5), false);
  assert.equal(coverageContains(polygon, 0, 0), true);
});

test("atmospheric context accepts newly supported places but rejects upstream-only coordinates", () => {
  const p = getProvincePoints("nakhon-sawan")[0];
  const context = atmosphereRequest(new URL(`http://localhost/?province=chao-phraya&lat=${p.lat}&lng=${p.lng}`));
  assert.ok(context?.personal);
  assert.equal(atmosphereRequest(new URL("http://localhost/?province=chao-phraya&lat=18.79&lng=98.99")), null);
  assert.equal(atmosphereRequest(new URL("http://localhost/?province=chao-phraya"))?.region, DEFAULT_REGION_ID);
});
