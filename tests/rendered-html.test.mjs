import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

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
  assert.match(html, /พยากรณ์ PM2\.5 กรุงเทพฯ ล่วงหน้า 1–5 วัน/);
  assert.match(html, /กำลังโหลดข้อมูลจริง/);
  assert.match(html, /D\+(?:<!-- -->)?1/);
  assert.match(html, /D\+(?:<!-- -->)?5/);
  assert.match(html, /ความเชื่อมั่นของโมเดล/);
  assert.match(html, /พื้นผิว IDW/);
  assert.match(html, /IDW power 2/);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
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
