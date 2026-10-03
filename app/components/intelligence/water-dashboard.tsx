"use client";
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "../theme-toggle";
import { MapIcon } from "./map-ui";
import WaterOverview from "./water-overview";
import RoadFloodOverview from "./road-flood-overview";
import UpstreamWatch from "./upstream-watch";
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

export default function WaterDashboard() {
  const [region,setRegion]=useState<RegionId>(DEFAULT_REGION_ID), [position,setPosition]=useState<RainPosition|null>(null);
  const [initialized,setInitialized]=useState(false), [refresh,setRefresh]=useState(0), [query,setQuery]=useState("");
  const geography=useMapPlaces(region,refresh);
  const water=useLiveResource<WaterPayload>("/api/water-levels",refresh), roads=useLiveResource<RoadFloodPayload>("/api/road-floods",refresh);
  const location=useAutoLocation(geography.catalog?.places,place=>{setRegion(place.provinceId);setPosition({...place,label:placeLabel(place)});},initialized&&!position);
  const summary=useMemo(()=>buildImportantEvents({region,place:position,water:water.data,roads:roads.data,air:null,rain:null,heat:null,now:Math.max(water.clock,roads.clock)}),[region,position,water.data,roads.data,water.clock,roads.clock]);
  const topics=(["water","road"] as const).map(id=>({id,title:id==="water"?"คลองและแม่น้ำ":"น้ำบนถนน",points:summary.points.filter(p=>p.topic===id),loading:id==="water"?water.loading:roads.loading,note:id==="water"?"ระดับน้ำอ้างอิงรายสถานี แยกน้ำมากและน้ำน้อย ไม่ใช่ความลึกน้ำท่วม":"สถานะจากจุดตรวจวัดของ กทม. ไม่ยืนยันสภาพถนนตลอดสาย"}));
  const scope=position?`${position.label??"จุดที่เลือก"} · รอบ 8 กม.`:getRegion(region).shortNameTh;
  const high=summary.events.find(e=>e.id==="water-high"), low=summary.events.find(e=>e.id==="water-low"), road=summary.events.find(e=>e.id==="road-flood");
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
  return <main className="ov-page ex-water-page">
    <a className="ov-skip" href="#water-summary">ข้ามไปที่ข้อมูลระดับน้ำ</a>
    <header className="ov-header"><a className="ov-brand" href="/"><span className="ov-brand-mark"><MapIcon name="water" size={24}/></span><span>BKK <b>Air</b><small>เจ้าพระยาและกรุงเทพฯ–ปริมณฑล</small></span></a><nav aria-label="เมนูหลัก"><a href="/">ภาพรวม</a><a href={topicLink("rain")}>ฝน</a><a href={topicLink("water")} aria-current="page">ระดับน้ำ</a><a href={topicLink("air")}>ฝุ่น PM2.5</a><a href={topicLink("heat")}>ความร้อน</a></nav><ThemeToggle/></header>
    <section className="ex-water-hero" id="water-summary"><div><span className="ex-eyebrow"><MapIcon name="water" size={18}/>คลอง · แม่น้ำ · ถนน</span><h1>ตามน้ำ<br/><span>ให้ทันสถานการณ์</span></h1><p>ดูระดับน้ำล่าสุด แยกน้ำมากและน้ำน้อย<br/>พร้อมสถานีใกล้พื้นที่ของคุณ</p><nav className="ex-jump-links" aria-label="ข้ามไปข้อมูลระดับน้ำ"><a href="#water-levels">สถานีน้ำ<MapIcon name="arrow" size={16}/></a><a href="#road-floods">น้ำบนถนน</a><a href="#upstream-watch">ต้นน้ำ</a></nav><small>ค่าตรวจวัดรายสถานี · ใช้เวลาของต้นทาง</small></div><figure><img src="/illustrations/bangkok-weather.webp" width="1200" height="800" alt="ภาพประกอบเมืองริมน้ำและสภาพอากาศ"/><figcaption>ภาพประกอบเพื่อเล่าเรื่อง ไม่ใช่ภาพสถานการณ์ปัจจุบัน</figcaption></figure></section>
    <section className="ex-water-context" aria-label="เลือกพื้นที่ระดับน้ำ"><label>พื้นที่<select aria-label="จังหวัดสำหรับระดับน้ำ" value={region} onChange={e=>{location.cancel();setRegion(e.target.value as RegionId);setPosition(null);setQuery("");}}><option value={CHAO_PHRAYA_REGION_ID}>เจ้าพระยาและกรุงเทพฯ–ปริมณฑล</option><option value="metro">กรุงเทพฯ–ปริมณฑลเดิม</option>{provinces.map(p=><option key={p.id} value={p.id}>{regionOptionLabel(p)}</option>)}</select></label><div className="ex-water-search"><label htmlFor="water-search" className="ov-sr-only">ค้นหาพื้นที่สำหรับระดับน้ำ</label><input id="water-search" type="search" placeholder="ค้นหาเขต อำเภอ หรือพื้นที่" value={query} onChange={e=>setQuery(e.target.value)} autoComplete="off"/>{query.trim()&&<ul>{results.map(place=><li key={place.id}><button onClick={()=>{location.cancel();setPosition({...place,label:placeLabel(place)});setQuery("");}}>{placeLabel(place)}<small>{place.province}</small></button></li>)}{!results.length&&<li>ไม่พบพื้นที่ที่ตรงกับคำค้น</li>}</ul>}</div><button className="ov-location-button" disabled={location.locating||geography.loading} onClick={location.locate}><MapIcon name="location" size={18}/>{location.locating?"กำลังหาตำแหน่ง…":"ใช้ตำแหน่งของฉัน"}</button></section>
    {location.message&&<p className="ex-location-status" role="status">{location.message}</p>}{geography.error&&<p role="status">{geography.error}</p>}
    <div className="ex-water-scope"><p><MapIcon name="pin" size={18}/>{scope}</p>{position&&<button className="ov-text-link" onClick={()=>{location.cancel();setPosition(null);}}>ดูทั้งพื้นที่</button>}<button className="ov-location-button" disabled={water.loading||roads.loading||water.refreshing||roads.refreshing} onClick={()=>setRefresh(n=>n+1)}><MapIcon name="refresh" size={17}/>อัปเดตข้อมูล</button></div>
    <section className="ex-water-metrics" aria-label="สรุปน้ำที่ควรติดตาม"><a href="#water-levels"><MapIcon name="water" size={22}/><span>น้ำมาก / ถึงตลิ่ง</span><b>{water.loading?"…":summary.coverage.find(c=>c.topic==="water")?.used?high?.count??0:"—"}<small>สถานี</small></b><p>{high?.detail??"ตรวจรายละเอียดสถานีและความพร้อมของเกณฑ์"}</p></a><a href="#water-levels"><MapIcon name="water" size={22}/><span>น้ำน้อย</span><b>{water.loading?"…":summary.coverage.find(c=>c.topic==="water")?.used?low?.count??0:"—"}<small>สถานี</small></b><p>{low?.detail??"แสดงแยกจากน้ำมากตามเกณฑ์ต้นทาง"}</p></a><a href="#road-floods"><MapIcon name="pin" size={22}/><span>ต้นทางรายงานน้ำบนถนน</span><b>{roads.loading?"…":summary.coverage.find(c=>c.topic==="road")?.used?road?.count??0:"—"}<small>จุด</small></b><p>จุดตรวจวัดเฉพาะกรุงเทพฯ · ไม่ครอบคลุมถนนทุกสาย</p></a></section>
    <div className="ex-water-readiness">{summary.coverage.filter(c=>c.topic==="water"||c.topic==="road").map(c=><span key={c.topic}>{c.title} · ใช้สรุปได้ {c.used}/{c.total} จุด</span>)}<small>— หมายถึงยังมีข้อมูลไม่พอ · 0 หมายถึงไม่พบจุดเข้าเกณฑ์ในชุดข้อมูลที่ใช้ได้</small></div>
    <RiskAreaSummary title="สถานการณ์น้ำในแต่ละพื้นที่" topics={topics} region={region}/>
    <WaterOverview region={region} place={position} refresh={refresh} sharedResource={water} onRefresh={()=>setRefresh(n=>n+1)}/>
    <RoadFloodOverview region={region} place={position} refresh={refresh} sharedResource={roads}/>
    <UpstreamWatch refresh={refresh}/>
    <div className="ex-topic-link"><MapIcon name="rain" size={24}/><div><b>ติดตามฝนที่จะเข้ามา</b><p>เรดาร์และพยากรณ์ฝนอยู่ในหน้าฝน ใช้พื้นที่เดียวกันได้</p></div><a href={topicLink("rain")}>ดูฝน<MapIcon name="arrow" size={18}/></a></div>
    <footer className="ov-footer"><a href="/">BKK Air · กลับภาพรวม</a><p>ระดับน้ำอ้างอิงไม่ใช่ความลึกน้ำท่วม · ข้อมูลตรวจวัดไม่ใช่พยากรณ์ 7 วัน</p></footer>
  </main>;
}
