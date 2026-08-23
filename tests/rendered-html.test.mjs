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
  assert.doesNotMatch(html, /กำลังโหลดข้อมูล|กำลังโหลดพยากรณ์ฝน/);
});

test("topic cards and product navigation use framework links", async () => {
  const homepage = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const productNav = await readFile(new URL("../app/components/outlook-nav.tsx", import.meta.url), "utf8");
  assert.match(homepage, /from ["']next\/link["']/);
  assert.match(productNav, /from ["']next\/link["']/);
  assert.match(homepage, /<Link className="home-topic home-topic-air" href="\/air"/);
  assert.match(homepage, /<Link className="home-topic home-topic-rain" href="\/rain"/);
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
  assert.match(html, /ค่าฝุ่นเฉลี่ย (?:<!-- -->)?กรุงเทพฯ/);
  assert.match(html, /<option value="bangkok" selected="">กรุงเทพมหานคร<\/option>/);
  assert.match(html, /<option value="nonthaburi">นนทบุรี<\/option>/);
  assert.equal((html.match(/<option value=/g) ?? []).length, 6);
  assert.match(html, /แนวโน้ม 7 วัน/);
  assert.match(html, /7 วันล่วงหน้า/);
  assert.match(html, /เลือกชั้นข้อมูลแผนที่/);
  assert.doesNotMatch(html, /ความเชื่อมั่นของโมเดล/);
  assert.match(html, /พื้นผิว IDW ค่าฝุ่น/);
  assert.doesNotMatch(html, /จุดตรวจวัด<\/label>|จุดตรวจวัด<\/span>/);
  assert.match(html, /กำลังโหลดขอบเขต(?:<!-- -->)?กรุงเทพมหานคร/);
  assert.match(html, /href="\/rain\?province=bangkok"/);
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
  assert.match(html, /7 วันล่วงหน้า/);
  assert.match(html, /แนวโน้ม 7 วัน/);
  assert.match(html, /จุดประมาณการ/);
  assert.match(html, /ที่มาข้อมูล/);
  assert.match(html, /href="\/"/);
  assert.doesNotMatch(html, /จุดตรวจวัดฝน|สถานีฝน/);
  assert.match(html, /แบบจำลองพยากรณ์/);
  assert.match(html, /เรดาร์ฝน TMD/);
  assert.match(html, /ตรวจจริงและ Nowcast 0–3 ชม./);
  assert.match(html, /เลือกชั้นข้อมูลแผนที่ฝน/);
  assert.doesNotMatch(html, /จุดประมาณการ<\/label>/);
});

test("boundary adapter uses the official BMA district layer", async () => {
  const route = await readFile(new URL("../app/api/bangkok-boundary/route.ts", import.meta.url), "utf8");
  assert.match(route, /bmagis\.bangkok\.go\.th\/arcgis\/rest\/services\/BMA\/DISTRICT\/MapServer\/0\/query/);
  assert.match(route, /outSR=4326/);
  assert.match(route, /s-maxage=86400/);
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
  assert.match(route, /ageMinutes <= 60/);
  assert.match(route, /stale-while-revalidate=600/);
});

test("forecast adapter combines AirBKK and CAMS with explicit unavailable contract", async () => {
  const route = await readFile(new URL("../app/api/forecast/route.ts", import.meta.url), "utf8");
  assert.match(route, /official\.airbkk\.com\/airbkk\/Api/);
  assert.match(route, /air-quality-api\.open-meteo\.com/);
  assert.match(route, /domains.*cams_global/s);
  assert.match(route, /calculateBiasCorrection/);
  assert.match(route, /insufficient_fresh_airbkk_stations/);
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

test("rain adapter uses cached nine-point live Open-Meteo providers without fake fallback values", async () => {
  const route = await readFile(new URL("../app/api/rain-forecast/route.ts", import.meta.url), "utf8");
  const provider = await readFile(new URL("../app/lib/rain-forecast-provider.ts", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../app/rain/rain-dashboard.tsx", import.meta.url), "utf8");
  assert.match(provider, /api\.open-meteo\.com\/v1\/forecast/);
  assert.match(provider, /api\.open-meteo\.com\/v1\/gfs/);
  assert.match(provider, /precipitation_probability,precipitation,rain,showers,weather_code/);
  assert.match(route, /forecastPoints\.length/);
  assert.match(route, /s-maxage=1800/);
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
