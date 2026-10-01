"use client";
import { useId, useState } from "react";
import { getRegion, type RegionId } from "../../lib/provinces";
import { formatWaterValue as formatValue, waterBankDifference, waterRisk, waterStationsForArea, currentWaterStations, type WaterPayload, type WaterStation } from "../../lib/water-levels";
import { MapIcon } from "./map-ui";
import { riskStyle } from "./risk-signals";
import "./water-overview.css";
import { useLiveResource } from "./use-live-resource";
import WaterHistoryChart from "./water-history-chart";

function readingTime(station: WaterStation) {
  return station.observedAt ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(station.observedAt)) : "ต้นทางไม่ระบุเวลาที่ใช้ได้";
}
function WaterScale({ station, motion }: { station: WaterStation; motion: boolean }) {
  const clipId = useId().replace(/:/g, "");
  if (station.status !== "fresh") return <p className="ov-water-scale-empty">ยังไม่มีข้อมูลล่าสุดที่ใช้เทียบระดับน้ำกับตลิ่งได้</p>;
  if (station.value === null || station.bank === null || station.datum !== "msl") return <p className="ov-water-scale-empty">{station.value === null ? "ยังไม่มีค่าตรวจวัดที่ใช้ได้" : "ต้นทางไม่มีค่าตลิ่งที่เทียบกับระดับน้ำนี้ได้"}</p>;
  if (station.ground !== null && station.ground < station.bank && station.value >= station.ground) {
    const min = Math.min(station.ground, 0) - .15;
    const max = Math.max(station.value, station.bank, 0) + .45;
    const y = (value: number) => 18 + (max - value) / (max - min) * 166;
    const waterY = y(station.value), bankY = y(station.bank), bedY = y(station.ground);
    return <figure className={`ov-water-figure${motion ? "" : " is-still"}`}>
      <svg key={`${station.id}:${station.observedAt}`} className="ov-water-diagram" viewBox="0 0 400 224" role="img" aria-label={`ระดับน้ำ ${formatValue(station.value)} เมตร รทก. ตลิ่ง ${formatValue(station.bank)} เมตร รทก. ท้องน้ำ ${formatValue(station.ground)} เมตร รทก.`}>
        <defs><clipPath id={clipId}><rect x="42" y="18" width="206" height={bedY - 18} rx="9" /></clipPath></defs>
        <rect x="42" y="18" width="206" height={bedY - 18} rx="9" className="ov-water-column" />
        <g clipPath={`url(#${clipId})`}><rect className="ov-water-fill" x="42" y={waterY} width="206" height={bedY - waterY} /><path className="ov-water-surface" d={`M42 ${waterY} Q68 ${waterY - 3} 94 ${waterY} T146 ${waterY} T198 ${waterY} T250 ${waterY}`} /></g>
        <line x1="28" x2="265" y1={bankY} y2={bankY} className="ov-water-bank-line" />
        <line x1="42" x2="265" y1={bedY} y2={bedY} className="ov-water-bed-line" />
        <text x="278" y={bankY - 6}>ระดับตลิ่ง</text><text x="278" y={bankY + 12} className="ov-water-diagram-value">{formatValue(station.bank)} ม.</text>
        <text x="278" y={bedY - 6}>ท้องน้ำ</text><text x="278" y={bedY + 12} className="ov-water-diagram-value">{formatValue(station.ground)} ม.</text>
        <text x="145" y="210" textAnchor="middle">ระดับอ้างอิง รทก. ณ สถานี</text>
      </svg>
      <figcaption><i />สีแสดงสถานะจากข้อมูลล่าสุด · ภาพเคลื่อนไหวเมื่อเลือกสถานี</figcaption>
    </figure>;
  }
  const minimum = Math.min(0, station.value, station.bank);
  const maximum = Math.max(0, station.value, station.bank) + .5;
  const x = (value: number) => 60 + (value - minimum) / (maximum - minimum) * 250;
  return <svg className="ov-water-scale" viewBox="0 0 330 116" role="img" aria-label={`ระดับน้ำ ${formatValue(station.value)} เมตร รทก. ระดับตลิ่ง ${formatValue(station.bank)} เมตร รทก.`}>
    <line x1={x(0)} x2={x(0)} y1="15" y2="85" className="ov-water-zero" />
    {[{ label: "ระดับน้ำ", value: station.value, y: 22, fill: "var(--ov-blue)" }, { label: "ตลิ่ง", value: station.bank, y: 62, fill: "var(--ov-muted)" }].map((item) => <g key={item.label}><text x="0" y={item.y + 12}>{item.label}</text><rect x={Math.min(x(0), x(item.value))} y={item.y} width={Math.max(2, Math.abs(x(item.value) - x(0)))} height="16" rx="4" fill={item.fill} /><text x={x(item.value)} y={item.y - 5} textAnchor="middle" className="ov-water-scale-value">{formatValue(item.value)}</text></g>)}
    <text x="60" y="109">{formatValue(minimum)}</text><text x="310" y="109" textAnchor="end">{formatValue(maximum)} ม. รทก.</text>
  </svg>;
}

