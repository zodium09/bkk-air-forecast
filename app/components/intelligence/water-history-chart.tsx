"use client";
import { useState } from "react";
import type { WaterStation } from "../../lib/water-levels";
import type { WaterHistoryPayload } from "../../lib/water-history-store";
import { waterHistoryGeometry, waterHistorySummary } from "../../lib/water-history";
import { thaiObservationTime } from "../../lib/observation-time";
import { formatValue } from "../../lib/map-intelligence";
import { useLiveResource } from "./use-live-resource";
import "./observations.css";

export default function WaterHistoryChart({ station, version, refresh, motion }: { station: WaterStation; version: string; refresh: number; motion: boolean }) {
  const [hours,setHours] = useState(24), [selected,setSelected] = useState(-1);
  const query = new URLSearchParams({station:station.id,datum:station.datum,hours:String(hours),version});
  const resource = useLiveResource<WaterHistoryPayload>(`/api/water-history?${query}`,refresh);
  const points = resource.data?.points ?? [];
  const geometry = waterHistoryGeometry(points);
  const index = selected < 0 ? points.length-1 : Math.min(selected,points.length-1);
  const active = points[index], dot = geometry.dots[index];
  const trend = waterHistorySummary(points,resource.clock);
  const unit = station.datum === "msl" ? "ม. รทก." : "ม. อ้างอิงสถานี";
  return <div className={`obs-water-history${motion ? "" : " is-still"}`}><div className="obs-history-heading"><h4>ระดับน้ำย้อนหลัง</h4><div role="group" aria-label="ช่วงประวัติระดับน้ำ">{[24,72].map(h=><button key={h} aria-pressed={hours===h} onClick={()=>{setHours(h);setSelected(-1);}}>{h} ชม.</button>)}</div></div>
    {resource.loading ? <p className="obs-empty">กำลังอ่านประวัติระดับน้ำ…</p> : resource.data?.storage === "unavailable" || resource.error ? <p className="obs-empty" role="status">ประวัติยังไม่พร้อม · ค่าตรวจวัดปัจจุบันยังแสดงได้</p> : !points.length ? <p className="obs-empty">ยังไม่มีค่าที่สะสมไว้ของสถานีนี้ในช่วงที่เลือก</p> : <>
      <div className="obs-history-readout"><span>{thaiObservationTime(active?.observedAt ?? null)} น.</span><b>{active ? new Intl.NumberFormat("th-TH",{maximumFractionDigits:3}).format(active.value) : "—"} {unit}</b></div>
      <svg className="obs-history-svg" viewBox="0 0 600 194" role="img" aria-label={`ประวัติระดับน้ำ ${station.name} ${points.length} เวลา หน่วย ${unit}`}>
        {[geometry.max,(geometry.min+geometry.max)/2,geometry.min].map((value,i)=><g key={i}><line x1="48" x2="568" y1={24+i*70} y2={24+i*70} className="bf-grid-line"/><text x="2" y={29+i*70}>{new Intl.NumberFormat("th-TH",{maximumFractionDigits:2}).format(value)}</text></g>)}
        {geometry.paths.map((path,i)=><path key={i} className="bf-chart-line" pathLength="1" d={path} fill="none" stroke="var(--ov-blue)" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>)}
        {geometry.dots.filter((_,i)=>!i||Date.parse(points[i].observedAt)-Date.parse(points[i-1].observedAt)>3600000).map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--ov-blue)"/>)}
        {dot && <circle cx={dot.x} cy={dot.y} r="4" fill="var(--ov-blue)" stroke="var(--ov-surface)" strokeWidth="2"/>}
      </svg><div className="obs-history-labels"><span>{thaiObservationTime(points[0].observedAt)}</span><span>{thaiObservationTime(points.at(-1)!.observedAt)}</span></div>
      {points.length>1 && <input className="obs-history-slider" type="range" aria-label="เลือกเวลาจากประวัติระดับน้ำ" min="0" max={points.length-1} value={index} onChange={event=>setSelected(Number(event.target.value))}/>}
      <p className="obs-history-trend">{points.length===1 ? "เริ่มเก็บประวัติแล้ว · รอค่าตรวจวัดเวลาใหม่เพื่อดูแนวโน้ม" : trend ? `${Math.abs(trend.changeCm)<.05 ? "ระดับใกล้เคียงเดิม" : trend.changeCm>0 ? `เพิ่ม ${formatValue(trend.changeCm)} ซม.` : `ลด ${formatValue(-trend.changeCm)} ซม.`} เทียบค่าก่อนหน้า ${Math.round(trend.minutes)} นาที` : "มีประวัติ แต่ยังไม่มีค่าล่าสุดที่ต่อเนื่องพอจะสรุปการเปลี่ยนแปลง"}</p>
      <details className="obs-history-table"><summary>ดูค่าตรวจวัดทั้งหมด {points.length} เวลา</summary><div><table><caption className="ov-sr-only">ระดับน้ำย้อนหลัง {station.name}</caption><thead><tr><th>เวลาตรวจวัด</th><th>{unit}</th></tr></thead><tbody>{points.map(p=><tr key={p.observedAt}><th scope="row">{thaiObservationTime(p.observedAt)} น.</th><td>{new Intl.NumberFormat("th-TH",{maximumFractionDigits:3}).format(p.value)}</td></tr>)}</tbody></table></div></details>
    </>}
    <p className="obs-panel-note">แสดงเฉพาะค่าที่สะสมได้จริง{points.length ? ` · ช่วงที่มีข้อมูล ${thaiObservationTime(points[0].observedAt)} ถึง ${thaiObservationTime(points.at(-1)!.observedAt)}` : ""} · เส้นขาดเมื่อข้อมูลห่างเกิน 1 ชั่วโมง · ระบบเก็บได้สูงสุด 90 วัน</p>
  </div>;
}
