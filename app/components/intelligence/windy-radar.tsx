"use client";

import { useState } from "react";
import { windyRadarLinks } from "../../lib/detail-visuals";
import { getRegion, type RegionId } from "../../lib/provinces";
import { MapIcon } from "./map-ui";
import "./windy-radar.css";

export default function WindyRadar({ region, position }: { region: RegionId; position: { lat: number; lng: number } | null }) {
  const [reload, setReload] = useState(0);
  const links = windyRadarLinks(region, position);
  return <section className="wr-section" aria-labelledby="windy-radar-title">
    <header className="wr-heading"><div><p className="wr-kicker"><MapIcon name="radar" size={17}/>แผนที่เรดาร์อีกมุมมอง</p><h3 id="windy-radar-title">เรดาร์ฝน Windy</h3><p>{position ? "บริเวณใกล้พื้นที่ที่เลือก" : getRegion(region).shortNameTh} · ซูมแผนที่และกดเล่นที่แถบเวลาของ Windy เพื่อดูกลุ่มฝนเคลื่อนตัว</p></div><div className="wr-actions"><button className="rb-button" onClick={() => setReload(value => value + 1)}><MapIcon name="refresh" size={16}/>โหลด Windy ใหม่</button><a href={links.full} target="_blank" rel="noreferrer">เปิดใน Windy<MapIcon name="arrow" size={16}/></a></div></header>
    <iframe key={`${links.embed}:${reload}`} src={links.embed} title="เรดาร์ฝน Windy พร้อมแถบเวลาและการซูมแผนที่" width="100%" height="520" loading="lazy" referrerPolicy="no-referrer" allowFullScreen />
    <p className="wr-note">ที่มา: Windy · อ่านเวลาและหน่วยจากแถบสีบนแผนที่ · แผนที่เริ่มที่บริเวณโดยประมาณของพื้นที่ที่เลือก · ภาพเรดาร์เป็นอีกแหล่งข้อมูล ส่วนการวิเคราะห์ฝนในระยะ 8 กม. ด้านบนใช้ TMD RadarGIS</p>
    <p className="wr-note">หากแผนที่ไม่โหลด ให้กดโหลดใหม่หรือเปิดใน Windy · พื้นที่สีใสอาจไม่มีฝนหรือไม่มีข้อมูล</p>
  </section>;
}
