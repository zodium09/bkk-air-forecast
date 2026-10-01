"use client";
/* eslint-disable @next/next/no-html-link-for-pages */
import { useEffect, useMemo, useRef, useState } from "react";
import EnvironmentMap from "./environment-map";
import ForecastInfographic from "./forecast-infographic";
import WaterOverview from "./water-overview";
import CurrentAir from "./current-air";
import RoadFloodOverview from "./road-flood-overview";
import RiskSignals, { RiskMeter } from "./risk-signals";
import ThemeToggle from "../theme-toggle";
import BriefingChart, { AnimatedNumber } from "./briefing-chart";
import { MapIcon, goToStory } from "./map-ui";
import { useEnvironmentData } from "./use-environment-data";
import { useMapPlaces } from "./use-map-places";
import { bangkokDate, formatValue, getLegend, relativeDay, type EnvironmentLayer, type MapDataset, type Metric } from "../../lib/map-intelligence";
import { getRegion, provinces, type RegionId } from "../../lib/provinces";
import { placeAddress, placeArea, placeLabel, type MapPlace } from "../../lib/map-places";
import { type MapBoundary } from "../../lib/map-surface";
import { buildAreaWatch } from "../../lib/area-watch";
import { createPlacePoints, placeReading } from "../../lib/place-outlook";
import { dailyIndex, overviewDates, overviewTimestamp, overviewValue, overviewStepValue, sourceState } from "../../lib/environment-overview";
import { currentForecastIndex, timelineIndices } from "../../lib/dashboard-controls";
import "./map-workspace.css";
import "./night-theme.css";
import "./overview.css";
import "./briefing.css";

const topics = [
  { layer: "air", title: "ฝุ่น PM2.5", metric: "primary", unit: "µg/m³", period: "ความเข้มข้นเฉลี่ยรายวัน", method: "ค่าพยากรณ์ / ประมาณเชิงพื้นที่" },
  { layer: "rain", title: "ฝนสะสม", metric: "secondary", unit: "มม.", period: "ปริมาณสะสมตลอด 24 ชั่วโมง", method: "พยากรณ์ตามพิกัดจากต้นทาง" },
  { layer: "heat", title: "ความร้อนที่รู้สึก", metric: "primary", unit: "°C", period: "ดัชนีความร้อนสูงสุดรายวัน", method: "ค่าพยากรณ์ / ประมาณเชิงพื้นที่" },
] as const;

function usePreviewPoints(data: MapDataset | null, boundary: MapBoundary | null, places: MapPlace[]) {
  return useMemo(() => createPlacePoints(data, boundary, places), [data, boundary, places]);
}

function forecastLink(layer: EnvironmentLayer, region: RegionId, date: string, place?: { lat: number; lng: number } | null, hour?: number | null) {
  const params = new URLSearchParams({ province: region });
  if (date) params.set("time", layer === "air" ? date : hour != null ? `${date}:h${String(hour).padStart(2, "0")}` : `${date}:day`);
  if (place) { params.set("lat", String(place.lat)); params.set("lng", String(place.lng)); }
  return `/${layer}?${params}`;
}

function Reading({ layer, data, value, loading, index }: { layer: EnvironmentLayer; data: MapDataset | null; value: number | null; loading: boolean; index: number }) {
  const topic = topics.find((item) => item.layer === layer)!;
  const reading = placeReading(layer, topic.metric, value, data?.steps[index]);
  return <><div className="ov-number">{loading ? <span className="ov-skeleton" aria-label="กำลังโหลดค่า" /> : <AnimatedNumber value={value} />}<small>{topic.unit}</small></div><span className={`ov-verdict ov-priority-${reading.priority}`}><i aria-hidden="true" />{loading ? "กำลังเชื่อมต่อแหล่งข้อมูล" : value === null ? "ยังไม่มีข้อมูลในช่วงที่เลือก" : reading.title}</span><RiskMeter priority={loading ? -1 : reading.priority} /></>;
}

function ReadingScale({ layer, value }: { layer: EnvironmentLayer; value: number | null }) {
  const metric = layer === "rain" ? "secondary" : "primary";
  const maximum = layer === "air" ? 100 : layer === "rain" ? 120 : 60;
  const bands = getLegend(layer, metric);
  return <div className={`ov-reading-scale${value === null ? " is-missing" : ""}`} aria-hidden="true"><div className="ov-scale-track">{bands.map((band, index) => <i key={band.label} style={{ background: band.color, flex: (Number.isFinite(band.max) ? band.max : maximum) - (bands[index - 1]?.max ?? 0) }} />)}{value !== null && <span className="ov-scale-marker" style={{ left: `${Math.max(0, Math.min(100, value / maximum * 100))}%` }} />}</div><div className="ov-scale-labels"><span>0</span><span>สเกล{layer === "rain" ? "ฝนสะสม" : layer === "air" ? "ฝุ่น PM2.5" : "ดัชนีความร้อน"}</span><span>{maximum}+</span></div></div>;
}

