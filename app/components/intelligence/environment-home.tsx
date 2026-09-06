"use client";
/* eslint-disable @next/next/no-html-link-for-pages */
import { useState } from "react";
import EnvironmentMap from "./environment-map";
import { MapIcon } from "./map-ui";
import ThemeToggle from "../theme-toggle";
import { useEnvironmentData } from "./use-environment-data";
import {
  average,
  formatValue,
  interpretation,
  type EnvironmentLayer,
} from "../../lib/map-intelligence";
import "./map-workspace.css";
import "./environment-home.css";
import "./night-theme.css";

export default function EnvironmentHome() {
  const air = useEnvironmentData("air", "metro", "observation", 0);
  const rain = useEnvironmentData("rain", "metro", "forecast", 0);
  const heat = useEnvironmentData("heat", "metro", "forecast", 0);
  const [previewLayer, setPreviewLayer] = useState<EnvironmentLayer>("rain");
  const [previewMotion, setPreviewMotion] = useState(true);
  const sources = { air, rain, heat };
  const preview = sources[previewLayer];
  const topics = [
    {
      layer: "air" as const,
      title: "ฝุ่น PM2.5",
      unit: "µg/m³",
      mode: "ตรวจวัดล่าสุด",
      description: "ค่าฝุ่นที่สถานีรายงาน และแนวโน้มวันถัดไป",
      action: "สำรวจแผนที่ PM2.5",
    },
    {
      layer: "rain" as const,
      title: "ฝน",
      unit: "%",
      mode: "พยากรณ์วันนี้",
      description: "โอกาสฝน ปริมาณสะสม และช่วงเวลาที่ควรจับตา",
      action: "สำรวจแผนที่ฝน",
    },
    {
      layer: "heat" as const,
      title: "ความร้อน",
      unit: "°C",
      mode: "พยากรณ์วันนี้",
      description: "Heat Index และอุณหภูมิสูงสุดในแต่ละพื้นที่",
      action: "สำรวจแผนที่ความร้อน",
    },
  ];
  return (
    <main className="mi-home">
      <header className="mi-home-header">
        <a href="/" className="mi-home-brand">
          <span>
            <MapIcon name="map" size={25} />
          </span>
          <div>
            <b>BKK AIR FORECAST</b>
            <small>สิ่งแวดล้อมกรุงเทพฯ และปริมณฑล</small>
          </div>
        </a>
        <div className="mi-home-header-actions">
          <span>กรุงเทพฯ + 5 จังหวัดปริมณฑล</span>
          <ThemeToggle />
        </div>
      </header>
      <section className="mi-home-intro">
        <div>
          <span className="mi-home-dateline">
            แผนที่สิ่งแวดล้อม · เวลากรุงเทพฯ
          </span>
          <h1>
            มองกรุงเทพฯ วันนี้
            <br />
            <span>วางแผนวันถัดไป</span>
          </h1>
        </div>
        <p>
          สำรวจฝุ่น ฝน และความร้อนในพื้นที่ของคุณ
          <br />
          พร้อมแนวโน้ม 7 วันและที่มาของข้อมูล
        </p>
      </section>
      <div className="mi-home-main">
        <section
          className="mi-home-topics"
          aria-label="สถานการณ์และทางเข้าสู่แผนที่"
        >
          {topics.map((topic) => {
            const source = sources[topic.layer];
            const value = average(
              source.data?.points.map((p) => p.values[0] ?? null) ?? [],
            );
            return (
              <a
                className={`mi-home-topic mi-home-topic-${topic.layer}`}
                href={`/${topic.layer}`}
                key={topic.layer}
              >
                <div className="mi-home-topic-head">
                  <MapIcon name={topic.layer} size={25} />
                  <h2>{topic.title}</h2>
                  <span>{topic.mode}</span>
                </div>
                <div className="mi-home-reading">
                  <b>
                    {source.loading ? "…" : formatValue(value)}
                    <small>{topic.unit}</small>
                  </b>
                  <span>
                    {source.loading
                      ? "กำลังตรวจสอบข้อมูล"
                      : interpretation(topic.layer, "primary", value)}
                  </span>
                </div>
                <p>{topic.description}</p>
                <div className="mi-home-topic-bottom">
                  <small>
                    {source.error || source.data?.status === "unavailable"
                      ? "แหล่งข้อมูลยังไม่พร้อม"
                      : source.data?.status === "degraded"
                        ? "ข้อมูลบางส่วน / แหล่งสำรอง"
                        : source.loading
                          ? "รอแหล่งข้อมูล"
                          : "ค่าเฉลี่ยจุดที่มีข้อมูล"}
                  </small>
                  <span>
                    {topic.action}
                    <MapIcon name="arrow" size={17} />
                  </span>
                </div>
              </a>
            );
          })}
        </section>
        <section className="mi-home-map" aria-label="แผนที่ภาพรวมพื้นที่">
          <EnvironmentMap
            layer={previewLayer}
            mode={previewLayer === "air" ? "observation" : "estimate"}
            points={preview.data?.points ?? []}
            index={0}
            metric="primary"
            province="metro"
            selected={null}
            onSelect={() => {
              window.location.href = `/${previewLayer}`;
            }}
            legend={null}
            degraded={preview.data?.status !== "live"}
            satellite={false}
            showValues={false}
            weatherAnimation={previewLayer !== "air" && previewMotion}
            focus={0}
          />
          <div className="mi-home-map-heading">
            <b>ภาพรวมกรุงเทพฯ–ปริมณฑล</b>
            <span>
              {topics.find((t) => t.layer === previewLayer)?.mode} ·{" "}
              {topics.find((t) => t.layer === previewLayer)?.title}
            </span>
            {previewLayer !== "air" && <span>IDW · อนิเมชันประกอบพยากรณ์</span>}
          </div>
          <div className="mi-home-preview-layers">
            {topics.map((topic) => (
              <button
                key={topic.layer}
                aria-pressed={previewLayer === topic.layer}
                onClick={() => setPreviewLayer(topic.layer)}
              >
                <MapIcon name={topic.layer} size={18} />
                {topic.title}
              </button>
            ))}
            {previewLayer !== "air" && (
              <button
                className="mi-home-motion"
                aria-label={
                  previewMotion ? "ปิดอนิเมชันตัวอย่าง" : "เปิดอนิเมชันตัวอย่าง"
                }
                aria-pressed={previewMotion}
                onClick={() => setPreviewMotion(!previewMotion)}
                title="อนิเมชันประกอบพยากรณ์"
              >
                <MapIcon name={previewMotion ? "pause" : "play"} size={16} />
              </button>
            )}
          </div>
          {!preview.data?.points.length && (
            <div className="mi-home-map-state">
              {preview.loading
                ? "กำลังเชื่อมต่อข้อมูลพื้นที่…"
                : "ยังไม่มีข้อมูลที่ใช้ได้ แผนที่แสดงพื้นที่เพื่ออ้างอิง"}
            </div>
          )}
          <a className="mi-home-explore" href={`/${previewLayer}`}>
            เปิดแผนที่เต็มหน้าจอ
            <MapIcon name="arrow" size={18} />
          </a>
        </section>
      </div>
      <footer className="mi-home-footer">
        <span>
          <MapIcon name="info" size={17} />
          แยกค่าตรวจวัด พยากรณ์ และประมาณเชิงพื้นที่อย่างชัดเจน
        </span>
        <p>
          พยากรณ์เพื่อวางแผนเบื้องต้น ไม่ใช้แทนประกาศเตือนภัยจากหน่วยงานทางการ
        </p>
      </footer>
    </main>
  );
}
