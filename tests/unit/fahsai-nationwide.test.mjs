import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFallbackPayload,
  buildSyntheticTide24h,
  calculateDewPointC,
  calculateHeatIndexC,
  calculateMarshallPalmerDbz,
  calculateThaiAqiFromPm25,
  calculateUsAqiFromPm25,
  formatTmdRainText,
  getTmdRainCoverageLabel,
  getTmdRainIntensityLabel,
  REGIONS,
  THAILAND_AREAS,
  toTmdRainAreaPercent,
} from "../../app/lib/fahsai-data.ts";
import {
  classifyAreaRisk,
  classifyDailyPointRisk,
  classifyHourlyPointRisk,
  getFriendlyAdvice,
  getNearbyAreas,
  getScienceExplainer,
  getTopicRelevantAreas,
  getTopicRiskBands,
  getTopicScopeConfig,
  pinMetricLabel,
  projectAreaAtDayHour,
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

test("classifyHourlyPointRisk, classifyDailyPointRisk, and projectAreaAtDayHour support severity-colored charts and map day/time forecast selection", () => {
  const payload = buildFallbackPayload();
  const bkk = payload.areas.find(a => a.id === "bangkok");
  assert.ok(bkk);

  for (const t of TOPICS) {
    for (const h of bkk.hourly) {
      const hSev = classifyHourlyPointRisk(bkk, h, t.id);
      assert.ok(hSev.tier >= 1 && hSev.tier <= 5);
      assert.ok(hSev.color.startsWith("#"));
      assert.ok(hSev.shortTag.length > 0);
    }
    for (const d of bkk.daily) {
      const dSev = classifyDailyPointRisk(bkk, d, t.id);
      assert.ok(dSev.tier >= 1 && dSev.tier <= 5);
      assert.ok(dSev.color.startsWith("#"));
      assert.ok(dSev.shortTag.length > 0);
    }
  }

  // Projecting to Tomorrow (dayIdx=1) at 16:00 (hourIdx=16) updates current metrics to match that forecast slot
  const tomorrow16 = projectAreaAtDayHour(bkk, 1, 16, false);
  assert.equal(tomorrow16.hourly.length, 24);
  assert.equal(tomorrow16.current.tempC, tomorrow16.hourly[16].tempC);
  assert.equal(tomorrow16.current.rainProb, tomorrow16.hourly[16].rainProb);
});

test("TMD rain area coverage (% ของพื้นที่) and rainfall intensity criteria match official Thai Meteorological Department standards", () => {
  assert.equal(toTmdRainAreaPercent(0), 0);
  assert.equal(toTmdRainAreaPercent(14), 10);
  assert.equal(toTmdRainAreaPercent(36), 40);
  assert.equal(toTmdRainAreaPercent(62), 60);
  assert.equal(toTmdRainAreaPercent(95), 90);

  assert.equal(getTmdRainCoverageLabel(0), "ไม่มีฝน");
  assert.equal(getTmdRainCoverageLabel(20), "ฝนบางแห่ง");
  assert.equal(getTmdRainCoverageLabel(30), "ฝนเป็นแห่งๆ");
  assert.equal(getTmdRainCoverageLabel(60), "ฝนกระจาย");
  assert.equal(getTmdRainCoverageLabel(70), "ฝนเกือบทั่วไป");
  assert.equal(getTmdRainCoverageLabel(90), "ฝนทั่วไป");

  assert.equal(getTmdRainIntensityLabel(0), "ไม่มีฝน");
  assert.equal(getTmdRainIntensityLabel(5.2), "ฝนเล็กน้อย");
  assert.equal(getTmdRainIntensityLabel(22.0), "ฝนปานกลาง");
  assert.equal(getTmdRainIntensityLabel(55.0), "ฝนหนัก");
  assert.equal(getTmdRainIntensityLabel(110.0), "ฝนหนักมาก");

  assert.ok(formatTmdRainText(60, 18.5).includes("60% ของพื้นที่"));
  assert.ok(formatTmdRainText(60, 18.5).includes("ฝนกระจาย"));
});

test("scientific formulas: US EPA & Thai PCD Piecewise AQI, NOAA Rothfusz Heat Index, Magnus-Tetens Dew Point, Marshall-Palmer dBZ, and Astronomical Lunar Tide", () => {
  // US EPA Piecewise Linear AQI
  assert.equal(calculateUsAqiFromPm25(0), 0);
  assert.equal(calculateUsAqiFromPm25(9.0), 50);
  assert.equal(calculateUsAqiFromPm25(35.4), 100);
  assert.equal(calculateUsAqiFromPm25(55.4), 150);
  assert.ok(calculateUsAqiFromPm25(125.4) === 200);

  // Thai PCD AQI
  assert.equal(calculateThaiAqiFromPm25(15.0), 25);
  assert.equal(calculateThaiAqiFromPm25(25.0), 50);
  assert.equal(calculateThaiAqiFromPm25(37.5), 100);
  assert.equal(calculateThaiAqiFromPm25(75.0), 200);

  // NOAA Rothfusz Heat Index
  const hiCool = calculateHeatIndexC(22, 60);
  assert.ok(hiCool >= 21.5 && hiCool <= 23.0);
  const hiHotHumid = calculateHeatIndexC(35, 70);
  assert.ok(hiHotHumid > 44, `Expected Rothfusz HI at 35°C / 70% RH to exceed 44°C, got ${hiHotHumid}`);

  // Magnus-Tetens Dew Point
  const td = calculateDewPointC(30, 70);
  assert.ok(td > 23 && td < 25, `Expected dew point around 23.9°C, got ${td}`);

  // Marshall-Palmer Radar Reflectivity (Z = 200 * R^1.6)
  const dbzLight = calculateMarshallPalmerDbz(1.0); // Z=200 => 10*log10(200) = 23 dBZ
  assert.equal(dbzLight, 23);
  const dbzHeavy = calculateMarshallPalmerDbz(25.0);
  assert.ok(dbzHeavy >= 44 && dbzHeavy <= 50);

  // Astronomical Lunar Phase & Daily Transit Shift
  const refDate = new Date("2025-01-29T12:36:00Z"); // New Moon (Spring Tide)
  const springTide = buildSyntheticTide24h(1.2, 0.5, 0, refDate);
  const neapTide = buildSyntheticTide24h(1.2, 0.5, 7, refDate); // Quarter Moon (~7 days later)
  assert.ok(
    springTide.highTideMsl > neapTide.highTideMsl,
    `Expected Spring Tide (${springTide.highTideMsl}) > Neap Tide (${neapTide.highTideMsl})`
  );

  // Verify 7-day x 24-hour hourlyByDay matrix in payload
  const payload = buildFallbackPayload();
  const phuket = payload.areas.find(a => a.id === "phuket");
  assert.ok(phuket);
  assert.equal(phuket.hourlyByDay?.length, 7);
  for (let d = 0; d < 7; d++) {
    assert.equal(phuket.hourlyByDay[d].length, 24);
  }
});

test("FahSaiLeafletMap and HydroQgisLayout use lazy GeoJSON loading, Canvas rendering, and in-place style updates", async () => {
  const { readFile } = await import("node:fs/promises");
  const mapSource = await readFile(
    new URL("../../app/components/fahsai/fahsai-leaflet-map.tsx", import.meta.url),
    "utf8"
  );
  const hydroSource = await readFile(
    new URL("../../app/components/hydro/hydro-qgis-layout.tsx", import.meta.url),
    "utf8"
  );

  // Lazy dynamic imports instead of static top-level GeoJSON bundle bloat
  assert.doesNotMatch(mapSource, /^import thailandProvincesGeoJson from/m);
  assert.doesNotMatch(mapSource, /^import bangkokDistrictsGeoJson from/m);
  assert.match(mapSource, /import\("\.\.\/\.\.\/data\/thailand-provinces-geojson\.json"\)/);
  assert.match(mapSource, /import\("\.\.\/\.\.\/data\/bangkok-districts\.json"\)/);

  // Hardware-accelerated canvas & in-place style/tooltip updates
  assert.match(mapSource, /preferCanvas:\s*true/);
  assert.match(mapSource, /layer\.setStyle\(/);
  assert.match(mapSource, /featureLayer\.setTooltipContent\(/);
  assert.match(mapSource, /existing\.setIcon\(icon\)/);

  // Hydro QGIS layout lazy-loads and caches projected basin paths
  assert.doesNotMatch(hydroSource, /^import upstreamBasinsGeo from/m);
  assert.doesNotMatch(hydroSource, /^import coreGeographyGeo from/m);
  assert.match(hydroSource, /loadProjectedBasinBoundaryPaths/);
});

test("FahSaiApp includes Global Mode Switcher, Data Provenance Banner, URL query sync, and persistent Dark Mode sync", async () => {
  const { readFile } = await import("node:fs/promises");
  const appSource = await readFile(
    new URL("../../app/components/fahsai/fahsai-app.tsx", import.meta.url),
    "utf8"
  );

  // Global Mode Switcher Bar
  assert.match(appSource, /fs-global-mode-bar/);
  assert.match(appSource, /แถบสลับโหมดระบบพยากรณ์และเฝ้าระวังหลัก/);

  // Data Provenance & Scientific Standards Banner
  assert.match(appSource, /fs-provenance-banner/);
  assert.match(appSource, /สถานะความสดของข้อมูลและมาตรฐานวิชาการ/);
  assert.match(appSource, /เกณฑ์ % ฝนของพื้นที่ \(กรมอุตุนิยมวิทยา TMD\)/);

  // URL Query Parameter Sync (?topic=&province=&region=&day=)
  assert.match(appSource, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(appSource, /window\.history\.replaceState/);
  assert.match(appSource, /handleCopyShareLink/);

  // Persistent Dark Mode & Basemap Theme Sync
  assert.match(appSource, /bkk-air-theme/);
  assert.match(appSource, /document\.documentElement\.dataset\.theme/);
});

test("Step 4 architecture: modular sub-components and single source of truth for Bangkok time helpers", async () => {
  const { readFile, access } = await import("node:fs/promises");
  const appSource = await readFile(
    new URL("../../app/components/fahsai/fahsai-app.tsx", import.meta.url),
    "utf8"
  );
  const dataSource = await readFile(
    new URL("../../app/lib/fahsai-data.ts", import.meta.url),
    "utf8"
  );

  // Modular sub-components used by FahSaiApp
  assert.match(appSource, /<FahSaiSeverityCharts/);
  assert.match(appSource, /<FahSaiInsightsSections/);

  // Single source of truth for getBangkokHour / getBangkokClockText from observation-time.ts
  assert.match(dataSource, /from "\.\/observation-time\.ts"/);
  assert.doesNotMatch(dataSource, /export function getBangkokHour/);

  // Verify dead code files are removed
  let backupExists = true;
  try {
    await access(new URL("../../app/backup", import.meta.url));
  } catch {
    backupExists = false;
  }
  assert.equal(backupExists, false, "app/backup directory should be removed");
});
