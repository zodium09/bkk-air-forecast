"use client";
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import EnvironmentMap from "./environment-map";
import ForecastStory from "./forecast-story";
import RainRadar from "./rain-radar";
import WeatherIllustration from "./weather-illustration";
import ImportantEvents from "./important-events";
import UpstreamWatch from "./upstream-watch";
import { useLiveResource } from "./use-live-resource";
import type { RoadFloodPayload } from "../../lib/road-floods";
import type { WaterPayload } from "../../lib/water-levels";
import type { AirObservationPayload } from "../../lib/air-observations";
import type { NearbyRainPayload } from "../../lib/rain-nearby";
import type { TmdRadarPayload } from "../../lib/tmd-radar-data";
import { rainDistanceKm, type RainPosition } from "../../lib/rain-nearby";
import { forecastPeriod } from "../../lib/forecast-content";
import WaterOverview from "./water-overview";
import CurrentAir from "./current-air";
import AirAtmosphereAnalysis from "./air-atmosphere-analysis";
import { addDays } from "../../lib/forecast/timestamps";
import RoadFloodOverview from "./road-flood-overview";
import ThemeToggle from "../theme-toggle";
import { MapIcon, goToStory } from "./map-ui";
import { useEnvironmentData } from "./use-environment-data";
import { useMapPlaces } from "./use-map-places";
import { bangkokDate, formatValue, getLegend, relativeDay, type EnvironmentLayer, type MapDataset, type Metric } from "../../lib/map-intelligence";
import { DEFAULT_REGION_ID, CHAO_PHRAYA_REGION_ID, getRegion, getProvince, isCombinedRegion, regionOptionLabel, provinces, type RegionId } from "../../lib/provinces";
import { placeAddress, placeArea, placeLabel, type MapPlace } from "../../lib/map-places";
import { type MapBoundary } from "../../lib/map-surface";
import { forecastRiskAreas } from "../../lib/risk-area-data";
import RiskAreaSummary from "./risk-area-summary";
import { useAutoLocation } from "./use-auto-location";
import "./experience.css";
import { createPlacePoints } from "../../lib/place-outlook";
import { dailyIndex, overviewDates, overviewTimestamp, overviewStepValue, sourceState } from "../../lib/environment-overview";
import { currentForecastIndex } from "../../lib/dashboard-controls";
import "./map-workspace.css";
import "./night-theme.css";
import "./overview.css";
import "./briefing.css";
import "./content-flow.css";
import "./air-atmosphere.css";

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

