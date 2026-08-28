import assert from "node:assert/strict";
import test from "node:test";
import {
  formatProbabilityContext,
  getDailyRainNarrative,
  getRainAdvisory,
  getRainLikelihood,
} from "../../app/lib/rain-communication.ts";

function rainDay(overrides = {}) {
  return {
    dateKey: "2026-08-28",
    weekday: "ศุกร์",
    date: "28 ส.ค.",
    dailyPeakAreaMeanProbability: 100,
    rainMeanMm: 0.5,
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
    dailyPeakAreaMeanProbability: 35,
    rainMeanMm: 38,
    rainMaxMm: 78,
    wetHours: 8,
  });
  const advisory = getRainAdvisory(lowProbabilityHeavyRain, 12, 75);
  assert.equal(advisory.risk, "ติดตามผลกระทบ");
  assert.equal(advisory.impact, "อาจมีน้ำท่วมขัง");
});

test("medium-range probability is communicated as a band", () => {
  assert.equal(formatProbabilityContext(87, 0), "ค่าสูงสุดของแบบจำลอง 87%");
  assert.equal(formatProbabilityContext(87, 3), "ช่วงแบบจำลอง 80–100%");
  assert.equal(getRainLikelihood(87).label, "สูงมาก");
});
