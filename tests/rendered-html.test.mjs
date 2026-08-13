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

test("server-renders the BKK Air forecast product", async () => {
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
  assert.match(html, /BKK Air Outlook/);
  assert.match(html, /แผนที่พยากรณ์/);
  assert.match(html, /PM2\.5 กรุงเทพฯ/);
  assert.match(html, /กำลังโหลดข้อมูล/);
  assert.doesNotMatch(html, /D\+(?:<!-- -->)?[1-5]/);
  assert.match(html, /ค่าฝุ่นเฉลี่ย กทม\./);
  assert.match(html, /แนวโน้ม 5 วัน/);
  assert.match(html, /เลือกชั้นข้อมูลแผนที่/);
  assert.doesNotMatch(html, /ความเชื่อมั่นของโมเดล/);
  assert.match(html, /ชั้นสีค่าฝุ่น/);
  assert.match(html, /กำลังโหลดขอบเขตกรุงเทพฯ/);
  assert.match(html, /href="\/rain"/);
  assert.doesNotMatch(html, /พื้นผิว IDW|IDW power 2|interpolation|backtest/);
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
  assert.match(html, /BKK RAIN OUTLOOK/);
  assert.match(html, /ฝนกรุงเทพฯ/);
  assert.match(html, /กำลังโหลดพยากรณ์ฝน/);
  assert.match(html, /เลือกวันพยากรณ์ฝน/);
  assert.match(html, /จุดประมาณการ/);
  assert.match(html, /ที่มาข้อมูล/);
  assert.match(html, /href="\/"/);
  assert.doesNotMatch(html, /จุดตรวจวัดฝน|สถานีฝน/);
});

test("boundary adapter uses the official BMA district layer", async () => {
  const route = await readFile(new URL("../app/api/bangkok-boundary/route.ts", import.meta.url), "utf8");
  assert.match(route, /bmagis\.bangkok\.go\.th\/arcgis\/rest\/services\/BMA\/DISTRICT\/MapServer\/0\/query/);
  assert.match(route, /outSR=4326/);
  assert.match(route, /s-maxage=86400/);
});

test("forecast API always exposes a safe five-day contract", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/forecast"),
    environment,
    executionContext,
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(["live", "degraded", "fallback"].includes(payload.status));
  assert.equal(payload.days.length, 5);
  assert.ok(payload.stations.length >= 15);
  assert.equal(typeof payload.disclaimer, "string");
  assert.ok(payload.disclaimer.length > 20);
  assert.ok(payload.days.every((day) => day.confidence > 0 && day.confidence <= 100));
  assert.ok(payload.stations.every((station) => station.values.length === 5));
});

test("forecast adapter combines AirBKK and CAMS with explicit fallback", async () => {
  const route = await readFile(new URL("../app/api/forecast/route.ts", import.meta.url), "utf8");
  assert.match(route, /official\.airbkk\.com\/airbkk\/Api/);
  assert.match(route, /air-quality-api\.open-meteo\.com/);
  assert.match(route, /domains.*cams_global/s);
  assert.match(route, /biasWeight/);
  assert.match(route, /insufficient fresh AirBKK stations/);
  assert.match(route, /X-Forecast-Status/);
});

test("rain forecast API exposes a five-day model-only contract", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/rain-forecast"),
    environment,
    executionContext,
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(["live", "degraded", "unavailable"].includes(payload.status));
  assert.equal(payload.days.length, 5);
  assert.equal(typeof payload.disclaimer, "string");
  assert.match(payload.disclaimer, /แบบจำลอง|โหลดค่าพยากรณ์/);
  assert.equal(payload.dataQuality.expectedPoints, 9);
  if (payload.status === "unavailable") {
    assert.equal(payload.points.length, 0);
    assert.equal(payload.windows.length, 0);
  } else {
    assert.ok(payload.points.length >= 6);
    assert.equal(payload.windows.length, 40);
    assert.ok(payload.points.every((point) => point.daily.length === 5));
  }
});

test("rain adapter uses a cached nine-point Open-Meteo forecast without fake fallback values", async () => {
  const route = await readFile(new URL("../app/api/rain-forecast/route.ts", import.meta.url), "utf8");
  assert.match(route, /api\.open-meteo\.com\/v1\/forecast/);
  assert.match(route, /precipitation_probability,precipitation,rain,showers,weather_code/);
  assert.match(route, /forecastPoints\.length/);
  assert.match(route, /s-maxage=1800/);
  assert.match(route, /MINIMUM_HOURLY_COVERAGE/);
  assert.match(route, /rejectedPoints/);
  assert.match(route, /X-Rain-Forecast-Status/);
  assert.match(route, /points: \[\]/);
  assert.doesNotMatch(route, /fallbackRain|demoRain|mockRain/i);
});
