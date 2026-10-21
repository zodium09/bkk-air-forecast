"use client";

import { useId, useState, type PointerEvent } from "react";
import { useLiveResource, useRefreshPulse } from "../intelligence/use-live-resource";
import { bangkokDateKey } from "../../lib/forecast/timestamps";
import { thaiObservationTime } from "../../lib/observation-time";
import { tideDayExtremes, tideStations, tideTime, type TidePayload } from "../../lib/tides";

const number = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });

export default function HydroTideContext({ refresh }: { refresh: number }) {
  const gradId = useId().replace(/:/g, "");
  const [stationId, setStationId] = useState("phra-chul");
  const [dayIndex, setDayIndex] = useState(0);
  const [selectedHour, setSelectedHour] = useState(12);
  const { clock } = useRefreshPulse(30 * 60_000);
  const today = bangkokDateKey(clock);
  const resource = useLiveResource<TidePayload>(`/api/tide-outlook?station=${stationId}&date=${today}`, refresh, 30 * 60_000);
  const data = resource.data?.station.id === stationId && resource.data.dates[0] === today ? resource.data : null;
  const date = data?.dates[dayIndex];
  const extremes = date ? tideDayExtremes(data!.points, date) : null;
  const station = tideStations.find(item => item.id === stationId);

  const hourly = date && data ? Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    metres: data.points.find(p => p.at === tideTime(date, h))?.metres ?? null,
  })) : [];
  const validValues = hourly.map(h => h.metres).filter((v): v is number => v !== null);
  const minTide = validValues.length ? Math.min(...validValues) - 0.15 : 0;
  const maxTide = validValues.length ? Math.max(...validValues) + 0.15 : 1;
  const xOf = (h: number) => 28 + (h / 23) * 544;
  const yOf = (v: number) => 112 - ((v - minTide) / Math.max(0.1, maxTide - minTide)) * 88;
  const coords = hourly.filter((h): h is { hour: number; metres: number } => h.metres !== null).map(h => ({ ...h, x: xOf(h.hour), y: yOf(h.metres) }));
  const linePath = coords.length > 1 ? `M${coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" L")}` : "";
  const areaPath = coords.length > 1 ? `${linePath} L${coords.at(-1)!.x.toFixed(1)},118 L${coords[0].x.toFixed(1)},118 Z` : "";
  const activePoint = coords.find(c => c.hour === selectedHour) ?? coords[0] ?? null;

  function scrubTideSvg(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 600;
    const h = Math.max(0, Math.min(23, Math.round(((svgX - 28) / 544) * 23)));
    setSelectedHour(h);
  }

  return <section className="hy-section hy-tide" aria-labelledby="hy-tide-title"><div className="hy-section-head"><div><span className="hy-eyebrow">บริบทเฉพาะเจ้าพระยาตอนล่าง</span><h2 id="hy-tide-title">น้ำขึ้นน้ำลงทำนายที่สถานีปากแม่น้ำ</h2></div><p>ตารางทำนาย · ไม่ใช่ระดับน้ำตรวจวัดหรือพยากรณ์น้ำท่วม</p></div>
    <div className="hy-tide-panel"><div><p>เลือกระดับอ้างอิงที่ปากแม่น้ำหรือบริเวณใกล้เคียง เวลาและระดับนี้ใช้กับสถานีที่เลือกเท่านั้น ไม่ใช้แทนปิง วัง ยม น่าน ป่าสัก หรือสถานีน้ำในแผนที่</p><label className="hy-weather-select">สถานีน้ำทำนาย<select value={stationId} onChange={event => { setStationId(event.target.value); setDayIndex(0); }}>{tideStations.map(item => <option key={item.id} value={item.id}>{item.name} · {item.province}</option>)}</select></label><a href="/water#tide-analysis">เปิดตารางและกราฟรายชั่วโมง →</a></div><div>{resource.loading && !resource.data ? <p className="hy-weather-empty">กำลังอ่านตารางน้ำ…</p> : !data || data.status !== "available" || !extremes ? <p className="hy-weather-empty">ตารางน้ำสำหรับ {station?.name} ยังไม่พร้อม ไม่แทนด้วยค่าระดับน้ำตรวจวัด</p> : <>
      <div className="hy-weather-days" role="group" aria-label="เลือกวันน้ำทำนาย">{data.dates.slice(0, 3).map((item, index) => <button key={item} type="button" aria-pressed={index === dayIndex} onClick={() => setDayIndex(index)}>{item}</button>)}</div>
      <div className="hy-tide-values">
        <div><small>สูงสุดตามตารางรายชั่วโมง</small><strong>{number.format(extremes.max)} ม.</strong><span>{extremes.high.map(thaiObservationTime).join(" / ")}</span></div>
        <div><small>ต่ำสุดตามตารางรายชั่วโมง</small><strong>{number.format(extremes.min)} ม.</strong><span>{extremes.low.map(thaiObservationTime).join(" / ")}</span></div>
      </div>
      {coords.length > 1 && <div className="hy-tide-interactive">
        <div className="hy-tide-readout">
          <span>เวลาที่เลือก <b>{String(selectedHour).padStart(2, "0")}:00 น.</b></span>
          <strong>{activePoint ? `${number.format(activePoint.metres)} ม. รทก.` : "—"}</strong>
        </div>
        <svg className="hy-tide-svg" viewBox="0 0 600 138" role="img" aria-label={`กราฟน้ำทำนาย 24 ชั่วโมง ${data.station.name} วันที่ ${date}`} onPointerMove={event => { if (event.pointerType === "mouse" || event.buttons > 0) scrubTideSvg(event); }} onClick={scrubTideSvg}>
          <defs>
            <linearGradient id={`tide-grad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--hy-blue,#216eaa)" stopOpacity="0.28"/>
              <stop offset="100%" stopColor="var(--hy-blue,#216eaa)" stopOpacity="0.02"/>
            </linearGradient>
          </defs>
          <line x1="28" y1="118" x2="572" y2="118" className="hy-tide-grid"/>
          <line x1="28" y1="24" x2="572" y2="24" className="hy-tide-grid"/>
          {areaPath && <path d={areaPath} fill={`url(#tide-grad-${gradId})`}/>}
          {linePath && <path d={linePath} fill="none" stroke="var(--hy-blue,#216eaa)" strokeWidth="2.8" strokeLinecap="round"/>}
          {coords.map(c => <circle key={c.hour} cx={c.x} cy={c.y} r={c.hour === selectedHour ? 5 : 2.6} fill="var(--hy-blue,#216eaa)"/>)}
          {activePoint && <>
            <line x1={activePoint.x} y1="16" x2={activePoint.x} y2="118" className="hy-tide-cursor"/>
            <circle cx={activePoint.x} cy={activePoint.y} r="8.5" fill="var(--hy-blue,#216eaa)" fillOpacity="0.18"/>
            <circle cx={activePoint.x} cy={activePoint.y} r="4.8" fill="var(--hy-blue,#216eaa)" stroke="var(--hy-surface,#fff)" strokeWidth="2"/>
          </>}
          {[0, 6, 12, 18, 23].map(h => <text key={h} x={xOf(h)} y="133" textAnchor="middle">{String(h).padStart(2, "0")}:00</text>)}
        </svg>
        <input className="hy-tide-slider" type="range" min="0" max="23" value={selectedHour} aria-label="เลื่อนชั่วโมงดูระดับน้ำทำนาย" onChange={event => setSelectedHour(Number(event.target.value))}/>
      </div>}
    </>}<p className="hy-weather-provenance">{data ? `${data.station.name} · ม. เหนือระดับทะเลปานกลาง · ตารางปี ${data.tableYear + 543} · ดึงข้อมูล ${thaiObservationTime(data.fetchedAt)}` : "ยังไม่มีข้อมูลตารางที่ใช้ได้"}{resource.error && ` · ${resource.error}`}</p><a className="hy-weather-source" href={data?.sourceUrl ?? "https://hydro.navy.mi.th/waterlaveltable"} target="_blank" rel="noreferrer">ตรวจตารางกรมอุทกศาสตร์ ↗</a></div></div>
  </section>;
}
