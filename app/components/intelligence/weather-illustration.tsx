"use client";
import { useState } from "react";
import Image from "next/image";
import { MapIcon } from "./map-ui";
import "./rain-radar.css";

const topics=[{id:"rain",label:"ฝน",target:"chapter-rain",hint:"ดูเรดาร์และฝนใกล้พื้นที่ของคุณ"},{id:"air",label:"ฝุ่น PM2.5",target:"chapter-air",hint:"ดูค่าตรวจวัดและแนวโน้มฝุ่น"},{id:"heat",label:"ความร้อน",target:"chapter-heat",hint:"เลือกช่วงเวลาทำกิจกรรมกลางแจ้ง"}] as const;
export default function WeatherIllustration() {
  const [active,setActive]=useState<(typeof topics)[number]["id"]>("rain");
  const topic=topics.find(t=>t.id===active)!;
  return <div className={`wi-scene wi-${active}`}>
    <div className="wi-image-wrap"><Image unoptimized className="wi-city" src="/illustrations/bangkok-weather.webp" alt="ภาพประกอบเมืองกรุงเทพฯ ริมคลอง ท่ามกลางเมฆและแสงอาทิตย์" width={1200} height={800} preload/><span className="wi-image-note">ภาพประกอบ</span></div>
    <div className="wi-topic-switch" role="group" aria-label="เลือกเรื่องที่จะสำรวจ">{topics.map(t=><button key={t.id} aria-pressed={active===t.id} onClick={()=>setActive(t.id)}><MapIcon name={t.id} size={17}/>{t.label}</button>)}</div>
    <a className="wi-explore" href={`#${topic.target}`}><span key={topic.id}>{topic.hint}</span><MapIcon name="arrow" size={18}/></a>
  </div>;
}
