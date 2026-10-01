"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { chartScale } from "../../lib/environment-overview";
import { formatValue, relativeDay, type EnvironmentLayer } from "../../lib/map-intelligence";
import { MapIcon } from "./map-ui";
import { RiskMeter, riskNames, riskStyle } from "./risk-signals";

export type ForecastDay = { date: string; value: number | null; title: string; priority: number };

/** Every column is a real daily period. Missing periods retain a gap, never a zero. */
export default function ForecastInfographic({ layer, title, unit, period, days, date, today, loading, onDate }: {
  layer: EnvironmentLayer; title: string; unit: string; period: string;
  days: ForecastDay[]; date: string; today: string; loading: boolean; onDate: (date: string) => void;
}) {
  const scale = chartScale(days.map((day) => day.value));
  const active = days.find((day) => day.date === date);
  const index = days.findIndex((day) => day.date === date);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = scroller.current;
    const button = container?.querySelector<HTMLButtonElement>(".ov-chart-day.is-active");
    if (!container || !button) return;
    const frame = container.getBoundingClientRect();
    const item = button.getBoundingClientRect();
    const distance = item.left < frame.left ? item.left - frame.left : item.right > frame.right ? item.right - frame.right : 0;
    if (distance) container.scrollBy({ left: distance, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [date, layer]);
  return <div className={`ov-infographic ov-${layer}`}>
    <div className="ov-chart-heading">
      <div><span className="ov-chart-kicker"><MapIcon name={layer} size={20} />{title} · {relativeDay(date, today)}</span><div className="ov-chart-number">{loading ? "…" : formatValue(active?.value ?? null)}<small>{unit}</small></div><p role="status">{loading ? "กำลังโหลดแนวโน้ม…" : active?.value == null ? "ยังไม่มีข้อมูลในวันที่เลือก" : active.title}</p><RiskMeter priority={loading ? -1 : active?.priority ?? -1} compact /></div>
      <div className="ov-chart-guide"><span>{period}</span><p>กดแท่งกราฟเพื่อเลือกวัน<br />ภาพรวมและแผนที่จะเปลี่ยนตาม</p><div className="ov-chart-step"><button aria-label="เลือกวันก่อนหน้า" disabled={index <= 0} onClick={() => onDate(days[index - 1].date)}><MapIcon name="arrow" size={18} /></button><button aria-label="เลือกวันถัดไป" disabled={index < 0 || index >= days.length - 1} onClick={() => onDate(days[index + 1].date)}><MapIcon name="arrow" size={18} /></button></div></div>
    </div>
    {days.length ? <div ref={scroller} className="ov-chart-scroll" role="region" aria-label={`กราฟ ${title} เลื่อนแนวนอนเพื่อดูทุกวัน`}>
      <div className="ov-chart-plot">
        <div className="ov-chart-axis" aria-hidden="true">{[scale.max, (scale.min + scale.max) / 2, scale.min].map((value) => <span key={value}>{formatValue(value)}</span>)}</div>
        <div className="ov-chart-grid" aria-hidden="true"><i /><i /><i /></div>
        <div className="ov-chart-days" style={{ "--day-count": days.length } as CSSProperties}>{days.map((day) => {
          const height = day.value === null ? 0 : Math.abs(day.value) / (scale.max - scale.min) * 100;
          const baseline = -scale.min / (scale.max - scale.min) * 100;
          const bottom = day.value !== null && day.value < 0 ? baseline - height : baseline;
          const relative = relativeDay(day.date, today);
          const label = relative === "วันนี้" || relative === "พรุ่งนี้" ? relative : new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(new Date(`${day.date}T12:00:00+07:00`));
          return <button key={day.date} className={`ov-chart-day ov-risk-${day.priority}${date === day.date ? " is-active" : ""}${day.value === null ? " is-missing" : ""}`} style={riskStyle(day.priority)} aria-pressed={date === day.date} aria-label={`${title} ${relativeDay(day.date, today)} ${day.value === null ? "ไม่มีข้อมูล" : `${formatValue(day.value)} ${unit} · ความเสี่ยง${riskNames[day.priority]} · ${day.title}`}`} onClick={() => onDate(day.date)}>
            <span className="ov-bar-space"><span className="ov-chart-bar" style={{ height: `${height}%`, bottom: `${bottom}%` }}><b>{formatValue(day.value)}</b>{height >= 18 && <MapIcon name={layer} size={19} />}</span>{day.value === null && <span className="ov-missing-bar"><b>—</b><small>ไม่มีข้อมูล</small></span>}</span>
            <span className="ov-chart-day-label">{label}<small>{new Intl.DateTimeFormat("th-TH", { weekday: "short", timeZone: "Asia/Bangkok" }).format(new Date(`${day.date}T12:00:00+07:00`))}</small>{date === day.date && <i aria-hidden="true" />}</span>
          </button>;
        })}</div>
      </div>
    </div> : <p className="ov-chart-empty" role="status">{loading ? "กำลังโหลดกราฟจากแหล่งข้อมูล…" : "ยังไม่มีแนวโน้มที่ใช้ได้ ลองโหลดข้อมูลอีกครั้ง"}</p>}
    <div className="ov-chart-risk-key" aria-label="เกณฑ์สีความเสี่ยง">{riskNames.map((name,index) => <span key={name} style={riskStyle(index)}><i />{name}</span>)}</div>
    <div className="ov-chart-caption"><MapIcon name="info" size={16} /><span>ความสูงแท่งคือค่าพยากรณ์ · สีคือระดับความเสี่ยงเพื่อวางแผน · — คือไม่มีข้อมูล</span></div>
  </div>;
}
