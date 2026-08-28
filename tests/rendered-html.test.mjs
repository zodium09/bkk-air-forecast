import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

const environment = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
};

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

test("server-renders the two-topic BKK Air Forecast homepage", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    environment,
    executionContext,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="th">/i);
  assert.match(html, /BKK AIR FORECAST/);
  assert.match(html, /มองกรุงเทพฯ และปริมณฑล/);
  assert.match(html, /พยากรณ์ฝุ่น/);
  assert.match(html, /พยากรณ์ฝน/);
  assert.match(html, /href="\/air"/);
  assert.match(html, /href="\/rain"/);
  assert.match(html, /เปิดแผนที่พยากรณ์ฝุ่น PM2\.5 กรุงเทพฯ/);
  assert.match(html, /เปิดแผนที่พยากรณ์ฝนกรุงเทพฯ/);
  assert.match(html, /home-topic-air/);
  assert.match(html, /home-topic-rain/);
  assert.match(html, /LIVE OUTLOOK/);
  assert.match(html, /ภาพรวมกรุงเทพฯ–ปริมณฑล/);
  assert.match(html, /PM2\.5 วันถัดไป/);
  assert.match(html, /TMD RadarGIS/);
  assert.doesNotMatch(html, /กำลังโหลดข้อมูล|กำลังโหลดพยากรณ์ฝน/);
});

test("topic cards and product navigation use resilient document links", async () => {
  const homepage = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const productNav = await readFile(new URL("../app/components/outlook-nav.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(homepage, /from ["']next\/link["']/);
  assert.doesNotMatch(productNav, /from ["']next\/link["']/);
  assert.match(homepage, /<a className="home-topic home-topic-air" href="\/air"/);
  assert.match(homepage, /<a className="home-topic home-topic-rain" href="\/rain"/);
  assert.match(productNav, /<a href={`\/air\${query}`}/);
  assert.match(productNav, /<a href={`\/rain\${query}`}/);
});
test("server-renders the BKK Air forecast product", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/air", { headers: { accept: "text/html" } }),
    environment,
    executionContext,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /BKK Air Forecast/);
  assert.match(html, /แผนที่พยากรณ์/);
  assert.match(html, /PM2\.5 กรุงเทพฯ/);
  assert.match(html, /กำลังโหลดข้อมูล/);
  assert.doesNotMatch(html, /D\+(?:<!-- -->)?[1-7]/);
  assert.match(html, /ค่าเฉลี่ย (?:<!-- -->)?กรุงเทพฯ–ปริมณฑล/);
  assert.match(html, /<option value="metro" selected="">กรุงเทพมหานครและปริมณฑล(?:<!-- -->)? \(ภาพรวม\)<\/option>/);
  assert.match(html, /<option value="nonthaburi">นนทบุรี<\/option>/);
  assert.equal((html.match(/<option value=/g) ?? []).length, 7);
  assert.match(html, /แนวโน้ม 7 วัน/);
  assert.match(html, /7 วันล่วงหน้า/);
  assert.match(html, /เลือกชั้นข้อมูลแผนที่/);
  assert.match(html, /ตำแหน่งของฉัน/);
  assert.match(html, /พยากรณ์รายตำแหน่ง/);
  assert.doesNotMatch(html, /ความเชื่อมั่นของโมเดล/);
  assert.match(html, /พื้นผิว CAMS \+ residual ตามลม/);
  assert.doesNotMatch(html, /จุดตรวจวัด<\/label>|จุดตรวจวัด<\/span>/);
  assert.match(html, /กำลังโหลดขอบเขต(?:<!-- -->)?กรุงเทพมหานครและปริมณฑล/);
  assert.match(html, /href="\/rain\?province=metro"/);
  assert.match(html, /href="\/"/);
  assert.doesNotMatch(html, /IDW power 2|interpolation|backtest/);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("server-renders the Bangkok rain forecast page", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/rain", { headers: { accept: "text/html" } }),
    environment,
    executionContext,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /BKK AIR FORECAST · RAIN/);
  assert.match(html, /ฝน(?:<!-- -->)? · (?:<!-- -->)?กรุงเทพฯ/);
  assert.match(html, /กำลังโหลดพยากรณ์ฝน/);
  assert.match(html, /เลือกวันพยากรณ์ฝน/);
  assert.match(html, /day-peak-time/);
  assert.match(html, /7 วันล่วงหน้า/);
  assert.match(html, /แนวโน้ม 7 วัน/);
  assert.match(html, /จุดประมาณการ/);
  assert.match(html, /ที่มาข้อมูล/);
  assert.match(html, /href="\/"/);
  assert.doesNotMatch(html, /จุดตรวจวัดฝน|สถานีฝน/);
  assert.match(html, /แบบจำลองพยากรณ์/);
  assert.match(html, /เรดาร์ฝน TMD/);
  assert.match(html, /ฝนที่ตรวจพบตอนนี้และแนวโน้ม 0–3 ชม./);
  assert.match(html, /เลือกชั้นข้อมูลแผนที่ฝน/);
  assert.match(html, /สัญลักษณ์สภาพอากาศ/);
  assert.match(html, /3 ตำแหน่งต่อจังหวัด/);
  assert.match(html, /แนวโน้มฝนในพื้นที่/);
  assert.match(html, /ตอนนี้ฝนตกไหม/);
  assert.match(html, /แนวโน้ม ปริมาณ และผลกระทบ/);
  assert.doesNotMatch(html, /โอกาสฝนภาพรวม/);
  assert.match(html, /ตำแหน่งของฉัน/);
  assert.match(html, /พยากรณ์รายตำแหน่ง/);
  assert.doesNotMatch(html, /จุดประมาณการ<\/label>/);
});

