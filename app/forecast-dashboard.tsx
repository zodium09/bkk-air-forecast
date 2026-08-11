"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  forecastDays as bundledDays,
  forecastStations as bundledStations,
  getLevel,
  issuedAt as bundledIssuedAt,
  type ForecastDay,
  type ForecastStation,
} from "./lib/forecast-data";
import "leaflet/dist/leaflet.css";

type ForecastPayload = {
  status: string;
  issuedAt: string;
  days: ForecastDay[];
  stations: ForecastStation[];
};

function average(values: number[]) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export default function ForecastDashboard() {
  const [selectedDay, setSelectedDay] = useState(0);
  const [days, setDays] = useState(bundledDays);
  const [stations, setStations] = useState(bundledStations);
  const [issuedAt, setIssuedAt] = useState(bundledIssuedAt);
  const [dataState, setDataState] = useState<"loading" | "demo" | "fallback">("loading");
  const [showRange, setShowRange] = useState(false);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const stationLayerRef = useRef<import("leaflet").LayerGroup | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/forecast")
      .then((response) => {
        if (!response.ok) throw new Error("forecast unavailable");
        return response.json() as Promise<ForecastPayload>;
      })
      .then((payload) => {
        if (!active) return;
        setDays(payload.days);
        setStations(payload.stations);
        setIssuedAt(payload.issuedAt);
        setDataState("demo");
      })
      .catch(() => {
        if (active) setDataState("fallback");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!mapElementRef.current || mapInstanceRef.current) return;

    import("leaflet").then((leafletModule) => {
      if (cancelled || !mapElementRef.current || mapInstanceRef.current) return;
      const L = leafletModule.default;
      const map = L.map(mapElementRef.current, {
        zoomControl: true,
        attributionControl: true,
        minZoom: 9,
        maxZoom: 15,
      }).setView([13.765, 100.595], 10);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      stationLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 80);
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        stationLayerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!stationLayerRef.current) {
      const retry = window.setTimeout(() => setSelectedDay((day) => day), 120);
      return () => window.clearTimeout(retry);
    }

    let cancelled = false;
    import("leaflet").then((leafletModule) => {
      if (cancelled || !stationLayerRef.current) return;
      const L = leafletModule.default;
      stationLayerRef.current.clearLayers();

      stations.forEach((station) => {
        const value = station.values[selectedDay];
        const level = getLevel(value);
        const radius = 18 + value * 0.32;

        L.circleMarker([station.lat, station.lng], {
          radius,
          color: level.color,
          weight: 1,
          opacity: 0.86,
          fillColor: level.color,
          fillOpacity: 0.34,
        })
          .bindTooltip(`${station.district} · ${value} µg/m³`, {
            direction: "top",
            className: "forecast-tooltip",
          })
          .bindPopup(
            `<div class="map-popup"><strong>${station.district}</strong><span>${station.label}</span><b>${value} µg/m³</b><small>${level.label}</small></div>`,
          )
          .addTo(stationLayerRef.current!);

        L.circleMarker([station.lat, station.lng], {
          radius: 5,
          color: "#fff",
          weight: 2,
          fillColor: level.color,
          fillOpacity: 1,
        }).addTo(stationLayerRef.current!);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedDay, stations]);

  const day = days[selectedDay];
  const values = useMemo(
    () => stations.map((station) => station.values[selectedDay]),
    [selectedDay, stations],
  );
  const mean = average(values);
  const maximum = Math.max(...values);
  const hottest = stations.find((station) => station.values[selectedDay] === maximum);
  const meanLevel = getLevel(mean);
  const sortedStations = useMemo(
    () => [...stations].sort((a, b) => b.values[selectedDay] - a.values[selectedDay]).slice(0, 5),
    [selectedDay, stations],
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="BKK Air Outlook หน้าแรก">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><b>BKK AIR</b><small>OUTLOOK</small></span>
        </a>
        <div className="issued">
          <span className={`status-dot ${dataState}`} aria-hidden="true" />
          <span>ออกรอบล่าสุด <b>{issuedAt}</b></span>
        </div>
        <button className="method-link" onClick={() => document.getElementById("method")?.scrollIntoView({ behavior: "smooth" })}>
          วิธีอ่านผลพยากรณ์
        </button>
      </header>

      <section className="notice" role="status">
        <b>ต้นแบบระบบ · DEMO DATA</b>
        <span>ค่าบนแผนที่เป็นข้อมูลจำลองเพื่อทดสอบการใช้งาน ยังไม่ใช่คำเตือนคุณภาพอากาศจริง</span>
      </section>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">พยากรณ์ PM2.5 กรุงเทพฯ ล่วงหน้า 1–5 วัน</p>
          <h1>เห็นวันที่เสี่ยง<br /><em>ก่อนฝุ่นจะมา</em></h1>
        </div>
        <div className="hero-summary">
          <p>แนวโน้ม 5 วัน</p>
          <strong>สูงสุดใน D+3</strong>
          <span>พื้นที่ชั้นในและตอนเหนือควรเฝ้าระวังช่วงเช้า</span>
        </div>
      </section>

      <nav className="day-tabs" aria-label="เลือกวันพยากรณ์">
        {days.map((forecastDay, index) => {
          const dailyValues = stations.map((station) => station.values[index]);
          const dailyMean = average(dailyValues);
          return (
            <button
              key={forecastDay.lead}
              className={selectedDay === index ? "active" : ""}
              onClick={() => setSelectedDay(index)}
              aria-pressed={selectedDay === index}
            >
              <span>D+{forecastDay.lead}</span>
              <b>{forecastDay.weekday} {forecastDay.date}</b>
              <i style={{ backgroundColor: getLevel(dailyMean).color }} />
              <small>{dailyMean} µg/m³</small>
            </button>
          );
        })}
      </nav>

      <section className="workspace">
        <div className="map-card">
          <div className="map-heading">
            <div>
              <p>ค่ากลางรายวัน · D+{day.lead}</p>
              <h2>{day.weekday}ที่ {day.date} 2569</h2>
            </div>
            <label className="range-toggle">
              <input type="checkbox" checked={showRange} onChange={(event) => setShowRange(event.target.checked)} />
              <span />
              แสดงช่วงความไม่แน่นอน
            </label>
          </div>

          <div className="map-wrap">
            <div ref={mapElementRef} className="map" role="application" aria-label={`แผนที่ PM2.5 พยากรณ์ล่วงหน้า ${day.lead} วัน`} />
            <div className="map-metric">
              <span>ค่าเฉลี่ย กทม.</span>
              <strong>{mean}<small>µg/m³</small></strong>
              <b style={{ color: meanLevel.color }}>{meanLevel.label}</b>
              {showRange && <em>ช่วงคาดการณ์ {Math.max(0, mean - day.uncertainty)}–{mean + day.uncertainty}</em>}
            </div>
            <div className="legend" aria-label="คำอธิบายระดับ PM2.5">
              <span><i style={{ background: "#38bdf8" }} />0–15</span>
              <span><i style={{ background: "#34d399" }} />16–25</span>
              <span><i style={{ background: "#facc15" }} />26–37.5</span>
              <span><i style={{ background: "#fb923c" }} />38–75</span>
              <span><i style={{ background: "#f43f5e" }} />&gt;75</span>
              <small>PM2.5 · µg/m³</small>
            </div>
          </div>
        </div>

        <aside className="insights">
          <div className="confidence-card">
            <div className="confidence-ring" style={{ "--progress": `${day.confidence * 3.6}deg` } as React.CSSProperties}>
              <span>{day.confidence}<small>%</small></span>
            </div>
            <div><p>ความเชื่อมั่นของโมเดล</p><strong>{day.confidence >= 80 ? "สูง" : day.confidence >= 65 ? "ปานกลาง" : "ควรติดตามใกล้ชิด"}</strong></div>
          </div>

          <div className="weather-card">
            <p>ปัจจัยสภาพอากาศ</p>
            <div><span aria-hidden="true">↗</span><b>{day.wind}</b></div>
            <div><span aria-hidden="true">◌</span><b>{day.weather}</b></div>
          </div>

          <div className="watch-card">
            <p>พื้นที่เฝ้าระวัง</p>
            <ol>
              {sortedStations.map((station) => {
                const value = station.values[selectedDay];
                return <li key={station.id}><span>{station.district}</span><b>{value}</b><i style={{ background: getLevel(value).color }} /></li>;
              })}
            </ol>
            <small>หน่วย µg/m³ · เรียงจากค่าคาดการณ์สูงสุด</small>
          </div>

          <div className="forecast-note">
            <span aria-hidden="true">!</span>
            <p><b>สิ่งที่ควรรู้</b>{day.note}</p>
          </div>
        </aside>
      </section>

      <section className="method" id="method">
        <div>
          <p className="eyebrow">จากข้อมูลสู่การตัดสินใจ</p>
          <h2>โมเดลจะทำงานอย่างไร<br />เมื่อเชื่อมข้อมูลจริง</h2>
        </div>
        <div className="method-flow">
          <article><span>01</span><h3>รับค่าตรวจวัด</h3><p>AirBKK รายชั่วโมง พร้อมตรวจคุณภาพและความสดใหม่ของแต่ละสถานี</p></article>
          <article><span>02</span><h3>เติมสภาพอากาศ</h3><p>ลม ฝน ความชื้น และ CAMS PM2.5 ล่วงหน้า 5 วัน</p></article>
          <article><span>03</span><h3>ปรับค่าคลาดเคลื่อน</h3><p>เรียนรู้ bias แยกตามสถานี ฤดูกาล และระยะเวลาพยากรณ์</p></article>
          <article><span>04</span><h3>สร้างแผนที่</h3><p>คำนวณค่ากลาง ช่วงความไม่แน่นอน และความเชื่อมั่นทุก 6 ชั่วโมง</p></article>
        </div>
        <div className="source-row">
          <span>แหล่งข้อมูลที่ออกแบบไว้</span>
          <b>AirBKK</b><b>CAMS</b><b>TMD</b><b>พื้นที่ 50 เขต กทม.</b>
        </div>
      </section>

      <footer>
        <span>BKK Air Outlook · Prototype 0.1</span>
        <p>ผลพยากรณ์ต้องผ่านการ backtest และอนุมัติแหล่งข้อมูลก่อนใช้เป็นคำเตือนสาธารณะ</p>
      </footer>
    </main>
  );
}
