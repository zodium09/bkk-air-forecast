"use client";
import { useEffect, useRef } from "react";
import { indexForDate, timelineIndices, timelineKeyIndex } from "../../lib/dashboard-controls";
import { relativeDay, type DataMode, type MapDataset } from "../../lib/map-intelligence";
import { MapIcon } from "./map-ui";

export default function MapTimeControl({ data, index, onChange, playing, onPlay, reducedMotion, mode }: {
  data: MapDataset | null; index: number; onChange: (index: number) => void;
  playing: boolean; onPlay: () => void; reducedMotion: boolean; mode: DataMode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const steps = data?.steps ?? [];
  const current = steps[index];
  const dates = [...new Set(steps.map((s) => s.date).filter(Boolean))];
  const indices = timelineIndices(steps, index);
  const position = Math.max(0, indices.indexOf(index));
  const windowMode = current?.window != null && current.cadence !== "hour";
  const hasHourly = steps.some((s) => s.date === current?.date && s.cadence === "hour");
  const periods = steps.flatMap((s, i) => s.date === current?.date && (s.window === null || (windowMode || !hasHourly ? s.window !== null && s.cadence !== "hour" : s.cadence === "hour")) ? [i] : []);
  const observed = mode === "observation";
  useEffect(() => {
    root.current?.querySelector<HTMLElement>('.mf-periods [aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    root.current?.querySelector<HTMLElement>('.mf-dates [aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  }, [index]);
  return <div ref={root} className="mf-time" aria-label="ควบคุมวันและเวลาบนแผนที่">
    <div className="mf-date-row">
      <div className="mf-dates" role="group" aria-label="กรองวันที่">
        {dates.map((date) => <button key={date} aria-pressed={date === current?.date} onClick={() => onChange(indexForDate(steps, index, date))}>{relativeDay(date)}</button>)}
        {!dates.length && <span>{observed ? "ตรวจวัดล่าสุด" : "กำลังโหลดวันพยากรณ์…"}</span>}
      </div>
      <span className="mf-clock">เวลาไทย</span>
    </div>
    {periods.some((i) => steps[i].window !== null) && !observed && <div className="mf-periods" role="group" aria-label="กรองเวลา">
      {periods.map((i) => <button key={steps[i].key} aria-pressed={i === index} onClick={() => onChange(i)}>{steps[i].window === null ? "ทั้งวัน" : steps[i].cadence === "hour" ? `${String(steps[i].startHour).padStart(2, "0")}:00` : steps[i].label}</button>)}
    </div>}
    <div className="mf-scrubber">
      <button aria-label={playing ? "หยุดเล่นพยากรณ์" : "เล่นพยากรณ์"} aria-pressed={playing} disabled={observed || indices.length < 2 || reducedMotion} onClick={onPlay}><MapIcon name={playing ? "pause" : "play"} size={17} /></button>
      <input type="range" min={0} max={Math.max(0, indices.length - 1)} value={position} aria-label="เลื่อนเวลาพยากรณ์" aria-valuetext={current ? `${relativeDay(current.date)} ${current.label}` : "รอข้อมูล"} disabled={observed || indices.length < 2} onChange={(e) => onChange(indices[Number(e.target.value)])} onKeyDown={(e) => {
        const next = timelineKeyIndex(e.key, position, indices.length);
        if (next !== null) { e.preventDefault(); onChange(indices[next]); }
      }} />
      <output aria-live={playing ? "off" : "polite"}>{observed ? "ล่าสุด" : current?.cadence === "hour" ? current.label : current?.window != null ? current.label : "รายวัน"}</output>
    </div>
    {data?.layer === "air" && !observed && <span className="mf-cadence-note">PM2.5 เป็นค่าเฉลี่ยรายวัน ยังไม่มีพยากรณ์รายชั่วโมง</span>}
  </div>;
}
