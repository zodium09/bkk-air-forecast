"use client";
import { useMemo, useState, type CSSProperties } from "react";
import { formatValue, layerInfo, metricName, relativeDay, valueColor, type MapDataset, type MapPoint, type MapStep, type Metric } from "../../lib/map-intelligence";
import { sortedPlaceReadings } from "../../lib/place-outlook";
import { MapIcon } from "./map-ui";

type Props = { data: MapDataset | null; points: MapPoint[]; index: number; metric: Metric; step?: MapStep; loading: boolean; onSelect: (point: MapPoint) => void };
export default function PlaceOutlookList({ data, points, index, metric, step, loading, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const readings = useMemo(() => sortedPlaceReadings(points, index, data?.layer ?? "air", metric, step), [points, index, data?.layer, metric, step]);
  const watchCount = readings.filter((reading) => reading.priority > 0).length;
  const availableCount = readings.filter((reading) => reading.value !== null).length;
  const matches = readings.filter(({ point }) => `${point.label} ${point.area ?? ""}`.includes(query.trim()));
  const period = step ? `${relativeDay(step.date)} · ${step.label}` : "รอข้อมูลช่วงเวลา";
  return <section id="place-outlook" className="mf-places" aria-labelledby="place-outlook-title" tabIndex={-1}>
    <div className="mf-places-heading">
      <div><span className="mf-eyebrow">อ่านสภาพพื้นที่ได้ทันที</span><h2 id="place-outlook-title">สรุปรายสถานที่และพื้นที่</h2><p>{data ? metricName(data.layer, metric) : "ข้อมูลสิ่งแวดล้อม"} · {period}</p></div>
      <a href="#map-story" className="mf-back-map"><MapIcon name="map" size={17} />กลับไปแผนที่</a>
    </div>
    {readings.length > 0 && <p className="mf-place-summary">{availableCount === 0 ? <>ยังประมาณค่าของ {readings.length} พื้นที่ในช่วงนี้ไม่ได้</> : watchCount > 0 ? <><b>{watchCount} พื้นที่ควรติดตาม</b> จาก {availableCount} จุดที่มีข้อมูล เรียงพื้นที่ที่ควรติดตามก่อน</> : <>ยังไม่พบสัญญาณเด่นใน {availableCount} จุดที่มีข้อมูลของช่วงนี้</>}{availableCount > 0 && availableCount < readings.length && <> · อีก {readings.length - availableCount} พื้นที่ยังไม่มีค่าประมาณ</>}</p>}
    <label className="mf-place-search"><MapIcon name="search" size={19} /><input type="search" aria-label="ค้นหาในรายการสถานที่" placeholder="ค้นหาถนน แขวง/ตำบล เขต/อำเภอ" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <ol className="mf-place-list" aria-label="รายการสรุปสถานที่">
      {matches.map((reading) => {
        const ordinal = readings.indexOf(reading) + 1;
        const unit = data ? metric === "primary" ? layerInfo[data.layer].unit : layerInfo[data.layer].secondaryUnit : "";
        return <li key={reading.point.id} style={{ "--place-color": valueColor(data?.layer ?? "air", metric, reading.value) } as CSSProperties}>
          <span className="mf-place-number" aria-hidden="true">{ordinal}</span>
          <div className="mf-place-content"><div className="mf-place-heading"><h3>{reading.point.label}</h3><span className="mf-place-value">{formatValue(reading.value)} <small>{unit}</small></span></div>
            {reading.point.area && <p className="mf-place-area">{reading.point.area}</p>}
            <p className="mf-place-kind">{reading.point.place?.road ? "จุดอ้างอิงบนถนน" : "จุดอ้างอิงในแขวง/ตำบล"} · ค่าประมาณบริเวณจุด</p>
            <b className="mf-place-verdict"><i aria-hidden="true" />{reading.title}</b>
            <p>{reading.description}</p><p className="mf-place-action">{reading.action}</p>
            <button onClick={() => onSelect(reading.point)} aria-label={`ดู ${reading.point.label} ${reading.point.area ?? ""} บนแผนที่`}><MapIcon name="pin" size={16} />ดูบนแผนที่<MapIcon name="arrow" size={15} /></button>
          </div>
        </li>;
      })}
    </ol>
    {!matches.length && <p className="mf-place-empty" role="status">{loading ? "กำลังโหลดสรุปรายพื้นที่…" : query.trim() && readings.length ? "ไม่พบพื้นที่ที่ค้นหา ลองเปลี่ยนคำค้น" : "ยังไม่มีจุดประมาณที่ใช้ได้ ตรวจสอบแหล่งข้อมูลและขอบเขตพื้นที่ หรือเลือกช่วงเวลาอื่น"}</p>}
    <div className="mf-place-provenance"><p>จุดสีและรายการใช้ค่าประมาณ IDW เดียวกัน ณ ตำแหน่งอ้างอิงบนถนนหรือภายในแขวง/ตำบล ไม่ใช่ค่าตรวจวัดจริงหรือค่าของทั้งเขต ชื่อถนนช่วยระบุตำแหน่ง แต่ไม่ได้เพิ่มความละเอียดของแบบจำลอง</p>{data && <p>แหล่งข้อมูล: {data.model}{data.status !== "live" ? " · ข้อมูลบางส่วนไม่สมบูรณ์" : ""}</p>}<p>ตำแหน่งถนน © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL</a> · ชื่อพื้นที่จาก <a href="https://bmagis.bangkok.go.th/arcgis/rest/services/Hosted/FGDS_BMA_SUBDISTRICT_POLYGON/FeatureServer/0" target="_blank" rel="noreferrer">BMA GIS</a> / <a href="https://gisportal.dmr.go.th/arcgis/rest/services/Data_Production/WAB_VIEW/MapServer/10" target="_blank" rel="noreferrer">DMR GIS</a></p><p>สัญญาณจากพยากรณ์ยังไม่ยืนยันเหตุการณ์ฝนตก น้ำท่วม หรือเหตุเตือนภัยในพื้นที่</p><a href="https://www.tmd.go.th/warning-and-events/warning-storm" target="_blank" rel="noreferrer">ดูประกาศเตือนภัยทางการจากกรมอุตุนิยมวิทยา ↗</a></div>
  </section>;
}
