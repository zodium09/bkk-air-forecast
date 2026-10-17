"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "../theme-toggle";
import RiskAreaMap from "../intelligence/risk-area-map";
import WaterHistoryChart from "../intelligence/water-history-chart";
import { useLiveResource } from "../intelligence/use-live-resource";
import { buildHydroBasins, hydroStation, HYDRO_BASINS, type HydroBasin, type HydroPayload } from "../../lib/hydro/model";
import { formatWaterValue, waterRisk, type WaterStation } from "../../lib/water-levels";
import { thaiObservationTime } from "../../lib/observation-time";
import { parseComparisonIds } from "../../lib/hydro/comparison";
import type { RiskAreaPoint, RiskRank } from "../../lib/risk-area-data";
import HydroComparison from "./hydro-comparison";
import HydroWeatherContext from "./hydro-weather-context";
import HydroTideContext from "./hydro-tide-context";
import HydroFollowedStations from "./hydro-followed-stations";
import "./hydro.css";

type View = "summary" | "explore" | "basin" | "station" | "watchlist" | "sources";
type Saved = { version: 1; basins: string[]; stations: { id: string; basinId: string }[] };
type IngestionHealthPayload = { status: "available" | "stale" | "failed" | "unknown" | "unavailable"; storage: string; lastSuccessAt?: string | null; latestObservedAt?: string | null; observationLagMs?: number | null; runs: { status: "success" | "failed"; endedAt: string; accepted: number; rejected: number }[] };
const EMPTY_SAVED: Saved = { version: 1, basins: [], stations: [] };
const nf = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 });
const basinName = (id: string) => HYDRO_BASINS.find(basin => basin.id === id)?.name ?? "ลุ่มเจ้าพระยา";
const link = (path: string, basinId: string, stationId = "") => {
  const params = new URLSearchParams({ ...(basinId && basinId !== "all" ? { basin: basinId } : {}), ...(stationId ? { station: stationId } : {}) });
  return params.size ? `${path}?${params}` : path;
};
function readSaved(): Saved {
  try {
    const value = JSON.parse(localStorage.getItem("hydro-watchlist-v1") ?? "null");
    if (value?.version === 1 && Array.isArray(value.basins) && Array.isArray(value.stations)) {
      const basins = [...new Set(value.basins.filter((id: unknown) => typeof id === "string" && HYDRO_BASINS.some(basin => basin.id === id)))] as string[];
      const rawStations: unknown[] = value.stations;
      const stations = rawStations.filter((item): item is { id: string; basinId: string } => !!item && typeof item === "object" && "id" in item && "basinId" in item && typeof item.id === "string" && /^[a-zA-Z0-9_-]{1,96}$/.test(item.id) && typeof item.basinId === "string" && HYDRO_BASINS.some(basin => basin.id === item.basinId));
      return { version: 1, basins, stations: [...new Map(stations.map((item: { id: string; basinId: string }) => [`${item.basinId}:${item.id}`, item])).values()] };
    }
  } catch { /* Storage can be disabled. */ }
  return EMPTY_SAVED;
}
function time(value: string | null) { return value ? `${thaiObservationTime(value)} น.` : "ไม่ระบุเวลา"; }
function status(station: WaterStation) {
  if (station.status === "unavailable") return "ยังไม่มีค่าที่ใช้ได้";
  if (station.status === "stale") return "ข้อมูลล่าช้า";
  const risk = waterRisk(station);
  return risk.id === "overflow" ? "เกินเกณฑ์สถานี" : risk.id === "high" ? "น้ำมาก · ติดตาม" : risk.id === "unknown" || risk.id === "below-bank" ? "ยังจัดระดับไม่ได้" : risk.title;
}
function rank(station: WaterStation): RiskRank {
  if (station.status !== "fresh") return -1;
  const id = waterRisk(station).id;
  return id === "overflow" ? 3 : id === "high" || id === "critical-low" ? 2 : id === "low" ? 1 : id === "unknown" || id === "below-bank" ? -1 : 0;
}
function SourceStamp({ data, error }: { data: HydroPayload | null; error: string }) {
  const incomplete = data && Object.values(data.sources).some(state => state !== "live");
  return <div className="hy-source-stamp" role="status"><span className={`hy-dot ${error || !data || incomplete ? "is-muted" : ""}`}/><span>{error ? "อัปเดตล่าสุดไม่สำเร็จ · ตรวจเวลาค่าด้านล่าง" : data ? `${incomplete ? "บางแหล่งไม่พร้อม · ค่าที่เก็บไว้มีเวลาตรวจวัดเดิม" : "รับข้อมูล"} ${time(data.fetchedAt)} · แต่ละสถานีมีเวลาตรวจวัดต่างกัน` : "กำลังอ่านข้อมูลจากต้นทาง"}</span><a href="/sources">ตรวจแหล่งข้อมูล</a></div>;
}
function sourceLabel(data: HydroPayload, source: keyof HydroPayload["sources"]) {
  return data.sources[source] === "live" ? "ต้นทางตอบกลับ" : data.sources[source] === "last-known" ? `ใช้ข้อมูลที่เก็บไว้ ${time(data.lastKnownAt[source] ?? null)}` : "ต้นทางไม่พร้อมและไม่มีข้อมูลเก็บไว้";
}
function coverageCount(basin: HydroBasin, source: "rain" | "dams", data: HydroPayload | null) {
  if (basin.id === "chao-phraya" && source === "dams") return "ไม่ครอบคลุม";
  const count = basin[source].length;
  if (!data) return "กำลังโหลด";
  return count || (data.sources[source] === "unavailable" ? "ต้นทางไม่พร้อม" : "ยังไม่มีค่าล่าสุด");
}
function StationReading({ station }: { station: WaterStation }) {
  return <div className="hy-reading"><strong>{formatWaterValue(station.value)}</strong><span>{station.datum === "msl" ? "เมตร รทก." : "เมตรจากศูนย์เกจ"}</span></div>;
}
function StationDetail({ station, basin, saved, watchlistFull, onToggle, compared, compareFull, onCompare, refresh }: { station: WaterStation; basin: HydroBasin; saved: boolean; watchlistFull: boolean; onToggle: () => void; compared?: boolean; compareFull?: boolean; onCompare?: () => void; refresh: number }) {
  const risk = waterRisk(station);
  return <article className="hy-station-detail" id="station-detail" aria-labelledby="station-title">
    <div className="hy-detail-heading"><div><span className="hy-eyebrow">ลุ่มน้ำ{basin.name} · {station.id}</span><h2 id="station-title">{station.name}</h2><p>{station.waterway} · {station.district ? `${station.district} · ` : ""}{station.province}</p></div><div className="hy-detail-actions"><button type="button" className="hy-outline-button" aria-pressed={saved} disabled={watchlistFull && !saved} onClick={onToggle}>{saved ? "เลิกติดตาม" : watchlistFull ? "ติดตามครบ 20 สถานีแล้ว" : "ติดตามสถานี"}</button>{onCompare && <button type="button" className="hy-outline-button" aria-pressed={compared} disabled={compareFull && !compared} onClick={onCompare}>{compared ? "เอาออกจากการเทียบ" : compareFull ? "เลือกครบ 4 สถานีแล้ว" : "เพิ่มในการเทียบ"}</button>}</div></div>
    <div className="hy-reading-row"><StationReading station={station}/><div><b className={`hy-risk hy-risk-${rank(station)}`}>{status(station)}</b><p>ตรวจวัด {time(station.observedAt)} · {station.agency}</p></div></div>
    <p className="hy-evidence">{station.status === "fresh" ? risk.message : "ค่าล่าสุดไม่พร้อมสำหรับสรุปสถานการณ์ปัจจุบัน"} ระดับน้ำที่สถานีไม่ใช่ความลึกน้ำท่วมในชุมชน</p>
    <dl className="hy-definition"><div><dt>เกณฑ์ตลิ่ง</dt><dd>{station.bank === null || station.datum !== "msl" ? "ต้นทางไม่ระบุเกณฑ์ที่เทียบได้" : `${formatWaterValue(station.bank)} เมตร รทก.`}</dd></div><div><dt>ความจุลำน้ำ</dt><dd>{station.status !== "fresh" ? "ไม่ใช้จัดระดับจากข้อมูลล่าช้า" : station.capacityPercent === null ? "ไม่มีค่าที่ใช้ได้" : `${nf.format(station.capacityPercent)}% จากต้นทาง`}</dd></div><div><dt>สถานะข้อมูล</dt><dd>{station.status === "fresh" ? "ค่าภายใน 60 นาที" : station.status === "stale" ? "เก่ากว่า 60 นาที" : "ไม่มีค่าปัจจุบันที่ใช้ได้"}</dd></div></dl>
    <WaterHistoryChart station={station} version={station.observedAt ?? "none"} refresh={refresh} motion={false}/>
    <div className="hy-detail-links"><a href="https://www.thaiwater.net/water" target="_blank" rel="noreferrer">เปิดข้อมูลต้นทาง ↗</a><a href={link("/stations/" + encodeURIComponent(station.id), basin.id)}>ลิงก์สถานีนี้ →</a></div>
  </article>;
}