test("map location forecasts use private geolocation and bounded IDW without storing coordinates", async () => {
  const airDashboard = await readFile(new URL("../app/forecast-dashboard.tsx", import.meta.url), "utf8");
  const rainDashboard = await readFile(new URL("../app/rain/rain-dashboard.tsx", import.meta.url), "utf8");
  const locationCard = await readFile(new URL("../app/components/location-forecast-card.tsx", import.meta.url), "utf8");
  const homeDashboard = await readFile(new URL("../app/home-dashboard.tsx", import.meta.url), "utf8");
  for (const dashboard of [airDashboard, rainDashboard]) {
    assert.match(dashboard, /navigator\.geolocation\.getCurrentPosition/);
    assert.match(dashboard, /map\.on\("click"/);
    assert.match(dashboard, /METRO_REGION_ID/);
    assert.match(dashboard, /interpolateIdw/);
    assert.doesNotMatch(dashboard, /localStorage|sessionStorage/);
  }
  assert.match(locationCard, /เป็นค่าประมาณเชิงพื้นที่ใกล้ตำแหน่ง/);
  assert.match(homeDashboard, /\/api\/forecast\?province=metro/);
  assert.match(homeDashboard, /\/api\/rain-forecast\?province=metro/);
  assert.match(homeDashboard, /\/api\/tmd-radar/);
  assert.doesNotMatch(homeDashboard, /Math\.random|demo|mock/i);
});

test("rain day changes preserve the selected three-hour window and use a compact horizontal mobile strip", async () => {
  const dashboard = await readFile(new URL("../app/rain/rain-dashboard.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const selectDayHandler = dashboard.match(/const selectDay = \(index: number\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? "";
  assert.match(selectDayHandler, /setSelectedDay\(index\)/);
  assert.doesNotMatch(selectDayHandler, /setSelectedWindowIndex/);
  assert.doesNotMatch(dashboard, /rain-day-mobile-select/);
  assert.match(styles, /@media \(max-width: 780px\)[\s\S]*?\.rain-sidebar-days \{[\s\S]*?scroll-snap-type: x proximity;/);
  assert.match(styles, /\.rain-sidebar-day-btn \{[\s\S]*?min-width: 86px;[\s\S]*?min-height: 44px;/);
  assert.doesNotMatch(styles, /\.rain-sidebar-days \{ display: none; \}/);
});

test("rain map uses three interactive in-boundary weather labels per province", async () => {
  const dashboard = await readFile(new URL("../app/rain/rain-dashboard.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /selectWeatherMarkers/);
  assert.match(dashboard, /selectMapLabelLocations\(boundary\)/);
  assert.match(dashboard, /interpolateIdw\(location\.lng, location\.lat, probabilityValues\)/);
  assert.match(dashboard, /interpolateIdw\(location\.lng, location\.lat, rainValues\)/);
  assert.match(dashboard, /marker\.bindTooltip/);
  assert.match(dashboard, /weather-emoji-badge/);
  assert.match(dashboard, /3 ตำแหน่งต่อจังหวัด · อยู่ภายในขอบเขต/);
  assert.match(dashboard, /const \[showLabels, setShowLabels\] = useState\(false\)/);
  assert.doesNotMatch(dashboard, /class=\\"map-val-badge/);
});

test("rain defaults to Bangkok with radar and weather emoji opt-in", async () => {
  const dashboard = await readFile(new URL("../app/rain/rain-dashboard.tsx", import.meta.url), "utf8");
  const homeDashboard = await readFile(new URL("../app/home-dashboard.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /useState<RegionId>\("bangkok"\)/);
  assert.match(dashboard, /requestedProvince \? getRegion\(requestedProvince\)\.id : "bangkok"/);
  assert.match(dashboard, /const \[showLabels, setShowLabels\] = useState\(false\)/);
  assert.match(dashboard, /const \[radarEnabled, setRadarEnabled\] = useState\(false\)/);
  assert.match(dashboard, /const \[radarLoadState, setRadarLoadState\] = useState<[^>]+>\("idle"\)/);
  assert.match(homeDashboard, /href="\/rain\?province=bangkok"/);
});

test("rain palette is white to cyan, blue, and purple without green", async () => {
  const dashboard = await readFile(new URL("../app/rain/rain-dashboard.tsx", import.meta.url), "utf8");
  const probabilityStops = dashboard.match(/const probabilityStops = \[[\s\S]*?\n\];/)?.[0] ?? "";
  assert.match(probabilityStops, /\[255, 255, 255\]/);
  assert.match(probabilityStops, /\[186, 230, 253\]/);
  assert.match(probabilityStops, /\[37, 99, 235\]/);
  assert.match(probabilityStops, /\[109, 40, 217\]/);
  assert.doesNotMatch(probabilityStops, /16, 185, 129/);
});

test("air and rain dashboards expose a persistent dark mode control", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const nav = await readFile(new URL("../app/components/outlook-nav.tsx", import.meta.url), "utf8");
  const toggle = await readFile(new URL("../app/components/theme-toggle.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(layout, /bkk-air-theme/);
  assert.match(nav, /<ThemeToggle/);
  assert.match(toggle, /localStorage\.setItem\(THEME_STORAGE_KEY/);
  assert.match(styles, /html\[data-theme="dark"\]/);
  assert.match(styles, /\.theme-toggle/);
});

test("boundary adapter uses the official BMA district layer", async () => {
  const route = await readFile(new URL("../app/api/bangkok-boundary/route.ts", import.meta.url), "utf8");
  assert.match(route, /bmagis\.bangkok\.go\.th\/arcgis\/rest\/services\/BMA\/DISTRICT\/MapServer\/0\/query/);
  assert.match(route, /outSR=4326/);
  assert.match(route, /CDN-Cache-Control/);
  assert.match(route, /max-age=604800/);
});

test("metro boundary adapter uses the official DMR province layer", async () => {
  const route = await readFile(new URL("../app/api/province-boundary/route.ts", import.meta.url), "utf8");
  assert.match(route, /gisportal\.dmr\.go\.th\/arcgis\/rest\/services\/Data_Production\/WAB_VIEW\/MapServer\/8\/query/);
  assert.match(route, /PROV_CODE/);
  assert.match(route, /outSR/);
  assert.match(route, /f", "geojson"/);
});

test("TMD radar adapter uses RadarGIS with explicit freshness and cache contracts", async () => {
  const route = await readFile(new URL("../app/api/tmd-radar/route.ts", import.meta.url), "utf8");
  assert.match(route, /radargis\.tmd\.go\.th\/api\/overlays/);
  assert.match(route, /X-TMD-Radar-Status/);
  assert.match(route, /ageMinutes <= 30/);
  assert.match(route, /ageMinutes <= 90/);
  assert.match(route, /missing-nowcast/);
  assert.match(route, /stale-while-revalidate=600/);
});

test("forecast adapter uses a documented wind-aware regional CAMS residual model", async () => {
  const route = await readFile(new URL("../app/api/forecast/route.ts", import.meta.url), "utf8");
  const influenceDomain = await readFile(new URL("../app/lib/forecast/influence-domain.ts", import.meta.url), "utf8");
  const windAwareInterpolation = await readFile(new URL("../app/lib/forecast/wind-aware-interpolation.ts", import.meta.url), "utf8");
  const manual = await readFile(new URL("../docs/WIND_AWARE_REGIONAL_PM25_MANUAL_TH.md", import.meta.url), "utf8");
  assert.match(route, /official\.airbkk\.com\/airbkk\/Api/);
  assert.match(route, /air4thai\.pcd\.go\.th\/services\/getNewAQI_JSON\.php/);
  assert.match(route, /air-quality-api\.open-meteo\.com/);
  assert.match(route, /domains.*cams_global/s);
  assert.match(route, /estimateWindAwarePm25/);
  assert.match(route, /getRegionalCamsPoints/);
  assert.match(route, /regionalObservationStations/);
  assert.match(influenceDomain, /ราชบุรี/);
  assert.match(influenceDomain, /ฉะเชิงเทรา/);
  assert.match(windAwareInterpolation, /effectiveDistance/);
  assert.match(windAwareInterpolation, /temporalDecay/);
  assert.match(manual, /CAMS Global/);
  assert.match(manual, /residual/i);
  assert.match(manual, /backtest/i);
  assert.match(route, /X-Forecast-Status/);
});

test("rain forecast API normalizes a real-provider browser fallback payload", async () => {
  const worker = await loadWorker();
  const dateKeys = ["2026-08-14", "2026-08-15", "2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20"];
  const hourlyTimes = dateKeys.flatMap((dateKey) => Array.from(
    { length: 24 },
    (_, hour) => `${dateKey}T${String(hour).padStart(2, "0")}:00`,
  ));
  const raw = Array.from({ length: 9 }, (_, pointIndex) => ({
    latitude: 13.6 + pointIndex * 0.04,
    longitude: 100.3 + pointIndex * 0.06,
    hourly: {
      time: hourlyTimes,
      precipitation_probability: hourlyTimes.map((_, index) => (index + pointIndex) % 100),
      precipitation: hourlyTimes.map((_, index) => (index % 8 === 0 ? 1.2 : 0)),
      rain: hourlyTimes.map((_, index) => (index % 8 === 0 ? 1.2 : 0)),
      showers: hourlyTimes.map(() => 0),
      weather_code: hourlyTimes.map(() => 61),
    },
    daily: {
      time: dateKeys,
      precipitation_sum: dateKeys.map((_, index) => 4 + index + pointIndex / 10),
      precipitation_probability_max: dateKeys.map((_, index) => 60 + index),
      precipitation_hours: dateKeys.map(() => 3),
      weather_code: dateKeys.map(() => 61),
    },
  }));

  const response = await worker.fetch(
    new Request("http://localhost/api/rain-forecast", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "best-match", raw }),
    }),
    environment,
    executionContext,
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "live");
  assert.equal(payload.points.length, 9);
  assert.equal(payload.days.length, 7);
  assert.equal(payload.windows.length, 56);
  assert.equal(payload.dataQuality.deliveryFallback, true);
  assert.equal(response.headers.get("X-Rain-Forecast-Delivery"), "browser-fallback");
});

test("Cloudflare free architecture consolidates metro requests and normalizes cache keys", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const airRoute = await readFile(new URL("../app/api/forecast/route.ts", import.meta.url), "utf8");
  const rainRoute = await readFile(new URL("../app/api/rain-forecast/route.ts", import.meta.url), "utf8");
  const airDashboard = await readFile(new URL("../app/forecast-dashboard.tsx", import.meta.url), "utf8");
  const rainDashboard = await readFile(new URL("../app/rain/rain-dashboard.tsx", import.meta.url), "utf8");
  assert.match(worker, /caches\.default/);
  assert.match(worker, /cached = await cache\.match\(cacheRequest\)/);
  assert.match(worker, /catch \{\s*cache = null;/);
  assert.match(worker, /cache\.put\(cacheRequest, cacheResponse\)\.catch/);
  assert.match(worker, /responseWithCacheStatus\(response, cache \? "MISS" : "BYPASS"\)/);
  assert.match(worker, /searchParams\.delete\("refresh"\)/);
  assert.match(worker, /X-Edge-Cache/);
  assert.match(airRoute, /createMetroForecastResponse/);
  assert.match(rainRoute, /createMetroRainForecastResponse/);
  assert.doesNotMatch(airDashboard, /Promise\.allSettled\(provinces/);
  assert.doesNotMatch(rainDashboard, /Promise\.allSettled\(provinces/);
  assert.doesNotMatch(airDashboard, /query\.set\("refresh"/);
  assert.doesNotMatch(rainDashboard, /query\.set\("refresh"/);
});

test("rain adapter uses cached nine-point live Open-Meteo providers without fake fallback values", async () => {
  const route = await readFile(new URL("../app/api/rain-forecast/route.ts", import.meta.url), "utf8");
  const provider = await readFile(new URL("../app/lib/rain-forecast-provider.ts", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../app/rain/rain-dashboard.tsx", import.meta.url), "utf8");
  assert.match(provider, /api\.open-meteo\.com\/v1\/forecast/);
  assert.match(provider, /api\.open-meteo\.com\/v1\/gfs/);
  assert.match(provider, /precipitation_probability,precipitation,rain,showers,weather_code/);
  assert.match(route, /forecastPoints\.length/);
  assert.match(route, /CDN-Cache-Control/);
  assert.match(route, /max-age=1800/);
  assert.match(route, /MINIMUM_HOURLY_COVERAGE/);
  assert.match(route, /rejectedPoints/);
  assert.match(route, /X-Rain-Forecast-Status/);
  assert.match(route, /X-Rain-Forecast-Provider/);
  assert.match(route, /export async function POST/);
  assert.match(route, /browser-fallback/);
  assert.match(route, /providerFallback/);
  assert.match(dashboard, /fetchRainForecastPayload/);
  assert.match(dashboard, /buildRainForecastUrl/);
  assert.match(route, /points: \[\]/);
  assert.doesNotMatch(`${route}\n${provider}\n${dashboard}`, /fallbackRain|demoRain|mockRain/i);
});