export default function EnvironmentOverview() {
  const [region, setRegion] = useState<RegionId>(DEFAULT_REGION_ID);
  const [date, setDate] = useState("");
  const [today, setToday] = useState("");
  const [following, setFollowing] = useState(true);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [selected, setSelected] = useState<MapPlace | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [previewLayer, setPreviewLayer] = useState<EnvironmentLayer>("rain");
  const [refresh, setRefresh] = useState(0);
  const [focus, setFocus] = useState(0);
  const [boundary, setBoundary] = useState<{ region: RegionId; data: MapBoundary } | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const lastToday = useRef("");
  const searchGroup = useRef<HTMLDivElement>(null);
  const air = useEnvironmentData("air", region, "forecast", refresh);
  const rain = useEnvironmentData("rain", region, "forecast", refresh, "open-meteo", "secondary", true, selected?.id);
  const heat = useEnvironmentData("heat", region, "forecast", refresh);
  const geography = useMapPlaces(region, refresh);
  const {locating, message:autoLocationMessage, cancel:cancelLocation, locate} = useAutoLocation(geography.catalog?.places, place => {
    setRegion(place.provinceId); setSelected(place); setFocus(value=>value+1);
  });
  const waterHref = `/water?${new URLSearchParams({province:region,...(selected ? {lat:String(selected.lat),lng:String(selected.lng)} : {})})}`;
  const roadsNow = useLiveResource<RoadFloodPayload>("/api/road-floods", refresh);
  const waterNow = useLiveResource<WaterPayload>("/api/water-levels", refresh);
  const airNow = useLiveResource<AirObservationPayload>("/api/air-observations", refresh);
  const radarNow = useLiveResource<TmdRadarPayload>("/api/tmd-radar", refresh);
  const rainNow = useLiveResource<NearbyRainPayload>(selected ? `/api/rain-nearby?${new URLSearchParams({ lat: String(selected.lat), lng: String(selected.lng) })}` : null, refresh);
  const refreshAll = () => setRefresh(value => value + 1);
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
  const airDate = air.data?.steps[activeIndex("air")]?.date ?? date;
  const matches = query.trim() ? geography.places.filter((place) => placeAddress(place).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0, 6) : [];
  const districts = geography.places.filter((place) => place.overview);
  const anyLoading = air.loading || rain.loading || heat.loading;
  const ready = topics.filter((topic) => sources[topic.layer].data && sources[topic.layer].data?.status !== "unavailable" && !sources[topic.layer].error).length;

  useEffect(() => {
    const updateDay = () => { const next = bangkokDate(); const previousToday = lastToday.current; setToday(next); setClock(Date.now()); setDate((previous) => !previous || following && previous === previousToday ? next : previous); lastToday.current = next; };
    updateDay();
    const timer = window.setInterval(updateDay, 60_000);
    return () => { clearInterval(timer); };
  }, [following]);

  function chooseDate(next: string) { setDate(next); setSelectedHour(null); setFollowing(false); }
  function followNow() { setFollowing(true); setSelectedHour(null); setDate(bangkokDate()); setClock(Date.now()); }

  function selectPlace(place: MapPlace) {
    cancelLocation(); setLocationMessage("");
    setSelected(place); setQuery(""); setSearchOpen(false); setFocus((value) => value + 1);
    goToStory("my-area");
  }
  function changeRegion(next: RegionId) {
    cancelLocation(); setLocationMessage("");
    setRegion(next); setSelected(null); setQuery(""); setSearchOpen(false);
  }
  function selectRadarPosition(position: RainPosition) {
    cancelLocation();
    const nearby = (geography.catalog?.places ?? []).map(place => ({ place, km: rainDistanceKm(position, place) })).sort((a,b) => a.km-b.km)[0];
    if (!nearby || nearby.km > 20) { setLocationMessage("จุดที่เลือกอยู่นอกพื้นที่ข้อมูล เลือกพื้นที่ในเจ้าพระยาหรือกรุงเทพฯ–ปริมณฑล"); return; }
    if (!isCombinedRegion(region)) setRegion(nearby.place.provinceId);
    setSelected(nearby.place); setFocus(value => value+1);
    setLocationMessage(`วิเคราะห์รอบจุดอ้างอิง ${placeLabel(nearby.place)} ใกล้จุดที่เลือก ${formatValue(nearby.km)} กม.`);
  }

  function renderForecast(layer: EnvironmentLayer) {
    const source = sources[layer];
    return <ForecastStory layer={layer} data={source.data} index={activeIndex(layer)} loading={source.loading} error={source.error} today={today} date={date} dates={dates} scope={selected ? placeLabel(selected) + " · จุดอ้างอิงที่เลือก" : getRegion(region).shortNameTh + " · เฉลี่ยจุดพยากรณ์ที่มีข้อมูล"} following={following} href={forecastLink(layer, region, linkDate, selected, selectedHour)} valueAt={(index, metric) => overviewStepValue(source.data, index, metric, selected, currentBoundary)} onDate={chooseDate} onTime={index => {
      const step = source.data?.steps[index];
      if (step) { setDate(step.date); setSelectedHour(step.window !== null ? step.startHour ?? null : null); setFollowing(false); }
    }} />;
  }

  function renderWatch(layer: EnvironmentLayer) {
    const source = sources[layer], topic = topics.find(item => item.layer === layer)!;
    const watchDate = source.data?.steps[activeIndex(layer)]?.date ?? date;
    const watchTopic = forecastRiskAreas(source.data,dailyIndex(source.data,watchDate),region,topic.metric,layer);
    return <section className="ov-watch fc-topic-watch" id={`watch-${layer}`} aria-label={`พื้นที่ที่ควรติดตาม · ${topic.title}`}>
      <div className="ov-section-heading"><div><h3>พื้นที่ที่ควรติดตาม · {topic.title}</h3><p>พยากรณ์รายวัน · {watchDate ? relativeDay(watchDate, today) : "รอวันที่"} · {getRegion(region).shortNameTh}</p></div><a className="ov-text-link" href={forecastLink(layer, region, watchDate)}>ดูทุกพื้นที่<MapIcon name="arrow" size={17} /></a></div>
      <RiskAreaSummary title={`พื้นที่พยากรณ์${topic.title}และระดับติดตาม`} topics={[{...watchTopic,loading:source.loading}]} region={region} boundary={currentBoundary}/>
    </section>;
  }

  function renderSource(layer: EnvironmentLayer) {
    const source = sources[layer], topic = topics.find(item => item.layer === layer)!;
    return <div className="ov-source-list fc-topic-source" id={`sources-${layer}`}><details><summary><MapIcon name={layer} size={21} /><span><b>ที่มาและข้อจำกัด · {topic.title}</b><small>{layer === "air" ? "CAMS · AirBKK · Air4Thai" : "Open-Meteo"}</small></span><span className="ov-source-state">{sourceState(source.data, source.loading, source.error)}</span><MapIcon name="chevron" size={18} /></summary><div><p><b>{source.data?.model ?? "กำลังรอข้อมูลจากต้นทาง"}</b></p><p>{topic.method} · {source.data?.timestampLabel ? `${source.data.timestampLabel} · ${overviewTimestamp(source.data)} (เวลาไทย)` : "ยังไม่มีเวลาอัปเดต"}</p>{source.error && <p role="alert">{source.error}</p>}{source.data?.notes.map(note => <p key={note}>{note}</p>)}<a className="ov-text-link" href={`/${layer}/advanced?province=${region}`}>อ่านข้อมูลและเครื่องมือขั้นสูง<MapIcon name="arrow" size={16} /></a></div></details></div>;
  }

  function renderMap(layer: EnvironmentLayer) {
    const topic = topics.find(item => item.layer === layer)!;
    const label = layer === "rain" ? "ฝน" : layer === "air" ? "ฝุ่น PM2.5" : "ความร้อน";
    const open = previewLayer === layer;
    return <section className="ov-map-section fc-topic-map" id={`map-${layer}`} tabIndex={-1} aria-label={`แผนที่${label}`}>
      <div className="ov-section-heading"><div><h3>{label}ในแต่ละพื้นที่</h3><p>เลือกจุดบนแผนที่เพื่อดูพยากรณ์ในพื้นที่ของคุณ</p></div><a className="ov-text-link" href={forecastLink(layer, region, linkDate, selected, selectedHour)}>เปิดแผนที่เต็ม<MapIcon name="arrow" size={17} /></a></div>
      {open ? <section className={`ov-map-preview ov-${layer}`} id="area-map" aria-label={`แผนที่ภาพรวมพยากรณ์${label}`} tabIndex={-1}>
        <div className="ov-map-heading"><div><h4>{selected ? selected.district : getRegion(region).shortNameTh}</h4><span>{forecastPeriod(preview.data?.steps[mapIndex], today)} · {topic.title}</span></div><a href={forecastLink(layer, region, linkDate, selected, selectedHour)} aria-label="สำรวจแผนที่เต็มจอ"><MapIcon name="expand" size={19} /></a></div>
        <div className="ov-map-canvas"><EnvironmentMap layer={layer} mode="estimate" points={mapIndex < 0 ? [] : preview.data?.points ?? []} displayPoints={mapIndex < 0 ? [] : mapPoints} display="dots" index={Math.max(0, mapIndex)} metric={previewMetric} province={region} selected={selected} onSelect={position => {
          const place = geography.places.find(item => item.lat === position.lat && item.lng === position.lng);
          if (place) selectPlace(place);
        }} onLocate={locate} legend={null} degraded={!!preview.data && preview.data.status !== "live"} satellite={false} showValues={false} showPlaceNames focus={focus} onBoundary={setBoundary} motionDisabled />
          {(preview.loading || mapIndex < 0) && <div className="ov-map-message" role="status">{preview.loading ? "กำลังโหลดพยากรณ์…" : "ยังไม่มีค่าพยากรณ์ในวันที่เลือก"}</div>}
        </div>
        {!!dates.length && <div className="ov-map-dates" aria-label="เลือกวันบนแผนที่">{dates.map(day => <button key={day} aria-pressed={date === day} onClick={() => chooseDate(day)}>{relativeDay(day, today)}</button>)}</div>}
        <div className="ov-map-legend" aria-label="เกณฑ์สีแผนที่">{getLegend(layer, previewMetric).map(band => <span key={band.label}><i style={{ background: band.color }} />{band.label}</span>)}<small>{topic.unit}{layer === "rain" && " / ช่วงที่เลือก"}</small></div>
        {layer === "rain" && <p className="ov-section-note">สีแสดงปริมาณฝนตามช่วงที่เลือก · เกณฑ์ระดับฝนรายวันใช้กับยอดสะสมทั้งวันเท่านั้น</p>}
      </section> : <button className="fc-open-topic-map" onClick={() => { setPreviewLayer(layer); requestAnimationFrame(() => goToStory(`map-${layer}`)); }}><MapIcon name="map" size={20} />แสดงแผนที่{label}ในหน้านี้<MapIcon name="chevron" size={17} /></button>}
    </section>;
  }
  return <main className="ov-page bf-overview">
    <a className="ov-skip" href="#important-events">ข้ามไปที่ข้อมูล</a>
    <header className="ov-header">
      <a className="ov-brand" href="/" aria-label="BKK Air Forecast หน้าหลัก"><span className="ov-brand-mark"><MapIcon name="air" size={25} /></span><span>BKK <b>Air</b><small>เจ้าพระยาและกรุงเทพฯ–ปริมณฑล</small></span></a>
      <nav aria-label="เมนูหลัก"><a href="/" aria-current="page">ภาพรวม</a><a href={forecastLink("rain", region, "", selected)}>ฝน</a><a href={waterHref}>ระดับน้ำ</a><a href={forecastLink("air", region, "", selected)}>ฝุ่น PM2.5</a><a href={forecastLink("heat", region, "", selected)}>ความร้อน</a><a href="#my-area">พื้นที่ของฉัน</a></nav>
      <ThemeToggle />
    </header>

    <ImportantEvents region={region} position={selected ? { ...selected, label: placeLabel(selected) } : null} roads={roadsNow} water={waterNow} air={airNow} rain={rainNow} heat={heat.data} heatLoading={heat.loading} heatError={heat.error} clock={clock} onRefresh={refreshAll}/>


    <section className="ov-hero" id="overview" tabIndex={-1}>
      <div className="ov-hero-copy">
        <div className="ov-live" role="status"><i className={ready ? "is-ready" : ""} aria-hidden="true" />{anyLoading ? "กำลังเชื่อมต่อข้อมูลล่าสุด" : `พยากรณ์พร้อม ${ready} จาก 3 ประเภท`}{today && <span>{new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(new Date(`${today}T12:00:00+07:00`))} · เวลาไทย</span>}</div>
        <h1>อากาศและน้ำ<br /><span>ใกล้ตัวคุณ</span></h1>
        <p className="ov-hero-description">เลือกพื้นที่ที่คุณจะไป ดูค่าตรวจวัดล่าสุด<br className="ov-desktop-break" /> และพยากรณ์ เพื่อวางแผนก่อนออกจากบ้าน</p>
        <div ref={searchGroup} className="ov-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false); }}>
          <label className="ov-sr-only" htmlFor="overview-search">ค้นหาถนน เขต หรือพื้นที่</label>
          <MapIcon name="search" size={21} />
          <input ref={search} id="overview-search" type="search" aria-describedby="overview-search-hint" placeholder="ค้นหาถนน เขต หรือพื้นที่ของคุณ" value={query} autoComplete="off" onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} onKeyDown={(event) => {
            if (event.key === "Escape") setSearchOpen(false);
            if (event.key === "Enter" && matches[0]) selectPlace(matches[0]);
            if (event.key === "ArrowDown") { event.preventDefault(); searchGroup.current?.querySelector<HTMLButtonElement>(".ov-search-results button")?.focus(); }
          }} />
          <span className="ov-sr-only" id="overview-search-hint">พิมพ์ชื่อพื้นที่ กดลูกศรลงเพื่อเลือกผลค้นหา Enter เพื่อเปิดพื้นที่ หรือ Escape เพื่อปิดรายการ</span>
          {searchOpen && query.trim() && <ul className="ov-search-results" id="overview-results" aria-label="ผลค้นหาพื้นที่">{matches.map((place) => <li key={place.id}><button onClick={() => selectPlace(place)} onKeyDown={(event) => {
            if (event.key === "Escape") { search.current?.focus(); setSearchOpen(false); }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); const buttons = Array.from(searchGroup.current?.querySelectorAll<HTMLButtonElement>(".ov-search-results button") ?? []); const index = buttons.indexOf(event.currentTarget); if (index === 0 && event.key === "ArrowUp") search.current?.focus(); else buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus(); }
          }}><MapIcon name="pin" size={17} /><span>{placeLabel(place)}<small>{placeArea(place)}</small></span><MapIcon name="arrow" size={15} /></button></li>)}{!matches.length && <li className="ov-search-empty">{geography.loading ? "กำลังโหลดรายชื่อพื้นที่…" : geography.error || "ไม่พบพื้นที่ ลองชื่อเขตหรือจังหวัดอื่น"}</li>}</ul>}
        </div>
        <div className="ov-hero-actions"><a className="ov-button" href="#my-area">ดูพื้นที่ของฉัน<MapIcon name="arrow" size={19} /></a><a className="ov-text-link" href={forecastLink(previewLayer, region, linkDate, selected, selectedHour)}><MapIcon name="map" size={18} />เปิดแผนที่เต็ม</a></div>
        <p className="ov-coverage">ขอบเขตลุ่มน้ำเจ้าพระยาจริง + กรุงเทพฯ–ปริมณฑลเดิม · เลือกพื้นที่ด้านล่าง</p>
      </div>
      <WeatherIllustration/>
    </section>

    <section className="ov-area ov-section" id="my-area" tabIndex={-1}>
      <div className="ov-section-heading"><div><h2>พื้นที่ของฉัน</h2><p>เลือกพื้นที่ครั้งเดียว แล้วอ่านข้อมูลของพื้นที่นี้ต่อทีละเรื่อง</p></div><button className="ov-location-button" onClick={()=>{setLocationMessage("");locate();}} disabled={locating || geography.loading || !geography.catalog}><MapIcon name="location" size={18} />{locating ? "กำลังหาตำแหน่ง…" : "ใช้ตำแหน่งของฉัน"}</button></div>
      <div className="ov-area-layout"><div className="ov-area-picker"><label htmlFor="overview-province">จังหวัด<select id="overview-province" value={region} onChange={(event) => changeRegion(event.target.value as RegionId)}><option value={CHAO_PHRAYA_REGION_ID}>เจ้าพระยาและกรุงเทพฯ–ปริมณฑล</option><option value="metro">กรุงเทพฯ–ปริมณฑลเดิม</option>{provinces.map((province) => <option key={province.id} value={province.id}>{regionOptionLabel(province)}</option>)}</select></label><label htmlFor="overview-district">เขต / อำเภอ<select id="overview-district" value={selected?.id ?? ""} disabled={geography.loading || !districts.length} onChange={(event) => { const place = geography.places.find((item) => item.id === event.target.value); if (place) selectPlace(place); else { cancelLocation(); setSelected(null); } }}><option value="">เลือกพื้นที่ที่ต้องการดู</option>{selected && !selected.overview && <option value={selected.id}>{placeLabel(selected)}</option>}{districts.map((place) => <option value={place.id} key={place.id}>{place.districtType}{place.district}{isCombinedRegion(region) ? ` · ${place.province}` : ""}</option>)}</select></label><p className="ov-picker-note"><MapIcon name="info" size={16} />ชื่อพื้นที่ใช้ระบุจุดอ้างอิง ไม่ใช่ค่าของทั้งเขต{getProvince(region).scopeNote && ` · ${getProvince(region).scopeNote}`}</p></div>
      <div className="ov-area-detail">{selected ? <><div className="ov-selected-heading"><MapIcon name="pin" size={22} /><div><h3>{selected.districtType}{selected.district}</h3><p>{placeLabel(selected)} · {selected.province}</p></div><button aria-label="ล้างพื้นที่ที่เลือก" onClick={() => { cancelLocation(); setSelected(null); }}><MapIcon name="close" size={19} /></button></div><p className="fc-area-context">ใช้พื้นที่นี้กับฝน ระดับน้ำ ฝุ่น และความร้อนด้านล่าง</p><a className="ov-text-link" href="#chapter-rain">เริ่มอ่านฝนในพื้นที่นี้<MapIcon name="arrow" size={17} /></a></> : <><h3>วันนี้คุณจะไปแถวไหน?</h3><p>เริ่มจากเลือกเขต / อำเภอ หรือค้นหาชื่อถนนด้านบน</p><div className="ov-district-chips">{districts.slice(0, 6).map((place) => <button key={place.id} onClick={() => selectPlace(place)}><MapIcon name="pin" size={15} />{place.district}</button>)}</div>{geography.error && <p role="alert">{geography.error}<button className="ov-text-link" onClick={() => setRefresh((value) => value + 1)}>ลองโหลดอีกครั้ง</button></p>}</>}{(locationMessage || autoLocationMessage) && <p className="ov-location-message" role="status">{locationMessage || autoLocationMessage}</p>}</div></div>
    </section>

    <div className="bf-overview-time"><div><span className={following ? "bf-live-dot" : ""} />{following ? "พยากรณ์ช่วงที่ใกล้เวลาปัจจุบัน" : "กำลังดูพยากรณ์ · " + relativeDay(date, today) + (selectedHour !== null ? " " + String(selectedHour).padStart(2, "0") + ":00 น." : " · ทั้งวัน")}<small>{today && following ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(clock)) + " น. · เวลาไทย" : ""}</small></div><button onClick={followNow} aria-pressed={following}><MapIcon name="refresh" size={16} />{following ? "ตามเวลาปัจจุบัน" : "กลับเวลาปัจจุบัน"}</button></div>
    <div className="fc-refresh-row"><p>วันพยากรณ์ใช้ร่วมกัน · ค่าตรวจวัดแต่ละเรื่องคงเวลาของต้นทาง</p><button className="ov-location-button" disabled={anyLoading} onClick={() => setRefresh(value => value + 1)}><MapIcon name="refresh" size={17}/>{anyLoading ? "กำลังโหลด…" : "โหลดข้อมูลล่าสุด"}</button></div>
    <div id="outlook" className="fc-chapters">
      <section className="fc-chapter bf-rain" id="chapter-rain" aria-labelledby="chapter-rain-heading" tabIndex={-1}>
        <header className="fc-chapter-heading"><MapIcon name="rain" size={31}/><div><h2 id="chapter-rain-heading">ฝน</h2><p>เรดาร์ฝนใกล้พื้นที่ โอกาสฝน และปริมาณสะสมตามช่วงเวลา</p></div><img className="ex-chapter-art" src="/home-rain.png" width="146" height="94" alt="" loading="lazy"/></header>
        <RainRadar region={region} position={selected ? { ...selected, label: placeLabel(selected) } : null} onSelect={selectRadarPosition} rainData={rain.data} refresh={refresh} sharedResources={{catalog:radarNow,analysis:rainNow}} onRefresh={refreshAll}/>
        {renderForecast("rain")}
        {renderWatch("rain")}
        {renderMap("rain")}
        {renderSource("rain")}
      </section>
      <section className="fc-chapter bf-water" id="chapter-water" aria-labelledby="chapter-water-heading" tabIndex={-1}>
        <header className="fc-chapter-heading"><MapIcon name="water" size={31}/><div><h2 id="chapter-water-heading">ระดับน้ำ</h2><p>สถานีน้ำ คลอง แม่น้ำ และน้ำบนถนน · ค่าตรวจวัดล่าสุด</p></div><a className="ov-text-link" href={waterHref}>เปิดหน้าระดับน้ำ<MapIcon name="arrow" size={17}/></a></header>
        <RoadFloodOverview compact region={region} place={selected} refresh={refresh} sharedResource={roadsNow}/>
        <WaterOverview region={region} place={selected} refresh={refresh} sharedResource={waterNow} onRefresh={refreshAll}/>
        <details className="ex-upstream-preview"><summary>ดูต้นน้ำและการระบายจากอ่าง<MapIcon name="chevron" size={18}/></summary><UpstreamWatch refresh={refresh}/></details>
      </section>
      <section className="fc-chapter bf-air" id="chapter-air" aria-labelledby="chapter-air-heading" tabIndex={-1}>
        <header className="fc-chapter-heading"><MapIcon name="air" size={31}/><div><h2 id="chapter-air-heading">ฝุ่น PM2.5</h2><p>ค่าตรวจวัด พยากรณ์ฝุ่น ปัจจัยอากาศ และแนวโน้มลมหนาวในพื้นที่ของคุณ</p></div><img className="ex-chapter-art" src="/home-air.png" width="146" height="94" alt="" loading="lazy"/></header>
        <nav className="aa-chapter-links" aria-label="ข้ามไปข้อมูลเรื่องฝุ่น"><a href="#current-observations">ค่าตรวจวัด</a><a href="#forecast-air">พยากรณ์ฝุ่น</a><a href="#air-analysis">ปัจจัยที่เกี่ยวกับฝุ่น</a><a href="#cold-wind">ลมหนาว</a></nav>
        <div className="fc-current" id="current-observations" tabIndex={-1}><CurrentAir region={region} place={selected} refresh={refresh} sharedResource={airNow} onRefresh={refreshAll}/></div>
        {renderForecast("air")}
        <AirAtmosphereAnalysis region={region} selected={selected} date={airDate} today={today} refresh={refresh} pmValue={overviewStepValue(air.data, dailyIndex(air.data, airDate), "primary", selected, currentBoundary)} previousPm={airDate ? overviewStepValue(air.data, dailyIndex(air.data, addDays(airDate, -1)), "primary", selected, currentBoundary) : null} pmStatus={air.data?.status} onDate={chooseDate} onRetry={() => setRefresh(value => value + 1)}/>
        {renderWatch("air")}
        {renderMap("air")}
        {renderSource("air")}
      </section>
      <section className="fc-chapter bf-heat" id="chapter-heat" aria-labelledby="chapter-heat-heading" tabIndex={-1}>
        <header className="fc-chapter-heading"><MapIcon name="heat" size={31}/><div><h2 id="chapter-heat-heading">ความร้อน</h2><p>เทียบดัชนีความร้อนกับอุณหภูมิ และเลือกช่วงเวลาทำกิจกรรม</p></div><img className="ex-chapter-art" src="/home-heat.png" width="146" height="94" alt="" loading="lazy"/></header>
        {renderForecast("heat")}
        {renderWatch("heat")}
        {renderMap("heat")}
        {renderSource("heat")}
      </section>
    </div>
    <footer className="ov-footer"><a className="ov-brand" href="/"><MapIcon name="air" size={24} /><span>BKK <b>Air</b></span></a><p>เข้าใจอากาศใกล้ตัว วางแผนทุกวัน</p><div><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a><a href="https://airbkk.com/" target="_blank" rel="noreferrer">AirBKK</a><a href="https://www.tmd.go.th/" target="_blank" rel="noreferrer">ประกาศกรมอุตุนิยมวิทยา</a></div></footer>
  </main>;
}
