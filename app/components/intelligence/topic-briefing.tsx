"use client";
import type { ReactNode } from "react";

import { formatValue, metricName, relativeDay, type EnvironmentLayer, type MapDataset, type Metric } from "../../lib/map-intelligence";
import { forecastPeriod, forecastSamples } from "../../lib/forecast-content";
import { placeReading } from "../../lib/place-outlook";
import { overviewTimestamp, sourceState } from "../../lib/environment-overview";
import BriefingChart, { AnimatedNumber } from "./briefing-chart";
import { MapIcon } from "./map-ui";
import { RiskMeter } from "./risk-signals";

const copy = {
  air: { title: "ฝุ่น PM2.5 ใกล้คุณ", description: "ค่าตรวจวัดล่าสุดและพยากรณ์รายวัน แยกแหล่งข้อมูลชัดเจน", chart: "แนวโน้มฝุ่น 7 วัน", note: "PM2.5 เป็นพยากรณ์ค่าเฉลี่ยรายวัน แยกจากค่าตรวจวัดด้านบน" },
  rain: { title: "ฝนจะมาเมื่อไร", description: "ดูปริมาณฝนและโอกาสเกิดฝน ก่อนสำรวจถนน คลอง และแม่น้ำ", chart: "ช่วงฝนที่ควรเตรียมตัว", note: "ปริมาณสะสมตามช่วงเวลาที่เลือก ไม่ใช่ฝนที่ตกแล้วหรือความลึกน้ำท่วม" },
  heat: { title: "วางแผนรับความร้อน", description: "เทียบอุณหภูมิอากาศกับดัชนีความร้อน แล้วเลือกช่วงทำกิจกรรม", chart: "ความร้อนและอุณหภูมิตามช่วงเวลา", note: "ดัชนีความร้อนคำนวณจากอุณหภูมิและความชื้น ไม่ใช่ค่าตรวจวัดอุณหภูมิ" },
};

