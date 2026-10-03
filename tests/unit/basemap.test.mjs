import assert from "node:assert/strict";
import test from "node:test";
import { getBasemapConfig, getFallbackBasemapConfig } from "../../app/lib/basemap.ts";

test("street basemap follows the application theme", () => {
  const light = getBasemapConfig("street", "light");
  const dark = getBasemapConfig("street", "dark");

  assert.equal(light.renderer,"vector");
  assert.match(light.url, /tiles\.openfreemap\.org\/styles\/liberty$/);
  assert.match(dark.url, /tiles\.openfreemap\.org\/styles\/dark$/);
  assert.match(dark.attribution, /OpenStreetMap/);
  assert.match(dark.attribution, /OpenFreeMap/);
  assert.match(dark.attribution, /OpenMapTiles/);
});

test("an explicitly selected satellite basemap remains satellite in either theme", () => {
  const light = getBasemapConfig("satellite", "light");
  const dark = getBasemapConfig("satellite", "dark");

  assert.equal(dark.url, light.url);
  assert.match(dark.url, /World_Imagery/);
  assert.match(dark.attribution, /Esri/);
  assert.equal(dark.renderer,"raster");
});

test("fallback maps remain raster and carry their actual provider attribution",()=>{
  for(const theme of ["light","dark"]) {
    const fallback=getFallbackBasemapConfig(theme);
    assert.equal(fallback.renderer,"raster");
    assert.doesNotMatch(fallback.attribution,/OpenFreeMap/);
    assert.match(fallback.attribution,/OpenStreetMap/);
    assert.ok(fallback.url.includes("{z}"));
  }
});