export default function EnvironmentOverview() {
  const [region, setRegion] = useState<RegionId>("metro");
  const [date, setDate] = useState("");
  const [today, setToday] = useState("");
  const [following, setFollowing] = useState(true);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [selected, setSelected] = useState<MapPlace | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [previewLayer, setPreviewLayer] = useState<EnvironmentLayer>("rain");
  const [chartLayer, setChartLayer] = useState<EnvironmentLayer>("rain");
  const [refresh, setRefresh] = useState(0);
  const [focus, setFocus] = useState(0);
  const [boundary, setBoundary] = useState<{ region: RegionId; data: MapBoundary } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const geoRequest = useRef({ id: 0 });
  const lastToday = useRef("");
  const searchGroup = useRef<HTMLDivElement>(null);
  const air = useEnvironmentData("air", region, "forecast", refresh);
  const rain = useEnvironmentData("rain", region, "forecast", refresh, "open-meteo", "secondary", true);
  const heat = useEnvironmentData("heat", region, "forecast", refresh);
  const geography = useMapPlaces(region, refresh);
  const sources = { air, rain, heat };
  const preview = sources[previewLayer];
  const previewData = preview.data;
  const places = geography.places;
  const previewMetric: Metric = previewLayer === "rain" ? "secondary" : "primary";
  const currentBoundary = boundary?.region === region ? boundary.data : null;
  const dates = overviewDates([air.data, rain.data, heat.data], today);
  const mapPoints = usePreviewPoints(previewData, currentBoundary, places);
  const activeIndex = (layer: EnvironmentLayer) => {
    const data = sources[layer].data;
    if (following) return currentForecastIndex(data?.steps ?? [], new Date(clock));
    if (selectedHour !== null) {
      const hourly = data?.steps.findIndex((step) => step.date === date && step.cadence === "hour" && step.startHour === selectedHour) ?? -1;
      if (hourly >= 0) return hourly;
      const window = data?.steps.findIndex((step) => step.date === date && step.window !== null && step.startHour !== undefined && step.endHour !== undefined && step.startHour <= selectedHour && selectedHour < step.endHour) ?? -1;
      if (window >= 0) return window;
    }
    return dailyIndex(data, date);
  };
  const mapIndex = activeIndex(previewLayer);
  const linkDate = following ? "" : date;
  const matches = query.trim() ? geography.places.filter((place) => placeAddress(place).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0, 6) : [];
  const districts = geography.places.filter((place) => place.overview);
  const anyLoading = air.loading || rain.loading || heat.loading;
  const ready = topics.filter((topic) => sources[topic.layer].data && sources[topic.layer].data?.status !== "unavailable" && !sources[topic.layer].error).length;
  const watches = topics.flatMap((topic) => buildAreaWatch(sources[topic.layer].data, date, undefined, undefined, topic.metric).slice(0, 2)).sort((a, b) => b.severity - a.severity);
  const chartTopic = topics.find((topic) => topic.layer === chartLayer)!;

  useEffect(() => {
    const requestState = geoRequest.current;
    const updateDay = () => { const next = bangkokDate(); const previousToday = lastToday.current; setToday(next); setClock(Date.now()); setDate((previous) => !previous || following && previous === previousToday ? next : previous); lastToday.current = next; };
    updateDay();
    const timer = window.setInterval(updateDay, 60_000);
    return () => { clearInterval(timer); requestState.id++; };
  }, [following]);

  function chooseDate(next: string) { setDate(next); setSelectedHour(null); setFollowing(false); }
  function followNow() { setFollowing(true); setSelectedHour(null); setDate(bangkokDate()); setClock(Date.now()); }

  function selectPlace(place: MapPlace) {
    setSelected(place); setQuery(""); setSearchOpen(false); setFocus((value) => value + 1);
    goToStory("my-area");
  }
  function changeRegion(next: RegionId) {
    geoRequest.current.id++; setLocating(false); setLocationMessage("");
    setRegion(next); setSelected(null); setQuery(""); setSearchOpen(false);
  }
  function useLocation() {
    const places = geography.catalog?.places ?? [];
    if (!navigator.geolocation) { setLocationMessage("เบราว์เซอร์นี้ไม่รองรับตำแหน่ง เลือกย่านจากรายชื่อได้เลย"); return; }
    const request = ++geoRequest.current.id;
    setLocating(true); setLocationMessage("กำลังค้นหาจุดอ้างอิงใกล้คุณ…");
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (request !== geoRequest.current.id) return;
      const nearby = places.map((place) => ({ place, km: Math.hypot((place.lat - coords.latitude) * 111, (place.lng - coords.longitude) * 108) })).sort((a, b) => a.km - b.km)[0];
      setLocating(false);
      if (!nearby || nearby.km > 20) { setLocationMessage("ตำแหน่งอยู่นอกพื้นที่ข้อมูล ลองเลือกจังหวัดหรือค้นหาย่าน"); return; }
      setRegion(nearby.place.provinceId); selectPlace(nearby.place);
      setLocationMessage(`แสดงจุดอ้างอิงใกล้คุณประมาณ ${formatValue(nearby.km)} กม. ไม่ใช่ค่าตรวจวัด ณ ตำแหน่งของคุณ`);
    }, () => {
      if (request !== geoRequest.current.id) return;
      setLocating(false); setLocationMessage("เข้าถึงตำแหน่งไม่ได้ เลือกย่านจากรายชื่อหรือค้นหาแทนได้");
    }, { timeout: 10_000, maximumAge: 300_000 });
  }
  function summary(layer: EnvironmentLayer, summaryDate?: string) {
    const metric = topics.find((topic) => topic.layer === layer)!.metric;
    return summaryDate ? overviewValue(sources[layer].data, summaryDate, metric, selected, currentBoundary) : overviewStepValue(sources[layer].data, activeIndex(layer), metric, selected, currentBoundary);
  }
  function showTrend(layer: EnvironmentLayer) {
    setChartLayer(layer); setPreviewLayer(layer); goToStory("outlook");
  }

  const rainIndex = activeIndex("rain");
  const rainStep = rain.data?.steps[rainIndex];
  const rainTimeline = timelineIndices(rain.data?.steps ?? [], rainIndex);
  const rainStart = Math.max(0, rainTimeline.indexOf(rainStep?.cadence === "hour" ? currentForecastIndex(rain.data?.steps ?? [], new Date(clock)) : rainIndex));
  const rainSamples = rainTimeline.slice(rainStart, rainStart + (rainStep?.cadence === "hour" ? 24 : 7)).map((index) => ({ index, key: rain.data!.steps[index].key, value: overviewStepValue(rain.data, index, "secondary", selected, currentBoundary), label: rainStep?.window === null ? relativeDay(rain.data!.steps[index].date, today) : (rain.data!.steps[index].date !== rainStep?.date ? relativeDay(rain.data!.steps[index].date, today) + " " : "") + String(rain.data!.steps[index].startHour ?? 0).padStart(2, "0") + ":00" }));
  return <main className="ov-page bf-overview">
    <a className="ov-skip" href="#overview">ข้ามไปที่ข้อมูล</a>
    <header className="ov-header">
      <a className="ov-brand" href="/" aria-label="BKK Air Forecast หน้าหลัก"><span className="ov-brand-mark"><MapIcon name="air" size={25} /></span><span>BKK <b>Air</b><small>กรุงเทพฯ และปริมณฑล</small></span></a>
      <nav aria-label="เมนูหลัก"><a href="/" aria-current="page">ภาพรวม</a><a href="/rain">ฝน / น้ำ</a><a href="/air">ฝุ่น PM2.5</a><a href="/heat">อุณหภูมิ</a><a href="#my-area">ย่านของฉัน</a></nav>
      <ThemeToggle />
    </header>

    <section className="ov-hero" id="overview" tabIndex={-1}>
      <div className="ov-hero-copy">
        <div className="ov-live" role="status"><i className={ready ? "is-ready" : ""} aria-hidden="true" />{anyLoading ? "กำลังเชื่อมต่อข้อมูลล่าสุด" : `เชื่อมต่อข้อมูลได้ ${ready} จาก 3 ประเภท`}{today && <span>{new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(new Date(`${today}T12:00:00+07:00`))} · เวลาไทย</span>}</div>
        <h1>ก่อนออกจากบ้าน<br /><span>รู้ทันอากาศตอนนี้</span></h1>
        <p className="ov-hero-description">ฝนจะมาไหม ฝุ่นเป็นอย่างไร ร้อนแค่ไหน<br className="ov-desktop-break" /> ทุกเรื่องที่ต้องรู้ ก่อนวางแผนวันของคุณ</p>
        <div className="ov-topic-links" aria-label="เลือกเรื่องที่อยากรู้">{topics.map((topic) => <button key={topic.layer} className={`ov-${topic.layer}`} onClick={() => { setPreviewLayer(topic.layer); setChartLayer(topic.layer); }} aria-pressed={previewLayer === topic.layer}><MapIcon name={topic.layer} size={18} />{topic.layer === "air" ? "ฝุ่น PM2.5" : topic.layer === "rain" ? "ฝน" : "ความร้อน"}</button>)}</div>
        <div ref={searchGroup} className="ov-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false); }}>
          <label className="ov-sr-only" htmlFor="overview-search">ค้นหาถนน เขต หรือพื้นที่</label>
          <MapIcon name="search" size={21} />
          <input ref={search} id="overview-search" type="search" aria-describedby="overview-search-hint" placeholder="ค้นหาถนน เขต หรือพื้นที่ของคุณ" value={query} autoComplete="off" onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} onKeyDown={(event) => {
            if (event.key === "Escape") setSearchOpen(false);
            if (event.key === "Enter" && matches[0]) selectPlace(matches[0]);
            if (event.key === "ArrowDown") { event.preventDefault(); searchGroup.current?.querySelector<HTMLButtonElement>(".ov-search-results button")?.focus(); }
          }} />
          <span className="ov-sr-only" id="overview-search-hint">พิมพ์ชื่อพื้นที่ กดลูกศรลงเพื่อเลือกผลค้นหา Enter เพื่อเปิดย่าน หรือ Escape เพื่อปิดรายการ</span>
          {searchOpen && query.trim() && <ul className="ov-search-results" id="overview-results" aria-label="ผลค้นหาพื้นที่">{matches.map((place) => <li key={place.id}><button onClick={() => selectPlace(place)} onKeyDown={(event) => {
            if (event.key === "Escape") { search.current?.focus(); setSearchOpen(false); }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); const buttons = Array.from(searchGroup.current?.querySelectorAll<HTMLButtonElement>(".ov-search-results button") ?? []); const index = buttons.indexOf(event.currentTarget); if (index === 0 && event.key === "ArrowUp") search.current?.focus(); else buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus(); }
          }}><MapIcon name="pin" size={17} /><span>{placeLabel(place)}<small>{placeArea(place)}</small></span><MapIcon name="arrow" size={15} /></button></li>)}{!matches.length && <li className="ov-search-empty">{geography.loading ? "กำลังโหลดรายชื่อพื้นที่…" : geography.error || "ไม่พบพื้นที่ ลองชื่อเขตหรือจังหวัดอื่น"}</li>}</ul>}
        </div>
        <div className="ov-hero-actions"><a className="ov-button" href="#my-area">ดูย่านของฉัน<MapIcon name="arrow" size={19} /></a><a className="ov-text-link" href={forecastLink(previewLayer, region, linkDate, selected, selectedHour)}><MapIcon name="map" size={18} />เปิดแผนที่เต็ม</a></div>
        <p className="ov-coverage">ครอบคลุมกรุงเทพฯ และ 5 จังหวัดปริมณฑล</p>
      </div>
      <div className="bf-hero-trend ov-rain">
        <div className="bf-hero-trend-top"><span><MapIcon name="rain" size={20} />ฝนในช่วงถัดไป</span><span className="bf-model-tag">พยากรณ์</span></div>
        <div className="bf-hero-trend-value"><AnimatedNumber value={summary("rain")} /><small>มม.</small></div>
        <p>{rain.data?.steps[activeIndex("rain")] ? relativeDay(rain.data.steps[activeIndex("rain")].date, today) + " · " + rain.data.steps[activeIndex("rain")].label : "รอข้อมูลช่วงเวลาล่าสุด"}</p>
        <BriefingChart layer="rain" unit="มม." title="แนวโน้มฝนในช่วงถัดไป" loading={rain.loading} samples={rainSamples} activeKey={rain.data?.steps[activeIndex("rain")]?.key} onSelect={(index) => { const step = rain.data?.steps[index]; if (step) { setDate(step.date); setSelectedHour(step.cadence === "hour" ? step.startHour ?? null : null); setFollowing(false); } }} />
        <div className="bf-hero-trend-bottom"><span><i />Open-Meteo · ตามพิกัดต้นทาง</span><a href={forecastLink("rain", region, linkDate, selected, selectedHour)}>ดูฝน / น้ำ<MapIcon name="arrow" size={17} /></a></div>
      </div>
    </section>

    <div className="bf-overview-time"><div><span className={following ? "bf-live-dot" : ""} />{following ? "สถานการณ์ ณ เวลาปัจจุบัน" : "กำลังดูพยากรณ์ · " + relativeDay(date, today) + (selectedHour !== null ? " " + String(selectedHour).padStart(2, "0") + ":00 น." : " · ทั้งวัน")}<small>{today && following ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(clock)) + " น. · เวลาไทย" : ""}</small></div><button onClick={followNow} aria-pressed={following}><MapIcon name="refresh" size={16} />{following ? "ตามเวลาปัจจุบัน" : "กลับเวลาปัจจุบัน"}</button></div>
    <section className="ov-readings" aria-label="สรุปฝุ่น ฝน และความร้อน ณ ช่วงเวลาปัจจุบัน">{topics.map((topic) => {
      const source = sources[topic.layer];
      if (topic.layer === "air" && following) return <CurrentAir key="current-air" compact region={region} place={selected} refresh={refresh} forecastValue={summary("air")}><BriefingChart compact layer="air" title="พยากรณ์ฝุ่น 7 วัน" unit="µg/m³" loading={air.loading} samples={dates.map(day => ({ key: day, label: relativeDay(day, today), value: summary("air", day), index: dailyIndex(air.data, day) }))}/></CurrentAir>;
      return <article key={topic.layer} className={`ov-reading ov-${topic.layer}`}><div className="ov-reading-title"><MapIcon name={topic.layer} size={22} /><h2>{topic.title}</h2><span>{source.data?.steps[activeIndex(topic.layer)] ? relativeDay(source.data.steps[activeIndex(topic.layer)].date, today) : "รอข้อมูล"}</span></div><Reading layer={topic.layer} data={source.data} value={summary(topic.layer)} loading={source.loading} index={activeIndex(topic.layer)} /><BriefingChart compact layer={topic.layer} title={topic.title + " 7 วัน"} unit={topic.unit} loading={source.loading} samples={dates.map((day) => ({ key: day, label: relativeDay(day, today), value: summary(topic.layer, day), index: dailyIndex(source.data, day) }))} /><ReadingScale layer={topic.layer} value={summary(topic.layer)} /><p>{topic.layer === "air" && date === today && dailyIndex(source.data, date) < 0 && !!source.data?.points.length ? "พยากรณ์ฝุ่นเริ่มวันพรุ่งนี้ · วันนี้ไม่มีค่าพยากรณ์" : `${source.data?.steps[activeIndex(topic.layer)]?.label ?? topic.period} · ${selected ? "จุดที่เลือก" : "เฉลี่ยจุดที่มีข้อมูล"}`}</p><div className="ov-reading-bottom"><button onClick={() => showTrend(topic.layer)}><MapIcon name="chart" size={17} />ดูแนวโน้ม</button><a href={forecastLink(topic.layer, region, linkDate, selected, selectedHour)}>ดูรายละเอียด<MapIcon name="arrow" size={16} /></a></div><div className="ov-reading-source">{sourceState(source.data, source.loading, source.error)}{source.data?.timestampLabel && <span>{source.data.timestampLabel} · {overviewTimestamp(source.data)}</span>}</div></article>;
    })}</section>
    {!anyLoading && ready < 3 && <div className="ov-recovery" role="status"><MapIcon name="info" size={18} /><p>ข้อมูลบางประเภทไม่พร้อม แสดงเฉพาะค่าที่ได้รับจากต้นทาง</p><button className="ov-text-link" onClick={() => setRefresh((value) => value + 1)}>ลองโหลดอีกครั้ง<MapIcon name="refresh" size={16} /></button></div>}

    <RiskSignals scope={selected ? placeLabel(selected) : getRegion(region).shortNameTh} dateLabel={date ? relativeDay(date, today) : "วันนี้"} loading={anyLoading} signals={topics.map((topic) => {
      const source = sources[topic.layer];
      const reading = placeReading(topic.layer, topic.metric, source.loading ? null : summary(topic.layer), source.data?.steps[activeIndex(topic.layer)]);
      return { layer: topic.layer, name: topic.title + (source.data?.steps[activeIndex(topic.layer)] ? " · " + relativeDay(source.data.steps[activeIndex(topic.layer)].date, today) : ""), ...reading, href: forecastLink(topic.layer, region, linkDate, selected, selectedHour) };
    })} />

    <section className="ov-section ov-outlook" id="outlook" tabIndex={-1}>
      <div className="ov-section-heading"><div><h2>มองล่วงหน้า 7 วัน</h2><p>{selected ? placeLabel(selected) : getRegion(region).shortNameTh} · เลือกวันเพื่อเปลี่ยนภาพรวมและแผนที่</p></div><span className="ov-period-label"><MapIcon name="chart" size={18} />พยากรณ์รายวัน</span></div>
      <div className="ov-chart-tabs" aria-label="เลือกประเภทกราฟ">{topics.map((topic) => <button key={topic.layer} className={`ov-${topic.layer}`} aria-pressed={chartLayer === topic.layer} onClick={() => { setChartLayer(topic.layer); setPreviewLayer(topic.layer); }}><MapIcon name={topic.layer} size={20} />{topic.title}</button>)}</div>
      <ForecastInfographic layer={chartLayer} title={chartTopic.title} unit={chartTopic.unit} period={`${chartTopic.period} · ${selected ? "จุดอ้างอิงที่เลือก" : "เฉลี่ยจุดที่มีข้อมูล"}`} date={date} today={today} loading={sources[chartLayer].loading} onDate={chooseDate} days={dates.map((day) => { const value = summary(chartLayer, day); const reading = placeReading(chartLayer, chartTopic.metric, value, sources[chartLayer].data?.steps[dailyIndex(sources[chartLayer].data, day)]); return { date: day, value, title: reading.title, priority: reading.priority }; })} />
      <details className="ov-outlook-details"><summary>ดูตัวเลขทั้ง 3 ประเภท<MapIcon name="chevron" size={18} /></summary>
      <div className="ov-table-scroll"><table className="ov-outlook-table"><caption className="ov-sr-only">พยากรณ์รายวัน แยกค่าเฉลี่ยฝุ่น ปริมาณฝนสะสม และดัชนีความร้อน</caption><thead><tr><th scope="col">วางแผนวันของคุณ</th>{dates.map((day) => <th scope="col" key={day}><button aria-pressed={date === day} aria-label={`ดูพยากรณ์ ${relativeDay(day, today)}`} onClick={() => chooseDate(day)}>{relativeDay(day, today)}<small>{new Intl.DateTimeFormat("th-TH", { weekday: "long", timeZone: "Asia/Bangkok" }).format(new Date(`${day}T12:00:00+07:00`))}</small></button></th>)}</tr></thead><tbody>{topics.map((topic) => <tr key={topic.layer}><th scope="row"><span><MapIcon name={topic.layer} size={19} />{topic.title}</span><small>{topic.unit}{topic.layer === "rain" ? " / 24 ชม." : topic.layer === "heat" ? " · สูงสุด" : " · เฉลี่ย"}</small></th>{dates.map((day) => { const value = summary(topic.layer, day); const reading = placeReading(topic.layer, topic.metric, value, sources[topic.layer].data?.steps[dailyIndex(sources[topic.layer].data, day)]); return <td key={day} className={date === day ? "is-selected" : ""}><b>{formatValue(value)}</b><span className={`ov-day-level ov-priority-${reading.priority}`}>{value === null ? "ไม่มีข้อมูล" : reading.priority >= 2 ? "ควรติดตาม" : reading.priority === 1 ? topic.layer === "rain" ? "คาดว่ามีฝน" : "จับตา" : topic.layer === "rain" ? "ไม่ให้ฝน" : topic.layer === "heat" ? "ยังไม่เด่น" : "ระดับดี"}</span></td>; })}</tr>)}</tbody></table></div>
      {!dates.length && <div className="ov-empty" role="status">{anyLoading ? "กำลังโหลดแนวโน้มจากแหล่งข้อมูล…" : "ยังไม่มีแนวโน้มที่ใช้ได้ ลองโหลดข้อมูลอีกครั้ง"}</div>}
      </details>
      <p className="ov-section-note">— หมายถึงไม่มีข้อมูล · ฝนเป็นยอดสะสม 24 ชั่วโมง · ความร้อนเป็นค่าเฉลี่ยของค่าสูงสุดแต่ละจุด{selected ? " (ย่านที่เลือกใช้ค่าประมาณของจุดอ้างอิง)" : ""}</p>
    </section>


    <section className="ov-area ov-section" id="my-area" tabIndex={-1}>
      <div className="ov-section-heading"><div><h2>ย่านของฉัน</h2><p>เลือกบ้าน ที่ทำงาน หรือย่านที่จะไป ดูทั้ง 3 เรื่องในที่เดียว</p></div><button className="ov-location-button" onClick={useLocation} disabled={locating || geography.loading || !geography.catalog}><MapIcon name="location" size={18} />{locating ? "กำลังหาตำแหน่ง…" : "ใช้ตำแหน่งของฉัน"}</button></div>
      <div className="ov-area-layout"><div className="ov-area-picker"><label htmlFor="overview-province">จังหวัด<select id="overview-province" value={region} onChange={(event) => changeRegion(event.target.value as RegionId)}><option value="metro">กรุงเทพฯ–ปริมณฑลทั้งหมด</option>{provinces.map((province) => <option key={province.id} value={province.id}>{province.nameTh}</option>)}</select></label><label htmlFor="overview-district">เขต / อำเภอ<select id="overview-district" value={selected?.id ?? ""} disabled={geography.loading || !districts.length} onChange={(event) => { const place = geography.places.find((item) => item.id === event.target.value); if (place) selectPlace(place); else setSelected(null); }}><option value="">เลือกย่านที่ต้องการดู</option>{selected && !selected.overview && <option value={selected.id}>{placeLabel(selected)}</option>}{districts.map((place) => <option value={place.id} key={place.id}>{place.districtType}{place.district}{region === "metro" ? ` · ${place.province}` : ""}</option>)}</select></label><p className="ov-picker-note"><MapIcon name="info" size={16} />ชื่อย่านใช้ระบุจุดอ้างอิง ไม่ใช่ค่าของทั้งเขต</p></div>
      <div className="ov-area-detail">{selected ? <><div className="ov-selected-heading"><MapIcon name="pin" size={22} /><div><h3>{selected.districtType}{selected.district}</h3><p>{placeLabel(selected)} · {selected.province}</p></div><button aria-label="ล้างย่านที่เลือก" onClick={() => setSelected(null)}><MapIcon name="close" size={19} /></button></div><div className="ov-local-readings">{topics.map((topic) => <a href={forecastLink(topic.layer, region, linkDate, selected, selectedHour)} key={topic.layer}><span><MapIcon name={topic.layer} size={18} />{topic.title}</span><b>{formatValue(summary(topic.layer))}<small>{topic.unit}</small></b><span>{topic.layer === "rain" ? "พยากรณ์ตามพิกัด" : "ค่าประมาณ IDW"}</span></a>)}</div><a className="ov-text-link" href={forecastLink(previewLayer, region, linkDate, selected, selectedHour)}>ดูย่านนี้บนแผนที่<MapIcon name="arrow" size={17} /></a></> : <><h3>วันนี้คุณจะไปแถวไหน?</h3><p>เริ่มจากเลือกเขต / อำเภอ หรือค้นหาชื่อถนนด้านบน</p><div className="ov-district-chips">{districts.slice(0, 6).map((place) => <button key={place.id} onClick={() => selectPlace(place)}><MapIcon name="pin" size={15} />{place.district}</button>)}</div>{geography.error && <p role="alert">{geography.error}<button className="ov-text-link" onClick={() => setRefresh((value) => value + 1)}>ลองโหลดอีกครั้ง</button></p>}</>}{locationMessage && <p className="ov-location-message" role="status">{locationMessage}</p>}</div></div>
    </section>

