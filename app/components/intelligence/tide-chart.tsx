"use client";
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The labelled horizontal chart region must support keyboard scrolling. */
import { useEffect, useId, useRef } from "react";
import { detailNumber } from "../../lib/detail-visuals";
import { tideTime, type TidePoint, type TideRainHour, type TideWindow } from "../../lib/tides";

export default function TideChart({ date, points, rain, windows, hour, onHour }: {date:string;points:TidePoint[];rain:TideRainHour[];windows:TideWindow[];hour:number;onHour:(hour:number)=>void}) {
  const id=useId().replace(/:/g,""),scroll=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const frame=scroll.current;
    if(!frame)return;
    const showSelected=()=>{
      const selected=frame.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
      if(!selected)return;
      const viewport=frame.getBoundingClientRect(),item=selected.getBoundingClientRect();
      if(item.left<viewport.left||item.right>viewport.right)frame.scrollBy({left:item.left-viewport.left-viewport.width/2+item.width/2,behavior:"instant"});
    };
    showSelected();
    const observer=typeof ResizeObserver==="function"?new ResizeObserver(showSelected):null;
    observer?.observe(frame);
    return()=>observer?.disconnect();
  },[date,hour]);
  const values=Array.from({length:25},(_,h)=>points.find(p=>p.at===tideTime(date,h))?.metres??null);
  const amounts=Array.from({length:24},(_,h)=>rain.find(p=>p.start===tideTime(date,h))?.mm??null);
  const finite=values.filter((n):n is number=>n!==null),wet=amounts.filter((n):n is number=>n!==null);
  const span=finite.length?Math.max(...finite)-Math.min(...finite):1,step=span<=3?.5:span<=6?1:Math.ceil(span/4);
  const min=finite.length?Math.floor((Math.min(...finite)-.1)/step)*step:0,max=finite.length?Math.ceil((Math.max(...finite)+.2)/step)*step:1;
  const rainMax=Math.max(5,Math.ceil(Math.max(0,...wet)/5)*5);
  const x=(h:number)=>24+h*40,y=(v:number)=>174-(v-min)/(max-min)*144,ry=(v:number)=>304-v/rainMax*82;
  const segments:{x:number;y:number}[][]=[];
  values.forEach((v,h)=>{if(v===null){segments.push([]);return;}if(!segments.length)segments.push([]);segments.at(-1)!.push({x:x(h),y:y(v)});});
  function select(h:number,button?:HTMLButtonElement) {
    onHour(h);
    if(button&&scroll.current){const frame=scroll.current.getBoundingClientRect(),item=button.getBoundingClientRect();if(item.left<frame.left||item.right>frame.right)scroll.current.scrollBy({left:item.left-frame.left-frame.width/2+item.width/2,behavior:"instant"});}
  }
  const ticks=Array.from({length:Math.round((max-min)/step)+1},(_,i)=>min+step*i);
  return <div className="tc-chart" id="tide-analysis-chart">
    <div className="tc-hour-scrubber"><label htmlFor={`tide-hour-${id}`}>เลื่อนอ่านเวลา</label><input id={`tide-hour-${id}`} type="range" min="0" max="23" step="1" value={hour} aria-label="เลือกชั่วโมงบนกราฟน้ำและฝน" aria-valuetext={`${String(hour).padStart(2,"0")}:00 น.`} onChange={event=>onHour(Number(event.target.value))}/><output htmlFor={`tide-hour-${id}`}>{String(hour).padStart(2,"0")}:00 น.</output></div>
    <p className="tc-axis-caption">แกนตั้งแยกหน่วย: น้ำทำนาย (ม. ทะเลปานกลาง) / ฝน (มม. ต่อ 1 ชม.) · แกนนอน: เวลาไทยของวันที่เลือก</p>
    <div className="tc-chart-frame">
      <svg className="tc-axis" viewBox="0 0 56 340" aria-hidden="true"><text x="2" y="14">ม.</text>{finite.length>0&&ticks.map(v=><text key={v} x="50" y={y(v)+4} textAnchor="end">{detailNumber(Number(v.toFixed(3)))}</text>)}<text x="2" y="210">มม.</text>{wet.length>0&&[0,rainMax/2,rainMax].map(v=><text key={v} x="50" y={ry(v)+4} textAnchor="end">{detailNumber(v)}</text>)}</svg>
      <div ref={scroll} className="tc-chart-scroll" role="region" tabIndex={0} aria-label="กราฟน้ำทำนายและฝน เลื่อนแนวนอนเพื่อดู 24 ชั่วโมง">
        <div className="tc-chart-plot">
          <svg key={date} className="tc-plot-svg" viewBox="0 0 1008 340" preserveAspectRatio="none" role="img" aria-label={`น้ำทำนายรายชั่วโมง ${date} มี ${finite.length} ค่า และฝนรายชั่วโมง ${wet.length} ค่า`}>
            <defs><linearGradient id={`tc-fill-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--tc-water)" stopOpacity=".22"/><stop offset="1" stopColor="var(--tc-water)" stopOpacity=".02"/></linearGradient></defs>
            {windows.map((w,i)=><rect key={w.start} x={x(i*3)} y="20" width="120" height="288" className={`tc-band is-${w.kind}`}/>)}
            {finite.length>0&&ticks.map(v=><line key={v} x1="24" x2="984" y1={y(v)} y2={y(v)} className="tc-grid"/>)}
            {wet.length>0&&[0,rainMax/2,rainMax].map(v=><line key={v} x1="24" x2="984" y1={ry(v)} y2={ry(v)} className="tc-grid"/>)}
            <text x="24" y="14" className="tc-plot-title">ระดับน้ำทำนายรายชั่วโมง</text><text x="24" y="210" className="tc-plot-title">ฝนสะสมในแต่ละชั่วโมง</text>
            {segments.filter(s=>s.length).map((s,i)=><g key={i}><path d={`M${s[0].x},174 L${s.map(p=>`${p.x},${p.y}`).join(" L")} L${s.at(-1)!.x},174 Z`} fill={`url(#tc-fill-${id})`}/><path pathLength="1" className="tc-tide-line" d={`M${s.map(p=>`${p.x},${p.y}`).join(" L")}`} fill="none" stroke="var(--tc-water)" strokeWidth="3" vectorEffect="non-scaling-stroke"/>{s.map(p=><circle key={p.x} cx={p.x} cy={p.y} r="3" fill="var(--tc-water)"/>)}</g>)}
            {amounts.map((v,h)=>v===null?<text key={h} x={x(h)+20} y="299" textAnchor="middle" className="tc-missing">—</text>:<g key={h}>{v>0&&<rect x={x(h)+7} y={ry(v)} width="26" height={304-ry(v)} rx="3" fill="var(--tc-rain)"/>}<text x={x(h)+20} y={v>0?ry(v)-6:298} textAnchor="middle" className="tc-bar-value">{detailNumber(v)}</text></g>)}
            <line x1="24" x2="24" y1="20" y2="308" style={{transform:`translateX(${hour*40}px)`}} className="tc-cursor"/>
            {values[hour]!==null&&<circle cx={x(hour)} cy={y(values[hour]!)} r="6" fill="var(--tc-water)" stroke="var(--ov-surface)" strokeWidth="2"/>}
            {Array.from({length:9},(_,i)=>i*3).map(h=><text key={h} x={x(h)} y="331" textAnchor="middle" className="tc-time-label">{String(h).padStart(2,"0")}:00</text>)}
            {!finite.length&&<text x="500" y="100" textAnchor="middle" className="tc-missing">ไม่มีน้ำทำนายในช่วงนี้</text>}
          </svg>
          <div className="tc-chart-targets" role="group" aria-label="เลือกชั่วโมงเพื่ออ่านน้ำทำนายและฝน">{Array.from({length:24},(_,h)=><button key={h} style={{left:`${(24+h*40)/1008*100}%`,width:`${40/1008*100}%`}} aria-pressed={h===hour} aria-label={`${String(h).padStart(2,"0")}:00–${String(h+1).padStart(2,"0")}:00 น้ำทำนาย ${detailNumber(values[h])} เมตร ฝน ${detailNumber(amounts[h])} มิลลิเมตร`} onClick={()=>select(h)} onKeyDown={event=>{const next=event.key==="ArrowRight"?Math.min(23,h+1):event.key==="ArrowLeft"?Math.max(0,h-1):event.key==="Home"?0:event.key==="End"?23:-1;if(next<0)return;event.preventDefault();const button=event.currentTarget.parentElement?.children[next] as HTMLButtonElement;select(next,button);button?.focus();}}/>)}</div>
        </div>
      </div>
    </div>
    <p className="tc-scroll-hint">แตะชั่วโมงหรือใช้ปุ่มลูกศรอ่านค่า · เลื่อนแนวนอนดูครบวัน · — คือข้อมูลขาด, 0 คือฝนศูนย์จริง</p>
  </div>;
}
