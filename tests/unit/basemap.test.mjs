import assert from "node:assert/strict";
import test from "node:test";
import { getBasemapConfig } from "../../app/lib/basemap.ts";

test("street basemap follows the application theme", () => {
  const light = getBasemapConfig("street", "light");
  const dark = getBasemapConfig("street", "dark");

  assert.match(light.url, /tile\.openstreetmap\.org/);
  assert.match(dark.url, /Canvas\/World_Dark_Gray_Base/);
  assert.match(dark.attribution, /OpenStreetMap/);
  assert.match(dark.attribution, /Esri/);
});

test("an explicitly selected satellite basemap remains satellite in either theme", () => {
  const light = getBasemapConfig("satellite", "light");
  const dark = getBasemapConfig("satellite", "dark");

  assert.equal(dark.url, light.url);
  assert.match(dark.url, /World_Imagery/);
  assert.match(dark.attribution, /Esri/);
});