function BasinSignals({ basins }: { basins: HydroBasin[] }) {
  const rain = basins.flatMap(basin => basin.rain.map(point => ({ basin, point }))).sort((a, b) => b.point.mm - a.point.mm).slice(0, 8);
  const dams = basins.flatMap(basin => basin.dams.map(dam => ({ basin, dam }))).sort((a, b) => b.dam.date.localeCompare(a.dam.date)).slice(0, 8);
  return <section className="hy-section hy-signals" aria-labelledby="hy-signals-title"><div className="hy-section-head"><div><span className="hy-eyebrow">หลักฐานประกอบ</span><h2 id="hy-signals-title">ฝนตรวจวัดและอ่างเก็บน้ำ</h2></div><p>ฝนสะสมย้อนหลัง 24 ชั่วโมงที่สถานี · อ่างเป็นรายงานรายวัน</p></div><div className="hy-signals-grid"><div><h3>สถานีฝนที่รายงานล่าสุด</h3><p className="hy-signal-note">เรียงค่าสูงสุดจากสถานีที่มีข้อมูลภายใน 3 ชั่วโมง ไม่ใช่ฝนเฉลี่ยทั้งลุ่ม</p>{rain.length ? <ol className="hy-signal-list">{rain.map(({ basin, point }) => <li key={`${basin.id}:${point.id}`}><div><strong>{point.name}</strong><small>{basin.name} · ตรวจวัด {time(point.observedAt)}</small></div><b>{nf.format(point.mm)} <small>มม.</small></b></li>)}</ol> : <div className="hy-empty">ยังไม่มีค่าฝนตรวจวัดล่าสุดในพื้นที่นี้ ไม่ใช่ฝน 0 มม.</div>}<a className="hy-inline-link" href={basins.some(basin => basin.id === "chao-phraya") ? "#hy-weather-title" : "https://radargis.tmd.go.th/"}>{basins.some(basin => basin.id === "chao-phraya") ? "ดูเรดาร์และพยากรณ์ในหน้านี้ →" : "ตรวจเรดาร์กรมอุตุฯ ↗"}</a></div><div><h3>รายงานอ่างเก็บน้ำ</h3><p className="hy-signal-note">ปริมาตรเข้าและระบายเป็นล้านลูกบาศก์เมตรในวันที่รายงาน ไม่ใช่อัตราการไหลทันที</p>{dams.length ? <div className="hy-dam-list">{dams.map(({ basin, dam }) => <article key={`${basin.id}:${dam.id}`}><div><strong>{dam.name}</strong><small>{basin.name} · วันที่ {dam.date}</small></div><dl><div><dt>เก็บกัก</dt><dd>{dam.storagePercent === null ? "—" : `${nf.format(dam.storagePercent)}%`}</dd></div><div><dt>ไหลเข้า</dt><dd>{dam.inflowMillionM3 === null ? "—" : nf.format(dam.inflowMillionM3)}</dd></div><div><dt>ระบาย</dt><dd>{dam.releasedMillionM3 === null ? "—" : nf.format(dam.releasedMillionM3)}</dd></div></dl><small>ไหลเข้า/ระบาย: ล้าน ลบ.ม. ในวันรายงาน</small></article>)}</div> : <div className="hy-empty">ยังไม่มีรายงานอ่างรายวันที่ใช้ได้ในพื้นที่นี้</div>}{basins.some(basin => basin.id === "chao-phraya") && <p className="hy-downstream-note">บริบทปลายน้ำ: <a href="/water#tide-analysis">ดูน้ำขึ้นน้ำลงทำนายแยกจากระดับน้ำตรวจวัด →</a></p>}</div></div><p className="hy-signal-source">ที่มา: <a href="https://www.thaiwater.net/water" target="_blank" rel="noreferrer">ThaiWater ↗</a> · ตำแหน่งที่ไม่มี feed จะแสดงเป็นข้อมูลขาด ไม่เติมค่าจากพยากรณ์</p></section>;
}

