"use client";

import { useEffect, useMemo, useState } from "react";
import { getLevel, type ForecastPayload } from "./lib/forecast-data";
import type { RainForecastPayload } from "./lib/rain-forecast-data";
import { getDailyRainNarrative, getRainLikelihood } from "./lib/rain-communication";
import { getHeatRisk, type HeatForecastPayload } from "./lib/heat-forecast-data";

function mean(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function HomeTrendBars({
  values,
  labels,
  colors,
  maximum,
  unit,
  ariaLabel,
}: {
  values: Array<number | null>;
  labels: string[];
  colors: string[];
  maximum: number;
  unit: string;
  ariaLabel: string;
}) {
  const items = Array.from({ length: 7 }, (_, index) => values[index] ?? null);
  return (
    <div className="home-seven-day-bars" role="img" aria-label={ariaLabel}>
      {items.map((value, index) => (
        <span key={`${labels[index] ?? index}-${index}`}>
          <b>{value ?? "—"}</b>
          <i style={{ height: `${value === null ? 8 : Math.max(12, Math.min(100, (value / Math.max(1, maximum)) * 100))}%`, background: colors[index] ?? "#64748b" }} />
          <small>{labels[index] ?? `${index + 1}`}</small>
          <em>{unit}</em>
        </span>
      ))}
    </div>
  );
}

export default function HomeDashboard() {
  const [air, setAir] = useState<ForecastPayload | null>(null);
  const [rain, setRain] = useState<RainForecastPayload | null>(null);
  const [heat, setHeat] = useState<HeatForecastPayload | null>(null);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      fetch("/api/forecast?province=metro").then((response) => response.ok ? response.json() : Promise.reject()),
      fetch("/api/rain-forecast?province=metro").then((response) => response.ok ? response.json() : Promise.reject()),
      fetch("/api/heat-forecast?province=metro").then((response) => response.ok ? response.json() : Promise.reject()),
    ]).then(([airResult, rainResult, heatResult]) => {
      if (!active) return;
      if (airResult.status === "fulfilled") setAir(airResult.value as ForecastPayload);
      if (rainResult.status === "fulfilled") setRain(rainResult.value as RainForecastPayload);
      if (heatResult.status === "fulfilled") setHeat(heatResult.value as HeatForecastPayload);
    });
    return () => { active = false; };
  }, []);

  const airMeans = useMemo(() => air?.days.map((_, dayIndex) => mean(air.stations.map((station) => station.values[dayIndex]))) ?? [], [air]);
  const airToday = airMeans[0] ?? null;
  const airLevel = airToday === null ? { label: "รอข้อมูล", color: "#94a3b8" } : getLevel(airToday);
  const rainProbabilities = rain?.days.map((day) => day.dailyPeakAreaMeanProbability) ?? [];
  const rainToday = rain?.days[0] ?? null;
  const rainLikelihood = getRainLikelihood(rainToday?.dailyPeakAreaMeanProbability);
  const airDayLabels = air?.days.map((day) => day.weekday.slice(0, 2)) ?? [];
  const rainDayLabels = rain?.days.map((day) => day.weekday.slice(0, 2)) ?? [];
  const airColors = airMeans.map((value) => value === null ? "#64748b" : getLevel(value).color);
  const rainColors = rainProbabilities.map((value) => getRainLikelihood(value).color);
  const airMaximum = Math.max(45, ...airMeans.filter((value): value is number => value !== null));
  const airSevenDayPeak = airMeans.filter((value): value is number => value !== null).length
    ? Math.max(...airMeans.filter((value): value is number => value !== null))
    : null;
  const rainSevenDayPeak = rain?.days.reduce<number | null>((peak, day) => day.rainMaxMm === null ? peak : Math.max(peak ?? 0, day.rainMaxMm), null) ?? null;
  const heatValues = heat?.days.map((day) => day.maxHeatIndexC) ?? [];
  const heatToday = heat?.days[0] ?? null;
  const heatRisk = getHeatRisk(heatToday?.pointMaxHeatIndexC ?? heatToday?.maxHeatIndexC ?? null);
  const heatDayLabels = heat?.days.map((day) => day.weekday.slice(0, 2)) ?? [];
  const heatColors = heatValues.map((value) => getHeatRisk(value).color);
  const heatMaximum = Math.max(45, ...heatValues.filter((value): value is number => value !== null));
  const heatSevenDayPeak = heat?.days.reduce<number | null>((peak, item) => item.pointMaxHeatIndexC === null ? peak : Math.max(peak ?? 0, item.pointMaxHeatIndexC), null) ?? null;

  const airTrend = (
    <HomeTrendBars
      values={airMeans}
      labels={airDayLabels}
      colors={airColors}
      maximum={airMaximum}
      unit="PM"
      ariaLabel={`แนวโน้ม PM2.5 เจ็ดวัน ${airMeans.map((value) => value ?? "รอข้อมูล").join(", ")} ไมโครกรัมต่อลูกบาศก์เมตร`}
    />
  );
  const rainTrend = (
    <HomeTrendBars
      values={rainProbabilities}
      labels={rainDayLabels}
      colors={rainColors}
      maximum={100}
      unit="%"
      ariaLabel={`แนวโน้มฝนระดับพื้นที่เจ็ดวัน ${rainProbabilities.map((value) => value ?? "รอข้อมูล").join(", ")} เปอร์เซ็นต์`}
    />
  );
  const heatTrend = (
    <HomeTrendBars
      values={heatValues}
      labels={heatDayLabels}
      colors={heatColors}
      maximum={heatMaximum}
      unit="HI"
      ariaLabel={`แนวโน้ม Heat Index เจ็ดวัน ${heatValues.map((value) => value ?? "รอข้อมูล").join(", ")} องศาเซลเซียส`}
    />
  );

  return (
    <>
    <section className="home-dashboard" aria-labelledby="home-dashboard-title">
      <div className="home-dashboard-heading">
        <div><span>LIVE OUTLOOK</span><h2 id="home-dashboard-title">ภาพรวมกรุงเทพฯ–ปริมณฑล</h2></div>
        <div className="home-source-state" aria-live="polite"><i className={air || rain || heat ? "ready" : ""} />{air || rain || heat ? "ข้อมูลล่าสุดพร้อมใช้งาน" : "กำลังสรุปข้อมูลล่าสุด"}</div>
      </div>
      <div className="home-dashboard-grid">
        <a className="home-summary-card air" href="/air?province=metro">
          <div className="home-summary-copy"><span>แนวโน้ม PM2.5 7 วัน</span><strong>{airToday ?? "—"}<small>µg/m³</small></strong><b style={{ color: airLevel.color }}>{airLevel.label}</b></div>
          {airTrend}
          <small>ค่าสูงสุดใน 7 วัน {airSevenDayPeak ?? "—"} µg/m³ · แตะเพื่อดูแผนที่</small>
        </a>
        <a className="home-summary-card rain" href="/rain?province=metro">
          <div className="home-summary-copy"><span>แนวโน้มฝน 7 วัน</span><strong className="home-rain-trend" style={{ color: rainLikelihood.color }}>{rainLikelihood.label}</strong><b>{rainToday ? getDailyRainNarrative(rainToday) : "รอข้อมูล"}</b></div>
          {rainTrend}
          <small>ฝนสะสมสูงสุดบางจุดใน 7 วัน {rainSevenDayPeak ?? "—"} มม. · แตะเพื่อดูแผนที่</small>
        </a>
        <a className="home-summary-card heat" href="/heat?province=metro">
          <div className="home-summary-copy"><span>แนวโน้ม Heat Index 7 วัน</span><strong>{heatToday?.maxHeatIndexC ?? "—"}<small>°C</small></strong><b style={{ color: heatRisk.color }}>{heatRisk.label}</b></div>
          {heatTrend}
          <small>ค่าสูงสุดบางจุดใน 7 วัน {heatSevenDayPeak ?? "—"}°C · แตะเพื่อดูแผนที่</small>
        </a>
      </div>
    </section>

    <details className="home-mobile-outlook">
      <summary aria-label="เปิดภาพรวมแนวโน้ม 7 วัน"><span aria-hidden="true">↗</span><small>7 วัน</small></summary>
      <div className="home-mobile-outlook-panel">
        <a href="/air?province=metro">
          <div><span>PM2.5</span><b style={{ color: airLevel.color }}>{airLevel.label}</b></div>
          {airTrend}
        </a>
        <a href="/rain?province=metro">
          <div><span>ฝน</span><b style={{ color: rainLikelihood.color }}>{rainLikelihood.label}</b></div>
          {rainTrend}
        </a>
        <a href="/heat?province=metro">
          <div><span>Heat Index</span><b style={{ color: heatRisk.color }}>{heatRisk.label}</b></div>
          {heatTrend}
        </a>
      </div>
    </details>
    </>
  );
}
