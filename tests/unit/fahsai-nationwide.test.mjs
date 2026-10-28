import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFallbackPayload,
  REGIONS,
  THAILAND_AREAS,
} from "../../app/lib/fahsai-data.ts";
import {
  classifyAreaRisk,
  getFriendlyAdvice,
  getNearbyAreas,
  getScienceExplainer,
  getTopicRelevantAreas,
  getTopicRiskBands,
  getTopicScopeConfig,
  pinMetricLabel,
  projectThailandGeo,
  REGION_BBOXES,
  TOPICS,
} from "../../app/components/fahsai/fahsai-helpers.ts";
import thailandProvincesGeoJson from "../../app/data/thailand-provinces-geojson.json" with { type: "json" };

test("THAILAND_AREAS covers all 77 official provinces across all Thailand regions", () => {
  assert.equal(THAILAND_AREAS.length, 77);
  const regionIds = new Set(THAILAND_AREAS.map(a => a.regionId));
  for (const r of ["north", "northeast", "central", "east", "west", "south-gulf", "south-andaman"]) {
    assert.ok(regionIds.has(r), `Missing region ${r}`);
  }
  assert.equal(REGIONS.length, 8);
});

test("each topic has distinct geographic scope (getTopicRelevantAreas) and bespoke presentation style", () => {
  const payload = buildFallbackPayload();
  const areas = payload.areas;

  // tide: only coastal & tidal estuary provinces (29 provinces), never Chiang Mai / Loei
  const tideAreas = getTopicRelevantAreas(areas, "tide");
  assert.equal(tideAreas.length, 29);
  assert.ok(tideAreas.every(a => a.isCoastal || a.current.highTideMsl > 0.1));
  assert.ok(!tideAreas.some(a => a.id === "chiang-mai" || a.id === "loei"));

  // wave: strictly coastal & marine island provinces (23 provinces)
  const waveAreas = getTopicRelevantAreas(areas, "wave");
  assert.equal(waveAreas.length, 23);
  assert.ok(waveAreas.every(a => a.isCoastal));

  // winter: only mountain & cool-breeze northern/isan/western provinces (>= 15 provinces)
  const winterAreas = getTopicRelevantAreas(areas, "winter");
  assert.ok(winterAreas.length >= 15);
  assert.ok(winterAreas.some(a => a.id === "chiang-mai"));
  assert.ok(winterAreas.some(a => a.id === "mae-hong-son"));
  assert.ok(!winterAreas.some(a => a.id === "phuket" || a.id === "songkhla"));

  // Every topic has a distinct presentationStyle in getTopicScopeConfig
  const styles = new Set(TOPICS.map(t => getTopicScopeConfig(t.id).presentationStyle));
  assert.equal(styles.size, 10);
});

test("getNearbyAreas computes local-proximity neighborhood for uncluttered 3D Digital Twin", () => {
  const payload = buildFallbackPayload();
  for (const center of payload.areas) {
    const nodes = getNearbyAreas(center, payload.areas, 3);
    assert.equal(nodes.length, 4);
    assert.equal(nodes[0].isCenter, true);
    assert.equal(nodes[0].area.id, center.id);
    assert.equal(nodes[0].distanceKm, 0);
    for (const neighbor of nodes.slice(1)) {
      assert.equal(neighbor.isCenter, false);
      assert.ok(neighbor.distanceKm > 0);
      assert.ok(neighbor.compassLabel.length > 0);
      assert.ok(neighbor.relX >= -1 && neighbor.relX <= 1);
      assert.ok(neighbor.relZ >= -1 && neighbor.relZ <= 1);
    }
  }
});

test("thailand-provinces-geojson.json contains all 77 official DMR administrative provinces", () => {
  assert.equal(thailandProvincesGeoJson.type, "FeatureCollection");
  assert.equal(thailandProvincesGeoJson.features.length, 77);
  for (const feature of thailandProvincesGeoJson.features) {
    assert.ok(feature.properties.PROV_CODE);
    assert.ok(feature.properties.PROV_NAM_T);
    assert.ok(feature.properties.mappedAreaId);
  }
});

test("TOPICS provides all 10 comprehensive citizen topic cards", () => {
  const topicIds = [
    "rain",
    "sky",
    "tide",
    "wave",
    "air",
    "heat",
    "winter",
    "tourism",
    "risk",
    "suitable",
  ];
  assert.deepEqual(TOPICS.map(t => t.id), topicIds);
  for (const t of TOPICS) {
    const bands = getTopicRiskBands(t.id);
    assert.equal(bands.length, 5, `Topic ${t.id} should have 5 risk/suitability bands`);
    const explainer = getScienceExplainer(t.id);
    assert.equal(explainer.cards.length, 3, `Topic ${t.id} should have 3 science explainer cards`);
  }
});

test("buildFallbackPayload computes complete nationwide intelligence, tourism, risk, suitability, and lifestyle metrics", () => {
  const payload = buildFallbackPayload();
  assert.equal(payload.areas.length, 77);

  for (const area of payload.areas) {
    assert.equal(area.hourly.length, 24);
    assert.equal(area.daily.length, 7);
    assert.ok(area.current.tourismScore >= 35 && area.current.tourismScore <= 100);
    assert.ok(area.current.suitabilityScore >= 35 && area.current.suitabilityScore <= 100);
    assert.ok(area.current.multiHazardTier >= 1 && area.current.multiHazardTier <= 5);
    assert.ok(area.current.lifestyle.laundryScore >= 15 && area.current.lifestyle.laundryScore <= 100);
    assert.ok(area.current.lifestyle.outdoorScore >= 15 && area.current.lifestyle.outdoorScore <= 100);

    for (const t of TOPICS) {
      const tier = classifyAreaRisk(area, t.id);
      assert.ok(tier >= 1 && tier <= 5);
      const advice = getFriendlyAdvice(area, t.id);
      assert.ok(advice.headline.length > 0);
      assert.ok(advice.action.length > 0);
      const label = pinMetricLabel(area, t.id);
      assert.ok(label.length > 0);
    }

    const pt = projectThailandGeo(area.lat, area.lng, REGION_BBOXES.all);
    assert.ok(Number.isFinite(pt.x) && Number.isFinite(pt.y));
  }
});
