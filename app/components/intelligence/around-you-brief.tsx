"use client";
import { useMemo, useState, type ReactNode } from "react";
import { localAirReading, localWaterReading } from "../../lib/around-you";
import { currentForecastIndex } from "../../lib/dashboard-controls";
import { overviewStepValue, overviewTimestamp } from "../../lib/environment-overview";
import { forecastPeriod, forecastSamples } from "../../lib/forecast-content";
import { formatValue, relativeDay, type EnvironmentLayer, type MapDataset } from "../../lib/map-intelligence";
import type { MapBoundary } from "../../lib/map-surface";
import type { MapPlace } from "../../lib/map-places";
import { getRegion, type RegionId } from "../../lib/provinces";
import { currentNearbyRain, type NearbyRainPayload } from "../../lib/rain-nearby";
import type { AirObservationPayload } from "../../lib/air-observations";
import { formatWaterValue, waterRisk, type WaterPayload } from "../../lib/water-levels";
import { thaiObservationTime } from "../../lib/observation-time";
import BriefingChart, { AnimatedNumber } from "./briefing-chart";
import WaterHistoryChart from "./water-history-chart";
import { MapIcon, goToStory } from "./map-ui";
import type { LiveResource } from "./use-live-resource";

type Topic = EnvironmentLayer | "water";
type ForecastSource = { data: MapDataset | null; loading: boolean; error: string };
const topics = [
  { id: "rain", title: "ฝน", hint: "เรดาร์และโอกาสฝน", icon: "rain" },
  { id: "water", title: "ระดับน้ำ", hint: "คลองและแม่น้ำ", icon: "water" },
  { id: "air", title: "ฝุ่น PM2.5", hint: "ตรวจวัดและแนวโน้ม", icon: "air" },
  { id: "heat", title: "ความร้อน", hint: "อุณหภูมิที่รู้สึก", icon: "heat" },
] as const;

