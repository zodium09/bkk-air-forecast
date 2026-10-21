"use client";

import { useEffect, useId, useMemo, useState, type PointerEvent } from "react";
import type { WaterStation } from "../../lib/water-levels";
import type { WaterHistoryPayload, WaterHistoryPoint } from "../../lib/water-history-store";
import { thaiObservationTime } from "../../lib/observation-time";
import { comparisonTimes, comparisonTrack, readingAtCursor } from "../../lib/hydro/comparison";

export type ComparedStation = { id: string; basinName: string; station: WaterStation | null };
type Row = { id: string; points: WaterHistoryPoint[]; unavailable: boolean; error: boolean };

const value = (number: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 }).format(number);
const dateTime = (iso: string) => `${thaiObservationTime(iso)} น.`;

export default function HydroComparison({ stations, refresh, onRemove, candidates = [], onQuickAdd }: { stations: ComparedStation[]; refresh: number; onRemove: (id: string) => void; candidates?: { id: string; name: string; basinName: string }[]; onQuickAdd?: (ids: string[]) => void }) {
  const gradId = useId().replace(/:/g, "");
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
  const cursorX = Number.isFinite(cursor) && to > from ? 42 + Math.max(0, Math.min(1, (cursor - from) / Math.max(1, to - from))) * 516 : null;

  function scrubComparisonSvg(event: PointerEvent<SVGSVGElement>) {
    if (times.length < 2 || to <= from) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 600;
    const ratio = Math.max(0, Math.min(1, (svgX - 42) / 516));
    const targetTime = from + ratio * (to - from);
    let nearest = times[0];
    let bestDist = Infinity;
    for (const t of times) {
      const d = Math.abs(t - targetTime);
      if (d < bestDist) { bestDist = d; nearest = t; }
    }
    setCursorTime(nearest);
  }

  return <section className="hy-section hy-comparison" id="station-comparison" aria-labelledby="hy-comparison-title">
    <div className="hy-section-head"><div><span className="hy-eyebrow">03 / ประวัติหลายสถานี</span><h2 id="hy-comparison-title">เทียบช่วงเวลา ไม่เทียบความสูงข้ามสถานี</h2></div><p>เลือกสถานีจากรายการหรือแผนที่ แล้วกดเพิ่มในการเทียบที่รายละเอียดสถานี</p></div>
    <div className="hy-compare-toolbar"><div className="hy-compare-chips">{stations.map(item => <span key={item.id}>{item.station?.name ?? `สถานี ${item.id}`}<button type="button" onClick={() => onRemove(item.id)} aria-label={`เอา ${item.station?.name ?? item.id} ออกจากการเทียบ`}>×</button></span>)}</div><div className="hy-compare-hours" role="group" aria-label="ช่วงประวัติที่เทียบ">{([24, 72] as const).map(option => <button type="button" key={option} aria-pressed={hours === option} onClick={() => setHours(option)}>{option} ชม.</button>)}</div></div>
    {stations.length < 2 ? <div className="hy-empty hy-compare-empty">
      <p>เลือกอีก {2 - stations.length} สถานีเพื่อดูกราฟเวลาเดียวกัน เลือกได้สูงสุด 4 สถานี</p>
      {onQuickAdd && candidates.length >= 2 && <div className="hy-compare-quick">
        <span>หรือเลือกสถานีเด่นเพื่อเทียบทันที:</span>
        <button type="button" className="hy-outline-button" onClick={() => onQuickAdd(candidates.slice(0, 3).map(c => c.id))}>เทียบ {Math.min(3, candidates.length)} สถานีสำคัญอัตโนมัติ ⚡</button>
      </div>}
    </div> : <>
      {loading && <p className="hy-compare-note" role="status">กำลังอ่านประวัติของสถานีที่เลือก…</p>}
      {!loading && times.length > 0 && <div className="hy-compare-cursor">
        <label htmlFor="hy-compare-time"><span>เวลาอ้างอิงร่วม (ซิงก์ทุกกราฟ)</span> <strong>{dateTime(new Date(cursor).toISOString())}</strong></label>
        <div className="hy-compare-scrubber">
          <button type="button" className="hy-step-btn" disabled={currentIndex <= 0} onClick={() => setCursorTime(times[Math.max(0, currentIndex - 1)])} aria-label="เวลาก่อนหน้า">◀</button>
          <input id="hy-compare-time" type="range" min="0" max={Math.max(0, times.length - 1)} value={Math.max(0, currentIndex)} onChange={event => setCursorTime(times[Number(event.target.value)])} disabled={times.length < 2}/>
          <button type="button" className="hy-step-btn" disabled={currentIndex >= times.length - 1} onClick={() => setCursorTime(times[Math.min(times.length - 1, currentIndex + 1)])} aria-label="เวลาถัดไป">▶</button>
        </div>
        <small>เลื่อนแถบหรือลากเมาส์บนกราฟใดก็ได้เพื่อซิงก์เวลาเดียวกัน; ถ้าไม่มีค่าใน 60 นาทีก่อนจุดนี้จะแสดงว่าไม่มีค่าใกล้เวลานั้น</small>
      </div>}
      {!loading && <div className="hy-compare-grid">{stations.map((item, cardIdx) => {
        const row = rows.find(candidate => candidate.id === item.id);
        const track = comparisonTrack(row?.points ?? [], from, to);
        const reading = Number.isFinite(cursor) ? readingAtCursor(row?.points ?? [], cursor) : null;
        const unit = item.station?.datum === "msl" ? "เมตร รทก." : "เมตรจากศูนย์เกจ";
        const readingY = reading && track.min !== null && track.max !== null && track.max > track.min
          ? 12 + (track.max - reading.value) / (track.max - track.min) * 64
          : null;
        const readingX = reading && to > from
          ? 42 + (Date.parse(reading.observedAt) - from) / Math.max(1, to - from) * 516
          : null;
        return <article key={item.id} className="hy-compare-card"><div className="hy-compare-card-head"><div><h3>{item.station?.name ?? `สถานี ${item.id}`}</h3><p>{item.basinName} · {unit} · รหัส {item.id}</p></div><a href={`/stations/${encodeURIComponent(item.id)}`}>เปิดสถานี ↗</a></div>
          {!item.station ? <div className="hy-empty">สถานีนี้ไม่มีใน feed ล่าสุด ประวัติเดิมอาจยังอยู่ แต่ยังไม่ทราบ datum ที่ใช้เปิดกราฟ</div> : row?.error || row?.unavailable ? <div className="hy-empty">คลังประวัติยังไม่พร้อมสำหรับสถานีนี้</div> : !row?.points.length ? <div className="hy-empty">ยังไม่มีค่าที่สะสมไว้ในช่วง {hours} ชั่วโมง ไม่เติมเส้นย้อนหลัง</div> : <>
            <div className="hy-compare-reading">{reading ? <><strong>{value(reading.value)}</strong><span>{unit} · ตรวจวัด {dateTime(reading.observedAt)}</span></> : <span>ไม่มีค่าใกล้เวลาอ้างอิงร่วม</span>}</div>
            <svg className="hy-compare-svg" viewBox="0 0 600 94" role="img" aria-label={`ประวัติระดับน้ำ ${item.station.name} ${row.points.length} ค่า หน่วย ${unit}`} onPointerMove={event => { if (event.pointerType === "mouse" || event.buttons > 0) scrubComparisonSvg(event); }} onClick={scrubComparisonSvg}>
              <defs>
                <linearGradient id={`cmp-grad-${gradId}-${cardIdx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.22"/>
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.01"/>
                </linearGradient>
              </defs>
              <line x1="42" y1="82" x2="558" y2="82"/><line x1="42" y1="12" x2="42" y2="82"/>
              {track.paths.map((path, index) => {
                const coords = path.replace(/^M/, "").split(" L");
                const firstX = coords[0]?.split(",")[0];
                const lastX = coords.at(-1)?.split(",")[0];
                return <g key={index}>
                  {coords.length > 1 && firstX && lastX && <path d={`${path} L${lastX},82 L${firstX},82 Z`} fill={`url(#cmp-grad-${gradId}-${cardIdx})`} stroke="none"/>}
                  <path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
                </g>;
              })}
              {track.dots.map((dot, index) => <circle key={index} cx={dot.x} cy={dot.y} r="3.5" fill="currentColor"/>)}
              {cursorX !== null && <line x1={cursorX} y1="10" x2={cursorX} y2="82" className="hy-compare-cursor-line"/>}
              {readingX !== null && readingY !== null && <>
                <circle cx={readingX} cy={readingY} r="7.5" fill="currentColor" fillOpacity="0.2"/>
                <circle cx={readingX} cy={readingY} r="4.5" fill="currentColor" stroke="var(--hy-surface,#fff)" strokeWidth="2"/>
              </>}
            </svg>
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