export default function TopicBriefing({ layer, data, values, companionValues = [], index, metric, scope, loading, error, following, onNow, onTime, onMetric, currentObservation }: {
  layer: EnvironmentLayer; data: MapDataset | null; values: (number | null)[]; index: number; metric: Metric; scope: string;
  loading: boolean; error: string; following: boolean; onNow: () => void; onTime: (index: number) => void; onMetric: (metric: Metric) => void;
  currentObservation?: ReactNode;
  companionValues?: (number | null)[];
}) {
  const step = data?.steps[index];
  const value = values[index] ?? null;
  const reading = placeReading(layer, metric, value, step);
  const daily = step?.window === null;
  const samples = forecastSamples(data, values, index, layer === "rain" && following && !daily).map(sample => layer === "heat" && metric === "primary" ? { ...sample, secondary: companionValues[sample.index] ?? null } : sample);
  const days = data?.steps.flatMap((candidate, i) => candidate.window === null ? [{ index: i, key: candidate.key, value: values[i] ?? null, label: relativeDay(candidate.date), secondary: layer === "heat" && metric === "primary" ? companionValues[i] ?? null : undefined }] : []) ?? [];
  const valid = samples.filter((sample) => sample.value !== null);
  const maximum = valid.length ? Math.max(...valid.map((sample) => sample.value!)) : null;
  const peak = valid.find((sample) => sample.value === maximum);
  const unit = layer === "air" ? "µg/m³" : layer === "rain" && metric === "secondary" ? "มม." : layer === "rain" ? "%" : "°C";
  const trendTitle = layer === "heat" && metric === "secondary" ? "แนวโน้มอุณหภูมิ" : layer === "rain" && metric === "primary" ? "โอกาสฝนตามช่วงเวลา" : copy[layer].chart;
  const metricControls = layer === "heat" ? <div className="bf-metric-tabs" role="group" aria-label="เลือกข้อมูลความร้อน"><button aria-pressed={metric === "primary"} onClick={() => onMetric("primary")}>ดัชนีความร้อน</button><button aria-pressed={metric === "secondary"} onClick={() => onMetric("secondary")}>อุณหภูมิ</button></div> : layer === "rain" ? <div className="bf-metric-tabs" role="group" aria-label="เลือกข้อมูลฝน"><button aria-pressed={metric === "secondary"} onClick={() => onMetric("secondary")}>ปริมาณฝน</button><button aria-pressed={metric === "primary"} onClick={() => onMetric("primary")}>โอกาสฝน</button></div> : null;
  return <section className={`bf-topic bf-${layer}`} id="topic-briefing" aria-label={`สรุป${metricName(layer, metric)}`}>
    <div className="bf-topic-intro"><div><p className="bf-topic-location"><MapIcon name="pin" size={16} />{scope}</p><h1>{copy[layer].title}</h1><p>{copy[layer].description}</p></div><button className={`bf-now${following ? " is-current" : ""}`} onClick={onNow} aria-pressed={following}><i />{following ? "ตามเวลาปัจจุบัน" : "กลับเวลาปัจจุบัน"}<MapIcon name={following ? "clock" : "refresh"} size={16} /></button></div>
    {currentObservation}
    <div className="bf-topic-layout"><div className="bf-topic-reading"><span className="bf-period">{forecastPeriod(step)}</span>{metricControls}<h2>{metricName(layer, metric)}</h2><div className="bf-main-number">{loading ? <span className="bf-number-skeleton" /> : <AnimatedNumber value={value} />}<small>{unit}</small></div><b className="bf-reading-verdict">{loading ? "กำลังเชื่อมต่อข้อมูล" : reading.title}</b>{layer === "rain" && (!daily || metric === "primary") ? <p className="fc-source-note">{metric === "primary" ? daily ? "โอกาสฝนรายชั่วโมงสูงสุดของวัน ไม่ใช่โอกาสเกิดฝนตลอดวัน" : "โอกาสฝนในช่วงที่เลือก ไม่ใช่ปริมาณฝน" : step?.cadence === "hour" ? "ยอดสะสม 1 ชั่วโมง · ไม่ใช้เกณฑ์ฝนทั้งวันจัดระดับความเสี่ยง" : "ยอดสะสมตามช่วงที่เลือก · ไม่ใช้เกณฑ์ฝนทั้งวันจัดระดับความเสี่ยง"}</p> : layer === "heat" && metric === "secondary" ? <p className="fc-source-note">อุณหภูมิอากาศแสดงแยกจากระดับความเสี่ยงของดัชนีความร้อน</p> : <RiskMeter priority={loading ? -1 : reading.priority} compact />}<p className="bf-next-step">{loading ? "ค่าจะแสดงเมื่อแหล่งข้อมูลพร้อม" : reading.action}</p><small>{(layer === "heat" && metric === "secondary" ? "อุณหภูมิอากาศจากแบบจำลองตามช่วงเวลาที่เลือก" : layer === "rain" && metric === "primary" ? "โอกาสฝนเป็นอีกตัวแปรหนึ่ง ไม่ใช้คำนวณปริมาณฝน" : copy[layer].note)}</small></div><div className="bf-topic-trend"><div className="bf-trend-heading"><h2>{trendTitle}</h2><span>{daily ? "รายวัน" : step?.cadence === "hour" ? "รายชั่วโมง" : "ทุก 3 ชั่วโมง"}</span></div><BriefingChart layer={layer} samples={samples} activeKey={step?.key} onSelect={onTime} unit={unit} title={trendTitle} kind={layer === "rain" && metric === "secondary" ? "bar" : "line"} secondaryLabel={layer === "heat" && metric === "primary" ? "อุณหภูมิอากาศ" : undefined} loading={loading} /><div className="bf-trend-summary"><span>สูงสุด <b>{formatValue(maximum)} {unit}</b>{peak && <small>{peak.label}</small>}</span><span>เลือกจุดบนกราฟ<br /><small>แผนที่และตัวเลขเปลี่ยนตาม</small></span></div></div></div>
    {!daily && <details className="fc-daily"><summary>ดูพยากรณ์รายวัน 7 วัน<MapIcon name="chevron" size={17}/></summary><p className="fc-source-note">{layer === "heat" ? "ค่าสูงสุดของแต่ละวัน" : metric === "secondary" ? "ฝนสะสม 00:00–24:00 เวลาไทย" : "โอกาสฝนรายชั่วโมงสูงสุดในแต่ละวัน"} · เลือกวันบนกราฟเพื่อดูรายละเอียด</p><BriefingChart layer={layer} samples={days} activeKey={step?.window === null ? step.key : undefined} onSelect={onTime} unit={unit} title="พยากรณ์รายวัน 7 วัน" kind={layer === "rain" && metric === "secondary" ? "bar" : "line"} secondaryLabel={layer === "heat" && metric === "primary" ? "อุณหภูมิสูงสุด" : undefined} loading={loading}/></details>}
    <div className="bf-topic-bottom"><span className="bf-source-state"><i />{sourceState(data, loading, error)}<small>{data && ` · ${overviewTimestamp(data)} น. · ${data.model}`}</small></span><div><a href="#map-story"><MapIcon name="map" size={16} />สำรวจแผนที่</a>{layer === "rain" && <a href="#water-levels"><MapIcon name="rain" size={16} />ระดับน้ำล่าสุด</a>}<a href={`/${layer}/advanced`}>เครื่องมือขั้นสูง<MapIcon name="arrow" size={15} /></a></div></div>
  </section>;
}
