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

test("home separates rain and water before air and heat, keeping each topic's evidence together", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), environment, executionContext);
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const label of ["ov-page", "ภาพรวม", "พื้นที่ของฉัน", "ระดับน้ำ", "ฝนจะมาเมื่อไร", "วางแผนรับความร้อน", "พื้นที่ที่ควรติดตาม", "ที่มาและข้อจำกัด", "ค้นหาถนน เขต หรือพื้นที่", "ข้ามไปที่ข้อมูล"]) assert.ok(html.includes(label), label);
  assert.ok(html.includes("ดูพื้นที่ของฉัน"));
  assert.ok(html.includes("/illustrations/bangkok-weather.webp"));
  assert.ok(html.includes("เรื่องสำคัญตอนนี้"));
  assert.ok(html.indexOf('id="important-events"') < html.indexOf('id="overview"'));
  assert.ok(html.includes("เปิดการแจ้งเตือน"));
  assert.ok(html.includes('id="current-event-area-map"'));
  assert.ok(html.includes('aria-label="เลือกเรื่องบนแผนที่สรุป"'));
  for (const label of ["รายละเอียดรายพื้นที่", "สำรวจแผนที่และระดับติดตาม", "ยังประเมินไม่ได้", "สีแสดงเฉพาะจุด"]) assert.ok(html.includes(label), label);
  assert.ok(html.includes("สรุปบนสุดคงเวลาปัจจุบัน"));
  assert.ok(html.includes("ผลวิเคราะห์แสดงในแอป ไม่ใช่ประกาศเตือนภัย"));
  assert.match(html, /data-theme="light"/);
  assert.ok(html.indexOf('id="overview"') < html.indexOf('id="my-area"'));
  const rainStart = html.indexOf('id="chapter-rain"'), waterStart = html.indexOf('id="chapter-water"'), airStart = html.indexOf('id="chapter-air"'), heatStart = html.indexOf('id="chapter-heat"');
  assert.ok(html.indexOf('id="my-area"') < rainStart && rainStart < waterStart && waterStart < airStart && airStart < heatStart);
  const rain = html.slice(rainStart, waterStart), water = html.slice(waterStart, airStart), air = html.slice(airStart, heatStart), heat = html.slice(heatStart);
  for (const id of ["rain-radar", "forecast-rain", "watch-rain", "map-rain", "sources-rain"]) assert.ok(rain.includes(`id="${id}"`), id);
  assert.ok(water.includes('aria-label="น้ำท่วมถนนจากจุดตรวจวัด กทม."'));
  assert.doesNotMatch(rain, /id="water-levels"|id="road-floods"|id="upstream-watch"/);
  assert.ok(water.indexOf('aria-label="น้ำท่วมถนนจากจุดตรวจวัด กทม."') < water.indexOf('id="water-levels"'));
  assert.doesNotMatch(rain, /id="forecast-air"|id="forecast-heat"|id="current-observations"/);
  for (const id of ["current-observations", "forecast-air", "air-analysis", "cold-wind", "watch-air", "map-air", "sources-air"]) assert.ok(air.includes(`id="${id}"`), id);
  assert.ok(air.indexOf('id="forecast-air"') < air.indexOf('id="air-analysis"'));
  assert.ok(air.indexOf('id="air-analysis"') < air.indexOf('id="cold-wind"'));
  for (const label of ["ทำไมฝุ่นถึงเปลี่ยน?", "ลมหนาวจะมาหรือยัง?", "เกณฑ์วิเคราะห์ลมหนาวและข้อจำกัด", "เป็นพยากรณ์ระดับกริด", "ความกดอากาศ"]) assert.ok(air.includes(label), label);
  assert.doesNotMatch(rain + heat, /id="air-analysis"|id="cold-wind"/);
  assert.ok(air.indexOf('id="current-observations"') < air.indexOf('id="forecast-air"'));
  assert.doesNotMatch(air, /id="forecast-rain"|id="water-levels"|id="forecast-heat"/);
  for (const id of ["forecast-heat", "watch-heat", "map-heat", "sources-heat"]) assert.ok(heat.includes(`id="${id}"`), id);
  assert.doesNotMatch(heat, /id="forecast-air"|id="water-levels"|id="watch-rain"/);
  assert.equal((html.match(/id="area-map"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /aria-label="เลือกข้อมูลบนแผนที่"|ov-local-readings|สรุประดับการติดตามจากพยากรณ์ทั้ง 3 เรื่อง/);
  assert.ok(html.includes("ฝนสะสมตลอดวัน 00:00–24:00"));
  assert.ok(html.includes("ค่าพยากรณ์ / ประมาณเชิงพื้นที่"));
  assert.ok(html.includes("ระดับน้ำในคลองและแม่น้ำ"));
  assert.ok(html.includes("ค่าตรวจวัดแต่ละเรื่องคงเวลาของต้นทาง"));
  assert.ok(html.indexOf('id="outlook"') < html.indexOf('id="water-levels"'));
  assert.ok(html.includes("ค่านี้ไม่ใช่ความลึกของน้ำท่วม"));
  assert.match(html, /href="\/rain\?province=chao-phraya"/);
  assert.ok(html.indexOf('id="important-events"') < html.indexOf('id="upstream-watch"'));
  assert.ok(html.indexOf('id="water-levels"') < html.indexOf('id="upstream-watch"'));
  assert.ok(html.includes("ติดตามต้นน้ำเจ้าพระยา"));
  assert.ok(html.includes("ส่วนในลุ่มน้ำ"));
  assert.doesNotMatch(html, /class="mf-panel"/);
});

