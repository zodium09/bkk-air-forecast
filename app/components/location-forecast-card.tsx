"use client";

import { useState } from "react";
import { getLevel } from "../lib/forecast-data";
import { getHeatRisk } from "../lib/heat-forecast-data";
import { rainAmountLevel } from "../lib/rain-forecast-data";

export type LocationSelection = {
  lat: number;
  lng: number;
  source: "gps" | "map";
};

export type LocationSeriesPoint = {
  label: string;
  primary: number | null;
  secondary?: number | null;
};

function linePath(values: Array<number | null>, width: number, height: number, maximum: number) {
  const points = values.map((value, index) => ({
    x: values.length <= 1 ? width / 2 : index * width / (values.length - 1),
    y: height - ((value ?? 0) / Math.max(1, maximum)) * height,
    valid: value !== null,
  }));
  return points.reduce((path, point) => point.valid
    ? `${path}${path ? " L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    : path, "");
}

export default function LocationForecastCard({
  kind,
  selection,
  series,
  onClear,
  placeName,
  activeIndex = 0,
  onSelectIndex,
}: {
  kind: "air" | "rain" | "heat";
  selection: LocationSelection | null;
  series: LocationSeriesPoint[];
  onClear: () => void;
  placeName?: string;
  activeIndex?: number;
  onSelectIndex?: (index: number) => void;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const primaryValues = series.map((point) => point.primary);
  const primaryMaximum = Math.max(1, ...primaryValues.filter((value): value is number => value !== null));
  const chartMaximum = kind === "air" ? Math.max(45, primaryMaximum * 1.15) : kind === "heat" ? Math.max(45, primaryMaximum * 1.08) : primaryMaximum;
  const primaryPath = kind !== "rain" ? linePath(primaryValues, 232, 54, chartMaximum) : "";
  const probabilityPath = kind === "rain"
    ? linePath(series.map((point) => point.secondary ?? null), 232, 54, 100)
    : "";
  const safeActiveIndex = Math.min(Math.max(activeIndex, 0), Math.max(0, series.length - 1));
  const displayIndex = hoveredIndex ?? safeActiveIndex;
  const displayPoint = series[displayIndex];
  const displayLevel = displayPoint?.primary !== null && displayPoint?.primary !== undefined
    ? kind === "air" ? getLevel(displayPoint.primary) : kind === "heat" ? getHeatRisk(displayPoint.primary) : rainAmountLevel(displayPoint.primary)
    : null;
  const tooltipLeft = series.length <= 1 ? 50 : displayIndex / (series.length - 1) * 100;

  return (
    <section className={`location-forecast-card ${kind}`} aria-live="polite" aria-label="พยากรณ์ ณ จุดที่เลือก">
      <div className="location-card-heading">
        <div>
          <span>{selection ? selection.source === "gps" ? "ตำแหน่งของฉัน" : "จุดที่เลือกบนแผนที่" : "พยากรณ์รายตำแหน่ง"}</span>
          <b>{selection ? placeName ?? `${selection.lat.toFixed(4)}, ${selection.lng.toFixed(4)}` : "กำลังค้นหาตำแหน่ง หรือแตะแผนที่เพื่อเลือกจุด"}</b>
        </div>
        {selection && <button type="button" onClick={onClear} aria-label="ยกเลิกจุดที่เลือก">×</button>}
      </div>

      {selection && series.some((point) => point.primary !== null) ? (
        <div className="location-chart-wrap" onMouseLeave={() => setHoveredIndex(null)}>
          <svg viewBox="0 0 240 82" role="img" aria-label={kind === "air" ? "กราฟ PM2.5 ล่วงหน้า 48 ชั่วโมง ณ จุดที่เลือก" : kind === "heat" ? "กราฟ Heat Index ล่วงหน้า 48 ชั่วโมง ณ จุดที่เลือก" : "กราฟฝนล่วงหน้า 48 ชั่วโมง ณ จุดที่เลือก"}>
            <line x1="4" y1="58" x2="236" y2="58" className="location-chart-axis" />
            {kind === "rain" && series.map((point, index) => {
              const value = point.primary ?? 0;
              const barWidth = Math.max(7, 180 / Math.max(8, series.length));
              const x = 4 + index * (232 / Math.max(1, series.length)) + 3;
              const height = value / primaryMaximum * 48;
              return <rect key={`${point.label}-${index}`} x={x} y={58 - height} width={barWidth} height={height} rx="3" className="location-rain-bar" />;
            })}
            {kind !== "rain" && primaryPath && <path d={primaryPath} transform="translate(4 4)" className={kind === "heat" ? "location-heat-line" : "location-air-line"} />}
            {kind === "rain" && probabilityPath && <path d={probabilityPath} transform="translate(4 4)" className="location-probability-line" />}
            {kind !== "rain" && series.map((point, index) => {
              if (point.primary === null) return null;
              const x = 4 + index * (232 / Math.max(1, series.length - 1));
              const y = 4 + 54 - (point.primary / Math.max(1, chartMaximum)) * 54;
              return <circle key={`${point.label}-point`} cx={x} cy={y} r={displayIndex === index ? 4.8 : 3.1} className={`${kind === "heat" ? "location-heat-point" : "location-air-point"}${displayIndex === index ? " active" : ""}`} />;
            })}
            {series.map((point, index) => {
              const x = 4 + index * (232 / Math.max(1, series.length - 1));
              if (index !== 0 && index !== series.length - 1 && index % 3 !== 0) return null;
              return <text key={`${point.label}-label`} x={x} y="76" textAnchor={index === 0 ? "start" : index === series.length - 1 ? "end" : "middle"}>{point.label}</text>;
            })}
          </svg>
          <div className="location-chart-hotspots" aria-label="เลือกวันเพื่อดูรายละเอียด">
            {series.map((point, index) => (
              <button
                key={`${point.label}-hotspot`}
                type="button"
                aria-label={`${point.label} ${kind === "air" ? `PM2.5 ${point.primary ?? "ไม่มีข้อมูล"} ไมโครกรัมต่อลูกบาศก์เมตร` : kind === "heat" ? `Heat Index ${point.primary ?? "ไม่มีข้อมูล"} องศาเซลเซียส` : `ฝน ${point.primary ?? "ไม่มีข้อมูล"} มิลลิเมตร`}`}
                onMouseEnter={() => setHoveredIndex(index)}
                onFocus={() => setHoveredIndex(index)}
                onBlur={() => setHoveredIndex(null)}
                onClick={() => onSelectIndex?.(index)}
              />
            ))}
          </div>
          {displayPoint && (
            <div
              className={`location-chart-tooltip ${tooltipLeft < 18 ? "edge-left" : tooltipLeft > 82 ? "edge-right" : ""}`}
              style={{ left: `${tooltipLeft}%`, "--tooltip-color": displayLevel?.color ?? "#2563eb" } as React.CSSProperties}
            >
              <b>{displayPoint.label}</b>
              <strong>{displayPoint.primary ?? "—"}<small>{kind === "air" ? " µg/m³" : kind === "heat" ? " °C" : " มม."}</small></strong>
              <span>{kind === "rain" ? `แนวโน้มฝน ${displayPoint.secondary ?? "—"}%` : displayLevel?.label}</span>
            </div>
          )}
          <div className="location-chart-values">
            <span><i className="primary" />{kind === "air" ? `PM2.5 ${displayPoint?.primary ?? "—"} µg/m³` : kind === "heat" ? `Heat Index ${displayPoint?.primary ?? "—"}°C` : `ฝน ${displayPoint?.primary ?? "—"} มม.`}</span>
            {kind === "heat" && <span><i className="secondary" />อุณหภูมิ {displayPoint?.secondary ?? "—"}°C</span>}
            {kind === "rain" && <span><i className="secondary" />แนวโน้มฝนโดยประมาณ ณ จุดนี้ {displayPoint?.secondary ?? "—"}%</span>}
          </div>
        </div>
      ) : selection ? (
        <p className="location-card-empty">จุดนี้อยู่นอกระยะข้อมูลที่รองรับ กรุณาเลือกใกล้กรุงเทพฯ และปริมณฑล</p>
      ) : (
        <p className="location-card-empty">ค่าจะแสดงจากกริดแบบจำลองใกล้เคียง พร้อมกราฟแนวโน้มโดยไม่บันทึกพิกัด</p>
      )}
      <small>{kind === "air"
        ? "แตะหรือชี้บนกราฟเพื่อดูแนวโน้ม 48 ชั่วโมง · กระจายจากค่าพยากรณ์รายวันและเป็นค่าประมาณเชิงพื้นที่ใกล้ตำแหน่ง"
        : "แตะหรือชี้บนกราฟเพื่อดูทุก 3 ชั่วโมง · แนวโน้ม 48 ชั่วโมงเป็นค่าประมาณเชิงพื้นที่ใกล้ตำแหน่ง"}</small>
    </section>
  );
}