export default function WaterOverview({ region, place, refresh }: { region: RegionId; place: { lat: number; lng: number } | null; refresh: number }) {
  const [reload, setReload] = useState(0);
  const [kind, setKind] = useState<"all" | "canal" | "river">("all");
  const [stationId, setStationId] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [motion, setMotion] = useState(true);
  const resource = useLiveResource<WaterPayload>("/api/water-levels", refresh + reload);
  const { data, loading } = resource;
  const areaStations = waterStationsForArea(currentWaterStations(data?.stations ?? [], resource.clock), region, place);
  const stations = areaStations.filter((station) => (kind === "all" || station.kind === kind) && (!attentionOnly || waterRisk(station).priority >= 2));
  const station = stations.find((station) => station.id === stationId) ?? stations[0];
  const difference = station ? waterBankDifference(station) : null;
  const fresh = areaStations.filter((station) => station.status === "fresh").length;
  const canUse = areaStations.some((station) => station.value !== null);
  const attention = areaStations.filter((station) => waterRisk(station).priority >= 2).length;
  const assessed = areaStations.filter((station) => waterRisk(station).priority >= 0).length;
  const risk = station ? waterRisk(station) : null;
  function chooseStation(id: string) {
    setStationId(id);
    if (window.matchMedia("(max-width: 780px)").matches) {
      const detail = document.getElementById("overview-water-detail");
      detail?.focus({ preventScroll: true });
      detail?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
  }
  return <section className="ov-section ov-water" id="water-levels" tabIndex={-1} aria-busy={loading}>
    <div className="ov-section-heading"><div><h2>ระดับน้ำในคลองและแม่น้ำ</h2><p>{getRegion(region).shortNameTh} · ค่าตรวจวัดล่าสุดตามเวลาของแต่ละสถานี</p></div><button className="ov-location-button" disabled={loading} onClick={() => setReload((value) => value + 1)}><MapIcon name="refresh" size={17} />{loading ? "กำลังโหลดระดับน้ำ…" : "อัปเดตระดับน้ำ"}</button></div>
    <div className="ov-water-toolbar"><div className="ov-water-tabs" aria-label="เลือกประเภททางน้ำ">{[{ id: "all", label: "ทั้งหมด" }, { id: "canal", label: "คลอง" }, { id: "river", label: "แม่น้ำ" }].map((item) => <button key={item.id} aria-pressed={kind === item.id} onClick={() => setKind(item.id as typeof kind)}>{item.label}</button>)}</div><button className="ov-motion-control" aria-pressed={!motion} onClick={() => setMotion((value) => !value)}><MapIcon name="chart" size={16} />{motion ? "หยุดภาพเคลื่อนไหว" : "เปิดภาพเคลื่อนไหว"}</button><p role="status">{loading ? "กำลังเชื่อมต่อ ThaiWater…" : resource.refreshing ? "กำลังอัปเดตค่าตรวจวัด…" : `${fresh} สถานีมีข้อมูลภายใน 1 ชั่วโมง · ${areaStations.length - fresh} สถานีข้อมูลเก่าหรือใช้ไม่ได้`}</p></div>
    <div className={`ov-water-notice ov-risk-${attention ? 2 : -1}`}><MapIcon name={attention ? "warning" : "info"} size={22} /><div><h3>{loading ? "กำลังตรวจสถานะระดับน้ำ" : !assessed ? "ยังประเมินสัญญาณระดับน้ำไม่ได้" : attention ? `${attention} สถานีให้สัญญาณที่ควรติดตาม` : "ยังไม่พบสัญญาณเข้าเกณฑ์ติดตามในข้อมูลล่าสุดที่มี"}</h3><p>{!loading && !assessed ? "ข้อมูลล่าสุดหรือเกณฑ์เปรียบเทียบยังไม่พร้อม · ลองอัปเดตข้อมูลหรือเลือกจังหวัดอื่น" : `ใช้สถานะจากค่าความจุลำน้ำหรือการถึงระดับตลิ่ง ณ สถานี${loading ? "" : ` · จัดสถานะได้ ${assessed} สถานี`} · ไม่ใช่ประกาศเตือนภัย`}</p></div><button aria-pressed={attentionOnly} disabled={loading || !attention && !attentionOnly} onClick={() => setAttentionOnly((value) => !value)}>{attentionOnly ? "แสดงทุกสถานี" : "ดูสถานีที่ควรติดตาม"}<MapIcon name="arrow" size={16} /></button></div>
    {!loading && !canUse && <div className="ov-recovery" role="status"><MapIcon name="info" size={18} /><p>{areaStations.length ? "ยังไม่มีค่าระดับน้ำที่ใช้ได้ในพื้นที่นี้" : "ไม่มีข้อมูลระดับน้ำที่ใช้ได้จากต้นทางสำหรับพื้นที่นี้"}</p><button className="ov-text-link" onClick={() => setReload((value) => value + 1)}>ลองโหลดอีกครั้ง</button></div>}
    <div className="ov-water-layout"><div className="ov-water-stations"><label htmlFor="overview-water-station">เลือกสถานีตรวจวัด<select id="overview-water-station" value={station?.id ?? ""} disabled={loading || !stations.length} onChange={(event) => chooseStation(event.target.value)}>{!stations.length && <option value="">{loading ? "กำลังโหลดรายชื่อ…" : "ไม่พบสถานีประเภทนี้"}</option>}{stations.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.province}</option>)}</select></label>
      {place && <p className="ov-water-nearby">เรียงสถานีที่ข้อมูลพร้อมใกล้ย่านที่เลือกก่อน · ระยะเส้นตรง</p>}
      <div className="ov-water-list">{stations.slice(0,6).map((item) => { const state = waterRisk(item); return <button key={item.id} className={`ov-risk-${state.priority}`} style={riskStyle(state.priority)} aria-pressed={station?.id === item.id} onClick={() => chooseStation(item.id)}><span><b>{item.name}</b><small>{item.waterway}{item.distanceKm !== null ? ` · ${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(item.distanceKm)} กม.` : ` · ${item.province}`}</small><em className="ov-water-row-status"><i />{item.status === "fresh" ? state.title : item.status === "stale" ? "ข้อมูลเก่า · ไม่ประเมินสถานะล่าสุด" : "ข้อมูลใช้ไม่ได้"}</em></span><span>{formatValue(item.value)}<small>{item.datum === "msl" ? "ม. รทก." : "ม. อ้างอิงสถานี"} · {item.status === "fresh" ? "ล่าสุด" : item.status === "stale" ? "ข้อมูลเก่า" : "ใช้ไม่ได้"}</small></span></button>; })}</div>
      {!loading && !stations.length && <p className="ov-empty">{attentionOnly ? "ไม่พบสถานีที่เข้าเกณฑ์ติดตามในประเภททางน้ำนี้" : `ไม่มีสถานี${kind === "canal" ? "คลอง" : kind === "river" ? "แม่น้ำ" : "น้ำ"}ในข้อมูลที่มีของพื้นที่นี้`}</p>}
    </div><div className={`ov-water-detail ov-risk-${risk?.priority ?? -1}`} style={riskStyle(risk?.priority ?? -1)} id="overview-water-detail" tabIndex={-1}>{station && risk ? <><h3>{station.name}</h3><span className="ov-water-status">{station.status === "fresh" ? "ค่าตรวจวัดล่าสุด" : station.status === "stale" ? "ค่าครั้งล่าสุด · ข้อมูลเกิน 1 ชั่วโมง" : "ข้อมูลใช้ไม่ได้ · ตรวจสอบเวลาหรือค่าจากต้นทาง"}</span><p>{station.waterway} · {station.district} · {station.province}</p><div className="ov-water-evidence"><div className="ov-water-number">{formatValue(station.value)}<small>{station.datum === "msl" ? "ม. รทก." : "ม. อ้างอิงสถานี"}</small></div><div className="ov-water-capacity"><b>{station.status === "fresh" && station.capacityPercent !== null && station.capacityPercent >= 0 ? `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(station.capacityPercent)}%` : "—"}</b><small>ความจุลำน้ำจากต้นทาง</small></div></div><div className="ov-water-risk-label"><MapIcon name={risk.priority >= 2 ? "warning" : "info"} size={18} /><b>{risk.title}</b></div><p className="ov-water-risk-message" role="status">{risk.message}</p><p className={`ov-water-bank${difference !== null && difference >= 0 ? " is-above" : ""}`}>{difference === null ? "ยังเปรียบเทียบกับตลิ่งจากข้อมูลล่าสุดไม่ได้" : difference > 0 ? `สูงกว่าระดับตลิ่งที่ต้นทางระบุ ${formatValue(difference)} ม. ณ สถานีนี้` : difference === 0 ? "เท่าระดับตลิ่งที่ต้นทางระบุ ณ สถานีนี้" : `ต่ำกว่าระดับตลิ่งที่ต้นทางระบุ ${formatValue(-difference)} ม.`}</p><WaterScale station={station} motion={motion} /><WaterHistoryChart key={`${station.id}:${station.datum}`} station={station} version={data?.fetchedAt ?? ""} refresh={refresh + reload} motion={motion}/><p className="ov-water-time">เวลาตรวจวัด {readingTime(station)} (เวลาไทย)<br />หน่วยงานตรวจวัด: {station.agency}</p><a className="ov-text-link" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${station.lat}&mlon=${station.lng}#map=15/${station.lat}/${station.lng}`}><MapIcon name="pin" size={17} />เปิดตำแหน่งสถานี<MapIcon name="arrow" size={16} /></a></> : <div className="ov-empty">{loading ? "กำลังโหลดค่าตรวจวัดระดับน้ำ…" : "เลือกจังหวัดหรือประเภททางน้ำอื่นเพื่อดูสถานีที่มีข้อมูล"}</div>}</div></div>
    <details className="ov-water-risk-guide"><summary>อ่านเกณฑ์สีระดับน้ำ<MapIcon name="chevron" size={17} /></summary><div className="ov-water-band-key">{[{ name: "น้ำน้อยวิกฤติ", range: "≤10%", priority: 3 }, { name: "น้ำน้อย", range: ">10–30%", priority: 1 }, { name: "น้ำปกติ", range: ">30–70%", priority: 0 }, { name: "น้ำมาก", range: ">70–100%", priority: 2 }, { name: "ล้นตลิ่ง", range: ">100%", priority: 3 }].map((band) => <div key={band.name} style={riskStyle(band.priority)}><i /><b>{band.name}</b><span>{band.range}</span></div>)}</div><p>เปอร์เซ็นต์ความจุเป็นค่าที่ต้นทางส่งมา ไม่ใช่โอกาสน้ำท่วม ข้อมูลเก่าและสถานีที่ไม่มีเกณฑ์จะแสดงเป็นสถานะยังประเมินไม่ได้ <a href="https://tiwrm.hii.or.th/thaiwater_l5/public/telemetering/wl/warning" target="_blank" rel="noreferrer">ดูเกณฑ์ ThaiWater</a></p></details>
    {resource.error && <p className="obs-error" role="status">{resource.error}</p>}
    <div className="ov-water-notes"><p>รทก. คือระดับอ้างอิงน้ำทะเลปานกลาง ค่านี้ไม่ใช่ความลึกของน้ำท่วม ข้อมูลเป็นรายสถานี ไม่มีการประมาณระดับน้ำทั้งย่านหรือพยากรณ์ 7 วัน ค่าที่เก่ากว่า 24 ชั่วโมงหรือเวลาไม่สอดคล้องจะแสดง —</p><div><a href="https://www.thaiwater.net/water" target="_blank" rel="noreferrer">ที่มา: ThaiWater · คลังข้อมูลน้ำแห่งชาติ<MapIcon name="arrow" size={15} /></a><a href="https://weather.bangkok.go.th/KlongMap" target="_blank" rel="noreferrer">แผนที่คลองของ กทม.<MapIcon name="arrow" size={15} /></a></div></div>
  </section>;
}