test("public road/locality catalog serves traceable geography without calling an upstream geocoder", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(new Request("http://localhost/api/map-places"), environment, executionContext);
  assert.equal(response.status, 200);
  const catalog = await response.json();
  assert.ok(catalog.places.length > 400);
  assert.ok(catalog.places.some((place) => place.road === "ถนนสุขุมวิท" && place.subdistrict === "คลองตัน" && place.district === "คลองเตย"));
  assert.ok(catalog.places.some((place) => place.provinceId === "nonthaburi" && place.subdistrictType === "ตำบล" && place.districtType === "อำเภอ"));
  assert.match(catalog.license, /odbl/);
  assert.match(response.headers.get("cache-control"), /public/);
});
for (const route of ["air", "rain", "heat"]) {
  test(`${route} map workspace renders direct navigation and source status without covering the map`, async () => {
    const worker = await loadWorker();
    const response = await worker.fetch(new Request(`http://localhost/${route}`, { headers: { accept: "text/html" } }), environment, executionContext);
    assert.equal(response.status, 200);
    const html = await response.text();
    for (const label of ["พื้นที่สำรวจแผนที่", "เลือกชั้นข้อมูลสิ่งแวดล้อม", "เลื่อนเวลาพยากรณ์", "รายละเอียด", "กำลังโหลดข้อมูลแผนที่", "สำรวจแผนที่เต็มจอ", "mf-status"]) assert.ok(html.includes(label), label);
    assert.ok(html.indexOf('id="topic-briefing"') < html.indexOf('id="map-story"'));
    assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1);
    if (route === "air") assert.match(html,/แนวโน้มฝุ่น 7 วัน<\/h2><span>รายวัน<\/span>/);
    assert.doesNotMatch(html, /mi-sheet-handle|db-map-reading|mi-map-top|mi-map-bottom|class="mf-panel"/);
    if (route === "rain") { assert.doesNotMatch(html,/id="water-levels"|id="road-floods"|id="upstream-watch"/); assert.match(html,/href="\/water\?province=chao-phraya"/); assert.match(html, /ปริมาณฝนสะสม/); assert.match(html, /ไม่มีการคำนวณ IDW หรือเติมค่าที่ขาด/); }
    assert.ok(html.indexOf('id="map-story"') < html.indexOf('class="mf-nav"'));
    assert.ok(html.includes("สำรวจแผนที่และระดับติดตาม"));
    assert.ok(html.includes('class="ra-map-toggle" aria-expanded="false"'));
    assert.ok(html.includes('id="forecast-area-map"'));
    assert.ok(html.includes('href="#forecast-area-map"'));
    assert.ok(html.includes("รายละเอียดรายพื้นที่"));
    assert.ok(html.includes("กำลังอ่านข้อมูลพื้นที่…"));
    if (route !== "rain") assert.doesNotMatch(html, /เลือกพื้นที่เพื่อดูสัญญาณฝนใกล้คุณ/);
  });
}
test("water page owns current water, roads and upstream evidence without a forecast timeline", async()=>{
  const worker=await loadWorker();
  const response=await worker.fetch(new Request("http://localhost/water",{headers:{accept:"text/html"}}),environment,executionContext);
  assert.equal(response.status,200);
  const html=await response.text();
  for(const id of ["water-summary","water-levels","road-floods","upstream-watch"]) assert.ok(html.includes(`id="${id}"`),id);
  for(const text of ["น้ำมาก / ถึงตลิ่ง","น้ำน้อย","ค่าตรวจวัดรายสถานี","ไม่ใช่ความลึกน้ำท่วม","ภาพประกอบเพื่อเล่าเรื่อง"]) assert.ok(html.includes(text),text);
  assert.doesNotMatch(html,/id="rain-radar"|id="forecast-rain"|aria-label="เลื่อนเวลาพยากรณ์"/);
  assert.match(html,/href="\/rain\?province=chao-phraya"/);
  assert.equal((html.match(/<h1[ >]/g)??[]).length,1);
});

