"use client";
import { MapIcon } from "./map-ui";
export default function WaterStatusCard({kind,title,count,total,loading,selected,onSelect,note}:{kind:"high"|"low"|"road";title:string;count:number|null;total:number;loading:boolean;selected:boolean;onSelect:()=>void;note:string}) {
  const fraction=count!==null&&total>0?Math.max(0,Math.min(1,count/total)):0;
  return <button className={`ds-status-card ds-${kind}`} aria-pressed={selected} aria-controls="water-area-map" onClick={onSelect}>
    <span className="ds-card-title"><MapIcon name={kind==="road"?"pin":"water"} size={23}/>{title}<MapIcon name="arrow" size={18}/></span>
    <span className="ds-card-data"><span className="ds-count-orbit"><svg viewBox="0 0 104 104" aria-hidden="true"><circle className="ds-orbit-track" cx="52" cy="52" r="44"/><circle className="ds-orbit-value" cx="52" cy="52" r="44" pathLength="100" strokeDasharray={`${fraction*100} 100`}/></svg><strong key={loading?"loading":String(count)}>{loading?"…":count??"—"}</strong></span><span><b>{kind==="road"?"จุดมีรายงานน้ำ":"สถานีเข้าเกณฑ์"}</b><small>{loading?"กำลังอ่านข้อมูล":`จาก ${total} ${kind==="road"?"จุดล่าสุด":"สถานีที่จัดสถานะได้"}`}</small></span></span>
    <span className="ds-card-note">{loading?"กำลังตรวจค่าล่าสุดและเกณฑ์จากต้นทาง":count===null?"ข้อมูลล่าสุดหรือเกณฑ์ยังไม่พร้อม":note}</span><span className="ds-card-action">{selected?"กำลังแสดงบนแผนที่":"แตะดูตำแหน่งบนแผนที่"}<MapIcon name="map" size={17}/></span>
  </button>;
}