<section className="ov-map-section"><div className="ov-section-heading"><div><h2>อากาศในแต่ละพื้นที่</h2><p>เลือกจุดบนแผนที่เพื่อดูพยากรณ์ในย่านของคุณ</p></div><a className="ov-text-link" href={forecastLink(previewLayer, region, linkDate, selected, selectedHour)}>เปิดแผนที่เต็ม<MapIcon name="arrow" size={17} /></a></div>      <section className={`ov-map-preview ov-${previewLayer}`} id="area-map" aria-label="แผนที่ภาพรวมพยากรณ์" tabIndex={-1}>
        <div className="ov-map-heading"><div><h2>{selected ? selected.district : getRegion(region).shortNameTh}</h2><span>{date ? relativeDay(date, today) : "วันนี้"} · {topics.find((topic) => topic.layer === previewLayer)?.title} · {preview.data?.steps[mapIndex]?.label ?? "รอช่วงเวลา"}</span></div><a href={forecastLink(previewLayer, region, linkDate, selected, selectedHour)} aria-label="สำรวจแผนที่เต็มจอ"><MapIcon name="expand" size={19} /></a></div>
        <div className="ov-map-canvas"><EnvironmentMap layer={previewLayer} mode="estimate" points={mapIndex < 0 ? [] : preview.data?.points ?? []} displayPoints={mapIndex < 0 ? [] : mapPoints} display="dots" index={Math.max(0, mapIndex)} metric={previewMetric} province={region} selected={selected} onSelect={(position) => { const place = geography.places.find((item) => item.lat === position.lat && item.lng === position.lng); if (place) selectPlace(place); }} legend={null} degraded={!!preview.data && preview.data.status !== "live"} satellite={false} showValues={false} showPlaceNames focus={focus} onBoundary={setBoundary} motionDisabled />
          {(preview.loading || mapIndex < 0) && <div className="ov-map-message" role="status">{preview.loading ? "กำลังโหลดพยากรณ์…" : "ยังไม่มีค่าพยากรณ์ในวันที่เลือก"}</div>}
        </div>
        <div className="ov-map-controls"><div className="ov-layer-tabs" aria-label="เลือกข้อมูลบนแผนที่">{topics.map((topic) => <button key={topic.layer} className={`ov-${topic.layer}`} aria-pressed={previewLayer === topic.layer} onClick={() => { setPreviewLayer(topic.layer); setChartLayer(topic.layer); }}><MapIcon name={topic.layer} size={17} />{topic.layer === "air" ? "PM2.5" : topic.layer === "rain" ? "ฝน" : "ร้อน"}</button>)}</div><a href={forecastLink(previewLayer, region, linkDate, selected, selectedHour)}>สำรวจ<MapIcon name="arrow" size={17} /></a></div>
        {!!dates.length && <div className="ov-map-dates" aria-label="เลือกวันบนแผนที่">{dates.map((day) => <button key={day} aria-pressed={date === day} onClick={() => chooseDate(day)}>{relativeDay(day, today)}</button>)}</div>}
        <div className="ov-map-legend" aria-label="เกณฑ์สีแผนที่">{getLegend(previewLayer, previewMetric).map((band) => <span key={band.label}><i style={{ background: band.color }} />{band.label}</span>)}<small>{previewLayer === "rain" ? "มม. / ช่วงที่เลือก" : previewLayer === "air" ? "µg/m³" : "°C"}</small></div>
      </section></section>

    <RoadFloodOverview region={region} place={selected} refresh={refresh}/><WaterOverview region={region} place={selected} refresh={refresh} />

    <section className="ov-section ov-watch"><div className="ov-section-heading"><div><h2>พื้นที่ที่ควรติดตาม</h2><p>จุดพยากรณ์รายวันที่ให้สัญญาณเด่นใน{date ? relativeDay(date, today) : "วันนี้"} · {getRegion(region).shortNameTh}</p></div><a className="ov-text-link" href={forecastLink(previewLayer, region, linkDate)}>ดูทุกพื้นที่<MapIcon name="arrow" size={17} /></a></div><div className="ov-watch-list">{watches.map((watch) => <a key={`${watch.layer}-${watch.point.id}`} href={forecastLink(watch.layer, region, watch.step.date, watch.point)}><span className={`ov-watch-symbol ov-${watch.layer}`}><MapIcon name={watch.layer} size={21} /></span><div><span className={`ov-watch-kind ov-priority-${watch.severity}`}>{watch.title}</span><h3>{watch.point.label}</h3><p>{watch.area} · {watch.degraded ? "ข้อมูลบางส่วน" : "พยากรณ์"}</p></div><b>{formatValue(watch.value)}<small>{watch.unit}</small></b><MapIcon name="arrow" size={18} /></a>)}</div>{!watches.length && <div className="ov-empty">{anyLoading ? "กำลังตรวจสอบสัญญาณจากแบบจำลอง…" : ready ? "ยังไม่พบจุดที่เข้าเกณฑ์ติดตามในข้อมูลที่มีของวันนี้" : "ยังประเมินพื้นที่ไม่ได้ เพราะข้อมูลต้นทางไม่พร้อม"}</div>}<p className="ov-section-note">แสดงไม่เกิน 2 จุดต่อประเภทจากข้อมูลที่มี ไม่ใช่เหตุการณ์ที่ยืนยันหรือประกาศเตือนภัย</p></section>

    <section className="ov-section ov-sources" id="sources" tabIndex={-1}><div className="ov-section-heading"><div><h2>ข้อมูลนี้มาจากไหน?</h2><p>รู้ที่มา เวลาอัปเดต และข้อจำกัดก่อนใช้วางแผน</p></div><button className="ov-location-button" disabled={anyLoading} onClick={() => setRefresh((value) => value + 1)}><MapIcon name="refresh" size={17} />{anyLoading ? "กำลังโหลด…" : "โหลดข้อมูลล่าสุด"}</button></div><div className="ov-source-list">{topics.map((topic) => { const source = sources[topic.layer]; return <details key={topic.layer}><summary><MapIcon name={topic.layer} size={21} /><span><b>{topic.title}</b><small>{topic.layer === "air" ? "CAMS · AirBKK · Air4Thai" : "Open-Meteo"}</small></span><span className="ov-source-state">{sourceState(source.data, source.loading, source.error)}</span><MapIcon name="chevron" size={18} /></summary><div><p><b>{source.data?.model ?? "กำลังรอข้อมูลจากต้นทาง"}</b></p><p>{topic.method} · {source.data?.timestampLabel ? `${source.data.timestampLabel} · ${overviewTimestamp(source.data)} (เวลาไทย)` : "ยังไม่มีเวลาอัปเดต"}</p>{source.error && <p role="alert">{source.error}</p>}{source.data?.notes.map((note) => <p key={note}>{note}</p>)}<a className="ov-text-link" href={`/${topic.layer}/advanced?province=${region}`}>อ่านข้อมูลและเครื่องมือขั้นสูง<MapIcon name="arrow" size={16} /></a></div></details>; })}</div><div className="ov-data-explainer"><MapIcon name="info" size={22} /><p>ค่าบนหน้านี้เป็นพยากรณ์เพื่อวางแผนเบื้องต้น ชื่อถนนช่วยบอกตำแหน่งจุดอ้างอิง แต่ไม่ได้หมายถึงความละเอียดระดับถนน ฝุ่นและความร้อนของย่านเป็นค่าประมาณเชิงพื้นที่ ส่วนฝนใช้ค่าจากต้นทางตามพิกัด</p></div></section>
    <footer className="ov-footer"><a className="ov-brand" href="/"><MapIcon name="air" size={24} /><span>BKK <b>Air</b></span></a><p>เข้าใจอากาศใกล้ตัว วางแผนทุกวัน</p><div><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a><a href="https://airbkk.com/" target="_blank" rel="noreferrer">AirBKK</a><a href="https://www.tmd.go.th/" target="_blank" rel="noreferrer">ประกาศกรมอุตุนิยมวิทยา</a></div></footer>
  </main>;
}
