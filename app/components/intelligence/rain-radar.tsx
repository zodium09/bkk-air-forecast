"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { RegionId } from "../../lib/provinces";
import type { MapDataset } from "../../lib/map-intelligence";
import { formatValue } from "../../lib/map-intelligence";
import type { TmdRadarPayload, TmdRadarMode } from "../../lib/tmd-radar-data";
import { currentRadar, currentNearbyRain, nearbyRainOutlook, type NearbyRainPayload, type RainPosition } from "../../lib/rain-nearby";
import { thaiObservationTime } from "../../lib/observation-time";
import { useLiveResource, type LiveResource } from "./use-live-resource";
import { MapIcon } from "./map-ui";
import type { RadarImageState } from "./rain-radar-map";
import "./rain-radar.css";

const RainRadarMap=dynamic(()=>import("./rain-radar-map"),{ssr:false,loading:()=> <div className="rb-map-placeholder">กำลังเตรียมแผนที่เรดาร์…</div>});
const trendLabel={increasing:"ปลายช่วงมีฝนเพิ่ม",decreasing:"ปลายช่วงมีฝนลด",steady:"ปริมาณใกล้เคียงกัน",unknown:"ยังเทียบแนวโน้มไม่ได้"};
export default function RainRadar({region,position,onSelect,rainData,refresh=0,sharedResources,onRefresh}:{region:RegionId;position:RainPosition|null;onSelect:(position:RainPosition)=>void;rainData:MapDataset|null;refresh?:number;sharedResources?:{catalog:LiveResource<TmdRadarPayload>;analysis:LiveResource<NearbyRainPayload>};onRefresh?:()=>void}) {
  const [reload,setReload]=useState(0),[mode,setMode]=useState<TmdRadarMode>("observed"),[frameId,setFrameId]=useState<string|null>(null);
  const [playing,setPlaying]=useState(false),[reduced,setReduced]=useState(false),[opacity,setOpacity]=useState(.8),[watching,setWatching]=useState(false);
  const [imageState,setImageState]=useState<RadarImageState|null>(null);
  const [dismissed,setDismissed]=useState("");
  const localCatalog=useLiveResource<TmdRadarPayload>(sharedResources?null:"/api/tmd-radar",refresh+reload);
  const catalog=sharedResources?.catalog??localCatalog;
  const query=position?`/api/rain-nearby?${new URLSearchParams({lat:String(position.lat),lng:String(position.lng)})}`:null;
  const localAnalysis=useLiveResource<NearbyRainPayload>(sharedResources?null:query,refresh+reload);
  const analysis=sharedResources?.analysis??localAnalysis;
  const radar=useMemo(()=>currentRadar(catalog.data,catalog.clock),[catalog.data,catalog.clock]),nearby=currentNearbyRain(analysis.data,analysis.clock);
  const frames=useMemo(()=>mode === "observed"?radar?.observedFrames??[]:radar?.nowcastFrames??[],[mode,radar]);
  const requested=frames.findIndex(frame=>frame.id===frameId);
  const index=requested>=0?requested:mode === "observed"?frames.length-1:0;
  const frame=frames[index]??null;
  const imageReady=!!frame&&imageState?.id===frame.id&&imageState.status === "ready";
  const imageError=!!frame&&imageState?.id===frame.id&&imageState.status === "error";
  const forecast=nearbyRainOutlook(rainData,position,analysis.clock);
  const alertSignature=`${position?.lat}:${position?.lng}:${nearby?.message}`;
  const showAlert=watching&&nearby?.found===true&&dismissed!==alertSignature;
  useEffect(()=> {
    const media=matchMedia("(prefers-reduced-motion: reduce)");
    const sync=()=>{setReduced(media.matches);if(media.matches)setPlaying(false);};
    const hidden=()=>{if(document.hidden)setPlaying(false);};
    sync();media.addEventListener("change",sync);document.addEventListener("visibilitychange",hidden);
    return ()=>{media.removeEventListener("change",sync);document.removeEventListener("visibilitychange",hidden);};
  },[]);
  useEffect(()=> {
    if(!playing||reduced||!imageReady||frames.length<2)return;
    const timer=window.setTimeout(()=>setFrameId(frames[(index+1)%frames.length].id),1200);
    return ()=>clearTimeout(timer);
  },[playing,reduced,imageReady,frames,index]);
  function switchMode(next:TmdRadarMode){setMode(next);setFrameId(null);setPlaying(false);}
  function selectFrame(next:number){setFrameId(frames[next]?.id??null);setPlaying(false);}
  const title=!position?"เลือกพื้นที่เพื่อดูแนวโน้มฝน":analysis.loading?"กำลังตรวจฝนรอบพื้นที่…":nearby?.found===true?"พบสัญญาณฝนใกล้พื้นที่ที่เลือก":nearby?.found===false?"ต้นทางยังไม่พบสัญญาณฝนใกล้จุดนี้":"ยังสรุปฝนใกล้พื้นที่นี้ไม่ได้";
  return <section className="rb-section" id="rain-radar" tabIndex={-1} aria-labelledby="rain-radar-heading">
    <div className="rb-heading"><div><p className="rb-source-kicker"><MapIcon name="radar" size={17}/>เรดาร์และแนวโน้มระยะสั้น</p><h2 id="rain-radar-heading">ฝนใกล้พื้นที่ของฉัน</h2><p>ดูภาพเรดาร์จริง แล้วติดตามแนวโน้มรอบจุดที่เลือกในระยะ 8 กม.</p></div><button className="rb-button" disabled={catalog.loading||catalog.refreshing} onClick={()=>onRefresh ? onRefresh() : setReload(v=>v+1)}><MapIcon name="refresh" size={17}/>{catalog.refreshing?"กำลังอัปเดต…":"อัปเดตเรดาร์"}</button></div>
    {showAlert&&<aside className="rb-watch-alert" role="alert"><MapIcon name="bell" size={21}/><div><b>แจ้งเตือนฝนในพื้นที่ที่กำลังติดตาม</b><p>{nearby.message}</p></div><button aria-label="ปิดแจ้งเตือนฝนรอบนี้" onClick={()=>setDismissed(alertSignature)}><MapIcon name="close" size={18}/></button></aside>}
    <div className="rb-layout"><div className="rb-radar">
      <div className="rb-map-toolbar"><div role="group" aria-label="เลือกภาพเรดาร์"><button aria-pressed={mode === "observed"} onClick={()=>switchMode("observed")}>ตรวจพบล่าสุด</button><button aria-pressed={mode === "nowcast"} onClick={()=>switchMode("nowcast")} disabled={!radar?.nowcastFrames.length}>แนวโน้มระยะสั้น</button></div><span className={`rb-data-state${radar?.status === "live"?" is-live":""}`}><i/>{catalog.loading?"กำลังโหลด":radar?radar.status === "live"?"ข้อมูลล่าสุด":"ข้อมูลบางส่วน":"ข้อมูลยังไม่พร้อม"}</span></div>
      <div className="rb-map-wrap"><RainRadarMap region={region} position={position} frame={frame} opacity={opacity} onSelect={onSelect} onImageState={setImageState}/>
        {frame&&<div className="rb-frame-badge"><b>{mode === "observed"?"เรดาร์ตรวจจริง":"Nowcast จากเรดาร์"}</b><span>{thaiObservationTime(frame.validAt)} น.{mode === "nowcast"?` · +${frame.leadMinutes} นาทีจากภาพฐาน`:""}</span>{!imageReady&&<small>{imageError?"โหลดภาพไม่ได้":"กำลังโหลดภาพเวลานี้…"}</small>}</div>}
        {!frame&&!catalog.loading&&<div className="rb-map-unavailable" role="status"><MapIcon name="info" size={23}/><p>ยังไม่มีภาพเรดาร์ที่ใช้ได้ในช่วงนี้<br/><small>แผนที่พื้นหลังยังเลือกพื้นที่ได้</small></p></div>}
      </div>
      <div className="rb-timeline"><button aria-label={playing?"หยุดภาพเรดาร์":"เล่นภาพเรดาร์ตามเวลา"} aria-pressed={playing} disabled={frames.length<2||reduced||imageError} onClick={()=>setPlaying(v=>!v)}><MapIcon name={playing?"pause":"play"} size={18}/></button><button aria-label="ภาพเรดาร์ก่อนหน้า" disabled={index<=0||!frame} onClick={()=>selectFrame(index-1)}>‹</button><input type="range" aria-label="เลือกเวลาภาพเรดาร์" min="0" max={Math.max(0,frames.length-1)} value={Math.max(0,index)} disabled={frames.length<2} onChange={event=>selectFrame(Number(event.target.value))}/><button aria-label="ภาพเรดาร์ถัดไป" disabled={index>=frames.length-1||!frame} onClick={()=>selectFrame(index+1)}>›</button><span>{frame?`${index+1} / ${frames.length}`:"—"}</span></div>
      <div className="rb-map-bottom"><span>{frames[0]?thaiObservationTime(frames[0].validAt):"รอเวลา"}</span><span>{frames.at(-1)?thaiObservationTime(frames.at(-1)!.validAt):""}</span></div>
      <div className="rb-legend"><div><span>อัตราฝนจากเรดาร์ · มม./ชม.</span><div className="rb-legend-bar"/><div className="rb-legend-ticks">{["0.1","0.5","1","2","5","10","20","30","50","80","120"].map(value=><span key={value}>{value}</span>)}</div></div><label>ความทึบภาพ<input type="range" aria-label="ความทึบภาพเรดาร์" min=".2" max=".9" step=".05" value={opacity} onChange={event=>setOpacity(Number(event.target.value))}/></label></div>
      <p className="rb-note">กดแผนที่เพื่อเลือกพื้นที่ · วงประคือระยะ 8 กม. · สีใสอาจเป็นไม่มีฝนหรือไม่มีข้อมูล ไม่ยืนยันว่าทุกพื้นที่ปลอดฝน{reduced&&" · ปิดการเล่นอัตโนมัติตามการตั้งค่าลดการเคลื่อนไหว"}</p>
    </div><div className="rb-local">
      <div className="rb-area-title"><MapIcon name="pin" size={19}/><div><b>{position?.label??(position?"จุดที่เลือกบนแผนที่":"ยังไม่ได้เลือกพื้นที่")}</b><span>{position?"ผลวิเคราะห์สำหรับจุดนี้และบริเวณโดยรอบ":"เลือกพื้นที่ด้านบน หรือกดแผนที่เรดาร์"}</span></div></div>
      <div className={`rb-assessment${nearby?.found===true?" is-rain":""}`} role="status" aria-live={watching?"polite":"off"} aria-atomic="true"><MapIcon name={nearby?.found===true?"rain":"info"} size={27}/><h3>{title}</h3><p>{position?(analysis.loading?"กำลังอ่านข้อมูลแนวโน้มจาก TMD RadarGIS…":nearby?.message??"ข้อมูลยังไม่พร้อม ลองอัปเดตเรดาร์อีกครั้ง"):"เลือกบ้าน ที่ทำงาน หรือพื้นที่ที่จะไป เพื่ออ่านผลวิเคราะห์ฝนใกล้เคียง"}</p>{nearby?.place&&<small>พื้นที่ตามต้นทาง: {nearby.place}</small>}{nearby?.observedAt&&<small>ภาพเรดาร์ฐาน {thaiObservationTime(nearby.observedAt)} น.</small>}</div>
      <button className={`rb-watch${watching?" is-on":""}`} aria-pressed={watching} disabled={!position} onClick={()=>{setWatching(value=>!value);setDismissed("");}}><MapIcon name="bell" size={18}/>{watching?"กำลังติดตามฝนพื้นที่นี้":"ติดตามฝนพื้นที่นี้"}<span>{watching?"เปิด":"ปิด"}</span></button><p className="rb-note">อัปเดตทุก 5 นาทีขณะเปิดหน้านี้ · ผลวิเคราะห์แสดงในแอป ไม่ใช่ประกาศเตือนภัย</p>
      <a className="rb-official" href="https://www.tmd.go.th/warning-and-events/warning-storm" target="_blank" rel="noreferrer">ดูประกาศเตือนภัยจากกรมอุตุฯ<MapIcon name="arrow" size={16}/></a>
    </div></div>
    {position&&<div className="rb-nearby"><div className="rb-nearby-heading"><h3>แนวโน้มฝนในพื้นที่ใกล้เคียง</h3><span>แบบจำลอง Open-Meteo · 3 ช่วงชั่วโมง</span></div><div className="rb-nearby-list">{forecast.map(row=><button key={row.id} onClick={()=>onSelect(row)}><span className="rb-nearby-place"><b>{row.label}</b><small>ห่างจุดที่เลือก {formatValue(row.distanceKm)} กม.</small></span><span className="rb-mini-hours">{row.hours.map(hour=><span key={hour.key}><i style={{transform:`scaleY(${hour.amount===null?.04:hour.amount===0?0:Math.max(.06,Math.min(1,hour.amount/Math.max(1,...row.hours.map(h=>h.amount??0))))})`}} className={hour.amount===null?"is-missing":""}/><small>{hour.label}</small><em>{formatValue(hour.amount)}</em></span>)}</span><span className="rb-nearby-reading"><b>{formatValue(row.total)}<small>มม.</small></b><em>{trendLabel[row.trend]}</em><small>โอกาสฝนสูงสุดรายชั่วโมง {formatValue(row.probability)}%</small></span><MapIcon name="arrow" size={16}/></button>)}</div>{!forecast.length&&<p className="rb-note">ยังไม่มีจุดพยากรณ์รายชั่วโมงที่ใช้ได้ในระยะ 8 กม. · ผลวิเคราะห์เรดาร์ด้านบนเป็นอีกชุดข้อมูล</p>}<p className="rb-note">รวมชั่วโมงปัจจุบันเต็มช่วงและอีก 2 ชั่วโมงถัดไป ตามเวลาที่แสดง · จุดใกล้กันอาจใช้เซลล์แบบจำลองเดียวกัน · ไม่ใช่การติดตามกลุ่มฝนหรือเวลาฝนถึงบ้าน</p></div>}
    <details className="rb-provenance"><summary>เวลาและที่มาของข้อมูล<MapIcon name="chevron" size={17}/></summary><p>ภาพและผลวิเคราะห์บริเวณใกล้เคียงจาก TMD RadarGIS · เวลาฐาน {radar?.observedAt?thaiObservationTime(radar.observedAt)+" น.":"ยังไม่พร้อม"} · ตรวจข้อมูล {catalog.data?thaiObservationTime(catalog.data.fetchedAt)+" น.":"กำลังโหลด"}</p><p>ผลวิเคราะห์ตำแหน่งของต้นทางไม่ได้ระบุเวลาของตัวเอง แอปจึงตรวจความใหม่กับภาพฐานและต้องมี Nowcast ที่ยังไม่หมดเวลา · เมื่อข้อมูลเกิน 30 นาทีจะหยุดสรุปสถานการณ์ใกล้เคียง ภาพตรวจจริงเกิน 90 นาทีจะไม่แสดง</p><p>ภาพเรดาร์แสดงอัตราฝนที่ประมาณจากเรดาร์ หน่วย มม./ชม. ส่วนกราฟใกล้เคียงเป็นยอดสะสมตามช่วงชั่วโมงจากแบบจำลอง ไม่ใช่หน่วยเดียวกัน</p><a href="https://radargis.tmd.go.th/" target="_blank" rel="noreferrer">เปิด TMD RadarGIS</a>{(catalog.error||analysis.error)&&<p role="status">{catalog.error||analysis.error}</p>}</details>
  </section>;
}
