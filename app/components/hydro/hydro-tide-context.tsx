"use client";

import { useState } from "react";
import { useLiveResource, useRefreshPulse } from "../intelligence/use-live-resource";
import { bangkokDateKey } from "../../lib/forecast/timestamps";
import { thaiObservationTime } from "../../lib/observation-time";
import { tideDayExtremes, tideStations, type TidePayload } from "../../lib/tides";

const number = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 });

export default function HydroTideContext({ refresh }: { refresh: number }) {
  const [stationId, setStationId] = useState("phra-chul");
  const [dayIndex, setDayIndex] = useState(0);
  const { clock } = useRefreshPulse(30 * 60_000);
  const today = bangkokDateKey(clock);
  const resource = useLiveResource<TidePayload>(`/api/tide-outlook?station=${stationId}&date=${today}`, refresh, 30 * 60_000);
  const data = resource.data?.station.id === stationId && resource.data.dates[0] === today ? resource.data : null;
  const date = data?.dates[dayIndex];
  const extremes = date ? tideDayExtremes(data!.points, date) : null;
  const station = tideStations.find(item => item.id === stationId);

  return <section className="hy-section hy-tide" aria-labelledby="hy-tide-title"><div className="hy-section-head"><div><span className="hy-eyebrow">บริบทเฉพาะเจ้าพระยาตอนล่าง</span><h2 id="hy-tide-title">น้ำขึ้นน้ำลงทำนายที่สถานีปากแม่น้ำ</h2></div><p>ตารางทำนาย · ไม่ใช่ระดับน้ำตรวจวัดหรือพยากรณ์น้ำท่วม</p></div>
    <div className="hy-tide-panel"><div><p>เลือกระดับอ้างอิงที่ปากแม่น้ำหรือบริเวณใกล้เคียง เวลาและระดับนี้ใช้กับสถานีที่เลือกเท่านั้น ไม่ใช้แทนปิง วัง ยม น่าน ป่าสัก หรือสถานีน้ำในแผนที่</p><label className="hy-weather-select">สถานีน้ำทำนาย<select value={stationId} onChange={event => { setStationId(event.target.value); setDayIndex(0); }}>{tideStations.map(item => <option key={item.id} value={item.id}>{item.name} · {item.province}</option>)}</select></label><a href="/water#tide-analysis">เปิดตารางและกราฟรายชั่วโมง →</a></div><div>{resource.loading && !resource.data ? <p className="hy-weather-empty">กำลังอ่านตารางน้ำ…</p> : !data || data.status !== "available" || !extremes ? <p className="hy-weather-empty">ตารางน้ำสำหรับ {station?.name} ยังไม่พร้อม ไม่แทนด้วยค่าระดับน้ำตรวจวัด</p> : <><div className="hy-weather-days" role="group" aria-label="เลือกวันน้ำทำนาย">{data.dates.slice(0, 3).map((item, index) => <button key={item} type="button" aria-pressed={index === dayIndex} onClick={() => setDayIndex(index)}>{item}</button>)}</div><div className="hy-tide-values"><div><small>สูงสุดตามตารางรายชั่วโมง</small><strong>{number.format(extremes.max)} ม.</strong><span>{extremes.high.map(thaiObservationTime).join(" / ")}</span></div><div><small>ต่ำสุดตามตารางรายชั่วโมง</small><strong>{number.format(extremes.min)} ม.</strong><span>{extremes.low.map(thaiObservationTime).join(" / ")}</span></div></div></>}<p className="hy-weather-provenance">{data ? `${data.station.name} · ม. เหนือระดับทะเลปานกลาง · ตารางปี ${data.tableYear + 543} · ดึงข้อมูล ${thaiObservationTime(data.fetchedAt)}` : "ยังไม่มีข้อมูลตารางที่ใช้ได้"}{resource.error && ` · ${resource.error}`}</p><a className="hy-weather-source" href={data?.sourceUrl ?? "https://hydro.navy.mi.th/waterlaveltable"} target="_blank" rel="noreferrer">ตรวจตารางกรมอุทกศาสตร์ ↗</a></div></div>
  </section>;
}
