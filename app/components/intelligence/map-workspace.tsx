"use client";
/* eslint-disable @next/next/no-html-link-for-pages */
import { useEffect, useMemo, useRef, useState } from "react";
import EnvironmentMap from "./environment-map";
import LocationInsight from "./location-insight";
import ThemeToggle from "../theme-toggle";
import MapTimeControl from "./map-time-control";
import AreaWatchList from "./area-watch-list";
import PlaceOutlookList from "./place-outlook-list";
import TopicBriefing from "./topic-briefing";
import WaterOverview from "./water-overview";
import CurrentAir from "./current-air";
import RoadFloodOverview from "./road-flood-overview";
import { DashboardChart } from "./dashboard-controls";
import { DataStatus, LayerSwitcher, MapErrorState, MapIcon, MapLegend, MapLoadingState, MapShell } from "./map-ui";
import { useEnvironmentData } from "./use-environment-data";
import { useMapPlaces } from "./use-map-places";
import { placeAddress } from "../../lib/map-places";
import { boundaryContains, interpolateMapValue, type MapBoundary } from "../../lib/map-surface";
import { average, closestPoint, formatValue, interpretation, layerInfo, metricName, modeLabels, pointValue, relativeDay, type DataMode, type EnvironmentLayer, type MapPoint, type Metric } from "../../lib/map-intelligence";
import { getRegion, provinces, type RegionId } from "../../lib/provinces";
import { currentForecastIndex, nextTimelineIndex, type WeatherSource } from "../../lib/dashboard-controls";
import { buildAreaWatch, type AreaWatch } from "../../lib/area-watch";
import { createPlacePoints } from "../../lib/place-outlook";
import "./map-workspace.css";
import "./night-theme.css";
import "./dashboard.css";
import "./map-first.css";
import "./briefing-workspace.css";
import "./overview.css";
import "./briefing.css";
import "./content-flow.css";

