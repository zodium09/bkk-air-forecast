"use client";
import { useState } from "react";
import { upstreamSummary, type UpstreamPayload } from "../../lib/upstream-watch-data";
import { formatValue } from "../../lib/map-intelligence";
import { thaiObservationTime } from "../../lib/observation-time";
import { waterRisk, formatWaterValue } from "../../lib/water-levels";
import { useLiveResource } from "./use-live-resource";
import { MapIcon } from "./map-ui";
import "./upstream-watch.css";

export default function UpstreamWatch({ refresh = 0 }: { refresh?: number }) {
  const [selected, setSelected] = useState("06"), [expanded, setExpanded] = useState(false), [reload, setReload] = useState(0);
  const resource = useLiveResource<UpstreamPayload>("/api/chao-phraya-upstream", refresh + reload);
  const basins = resource.data?.basins ?? [];
  const rows = basins.map(b => ({ basin: b, ...upstreamSummary(b, resource.clock) }));
  const active = rows.find(r => r.basin.code === selected) ?? rows[0];
  const scale = Math.max(1, ...rows.map(r => r.peakRain?.mm ?? 0));
  return <section className="uw-section" id="upstream-watch" aria-labelledby="upstream-title">
    <div className="uw-heading"><div><span className="uw-context"><MapIcon name="water" size={16}/>ต้นน้ำ → เจ้าพระยา → พื้นที่ของฉัน</span><h2 id="upstream-title">ติดตามต้นน้ำเจ้าพระยา</h2><p>ค่าตรวจวัดจาก 6 ลุ่มน้ำที่เกี่ยวข้อง · ใช้เวลารายงานของต้นทาง</p></div><button className="uw-refresh" aria-label="อัปเดตข้อมูลต้นน้ำ" disabled={resource.loading || resource.refreshing} onClick={() => setReload(n => n + 1)}><MapIcon name="refresh" size={18}/></button></div>
    <div className="uw-chart-label"><strong>ฝนสะสม 24 ชั่วโมงสูงสุดในสถานีที่มีข้อมูลล่าสุด</strong><span>มม. · เลือกลุ่มน้ำเพื่อดูรายละเอียด</span></div>
    {resource.loading && !basins.length ? <p className="uw-empty" role="status">กำลังอ่านฝน สถานีน้ำ และอ่างเก็บน้ำต้นทาง…</p> : !basins.length ? <p className="uw-empty" role="status">ยังอ่านข้อมูลต้นน้ำไม่ได้ ลองอัปเดตอีกครั้ง</p> : <div className="uw-rain-chart" aria-label="เปรียบเทียบฝนสะสมในสถานีต้นน้ำ">{rows.map(r => <button key={r.basin.code} aria-pressed={active?.basin.code === r.basin.code} onClick={() => setSelected(r.basin.code)} aria-label={`ลุ่มน้ำ${r.basin.name} ${r.peakRain ? `ฝนสะสมสูงสุด ${formatValue(r.peakRain.mm)} มิลลิเมตร` : "ยังไม่มีค่าฝนล่าสุด"}`}><span className="uw-basin-name">{r.basin.name}</span><span className="uw-bar" aria-hidden="true"><i style={{ transform: `scaleX(${r.peakRain ? r.peakRain.mm / scale : 0})` }}/>{!r.peakRain && <em/>}</span><b>{r.peakRain ? formatValue(r.peakRain.mm) : "—"}</b><small>{r.rainCount ? `${r.rainCount} สถานีล่าสุด` : "รอข้อมูลฝน"}</small></button>)}</div>}
    {active && <div className="uw-selection"><div><strong>ลุ่มน้ำ{active.basin.name}</strong><span>{active.basin.connection}</span><p>{active.peakRain ? `${active.peakRain.name} · ตรวจวัด ${thaiObservationTime(active.peakRain.observedAt)} น. · ยอดสะสมย้อนหลัง 24 ชั่วโมง ณ เวลานั้น` : "ยังไม่มีค่าฝนภายใน 3 ชั่วโมงที่ใช้ได้"}</p></div><div className="uw-water-status"><b>{active.assessedCount ? `น้ำมาก/ถึงตลิ่ง ${active.waterAttention} จาก ${active.assessedCount} สถานีที่ประเมินได้` : "ยังไม่มีสถานีน้ำล่าสุดพร้อมเกณฑ์"}</b><span>สถานีน้ำล่าสุด {active.waterCount}/{active.waterTotal} · อ่างรายวันที่มีข้อมูล {active.dams.length} แห่ง</span></div></div>}
    {active && <><button className="uw-detail-toggle" aria-expanded={expanded} aria-controls="upstream-detail" onClick={() => setExpanded(v => !v)}>{expanded ? "ย่อรายละเอียดต้นน้ำ" : "ดูสถานีน้ำและการระบายจากอ่าง"}<MapIcon name="chevron" size={17}/></button>{expanded && <div className="uw-detail" id="upstream-detail"><div><h3>สถานีน้ำลุ่มน้ำ{active.basin.name}</h3>{active.water.slice(0, 4).map(w => <div className="uw-station" key={w.id}><div><strong>{w.name}</strong><span>{w.waterway} · {w.province}</span><small>{thaiObservationTime(w.observedAt)} น. · {w.status === "fresh" ? waterRisk(w).title : "ข้อมูลล่าช้า"}</small></div><b>{formatWaterValue(w.value)}<small>{w.datum === "msl" ? "ม. รทก." : "ม.จากศูนย์เกจ"}</small></b></div>)}{!active.water.length && <p className="uw-empty">ยังไม่มีค่าตรวจวัดสถานีน้ำที่ใช้ได้</p>}</div><div><h3>อ่างเก็บน้ำ · ข้อมูลรายวัน</h3>{active.dams.map(d => <div className="uw-dam" key={d.id}><div><strong>{d.name}</strong><span>วันที่ {d.date} · น้ำเก็บกัก {formatValue(d.storagePercent)}%</span></div><dl><div><dt>ไหลเข้า</dt><dd>{formatValue(d.inflowMillionM3)}</dd></div><div><dt>ระบาย</dt><dd>{formatValue(d.releasedMillionM3)}</dd></div></dl><small>ล้าน ลบ.ม. ในวันรายงาน</small></div>)}{!active.dams.length && <p className="uw-empty">ยังไม่มีข้อมูลอ่างรายวันที่ใช้ได้ ไม่ถือว่าไม่มีการระบาย</p>}</div></div>}</>}
    <div className="uw-source"><span>{resource.error || (resource.data?.status === "degraded" ? "ข้อมูลบางแหล่งไม่พร้อม" : resource.data?.status === "unavailable" ? "ยังไม่มีค่าล่าสุดที่ใช้ได้" : "ตรวจวัด · ThaiWater")}{resource.data && ` · รับข้อมูล ${thaiObservationTime(resource.data.fetchedAt)} น.`}</span><a href="https://www.thaiwater.net/water" target="_blank" rel="noreferrer">ดูข้อมูลต้นทาง<MapIcon name="arrow" size={14}/></a></div>
    <p className="uw-note">ค่าสูงสุดสะท้อนสถานีที่รายงาน ไม่ใช่ฝนเฉลี่ยทั้งลุ่มน้ำ · ขอบเขตต้นน้ำใช้ข้อมูล 22 ลุ่มน้ำของกรมทรัพยากรน้ำ</p>
  </section>;
}
