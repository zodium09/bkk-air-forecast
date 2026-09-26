import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createPlacePoints, placeReading, sortedPlaceReadings } from "../../app/lib/place-outlook.ts";
import { boundaryContains, interpolateMapValue } from "../../app/lib/map-surface.ts";
import { placeAddress, placeArea, placeLabel, placeVisible, regionPlaces } from "../../app/lib/map-places.ts";
import { buildAreaWatch } from "../../app/lib/area-watch.ts";
import { getProvincePoints, provinces } from "../../app/lib/provinces.ts";

const bangkok = JSON.parse(await readFile(new URL("../../app/data/bangkok-districts.json", import.meta.url), "utf8"));
const surrounding = JSON.parse(await readFile(new URL("../../app/data/metro-provinces.json", import.meta.url), "utf8"));
const boundary = { type: "FeatureCollection", features: [...bangkok.features, ...surrounding.features] };
const catalog = JSON.parse(await readFile(new URL("../../app/data/map-places.json", import.meta.url), "utf8"));
const places = catalog.places;
const day = { key: "2026-09-27:day", date: "2026-09-27", day: 1, label: "ตลอดวัน", window: null, cadence: "day" };
const hour = { ...day, key: "2026-09-27:h06", label: "06:00–07:00", window: 2, cadence: "hour", startHour: 6, endHour: 7 };
const data = { layer: "rain", status: "live", model: "Test source", steps: [day, hour, { ...hour, key: "2026-09-27:h07", startHour: 7 }], points: provinces.flatMap((province) => getProvincePoints(province.id).map((point, index) => ({ ...point, values: [20 + index * 7, 0, null], secondary: [50, 0, 2] }))) };

test("real road/locality positions and readable addresses share IDW values across actual source periods", () => {
  const points = createPlacePoints(data, boundary, places);
  assert.equal(points.length, places.filter((place) => boundaryContains(boundary, place.lat, place.lng)).length);
  assert.equal(new Set(points.map((point) => point.id)).size, points.length);
  assert.ok(points.some((point) => point.label.includes("ถนนสุขุมวิท") && point.area.includes("เขตคลองเตย")));
  assert.ok(points.some((point) => point.label.includes("ตำบล") && point.area.includes("นนทบุรี")));
  for (const point of points) {
    assert.equal(point.lat, point.place.lat);
    assert.equal(point.lng, point.place.lng);
    assert.equal(point.label, placeLabel(point.place));
    assert.equal(point.area, placeArea(point.place));
    assert.equal(point.values.length, data.steps.length);
    assert.equal(point.values[0], interpolateMapValue(data.points, 0, "primary", point.lat, point.lng));
    assert.equal(point.values[1], 0);
    assert.equal(point.values[2], null);
    assert.equal(point.secondary[2], 2);
  }
  const onlyBangkok = createPlacePoints(data, bangkok, regionPlaces(places, "bangkok"));
  assert.ok(onlyBangkok.length >= 170);
  assert.ok(onlyBangkok.every((point) => point.place.provinceId === "bangkok"));
});

test("unsupported boundaries, unavailable feeds and insufficient nearby anchors do not fabricate estimates", () => {
  assert.deepEqual(createPlacePoints(data, null, places), []);
  assert.deepEqual(createPlacePoints(data, boundary, []), []);
  assert.deepEqual(createPlacePoints({ ...data, status: "unavailable" }, boundary, places), []);
  const sparse = createPlacePoints({ ...data, points: data.points.slice(0, 2) }, bangkok, places);
  assert.ok(sparse.length > 0);
  assert.ok(sparse.every((point) => point.values.every((value) => value === null)));
  const away = createPlacePoints({ ...data, points: data.points.map((point) => ({ ...point, lat: 0, lng: 0 })) }, boundary, places);
  assert.ok(away.every((point) => point.values[0] === null));
});

