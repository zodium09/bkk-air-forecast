"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { chartScale } from "../../lib/environment-overview";
import { formatValue, type EnvironmentLayer } from "../../lib/map-intelligence";

export type BriefingSample = { key: string; label: string; value: number | null; index: number };

export function AnimatedNumber({ value }: { value: number | null }) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);
  useEffect(() => {
    const start = previous.current;
    previous.current = value;
    let frame = 0;
    const began = performance.now();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animate = (time: number) => {
      const progress = still || value === null || start === value ? 1 : Math.min(1, (time - began) / 560);
      setDisplay(value === null ? null : (start ?? 0) + (value - (start ?? 0)) * (1 - (1 - progress) ** 4));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span aria-label={formatValue(value)}><span aria-hidden="true">{formatValue(value === null ? null : display ?? value)}</span></span>;
}

/** The source's cadence and gaps are retained; hit targets use real sample indices. */
export default function BriefingChart({ layer, samples, activeKey, onSelect, compact = false, loading = false, unit, title }: {
  layer: EnvironmentLayer; samples: BriefingSample[]; activeKey?: string;
  onSelect?: (index: number) => void; compact?: boolean; loading?: boolean; unit: string; title: string;
}) {
  const id = useId().replace(/:/g, "");
  const [hovered, setHovered] = useState<string | null>(null);
  const valid = samples.filter((sample) => sample.value !== null && Number.isFinite(sample.value));
  const scale = chartScale(samples.map((sample) => sample.value));
  const x = (index: number) => 28 + index / Math.max(1, samples.length - 1) * 644;
  const y = (value: number) => 160 - (value - scale.min) / (scale.max - scale.min) * 136;
  const baseline = y(0);
  const inspected = samples.find((sample) => sample.key === hovered) ?? samples.find((sample) => sample.key === activeKey);
  const segments: { x: number; y: number }[][] = [];
  samples.forEach((sample, index) => {
    if (sample.value === null || !Number.isFinite(sample.value)) { segments.push([]); return; }
    if (!segments.length) segments.push([]);
    segments[segments.length - 1].push({ x: x(index), y: y(sample.value) });
  });
  const signature = samples.map((sample) => `${sample.key}:${sample.value}`).join("|");
  return <div className={`bf-chart bf-${layer}${compact ? " is-compact" : ""}${loading ? " is-loading" : ""}`}>
    {compact ? <span className="bf-mini-caption">แนวโน้ม 7 วัน · รายวัน</span> : <div className="bf-chart-readout"><span>{inspected?.label ?? title}</span><b>{inspected ? `${formatValue(inspected.value)} ${unit}` : unit}</b></div>}
    <div className="bf-chart-canvas" onPointerLeave={() => setHovered(null)}>
      <svg key={signature} viewBox="0 0 700 184" preserveAspectRatio="none" role="img" aria-label={`${title}, ${valid.length} ช่วงที่มีข้อมูล, หน่วย ${unit}`}>
        <defs><linearGradient id={`bf-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--bf-color)" stopOpacity=".24" /><stop offset="1" stopColor="var(--bf-color)" stopOpacity=".015" /></linearGradient></defs>
        {!compact && [scale.min, (scale.min + scale.max) / 2, scale.max].map((value) => <line key={value} x1="28" x2="672" y1={y(value)} y2={y(value)} className="bf-grid-line" />)}
        {layer === "rain" ? samples.map((sample, index) => sample.value === null ? null : <rect key={sample.key} className="bf-rain-bar" x={x(index) - Math.min(16, 240 / Math.max(1, samples.length))} y={Math.min(baseline, y(sample.value))} width={Math.min(32, 480 / Math.max(1, samples.length))} height={Math.max(1, Math.abs(baseline - y(sample.value)))} rx="3" style={{ "--bf-delay": `${Math.min(index * 14, 180)}ms` } as CSSProperties} fill="var(--bf-color)" opacity={sample.key === (hovered ?? activeKey) ? 1 : .65} />) : segments.filter((segment) => segment.length).map((segment, index) => {
          const path = segment.map((point) => `${point.x},${point.y}`).join(" L");
          return <g key={index}><path d={`M${segment[0].x},${baseline} L${path} L${segment.at(-1)!.x},${baseline} Z`} fill={`url(#bf-${id})`} /><path className="bf-chart-line" pathLength="1" d={`M${path}`} fill="none" stroke="var(--bf-color)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />{segment.length === 1 && <circle cx={segment[0].x} cy={segment[0].y} r="3" fill="var(--bf-color)" />}</g>;
        })}
        {inspected?.value != null && <g className="bf-cursor"><line x1={x(samples.indexOf(inspected))} x2={x(samples.indexOf(inspected))} y1="16" y2="164" stroke="var(--bf-color)" strokeDasharray="3 5" opacity=".45" /><circle cx={x(samples.indexOf(inspected))} cy={y(inspected.value)} r="5" fill="var(--bf-color)" stroke="var(--bf-surface, white)" strokeWidth="2" /></g>}
      </svg>
      {!compact && <div className="bf-axis" aria-hidden="true"><span>{formatValue(scale.max)}</span><span>{formatValue(scale.min)}</span></div>}
      {onSelect && <div className="bf-chart-targets" role="group" aria-label={`เลือกเวลาจากกราฟ${title}`}>{samples.map((sample, index) => <button key={sample.key} type="button" style={{ left: `${4 + index / Math.max(1, samples.length - 1) * 92}%`, width: `${Math.min(16, 92 / Math.max(1, samples.length))}%` }} aria-label={`${sample.label} ${formatValue(sample.value)} ${unit}`} aria-pressed={sample.key === activeKey} onPointerEnter={() => setHovered(sample.key)} onFocus={() => setHovered(sample.key)} onBlur={() => setHovered(null)} onClick={() => onSelect(sample.index)} onKeyDown={(event) => {
        const next = event.key === "Home" ? 0 : event.key === "End" ? samples.length - 1 : event.key === "ArrowRight" ? Math.min(samples.length - 1, index + 1) : event.key === "ArrowLeft" ? Math.max(0, index - 1) : -1;
        if (next < 0) return;
        event.preventDefault(); onSelect(samples[next].index); (event.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus();
      }} />)}</div>}
      {!valid.length && <span className="bf-chart-empty" role="status">{loading ? "กำลังโหลดแนวโน้ม…" : "ยังไม่มีข้อมูลสำหรับช่วงนี้"}</span>}
    </div>
    <div className="bf-chart-labels" aria-hidden="true">{[0, Math.floor((samples.length - 1) / 2), samples.length - 1].map((index, position) => <span key={position}>{samples[index]?.label ?? ""}</span>)}</div>
    {!compact && samples.length > 0 && <details className="bf-chart-table"><summary>ดูค่าบนกราฟเป็นตาราง</summary><table><caption className="ov-sr-only">{title} ({unit})</caption><thead><tr><th>ช่วงเวลา</th><th>{unit}</th></tr></thead><tbody>{samples.map((sample) => <tr key={sample.key}><th scope="row">{sample.label}</th><td>{formatValue(sample.value)}</td></tr>)}</tbody></table></details>}
  </div>;
}
