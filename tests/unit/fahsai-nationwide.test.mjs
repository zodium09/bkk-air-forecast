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
  getScienceExplainer,
  getTopicRiskBands,
  pinMetricLabel,
  projectThailandGeo,
  REGION_BBOXES,
  TOPICS,
} from "../../app/components/fahsai/fahsai-helpers.ts";

test("THAILAND_AREAS covers 24 provinces across all Thailand regions", () => {
  assert.equal(THAILAND_AREAS.length, 24);
  const regionIds = new Set(THAILAND_AREAS.map(a => a.regionId));
  for (const r of ["north", "northeast", "central", "east", "west", "south-gulf", "south-andaman"]) {
    assert.ok(regionIds.has(r), `Missing region ${r}`);
  }
  assert.equal(REGIONS.length, 8);
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
  assert.equal(payload.areas.length, 24);

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