function IngestionHealth({ refresh }: { refresh: number }) {
  const resource = useLiveResource<IngestionHealthPayload>("/api/ingestion-health", refresh);
  const data = resource.data;
  const latest = data?.runs[0];
  const label = !data ? "ยังตรวจการเก็บไม่ได้" : ({ available: "เก็บข้อมูลตามรอบ", stale: "ไม่มีรอบเก็บใหม่ตามกำหนด", failed: "รอบเก็บล่าสุดล้มเหลว", unknown: "ยังไม่มีบันทึกรอบเก็บ", unavailable: "อ่านบันทึกรอบเก็บไม่ได้" } as const)[data.status];
  return <article className="hy-ingestion-health"><div><span className="hy-eyebrow">การเก็บประวัติ · ไม่ใช่สถานะภัย</span><h2>ระบบเก็บระดับน้ำ</h2><p>ตรวจจากบันทึกรอบเก็บข้อมูล แยกจากเวลาค่าตรวจวัดของแต่ละสถานี</p></div><div><strong>{label}</strong>{latest && <p>รอบล่าสุด {time(latest.endedAt)} · {latest.status === "success" ? "สำเร็จ" : "ล้มเหลว"} · ผ่านเงื่อนไข {latest.accepted} / ไม่ผ่าน {latest.rejected} สถานี</p>}{data?.latestObservedAt && <p>ค่าตรวจวัดล่าสุดในรอบที่สำเร็จ {time(data.latestObservedAt)}</p>}{data?.lastSuccessAt && latest?.status === "failed" && <p>สำเร็จครั้งก่อน {time(data.lastSuccessAt)}</p>}{resource.error && <p>{resource.error}</p>}<small>สถานะนี้บอกการทำงานของตัวเก็บข้อมูล ไม่ยืนยันว่าทุกสถานีมีค่าล่าสุด</small></div></article>;
}

