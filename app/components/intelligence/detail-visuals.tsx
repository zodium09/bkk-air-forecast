"use client";

import { useId, type CSSProperties } from "react";
import { capacityReading, detailNumber } from "../../lib/detail-visuals";
import "./detail-visuals.css";

export function CapacityMeter({ value, label, note, kind = "storage", motion = true }: { value: number | null; label: string; note: string; kind?: "storage" | "river"; motion?: boolean }) {
  const labelId = useId(), reading = capacityReading(value);
  return <figure className={`dv-capacity dv-${kind}${motion ? "" : " is-still"}`}>
    <figcaption id={labelId}>{label}</figcaption>
    {reading ? <>
      <meter className="ov-sr-only" min={0} max={100} value={reading.fill} aria-labelledby={labelId} aria-valuetext={`${detailNumber(reading.value)}%${reading.overflow ? ` สูงกว่า 100% อยู่ ${detailNumber(reading.overflow)} จุดเปอร์เซ็นต์` : ""}`} />
      <div className="dv-gauge">
        <svg viewBox="0 0 240 150" aria-hidden="true">
          <path d="M24 116 A96 96 0 0 1 216 116" className="dv-gauge-track" />
          <path d="M24 116 A96 96 0 0 1 216 116" pathLength="100" strokeDasharray={`${reading.fill} 100`} className="dv-gauge-fill" />
          <line x1="120" y1="116" x2="42" y2="116" className="dv-gauge-needle" style={{ transform: `rotate(${reading.fill * 1.8}deg)` }} /><circle cx="120" cy="116" r="6" className="dv-gauge-hub" />
          <text x="22" y="144" textAnchor="middle">0%</text><text x="120" y="7" textAnchor="middle">50%</text><text x="218" y="144" textAnchor="middle">100%</text>
        </svg>
        <strong>{detailNumber(reading.value)}<small>%</small></strong>
      </div>
      {!!reading.overflow && <p className="dv-overflow">เกิน 100% อยู่ {detailNumber(reading.overflow)} จุดเปอร์เซ็นต์ · เข็มแสดงเต็มสเกล</p>}
    </> : <p className="dv-capacity-missing"><strong>—</strong>ยังไม่มีเปอร์เซ็นต์ความจุล่าสุดที่ใช้ได้</p>}
    <p className="dv-capacity-note">{note}</p>
  </figure>;
}

export type ComparisonRow = { id: string; label: string; value: number | null; note?: string; href?: string };
export function ComparisonBars({ title, unit, rows, color = "#007d71" }: { title: string; unit: string; rows: ComparisonRow[]; color?: string }) {
  const labelId = useId();
  const validValue = (value: number | null) => value !== null && Number.isFinite(value) && value >= 0 ? value : null;
  const maximum = Math.max(1, ...rows.map(row => validValue(row.value) ?? 0));
  return <figure className="dv-comparison" style={{ "--dv-series-color": color } as CSSProperties} aria-labelledby={labelId}>
    <figcaption id={labelId}><b>{title}</b><span>หน่วย {unit} · เปรียบเทียบค่าที่รายงาน</span></figcaption>
    <div className="dv-comparison-rows">{rows.map(row => { const value = validValue(row.value); return <div className="dv-comparison-row" key={row.id}>
      <div className="dv-comparison-label"><b>{row.href ? <a href={row.href} target="_blank" rel="noreferrer">{row.label}</a> : row.label}</b>{row.note && <small>{row.note}</small>}</div>
      <div className={`dv-comparison-track${value === null ? " is-missing" : ""}`} aria-hidden="true"><i style={{ transform: `scaleX(${(value ?? 0) / maximum})` }} /></div>
      <strong>{detailNumber(value)}<small>{unit}</small></strong>
    </div>; })}</div>
  </figure>;
}
