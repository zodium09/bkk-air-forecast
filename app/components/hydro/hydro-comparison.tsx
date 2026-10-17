"use client";

import { useEffect, useMemo, useState } from "react";
import type { WaterStation } from "../../lib/water-levels";
import type { WaterHistoryPayload, WaterHistoryPoint } from "../../lib/water-history-store";
import { thaiObservationTime } from "../../lib/observation-time";
import { comparisonTimes, comparisonTrack, readingAtCursor } from "../../lib/hydro/comparison";

export type ComparedStation = { id: string; basinName: string; station: WaterStation | null };
type Row = { id: string; points: WaterHistoryPoint[]; unavailable: boolean; error: boolean };

const value = (number: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 }).format(number);
const dateTime = (iso: string) => `${thaiObservationTime(iso)} น.`;

export default function HydroComparison({ stations, refresh, onRemove }: { stations: ComparedStation[]; refresh: number; onRemove: (id: string) => void }) {
  const [hours, setHours] = useState<24 | 72>(24);
  const [cursorTime, setCursorTime] = useState<number | null>(null);
  const [result, setResult] = useState<{ key: string; rows: Row[]; to: number } | null>(null);
  const signature = stations.map(item => `${item.id}:${item.station?.datum ?? "missing"}`).join("|");
  const requestKey = `${signature}:${hours}:${refresh}`;
  const loading = stations.length >= 2 && result?.key !== requestKey;

  useEffect(() => {
    if (stations.length < 2) return;
    const controller = new AbortController();
    let active = true;
    const to = Date.now();
    Promise.all(stations.map(async item => {
      if (!item.station) return { id: item.id, points: [], unavailable: true, error: false };
      const query = new URLSearchParams({ station: item.id, datum: item.station.datum, hours: String(hours) });
      try {
        const response = await fetch(`/api/water-history?${query}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("history unavailable");
        const data = await response.json() as WaterHistoryPayload;
        return { id: item.id, points: data.points, unavailable: data.storage === "unavailable", error: false };
      } catch { return { id: item.id, points: [], unavailable: false, error: true }; }
    })).then(rows => { if (active) setResult({ key: requestKey, rows, to }); });
    return () => { active = false; controller.abort(); };
    // Station identities and datum are the request contract; names/current values do not refetch history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const rows = useMemo(() => result?.key === requestKey ? result.rows : [], [result, requestKey]);
  const times = useMemo(() => comparisonTimes(rows.map(row => row.points)), [rows]);
  const requestedIndex = cursorTime === null ? -1 : times.indexOf(cursorTime);
  const currentIndex = requestedIndex < 0 ? times.length - 1 : requestedIndex;
  const cursor = times[currentIndex];
  const to = result?.key === requestKey ? result.to : 0;
  const from = to - hours * 3600000;

  return <section className="hy-section hy-comparison" id="station-comparison" aria-labelledby="hy-comparison-title">
    <div className="hy-section-head"><div><span className="hy-eyebrow">03 / ประวัติหลายสถานี</span><h2 id="hy-comparison-title">เทียบช่วงเวลา ไม่เทียบความสูงข้ามสถานี</h2></div><p>เลือกสถานีจากรายการหรือแผนที่ แล้วกดเพิ่มในการเทียบที่รายละเอียดสถานี</p></div>
    <div className="hy-compare-toolbar"><div className="hy-compare-chips">{stations.map(item => <span key={item.id}>{item.station?.name ?? `สถานี ${item.id}`}<button type="button" onClick={() => onRemove(item.id)} aria-label={`เอา ${item.station?.name ?? item.id} ออกจากการเทียบ`}>×</button></span>)}</div><div className="hy-compare-hours" role="group" aria-label="ช่วงประวัติที่เทียบ">{([24, 72] as const).map(option => <button type="button" key={option} aria-pressed={hours === option} onClick={() => setHours(option)}>{option} ชม.</button>)}</div></div>
    {stations.length < 2 ? <div className="hy-empty">เลือกอีก {2 - stations.length} สถานีเพื่อดูกราฟเวลาเดียวกัน เลือกได้สูงสุด 4 สถานี</div> : <>
      {loading && <p className="hy-compare-note" role="status">กำลังอ่านประวัติของสถานีที่เลือก…</p>}
      {!loading && times.length > 0 && <div className="hy-compare-cursor"><label htmlFor="hy-compare-time">เวลาอ้างอิงร่วม <strong>{dateTime(new Date(cursor).toISOString())}</strong></label><input id="hy-compare-time" type="range" min="0" max={Math.max(0, times.length - 1)} value={Math.max(0, currentIndex)} onChange={event => setCursorTime(times[Number(event.target.value)])} disabled={times.length < 2}/><small>เลื่อนไปตามเวลาที่มีค่าจริง; ถ้าไม่มีค่าใน 60 นาทีก่อนจุดนี้จะแสดงว่าไม่มีค่าใกล้เวลานั้น</small></div>}
      {!loading && <div className="hy-compare-grid">{stations.map(item => {
        const row = rows.find(candidate => candidate.id === item.id);
        const track = comparisonTrack(row?.points ?? [], from, to);
        const reading = Number.isFinite(cursor) ? readingAtCursor(row?.points ?? [], cursor) : null;
        const unit = item.station?.datum === "msl" ? "เมตร รทก." : "เมตรจากศูนย์เกจ";
        return <article key={item.id} className="hy-compare-card"><div className="hy-compare-card-head"><div><h3>{item.station?.name ?? `สถานี ${item.id}`}</h3><p>{item.basinName} · {unit} · รหัส {item.id}</p></div><a href={`/stations/${encodeURIComponent(item.id)}`}>เปิดสถานี ↗</a></div>
          {!item.station ? <div className="hy-empty">สถานีนี้ไม่มีใน feed ล่าสุด ประวัติเดิมอาจยังอยู่ แต่ยังไม่ทราบ datum ที่ใช้เปิดกราฟ</div> : row?.error || row?.unavailable ? <div className="hy-empty">คลังประวัติยังไม่พร้อมสำหรับสถานีนี้</div> : !row?.points.length ? <div className="hy-empty">ยังไม่มีค่าที่สะสมไว้ในช่วง {hours} ชั่วโมง ไม่เติมเส้นย้อนหลัง</div> : <>
            <div className="hy-compare-reading">{reading ? <><strong>{value(reading.value)}</strong><span>{unit} · ตรวจวัด {dateTime(reading.observedAt)}</span></> : <span>ไม่มีค่าใกล้เวลาอ้างอิงร่วม</span>}</div>
            <svg viewBox="0 0 600 94" role="img" aria-label={`ประวัติระดับน้ำ ${item.station.name} ${row.points.length} ค่า หน่วย ${unit}`}><line x1="42" y1="82" x2="558" y2="82"/><line x1="42" y1="12" x2="42" y2="82"/>{track.paths.map((path, index) => <path key={index} d={path} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>)}{track.dots.map((dot, index) => <circle key={index} cx={dot.x} cy={dot.y} r="4" fill="currentColor"/>)}</svg>
            <div className="hy-compare-axis"><span>{dateTime(new Date(from).toISOString())}</span><span>{dateTime(new Date(to).toISOString())}</span></div>
            <p className="hy-compare-scale">{row.points.length === 1 ? "มีค่าตรวจวัดสะสมเพียง 1 เวลา ยังบอกแนวโน้มไม่ได้ · " : ""}แกนตั้งเฉพาะสถานี: {track.min === null ? "—" : value(track.min)} ถึง {track.max === null ? "—" : value(track.max)} {unit} · เส้นขาดเมื่อค่าห่างเกิน 1 ชม.</p>
            <details><summary>ตารางค่าตรวจวัดทั้งหมด {row.points.length} เวลา</summary><div className="hy-compare-table"><table><thead><tr><th>เวลาตรวจวัด</th><th>{unit}</th></tr></thead><tbody>{row.points.map(point => <tr key={point.observedAt}><th scope="row">{dateTime(point.observedAt)}</th><td>{value(point.value)}</td></tr>)}</tbody></table></div></details>
          </>}
        </article>;
      })}</div>}
      <p className="hy-compare-note">เส้นแต่ละสถานีใช้แกนตั้งของตัวเองและ datum ที่ต้นทางระบุ ห้ามอ่านความสูงของเส้นหรือระดับ รทก. ต่างสถานีเป็นลำดับความเสี่ยงหรือเวลาน้ำเดินทาง</p>
    </>}
  </section>;
}