test("surveillance route server-renders an explicitly synthetic operational workspace", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(new Request("http://localhost/surveillance", { headers: { accept: "text/html" } }), environment, executionContext);
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const label of ["SHADOW MODE", "ข้อมูลสังเคราะห์สำหรับทดสอบ workflow", "ศูนย์ติดตาม", "คุณภาพข้อมูล", "รายงานสถานการณ์", "แผนที่เหตุที่เลือก", "คิวเหตุการณ์", "รับทราบใน session ทดสอบ"]) assert.ok(html.includes(label), label);
  assert.match(html, /ยังประเมินไม่ได้/);
  assert.match(html, /ไม่ใช่หน่วยงานจริง/);
  assert.doesNotMatch(html, /แจ้งเตือนภายนอกพร้อมใช้งาน/);
});

test("surveillance APIs expose shadow health and reject durable acknowledgements", async () => {
  const worker = await loadWorker();
  const health = await worker.fetch(new Request("http://localhost/api/surveillance/health"), environment, executionContext);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("X-Surveillance-Mode"), "shadow-synthetic");
  const healthPayload = await health.json();
  assert.equal(healthPayload.dispatchEnabled, false);
  assert.equal(healthPayload.persistenceEnabled, false);
  const acknowledgement = await worker.fetch(new Request("http://localhost/api/surveillance/events/evt-rain-bangkok-demo/acknowledgements", { method: "POST" }), environment, executionContext);
  assert.equal(acknowledgement.status, 503);
  assert.equal((await acknowledgement.json()).error, "shadow_mode_persistence_unavailable");
});
test("dot-only workspace uses direct rain amounts with supplemental probability and official warning link", async () => {
  const workspace = await readFile(new URL("../app/components/intelligence/map-workspace.tsx", import.meta.url), "utf8");
  const watches = await readFile(new URL("../app/components/intelligence/area-watch-list.tsx", import.meta.url), "utf8");
  assert.match(workspace, /พิกัดสถานที่โดยตรง/);
  assert.match(workspace, /โอกาสฝน \(%%?\)/);
  assert.match(workspace, /ปริมาณฝนสะสม/);
  assert.match(workspace, /display="dots"/);
  assert.doesNotMatch(workspace, /ความเข้มสีแผนที่|อนิเมชันประกอบพยากรณ์|option value="observation"/);
  assert.match(watches, /รายการเฝ้าระวังรายพื้นที่/);
  assert.match(watches, /ไม่ใช่เหตุการณ์ที่ยืนยันหรือประกาศเตือนภัยทางการ/);
  assert.match(watches, /https:\/\/www\.tmd\.go\.th\/warning-and-events\/warning-storm/);
});
test("air and rain sidebars use a readable desktop type scale", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /grid-template-columns: 272px minmax\(0, 1fr\) 310px/);
  assert.match(styles, /\.panel-title span, \.rain-panel-title span \{\s*font-size: 13px;/);
  assert.match(styles, /\.day-btn-left \.day-name \{[\s\S]*?font-size: 12\.5px;/);
  assert.match(styles, /\.advisory-desc \{[\s\S]*?font-size: 11px;/);
  assert.match(styles, /\.forecast-note p \{[^}]*font-size: 10\.5px;/);
});
test("server-renders the BKK Air forecast product", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/air/advanced", { headers: { accept: "text/html" } }),
    environment,
    executionContext,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /BKK Air Forecast/);
  assert.match(html, /แผนที่พยากรณ์/);
  assert.match(html, /PM2\.5 (?:เจ้าพระยาและ)?กรุงเทพฯ/);
  assert.match(html, /กำลังโหลดข้อมูล/);
  assert.doesNotMatch(html, /D\+(?:<!-- -->)?[1-7]/);
  assert.match(html, /ค่าเฉลี่ย (?:<!-- -->)?เจ้าพระยา–กรุงเทพฯ/);
  assert.match(html, /<option value="chao-phraya" selected="">เจ้าพระยาและกรุงเทพฯ–ปริมณฑล<\/option>/);
  assert.match(html, /<option value="nonthaburi">นนทบุรี<\/option>/);
  assert.equal((html.match(/<option value=/g) ?? []).length, 21);
  assert.match(html, /แนวโน้ม 7 วัน/);
  assert.match(html, /7 วันล่วงหน้า/);
  assert.match(html, /เลือกชั้นข้อมูลแผนที่/);
  assert.match(html, /ตำแหน่งของฉัน/);
  assert.match(html, /พยากรณ์รายตำแหน่ง/);
  assert.doesNotMatch(html, /ความเชื่อมั่นของโมเดล/);
  assert.match(html, /พื้นผิว CAMS \+ residual ตามลม/);
  assert.doesNotMatch(html, /จุดตรวจวัด<\/label>|จุดตรวจวัด<\/span>/);
  assert.match(html, /กำลังโหลดขอบเขต(?:<!-- -->)?เจ้าพระยาและกรุงเทพฯ–ปริมณฑล/);
  assert.match(html, /href="\/rain\?province=chao-phraya"/);
  assert.match(html, /href="\/"/);
  assert.doesNotMatch(html.replace(/<script[\s\S]*?<\/script>/g," ").replace(/<[^>]+>/g," "), /IDW power 2|interpolation|backtest/);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("server-renders the Bangkok rain forecast page", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/rain/advanced", { headers: { accept: "text/html" } }),
    environment,
    executionContext,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /BKK AIR FORECAST · RAIN/);
  assert.match(html, /ฝน(?:<!-- -->)? · (?:<!-- -->)?กรุงเทพฯ–ปริมณฑล/);
  assert.match(html, /กำลังโหลดพยากรณ์ฝน/);
  assert.match(html, /เลือกวันพยากรณ์ฝน/);
  assert.match(html, /day-peak-time/);
  assert.match(html, /7 วันล่วงหน้า/);
  assert.match(html, /โอกาสเกิดฝนช่วงใดช่วงหนึ่งของวัน/);
  assert.match(html, /จุดแบบจำลอง/);
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
  const heatDashboard = await readFile(new URL("../app/heat/heat-dashboard.tsx", import.meta.url), "utf8");
  const locationCard = await readFile(new URL("../app/components/location-forecast-card.tsx", import.meta.url), "utf8");
  const mapInteraction = await readFile(new URL("../app/components/map-forecast-interaction.tsx", import.meta.url), "utf8");
  const areaRoute = await readFile(new URL("../app/api/administrative-area/route.ts", import.meta.url), "utf8");
  const homeDashboard = await readFile(new URL("../app/home-dashboard.tsx", import.meta.url), "utf8");
  for (const dashboard of [airDashboard, rainDashboard]) {
    assert.match(dashboard, /navigator\.geolocation\.getCurrentPosition/);
    assert.match(dashboard, /map\.on\("click"/);
    assert.match(dashboard, /METRO_REGION_ID/);
    assert.match(dashboard, /interpolateIdw/);
    assert.doesNotMatch(dashboard, /localStorage|sessionStorage/);
  }
  assert.match(locationCard, /เป็นค่าประมาณเชิงพื้นที่ใกล้ตำแหน่ง/);
  for (const dashboard of [airDashboard, rainDashboard, heatDashboard]) {
    assert.match(dashboard, /MapForecastHover/);
    assert.match(dashboard, /length: 16/);
  }
  assert.match(mapInteraction, /mousemove/);
  assert.match(mapInteraction, /คลิกเพื่อดูแนวโน้ม 48 ชั่วโมง/);
  assert.match(areaRoute, /FGDS_BMA_SUBDISTRICT_POLYGON/);
  assert.match(areaRoute, /TAM_NAM_T,AMPHOE_T,PROV_NAM_T/);
  assert.match(homeDashboard, /\/api\/forecast\?province=metro/);
  assert.match(homeDashboard, /\/api\/rain-forecast\?province=metro/);
  assert.doesNotMatch(homeDashboard, /\/api\/tmd-radar|TmdRadarPayload|home-radar-pulse/);
  assert.match(homeDashboard, /home-mobile-outlook/);
  assert.doesNotMatch(homeDashboard, /Math\.random|demo|mock/i);
});

