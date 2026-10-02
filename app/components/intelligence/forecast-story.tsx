"use client";

import { useState } from "react";
import { dailyIndex, overviewTimestamp, sourceState } from "../../lib/environment-overview";
import { forecastDetailIndex, forecastPeriod, forecastSamples } from "../../lib/forecast-content";
import { formatValue, type EnvironmentLayer, type MapDataset, type Metric } from "../../lib/map-intelligence";
import { placeReading } from "../../lib/place-outlook";
import BriefingChart, { AnimatedNumber } from "./briefing-chart";
import ForecastInfographic from "./forecast-infographic";
import { MapIcon } from "./map-ui";
import { RiskMeter } from "./risk-signals";

const content = {
  air: { title: "ฝุ่น PM2.5", description: "ดูค่าพยากรณ์รายวัน แล้วเช็กสถานีตรวจวัดอีกครั้งก่อนออกเดินทาง", unit: "µg/m³", metric: "primary", chart: "พยากรณ์ฝุ่น 7 วัน", period: "ความเข้มข้นเฉลี่ยรายวัน", source: "ค่าพยากรณ์และค่าประมาณเชิงพื้นที่" },
  rain: { title: "ฝนจะมาเมื่อไร", description: "อ่านปริมาณสะสมคู่กับโอกาสฝน แล้วเลือกช่วงเวลาที่จะเดินทาง", unit: "มม.", metric: "secondary", chart: "ปริมาณฝนตามช่วงเวลา", period: "ฝนสะสมตลอดวัน 00:00–24:00", source: "พยากรณ์จากกริดตามพิกัดต้นทาง" },
  heat: { title: "วางแผนรับความร้อน", description: "เทียบอุณหภูมิอากาศกับดัชนีความร้อน เพื่อเลือกช่วงที่เหมาะกับกิจกรรม", unit: "°C", metric: "primary", chart: "ความร้อนและอุณหภูมิตามช่วงเวลา", period: "ดัชนีความร้อนสูงสุดของแต่ละวัน", source: "ค่าพยากรณ์และค่าประมาณเชิงพื้นที่" },
} as const;

