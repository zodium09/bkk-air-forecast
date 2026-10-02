"use client";
import { useEffect, useMemo, useReducer, useState } from "react";
import { buildImportantEvents, eventWatchReducer, initialEventWatch, type EventTopic, type ImportantEvent } from "../../lib/important-events";
import type { RainPosition, NearbyRainPayload } from "../../lib/rain-nearby";
import type { AirObservationPayload } from "../../lib/air-observations";
import type { RoadFloodPayload } from "../../lib/road-floods";
import type { WaterPayload } from "../../lib/water-levels";
import type { MapDataset } from "../../lib/map-intelligence";
import { getRegion, type RegionId } from "../../lib/provinces";
import { thaiObservationTime } from "../../lib/observation-time";
import type { LiveResource } from "./use-live-resource";
import { MapIcon } from "./map-ui";
import "./important-events.css";

const topicIcon = { road: "pin", water: "water", rain: "radar", air: "air", heat: "heat" } as const;
const topicTitle: Record<EventTopic, string> = { road: "น้ำบนถนน", water: "คลอง/แม่น้ำ", rain: "ฝนใกล้พื้นที่", air: "ฝุ่น PM2.5", heat: "ความร้อน" };
function EventRow({ event }: { event: ImportantEvent }) {
  return <li className={`ie-event ie-${event.topic} ie-priority-${event.priority}`}>
    <a href={event.href}><span className="ie-event-icon"><MapIcon name={topicIcon[event.topic]} size={21}/></span><div className="ie-event-copy"><div className="ie-event-tags"><span>{topicTitle[event.topic]}</span><b>{event.kind}</b>{event.priority === 3 && <em>ตรวจข้อมูลนี้ก่อน</em>}</div><h3>{event.title}</h3><p>{event.detail}</p><small>{event.source}{event.observedAt && ` · ${event.kind === "Nowcast" ? "ภาพฐาน" : event.kind === "พยากรณ์" ? "โหลดพยากรณ์" : "ค่าล่าสุดในกลุ่ม"} ${thaiObservationTime(event.observedAt)} น.`}</small></div><MapIcon name="arrow" size={18}/></a>
  </li>;
}
export default function ImportantEvents({ region, position, roads, water, air, rain, heat, heatLoading, heatError, clock, onRefresh }: {
  region: RegionId; position: RainPosition | null; roads: LiveResource<RoadFloodPayload>; water: LiveResource<WaterPayload>;
  air: LiveResource<AirObservationPayload>; rain: LiveResource<NearbyRainPayload>; heat: MapDataset | null;
  heatLoading: boolean; heatError: string; clock: number; onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [watch, dispatch] = useReducer(eventWatchReducer, initialEventWatch);
  const lat = position?.lat, lng = position?.lng;
  const scope = `${region}:${lat ?? "all"}:${lng ?? "all"}`;
  const result = useMemo(() => buildImportantEvents({ region, place: lat === undefined || lng === undefined ? null : { lat, lng }, roads: roads.data, water: water.data, air: air.data, rain: rain.data, heat, now: clock }), [region, lat, lng, roads.data, water.data, air.data, rain.data, heat, clock]);
  const { events, coverage } = result;
  useEffect(() => { dispatch({ type: "sync", scope, events }); }, [scope, events]);
  const pending = watch.enabled && watch.scope === scope ? events.filter(e => watch.pending.includes(e.id)) : [];
  const resources = { road: roads, water, air, rain, heat: { loading: heatLoading, error: heatError } };
  const loading = Object.values(resources).some(r => r.loading);
  const refreshing = [roads, water, air, rain].some(r => r.refreshing);
  const ready = coverage.filter(c => c.used > 0).length;
  const errors = coverage.filter(c => resources[c.topic].error).map(c => c.title);
  return <section className="ie-section" id="important-events" tabIndex={-1} aria-labelledby="important-events-title">
    <div className="ie-heading"><div><div className="ie-current"><i className={ready ? "is-ready" : ""} aria-hidden="true"/>{loading ? "กำลังตรวจข้อมูลล่าสุด" : "สรุปจากข้อมูลปัจจุบัน"}</div><h2 id="important-events-title">เรื่องสำคัญตอนนี้</h2><p>{position ? `รอบ ${position.label ?? "จุดที่เลือก"} · ระยะ 8 กม.` : `${getRegion(region).shortNameTh} · จุดที่มีข้อมูล`}</p></div><div className="ie-actions"><button className={watch.enabled ? "ie-watch is-on" : "ie-watch"} aria-pressed={watch.enabled} onClick={() => dispatch({ type: "toggle", scope, events })}><MapIcon name="bell" size={18}/>{watch.enabled ? "กำลังแจ้งเตือนในหน้านี้" : "เปิดการแจ้งเตือน"}<span>{watch.enabled ? "เปิด" : "ปิด"}</span></button><button aria-label="อัปเดตสรุปเรื่องสำคัญ" disabled={loading || refreshing} onClick={onRefresh}><MapIcon name="refresh" size={18}/></button></div></div>
    {pending.length > 0 && <aside className="ie-alert" role="alert"><MapIcon name="bell" size={22}/><div><b>มีเรื่องที่ควรติดตาม {pending.length} รายการ</b><p>{pending.map(e => e.title).join(" · ")}</p><a href={pending[0].href}>ดูรายละเอียดที่เกี่ยวข้อง<MapIcon name="arrow" size={16}/></a></div><button aria-label="รับทราบและปิดแจ้งเตือนเรื่องสำคัญ" onClick={() => dispatch({ type: "dismiss" })}><MapIcon name="close" size={18}/></button></aside>}
    <div className="ie-layout"><div className="ie-stories"><ul aria-label="รายการเรื่องสำคัญล่าสุด">{events.slice(0, expanded ? events.length : 3).map(event => <EventRow key={event.id} event={event}/>)}</ul>{!events.length && <div className="ie-empty" role="status"><MapIcon name={loading ? "refresh" : "info"} size={24}/><div><h3>{loading ? "กำลังรวบรวมเรื่องที่ควรติดตาม…" : ready ? "ยังไม่พบรายการเข้าเกณฑ์ในข้อมูลที่ใช้ได้" : "ยังมีข้อมูลไม่พอสำหรับสรุป"}</h3><p>{loading ? "แต่ละแหล่งข้อมูลจะปรากฏเมื่ออ่านค่าได้" : "จุดที่ไม่มีข้อมูลหรือไม่มีเกณฑ์ยังสรุปไม่ได้ เลือกพื้นที่และตรวจรายละเอียดก่อนเดินทาง"}</p></div></div>}{events.length > 3 && <button className="ie-expand" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "ย่อรายการ" : `ดูอีก ${events.length - 3} เรื่อง`}<MapIcon name="chevron" size={16}/></button>}</div>
    <div className="ie-coverage" aria-label="ความพร้อมของข้อมูลสรุป"><div className="ie-coverage-title"><b>เช็กครบ 5 เรื่อง</b><span>สรุปได้ {ready}/5</span></div>{coverage.map(c => <a key={c.topic} href={c.href}><MapIcon name={topicIcon[c.topic]} size={18}/><div><b>{c.title}</b><p>{resources[c.topic].loading ? "กำลังอ่านข้อมูล…" : c.summary}</p><small>{c.used ? `${c.used}/${c.total} ${c.topic === "heat" ? "จุดแบบจำลอง" : c.topic === "rain" ? "ผลวิเคราะห์" : "รายการ"}ใช้สรุปได้` : "ยังไม่รวมเป็นสถานการณ์ปกติ"}</small></div><MapIcon name="arrow" size={14}/></a>)}</div></div>
    <div className="ie-footer"><p>อัปเดตทุก 5 นาทีขณะเปิดหน้า · แจ้งเมื่อมีเรื่องใหม่ จำนวนเพิ่ม หรือระดับสูงขึ้น · สรุปนี้ไม่ใช่ประกาศเตือนภัย</p><a href="#my-area"><MapIcon name="pin" size={15}/>{position ? "เปลี่ยนพื้นที่ที่ติดตาม" : "ดูพื้นที่ของฉัน"}</a></div>
    <details className="ie-method"><summary>เกณฑ์สรุปและความครบของข้อมูล<MapIcon name="chevron" size={15}/></summary><p>ถนนใช้สถานะจาก กทม. ภายใน 30 นาที น้ำใช้เกณฑ์ความจุหรือตลิ่งจาก ThaiWater ภายใน 60 นาที ฝุ่นใช้ระดับส้ม/แดงที่ต้นทางส่งพร้อมค่าภายใน 90 นาที โดยไม่เทียบค่าที่ไม่ทราบช่วงเฉลี่ยกับเกณฑ์รายวัน</p><p>ฝนใช้ผลวิเคราะห์ตำแหน่งจาก TMD RadarGIS ที่ผ่านการตรวจความใหม่ ความร้อนใช้ดัชนีความร้อนตั้งแต่ 42°C ของชั่วโมง/ช่วงปัจจุบันจากแบบจำลอง ไม่ใช้ยอดสูงสุดทั้งวันแทนค่าตอนนี้</p><p>เวลาในแต่ละรายการเป็นค่าล่าสุดของกลุ่ม จุดอื่นอาจวัดคนละเวลา จำนวนเป็นรายการจุดข้อมูล ไม่ใช่จำนวนเขตหรือขอบเขตผลกระทบ สรุปบนสุดคงเวลาปัจจุบันเมื่อเลือกวันพยากรณ์ด้านล่าง การแจ้งเตือนแสดงเฉพาะในหน้านี้</p>{errors.length > 0 && <p className="ie-error" role="status">โหลดรอบใหม่ไม่ได้: {errors.join(" · ")} · ค่าที่คงแสดงต้องยังไม่เกินอายุที่ใช้ได้</p>}</details>
  </section>;
}
