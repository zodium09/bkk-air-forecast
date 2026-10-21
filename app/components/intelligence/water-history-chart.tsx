"use client";
import { useId, useState, type PointerEvent } from "react";
import type { WaterStation } from "../../lib/water-levels";
import type { WaterHistoryPayload } from "../../lib/water-history-store";
import { waterHistoryGeometry, waterHistorySummary } from "../../lib/water-history";
import { thaiObservationTime } from "../../lib/observation-time";
import { formatValue } from "../../lib/map-intelligence";
import { useLiveResource } from "./use-live-resource";
import "./observations.css";
import "./chart-details.css";

export default function WaterHistoryChart({ station, version, refresh, motion }: { station: WaterStation; version: string; refresh: number; motion: boolean }) {
  const gradId = useId().replace(/:/g, "");
  const [hours,setHours] = useState(24), [selected,setSelected] = useState(-1);
  const query = new URLSearchParams({station:station.id,datum:station.datum,hours:String(hours),version});
  const resource = useLiveResource<WaterHistoryPayload>(`/api/water-history?${query}`,refresh);
  const points = resource.data?.points ?? [];
  const geometry = waterHistoryGeometry(points);
  const index = selected < 0 ? points.length-1 : Math.min(selected,points.length-1);
  const active = points[index], dot = geometry.dots[index];
  const trend = waterHistorySummary(points,resource.clock);
  const unit = station.datum === "msl" ? "ม. รทก." : "ม. อ้างอิงสถานี";
  const nf3 = new Intl.NumberFormat("th-TH",{maximumFractionDigits:3});
  const nf2 = new Intl.NumberFormat("th-TH",{maximumFractionDigits:2});
  const values = points.map(p => p.value);
  const minVal = values.length ? Math.min(...values) : null;
  const maxVal = values.length ? Math.max(...values) : null;
  const bankDiff = active && station.bank !== null && station.datum === "msl" ? active.value - station.bank : null;

  const areaPaths: string[] = [];
  if (points.length > 1) {
    let seg: { x: number; y: number }[] = [];
    points.forEach((pt, i) => {
      const gap = i > 0 && Date.parse(pt.observedAt) - Date.parse(points[i - 1].observedAt) > 3600000;
      if (gap && seg.length > 1) {
        areaPaths.push(`M${seg[0].x},164 L${seg.map(d => `${d.x},${d.y}`).join(" L")} L${seg.at(-1)!.x},164 Z`);
        seg = [];
      } else if (gap) {
        seg = [];
      }
      seg.push(geometry.dots[i]);
    });
    if (seg.length > 1) {
      areaPaths.push(`M${seg[0].x},164 L${seg.map(d => `${d.x},${d.y}`).join(" L")} L${seg.at(-1)!.x},164 Z`);
    }
  }

  function scrubSvg(event: PointerEvent<SVGSVGElement>) {
    if (points.length < 2) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 600;
    let nearest = 0;
    let bestDist = Infinity;
    geometry.dots.forEach((d, idx) => {
      const dist = Math.abs(d.x - svgX);
      if (dist < bestDist) { bestDist = dist; nearest = idx; }
    });
    setSelected(nearest);
  }

  return <div className={`obs-water-history${motion ? "" : " is-still"}`}><div className="obs-history-heading"><h4>ระดับน้ำย้อนหลัง</h4><div role="group" aria-label="ช่วงประวัติระดับน้ำ">{[24,72].map(h=><button key={h} type="button" aria-pressed={hours===h} onClick={()=>{setHours(h);setSelected(-1);}}>{h} ชม.</button>)}</div></div>
    {resource.loading ? <p className="obs-empty">กำลังอ่านประวัติระดับน้ำ…</p> : resource.data?.storage === "unavailable" || resource.error ? <p className="obs-empty" role="status">ประวัติยังไม่พร้อม · ค่าตรวจวัดปัจจุบันยังแสดงได้</p> : !points.length ? <p className="obs-empty">ยังไม่มีค่าที่สะสมไว้ของสถานีนี้ในช่วงที่เลือก</p> : <>
      <div className="obs-history-stats">
        <div className="obs-history-readout">
          <span>เวลาที่เลือก · {thaiObservationTime(active?.observedAt ?? null)} น.</span>
          <b>{active ? nf3.format(active.value) : "—"} <small>{unit}</small></b>
          {bankDiff !== null && <em className={bankDiff >= 0 ? "is-above" : ""}>{bankDiff >= 0 ? `สูงกว่าตลิ่ง +${nf2.format(bankDiff)} ม.` : `ต่ำกว่าตลิ่ง ${nf2.format(Math.abs(bankDiff))} ม.`}</em>}
        </div>
        {minVal !== null && maxVal !== null && <div className="obs-history-minmax">
          <div><small>ต่ำสุด ({hours} ชม.)</small><strong>{nf2.format(minVal)} ม.</strong></div>
          <div><small>สูงสุด ({hours} ชม.)</small><strong>{nf2.format(maxVal)} ม.</strong></div>
          <div><small>จำนวนจุดเวลา</small><strong>{points.length} ครั้ง</strong></div>
        </div>}
      </div>
      <p className="dv-axis-caption">แกนตั้ง: ระดับน้ำ ({unit}) · แกนนอน: เวลาตรวจวัด (ไทย) · เลื่อนเมาส์บนกราฟหรือแถบด้านล่างเพื่ออ่านแต่ละค่าพร้อมเวลา</p>
      <svg className="obs-history-svg is-interactive" viewBox="0 0 600 194" role="img" aria-label={`ประวัติระดับน้ำ ${station.name} ${points.length} เวลา หน่วย ${unit}`} onPointerMove={event => { if (event.pointerType === "mouse" || event.buttons > 0) scrubSvg(event); }} onClick={scrubSvg}>
        <defs>
          <linearGradient id={`wh-grad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ov-blue,#006b55)" stopOpacity="0.26"/>
            <stop offset="100%" stopColor="var(--ov-blue,#006b55)" stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        {[geometry.max,(geometry.min+geometry.max)/2,geometry.min].map((value,i)=><g key={i}><line x1="48" x2="568" y1={24+i*70} y2={24+i*70} className="bf-grid-line"/><text x="2" y={29+i*70}>{nf2.format(value)}</text></g>)}
        {areaPaths.map((d, i) => <path key={`area-${i}`} d={d} fill={`url(#wh-grad-${gradId})`}/>)}
        {geometry.paths.map((path,i)=><path key={i} className="bf-chart-line" pathLength="1" d={path} fill="none" stroke="var(--ov-blue,#006b55)" strokeWidth="2.8" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>)}
        {geometry.dots.filter((_,i)=>!i||Date.parse(points[i].observedAt)-Date.parse(points[i-1].observedAt)>3600000).map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3.2" fill="var(--ov-blue,#006b55)"/>)}
        {dot && <>
          <line x1={dot.x} x2={dot.x} y1="18" y2="170" className="obs-history-cursor"/>
          <circle cx={dot.x} cy={dot.y} r="9" fill="var(--ov-blue,#006b55)" fillOpacity="0.18"/>
          <circle cx={dot.x} cy={dot.y} r="4.8" fill="var(--ov-blue,#006b55)" stroke="var(--ov-surface,#fff)" strokeWidth="2.2"/>
        </>}
      </svg><div className="obs-history-labels"><span>{thaiObservationTime(points[0].observedAt)}</span><span>{thaiObservationTime(points.at(-1)!.observedAt)}</span></div>
      {points.length>1 && <div className="obs-history-scrubber-row">
        <button type="button" className="obs-step-btn" disabled={index <= 0} onClick={() => setSelected(Math.max(0, index - 1))} aria-label="เวลาก่อนหน้า">◀</button>
        <input className="obs-history-slider" type="range" aria-label="เลือกเวลาจากประวัติระดับน้ำ" min="0" max={points.length-1} value={index} onChange={event=>setSelected(Number(event.target.value))}/>
        <button type="button" className="obs-step-btn" disabled={index >= points.length - 1} onClick={() => setSelected(Math.min(points.length - 1, index + 1))} aria-label="เวลาถัดไป">▶</button>
        {selected >= 0 && selected < points.length - 1 && <button type="button" className="obs-latest-btn" onClick={() => setSelected(-1)}>ล่าสุด</button>}
      </div>}
      <p className="obs-history-trend">{points.length===1 ? "เริ่มเก็บประวัติแล้ว · รอค่าตรวจวัดเวลาใหม่เพื่อดูแนวโน้ม" : trend ? `${Math.abs(trend.changeCm)<.05 ? "ระดับใกล้เคียงเดิม" : trend.changeCm>0 ? `เพิ่ม ${formatValue(trend.changeCm)} ซม.` : `ลด ${formatValue(-trend.changeCm)} ซม.`} เทียบค่าก่อนหน้า ${Math.round(trend.minutes)} นาที` : "มีประวัติ แต่ยังไม่มีค่าล่าสุดที่ต่อเนื่องพอจะสรุปการเปลี่ยนแปลง"}</p>
      <details className="obs-history-table"><summary>ดูค่าตรวจวัดทั้งหมด {points.length} เวลา</summary><div><table><caption className="ov-sr-only">ระดับน้ำย้อนหลัง {station.name}</caption><thead><tr><th>เวลาตรวจวัด</th><th>{unit}</th></tr></thead><tbody>{points.map(p=><tr key={p.observedAt}><th scope="row">{thaiObservationTime(p.observedAt)} น.</th><td>{nf3.format(p.value)}</td></tr>)}</tbody></table></div></details>
    </>}
    <p className="obs-panel-note">แสดงเฉพาะค่าที่สะสมได้จริง{points.length ? ` · ช่วงที่มีข้อมูล ${thaiObservationTime(points[0].observedAt)} ถึง ${thaiObservationTime(points.at(-1)!.observedAt)}` : ""} · เส้นขาดเมื่อข้อมูลห่างเกิน 1 ชั่วโมง · ระบบเก็บได้สูงสุด 90 วัน</p>
  </div>;
}
