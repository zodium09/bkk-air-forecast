"use client";

import { getLegend, type EnvironmentLayer } from "../../lib/map-intelligence";
import { MapIcon } from "./map-ui";
import type { CSSProperties } from "react";
import "./risk-signals.css";

export const riskNames = ["ต่ำ", "ปานกลาง", "สูง", "สูงมาก"];
export function riskStyle(priority: number): CSSProperties {
  const bands = getLegend("air", "primary");
  return { "--risk-fill": priority < 0 ? "var(--ov-line)" : bands[Math.min(4, priority + 1)].color } as CSSProperties;
}

export function RiskMeter({ priority, compact = false }: { priority: number; compact?: boolean }) {
  return <div className={`ov-risk-meter ov-risk-${priority}${compact ? " is-compact" : ""}`} style={riskStyle(priority)}>
    <div className="ov-risk-meter-label"><span>ความเสี่ยงจากพยากรณ์</span><b>{priority < 0 ? "ยังประเมินไม่ได้" : riskNames[priority]}</b></div>
    <div className="ov-risk-steps" aria-hidden="true">{riskNames.map((name, index) => <span key={name} className={priority === index ? "is-current" : ""} style={riskStyle(index)}><i />{!compact && <small>{name}</small>}</span>)}</div>
  </div>;
}

export type RiskSignal = { layer: EnvironmentLayer; name: string; title: string; action: string; priority: number; href: string };
export default function RiskSignals({ signals, scope, dateLabel, loading }: { signals: RiskSignal[]; scope: string; dateLabel: string; loading: boolean }) {
  const known = signals.filter((signal) => signal.priority >= 0);
  const ordered = [...known].sort((a,b) => b.priority - a.priority);
  const highest = ordered[0];
  const priority = highest?.priority ?? -1;
  const elevated = known.filter((signal) => signal.priority >= 2).length;
  return <section className={`ov-risk-summary ov-risk-${priority}`} style={riskStyle(priority)} aria-labelledby="overview-risk-heading">
    <div className="ov-risk-summary-heading"><span className="ov-risk-summary-symbol"><MapIcon name={priority >= 2 ? "warning" : "info"} size={25} /></span><div><h2 id="overview-risk-heading">สัญญาณที่ควรติดตาม</h2><p>{scope} · {dateLabel}</p></div><span className="ov-risk-summary-count">{loading ? "กำลังประเมิน…" : `${known.length} / 3 ประเภทมีข้อมูล`}</span></div>
    <p className="ov-risk-summary-lead" role="status">{loading ? "กำลังอ่านข้อมูลพยากรณ์ของพื้นที่ที่เลือก" : !highest ? "ยังมีข้อมูลไม่พอสำหรับประเมินความเสี่ยง" : elevated ? `${elevated} ประเภทให้สัญญาณความเสี่ยงสูง · ${highest.title}` : priority === 1 ? highest.title : "ยังไม่พบสัญญาณความเสี่ยงสูงในค่าภาพรวมที่มี"}</p>
    <div className="ov-risk-signal-list">{signals.map((signal) => <a key={signal.layer} href={signal.href} className={`ov-risk-${signal.priority}`} style={riskStyle(signal.priority)}><MapIcon name={signal.layer} size={21} /><span><b>{signal.name}</b><small>{signal.priority < 0 ? "ยังไม่มีข้อมูลสำหรับวันที่เลือก" : signal.action}</small></span><strong>{signal.priority < 0 ? "—" : riskNames[signal.priority]}<MapIcon name="arrow" size={16} /></strong></a>)}</div>
    <p className="ov-risk-summary-note">สัญญาณเพื่อวางแผนจากค่าพยากรณ์ของจุดที่เลือกหรือค่าเฉลี่ยจุดที่มีข้อมูล ไม่ใช่ประกาศเตือนภัย · ค่าภาพรวมอาจไม่สะท้อนจุดที่ฝนหรือฝุ่นสูงเฉพาะแห่ง</p>
    <details className="ov-risk-guide"><summary>อ่านเกณฑ์ความเสี่ยงจากพยากรณ์<MapIcon name="chevron" size={16} /></summary><ul><li>ฝุ่น PM2.5 เฉลี่ยรายวัน: ต่ำ ≤25 · ปานกลาง &gt;25–37.5 · สูง &gt;37.5–75 · สูงมาก &gt;75 µg/m³</li><li>ฝนสะสม 24 ชั่วโมง: ต่ำ 0 · ปานกลาง &gt;0–35.5 · สูง &gt;35.5–90 · สูงมาก &gt;90 มม.</li><li>ดัชนีความร้อนสูงสุดรายวัน: ต่ำ &lt;33 · ปานกลาง 33–&lt;42 · สูง 42–&lt;52 · สูงมาก ≥52°C</li></ul><p>ระดับเหล่านี้ใช้จัดลำดับการติดตามในเว็บ ต้องอ่านร่วมกับหน่วย ช่วงเวลา และข้อจำกัดของแบบจำลอง</p></details>
  </section>;
}
