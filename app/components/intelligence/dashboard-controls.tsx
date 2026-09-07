"use client";
import { useId, useState, type CSSProperties } from "react";
import { formatValue, layerInfo, metricName, relativeDay, valueColor, type DataMode, type MapDataset, type Metric } from "../../lib/map-intelligence";
import { indexForDate, timelineIndices, timelineKeyIndex } from "../../lib/dashboard-controls";
import { MapIcon } from "./map-ui";

type TimeProps = { data: MapDataset | null; index: number; onChange: (i: number) => void; mode: DataMode };
export function DashboardTimeControl({ data, index, onChange, mode, playing, onPlay, animationAllowed }: TimeProps & { playing: boolean; onPlay: () => void; animationAllowed: boolean }) {
  const steps = data?.steps ?? [];
  const current = steps[index];
  const indices = timelineIndices(steps, index);
  const position = Math.max(0, indices.indexOf(index));
  const dates = [...new Set(steps.map((s) => s.date).filter(Boolean))];
  const observed = mode === "observation";
  const label = observed ? "ตรวจวัดล่าสุด" : current ? `${relativeDay(current.date)} · ${current.label}` : "รอข้อมูลเวลา";
  return <div className="db-time-control" aria-label="ควบคุมวันและเวลาบนแผนที่">
    <div className="db-time-fields">
      <label>วันที่ <select aria-label="กรองวันที่" disabled={!dates.length || observed} value={current?.date ?? ""} onChange={(e) => { const next = indexForDate(steps, index, e.target.value); if (next >= 0) onChange(next); }}>
        {!dates.length && <option value="">{observed ? "ล่าสุด" : "รอข้อมูล"}</option>}
        {dates.map((date) => <option value={date} key={date}>{relativeDay(date)} · {date.slice(8)}/{date.slice(5, 7)}</option>)}
      </select></label>
      <label>เวลา <select aria-label="กรองเวลา" disabled={!steps.length || observed} value={current?.key ?? ""} onChange={(e) => onChange(steps.findIndex((s) => s.key === e.target.value))}>
        {!steps.length && <option value="">รอข้อมูล</option>}
        {steps.filter((s) => s.date === current?.date).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select></label>
      <span className="db-timezone">ICT<br /><small>UTC+7</small></span>
    </div>
    <div className="db-time-scrubber">
      <button className="db-play" aria-label={playing ? "หยุดเล่นพยากรณ์" : "เล่นพยากรณ์"} aria-pressed={playing} disabled={observed || indices.length < 2 || !animationAllowed} onClick={onPlay}><MapIcon name={playing ? "pause" : "play"} size={17} /></button>
      <button className="db-step" aria-label="ช่วงเวลาก่อนหน้า" disabled={observed || !position} onClick={() => onChange(indices[position - 1])}>‹</button>
      <div className="db-range-wrap">
        <input type="range" min={0} max={Math.max(0, indices.length - 1)} step={1} value={position} disabled={observed || indices.length < 2} aria-label="เลื่อนเวลาพยากรณ์" aria-valuetext={label} onChange={(e) => onChange(indices[Number(e.target.value)])} onKeyDown={(e) => {
          const next = timelineKeyIndex(e.key, position, indices.length);
          if (next !== null) { e.preventDefault(); onChange(indices[next]); }
          if (e.key === " " && animationAllowed) { e.preventDefault(); onPlay(); }
        }} />
        <div><span>{observed ? "เวลาแต่ละสถานีอาจต่างกัน" : current?.window != null ? "ทุก 3 ชั่วโมง" : "รายวัน"}</span><output aria-live={playing ? "off" : "polite"}>{label}</output></div>
      </div>
      <button className="db-step" aria-label="ช่วงเวลาถัดไป" disabled={observed || position >= indices.length - 1} onClick={() => onChange(indices[position + 1])}>›</button>
    </div>
  </div>;
}

export function DashboardChart({ data, index, onChange, mode, values, metric, scope }: TimeProps & { values: (number | null)[]; metric: Metric; scope: string }) {
  const gradient = useId().replaceAll(":", "");
  const [hovered, setHovered] = useState<number | null>(null);
  const steps = data?.steps ?? [];
  const indices = timelineIndices(steps, index);
  const inspected = hovered !== null && indices.includes(hovered) ? hovered : index;
  const unit = data ? metric === "primary" ? layerInfo[data.layer].unit : layerInfo[data.layer].secondaryUnit : "";
  const valid = indices.map((i) => values[i]).filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
  const minimum = valid.length ? Math.min(...valid) : null;
  const maximum = valid.length ? Math.max(...valid) : null;
  const floor = data?.layer === "heat" && minimum !== null ? Math.floor((minimum - 2) / 5) * 5 : 0;
  const ceiling = Math.max(floor + 5, Math.ceil((maximum ?? 10) / 5) * 5);
  const x = (p: number) => 48 + p / Math.max(1, indices.length - 1) * 900;
  const y = (v: number) => 140 - (v - floor) / (ceiling - floor) * 120;
  // Separate paths at nulls so an outage never appears as continuous data.
  const segments: string[][] = [];
  indices.forEach((i, p) => { const v = values[i]; if (v == null) { segments.push([]); return; } if (!segments.length) segments.push([]); segments[segments.length - 1].push(`${x(p)},${y(v)}`); });
  const current = steps[inspected];
  return <section id="forecast-story" tabIndex={-1} className="mi-timeline db-chart-panel" aria-label="เส้นเวลาพยากรณ์">
    <div className="db-chart-heading">
      <div><span className="db-eyebrow">แนวโน้มพื้นที่</span><h2>{data ? metricName(data.layer, metric) : "แนวโน้มพยากรณ์"} <small>{unit}</small></h2></div>
      <div className="db-chart-cadence" aria-label="ความถี่กราฟ">
        <button aria-pressed={steps[index]?.window == null} onClick={() => { const next = steps.findIndex((s) => s.date === steps[index]?.date && s.window === null); if (next >= 0) onChange(next); }}>รายวัน</button>
        <button disabled={!steps.some((s) => s.window !== null)} aria-pressed={steps[index]?.window != null} onClick={() => { const next = steps.findIndex((s) => s.date === steps[index]?.date && s.window !== null); if (next >= 0) onChange(next); }}>3 ชั่วโมง</button>
      </div>
      <div className="db-chart-value" role="status"><b style={{ color: data ? valueColor(data.layer, metric, values[inspected] ?? null) : undefined }}>{formatValue(values[inspected] ?? null)}</b><span>{current?.date ? `${relativeDay(current.date)} · ${current.label}` : "รอข้อมูล"}</span></div>
    </div>
    <p className="db-chart-scope">{scope}<span>ต่ำสุด {formatValue(minimum)} · สูงสุด {formatValue(maximum)} {unit}</span></p>
    {mode === "observation" ? <p className="db-chart-empty">ตรวจวัดล่าสุดที่มีข้อมูล · เลือกโหมดพยากรณ์หรือ IDW เพื่อสำรวจแนวโน้มรายวัน</p> : <>
      <div className="db-chart-plot" onMouseLeave={() => setHovered(null)}>
        <svg viewBox="0 0 1000 175" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--mi-accent)" stopOpacity=".3" /><stop offset="100%" stopColor="var(--mi-accent)" stopOpacity=".01" /></linearGradient></defs>
          {[floor, (floor + ceiling) / 2, ceiling].map((v) => <g key={v}><line x1="48" x2="948" y1={y(v)} y2={y(v)} stroke="var(--mi-line)" strokeDasharray="3 5" /></g>)}
          {segments.filter((s) => s.length).map((points, i) => <g key={i}><path d={`M${points[0].split(",")[0]},140 L${points.join(" L")} L${points[points.length - 1].split(",")[0]},140 Z`} fill={`url(#${gradient})`} /><polyline points={points.join(" ")} fill="none" stroke="var(--mi-accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" /></g>)}
          {indices.map((i, p) => values[i] == null ? null : <circle key={i} cx={x(p)} cy={y(values[i]!)} r={inspected === i ? 5 : indices.length < 10 ? 3 : 0} fill={data ? valueColor(data.layer, metric, values[i]) : "var(--mi-accent)"} stroke="var(--mi-surface)" strokeWidth="2" />)}
          {indices.includes(inspected) && <line x1={x(indices.indexOf(inspected))} x2={x(indices.indexOf(inspected))} y1="15" y2="145" stroke="var(--mi-accent)" strokeDasharray="4 4" opacity=".65" />}

        </svg>
        <div className="db-chart-y-labels" aria-hidden="true">{[ceiling, (floor + ceiling) / 2, floor].map((v) => <span key={v}>{formatValue(v)}</span>)}</div>
        <div className="db-chart-x-labels" aria-hidden="true">{[indices[0], indices[Math.floor((indices.length - 1) / 2)], indices[indices.length - 1]].map((i, p) => <span key={p}>{steps[i]?.date ? relativeDay(steps[i].date) : ""}</span>)}</div>
        <div className="db-chart-targets" role="group" aria-label="เลือกช่วงเวลาจากกราฟ">
          {indices.map((i, p) => <button key={steps[i].key} style={{ left: `${4.8 + p / Math.max(1, indices.length - 1) * 90}%`, width: `${Math.min(12, 90 / Math.max(1, indices.length - 1))}%` } as CSSProperties} tabIndex={index === i ? 0 : -1} aria-pressed={index === i} aria-label={`${relativeDay(steps[i].date)} ${steps[i].label} ${formatValue(values[i] ?? null)} ${unit}`} onPointerEnter={() => setHovered(i)} onFocus={() => setHovered(i)} onBlur={() => setHovered(null)} onClick={() => onChange(i)} onKeyDown={(e) => { const next = timelineKeyIndex(e.key, p, indices.length); if (next !== null) { e.preventDefault(); onChange(indices[next]); (e.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus(); } }} />)}
        </div>
        {!valid.length && <p className="db-chart-empty">กราฟจะแสดงเมื่อมีข้อมูลพยากรณ์</p>}
      </div>
      <div className="db-chart-footer"><span>ชี้เพื่ออ่านค่า · คลิกเพื่อเปลี่ยนแผนที่</span><details className="mi-keyboard-help"><summary>ใช้คีย์บอร์ดสำรวจ</summary><p>Tab เลือกกราฟหรือ slider · ลูกศรเลื่อนเวลา · Home / End ไปช่วงแรก / สุดท้าย · Page Up / Down ข้าม 8 ช่วง · Space เล่น / หยุดบน slider</p></details></div>
    </>}
  </section>;
}
