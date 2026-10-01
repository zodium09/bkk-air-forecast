"use client";
import type { ReactNode } from "react";

import { formatValue, metricName, relativeDay, type EnvironmentLayer, type MapDataset, type Metric } from "../../lib/map-intelligence";
import { timelineIndices } from "../../lib/dashboard-controls";
import { placeReading } from "../../lib/place-outlook";
import { overviewTimestamp, sourceState } from "../../lib/environment-overview";
import BriefingChart, { AnimatedNumber } from "./briefing-chart";
import { MapIcon } from "./map-ui";
import { RiskMeter } from "./risk-signals";

const copy = {
  air: { title: "หายใจได้แค่ไหน", description: "รู้ทันฝุ่นใกล้ตัว ก่อนวางแผนวันของคุณ", chart: "แนวโน้มฝุ่น 7 วัน", note: "PM2.5 เป็นพยากรณ์ค่าเฉลี่ยรายวัน" },
  rain: { title: "วันนี้ต้องพกร่มไหม", description: "ดูช่วงฝน ปริมาณสะสม และระดับน้ำล่าสุด", chart: "ช่วงฝนที่ควรเตรียมตัว", note: "ปริมาณสะสมตามช่วงเวลาที่เลือก ไม่ใช่ความลึกน้ำท่วม" },
  heat: { title: "ร้อนแค่ไหนในวันนี้", description: "ดูอุณหภูมิและความร้อนที่ร่างกายรู้สึก", chart: "แนวโน้มความร้อน", note: "ดัชนีความร้อนคำนวณจากอุณหภูมิและความชื้น" },
};

export default function TopicBriefing({ layer, data, values, index, metric, scope, loading, error, following, onNow, onTime, onMetric, currentObservation }: {
  layer: EnvironmentLayer; data: MapDataset | null; values: (number | null)[]; index: number; metric: Metric; scope: string;
  loading: boolean; error: string; following: boolean; onNow: () => void; onTime: (index: number) => void; onMetric: (metric: Metric) => void;
  currentObservation?: ReactNode;
}) {
  const step = data?.steps[index];
  const value = values[index] ?? null;
  const reading = placeReading(layer, metric, value, step);
  const indices = timelineIndices(data?.steps ?? [], index);
  const daily = step?.window === null;
  // Keep the chart stable when a point is selected; inspect within this day's cadence.
  const chartIndices = daily ? indices : indices.filter((i) => data?.steps[i].date === step?.date);
  const samples = chartIndices.map((i) => ({ index: i, key: data!.steps[i].key, value: values[i] ?? null, label: daily ? relativeDay(data!.steps[i].date) : data!.steps[i].label.split(" · ")[0] }));
  const valid = samples.filter((sample) => sample.value !== null);
  const maximum = valid.length ? Math.max(...valid.map((sample) => sample.value!)) : null;
  const peak = valid.find((sample) => sample.value === maximum);
  const unit = layer === "air" ? "µg/m³" : layer === "rain" && metric === "secondary" ? "มม." : layer === "rain" ? "%" : "°C";
  const trendTitle = layer === "heat" && metric === "secondary" ? "แนวโน้มอุณหภูมิ" : copy[layer].chart;
  const metricControls = layer === "heat" ? <div className="bf-metric-tabs" role="group" aria-label="เลือกข้อมูลความร้อน"><button aria-pressed={metric === "primary"} onClick={() => onMetric("primary")}>ความร้อนที่รู้สึก</button><button aria-pressed={metric === "secondary"} onClick={() => onMetric("secondary")}>อุณหภูมิ</button></div> : null;
  return <section className={`bf-topic bf-${layer}`} id="topic-briefing" aria-label={`สรุป${metricName(layer, metric)}`}>
    <div className="bf-topic-intro"><div><p className="bf-topic-location"><MapIcon name="pin" size={16} />{scope}</p><h1>{copy[layer].title}</h1><p>{copy[layer].description}</p></div><button className={`bf-now${following ? " is-current" : ""}`} onClick={onNow} aria-pressed={following}><i />{following ? "ตามเวลาปัจจุบัน" : "กลับเวลาปัจจุบัน"}<MapIcon name={following ? "clock" : "refresh"} size={16} /></button></div>
    {currentObservation}
    <div className="bf-topic-layout"><div className="bf-topic-reading"><span className="bf-period">{step ? `${relativeDay(step.date)} · ${step.label}` : "กำลังรอช่วงพยากรณ์"}</span>{metricControls}<h2>{metricName(layer, metric)}</h2><div className="bf-main-number">{loading ? <span className="bf-number-skeleton" /> : <AnimatedNumber value={value} />}<small>{unit}</small></div><b className="bf-reading-verdict">{loading ? "กำลังเชื่อมต่อข้อมูล" : reading.title}</b><RiskMeter priority={loading ? -1 : reading.priority} compact /><p className="bf-next-step">{loading ? "ค่าจะแสดงเมื่อแหล่งข้อมูลพร้อม" : reading.action}</p><small>{(layer === "heat" && metric === "secondary" ? "อุณหภูมิอากาศจากแบบจำลองตามช่วงเวลาที่เลือก" : copy[layer].note)}</small></div><div className="bf-topic-trend"><div className="bf-trend-heading"><h2>{trendTitle}</h2><span>{daily ? "รายวัน" : step?.cadence === "hour" ? "รายชั่วโมง" : "ทุก 3 ชั่วโมง"}</span></div><BriefingChart layer={layer} samples={samples} activeKey={step?.key} onSelect={onTime} unit={unit} title={trendTitle} loading={loading} /><div className="bf-trend-summary"><span>สูงสุด <b>{formatValue(maximum)} {unit}</b>{peak && <small>{peak.label}</small>}</span><span>เลือกจุดบนกราฟ<br /><small>แผนที่และตัวเลขเปลี่ยนตาม</small></span></div></div></div>
    <div className="bf-topic-bottom"><span className="bf-source-state"><i />{sourceState(data, loading, error)}<small>{data && ` · ${overviewTimestamp(data)} น. · ${data.model}`}</small></span><div><a href="#map-story"><MapIcon name="map" size={16} />สำรวจแผนที่</a>{layer === "rain" && <a href="#water-levels"><MapIcon name="rain" size={16} />ระดับน้ำล่าสุด</a>}<a href={`/${layer}/advanced`}>เครื่องมือขั้นสูง<MapIcon name="arrow" size={15} /></a></div></div>
  </section>;
}