test("geographic catalog covers all six provinces with unique localities, traceable road positions and district overviews", () => {
  assert.equal(new Set(places.map((place) => place.id)).size, places.length);
  assert.ok(catalog.sources.some((source) => source.name.includes("OpenStreetMap")));
  assert.match(catalog.license, /odbl/);
  for (const province of provinces) {
    const localities = regionPlaces(places, province.id);
    assert.ok(localities.length > 0);
    const districts = [...new Set(localities.map((place) => place.district))];
    for (const district of districts) assert.equal(localities.filter((place) => place.district === district && place.overview).length, 1);
    for (const place of localities) {
      assert.ok(Number.isFinite(place.lat) && Number.isFinite(place.lng));
      assert.ok(place.district && place.subdistrict);
      if (place.road) assert.ok(place.osmWayId > 0);
      else assert.equal(place.osmWayId, undefined);
    }
  }
});

test("addresses disambiguate road segments, preserve Bangkok terms and do not invent missing roads", () => {
  const sukhumvit = places.filter((place) => place.road === "ถนนสุขุมวิท");
  assert.ok(new Set(sukhumvit.map(placeAddress)).size > 1);
  const bangkokPlace = sukhumvit.find((place) => place.provinceId === "bangkok");
  assert.match(placeAddress(bangkokPlace), /ถนนสุขุมวิท · แขวง.+ · เขต.+ · กรุงเทพมหานคร/);
  const noRoad = places.find((place) => !place.road);
  assert.equal(placeLabel(noRoad), `${noRoad.subdistrictType}${noRoad.subdistrict}`);
  assert.doesNotMatch(placeAddress(noRoad), /ถนน/);
  assert.equal(placeVisible({ ...bangkokPlace, overview: false }, 9, false), false);
  assert.equal(placeVisible({ ...bangkokPlace, overview: false }, 10, false), true);
  assert.equal(placeVisible({ ...bangkokPlace, overview: false }, 8, true), true);
  assert.equal(placeVisible({ ...bangkokPlace, overview: true }, 8, false), true);
  assert.equal(placeVisible({ ...bangkokPlace, overview: false }, 8, false, "bangkok"), false);
  assert.equal(placeVisible(places.find((place) => place.provinceId === "nonthaburi" && !place.overview), 8, false, "nonthaburi"), true);
});

test("area watch groups real district geography even when the road name contains another province", () => {
  const place = places.find((place) => place.provinceId === "bangkok" && place.road?.includes("นนทบุรี"));
  assert.ok(place);
  const points = createPlacePoints({ ...data, layer: "heat", points: data.points.map((point) => ({ ...point, values: [42, 42, 42] })) }, boundary, [place]);
  const watches = buildAreaWatch({ ...data, layer: "heat", points }, day.date);
  assert.equal(watches.length, 1);
  assert.equal(watches[0].area, placeArea(place));
  assert.match(watches[0].area, /กรุงเทพมหานคร/);
});

test("readable rainfall explanations preserve zero, chosen date and hourly accumulation semantics", () => {
  assert.match(placeReading("rain", "primary", 0, hour).title, /โอกาสฝนค่อนข้างน้อย/);
  assert.match(placeReading("rain", "primary", 90, day).description, /วันที่เลือก/);
  assert.doesNotMatch(placeReading("rain", "primary", 90, day).description, /วันนี้|น้ำท่วม/);
  assert.match(placeReading("rain", "primary", 90, hour).action, /เตรียมร่ม/);
  assert.equal(placeReading("rain", "secondary", 90, hour).priority, 1);
  assert.equal(placeReading("rain", "secondary", 90, day).priority, 2);
  assert.match(placeReading("rain", "secondary", 0, hour).title, /แบบจำลองยังไม่ให้ฝน/);
  assert.equal(placeReading("rain", "primary", null, hour).priority, -1);
});

test("place lists order signals first and keep unavailable readings distinct from good conditions", () => {
  const points = [null, 0, 37.5, 80, 50].map((value, index) => ({ id: String(index), label: String(index), values: [value], secondary: [] }));
  const readings = sortedPlaceReadings(points, 0, "air", "primary", day);
  assert.deepEqual(readings.map((reading) => reading.value), [80, 50, 37.5, 0, null]);
  assert.match(readings.at(-1).title, /ยังประมาณค่าไม่ได้/);
  assert.equal(placeReading("heat", "primary", 42, hour).priority, 2);
  assert.match(placeReading("heat", "secondary", 35, hour).description, /อุณหภูมิอากาศ/);
  assert.doesNotMatch(placeReading("heat", "secondary", 35, hour).description, /ดัชนีความร้อน/);
});
