import assert from "node:assert/strict";
import test from "node:test";
import { boundaryLabels } from "../../app/lib/map-labels.ts";
import { boundaryContains } from "../../app/lib/map-surface.ts";
const outer = [
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
test("geographic labels use source names and stay inside boundaries, outside holes", () => {
  const boundary = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { NAME_T: "เขตตัวอย่าง" },
        geometry: { type: "Polygon", coordinates: [outer, hole] },
      },
    ],
  };
  const labels = boundaryLabels(boundary);
  assert.equal(labels.length, 1);
  assert.equal(labels[0].name, "ตัวอย่าง");
  assert.equal(labels[0].kind, "district");
  assert.equal(boundaryContains(boundary, labels[0].lat, labels[0].lng), true);
  assert.equal(
    boundaryLabels(boundary),
    labels,
    "cached for repeated map movements",
  );
});
test("province labels use the largest island of a multipolygon and never invent missing names", () => {
  const small = [
    [102, 15],
    [102.1, 15],
    [102.1, 15.1],
    [102, 15.1],
    [102, 15],
  ];
  const boundary = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { PROV_NAM_T: "จังหวัดตัวอย่าง" },
        geometry: { type: "MultiPolygon", coordinates: [[small], [outer]] },
      },
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [outer] },
      },
    ],
  };
  const labels = boundaryLabels(boundary);
  assert.equal(labels.length, 1);
  assert.equal(labels[0].kind, "province");
  assert.ok(labels[0].lat < 14 && labels[0].lng < 101);
});
