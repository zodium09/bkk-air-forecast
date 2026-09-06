import assert from "node:assert/strict";
import test from "node:test";
import {
  boundaryContains,
  interpolateMapValue,
  sampleMapSurface,
} from "../../app/lib/map-surface.ts";

const square = [
  [100, 13],
  [101, 13],
  [101, 14],
  [100, 14],
  [100, 13],
];
const hole = [
  [100.4, 13.4],
  [100.6, 13.4],
  [100.6, 13.6],
  [100.4, 13.6],
  [100.4, 13.4],
];
const boundary = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [square, hole] },
    },
  ],
};
test("IDW selections respect polygon holes and unsupported geography", () => {
  assert.equal(boundaryContains(boundary, 13.2, 100.2), true);
  assert.equal(boundaryContains(boundary, 13.5, 100.5), false);
  assert.equal(boundaryContains(boundary, 14.2, 100.2), false);
  const multi = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "MultiPolygon", coordinates: [[square, hole]] },
      },
    ],
  };
  assert.equal(boundaryContains(multi, 13.2, 100.2), true);
  assert.equal(boundaryContains(multi, 13.5, 100.5), false);
});
const points = [
  { lat: 13.7, lng: 100.5, values: [0, 20], secondary: [2, null] },
  { lat: 13.8, lng: 100.5, values: [0, 40], secondary: [4, null] },
  { lat: 13.7, lng: 100.6, values: [0, 60], secondary: [6, 7] },
];
test("IDW preserves true zero, changes with time and metric, and requires three nearby values", () => {
  assert.equal(interpolateMapValue(points, 0, "primary", 13.75, 100.55), 0);
  const next = interpolateMapValue(points, 1, "primary", 13.75, 100.55);
  assert.ok(next > 20 && next < 60);
  const rain = interpolateMapValue(points, 0, "secondary", 13.75, 100.55);
  assert.ok(rain > 2 && rain < 6);
  assert.equal(
    interpolateMapValue(points, 1, "secondary", 13.75, 100.55),
    null,
  );
  assert.equal(
    interpolateMapValue(points.slice(0, 2), 0, "primary", 13.75, 100.55),
    null,
  );
  assert.equal(interpolateMapValue(points, 0, "primary", 15.5, 102.5), null);
});
test("weather raster sampling cannot animate outside coverage or in cells without data", () => {
  const surface = {
    width: 2,
    height: 2,
    bounds: [
      [13, 100],
      [14, 101],
    ],
    values: new Float32Array([0, NaN, 3, 4]),
  };
  assert.equal(sampleMapSurface(surface, 13.75, 100.25), 0);
  assert.equal(sampleMapSurface(surface, 13.75, 100.75), null);
  assert.equal(sampleMapSurface(surface, 13.25, 100.75), 4);
  assert.equal(sampleMapSurface(surface, 12.9, 100.75), null);
  assert.equal(sampleMapSurface(surface, 13.25, 101.1), null);
});