export default function ForecastStory({ layer, data, index, loading, error, today, date, dates, scope, following, href, valueAt, onTime, onDate }: {
  layer: EnvironmentLayer; data: MapDataset | null; index: number; loading: boolean; error: string; today: string; date: string; dates: string[];
  scope: string; following: boolean; href: string; valueAt: (index: number, metric: Metric) => number | null; onTime: (index: number) => void; onDate: (date: string) => void;
}) {
  const [rainMetric, setRainMetric] = useState<Metric>("secondary");
  const copy = content[layer];
  const step = data?.steps[index];
  const metric = layer === "rain" ? rainMetric : copy.metric;
  const value = loading ? null : valueAt(index, metric);
  const reading = placeReading(layer, metric, value, step);
  const daily = step?.window === null;
  const unit = layer === "rain" && metric === "primary" ? "%" : copy.unit;
  const values = data?.steps.map((_, i) => valueAt(i, metric)) ?? [];
  const samples = forecastSamples(data, values, index, layer === "rain" && following && !daily, today).map(sample => layer === "heat" ? { ...sample, secondary: valueAt(sample.index, "secondary") } : sample);
  const valid = samples.filter(sample => sample.value !== null);
  const peak = valid.reduce<(typeof samples)[number] | null>((best, sample) => !best || sample.value! > best.value! ? sample : best, null);
  const period = forecastPeriod(step, today);
  const detailIndex = forecastDetailIndex(data, step?.date);
  const chartTitle = daily ? layer === "rain" ? metric === "primary" ? "โอกาสฝนรายชั่วโมงสูงสุดของแต่ละวัน" : "พยากรณ์ฝนสะสม 7 วัน" : layer === "heat" ? "ดัชนีความร้อนสูงสุด 7 วัน" : copy.chart : layer === "rain" && metric === "primary" ? "โอกาสฝนตามช่วงเวลา" : copy.chart;
  const chance = layer === "rain" ? valueAt(index, "primary") : null;
  return <section id={`forecast-${layer}`} className={`fc-story bf-${layer}`} aria-labelledby={`forecast-${layer}-heading`} tabIndex={-1}>
    <div className="fc-story-heading"><div><h2 id={`forecast-${layer}-heading`}><MapIcon name={layer} size={27} />{copy.title}<span className="fc-data-tag">พยากรณ์</span></h2><p>{copy.description}</p></div><a href={href}>เปิดหน้า{layer === "air" ? "ฝุ่น" : layer === "rain" ? "ฝน / น้ำ" : "ความร้อน"}<MapIcon name="arrow" size={17} /></a></div>
    <div className="fc-story-layout"><div className="fc-story-reading"><p className="fc-period"><MapIcon name="clock" size={16} />{period}</p><h3>{layer === "air" ? "PM2.5 เฉลี่ยรายวัน" : layer === "heat" ? daily ? "ดัชนีความร้อนสูงสุดของวัน" : "ดัชนีความร้อน" : metric === "secondary" ? "พยากรณ์ฝนสะสม" : daily ? "โอกาสฝนรายชั่วโมงสูงสุดของวัน" : "โอกาสฝนรายชั่วโมง"}</h3><div className="fc-value">{loading ? "…" : <AnimatedNumber value={value} />}<small>{unit}</small></div><p className="fc-verdict">{loading ? "กำลังโหลดพยากรณ์…" : reading.title}</p>
      {layer === "rain" && !daily && metric === "secondary" ? <p className="fc-assessment-note">ช่วงนี้เป็น{step?.cadence === "hour" ? "ยอดสะสม 1 ชั่วโมง" : "ยอดสะสมตามช่วงที่เลือก"} จึงไม่ใช้เกณฑ์ฝนทั้งวันจัดระดับความเสี่ยง</p> : layer === "rain" && metric === "primary" ? <p className="fc-assessment-note">{daily ? "ค่าสูงสุดรายชั่วโมงของวันที่เลือก ไม่ใช่โอกาสฝนตลอดวัน" : "โอกาสเกิดฝนในช่วงที่เลือก ไม่ใช่เปอร์เซ็นต์ปริมาณน้ำ"}</p> : <RiskMeter priority={reading.priority} compact />}
      <p className="fc-action">{reading.action}</p><p className="fc-scope"><MapIcon name="pin" size={15} />{scope}</p>
      {layer === "rain" && metric === "secondary" && <div className="fc-companion"><span>{daily || step?.cadence === "window" ? "โอกาสฝนรายชั่วโมงสูงสุดในช่วงนี้" : "โอกาสฝนในชั่วโมงนี้"}</span><b>{formatValue(chance)}<small>%</small></b></div>}
      {layer === "heat" && <div className="fc-companion"><span>{daily ? "อุณหภูมิสูงสุดของวัน" : "อุณหภูมิอากาศในช่วงนี้"}</span><b>{formatValue(valueAt(index, "secondary"))}<small>°C</small></b></div>}
      <a className="fc-guidance" href={layer === "heat" ? "https://www.anamai.moph.go.th/th/news-anamai/44861" : layer === "air" ? "https://air4thai.pcd.go.th/" : "https://www.tmd.go.th/"} target="_blank" rel="noreferrer">{layer === "heat" ? "อ่านคำแนะนำกรมอนามัย" : layer === "air" ? "เช็กค่าฝุ่นจากหน่วยงาน" : "ติดตามประกาศกรมอุตุนิยมวิทยา"}<MapIcon name="arrow" size={15} /></a>
    </div><div className="fc-story-chart"><div className="fc-chart-heading"><h3>{chartTitle}</h3>{layer === "rain" && <div className="fc-chart-switch" aria-label="เลือกตัวแปรฝน"><button aria-pressed={metric === "secondary"} onClick={() => setRainMetric("secondary")}>ปริมาณฝน</button><button aria-pressed={metric === "primary"} onClick={() => setRainMetric("primary")}>โอกาสฝน</button></div>}</div>
      {layer === "air" ? <ForecastInfographic layer="air" title="ฝุ่น PM2.5" unit={copy.unit} period={copy.period} date={step?.date ?? date} today={today} loading={loading} onDate={onDate} days={dates.map(day => { const amount = valueAt(dailyIndex(data, day), copy.metric); return { date: day, value: amount, ...placeReading(layer, copy.metric, amount, data?.steps[dailyIndex(data, day)]) }; })} /> : <><BriefingChart key={metric} layer={layer} samples={samples} activeKey={step?.key} onSelect={onTime} unit={unit} title={chartTitle} kind={layer === "rain" && metric === "secondary" ? "bar" : "line"} secondaryLabel={layer === "heat" ? daily ? "อุณหภูมิสูงสุด" : "อุณหภูมิอากาศ" : undefined} loading={loading} /><div className="fc-chart-insight"><span>สูงสุดในกราฟ <b>{formatValue(peak?.value ?? null)} {unit}</b>{peak && <small>{peak.label}</small>}</span><span>{daily ? "ค่ารายวัน" : "ค่าตามช่วงเวลาจริง"}<small>— หมายถึงไม่มีข้อมูล</small></span></div>
      {daily && detailIndex >= 0 && <button className="fc-hour-link" onClick={() => onTime(detailIndex)}>ดูกราฟตามช่วงเวลาของวันที่เลือก<MapIcon name="arrow" size={17} /></button>}
      {!daily && <details className="fc-daily"><summary>ดู{layer === "rain" ? "ฝนสะสมทั้งวัน" : "ความร้อนสูงสุดรายวัน"}ล่วงหน้า 7 วัน<MapIcon name="chevron" size={17} /></summary><ForecastInfographic layer={layer} title={layer === "rain" ? "ฝนสะสม 24 ชั่วโมง" : "ดัชนีความร้อนสูงสุด"} unit={copy.unit} period={copy.period} date={date} today={today} loading={loading} onDate={onDate} days={dates.map(day => { const amount = valueAt(dailyIndex(data, day), copy.metric); return { date: day, value: amount, ...placeReading(layer, copy.metric, amount, data?.steps[dailyIndex(data, day)]) }; })} /></details>}</>}
    </div></div>
    <div className="fc-story-source"><span>{sourceState(data, loading, error)} · {copy.source}</span><span>{data?.timestampLabel ?? "ข้อมูลอ้างอิง"} · {overviewTimestamp(data)}{data && ` · ${data.model}`}</span></div>
    {error && <p className="obs-error" role="status">{error}</p>}
  </section>;
}
