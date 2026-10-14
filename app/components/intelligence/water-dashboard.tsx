"use client";
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "../theme-toggle";
import { MapIcon, goToStory } from "./map-ui";
import DashboardSectionNav from "./dashboard-section-nav";
import WaterStatusCard from "./water-status-card";
import WaterOverview from "./water-overview";
import RoadFloodOverview from "./road-flood-overview";
import UpstreamWatch from "./upstream-watch";
import TideOutlook from "./tide-outlook";
import RiskAreaSummary from "./risk-area-summary";
import { useLiveResource } from "./use-live-resource";
import { useMapPlaces } from "./use-map-places";
import { useAutoLocation } from "./use-auto-location";
import { buildImportantEvents } from "../../lib/important-events";
import type { WaterPayload } from "../../lib/water-levels";
import type { RoadFloodPayload } from "../../lib/road-floods";
import { DEFAULT_REGION_ID, CHAO_PHRAYA_REGION_ID, getRegion, provinces, regionOptionLabel, type RegionId } from "../../lib/provinces";
import { placeLabel } from "../../lib/map-places";
import type { RainPosition } from "../../lib/rain-nearby";
import "./overview.css";
import "./briefing.css";
import "./night-theme.css";
import "./experience.css";
import "./topic-color.css";

export default function WaterDashboard() {
  const [region,setRegion]=useState<RegionId>(DEFAULT_REGION_ID), [position,setPosition]=useState<RainPosition|null>(null);
  const [initialized,setInitialized]=useState(false), [refresh,setRefresh]=useState(0), [query,setQuery]=useState("");
  const [mapTopic,setMapTopic]=useState("water"),[mapEvent,setMapEvent]=useState<string|undefined>(),[selectedStation,setSelectedStation]=useState(""),[motion,setMotion]=useState(true);
  const geography=useMapPlaces(region,refresh);
  const water=useLiveResource<WaterPayload>("/api/water-levels",refresh), roads=useLiveResource<RoadFloodPayload>("/api/road-floods",refresh);
  const location=useAutoLocation(geography.catalog?.places,place=>{setRegion(place.provinceId);setPosition({...place,label:placeLabel(place)});},initialized&&!position);
  const summary=useMemo(()=>buildImportantEvents({region,place:position,water:water.data,roads:roads.data,air:null,rain:null,heat:null,now:Math.max(water.clock,roads.clock)}),[region,position,water.data,roads.data,water.clock,roads.clock]);
  const topics=(["water","road"] as const).map(id=>({id,title:id==="water"?"คลองและแม่น้ำ":"น้ำบนถนน",points:summary.points.filter(p=>p.topic===id),loading:id==="water"?water.loading:roads.loading,note:id==="water"?"ระดับน้ำอ้างอิงรายสถานี แยกน้ำมากและน้ำน้อย ไม่ใช่ความลึกน้ำท่วม":"สถานะจากจุดตรวจวัดของ กทม. ไม่ยืนยันสภาพถนนตลอดสาย"}));
  const scope=position?`${position.label??"จุดที่เลือก"} · รอบ 8 กม.`:getRegion(region).shortNameTh;
  const high=summary.events.find(e=>e.id==="water-high"), low=summary.events.find(e=>e.id==="water-low"), road=summary.events.find(e=>e.id==="road-flood");
  const waterCoverage=summary.coverage.find(c=>c.topic==="water"),roadCoverage=summary.coverage.find(c=>c.topic==="road");
  function showEvent(topic:string,event:string){setMapTopic(topic);setMapEvent(mapEvent===event?undefined:event);goToStory("water-area-map");}
  const results=query.trim()?geography.places.filter(p=>`${placeLabel(p)} ${p.province}`.includes(query.trim())).slice(0,5):[];
  function topicLink(topic:string) { return `/${topic}?${new URLSearchParams({province:region,...(position?{lat:String(position.lat),lng:String(position.lng)}:{})})}`; }
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const timer=setTimeout(()=>{
      setRegion(getRegion(params.get("province")??DEFAULT_REGION_ID).id);
      const lat=Number(params.get("lat")),lng=Number(params.get("lng"));
      if(params.has("lat")&&params.has("lng")&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180) setPosition({lat,lng});
      setInitialized(true);
    },0);
    return ()=>clearTimeout(timer);
  },[]);
  useEffect(()=>{
    if(!initialized)return;
    const params=new URLSearchParams({province:region,...(position?{lat:String(position.lat),lng:String(position.lng)}:{})});
    history.replaceState(null,"",`/water?${params}${window.location.hash}`);
  },[initialized,region,position]);
  return <main className="ov-page ex-water-page ds-dashboard" data-motion={motion?"on":"off"}>
    <a className="ov-skip" href="#water-summary">ข้ามไปที่ข้อมูลระดับน้ำ</a>
    <header className="ov-header"><a className="ov-brand" href="/"><span className="ov-brand-mark"><MapIcon name="water" size={24}/></span><span>BKK <b>Air</b><small>เจ้าพระยาและกรุงเทพฯ–ปริมณฑล</small></span></a><nav aria-label="เมนูหลัก"><a href="/">ภาพรวม</a><a href={topicLink("rain")}>ฝน</a><a href={topicLink("water")} aria-current="page">ระดับน้ำ</a><a href={topicLink("air")}>ฝุ่น PM2.5</a><a href={topicLink("heat")}>ความร้อน</a></nav><ThemeToggle/></header>
    <section className="ds-water-hero" id="water-summary"><div><span className="ds-live-label"><i/>น้ำรอบตัววันนี้</span><h1>เห็นจังหวะน้ำ<br/><span>รู้พื้นที่ที่ควรติดตาม</span></h1><p>เริ่มจากสถานการณ์จริงบนแผนที่ แล้วเทียบฝนกับน้ำขึ้นน้ำลง</p><div className="ds-hero-meta"><span><MapIcon name="pin" size={17}/>{scope}</span><span>ตรวจวัด + น้ำทำนาย</span></div></div><figure><img src="/illustrations/bangkok-weather.webp" width="1200" height="800" alt="ภาพประกอบเมืองริมน้ำและสภาพอากาศ"/><figcaption>ภาพประกอบ ไม่ใช่ภาพสถานการณ์ปัจจุบัน</figcaption></figure></section>
    <DashboardSectionNav items={[{id:"water-area-map",label:"แผนที่สถานการณ์",icon:"map"},{id:"tide-analysis",label:"น้ำขึ้นน้ำลง × ฝน",icon:"chart"},{id:"water-levels",label:"สถานีน้ำ",icon:"water"},{id:"road-floods",label:"น้ำบนถนน",icon:"pin"},{id:"upstream-watch",label:"ต้นน้ำและอ่าง",icon:"water"}]} motion={motion} onMotion={()=>setMotion(v=>!v)}/>
    <section className="ex-water-context" aria-label="เลือกพื้นที่ระดับน้ำ"><label>พื้นที่<select aria-label="จังหวัดสำหรับระดับน้ำ" value={region} onChange={e=>{location.cancel();setRegion(e.target.value as RegionId);setPosition(null);setQuery("");}}><option value={CHAO_PHRAYA_REGION_ID}>เจ้าพระยาและกรุงเทพฯ–ปริมณฑล</option><option value="metro">กรุงเทพฯ–ปริมณฑลเดิม</option>{provinces.map(p=><option key={p.id} value={p.id}>{regionOptionLabel(p)}</option>)}</select></label><div className="ex-water-search"><label htmlFor="water-search" className="ov-sr-only">ค้นหาพื้นที่สำหรับระดับน้ำ</label><input id="water-search" type="search" placeholder="ค้นหาเขต อำเภอ หรือพื้นที่" value={query} onChange={e=>setQuery(e.target.value)} autoComplete="off"/>{query.trim()&&<ul>{results.map(place=><li key={place.id}><button onClick={()=>{location.cancel();setPosition({...place,label:placeLabel(place)});setQuery("");}}>{placeLabel(place)}<small>{place.province}</small></button></li>)}{!results.length&&<li>ไม่พบพื้นที่ที่ตรงกับคำค้น</li>}</ul>}</div><button className="ov-location-button" disabled={location.locating||geography.loading} onClick={location.locate}><MapIcon name="location" size={18}/>{location.locating?"กำลังหาตำแหน่ง…":"ใช้ตำแหน่งของฉัน"}</button></section>
    {location.message&&<p className="ex-location-status" role="status">{location.message}</p>}{geography.error&&<p role="status">{geography.error}</p>}
    <div className="ex-water-scope"><p><MapIcon name="pin" size={18}/>{scope}</p>{position&&<button className="ov-text-link" onClick={()=>{location.cancel();setPosition(null);}}>ดูทั้งพื้นที่</button>}<button className="ov-location-button" disabled={water.loading||roads.loading||water.refreshing||roads.refreshing} onClick={()=>setRefresh(n=>n+1)}><MapIcon name="refresh" size={17}/>อัปเดตข้อมูล</button></div>
    <section className="ds-situation" aria-label="สรุปน้ำที่ควรติดตาม"><div className="ds-section-intro"><div><h2>สถานการณ์น้ำตอนนี้</h2><p>แตะการ์ดเพื่อดูจุดที่เข้าเกณฑ์บนแผนที่</p></div><span className="ds-observation-label"><MapIcon name="clock" size={16}/>ค่าตรวจวัดล่าสุด</span></div><div className="ds-status-grid">
      <WaterStatusCard kind="high" title="น้ำมาก / ถึงตลิ่ง" count={waterCoverage?.used?high?.count??0:null} total={waterCoverage?.used??0} loading={water.loading} selected={mapEvent==="water-high"} onSelect={()=>showEvent("water","water-high")} note={high?.detail??"ยังไม่พบสถานีเข้าเกณฑ์ในข้อมูลที่ใช้ได้"}/>
      <WaterStatusCard kind="low" title="น้ำน้อย" count={waterCoverage?.used?low?.count??0:null} total={waterCoverage?.used??0} loading={water.loading} selected={mapEvent==="water-low"} onSelect={()=>showEvent("water","water-low")} note={low?.detail??"อ่านแยกจากน้ำมาก เพื่อดูสถานีที่น้ำน้อย"}/>
      <WaterStatusCard kind="road" title="น้ำบนถนน" count={roadCoverage?.used?road?.count??0:null} total={roadCoverage?.used??0} loading={roads.loading} selected={mapEvent==="road-flood"} onSelect={()=>showEvent("road","road-flood")} note="จุดตรวจวัดถนนและอุโมงค์ เฉพาะกรุงเทพฯ"/>
    </div><div className="ds-coverage-strip">{summary.coverage.filter(c=>c.topic==="water"||c.topic==="road").map(c=><span key={c.topic}>{c.title} · ใช้สรุป {c.used}/{c.total} จุด</span>)}<small>วงแสดงสัดส่วนจุดในข้อมูล ไม่ใช่โอกาสท่วม · — ข้อมูลไม่พอ · 0 ไม่พบจุดเข้าเกณฑ์</small></div></section>
    <div id="water-area-map" className="ds-map-stage" tabIndex={-1}><RiskAreaSummary title="น้ำอยู่ตรงไหนบนแผนที่" topics={topics} region={region} defaultMapOpen activeTopic={mapTopic} onTopicChange={topic=>{setMapTopic(topic);setMapEvent(undefined);}} eventId={mapEvent} onClearEvent={()=>setMapEvent(undefined)} pointActionLabel="อ่านกราฟและค่าตรวจวัด" onSelectPoint={point=>{if(point.topic==="water")setSelectedStation(point.id.slice(6));goToStory(point.topic==="water"?"water-levels":"road-floods");}}/></div>
    <TideOutlook region={region} position={position} refresh={refresh} water={water} roads={roads}/>
    <WaterOverview key={selectedStation} initialStationId={selectedStation} showSummary={false} showAreaMap={false} region={region} place={position} refresh={refresh} sharedResource={water} onRefresh={()=>setRefresh(n=>n+1)}/>
    <RoadFloodOverview showAreaMap={false} region={region} place={position} refresh={refresh} sharedResource={roads}/>
    <UpstreamWatch refresh={refresh}/>
    <div className="ex-topic-link"><MapIcon name="rain" size={24}/><div><b>ติดตามฝนที่จะเข้ามา</b><p>เรดาร์และพยากรณ์ฝนอยู่ในหน้าฝน ใช้พื้นที่เดียวกันได้</p></div><a href={topicLink("rain")}>ดูฝน<MapIcon name="arrow" size={18}/></a></div>
    <footer className="ov-footer"><a href="/">BKK Air · กลับภาพรวม</a><p>ค่าตรวจวัดและน้ำทำนายแยกกัน · ระดับน้ำอ้างอิงไม่ใช่ความลึกน้ำท่วม</p></footer>
  </main>;
}
