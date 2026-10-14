"use client";
import { useEffect, useState } from "react";
import { MapIcon } from "./map-ui";

export default function DashboardSectionNav({items,motion,onMotion}:{items:{id:string;label:string;icon:string}[];motion:boolean;onMotion:()=>void}) {
  const [active,setActive]=useState(items[0]?.id??"");
  const ids=items.map(item=>item.id).join(",");
  useEffect(()=>{
    const observer=new IntersectionObserver(entries=>{
      const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
      if(visible[0])setActive(visible[0].target.id);
    },{rootMargin:"-90px 0px -55% 0px",threshold:0});
    for(const id of ids.split(",")){const section=document.getElementById(id);if(section)observer.observe(section);}
    return()=>observer.disconnect();
  },[ids]);
  return <nav className="ds-section-nav" aria-label="เลือกส่วนในแดชบอร์ด"><div>{items.map(item=><a key={item.id} href={`#${item.id}`} aria-current={active===item.id?"location":undefined}><MapIcon name={item.icon} size={18}/>{item.label}</a>)}</div><button onClick={onMotion} aria-pressed={!motion} title={motion?"หยุดแอนิเมชัน":"เปิดแอนิเมชัน"}><MapIcon name={motion?"pause":"play"} size={17}/>{motion?"หยุดแอนิเมชัน":"เปิดแอนิเมชัน"}</button></nav>;
}
