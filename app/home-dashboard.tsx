"use client";

import { useEffect, useMemo, useState } from "react";
import { getLevel, type ForecastPayload } from "./lib/forecast-data";
import type { RainForecastPayload } from "./lib/rain-forecast-data";
import type { TmdRadarPayload } from "./lib/tmd-radar-data";

function mean(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function sparkline(values: Array<number | null>, maximum: number) {
  return values.map((value, index) => {
    const x = values.length <= 1 ? 120 : index * 240 / (values.length - 1);
    const y = 56 - ((value ?? 0) / Math.max(1, maximum)) * 48;
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export default function HomeDashboard() {
  const [air, setAir] = useState<ForecastPayload | null>(null);
  const [rain, setRain] = useState<RainForecastPayload | null>(null);
  const [radar, setRadar] = useState<TmdRadarPayload | null>(null);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      fetch("/api/forecast?province=metro").then((response) => response.ok ? response.json() : Promise.reject()),
      fetch("/api/rain-forecast?province=metro").then((response) => response.ok ? response.json() : Promise.reject()),
      fetch("/api/tmd-radar").then((response) => response.ok ? response.json() : Promise.reject()),
    ]).then(([airResult, rainResult, radarResult]) => {
      if (!active) return;
      if (airResult.status === "fulfilled") setAir(airResult.value as ForecastPayload);
      if (rainResult.status === "fulfilled") setRain(rainResult.value as RainForecastPayload);
      if (radarResult.status === "fulfilled") setRadar(radarResult.value as TmdRadarPayload);
    });
    return () => { active = false; };
  }, []);

  const airMeans = useMemo(() => air?.days.map((_, dayIndex) => mean(air.stations.map((station) => station.values[dayIndex]))) ?? [], [air]);
  const airToday = airMeans[0] ?? null;
  const airLevel = airToday === null ? { label: "รอข้อมูล", color: "#94a3b8" } : getLevel(airToday);
  const rainProbabilities = rain?.days.map((day) => day.probabilityMax) ?? [];
  const rainToday = rain?.days[0] ?? null;

  return (
    <section className="home-dashboard" aria-labelledby="home-dashboard-title">
      <div className="home-dashboard-heading">
        <div><span>LIVE OUTLOOK</span><h2 id="home-dashboard-title">ภาพรวมกรุงเทพฯ–ปริมณฑล</h2></div>
        <div className="home-source-state" aria-live="polite"><i className={air || rain ? "ready" : ""} />{air || rain ? "ข้อมูลล่าสุดพร้อมใช้งาน" : "กำลังสรุปข้อมูลล่าสุด"}</div>
      </div>
      <div className="home-dashboard-grid">
        <a className="home-summary-card air" href="/air?province=metro">
          <div className="home-summary-copy"><span>PM2.5 วันถัดไป</span><strong>{airToday ?? "—"}<small>µg/m³</small></strong><b style={{ color: airLevel.color }}>{airLevel.label}</b></div>
          <svg viewBox="0 0 240 64" role="img" aria-label="แนวโน้ม PM2.5 เจ็ดวัน"><path d={sparkline(airMeans, Math.max(45, ...airMeans.filter((value): value is number => value !== null)))} /></svg>
          <small>แตะเพื่อดูแผนที่และเลือกตำแหน่ง</small>
        </a>
        <a className="home-summary-card rain" href="/rain?province=bangkok">
          <div className="home-summary-copy"><span>ฝนวันนี้</span><strong>{rainToday?.probabilityMax ?? "—"}<small>%</small></strong><b>{rainToday?.rainMeanMm === null || rainToday === null ? "รอข้อมูล" : `เฉลี่ย ${rainToday.rainMeanMm} มม.`}</b></div>
          <svg viewBox="0 0 240 64" role="img" aria-label="แนวโน้มโอกาสฝนเจ็ดวัน"><path d={sparkline(rainProbabilities, 100)} /></svg>
          <small>ช่วงเด่น {rainToday?.peakWindow ?? "—"}</small>
        </a>
        <a className="home-summary-card radar" href="/rain?province=bangkok">
          <div className="home-summary-copy"><span>TMD RadarGIS</span><strong>{radar?.status === "live" ? "LIVE" : radar?.status === "degraded" ? "ช้า" : "—"}</strong><b>{radar?.ageMinutes === null || radar === null ? "รอเรดาร์" : `อัปเดต ${radar.ageMinutes} นาทีที่แล้ว`}</b></div>
          <div className="home-radar-pulse" aria-hidden="true"><i /><i /><i /></div>
          <small>ตรวจจริง {radar?.observedFrames.length ?? 0} · Nowcast {radar?.nowcastFrames.length ?? 0} เฟรม</small>
        </a>
      </div>
    </section>
  );
}