type View = "map" | "watch" | "forecast" | "location" | "settings" | "search";
const emptyPoints: MapPoint[] = [];
export default function MapWorkspace({ initialLayer = "air" }: { initialLayer?: EnvironmentLayer }) {
  const [layer, setLayer] = useState(initialLayer);
  const [province, setProvince] = useState<RegionId>("metro");
  const [mode, setMode] = useState<DataMode>("estimate");
  const [source, setSource] = useState<WeatherSource>("open-meteo");
  const [metric, setMetric] = useState<Metric>(initialLayer === "rain" ? "secondary" : "primary");
  const [timeKey, setTimeKey] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  const [selected, setSelected] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [focus, setFocus] = useState(0);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("map");
  const [satellite, setSatellite] = useState(false);
  const [showPlaceNames, setShowPlaceNames] = useState(true);
  const [exploring, setExploring] = useState(false);
  const [boundary, setBoundary] = useState<{ region: RegionId; data: MapBoundary } | null>(null);
  const [legend, setLegend] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [compareKey, setCompareKey] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const { data, loading, error } = useEnvironmentData(layer, province, mode, refresh, source, metric, true);
  const geography = useMapPlaces(province, refresh);
  const anchors = data?.points ?? emptyPoints;
  const points = useMemo(() => createPlacePoints(data, boundary?.region === province ? boundary.data : null, geography.places), [data, boundary, province, geography.places]);
  const requestedIndex = data?.steps.findIndex((s) => s.key === timeKey) ?? -1;
  const index = requestedIndex >= 0 ? requestedIndex : Math.max(0, currentForecastIndex(data?.steps ?? [], new Date(clock)));
  const step = data?.steps[index];
  const compare = compareKey ? data?.steps.findIndex((s) => s.key === compareKey) ?? -1 : -1;
  const point = useMemo(() => selected ? closestPoint(points, selected.lat, selected.lng) : null, [points, selected]);
  const selectionSupported = !!selected && boundary?.region === province && boundaryContains(boundary.data, selected.lat, selected.lng);
  const spatialSelection = mode === "estimate" && !!selected && (!point || Math.hypot(point.lat - selected.lat, point.lng - selected.lng) > (data?.valueMethod === "provider" ? 0.0000001 : 0.0001));
  const values = useMemo(() => data?.steps.map((_, i) => spatialSelection && selected
    ? selectionSupported && data.valueMethod !== "provider" ? interpolateMapValue(anchors, i, metric, selected.lat, selected.lng) : null
    : point ? pointValue(point, i, metric) : selected ? null : average(points.map((p) => pointValue(p, i, metric)))) ?? [], [data, anchors, points, point, metric, selected, spatialSelection, selectionSupported]);
  const currentValue = values[index] ?? null;
  const companionValues = useMemo(() => data?.steps.map((_, i) => {
    const other: Metric = metric === "primary" ? "secondary" : "primary";
    return spatialSelection && selected ? selectionSupported && data.valueMethod !== "provider" ? interpolateMapValue(anchors, i, other, selected.lat, selected.lng) : null : point ? pointValue(point, i, other) : selected ? null : average(points.map(p => pointValue(p, i, other)));
  }) ?? [], [data, metric, spatialSelection, selected, selectionSupported, anchors, point, points]);
  const scope = selected?.label ?? (selected ? spatialSelection ? "ตำแหน่งบนแผนที่" : point?.label ?? "ตำแหน่งที่เลือก" : `${layer === "rain" ? "เฉลี่ยจุด · " : ""}${getRegion(province).shortNameTh}`);
  const watchCount = buildAreaWatch(data ? { ...data, points } : null, step?.date ?? "", step?.window != null ? step.startHour : undefined, step?.cadence).length;

  useEffect(() => {
    if (requestedIndex >= 0) return;
    const sync = () => { if (!document.hidden) setClock(Date.now()); };
    const timer = window.setInterval(sync, 60_000);
    document.addEventListener("visibilitychange", sync);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", sync); };
  }, [requestedIndex]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { setReducedMotion(media.matches); if (media.matches) setPlaying(false); };
    sync(); media.addEventListener("change", sync);
    const params = new URLSearchParams(location.search);
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("bkk-map-display") ?? "{}");
        if (typeof saved.showPlaceNames === "boolean") setShowPlaceNames(saved.showPlaceNames);
        if (typeof saved.satellite === "boolean") setSatellite(saved.satellite);
      } catch { /* Preferences are optional. */ }
      setProvince(getRegion(params.get("province") ?? "metro").id);
      setSource(initialLayer !== "rain" && params.get("source") === "tmd" ? "tmd" : "open-meteo");
      setTimeKey(params.get("time") ?? "");
      setClock(Date.now());
      if (params.get("metric") === "secondary" && initialLayer !== "air") setMetric("secondary");
      const lat = Number(params.get("lat")), lng = Number(params.get("lng"));
      if (params.has("lat") && params.has("lng") && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) setSelected({ lat, lng });
      setInitialized(true);
    }, 0);
    return () => { clearTimeout(timer); media.removeEventListener("change", sync); };
  }, [initialLayer]);
  useEffect(() => {
    if (!initialized) return;
    try { localStorage.setItem("bkk-map-display", JSON.stringify({ showPlaceNames, satellite })); } catch { /* Storage is optional. */ }
  }, [initialized, showPlaceNames, satellite]);
  useEffect(() => {
    if (!initialized) return;
    const params = new URLSearchParams({ province, mode, metric, source });
    if (timeKey) params.set("time", timeKey);
    if (selected) { params.set("lat", String(selected.lat)); params.set("lng", String(selected.lng)); }
    history.replaceState(null, "", `/${layer}?${params}`);
    document.title = `BKK Air Forecast · แผนที่${layerInfo[layer].thai} กรุงเทพฯ–ปริมณฑล`;
  }, [initialized, province, mode, metric, source, timeKey, selected, layer]);
  useEffect(() => {
    if (!playing || !data?.steps.length || reducedMotion) return;
    const timer = window.setInterval(() => setTimeKey((key) => {
      const current = data.steps.findIndex((s) => s.key === key);
      return data.steps[nextTimelineIndex(data.steps, current >= 0 ? current : index)].key;
    }), 1800);
    const stop = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", stop);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", stop); };
  }, [playing, data, reducedMotion, index]);
  useEffect(() => {
    const pop = () => {
      const next = location.pathname.split("/")[1];
      if (next !== "air" && next !== "rain" && next !== "heat" && next !== "") return;
      const nextLayer = next || "air";
      const params = new URLSearchParams(location.search);
      setLayer(nextLayer); setProvince(getRegion(params.get("province") ?? "metro").id);
      setTimeKey(params.get("time") ?? ""); setClock(Date.now()); setSource(nextLayer !== "rain" && params.get("source") === "tmd" ? "tmd" : "open-meteo");
      setMode("estimate");
      setMetric(nextLayer === "rain" || params.get("metric") === "secondary" && nextLayer !== "air" ? "secondary" : "primary");
      const lat = Number(params.get("lat")), lng = Number(params.get("lng"));
      setSelected(params.has("lat") && params.has("lng") && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null);
      setPlaying(false); setLegend(null); setCompareKey(null);
    };
    window.addEventListener("popstate", pop); return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (view === "map") return;
    panel.current?.focus({ preventScroll: true });
    if (view === "search") panel.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [view]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (exploring) setExploring(false); else setView("map");
      requestAnimationFrame(() => returnFocus.current?.focus({ preventScroll: true }));
    };
    window.addEventListener("keydown", escape); return () => window.removeEventListener("keydown", escape);
  }, [exploring]);
  function openView(next: View) { returnFocus.current = document.activeElement as HTMLElement; setView(next); setPlaying(false); }
  function changeTime(i: number) { if (data?.steps[i]) setTimeKey(data.steps[i].key); setPlaying(false); }
  function changeLayer(next: EnvironmentLayer) {
    if (next === layer) return;
    setLayer(next); setMode("estimate"); setMetric(next === "rain" ? "secondary" : "primary"); if (next === "rain") setSource("open-meteo"); setLegend(null); setCompareKey(null); setPlaying(false);
    const key = timeKey && step?.date ? `${step.date}${next === "air" ? "" : step.cadence === "hour" ? `:h${String(step.startHour).padStart(2, "0")}` : ":day"}` : "";
    setTimeKey(key); setClock(Date.now());
    const params = new URLSearchParams({ province, source }); if (key) params.set("time", key);
    if (selected) { params.set("lat", String(selected.lat)); params.set("lng", String(selected.lng)); }
    history.pushState(null, "", `/${next}?${params}`);
  }
  function selectFromList(p: MapPoint) { setSelected({ lat: p.lat, lng: p.lng, label: p.label }); setFocus((n) => n + 1); setView("map"); setQuery(""); requestAnimationFrame(() => { const section = document.getElementById("map-story"); section?.scrollIntoView({ behavior: "instant", block: "start" }); section?.focus({ preventScroll: true }); }); }
  function selectWatch(watch: AreaWatch) { changeLayer(watch.layer); setMode("estimate"); setMetric(watch.layer === "rain" ? "secondary" : "primary"); setTimeKey(watch.step.key); selectFromList(watch.point); }
  const results = points.filter((p) => `${p.label} ${p.area ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const unavailable = !loading && (!data || data.status === "unavailable" || !anchors.length);
  return <MapShell layer={layer} exploring={exploring} mapFirst>
    <div className="mi-workspace">
      <header className="mf-header">
        <a href="/" className="mf-brand" aria-label="BKK Air Forecast หน้าหลัก"><MapIcon name="map" size={23} /><span>BKK <b>AIR</b></span></a>
        <a className="bf-home-nav" href="/">ภาพรวม</a>
        <LayerSwitcher layer={layer} onChange={changeLayer} />
        <div className="mf-header-actions"><a className="mf-overview-link" href="/"><MapIcon name="arrow" size={16} />ภาพรวม</a><a className="mf-surveillance-link" href="/surveillance">เฝ้าระวัง</a><ThemeToggle /></div>
      </header>
      {!exploring && <TopicBriefing layer={layer} data={data} values={values} companionValues={companionValues} index={index} metric={metric} scope={scope} loading={loading} error={error} following={!timeKey} onNow={() => { setTimeKey(""); setClock(Date.now()); setPlaying(false); }} currentObservation={layer === "air" ? <CurrentAir region={province} place={selected} refresh={refresh}/> : undefined} onTime={changeTime} onMetric={(next) => { setMetric(next); setLegend(null); setCompareKey(null); setPlaying(false); }} />}
      <div className="mf-context">
        <label className="mf-province"><MapIcon name="pin" size={17} /><select aria-label="กรองจังหวัด" value={province} onChange={(e) => { setProvince(e.target.value as RegionId); setSelected(null); setCompareKey(null); setPlaying(false); }}><option value="metro">กรุงเทพฯ–ปริมณฑล</option>{provinces.map((p) => <option key={p.id} value={p.id}>{p.nameTh}</option>)}</select></label>
        <div className="mf-context-actions"><button aria-label="ค้นหาสถานที่หรือพื้นที่" aria-pressed={view === "search"} onClick={() => openView(view === "search" ? "map" : "search")}><MapIcon name="search" /></button><button aria-label="ตัวเลือกแผนที่" aria-pressed={view === "settings"} onClick={() => openView(view === "settings" ? "map" : "settings")}><MapIcon name="layers" /></button></div>
      </div>
      {view !== "search" && view !== "settings" && <MapTimeControl data={data} index={index} onChange={changeTime} playing={playing} onPlay={() => setPlaying((v) => !v)} reducedMotion={reducedMotion} mode={mode} />}
      <div className={`mi-work-area mf-area ${view !== "map" ? "mf-panel-open" : ""}`}>
        <section id="map-story" className="mi-geography" aria-label="พื้นที่สำรวจแผนที่" tabIndex={-1}>
          <div className="mi-map-stage">
            <EnvironmentMap layer={layer} mode={mode} points={anchors} displayPoints={points} display="dots" index={index} metric={metric} province={province} selected={selected} onSelect={setSelected} legend={legend} degraded={!!data && data.status !== "live"} satellite={satellite} showValues={false} showPlaceNames={showPlaceNames} exploring={exploring} interactive onToggleExplore={() => { returnFocus.current = document.activeElement as HTMLElement; setView("map"); setExploring((v) => !v); }} focus={focus} onBoundary={setBoundary} motionDisabled={reducedMotion} />
          </div>
          <div className="mf-reading" role="status">
            <button className="mf-reading-main" onClick={() => openView("location")} aria-label="ดูรายละเอียดตำแหน่งที่เลือก"><span>{scope}</span><b>{formatValue(currentValue)} <small>{metric === "primary" ? layerInfo[layer].unit : layerInfo[layer].secondaryUnit}</small></b><span className="mf-reading-risk">{interpretation(layer, metric, currentValue)}</span><MapIcon name="arrow" size={15} /></button>
            {selected && <button className="mf-clear" aria-label="ล้างตำแหน่งที่เลือก" onClick={() => setSelected(null)}><MapIcon name="close" size={17} /></button>}
          </div>
          <p className="mf-place-address">{selected && !spatialSelection && point?.place ? placeAddress(point.place) : province !== "metro" && province !== "bangkok" ? "จุดตามถนนและตำบล · แตะจุดเพื่อดูชื่อพื้นที่" : "จุดตามถนนและแขวง/ตำบล · ซูมเพื่อดูจุดเพิ่ม"}</p>
          <MapLegend layer={layer} metric={metric} active={legend} onChange={setLegend} />
        </section>
        {view !== "map" && <div ref={panel} tabIndex={-1} className="mf-panel" aria-label="ข้อมูลประกอบแผนที่">
          <div className="mf-panel-bar"><span>{({ watch: "เฝ้าระวังรายพื้นที่", forecast: "แนวโน้มพยากรณ์", location: "รายละเอียดตำแหน่ง", settings: "ตั้งค่าแผนที่", search: "ค้นหาสถานที่" } as const)[view]}</span><button aria-label="กลับไปแผนที่" onClick={() => { setView("map"); requestAnimationFrame(() => returnFocus.current?.focus({ preventScroll: true })); }}><MapIcon name="close" size={19} /></button></div>
          {view === "watch" && <AreaWatchList province={province} source={source} step={step} refresh={refresh} boundary={boundary?.region === province ? boundary.data : null} places={geography.places} onSelect={selectWatch} />}
          {(view === "forecast" || view === "location") && <><DashboardChart scope={scope} data={data} index={index} onChange={changeTime} mode={mode} values={values} metric={metric} />{view === "location" && <div id="location-story" className="mf-location"><LocationInsight layer={layer} values={values} spatialSelection={spatialSelection} data={data ? { ...data, points } : null} point={point} selected={selected} index={index} metric={metric} mode={mode} onTime={changeTime} onSelect={selectFromList} compare={compare < 0 ? null : compare} onClear={() => setSelected(null)} /></div>}<button className="mf-compare" aria-pressed={compareKey !== null} disabled={!data?.steps.length || mode === "observation"} onClick={() => setCompareKey(compareKey ? null : step?.key ?? null)}><MapIcon name="compare" size={17} />{compareKey ? "เลิกเปรียบเทียบ" : "เปรียบเทียบเวลา"}</button></>}
          {view === "search" && <div className="mf-search"><label htmlFor="place-search">ถนน แขวง/ตำบล เขต/อำเภอ</label><div><MapIcon name="search" size={19} /><input id="place-search" aria-label="ค้นหาถนนหรือพื้นที่" placeholder="เช่น สุขุมวิท คลองตัน บางพลี" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && results[0]) selectFromList(results[0]); if (e.key === "ArrowDown") { e.preventDefault(); panel.current?.querySelector<HTMLButtonElement>(".mf-search-results button")?.focus(); } }} /></div><p>ค้นหาชื่อถนนหรือพื้นที่ แล้วเลือกเพื่อซูมไปยังจุดนั้น</p><ul className="mf-search-results">{results.map((p) => <li key={p.id}><button onClick={() => selectFromList(p)} onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>(".mf-search-results button") ?? []); const i = buttons.indexOf(e.currentTarget); buttons[(i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus(); } }}><MapIcon name="pin" size={18} /><span>{p.label}<small>{p.area}</small></span><b>{formatValue(pointValue(p, index, metric))}</b><MapIcon name="arrow" size={16} /></button></li>)}</ul>{!results.length && <p className="mf-empty">{loading ? "กำลังโหลดจุดข้อมูล…" : "ไม่พบพื้นที่ ลองเปลี่ยนคำค้นหรือจังหวัด"}</p>}</div>}
          {view === "settings" && <div className="mf-settings">
            <h2>ข้อมูลบนแผนที่</h2>
            <label>แหล่งข้อมูล<select aria-label="กรองแหล่งข้อมูล" value={layer === "air" ? "air" : source} disabled={layer !== "heat"} onChange={(e) => { setSource(e.target.value as WeatherSource); setPlaying(false); setCompareKey(null); }}>
              {layer === "air" ? <option value="air">CAMS + AirBKK / Air4Thai</option> : <><option value="open-meteo">Open-Meteo</option>{layer === "heat" && <option value="tmd">TMD + Open-Meteo</option>}</>}
            </select></label>
            <p>{layer === "rain" ? "จุดสีแสดงปริมาณฝนสะสม (มม.) จากต้นทางตามพิกัดสถานที่โดยตรง โอกาสฝน (%) อยู่ในรายละเอียด ไม่มีการเติมค่าจุดที่ขาดข้อมูล" : "แผนที่แสดงเฉพาะจุดสีจากค่าประมาณ IDW อ่านคำอธิบายรายสถานที่ได้ด้านล่าง"}</p>
            {layer === "heat" && <label>ข้อมูลความร้อน<select aria-label="ตัวชี้วัดบนแผนที่" value={metric} onChange={(e) => { setMetric(e.target.value as Metric); setLegend(null); setCompareKey(null); setPlaying(false); }}><option value="primary">ดัชนีความร้อน (°C)</option><option value="secondary">อุณหภูมิ (°C)</option></select></label>}
            <h2>การแสดงผล</h2>
            {([{ text: "ชื่อจังหวัดและเขต", checked: showPlaceNames, change: setShowPlaceNames }, { text: "ภาพถ่ายดาวเทียม", checked: satellite, change: setSatellite }] as const).map((option) => <label className="mf-check" key={option.text}><span>{option.text}</span><input type="checkbox" checked={option.checked} onChange={(e) => option.change(e.target.checked)} /></label>)}
            <div className="mf-source"><h2>ที่มาข้อมูล</h2><b>{loading ? "กำลังเชื่อมต่อ…" : data?.model ?? "ยังไม่มีข้อมูล"}</b><p>{layer === "rain" ? "พยากรณ์จากต้นทาง" : modeLabels[mode]} · {metricName(layer, metric)}{step?.date ? ` · ${relativeDay(step.date)} ${step.label}` : ""}</p>{data?.notes.map((note) => <p key={note}>{note}</p>)}</div>
            <button className="mf-refresh" disabled={loading} onClick={() => setRefresh((n) => n + 1)}><MapIcon name="refresh" size={18} />โหลดข้อมูลล่าสุด</button><a className="mf-advanced" href={`/${layer}/advanced?province=${province}`}>เครื่องมือขั้นสูง{layer === "rain" ? " / เรดาร์ TMD" : ""}<MapIcon name="arrow" size={16} /></a>
          </div>}
        </div>}
      </div>

      {(loading || geography.loading || unavailable || geography.error) && <div className="mf-data-message">{loading || geography.loading ? <MapLoadingState /> : <MapErrorState message={error || geography.error || "ไม่มีข้อมูลที่ใช้ได้ในพื้นที่นี้"} retry={() => setRefresh((n) => n + 1)} />}</div>}
      <div className="mf-status"><DataStatus data={data} mode={layer === "rain" ? "forecast" : mode} loading={loading} step={step} /><span>{layer === "rain" ? metric === "secondary" ? "สีแสดงปริมาณฝนตามช่วงที่เลือก · พยากรณ์ตามพิกัด" : "สีแสดงโอกาสฝน · พยากรณ์ตามพิกัด" : layer === "heat" && metric === "secondary" ? "สีแสดงอุณหภูมิอากาศ · แยกจากเกณฑ์ดัชนีความร้อน" : mode === "estimate" ? "สีแผนที่เป็นค่าประมาณ" : "ค่าจากจุดข้อมูล"}</span></div>
      <nav className="mf-nav" aria-label="การนำทางแผนที่">
        <button aria-pressed={view === "map"} onClick={() => { openView("map"); requestAnimationFrame(() => { const section = document.getElementById("place-outlook"); section?.scrollIntoView({ behavior: "instant", block: "start" }); section?.focus({ preventScroll: true }); }); }}><MapIcon name="map" size={19} /><span>รายสถานที่</span></button>
        <button aria-pressed={view === "watch"} onClick={() => openView("watch")}><MapIcon name="warning" size={19} /><span>เฝ้าระวัง{watchCount > 0 && <b className="mf-count" aria-label={`${watchCount} จุดในชั้นข้อมูลนี้`}>{watchCount}</b>}</span></button>
        <button aria-pressed={view === "forecast"} onClick={() => openView("forecast")}><MapIcon name="chart" size={19} /><span>แนวโน้ม</span></button>
        <button aria-pressed={view === "location"} onClick={() => openView("location")}><MapIcon name="pin" size={19} /><span>รายละเอียด</span></button>
      </nav>
      {layer === "rain" && !exploring && <div className="bf-water-section ov-page"><RoadFloodOverview region={province} place={selected} refresh={refresh}/><WaterOverview region={province} place={selected} refresh={refresh} /></div>}
      {view === "map" && <PlaceOutlookList layer={layer} data={data} points={points} index={index} metric={metric} step={step} loading={loading || geography.loading} onSelect={selectFromList} />}
    </div>
  </MapShell>;
}