export default function AroundYouBrief({ region, place, boundary, sources, air, water, rain, clock, today, dates, date, indices, following, refresh, onTime, onDate, children }: {
  region: RegionId; place: MapPlace | null; boundary: MapBoundary | null;
  sources: Record<EnvironmentLayer, ForecastSource>; air: LiveResource<AirObservationPayload>;
  water: LiveResource<WaterPayload>; rain: LiveResource<NearbyRainPayload>;
  clock: number; today: string; dates: string[]; date: string; indices: Record<EnvironmentLayer, number>; following: boolean; refresh: number;
  onTime: (layer: EnvironmentLayer, index: number) => void; onDate: (date: string) => void; children: ReactNode;
}) {
  const [topic, setTopic] = useState<Topic>("rain");
  const waterReading = localWaterReading(water.data, region, place, clock);
  const airReading = localAirReading(air.data, region, place, clock);
  const nearby = currentNearbyRain(rain.data, clock);
  const currentValue = (layer: EnvironmentLayer, metric: "primary" | "secondary") => {
    const source = sources[layer];
    return source.loading || source.error ? null : overviewStepValue(source.data, currentForecastIndex(source.data?.steps ?? [], new Date(clock)), metric, place, boundary);
  };
  const currentPeriod = (layer: EnvironmentLayer) => sources[layer].data?.status === "unavailable" || sources[layer].error ? "ยังไม่มีพยากรณ์จากต้นทาง" : forecastPeriod(sources[layer].data?.steps[currentForecastIndex(sources[layer].data?.steps ?? [], new Date(clock))], today);
  const cards = {
    rain: { value: currentValue("rain", "secondary"), unit: "มม.", label: "ฝนสะสม · พยากรณ์", note: currentPeriod("rain"), loading: sources.rain.loading },
    water: { value: place ? waterReading.value : waterReading.stations.length || null, unit: place ? waterReading.station ? waterReading.station.datum === "msl" ? "ม. รทก." : "ม. ที่สถานี" : "ม." : "สถานี", label: place ? "ค่าตรวจวัดใกล้พื้นที่" : "สถานีที่มีค่าล่าสุด", note: place ? waterReading.station ? `${waterReading.station.name} · ${formatValue(waterReading.station.distanceKm)} กม. · ${thaiObservationTime(waterReading.station.observedAt)} น.` : "ยังไม่มีค่าล่าสุดในระยะ 8 กม." : waterReading.stations.length ? `${waterReading.attention.length} สถานีเข้าเกณฑ์ติดตาม` : "ยังไม่มีค่าตรวจวัดล่าสุด", loading: water.loading },
    air: { value: airReading.value, unit: "µg/m³", label: "ฝุ่น · ค่าตรวจวัด", note: airReading.station ? `${airReading.station.name} · ${formatValue(airReading.distanceKm)} กม. · ${airReading.station.source} · ${thaiObservationTime(airReading.observedAt)} น.` : airReading.count ? `เฉลี่ย ${airReading.count} สถานี · ${airReading.sources.join(" / ")}` : place ? "ยังไม่มีค่าล่าสุดในระยะ 30 กม." : "ยังไม่มีค่าตรวจวัดล่าสุด", loading: air.loading },
    heat: { value: currentValue("heat", "primary"), unit: "°C", label: "ดัชนีความร้อน · พยากรณ์", note: currentPeriod("heat"), loading: sources.heat.loading },
  };
  const layer = topic === "water" ? "rain" : topic;
  const source = sources[layer], index = indices[layer], step = source.data?.status === "unavailable" ? undefined : source.data?.steps[index];
  const metric = layer === "rain" ? "secondary" : "primary";
  const readings = useMemo(() => {
    const value = (i: number, kind: "primary" | "secondary") => source.loading || source.error ? null : overviewStepValue(source.data, i, kind, place, boundary);
    return { values: source.data?.steps.map((_, i) => value(i, metric)) ?? [], secondary: layer === "heat" ? source.data?.steps.map((_, i) => value(i, "secondary")) ?? [] : [] };
  }, [source.data, source.loading, source.error, metric, layer, place, boundary]);
  const valueAt = (i: number, secondary = false) => (secondary ? readings.secondary : readings.values)[i] ?? null;
  const values = readings.values;
  const samples = forecastSamples(source.data, values, index, following, today).map(sample => layer === "heat" ? { ...sample, secondary: valueAt(sample.index, true) } : sample);
  const peak = samples.filter(sample => sample.value !== null).reduce<(typeof samples)[number] | null>((best, item) => !best || item.value! > best.value! ? item : best, null);
  const unit = layer === "air" ? "µg/m³" : layer === "heat" ? "°C" : "มม.";
  const title = layer === "air" ? "แนวโน้มฝุ่น 7 วัน" : layer === "heat" ? step?.window === null ? "ความร้อนสูงสุดรายวัน" : "ความร้อนในแต่ละช่วงเวลา" : step?.window === null ? "ฝนสะสมในแต่ละวัน" : "ฝนจะมาเมื่อไร";
  return <section className="ay-brief" id="around-you" tabIndex={-1} aria-labelledby="around-you-title">
    <div className="ay-heading"><div><span className="ay-eyebrow">รู้รอบพื้นที่ ก่อนออกจากบ้าน</span><h2 id="around-you-title">สี่เรื่องรอบตัวคุณ</h2><p>{place ? `จุดอ้างอิง ${place.road || place.district}` : `${getRegion(region).shortNameTh} · เลือกพื้นที่เพื่อดูใกล้ตัว`}</p></div><span className="ay-current-label"><MapIcon name="clock" size={17}/>สรุปตามเวลาปัจจุบัน</span></div>
    <div className="ay-topics" role="group" aria-label="เลือกเรื่องในสรุปรอบตัว">{topics.map(item => {
      const card = cards[item.id];
      return <button key={item.id} className={`ay-topic ay-${item.id}`} aria-pressed={topic === item.id} aria-controls="around-you-trend" onClick={() => { setTopic(item.id); requestAnimationFrame(() => goToStory("around-you-trend")); }}>
        <span className="ay-topic-title"><MapIcon name={item.icon} size={24}/><b>{item.title}</b><MapIcon name="arrow" size={18}/></span>
        <span className="ay-topic-label">{card.label}</span><span className="ay-value">{card.loading ? <span className="ay-loading">กำลังโหลด</span> : item.id === "water" && place ? formatWaterValue(card.value) : <AnimatedNumber value={card.value}/>}<small>{card.unit}</small></span>
        <span className="ay-topic-note">{card.loading ? item.hint : card.note}</span><span className="ay-topic-state">{topic === item.id ? "กำลังดูรายละเอียด" : "แตะดูกราฟและรายละเอียด"}</span>
      </button>;
    })}</div>
    {children}
    <section className={`ay-focus ay-${topic}`} id="around-you-trend" tabIndex={-1} aria-labelledby="around-you-trend-title">
      <div className="ay-focus-top"><span><MapIcon name={topic} size={24}/>{topics.find(item => item.id === topic)?.title}</span><button className="ay-detail-link" onClick={() => goToStory(`chapter-${topic}`)}>ดูเรื่องนี้ทั้งหมด<MapIcon name="arrow" size={17}/></button></div>
      {topic !== "water" && dates.length > 0 && <div className="ay-dates" role="group" aria-label="เลือกวันพยากรณ์รอบตัว">{dates.map(day => <button key={day} aria-pressed={!following && date === day} onClick={() => onDate(day)}>{relativeDay(day, today)}</button>)}</div>}
      {topic === "water" ? <><div className="ay-water-head"><div><h3 id="around-you-trend-title">ระดับน้ำจากสถานีจริง</h3><p>ค่าล่าสุดของแต่ละสถานี · ไม่ใช่ความลึกน้ำท่วม</p></div><strong>{waterReading.stations.length}<small>สถานีที่ใช้ได้{place && " ใน 8 กม."}</small></strong></div>
        {waterReading.station ? <><div className="ay-water-reading"><b>{waterReading.station.name}</b><strong>{formatWaterValue(waterReading.station.value)} <small>{waterReading.station.datum === "msl" ? "ม. รทก." : "ม. ที่สถานี"}</small></strong><p>{waterRisk(waterReading.station).title} · ตรวจวัด {thaiObservationTime(waterReading.station.observedAt)} น. · ห่างจุดอ้างอิง {formatValue(waterReading.station.distanceKm)} กม.</p></div><WaterHistoryChart station={waterReading.station} version={water.data?.fetchedAt ?? ""} refresh={refresh} motion/></> : <div className="ay-water-stations">{waterReading.stations.slice(0, 3).map(station => <div key={station.id}><span><b>{station.name}</b><small>{waterRisk(station).title} · {thaiObservationTime(station.observedAt)} น.</small></span><strong>{formatWaterValue(station.value)}<small>{station.datum === "msl" ? "ม. รทก." : "ม. ที่สถานี"}</small></strong></div>)}{!waterReading.stations.length && <p role="status">{water.loading ? "กำลังอ่านข้อมูลสถานีน้ำ…" : "ยังไม่มีค่าตรวจวัดล่าสุดในพื้นที่นี้"}</p>}<p>เลือกพื้นที่เพื่อดูสถานีใกล้คุณและกราฟย้อนหลัง โดยไม่เฉลี่ยระดับน้ำต่างสถานีเข้าด้วยกัน</p></div>}</> : <>
        <div className="ay-trend-heading"><div><h3 id="around-you-trend-title">{title}</h3><p>{forecastPeriod(step, today)}{step && ` · ${step.cadence === "hour" ? "รายชั่วโมง" : step.window !== null ? "ตามช่วงต้นทาง" : "รายวัน"}`}</p></div><div className="ay-focus-number"><AnimatedNumber value={valueAt(index)}/><small>{unit}</small><span>ค่าพยากรณ์{!place && " · เฉลี่ยจุดที่มีข้อมูล"}</span></div></div>
        <BriefingChart key={layer} layer={layer} samples={samples} activeKey={step?.key} onSelect={i => onTime(layer, i)} unit={unit} title={title} kind={layer === "rain" ? "bar" : "line"} loading={source.loading} secondaryLabel={layer === "heat" ? "อุณหภูมิอากาศ" : undefined}/>
        <div className="ay-chart-context"><p>{peak ? <>สูงสุดในกราฟ <b>{formatValue(peak.value)} {unit}</b> · {peak.label}</> : "ยังไม่มีข้อมูลพอสำหรับสรุปแนวโน้ม"}</p><span>แตะกราฟเลือกเวลา · ใช้ปุ่มลูกศรได้</span></div>
        {layer === "rain" && <div className="ay-radar-note"><MapIcon name="radar" size={25}/><p><b>สัญญาณฝนใกล้พื้นที่</b><span>{!place ? "เลือกพื้นที่เพื่อเช็กฝนในระยะ 8 กม." : rain.loading ? "กำลังวิเคราะห์ภาพเรดาร์…" : nearby?.message ?? "ยังไม่มีภาพล่าสุดพอสำหรับวิเคราะห์"}</span></p><button onClick={() => goToStory("rain-radar")}>เปิดเรดาร์<MapIcon name="arrow" size={17}/></button></div>}
        <p className="ay-source">{layer === "rain" ? step?.window === null ? "ฝนสะสมตลอดวัน 00:00–24:00" : "ยอดฝนสะสมตามช่วงที่เลือก ไม่ใช้จัดระดับฝนทั้งวัน" : layer === "air" ? "พยากรณ์ความเข้มข้นเฉลี่ยรายวัน แยกจากค่าตรวจวัดด้านบน" : "ดัชนีความร้อนแยกจากอุณหภูมิอากาศเส้นประ"} · {source.data?.model ?? "รอข้อมูลต้นทาง"} · โหลด {overviewTimestamp(source.data)}{source.error && ` · ${source.error}`}</p>
      </>}
    </section>
  </section>;
}
