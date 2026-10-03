"use client";
import ObservationAreaMap from "./observation-area-map";
import { useState, type ReactNode } from "react";
import { selectAirObservation, type AirObservationPayload } from "../../lib/air-observations";
import { formatValue } from "../../lib/map-intelligence";
import { getRegion, type RegionId } from "../../lib/provinces";
import { thaiObservationTime } from "../../lib/observation-time";
import { useLiveResource, type LiveResource } from "./use-live-resource";
import { AnimatedNumber } from "./briefing-chart";
import { MapIcon } from "./map-ui";
import "./observations.css";

export default function CurrentAir({ region, place, refresh, compact = false, children, forecastValue, forecastLabel, sharedResource, onRefresh }: {
  region: RegionId; place: {lat: number; lng: number} | null; refresh: number; compact?: boolean; children?: ReactNode; forecastValue?: number | null; forecastLabel?: string; sharedResource?: LiveResource<AirObservationPayload>; onRefresh?: () => void;
}) {
  const [reload, setReload] = useState(0);
  const localResource = useLiveResource<AirObservationPayload>(sharedResource ? null : "/api/air-observations", refresh + reload);
  const resource = sharedResource ?? localResource;
  const reading = selectAirObservation(resource.data?.stations ?? [], region, place, resource.clock);
  const source = reading.sources.join(" / ");
  const description = reading.station ? `${reading.station.name} · ห่างจุดที่เลือก ${formatValue(reading.distanceKm)} กม.` : reading.count ? `เฉลี่ย ${reading.count} สถานี ${source} ที่มีข้อมูลล่าสุด` : place ? "ยังไม่มีสถานีที่ใช้ได้ภายใน 30 กม. ของจุดที่เลือก" : "ยังไม่มีค่าตรวจวัดล่าสุดที่ใช้ได้ในพื้นที่นี้";
  const details = <><p className="obs-reading-description">{resource.loading ? "กำลังอ่านค่าจากสถานีตรวจวัด…" : description}</p><p className="obs-period-note">ค่าที่สถานี ไม่ใช่ค่าตรวจวัด ณ บ้านของคุณ · ใช้ค่าภายใน 90 นาที · ต้นทางไม่ระบุช่วงเฉลี่ยในชุดข้อมูลนี้</p><div className="obs-source-line"><span>{source || "AirBKK / Air4Thai"}</span><span>{reading.observedAt ? `ตรวจวัด ${thaiObservationTime(reading.observedAt)} น.` : "รอเวลาตรวจวัด"}</span></div>{resource.error && <p className="obs-error" role="status">{resource.error}</p>}{!resource.loading && (resource.error || reading.value === null) && <button className="ov-text-link" onClick={() => onRefresh ? onRefresh() : setReload(value => value + 1)}>ลองโหลดค่าฝุ่นอีกครั้ง<MapIcon name="refresh" size={15}/></button>}</>;
  if (compact) return <article className="ov-reading ov-air obs-current-air"><div className="ov-reading-title"><MapIcon name="air" size={22}/><h2>ฝุ่น PM2.5 ล่าสุด</h2><span className="obs-observed-tag">ตรวจวัด</span></div><div className="ov-number">{resource.loading ? <span className="ov-skeleton"/> : <AnimatedNumber value={reading.value}/>}<small>µg/m³</small></div><span className="ov-verdict">{reading.value === null ? "รอค่าตรวจวัดที่ใช้ได้" : "ค่าจากสถานีตรวจวัด"}</span>{children}{details}{forecastLabel && <div className="obs-forecast-comparison"><span>{forecastLabel}</span><b>{formatValue(forecastValue ?? null)} <small>µg/m³</small></b></div>}<div className="ov-reading-bottom"><a href={`/air?province=${region}${place ? `&lat=${place.lat}&lng=${place.lng}` : ""}`}>ดูฝุ่นและพยากรณ์<MapIcon name="arrow" size={16}/></a></div><div className="ov-reading-source">{resource.refreshing ? "กำลังอัปเดต…" : resource.data ? `โหลด ${thaiObservationTime(resource.data.fetchedAt)} น. · อัปเดตอัตโนมัติ` : "รอข้อมูลต้นทาง"}</div></article>;
  return <section className="obs-air-panel" aria-label="ค่าตรวจวัดฝุ่นล่าสุด"><div className="obs-air-current"><div className="obs-section-kicker"><MapIcon name="air" size={19}/><h2>ฝุ่นตรวจวัดล่าสุด</h2><span className="obs-observed-tag">ตรวจวัด</span></div><div className="obs-air-number">{resource.loading ? "…" : <AnimatedNumber value={reading.value}/>}<small>µg/m³</small></div>{details}</div><div className="obs-air-stations"><h3>{getRegion(region).shortNameTh} · {reading.stations.length} สถานีมีข้อมูลล่าสุด</h3>{reading.stations.slice(0,3).map(station => <a key={station.id} href={`https://www.openstreetmap.org/?mlat=${station.lat}&mlon=${station.lng}#map=16/${station.lat}/${station.lng}`} target="_blank" rel="noreferrer"><span>{station.name}<small>{station.source} · {thaiObservationTime(station.observedAt)} น.</small></span><b>{formatValue(station.value)}<small>µg/m³</small></b><MapIcon name="arrow" size={15}/></a>)}{!reading.stations.length && <p>สถานีข้อมูลเก่าและค่าที่ขาดจะไม่ถูกนำมาสรุปเป็นค่าปัจจุบัน</p>}<p className="obs-panel-note">พยากรณ์ด้านล่างเป็นอีกชุดข้อมูล และเปลี่ยนตามวันที่เลือก</p></div><ObservationAreaMap topic="air" region={region} position={place} air={resource.data} now={resource.clock} loading={resource.loading}/></section>;
}
