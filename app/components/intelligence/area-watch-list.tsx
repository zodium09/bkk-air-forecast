"use client";
import { useMemo, useState } from "react";
import { buildAreaWatch, watchStepIndex, type AreaWatch } from "../../lib/area-watch";
import { formatValue, layerInfo, relativeDay, type EnvironmentLayer, type MapStep } from "../../lib/map-intelligence";
import { getRegion, type RegionId } from "../../lib/provinces";
import type { WeatherSource } from "../../lib/dashboard-controls";
import { useEnvironmentData } from "./use-environment-data";
import { MapIcon } from "./map-ui";
import { createPlacePoints } from "../../lib/place-outlook";
import type { MapBoundary } from "../../lib/map-surface";
import type { MapPlace } from "../../lib/map-places";

export default function AreaWatchList({ province, source, step, refresh, boundary, places, onSelect }: { province: RegionId; source: WeatherSource; step?: MapStep; refresh: number; boundary: MapBoundary | null; places: MapPlace[]; onSelect: (watch: AreaWatch) => void }) {
  const [filter, setFilter] = useState<EnvironmentLayer | "all">("all");
  const air = useEnvironmentData("air", province, "forecast", refresh, source);
  const rain = useEnvironmentData("rain", province, "forecast", refresh, source);
  const heat = useEnvironmentData("heat", province, "forecast", refresh, source);
  const feeds = [air, rain, heat];
  const date = step?.date ?? "";
  const hour = step?.window != null ? step.startHour : undefined;
  const watchData = useMemo(() => [air.data, rain.data, heat.data].map((data) => data ? { ...data, points: createPlacePoints(data, boundary, places) } : null), [air.data, rain.data, heat.data, boundary, places]);
  const watches = watchData.flatMap((data) => buildAreaWatch(data, date, hour)).filter((item) => filter === "all" || item.layer === filter).sort((a, b) => b.severity - a.severity || a.layer.localeCompare(b.layer) || b.value - a.value);
  const loading = feeds.some((feed) => feed.loading);
  const incomplete = feeds.filter((feed, index) => !feed.loading && (!watchData[index]?.points.length || !feed.data || feed.data.status === "unavailable" || watchStepIndex(feed.data, date, hour) < 0));
  const groups = [...new Set(watches.map((item) => item.area))];
  return <section className="mf-watch" aria-label="รายการเฝ้าระวังรายพื้นที่">
    <div className="mf-panel-heading"><span className="mf-watch-icon"><MapIcon name="warning" /></span><div><h2>เฝ้าระวังในพื้นที่</h2><p>{getRegion(province).shortNameTh} · {date ? relativeDay(date) : "รอช่วงเวลา"}{hour !== undefined ? ` · ${String(hour).padStart(2, "0")}:00 น.` : ""}</p></div></div>
    <p className="mf-watch-note">สัญญาณจากพยากรณ์ ไม่ใช่เหตุการณ์ที่ยืนยันหรือประกาศเตือนภัยทางการ</p>
    <div className="mf-filter-tabs" aria-label="กรองประเภทเฝ้าระวัง">{(["all", "air", "rain", "heat"] as const).map((item) => <button key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === "all" ? "ทั้งหมด" : layerInfo[item].thai}</button>)}</div>
    <div className="mf-watch-summary" role="status">{loading ? "กำลังตรวจสอบข้อมูลแต่ละพื้นที่…" : `${watches.length} จุดที่ควรติดตาม · ${groups.length} พื้นที่`}</div>
    {!!incomplete.length && <p className="mf-feed-note">ข้อมูลบางประเภทไม่พร้อมในช่วงนี้ ยังสรุปว่าพื้นที่ปลอดภัยไม่ได้</p>}
    {!loading && !watches.length && <p className="mf-empty">ไม่พบจุดเข้าเกณฑ์เฝ้าระวังจากข้อมูลที่มีในช่วงนี้ เปลี่ยนวันหรือเวลาเพื่อสำรวจช่วงอื่นได้</p>}
    {groups.map((area) => <section key={area} className="mf-watch-group"><h3><MapIcon name="pin" size={17} />{area}<span>{watches.filter((item) => item.area === area).length} จุด</span></h3><ul>
      {watches.filter((item) => item.area === area).map((item) => <li key={`${item.layer}:${item.point.id}`}>
        <div className="mf-watch-row"><span className={`mf-severity mf-severity-${item.severity}`}>{item.severity === 3 ? "ค่าสูงมาก" : item.severity === 2 ? "ควรติดตาม" : "เฝ้าระวัง"}</span><b>{item.title}</b></div>
        <h4>{item.point.label}</h4>
        <div className="mf-watch-value">{formatValue(item.value)} <small>{item.unit}</small><span>{relativeDay(item.step.date)} · {item.step.label}</span></div>
        <p>{item.description}</p>
        <details><summary>ที่มาข้อมูล{item.degraded ? " · ข้อมูลไม่ครบ" : ""}</summary><p>{item.source}</p><p>จุดประมาณ IDW {item.point.lat.toFixed(4)}, {item.point.lng.toFixed(4)} · ค่าบริเวณจุดตัวแทนพื้นที่ ไม่ใช่ค่าตรวจวัดจริงหรือค่าของทั้งเขต</p></details>
        <button className="mf-watch-map" onClick={() => onSelect(item)}><MapIcon name="map" size={17} />ดูจุดนี้บนแผนที่<MapIcon name="arrow" size={16} /></button>
      </li>)}
    </ul></section>)}
    <p className="mf-watch-official">ตรวจสอบประกาศทางการเพิ่มเติมจาก <a href="https://www.tmd.go.th/warning-and-events/warning-storm" target="_blank" rel="noreferrer">กรมอุตุนิยมวิทยา</a> และหน่วยงานในพื้นที่</p>
  </section>;
}
