import assert from "node:assert/strict";
import test from "node:test";
import {
  formatProbabilityContext,
  getDailyRainNarrative,
  getRainAdvisory,
  getRainLikelihood,
  getRainWatchLevel,
} from "../../app/lib/rain-communication.ts";

function rainDay(overrides = {}) {
  return {
    dateKey: "2026-08-28",
    weekday: "ศุกร์",
    date: "28 ส.ค.",
    dailyAreaMeanProbability: 100,
    dailyAreaMaxProbability: 100,
    rainMeanMm: 0.5,
    rainWatchMm: 2,
    rainMaxMm: 2,
    wetHours: 1,
    peakWindow: "15:00–18:00 น.",
    weatherCode: 61,
    ...overrides,
  };
}

test("high model probability with little short-lived rain is not described as heavy rain", () => {
  const day = rainDay();
  assert.equal(getDailyRainNarrative(day), "มีโอกาสเกิดฝนช่วงสั้นบางพื้นที่");
  const advisory = getRainAdvisory(day, 0.4, 22);
  assert.equal(advisory.title, "แนวโน้มสูง แต่ปริมาณรวมยังไม่มาก");
  assert.equal(advisory.impact, "จำกัดเป็นบางช่วง");
  assert.doesNotMatch(`${advisory.title} ${advisory.desc} ${advisory.impact}`, /น้ำท่วมขัง|ฝนหนักถึงหนักมาก/);
});

test("waterlogging watch is driven by accumulated rain, not probability alone", () => {
  const lowProbabilityHeavyRain = rainDay({
    dailyAreaMeanProbability: 35,
    rainMeanMm: 38,
    rainWatchMm: 78,
    rainMaxMm: 78,
    wetHours: 8,
  });
  const advisory = getRainAdvisory(lowProbabilityHeavyRain, 12, 75);
  assert.equal(advisory.risk, "ติดตามผลกระทบ");
  assert.equal(advisory.impact, "อาจมีน้ำท่วมขัง");
});

test("probability context states its time and spatial aggregation", () => {
  assert.equal(formatProbabilityContext(87, "daily"), "โอกาสเกิดฝนช่วงใดช่วงหนึ่ง เฉลี่ยจากจุดแบบจำลอง 87%");
  assert.equal(formatProbabilityContext(87, "window"), "เฉลี่ยจากจุดแบบจำลองของค่าสูงสุดในช่วง 87%");
  assert.equal(getRainLikelihood(87).label, "สูงมาก");
});

test("rain watch tiers follow daily accumulation classes and ignore probability", () => {
  assert.equal(getRainWatchLevel(null, null).key, "unavailable");
  assert.equal(getRainWatchLevel(0, 0).key, "dry");
  assert.equal(getRainWatchLevel(5, 10).key, "light");
  assert.equal(getRainWatchLevel(12, 35).key, "moderate");
  assert.equal(getRainWatchLevel(18, 90).key, "heavy");
  assert.equal(getRainWatchLevel(40, 90.1).key, "very-heavy");
});
