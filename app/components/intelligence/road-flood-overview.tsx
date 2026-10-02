"use client";
import { useState, type CSSProperties } from "react";
import { currentRoadFloods, ROAD_FLOOD_SOURCE, type RoadFloodPayload } from "../../lib/road-floods";
import { thaiObservationTime } from "../../lib/observation-time";
import { formatValue } from "../../lib/map-intelligence";
import type { RegionId } from "../../lib/provinces";
import { MapIcon } from "./map-ui";
import { useLiveResource, type LiveResource } from "./use-live-resource";
import "./observations.css";

export default function RoadFloodOverview({ region, place, refresh, compact = false, sharedResource }: { region: RegionId; place: {lat: number; lng: number} | null; refresh: number; compact?: boolean; sharedResource?: LiveResource<RoadFloodPayload> }) {
  const localResource = useLiveResource<RoadFloodPayload>(sharedResource ? null : "/api/road-floods", refresh);
  const resource = sharedResource ?? localResource;
  const [attention, setAttention] = useState(true);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const inCoverage = region === "metro" || region === "bangkok";
  const stations = inCoverage ? currentRoadFloods(resource.data?.stations ?? [], resource.clock) : [];
  const fresh = stations.filter(s => s.status === "fresh");
  const flood = fresh.filter(s => s.level === "flood").length;
  const minor = fresh.filter(s => s.level === "minor").length;
  const limit = compact ? 3 : 12;
  const distribution = [
    { label: "น้ำท่วม", count: flood, color: "#ac293f" },
    { label: "ท่วมเล็กน้อย", count: minor, color: "#976008" },
    { label: "ต้นทางรายงานปกติ", count: fresh.length - flood - minor, color: "#007d58" },
    { label: "ข้อมูลเก่าหรือใช้ไม่ได้", count: stations.length - fresh.length, color: "#708495" },
  ];
  const shown = stations.filter(s => (kind === "all" || s.kind === kind) && (!attention || s.level === "flood" || s.level === "minor") && `${s.name} ${s.road} ${s.district}`.includes(query.trim())).sort((a,b) => {
    const rank = { flood: 0, minor: 1, normal: 2, unknown: 3 };
    const distance = (s: typeof a) => place ? Math.hypot((s.lat-place.lat)*111,(s.lng-place.lng)*108) : 0;
    return rank[a.level] - rank[b.level] || distance(a) - distance(b) || a.name.localeCompare(b.name,"th");
  });
  return <section className="ov-section obs-roads" id="road-floods" aria-label="น้ำท่วมถนนจากจุดตรวจวัด กทม." aria-busy={resource.loading}>
    <div className="ov-section-heading"><div><h2>น้ำบนถนนตอนนี้</h2><p>จุดตรวจวัดถนนและอุโมงค์ของ กทม. · ครอบคลุมกรุงเทพฯ</p></div><span className="obs-observed-tag">ตรวจวัดล่าสุด</span></div>
    {!inCoverage ? <p className="obs-empty">ชุดข้อมูลนี้ครอบคลุมกรุงเทพฯ ยังไม่มีจุดตรวจวัดถนนสำหรับจังหวัดที่เลือก</p> : <>
      <div className="obs-road-summary"><div className="obs-depth-flood"><span>ต้นทางรายงานน้ำท่วม</span><b>{resource.loading ? "…" : fresh.length ? flood : "—"}<small>จุด</small></b></div><div className="obs-depth-minor"><span>น้ำท่วมเล็กน้อย</span><b>{resource.loading ? "…" : fresh.length ? minor : "—"}<small>จุด</small></b></div><div><span>จุดวัดที่มีข้อมูลล่าสุด</span><b>{resource.loading ? "…" : fresh.length}<small>/{stations.length}</small></b></div></div>
      {!!stations.length && <div className="fc-road-chart"><div role="img" aria-label={distribution.map(segment => `${segment.label} ${segment.count} จุด`).join(" · ")}>{distribution.map(segment => <i key={segment.label} style={{ flex: segment.count, "--segment-color": segment.color } as CSSProperties} />)}</div><p>{distribution.map(segment => <span key={segment.label} style={{ "--segment-color": segment.color } as CSSProperties}><i />{segment.label} {segment.count}</span>)}</p></div>}
      <div className="obs-road-toolbar"><div className="ov-water-tabs" aria-label="ประเภทจุดตรวจวัดถนน">{[{id:"all",label:"ทั้งหมด"},{id:"road",label:"ถนน"},{id:"tunnel",label:"อุโมงค์"}].map(item => <button key={item.id} aria-pressed={kind === item.id} onClick={()=>setKind(item.id)}>{item.label}</button>)}</div><label><input type="checkbox" checked={attention} onChange={event=>setAttention(event.target.checked)}/>เฉพาะจุดที่มีรายงานน้ำท่วม</label><input type="search" aria-label="ค้นหาถนนหรือเขตในจุดตรวจวัดน้ำท่วม" placeholder="ค้นหาถนนหรือเขต" value={query} onChange={event=>setQuery(event.target.value)}/></div>
      <div className="obs-road-list">{shown.slice(0,expanded ? shown.length : limit).map(station=><a key={station.id} className={`obs-depth-${station.level}`} href={`https://www.openstreetmap.org/?mlat=${station.lat}&mlon=${station.lng}#map=16/${station.lat}/${station.lng}`} target="_blank" rel="noreferrer"><span className="obs-road-place"><span><MapIcon name="pin" size={17}/><b>{station.name}{station.direction && ` · ${station.direction}`}</b></span><small>{station.district ? `เขต${station.district}` : station.road} · {station.kind === "tunnel" ? "อุโมงค์" : "ถนน"}{place && ` · ห่างจุดที่เลือก ${formatValue(Math.hypot((station.lat-place.lat)*111,(station.lng-place.lng)*108))} กม.`}</small><small>ตรวจวัด {thaiObservationTime(station.observedAt)} น.</small></span><span className="obs-road-value"><b>{formatValue(station.value)}<small>ซม.</small></b><em>{station.status === "fresh" ? station.sourceStatus : station.status === "stale" ? "ข้อมูลเก่า" : "ข้อมูลใช้ไม่ได้"}</em></span><MapIcon name="arrow" size={16}/></a>)}</div>
      {!shown.length && <p className="obs-empty" role="status">{resource.loading ? "กำลังอ่านข้อมูลจากจุดตรวจวัด…" : !fresh.length ? "ยังไม่มีค่าตรวจวัดถนนล่าสุดที่ใช้ได้" : query ? "ไม่พบจุดตรวจวัดที่ตรงกับคำค้น" : attention ? "ไม่พบรายงานน้ำท่วมในจุดตรวจวัดที่มีข้อมูลของประเภทนี้" : "ไม่พบจุดตรวจวัดประเภทนี้"}</p>}
      {shown.length > limit && <button className="ov-location-button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded ? "ย่อรายการ" : `ดูทั้งหมด ${shown.length} จุด`}<MapIcon name="chevron" size={16}/></button>}
      <div className="obs-source-line"><span>{resource.refreshing ? "กำลังอัปเดต…" : resource.data ? `โหลด ${thaiObservationTime(resource.data.fetchedAt)} น. · อัปเดตอัตโนมัติ` : "รอข้อมูลต้นทาง"}</span><span>{stations.length-fresh.length} จุดข้อมูลเก่าหรือใช้ไม่ได้</span></div>{resource.error && <p className="obs-error" role="status">{resource.error}</p>}
    </>}
    <p className="obs-panel-note">รายงานเฉพาะ ณ จุดวัด สถานะจากต้นทางไม่ได้ยืนยันสภาพถนนตลอดสาย · ค่าขัดข้องไม่ถูกนับเป็นปกติ · กดจุดเพื่อเปิดตำแหน่ง</p><a className="ov-text-link" target="_blank" rel="noreferrer" href={ROAD_FLOOD_SOURCE}>ที่มา: สำนักการระบายน้ำ กรุงเทพมหานคร<MapIcon name="arrow" size={16}/></a>
  </section>;
}
