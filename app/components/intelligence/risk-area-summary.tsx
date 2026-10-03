"use client";
import { useId, useMemo, useState } from "react";
import RiskAreaMap from "./risk-area-map";
import { groupRiskAreas, riskBands, type RiskAreaPoint, type RiskMapTopic } from "../../lib/risk-area-data";
import { formatWaterValue } from "../../lib/water-levels";
import { formatValue } from "../../lib/map-intelligence";
import { thaiObservationTime } from "../../lib/observation-time";
import { getRegion, type RegionId } from "../../lib/provinces";
import type { MapBoundary } from "../../lib/map-surface";
import { MapIcon } from "./map-ui";
import "./risk-area-summary.css";

const emptyPoints: RiskAreaPoint[] = [];

export default function RiskAreaSummary({ title="พื้นที่ที่ควรติดตามบนแผนที่", topics, region, boundary, activeTopic, onTopicChange, eventId, onClearEvent, onSelectPoint, revealKey, defaultMapOpen=false }: {
  title?: string; topics: RiskMapTopic[]; region: RegionId; boundary?: MapBoundary | null;
  activeTopic?: string; onTopicChange?: (topic:string)=>void; eventId?: string; onClearEvent?: ()=>void;
  onSelectPoint?: (point:RiskAreaPoint)=>void;
  revealKey?: string; defaultMapOpen?: boolean;
}) {
  const uid=useId().replace(/:/g,""), headingId=`risk-area-title-${uid}`, detailId=`risk-area-detail-${uid}`;
  const [topicKey,setTopicKey]=useState(""), [attentionOnly,setAttentionOnly]=useState(true), [rankFilter,setRankFilter]=useState<number|null>(null);
  const [selectedId,setSelectedId]=useState(""), [expanded,setExpanded]=useState(false);
  const [mapOpen,setMapOpen]=useState(defaultMapOpen), [dismissedKey,setDismissedKey]=useState("");
  const [expandedAreas,setExpandedAreas]=useState<string[]>([]);
  const mapVisible = mapOpen || !!revealKey && revealKey !== dismissedKey;
  const topic=topics.find(t => t.id === (activeTopic ?? topicKey)) ?? topics[0];
  const all=topic?.points ?? emptyPoints;
  const eventPoints=useMemo(()=>eventId ? all.filter(p => p.eventId === eventId) : all,[all,eventId]);
  const shown=useMemo(() => eventPoints.filter(p => (rankFilter === null ? !attentionOnly || p.rank > 0 : p.rank === rankFilter)).sort((a,b) => b.rank-a.rank || a.name.localeCompare(b.name,"th")),[eventPoints,rankFilter,attentionOnly]);
  const groups=useMemo(() => groupRiskAreas(shown),[shown]);
  const active=shown.find(p => p.id === selectedId) ?? shown[0];
  const selectedBand=riskBands.find(b => b.rank === active?.rank);
  const timeText=active?.observedAt ? Number.isFinite(Date.parse(active.observedAt)) ? `${thaiObservationTime(active.observedAt)} น.` : active.observedAt : "";
  const choose=(point:RiskAreaPoint) => { setSelectedId(point.id); setMapOpen(true); };
  function changeTopic(id:string) { setTopicKey(id); onTopicChange?.(id); setSelectedId(""); setRankFilter(null); setExpanded(false); }
  return <section className="ra-section" aria-labelledby={headingId}>
    <div className="ra-heading"><div><span className="ra-kicker"><MapIcon name="map" size={17}/>อ่านพื้นที่จากจุดข้อมูล</span><h3 id={headingId}>{title}</h3><p>{getRegion(region).shortNameTh} · เลือกเรื่อง สี หรือจุดเพื่ออ่านรายละเอียด</p></div><span className="ra-count"><strong>{topic?.loading?"…":eventPoints.length?eventPoints.filter(p => p.rank>0).length:"—"}</strong> จุดควรติดตาม<small>จาก {eventPoints.length} จุดที่มีตำแหน่ง</small></span></div>
    {topics.length>1 && <div className="ra-topics" role="group" aria-label="เลือกเรื่องบนแผนที่สรุป">{topics.map(t => <button key={t.id} aria-pressed={t.id===topic?.id} onClick={()=>changeTopic(t.id)}>{t.title}<span>{t.points.filter(p => p.rank>0).length}</span></button>)}</div>}
    <button className="ra-map-toggle" aria-expanded={mapVisible} aria-controls={`risk-map-${uid}`} onClick={()=>{if(mapVisible){setMapOpen(false);setDismissedKey(revealKey??"");}else setMapOpen(true);}}><MapIcon name="map" size={20}/>{mapVisible ? "ย่อแผนที่และตัวกรอง" : "สำรวจแผนที่และระดับติดตาม"}<span>{shown.length} จุด</span><MapIcon name="chevron" size={17}/></button>
    {mapVisible && <div id={`risk-map-${uid}`}>
    <div className="ra-controls"><label><input type="checkbox" checked={attentionOnly} onChange={e => {setAttentionOnly(e.target.checked);setRankFilter(null);setSelectedId("");}}/>เฉพาะจุดควรติดตาม</label><span>{shown.length} จุด · {groups.length} พื้นที่{topic?.loading && " · กำลังอัปเดต"}</span>{eventId && <button onClick={onClearEvent}>ดูทั้งเรื่อง<MapIcon name="close" size={14}/></button>}</div>
    <div className="ra-legend" role="group" aria-label="กรองระดับติดตามบนแผนที่">{riskBands.map(b => <button key={b.rank} aria-pressed={rankFilter===b.rank} onClick={()=>{setRankFilter(rankFilter===b.rank?null:b.rank);setSelectedId("");}}><i style={{background:b.color}}/>{b.label}<b>{eventPoints.filter(p => p.rank===b.rank).length}</b></button>)}</div>
    <div className="ra-layout"><RiskAreaMap region={region} points={shown} selectedId={active?.id} focusId={selectedId} viewKey={`${topic?.id}:${rankFilter}:${attentionOnly}:${eventId ?? "all"}`} boundary={boundary} detailId={detailId} onSelect={choose}/>
      <aside className="ra-detail" id={detailId} aria-label="รายละเอียดจุดที่เลือก" aria-live="polite" aria-atomic="true">{active ? <>
        <div className="ra-selected-status" style={{color:selectedBand?.color}}><i style={{background:selectedBand?.color}}/>{selectedBand?.label}<span>{active.kind}</span></div>
        <h4>{active.name}</h4><p className="ra-selected-area"><MapIcon name="pin" size={15}/>{active.area}</p>
        {active.value!==null && <div className="ra-reading"><b>{active.topic==="water"?formatWaterValue(active.value):formatValue(active.value)}</b><span>{active.unit}</span></div>}
        <strong className="ra-verdict">{active.status}</strong><p>{active.detail}</p>
        {active.period && <p className="ra-period">ช่วงข้อมูล {active.period}</p>}<p className="ra-time">{timeText ? `${active.timeLabel || (active.kind === "พยากรณ์" ? "โหลดพยากรณ์" : active.kind === "Nowcast" ? "ภาพเรดาร์ฐาน" : "ตรวจวัด")} ${timeText}` : "ต้นทางไม่ระบุเวลาที่ใช้ได้"}</p><small className="ra-source">{active.source}</small>
        {onSelectPoint ? <button className="ra-detail-link" onClick={()=>onSelectPoint(active)}>ดูพยากรณ์จุดนี้<MapIcon name="arrow" size={16}/></button> : <a className="ra-detail-link" href={active.href}>ดูข้อมูลเรื่องนี้<MapIcon name="arrow" size={16}/></a>}
      </> : <div className="ra-empty"><MapIcon name="map" size={28}/><h4>{topic?.loading ? "กำลังอ่านจุดข้อมูล…" : all.length ? "ยังไม่พบจุดตามตัวกรองนี้" : topic?.id === "rain" ? "เลือกพื้นที่เพื่อดูสัญญาณฝนใกล้คุณ" : "ยังไม่มีจุดข้อมูลที่ใช้สรุปได้"}</h4><p>{all.length ? "เปิดจุดทั้งหมดหรือเลือกสีอื่น เพื่อดูข้อมูลที่มีและจุดที่ยังประเมินไม่ได้" : "เมื่อข้อมูลพร้อม ตำแหน่งและเวลาของแต่ละจุดจะปรากฏบนแผนที่"}</p>{all.length>0 && <button className="ra-detail-link" onClick={()=>{setAttentionOnly(false);setRankFilter(null);}}>แสดงจุดทั้งหมด<MapIcon name="arrow" size={16}/></button>}</div>}</aside>
    </div></div>}
    <p className="ra-note">{topic?.note} · เส้นขอบแสดงพื้นที่อ้างอิง สีแสดงเฉพาะจุด ไม่ได้ระบายความเสี่ยงแทนทั้งจังหวัด</p>
    <div className="ra-area-heading"><h4>รายละเอียดรายพื้นที่</h4><span>{groups.length} พื้นที่ตามตัวกรอง</span></div>
    {!groups.length && <p className="ra-preview-empty">{topic?.loading?"กำลังอ่านข้อมูลพื้นที่…":all.some(p=>p.rank>=0)?"ยังไม่พบจุดเข้าเกณฑ์ตามตัวกรองนี้":"ข้อมูลในพื้นที่ยังประเมินไม่ได้"}{!!all.length && <button onClick={()=>{setAttentionOnly(false);setRankFilter(null);setMapOpen(true);}}>ดูจุดทั้งหมด<MapIcon name="arrow" size={15}/></button>}</p>}
    <div className="ra-area-list">{groups.slice(0,expanded?groups.length:3).map(group => <details key={group.name} className="ra-area"><summary><i style={{background:riskBands.find(b => b.rank===group.rank)?.color}}/><span>{group.name}</span><b>{group.points.length} จุด</b><MapIcon name="chevron" size={15}/></summary><ul>{group.points.slice(0,expandedAreas.includes(group.name)?group.points.length:3).map(point => <li key={point.id}><button aria-pressed={point.id===active?.id} onClick={()=>choose(point)}><i style={{background:riskBands.find(b => b.rank===point.rank)?.color}}/><span>{point.name}<small>{point.status}</small></span><b>{point.value===null ? point.rank<0 ? "ยังประเมินไม่ได้" : "ผลวิเคราะห์" : `${point.topic==="water"?formatWaterValue(point.value):formatValue(point.value)} ${point.unit}`}</b></button></li>)}</ul>{group.points.length>3 && <button className="ra-expand" aria-expanded={expandedAreas.includes(group.name)} onClick={()=>setExpandedAreas(rows=>rows.includes(group.name)?rows.filter(name=>name!==group.name):[...rows,group.name])}>{expandedAreas.includes(group.name)?"ย่อจุดในพื้นที่":`ดูอีก ${group.points.length-3} จุดในพื้นที่นี้`}</button>}</details>)}</div>
    {groups.length>3 && <button className="ra-expand" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded ? "ย่อพื้นที่" : `ดูครบ ${groups.length} พื้นที่`}<MapIcon name="chevron" size={15}/></button>}
  </section>;
}
