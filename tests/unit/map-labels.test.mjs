import assert from "node:assert/strict";
import test from "node:test";
import { isStationInsideProvince, selectMapLabelLocations, selectMapLabelStations } from "../../app/lib/forecast/map-labels.ts";

const boundary = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { PROV_CODE: "10" },
      geometry: { type: "Polygon", coordinates: [[[100, 13], [101, 13], [101, 14], [100, 14], [100, 13]]] },
    },
    {
      type: "Feature",
      properties: { PROV_CODE: "12" },
      geometry: { type: "Polygon", coordinates: [[[100, 14], [101, 14], [101, 15], [100, 15], [100, 14]]] },
    },
  ],
};

function station(id, lat, lng) {
  return { id, district: id, label: id, lat, lng, values: [25] };
}

test("map labels stay inside their province and are limited to 2-4 well-spaced points", () => {
  const stations = [
    station("bangkok-0", 13.2, 100.2), station("bangkok-1", 13.2, 100.8),
    station("bangkok-2", 13.5, 100.5), station("bangkok-3", 13.8, 100.2),
    station("bangkok-4", 13.8, 100.8), station("bangkok-outside", 12.8, 100.5),
    station("nonthaburi-0", 14.2, 100.2), station("nonthaburi-1", 14.2, 100.8),
    station("nonthaburi-2", 14.5, 100.5), station("nonthaburi-3", 14.8, 100.2),
    station("nonthaburi-4", 14.8, 100.8), station("nonthaburi-outside", 15.2, 100.5),
  ];

  const selected = selectMapLabelStations(stations, boundary);
  const bangkok = selected.filter((item) => item.id.startsWith("bangkok-"));
  const nonthaburi = selected.filter((item) => item.id.startsWith("nonthaburi-"));

  assert.ok(bangkok.length >= 2 && bangkok.length <= 4);
  assert.ok(nonthaburi.length >= 2 && nonthaburi.length <= 4);
  assert.ok(selected.every((item) => !item.id.endsWith("outside")));
  assert.ok(bangkok.every((item) => isStationInsideProvince(item, "bangkok", boundary)));
  assert.ok(nonthaburi.every((item) => isStationInsideProvince(item, "nonthaburi", boundary)));
  assert.ok(bangkok.some((item) => item.lng < 100.4));
  assert.ok(bangkok.some((item) => item.lng > 100.6));
});

test("Bangkok district features without PROV_CODE are recognized as Bangkok", () => {
  const districtBoundary = {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { NAME_T: "เขตทดสอบ", NAME_E: "Test" },
      geometry: { type: "Polygon", coordinates: [[[100, 13], [101, 13], [101, 14], [100, 14], [100, 13]]] },
    }],
  };
  assert.equal(isStationInsideProvince(station("station-1", 13.5, 100.5), "bangkok", districtBoundary), true);
});
test("label locations are generated inside each province independently of buffered model anchors", () => {
  const locations = selectMapLabelLocations(boundary);
  const bangkok = locations.filter((item) => item.provinceId === "bangkok");
  const nonthaburi = locations.filter((item) => item.provinceId === "nonthaburi");

  assert.equal(bangkok.length, 3);
  assert.equal(nonthaburi.length, 3);
  assert.ok(bangkok.every((item) => isStationInsideProvince(item, "bangkok", boundary)));
  assert.ok(nonthaburi.every((item) => isStationInsideProvince(item, "nonthaburi", boundary)));
});