test("rain day changes preserve the selected three-hour window and use a compact horizontal mobile strip", async () => {
  const dashboard = await readFile(new URL("../app/rain/rain-dashboard.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const selectDayHandler = dashboard.match(/const selectDay = \(index: number\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? "";
  assert.match(selectDayHandler, /setSelectedDay\(index\)/);
  assert.doesNotMatch(selectDayHandler, /setSelectedWindowIndex/);
  assert.doesNotMatch(dashboard, /rain-day-mobile-select/);
  assert.match(dashboard, /dailyAreaMeanProbability/);
  assert.match(dashboard, /`เฉลี่ย \$\{prob\}%`/);
  assert.match(styles, /@media \(max-width: 780px\)[\s\S]*?\.rain-sidebar-days \{[\s\S]*?scroll-snap-type: x proximity;/);
  assert.match(styles, /\.rain-sidebar-day-btn \{[\s\S]*?min-width: 128px;[\s\S]*?min-height: 44px;/);
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

test("rain defaults to the metropolitan view with sample points visible and radar opt-in", async () => {
  const dashboard = await readFile(new URL("../app/rain/rain-dashboard.tsx", import.meta.url), "utf8");
  const homeDashboard = await readFile(new URL("../app/home-dashboard.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /useState<RegionId>\(METRO_REGION_ID\)/);
  assert.match(dashboard, /requestedProvince \? getRegion\(requestedProvince\)\.id : METRO_REGION_ID/);
  assert.match(dashboard, /const \[showLabels, setShowLabels\] = useState\(false\)/);
  assert.match(dashboard, /const \[showSamplePoints, setShowSamplePoints\] = useState\(true\)/);
  assert.match(dashboard, /const \[radarEnabled, setRadarEnabled\] = useState\(false\)/);
  assert.match(dashboard, /const \[radarLoadState, setRadarLoadState\] = useState<[^>]+>\("idle"\)/);
  assert.match(homeDashboard, /href="\/rain\?province=metro"/);
});

test("server-renders the metropolitan heat forecast page", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/heat/advanced", { headers: { accept: "text/html" } }),
    environment,
    executionContext,
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /BKK Heat Forecast/);
  assert.match(html, /อุณหภูมิและ Heat Index รายช่วง 3 ชั่วโมง/);
  assert.match(html, /เลือกวันพยากรณ์/);
  assert.match(html, /เลือกช่วงเวลา/);
  assert.match(html, /ช่วงละ 3 ชั่วโมง/);
  assert.match(html, /00\.00/);
  assert.match(html, /21\.00/);
  assert.match(html, /เลือกตัวแปรพยากรณ์ความร้อน/);
  assert.match(html, /heat-view-mode/);
  assert.doesNotMatch(html, /ชั้นข้อมูลบนแผนที่/);
  assert.match(html, /Heat Index เฉลี่ยช่วงนี้/);
  assert.match(html, /พื้นผิว IDW/);
  assert.match(html, /กรุงเทพมหานครและปริมณฑล/);
  assert.match(html, /href="\/air\?province=metro"/);
  assert.match(html, /href="\/rain\?province=metro"/);
});

test("heat map uses a boundary-clipped IDW surface and an ImageGen cover", async () => {
  const dashboard = await readFile(new URL("../app/heat/heat-dashboard.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const cover = await readFile(new URL("../public/home-heat.png", import.meta.url));
  assert.match(dashboard, /spatialIdw\(lat, lng, anchors/);
  assert.match(dashboard, /maxDistanceKm: 55/);
  assert.match(dashboard, /maskContext\.fill\("evenodd"\)/);
  assert.match(dashboard, /L\.imageOverlay\(surface\.url, surface\.bounds/);
  assert.match(dashboard, /selectedWindowIndex/);
  assert.match(dashboard, /pointWindow\(point, selectedDay, selectedWindowIndex\)/);
  assert.match(styles, /\.heat-panel-windows/);
  assert.match(dashboard, /useState\(false\).*showPoints|\[showPoints, setShowPoints\] = useState\(false\)/s);
  assert.match(styles, /\.home-topic-heat \{ background-image: url\("\/home-heat\.png"\)/);
  assert.ok(cover.byteLength > 1_000_000);
});

test("rain page provides a query-persisted 24-hour accumulation watch mode", async () => {
  const dashboard = await readFile(new URL("../app/rain/rain-dashboard.tsx", import.meta.url), "utf8");
  const communication = await readFile(new URL("../app/lib/rain-communication.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(dashboard, /type RainViewMode = "forecast" \| "watch"/);
  assert.match(dashboard, /requestedMode === "watch"/);
  assert.match(dashboard, /searchParams\.set\("mode", "watch"\)/);
  assert.match(dashboard, /ปริมาณฝนสะสม/);
  assert.match(dashboard, /effectiveMetricMode: MetricMode = viewMode === "watch" \? "daily-rain"/);
  assert.match(dashboard, /setRadarEnabled\(false\)/);
  assert.match(dashboard, /ไม่ใช่ประกาศเตือนภัย/);
  assert.match(communication, /value <= 10/);
  assert.match(communication, /value <= 35/);
  assert.match(communication, /value <= 90/);
  assert.match(styles, /\.rain-view-mode/);
  assert.match(styles, /\.rain-watch-summary/);
});

test("rain page lets users switch the seven-day forecast between TMD and Open-Meteo", async () => {
  const dashboard = await readFile(new URL("../app/rain/rain-dashboard.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/rain-forecast/route.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(dashboard, /แหล่งข้อมูล/);
  assert.match(dashboard, /selectForecastSource\("tmd"\)/);
  assert.match(dashboard, /selectForecastSource\("open-meteo"\)/);
  assert.match(dashboard, /source: forecastSource/);
  assert.match(dashboard, /mode: viewMode === "watch" \? "accumulation" : "chance"/);
  assert.match(dashboard, /โอกาสฝนตก/);
  assert.match(dashboard, /ปริมาณฝนสะสม/);
  assert.match(dashboard, /ค่าสูงสุดตามเวลาของแต่ละจุด แล้วเฉลี่ยจาก/);
  assert.match(dashboard, /จุดข้อมูลแบบจำลอง/);
  assert.match(route, /getRainForecastSource\(searchParams\.get\("source"\)\)/);
  assert.match(route, /buildTmdDailyPointForecastUrls/);
  assert.match(route, /mergeTmdDailyRainForecast/);
  assert.match(styles, /\.rain-source-mode/);
});

test("heat page lets users switch between 48-hour TMD data and seven-day Open-Meteo", async () => {
  const dashboard = await readFile(new URL("../app/heat/heat-dashboard.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/heat-forecast/route.ts", import.meta.url), "utf8");
  const provider = await readFile(new URL("../app/lib/heat-forecast-provider.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(dashboard, /แหล่งพยากรณ์ 7 วัน/);
  assert.match(dashboard, /selectForecastSource\("tmd"\)/);
  assert.match(dashboard, /ข้อมูลหลัก 0–48 ชม\./);
  assert.match(dashboard, /selectForecastSource\("open-meteo"\)/);
  assert.match(dashboard, /source: forecastSource/);
  assert.match(provider, /DEFAULT_HEAT_FORECAST_SOURCE/);
  assert.match(route, /getHeatForecastSource\(searchParams\.get\("source"\)\)/);
  assert.match(route, /forecastSource === "tmd" && tmdToken/);
  assert.match(route, /"tc,rh", 48/);
  assert.match(styles, /\.heat-source-mode/);
});

test("rain insight cards flow below the seven-day chart without shrinking", async () => {
  const dashboard = await readFile(new URL("../app/rain/rain-dashboard.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /\.rain-insights \{[\s\S]*?display: flex;[\s\S]*?flex-direction: column;[\s\S]*?overflow-y: auto;/);
  assert.match(styles, /\.rain-insights > div \{ flex: 0 0 auto; \}/);
  assert.match(styles, /\.rain-trend-card \.trend-heading \{[\s\S]*?display: grid;/);
  assert.match(styles, /\.rain-watch-card \{ overflow: visible; \}/);
  assert.match(styles, /\.rain-watch-card li > span \{[\s\S]*?text-overflow: ellipsis;/);
  assert.match(dashboard, /`\$\{Math\.round\(value\)\}%`/);
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
  const airDashboard = await readFile(new URL("../app/forecast-dashboard.tsx", import.meta.url), "utf8");
  const rainDashboard = await readFile(new URL("../app/rain/rain-dashboard.tsx", import.meta.url), "utf8");
  const basemap = await readFile(new URL("../app/lib/basemap.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(layout, /bkk-air-theme/);
  assert.match(nav, /<ThemeToggle/);
  assert.match(toggle, /localStorage\.setItem\(THEME_STORAGE_KEY/);
  assert.match(airDashboard, /installBasemap\(L,map,basemap,mapTheme\)/);
  assert.match(rainDashboard, /installBasemap\(L,map,basemap,mapTheme\)/);
  assert.match(airDashboard, /new MutationObserver\(syncTheme\)/);
  assert.match(rainDashboard, /new MutationObserver\(syncTheme\)/);
  assert.match(basemap, /Canvas\/World_Dark_Gray_Base/);
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
  const heatRoute = await readFile(new URL("../app/api/heat-forecast/route.ts", import.meta.url), "utf8");
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
  assert.match(worker, /\/api\/heat-forecast/);
  assert.match(heatRoute, /createMetroHeatForecastResponse/);
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

test("direct rain endpoint returns source-backed named coordinates and nulls for missing upstream slots", async () => {
  const originalFetch = globalThis.fetch;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const time = Array.from({ length: 192 }, (_, i) => new Date(Date.parse(`${today}T00:00:00Z`) + i * 3600000).toISOString().slice(0, 16));
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    assert.equal(url.hostname, "api.open-meteo.com");
    calls.push(url);
    return Response.json([{ utc_offset_seconds: 25200, latitude: 13.7, longitude: 100.5,
      hourly_units: { precipitation: "mm", precipitation_probability: "%" }, daily_units: { precipitation_sum: "mm", precipitation_probability_max: "%" },
      hourly: { time, precipitation: time.map(() => 0), precipitation_probability: time.map(() => 40) },
      daily: { time: time.filter((_, i) => i % 24 === 0).map((t) => t.slice(0, 10)), precipitation_sum: Array(8).fill(0), precipitation_probability_max: Array(8).fill(50) } }]);
  };
  try {
    const worker = await loadWorker();
    const response = await worker.fetch(new Request("http://localhost/api/rain-places?province=bangkok"), environment, executionContext);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.valueMethod, "provider");
    assert.equal(data.status, "degraded");
    assert.equal(data.points.length, 180);
    assert.equal(data.steps.length, 231);
    assert.ok(data.points.every((p) => p.place.provinceId === "bangkok" && p.lat === p.place.lat && p.lng === p.place.lng));
    assert.ok(data.points.some((p) => p.secondary[0] === 0));
    assert.ok(data.points.some((p) => p.secondary.every((v) => v === null)));
    assert.ok(calls.length <= 4);
    assert.ok(calls.every((url) => url.searchParams.get("latitude").split(",").length <= 50));
    assert.match(response.headers.get("cdn-cache-control"), /max-age=/);
  } finally { globalThis.fetch = originalFetch; }
});

test("direct rain edge cache keeps every real province distinct and removes display-only query parameters", async () => {
  const originalCaches = globalThis.caches;
  const keys = [];
  globalThis.caches = { default: { match: async (request) => { keys.push(new URL(request.url)); return new Response("cached forecast"); } } };
  try {
    const worker = await loadWorker();
    for (const province of ["metro", "bangkok", "nonthaburi", "pathum-thani", "samut-prakan", "samut-sakhon", "nakhon-pathom"]) {
      const response = await worker.fetch(new Request(`http://localhost/api/rain-places?province=${province}&source=tmd&mode=chance&time=old&refresh=3`), environment, executionContext);
      assert.equal(response.headers.get("x-edge-cache"), "HIT");
      assert.equal(keys.at(-1).searchParams.toString(), `province=${province}`);
    }
    assert.equal(new Set(keys.map((url) => url.toString())).size, 7);
  } finally { globalThis.caches = originalCaches; }
});