export default function HydroApp({ view = "summary", initialBasin = "all", initialStation = "" }: { view?: View; initialBasin?: string; initialStation?: string }) {
  const [basinId, setBasinId] = useState(HYDRO_BASINS.some(b => b.id === initialBasin) ? initialBasin : "all");
  const [stationId, setStationId] = useState(initialStation);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [saved, setSaved] = useState<Saved>(EMPTY_SAVED);
  const [ready, setReady] = useState(false);
  const resource = useLiveResource<HydroPayload>("/api/hydro", refresh);
  const basins = useMemo(() => resource.data ? buildHydroBasins(resource.data, resource.clock) : [], [resource.data, resource.clock]);
  const selectedBasins = basinId === "all" ? basins : basins.filter(basin => basin.id === basinId);
  const allStations = selectedBasins.flatMap(basin => basin.water.map(station => ({ basin, station })));
  const matches = allStations.filter(({ station }) => `${station.name} ${station.id} ${station.waterway} ${station.province}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a, b) => rank(b.station) - rank(a.station) || a.station.name.localeCompare(b.station.name, "th"));
  const selected = hydroStation(selectedBasins, stationId, basinId === "all" ? undefined : basinId);
  const comparedStations = useMemo(() => compareIds.map(id => {
    const item = hydroStation(basins, id);
    return { id, basinName: item?.basin.name ?? "ไม่ทราบลุ่มน้ำ", station: item?.station ?? null };
  }), [basins, compareIds]);
  const selectedKey = selected ? `${selected.basin.id}:${selected.station.id}` : "";
  const fresh = selectedBasins.reduce((sum, basin) => sum + basin.freshWater, 0);
  const total = selectedBasins.reduce((sum, basin) => sum + basin.water.length, 0);
  const high = selectedBasins.reduce((sum, basin) => sum + basin.highWater, 0);
  const exceeded = selectedBasins.reduce((sum, basin) => sum + basin.exceededWater, 0);
  const points: RiskAreaPoint[] = matches.map(({ basin, station }) => ({ id: `${basin.id}:${station.id}`, topic: "water", name: station.name, area: `${basin.name} · ${station.province}`, lat: station.lat, lng: station.lng, rank: rank(station), status: status(station), value: station.value, unit: station.datum === "msl" ? "ม. รทก." : "ม. จากศูนย์เกจ", detail: waterRisk(station).message, kind: "ตรวจวัด", source: station.agency, observedAt: station.observedAt, href: link(`/stations/${encodeURIComponent(station.id)}`, basin.id) }));
  useEffect(() => {
    const sync = () => { const params = new URLSearchParams(location.search); const requested = params.get("basin") ?? initialBasin; setBasinId(HYDRO_BASINS.some(b => b.id === requested) ? requested : "all"); setStationId(params.get("station") ?? initialStation); setCompareIds(parseComparisonIds(params.get("compare"))); };
    const timer = window.setTimeout(() => { setSaved(readSaved()); setReady(true); sync(); }, 0);
    window.addEventListener("popstate", sync); return () => { window.clearTimeout(timer); window.removeEventListener("popstate", sync); };
  }, [initialBasin, initialStation]);
  useEffect(() => {
    if (view !== "station" || !resource.data || !selectedKey) return;
    const timer = window.setTimeout(() => document.getElementById("station-detail")?.scrollIntoView({ block: "start" }), 0);
    return () => window.clearTimeout(timer);
  }, [view, resource.data, selectedKey]);
  function updateContext(nextBasin: string, nextStation = "") {
    if (view === "basin" && nextStation) { location.assign(link(`/stations/${encodeURIComponent(nextStation)}`, nextBasin)); return; }
    if (view === "basin") { location.assign(nextBasin === "all" ? "/" : `/basins/${encodeURIComponent(nextBasin)}`); return; }
    if (view === "station" && nextStation) { location.assign(link(`/stations/${encodeURIComponent(nextStation)}`, nextBasin)); return; }
    if (view === "station") { location.assign(link("/explore", nextBasin)); return; }
    setBasinId(nextBasin); setStationId(nextStation);
    const next = new URL(link(location.pathname, nextBasin, nextStation), location.origin);
    if (view === "explore" && compareIds.length) next.searchParams.set("compare", compareIds.join(","));
    history.pushState(null, "", next.pathname + next.search);
    if (nextStation && window.matchMedia("(max-width: 900px)").matches) window.setTimeout(() => document.getElementById("station-detail")?.scrollIntoView({ block: "start" }), 0);
  }
  function save(next: Saved) { setSaved(next); try { localStorage.setItem("hydro-watchlist-v1", JSON.stringify(next)); } catch { /* In-memory selection still works. */ } }
  function toggleStation(station: WaterStation, basin: HydroBasin) {
    const exists = saved.stations.some(row => row.id === station.id && row.basinId === basin.id);
    if (!exists && saved.stations.length >= 20) return;
    save({ ...saved, stations: exists ? saved.stations.filter(row => row.id !== station.id || row.basinId !== basin.id) : [...saved.stations, { id: station.id, basinId: basin.id }] });
  }
  function toggleBasin(id: string) { save({ ...saved, basins: saved.basins.includes(id) ? saved.basins.filter(item => item !== id) : [...saved.basins, id] }); }
  function toggleCompare(id: string) {
    const nextIds = compareIds.includes(id) ? compareIds.filter(item => item !== id) : compareIds.length < 4 ? [...compareIds, id] : compareIds;
    setCompareIds(nextIds);
    const next = new URL(location.href);
    if (nextIds.length) next.searchParams.set("compare", nextIds.join(",")); else next.searchParams.delete("compare");
    history.pushState(null, "", next.pathname + next.search);
  }
  const exploreHref = (nextBasin = basinId, nextStation = stationId) => {
    const next = new URL(link("/explore", nextBasin, nextStation), "http://local.invalid");
    if (compareIds.length) next.searchParams.set("compare", compareIds.join(","));
    return next.pathname + next.search;
  };
  const selectedPoint = selectedKey || undefined;
  return <main className="hy-app">
    <a className="hy-skip" href="#hy-main">ข้ามไปเนื้อหา</a>
    <header className="hy-header"><a className="hy-brand" href="/"><span className="hy-mark" aria-hidden="true">≋</span><span>เจ้าพระยา<small>ฝนและน้ำ</small></span></a><nav aria-label="เมนูหลัก"><a href="/" aria-current={view === "summary" ? "page" : undefined}>สถานการณ์</a><a href={exploreHref()} aria-current={view === "explore" ? "page" : undefined}>แผนที่และกราฟ</a><a href="/watchlist" aria-current={view === "watchlist" ? "page" : undefined}>ที่ติดตาม</a><a href="/sources" aria-current={view === "sources" ? "page" : undefined}>แหล่งข้อมูล</a></nav><ThemeToggle/></header>
    <div className="hy-toolbar" id="hy-main"><div className="hy-mode" role="group" aria-label="รูปแบบการดูข้อมูล"><a aria-current={view === "summary" || view === "basin" ? "page" : undefined} href={link("/", basinId, stationId)}>สรุปทั่วไป</a><a aria-current={view === "explore" || view === "station" ? "page" : undefined} href={exploreHref()}>ติดตามเชิงลึก</a></div><label>พื้นที่<select value={basinId} onChange={event => updateContext(event.target.value)}><option value="all">ทั้งลุ่มเจ้าพระยา</option>{HYDRO_BASINS.map(basin => <option key={basin.id} value={basin.id}>{basin.name}</option>)}</select></label><button type="button" onClick={() => setRefresh(v => v + 1)} disabled={resource.loading || resource.refreshing}>อัปเดตข้อมูล</button></div>
    <SourceStamp data={resource.data} error={resource.error}/>
    {resource.loading && !resource.data ? <div className="hy-loading" role="status">กำลังอ่านค่าตรวจวัดฝน น้ำ และอ่าง…</div> : !resource.data ? <div className="hy-loading" role="status">ขณะนี้อ่านข้อมูลต้นทางไม่ได้ <button onClick={() => setRefresh(v => v + 1)}>ลองอีกครั้ง</button></div> : <>
      {view === "summary" && <><section className="hy-hero" aria-labelledby="hy-title"><div><span className="hy-eyebrow">สถานการณ์ฝนและน้ำ · {basinId === "all" ? "ทั้งลุ่มเจ้าพระยา" : `ลุ่มน้ำ${basinName(basinId)}`}</span><h1 id="hy-title">เห็นสถานการณ์<br/>รู้จุดที่ต้องติดตาม</h1><p>อ่านค่าตรวจวัดตามพื้นที่และเวลา แล้วเปิดหลักฐานถึงสถานีจริง ไม่มีการคำนวณเวลาน้ำเดินทางหรือพื้นที่ท่วมจากค่าระดับน้ำเพียงอย่างเดียว</p><a className="hy-primary" href={link("/explore", basinId, stationId)}>เปิดแผนที่และกราฟ <span aria-hidden="true">↗</span></a></div><div className="hy-hero-facts"><div><small>สถานีน้ำล่าสุด</small><b>{fresh}<span> / {total}</span></b><p>มีค่าใน 60 นาที · เฉพาะสถานีที่ต้นทางส่งมา</p></div><div><small>เกินเกณฑ์สถานี</small><b>{exceeded}</b><p>จาก {selectedBasins.reduce((sum, basin) => sum + basin.assessedWater, 0)} สถานีล่าสุดที่ประเมินได้ · ไม่ใช่จำนวนพื้นที่ท่วม</p></div><div><small>น้ำมาก ยังไม่เกินเกณฑ์</small><b>{high}</b><p>แยกจากรายการเกินเกณฑ์ด้านบน</p></div></div></section>
      {ready && <section className="hy-section" aria-labelledby="hy-follow-summary"><div className="hy-section-head"><div><span className="hy-eyebrow">ค่าที่เปลี่ยนจริง</span><h2 id="hy-follow-summary">สถานีที่คุณติดตาม</h2></div><p>เรียงสถานีข้อมูลล่าช้าก่อน แล้วค่าที่เพิ่มมากที่สุด · เทียบเฉพาะค่าตรวจวัดจริงที่มีประวัติ</p></div><HydroFollowedStations items={saved.stations} basins={basins} refresh={refresh} compact/></section>}
      <section className="hy-section"><div className="hy-section-head"><div><span className="hy-eyebrow">01 / ภาพรวม</span><h2>แต่ละลุ่มน้ำมีข้อมูลอะไร</h2></div><p>จำนวนเป็นสถานีตรวจวัด ไม่ใช่การครอบคลุมทั้งลุ่มน้ำ</p></div><div className="hy-basin-grid">{selectedBasins.map(basin => <article className="hy-basin-card" key={basin.id}><div className="hy-basin-top"><span className="hy-basin-number">{basin.id === "chao-phraya" ? "00" : basin.id}</span><span>{basin.freshWater}/{basin.water.length} สถานีน้ำล่าสุด</span></div><h3><a href={`/basins/${encodeURIComponent(basin.id)}`}>{basin.name} <span aria-hidden="true">↗</span></a></h3><p>{basin.connection}</p><div className="hy-basin-metrics"><div><small>เกินเกณฑ์ / น้ำมาก</small><b>{basin.exceededWater} / {basin.highWater}</b></div><div><small>ฝนสะสม 24 ชม. สูงสุดในสถานีที่มีข้อมูล</small><b>{basin.peakRain ? `${nf.format(basin.peakRain.mm)} มม.` : "ยังไม่มีข้อมูล"}</b></div></div><small className="hy-card-note">{basin.peakRain ? `${basin.peakRain.name} · ${time(basin.peakRain.observedAt)}` : basin.rainSourceAvailable ? "ไม่มีค่าฝนภายใน 3 ชั่วโมง" : "ต้นทางฝนไม่พร้อมหรือยังไม่มีสถานีที่ใช้ได้"}</small></article>)}</div></section>
      {(basinId === "all" || basinId === "chao-phraya") && <HydroWeatherContext detailed={false} refresh={refresh}/>}
      {(basinId === "all" || basinId === "chao-phraya") && <HydroTideContext refresh={refresh}/>}
      <section className="hy-context-strip"><div><span className="hy-eyebrow">อ่านให้ตรงความหมาย</span><h2>ค่าระดับน้ำ ≠ ความลึกน้ำท่วม</h2><p>คำว่าเกินเกณฑ์อ้างอิงเกณฑ์ของสถานีต้นทางและต้องอ่านเวลา เรดาร์และพยากรณ์ด้านบนเป็นหลักฐานคนละชนิดกับฝนที่สถานีวัดได้</p></div><a href="/sources">อ่านข้อจำกัดข้อมูล →</a></section></>}
      {view === "basin" && <><section className="hy-page-title"><span className="hy-eyebrow">ลุ่มน้ำ / {basinId}</span><h1>{basinName(basinId)}</h1><p>{selectedBasins[0]?.connection} · ติดตามเฉพาะสถานีที่มีข้อมูลจากต้นทาง</p></section>{selectedBasins[0] && <div className="hy-basin-facts"><div><small>สถานีน้ำล่าสุด</small><b>{selectedBasins[0].freshWater}/{selectedBasins[0].water.length}</b></div><div><small>เกินเกณฑ์สถานี</small><b>{selectedBasins[0].exceededWater}</b></div><div><small>ฝน 24 ชม. สูงสุดที่สถานี</small><b>{selectedBasins[0].peakRain ? `${nf.format(selectedBasins[0].peakRain.mm)} มม.` : "ไม่มีข้อมูลล่าสุด"}</b></div><div><small>อ่างรายวัน</small><b>{selectedBasins[0].dams.length} แห่ง</b></div></div>}<button className="hy-outline-button" aria-pressed={saved.basins.includes(basinId)} onClick={() => toggleBasin(basinId)}>{saved.basins.includes(basinId) ? "เลิกติดตามลุ่มน้ำ" : "ติดตามลุ่มน้ำนี้"}</button><a className="hy-inline-link" href={link("/explore", basinId)}>เปิดแผนที่และสถานี →</a></>}
      {(view === "explore" || view === "basin" || view === "station") && <section className="hy-workspace" aria-label="สำรวจสถานี"><div className="hy-workspace-head"><div><span className="hy-eyebrow">{view === "explore" ? "02 / ติดตามเชิงลึก" : "สถานีตรวจวัด"}</span><h2>{view === "station" ? "รายละเอียดสถานี" : "สถานีและจุดตรวจวัด"}</h2></div><p>เลือกจุดบนแผนที่หรือในรายการเพื่ออ่านค่าเดียวกัน</p></div><div className="hy-workspace-grid"><div className="hy-list-panel"><label>ค้นชื่อ รหัส หรือทางน้ำ<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="เช่น ปากน้ำโพ หรือรหัสสถานี"/></label><div className="hy-list-count">{matches.length} สถานีที่ตรงเงื่อนไข · ล่าสุด {matches.filter(item => item.station.status === "fresh").length}</div><div className="hy-station-list">{matches.map(({ basin, station }) => <button key={`${basin.id}:${station.id}`} type="button" aria-pressed={selectedPoint === `${basin.id}:${station.id}`} onClick={() => updateContext(basin.id, station.id)}><span className={`hy-status-dot hy-rank-${rank(station)}`}/><span className="hy-station-label"><strong>{station.name}</strong><small>{basin.name} · {station.waterway} · {status(station)}</small></span><span className="hy-station-value">{formatWaterValue(station.value)}<small>{station.datum === "msl" ? "ม. รทก." : "ม. เกจ"}</small></span></button>)}{matches.length === 0 && <p className="hy-empty">ไม่พบสถานีตามคำค้นหรือพื้นที่ที่เลือก ลองเปลี่ยนลุ่มน้ำ</p>}</div></div><div className="hy-map-panel"><RiskAreaMap region="chao-phraya" points={points} selectedId={selectedPoint} focusId={selectedPoint} viewKey={`${basinId}:${query}`} detailId="station-detail" onSelect={point => { const [basin, id] = point.id.split(":"); updateContext(basin, id); }}/><p>จุดสีแสดงสถานะเฉพาะสถานี · สีไม่ได้ระบายขอบเขตน้ำท่วม · หากแผนที่โหลดไม่ได้ ใช้รายการด้านซ้ายได้</p></div>{selected ? <StationDetail station={selected.station} basin={selected.basin} saved={saved.stations.some(item => item.id === selected.station.id && item.basinId === selected.basin.id)} watchlistFull={saved.stations.length >= 20} onToggle={() => toggleStation(selected.station, selected.basin)} compared={compareIds.includes(selected.station.id)} compareFull={compareIds.length >= 4} onCompare={view === "explore" ? () => toggleCompare(selected.station.id) : undefined} refresh={refresh}/> : <div className="hy-selection-empty">{view === "station" && stationId ? "ไม่พบรหัสสถานีนี้ในข้อมูลล่าสุด เลือกสถานีอื่นจากรายการได้" : "เลือกสถานีจากรายการหรือแผนที่ เพื่ออ่านค่าและกราฟย้อนหลัง"}</div>}</div></section>}
      {view === "explore" && <HydroComparison stations={comparedStations} refresh={refresh} onRemove={toggleCompare}/>}
      {(view === "explore" || view === "basin") && <BasinSignals basins={selectedBasins}/>}
      {(view === "explore" || view === "basin") && (basinId === "all" || basinId === "chao-phraya") && <HydroWeatherContext detailed={view === "explore"} refresh={refresh}/>}
      {(view === "explore" || view === "basin") && (basinId === "all" || basinId === "chao-phraya") && <HydroTideContext refresh={refresh}/>}
      {(view === "explore" || view === "basin") && basinId !== "all" && basinId !== "chao-phraya" && <section className="hy-section hy-weather-gap"><h2>พยากรณ์ลุ่มต้นน้ำยังไม่พร้อม</h2><p>ส่วนพยากรณ์ในแอปยังครอบคลุมเฉพาะจังหวัดตอนกลาง–ล่าง จึงไม่ใช้ค่าจังหวัดอื่นแทนลุ่มน้ำ{basinName(basinId)} ข้อมูลฝนที่แสดงด้านบนเป็นค่าตรวจวัดตามสถานี</p><a href="https://radargis.tmd.go.th/" target="_blank" rel="noreferrer">ตรวจภาพเรดาร์ต้นทาง ↗</a></section>}
      {view === "watchlist" && <section className="hy-section"><div className="hy-page-title"><span className="hy-eyebrow">บันทึกในเครื่องนี้</span><h1>สถานีที่ติดตาม</h1><p>รายการเก็บในเบราว์เซอร์เครื่องนี้ ไม่ใช้บัญชีและไม่ซิงก์ข้ามอุปกรณ์</p></div>{saved.basins.length > 0 && <><h2>ลุ่มน้ำ</h2><div className="hy-watch-grid">{saved.basins.map(id => <a key={id} href={`/basins/${encodeURIComponent(id)}`}>{basinName(id)} ↗</a>)}</div></>}{saved.stations.length > 0 && <><h2>สถานี</h2><p className="hy-watch-explainer">ข้อมูลล่าช้าหรือหายจาก feed ขึ้นก่อน จากนั้นเรียงสถานีที่ระดับน้ำเพิ่มมากสุดเมื่อมีค่าก่อนหน้าที่เทียบได้</p><HydroFollowedStations items={saved.stations} basins={basins} refresh={refresh}/></>}{ready && !saved.basins.length && !saved.stations.length && <div className="hy-empty">ยังไม่มีรายการที่ติดตาม เปิดลุ่มน้ำหรือสถานีแล้วกด “ติดตาม”</div>}{(saved.basins.length > 0 || saved.stations.length > 0) && <button className="hy-outline-button" onClick={() => save(EMPTY_SAVED)}>ล้างรายการที่ติดตามในเครื่องนี้</button>}</section>}
      {view === "sources" && <section className="hy-section"><div className="hy-page-title"><span className="hy-eyebrow">ความโปร่งใสของข้อมูล</span><h1>แหล่งข้อมูลและข้อจำกัด</h1><p>ค่าที่แสดงเป็นข้อมูลสถานีและรายงานต้นทาง ไม่ใช่ประกาศเตือนภัยหรือแผนที่พื้นที่ท่วมที่ยืนยันแล้ว</p></div><div className="hy-source-grid"><article><h2>ระดับน้ำ</h2><p>ThaiWater / คลังข้อมูลน้ำแห่งชาติ · ค่ารายสถานี มีเวลาเก็บจริง เกณฑ์ความจุหรือตลิ่งเมื่อมีข้อมูล และ datum ที่ต้นทางระบุ</p><b>{sourceLabel(resource.data, "water")} · {fresh}/{total} สถานีภายใน 60 นาที</b><a href="https://www.thaiwater.net/water" target="_blank" rel="noreferrer">ตรวจต้นทาง ↗</a></article><article><h2>ฝนตรวจวัด</h2><p>ThaiWater / ฝนสะสม 24 ชั่วโมง ณ สถานีในลุ่มเจ้าพระยาและหกลุ่มต้นน้ำ ไม่ใช่ฝนเฉลี่ยทั้งลุ่ม ไม่รวมพยากรณ์</p><b>{sourceLabel(resource.data, "rain")}</b><a href="/rain">เรดาร์และพยากรณ์แยก →</a></article><article><h2>อ่างเก็บน้ำ</h2><p>ThaiWater / ข้อมูลรายวัน วันที่รายงานและหน่วยปริมาตรแสดงตามต้นทาง ข้อมูลรายวันไม่ใช่ live flow</p><b>{sourceLabel(resource.data, "dams")}</b><a href="https://www.thaiwater.net/water" target="_blank" rel="noreferrer">ตรวจต้นทาง ↗</a></article><article><h2>ประวัติระดับน้ำ</h2><p>ค่าที่ระบบสะสมจริงจากการเก็บตามรอบ สูงสุด 90 วัน ช่วงที่ไม่มีการเก็บจะไม่สร้างค่าขึ้นแทน</p><b>{resource.data.historyStorage === "unavailable" ? "คลังประวัติไม่พร้อม" : `คลังประวัติ: ${resource.data.historyStorage === "d1" ? "ถาวร" : "ในเครื่องเซิร์ฟเวอร์"}`}</b></article></div><IngestionHealth refresh={refresh}/><h2>ความครอบคลุมตามลุ่มน้ำ</h2><div className="hy-coverage-table"><table><thead><tr><th>ลุ่มน้ำ</th><th>สถานีน้ำล่าสุด/ทั้งหมด</th><th>ฝนสถานีล่าสุด</th><th>อ่างรายวัน</th></tr></thead><tbody>{basins.map(basin => <tr key={basin.id}><th scope="row">{basin.name}</th><td>{basin.freshWater}/{basin.water.length}</td><td>{coverageCount(basin, "rain", resource.data)}</td><td>{coverageCount(basin, "dams", resource.data)}</td></tr>)}</tbody></table></div><p className="hy-evidence">การไม่มีสถานีหรือค่าในตาราง ไม่ได้แปลว่าพื้นที่ปลอดภัยหรือไม่มีฝน/น้ำท่วม โปรดติดตามประกาศของหน่วยงานในพื้นที่เมื่อมีเหตุการณ์จริง</p></section>}
    </>}
    {view === "sources" && <section className="hy-section" aria-labelledby="hy-context-sources-title"><div className="hy-section-head"><div><span className="hy-eyebrow">ข้อมูลประกอบในหน้าใหม่</span><h2 id="hy-context-sources-title">ขอบเขตเรดาร์ พยากรณ์ และน้ำทำนาย</h2></div><p>ตรวจเวลาที่ใช้ได้บนหน้าสถานการณ์ทุกครั้ง</p></div><div className="hy-source-grid"><article><h2>ภาพเรดาร์</h2><p>กรมอุตุนิยมวิทยา TMD RadarGIS · ภาพตรวจจริงประมาณอัตราฝน มม./ชม. แสดงเมื่ออายุไม่เกิน 90 นาที ภาพคาดการณ์ระยะสั้นใช้เมื่อฐานภาพไม่เกิน 30 นาทีและเวลาภาพยังมาไม่ถึง</p><a href="https://radargis.tmd.go.th/" target="_blank" rel="noreferrer">ตรวจภาพต้นทาง ↗</a></article><article><h2>พยากรณ์ฝน</h2><p>แบบจำลองผ่าน API ของแอป · จังหวัดตอนกลาง–ล่างที่มีขอบเขตและจุดตัวอย่างเท่านั้น แสดงรายชั่วโมง ช่วง 3 ชั่วโมง และ 24 ชั่วโมง พร้อมเวลา “ดึงพยากรณ์” ซึ่งไม่ใช่เวลาออกพยากรณ์จากผู้ผลิต ลุ่มต้นน้ำยังไม่มีพยากรณ์รายลุ่มที่ตรวจรับได้</p><a href="/rain">ดูรายละเอียดพยากรณ์ →</a></article><article><h2>น้ำขึ้นน้ำลงทำนาย</h2><p>ตารางกรมอุทกศาสตร์ กองทัพเรือ · เฉพาะสถานีปลายน้ำที่เลือก เป็นระดับน้ำทำนายรายชั่วโมงเหนือระดับทะเลปานกลาง ไม่ใช้แทนระดับน้ำตรวจวัดหรือสรุปผลกระทบถึงสถานีต้นน้ำ</p><a href="https://hydro.navy.mi.th/waterlaveltable" target="_blank" rel="noreferrer">ตรวจตารางต้นทาง ↗</a></article></div></section>}
    <footer className="hy-footer"><div><strong>เจ้าพระยา · ฝนและน้ำ</strong><p>อ่านหลักฐานให้ตรงพื้นที่และเวลา</p></div><div><a href="/sources">ที่มาและข้อจำกัด</a><a href="/rain">เรดาร์/พยากรณ์ฝน</a><a href="/water">หน้าระดับน้ำเดิม</a><a href="/air">ฝุ่น</a><a href="/heat">ความร้อน</a></div></footer>
  </main>;
}
