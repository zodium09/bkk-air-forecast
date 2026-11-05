"use client";

import { useMemo } from "react";
import {
  calculateHeatIndexC,
  calculateUsAqiFromPm25,
  getTmdRainCoverageLabel,
  toTmdRainAreaPercent,
  type AreaForecast,
  type HourlyPoint,
  type TopicId,
} from "../../lib/fahsai-data.ts";
import {
  classifyDailyPointRisk,
  classifyHourlyPointRisk,
  type RiskBandInfo,
  type TopicConfig,
} from "./fahsai-helpers.ts";

export interface FahSaiSeverityChartsProps {
  activeArea: AreaForecast;
  activeHour: HourlyPoint;
  activeTopicMeta: TopicConfig;
  activeTierColor: string;
  bands: RiskBandInfo[];
  topic: TopicId;
  dayIdx: number;
  hourIdx: number;
  dark: boolean;
  chartViewMode: "both" | "hourly" | "daily";
  onChangeChartViewMode: (mode: "both" | "hourly" | "daily") => void;
  onSelectHour: (hourIdx: number) => void;
  onSelectDay: (dayIdx: number) => void;
}

export function FahSaiSeverityCharts({
  activeArea,
  activeHour,
  activeTopicMeta,
  activeTierColor,
  bands,
  topic,
  dayIdx,
  hourIdx,
  dark,
  chartViewMode,
  onChangeChartViewMode,
  onSelectHour,
  onSelectDay,
}: FahSaiSeverityChartsProps) {
  // Build SVG path and per-hour severity colors for the 24-hour animated curve chart ("กราฟแยกสีความรุนแรง")
  const hourlyCurve = useMemo(() => {
    const tierCounts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const pts = activeArea.hourly.map((h, i) => {
      const sev = classifyHourlyPointRisk(activeArea, h, topic);
      tierCounts[sev.tier] = (tierCounts[sev.tier] ?? 0) + 1;
      const val =
        topic === "rain"
          ? h.rainProb
          : topic === "sky"
            ? 100 - h.cloudPct
            : topic === "tide"
              ? h.tideMsl
              : topic === "wave"
                ? h.waveM
                : topic === "air"
                  ? h.pm25
                  : topic === "heat"
                    ? h.feelsLikeC
                    : topic === "winter"
                      ? h.tempC
                      : 100 - h.rainProb * 0.6;
      const norm =
        topic === "rain" || topic === "sky" || topic === "tourism" || topic === "suitable" || topic === "risk"
          ? Math.min(1, Math.max(0, val / 100))
          : topic === "air"
            ? Math.min(1, val / 80)
            : topic === "heat" || topic === "winter"
              ? Math.min(1, Math.max(0, (val - 14) / 30))
              : topic === "wave"
                ? Math.min(1, Math.max(0, val / 2.5))
                : Math.min(1, Math.max(0, (val + 1.8) / 3.8));
      const x = 28 + (i / 23) * 704;
      const y = 112 - norm * 88;
      return { x, y, val: Number(val.toFixed(2)), label: h.hourLabel, sev };
    });
    const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},122 L${pts[0].x.toFixed(1)},122 Z`;
    const thresholdY =
      topic === "rain"
        ? 112 - 0.55 * 88
        : topic === "air"
          ? 112 - (37.5 / 80) * 88
          : topic === "heat"
            ? 112 - ((38 - 14) / 30) * 88
            : topic === "winter"
              ? 112 - ((20 - 14) / 30) * 88
              : 112 - 0.65 * 88;
    const thresholdLabel =
      topic === "rain"
        ? "เกณฑ์ฝนกระจาย 60% ของพื้นที่ (กรมอุตุฯ)"
        : topic === "air"
          ? "เกณฑ์มาตรฐานไทย 37.5 µg/m³"
          : topic === "heat"
            ? "เกณฑ์เตือนความร้อน 38°C"
            : topic === "winter"
              ? "เกณฑ์อากาศหนาวเย็น 20°C"
              : "เกณฑ์อ้างอิงมาตรฐาน";

    const orderedBands = topic === "winter" ? [...bands].reverse() : bands;
    const bandHeight = 88 / orderedBands.length;
    const zoneBands = orderedBands.map((b, idx) => ({
      tier: b.tier,
      color: b.color,
      label: b.label.split("·")[0]?.trim() ?? `ระดับ ${b.tier}`,
      yTop: 24 + idx * bandHeight,
      height: bandHeight,
    }));

    return { pts, linePath, areaPath, thresholdY, thresholdLabel, tierCounts, zoneBands };
  }, [activeArea, bands, topic]);

  // Build SVG path and per-day severity colors for the 7-Day Daily Forecast Curve & Bar Chart ("กราฟพยากรณ์รายวัน")
  const dailyCurve = useMemo(() => {
    const tierCounts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const pts = activeArea.daily.map((d, i) => {
      const sev = classifyDailyPointRisk(activeArea, d, topic);
      tierCounts[sev.tier] = (tierCounts[sev.tier] ?? 0) + 1;
      const highTideDay = Number(
        (activeArea.current.highTideMsl * (1 + Math.sin(i * 0.65) * 0.08)).toFixed(2)
      );
      const feelsMax = calculateHeatIndexC(d.maxTempC, activeArea.current.humidity);
      const clearSkyPct = Math.max(12, 100 - Math.round(d.rainProb * 0.85));

      const val =
        topic === "rain"
          ? d.rainProb
          : topic === "sky"
            ? clearSkyPct
            : topic === "tide"
              ? highTideDay
              : topic === "wave"
                ? d.waveMaxM
                : topic === "air"
                  ? d.pm25Avg
                  : topic === "heat"
                    ? feelsMax
                    : topic === "winter"
                      ? d.minTempC
                      : topic === "tourism" || topic === "suitable"
                        ? d.tourismScore
                        : sev.tier * 20;

      const valLabel =
        topic === "rain"
          ? `${toTmdRainAreaPercent(d.rainProb)}%`
          : topic === "sky"
            ? `ฟ้าใส ${clearSkyPct}%`
            : topic === "tide"
              ? activeArea.isCoastal || highTideDay > 0
                ? `+${highTideDay}ม.`
                : "พื้นที่ดอน"
              : topic === "wave"
                ? activeArea.isCoastal
                  ? `${d.waveMaxM}ม.`
                  : "น้ำจืด"
                : topic === "air"
                  ? `${Math.round(d.pm25Avg)} µg`
                  : topic === "heat"
                    ? `${feelsMax}°C`
                    : topic === "winter"
                      ? `เช้า ${d.minTempC}°C`
                      : topic === "tourism" || topic === "suitable"
                        ? `${d.tourismScore}%`
                        : `ระดับ ${sev.tier}/5`;

      const subLabel =
        topic === "rain"
          ? `${getTmdRainCoverageLabel(toTmdRainAreaPercent(d.rainProb))} · ${d.rainMm} มม.`
          : topic === "sky"
            ? `${d.minTempC}°–${d.maxTempC}°C`
            : topic === "tide"
              ? `ฝน ${toTmdRainAreaPercent(d.rainProb)}% · ${d.maxTempC}°C`
              : topic === "wave"
                ? `ฝน ${toTmdRainAreaPercent(d.rainProb)}% · UV ${d.uvMax}`
                : topic === "air"
                  ? `US AQI ${calculateUsAqiFromPm25(d.pm25Avg)}`
                  : topic === "heat"
                    ? `วัดจริง ${d.maxTempC}°C · UV ${d.uvMax}`
                    : topic === "winter"
                      ? `บ่าย ${d.maxTempC}°C · ฝน ${toTmdRainAreaPercent(d.rainProb)}%`
                      : `🌧️ ${toTmdRainAreaPercent(d.rainProb)}% · 🌡️ ${d.minTempC}°–${d.maxTempC}°C`;

      const norm =
        topic === "rain" || topic === "sky" || topic === "tourism" || topic === "suitable" || topic === "risk"
          ? Math.min(1, Math.max(0.06, val / 100))
          : topic === "air"
            ? Math.min(1, Math.max(0.08, val / 80))
            : topic === "heat" || topic === "winter"
              ? Math.min(1, Math.max(0.08, (val - 14) / 30))
              : topic === "wave"
                ? Math.min(1, Math.max(0.08, val / 2.5))
                : Math.min(1, Math.max(0.08, (val + 0.5) / 2.6));

      const x = 68 + (i / Math.max(1, activeArea.daily.length - 1)) * 624;
      const y = 112 - norm * 84;
      const barPct = Math.round(norm * 100);
      return {
        x,
        y,
        val: Number(val.toFixed(2)),
        valLabel,
        subLabel,
        barPct: Math.max(16, Math.min(100, barPct)),
        day: d,
        sev,
      };
    });

    const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},122 L${pts[0].x.toFixed(1)},122 Z`;
    return { pts, linePath, areaPath, tierCounts };
  }, [activeArea, topic]);

  return (
    <>
      {/* CHART VIEW MODE SWITCHER FOR EASY MOBILE & DESKTOP SCANNING */}
      <div
        className="fs-charts-hub-bar"
        id="fs-charts-hub"
        role="region"
        aria-label="ตัวเลือกมุมมองกราฟพยากรณ์แยกสีความรุนแรง"
      >
        <div className="fs-charts-hub-title">
          <strong>📊 กราฟพยากรณ์แยกสีความรุนแรง · จ.{activeArea.name}</strong>
          <small>เลือกดูกราฟรายชั่วโมง 24 ชม. หรือกราฟรายวัน 7 วันล่วงหน้า</small>
        </div>
        <div className="fs-chart-mode-tabs" role="group" aria-label="สลับมุมมองกราฟพยากรณ์">
          <button
            type="button"
            className={`fs-chart-mode-btn ${chartViewMode === "both" ? "is-active" : ""}`}
            aria-pressed={chartViewMode === "both"}
            onClick={() => onChangeChartViewMode("both")}
          >
            📊 แสดงคู่กันทั้งหมด
          </button>
          <button
            type="button"
            className={`fs-chart-mode-btn ${chartViewMode === "hourly" ? "is-active" : ""}`}
            aria-pressed={chartViewMode === "hourly"}
            onClick={() => onChangeChartViewMode("hourly")}
          >
            ⏱️ รายชั่วโมง (24 ชม.)
          </button>
          <button
            type="button"
            className={`fs-chart-mode-btn ${chartViewMode === "daily" ? "is-active" : ""}`}
            aria-pressed={chartViewMode === "daily"}
            onClick={() => onChangeChartViewMode("daily")}
          >
            📅 รายวัน (7 วัน)
          </button>
        </div>
      </div>

      {/* SECTION 4: INTERACTIVE 24-HOUR SEVERITY-COLORED CURVE & BAR CHART ("กราฟแยกสีความรุนแรง") */}
      <section
        className={`fs-timeline-section ${chartViewMode === "daily" ? "is-chart-hidden" : ""}`}
        aria-labelledby="fs-hourly-title"
      >
        <div className="fs-section-head">
          <div>
            <span className="fs-eyebrow">
              📈 กราฟแยกสีความรุนแรงรายชั่วโมง 24 ชม. ({activeArea.daily[dayIdx]?.dayLabel ?? "วันนี้"})
            </span>
            <h2 id="fs-hourly-title">
              เส้นแนวโน้มและกราฟแท่งแยกสีความรุนแรง 5 ระดับ · จ.{activeArea.name} ({activeTopicMeta.label})
            </h2>
          </div>
          <div className="fs-hour-readout">
            <span>
              วัน/เวลาที่เลือก:{" "}
              <strong>
                {activeArea.daily[dayIdx]?.dayLabel ?? "วันนี้"} · {activeHour.hourLabel} น.
              </strong>
            </span>
            <b>
              🌡️ {activeHour.tempC}°C (ร้อนจริง {activeHour.feelsLikeC}°C) · 🌧️ ฝน{" "}
              {activeHour.rainProb}% · 😷 PM2.5 {activeHour.pm25} · 🌊 น้ำทะเล{" "}
              {activeHour.tideMsl >= 0 ? "+" : ""}
              {activeHour.tideMsl} ม.
            </b>
          </div>
        </div>

        {/* 5-LEVEL SEVERITY COLOR SUMMARY BAR */}
        <div
          className="fs-severity-legend-strip"
          role="group"
          aria-label="สรุปจำนวนชั่วโมงแยกตามสีระดับความรุนแรง"
        >
          {bands.map((b) => {
            const count = hourlyCurve.tierCounts[b.tier] ?? 0;
            return (
              <div
                key={b.tier}
                className={`fs-sev-chip ${count > 0 ? "has-hours" : ""}`}
                style={{ borderColor: `${b.color}66`, background: `${b.color}12` }}
              >
                <span className="fs-sev-dot" style={{ background: b.color }} />
                <div className="fs-sev-text">
                  <strong style={{ color: b.color }}>{b.label}</strong>
                  <small>
                    {b.rangeText} · <b>{count} ชม./วัน</b>
                  </small>
                </div>
              </div>
            );
          })}
        </div>

        <p className="fs-mobile-chart-hint">
          คลิกที่จุดชั่วโมงหรือแท่งกราฟสีความรุนแรงด้านล่าง เพื่อซิงค์เวลาพยากรณ์กับแผนที่ประเทศไทยทันที
        </p>
        <div className="fs-curve-svg-wrap">
          <svg
            viewBox="0 0 760 135"
            className="fs-curve-svg"
            role="img"
            aria-label={`กราฟเส้นโค้งแยกสีความรุนแรงรายชั่วโมง 24 ชั่วโมงของ ${activeArea.name}`}
          >
            <defs>
              <linearGradient id="fs-curve-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={activeTierColor} stopOpacity="0.28" />
                <stop offset="100%" stopColor={activeTierColor} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* 5 Horizontal Severity Color Zone Backgrounds */}
            {hourlyCurve.zoneBands.map((z) => (
              <g key={z.tier}>
                <rect
                  x="24"
                  y={z.yTop}
                  width="712"
                  height={z.height}
                  fill={z.color}
                  fillOpacity="0.09"
                />
                <line
                  x1="24"
                  y1={z.yTop}
                  x2="736"
                  y2={z.yTop}
                  stroke={z.color}
                  strokeOpacity="0.25"
                  strokeWidth="0.8"
                />
                <text
                  x="30"
                  y={z.yTop + 12}
                  fill={z.color}
                  fontSize="9.6"
                  fontWeight="800"
                  opacity="0.92"
                >
                  {z.label}
                </text>
              </g>
            ))}

            <line
              x1="24"
              y1={hourlyCurve.thresholdY}
              x2="736"
              y2={hourlyCurve.thresholdY}
              stroke="#f43f5e"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
            <text
              x="732"
              y={Math.max(12, hourlyCurve.thresholdY - 5)}
              textAnchor="end"
              fill="#f43f5e"
              fontSize="10.2"
              fontWeight="800"
            >
              --- {hourlyCurve.thresholdLabel}
            </text>

            <path d={hourlyCurve.areaPath} fill="url(#fs-curve-fill)" />

            {/* Per-Hour Severity-Colored Vertical Stems & Line Segments */}
            {hourlyCurve.pts.map((p, idx) => {
              const nextP = hourlyCurve.pts[idx + 1];
              return (
                <g key={`seg-${p.label}`}>
                  <line
                    x1={p.x}
                    y1={p.y}
                    x2={p.x}
                    y2={122}
                    stroke={p.sev.color}
                    strokeOpacity={idx === hourIdx ? "0.65" : "0.24"}
                    strokeWidth={idx === hourIdx ? "3" : "1.5"}
                  />
                  {nextP && (
                    <line
                      x1={p.x}
                      y1={p.y}
                      x2={nextP.x}
                      y2={nextP.y}
                      stroke={nextP.sev.color}
                      strokeWidth="3.4"
                      strokeLinecap="round"
                    />
                  )}
                </g>
              );
            })}

            {hourlyCurve.pts.map((p, idx) => {
              const isSel = idx === hourIdx;
              return (
                <g
                  key={p.label}
                  transform={`translate(${p.x}, ${p.y})`}
                  onClick={() => onSelectHour(idx)}
                  style={{ cursor: "pointer" }}
                >
                  {isSel && <circle r="10.5" fill={p.sev.color} opacity="0.28" />}
                  <circle
                    r={isSel ? 5.8 : 3.6}
                    fill={isSel ? "#ffffff" : p.sev.color}
                    stroke={p.sev.color}
                    strokeWidth={isSel ? "3.2" : "1.6"}
                  />
                  {(isSel || idx % 3 === 0) && (
                    <text
                      x="0"
                      y="-9"
                      textAnchor="middle"
                      fill={isSel ? p.sev.color : dark ? "#e2e8f0" : "#1e293b"}
                      fontSize={isSel ? "11.5" : "10"}
                      fontWeight="800"
                      paintOrder="stroke"
                      stroke={dark ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.88)"}
                      strokeWidth="2.4"
                    >
                      {topic === "tide"
                        ? `${p.val >= 0 ? "+" : ""}${p.val}`
                        : topic === "wave"
                          ? `${p.val}m`
                          : Math.round(p.val)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <input
          type="range"
          min={0}
          max={23}
          value={hourIdx}
          onChange={(e) => onSelectHour(Number(e.target.value))}
          className="fs-time-slider"
          aria-label="เลื่อนเลือกชั่วโมงพยากรณ์"
        />

        <div className="fs-hourly-bars">
          {activeArea.hourly.map((h, idx) => {
            const selected = idx === hourIdx;
            const hSev = classifyHourlyPointRisk(activeArea, h, topic);
            const val =
              topic === "rain"
                ? h.rainProb
                : topic === "air"
                  ? h.pm25
                  : topic === "heat"
                    ? h.feelsLikeC
                    : topic === "winter" || topic === "sky"
                      ? h.tempC
                      : topic === "wave"
                        ? h.waveM
                        : h.tideMsl;
            const heightPct =
              topic === "rain"
                ? Math.max(10, h.rainProb)
                : topic === "air"
                  ? Math.min(100, Math.max(12, (h.pm25 / 60) * 100))
                  : topic === "heat" || topic === "winter" || topic === "sky"
                    ? Math.min(100, Math.max(16, ((val - 14) / 28) * 100))
                    : topic === "wave"
                      ? Math.min(100, Math.max(14, (h.waveM / 2.2) * 100))
                      : Math.min(100, Math.max(14, ((h.tideMsl + 1.6) / 3.2) * 100));

            return (
              <button
                key={h.hourLabel}
                type="button"
                className={`fs-hour-col ${selected ? "is-selected" : ""}`}
                style={
                  selected
                    ? { borderColor: hSev.color, background: `${hSev.color}16` }
                    : undefined
                }
                onClick={() => onSelectHour(idx)}
                title={`${h.hourLabel} น. · ระดับ ${hSev.tier}/5 (${hSev.shortTag})`}
              >
                <small className="fs-hour-val" style={{ color: hSev.color }}>
                  {topic === "rain"
                    ? `${h.rainProb}%`
                    : topic === "air"
                      ? Math.round(h.pm25)
                      : topic === "tide"
                        ? `${h.tideMsl >= 0 ? "+" : ""}${h.tideMsl}`
                        : topic === "wave"
                          ? `${h.waveM}m`
                          : `${Math.round(val)}°`}
                </small>
                <div className="fs-hour-bar-track">
                  <i
                    style={{
                      height: `${heightPct}%`,
                      background: hSev.color,
                    }}
                  />
                </div>
                <span
                  className="fs-hour-sev-pill"
                  style={{ background: `${hSev.color}22`, color: hSev.color }}
                >
                  Lv.{hSev.tier}
                </span>
                <span className="fs-hour-time">{h.hourLabel.slice(0, 2)}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* SECTION 4B: INTERACTIVE 7-DAY DAILY FORECAST SEVERITY CURVE & BAR CHART ("กราฟพยากรณ์รายวันด้วย") */}
      <section
        className={`fs-timeline-section fs-daily-forecast-section ${chartViewMode === "hourly" ? "is-chart-hidden" : ""}`}
        aria-labelledby="fs-daily-chart-title"
      >
        <div className="fs-section-head">
          <div>
            <span className="fs-eyebrow">
              📅 กราฟพยากรณ์รายวัน 7 วัน แยกสีความรุนแรง (Interactive 7-Day Daily Forecast Graph)
            </span>
            <h2 id="fs-daily-chart-title">
              กราฟเส้นแนวโน้มและแท่งความรุนแรงรายวัน (7 วันล่วงหน้า) · จ.{activeArea.name} ({activeTopicMeta.label})
            </h2>
          </div>
          <div className="fs-hour-readout">
            <span>
              วันที่เลือกบนแผนที่:{" "}
              <strong>{activeArea.daily[dayIdx]?.dayLabel ?? "วันนี้"}</strong>
            </span>
            <b>
              🌧️ ฝน {toTmdRainAreaPercent(activeArea.daily[dayIdx]?.rainProb ?? activeArea.current.rainProb)}% ของพื้นที่ (
              {getTmdRainCoverageLabel(toTmdRainAreaPercent(activeArea.daily[dayIdx]?.rainProb ?? activeArea.current.rainProb))} ·{" "}
              {activeArea.daily[dayIdx]?.rainMm ?? activeArea.current.rain24hMm} มม.) · 🌡️{" "}
              {activeArea.daily[dayIdx]?.minTempC ?? activeArea.current.minMorningC}°C –{" "}
              {activeArea.daily[dayIdx]?.maxTempC ?? activeArea.current.maxAfternoonC}°C · 😷 PM2.5 เฉลี่ย{" "}
              {activeArea.daily[dayIdx]?.pm25Avg ?? activeArea.current.pm25} µg/m³
            </b>
          </div>
        </div>

        {/* 5-LEVEL DAILY SEVERITY SUMMARY STRIP */}
        <div
          className="fs-severity-legend-strip"
          role="group"
          aria-label="สรุปจำนวนวันแยกตามสีระดับความรุนแรงใน 7 วัน"
        >
          {bands.map((b) => {
            const count = dailyCurve.tierCounts[b.tier] ?? 0;
            return (
              <div
                key={`daily-band-${b.tier}`}
                className={`fs-sev-chip ${count > 0 ? "has-hours" : ""}`}
                style={{ borderColor: `${b.color}66`, background: `${b.color}12` }}
              >
                <span className="fs-sev-dot" style={{ background: b.color }} />
                <div className="fs-sev-text">
                  <strong style={{ color: b.color }}>{b.label}</strong>
                  <small>
                    {b.rangeText} · <b>{count} วัน/สัปดาห์</b>
                  </small>
                </div>
              </div>
            );
          })}
        </div>

        <p className="fs-mobile-chart-hint">
          คลิกที่จุดวันหรือการ์ดแท่งรายวันด้านล่าง เพื่อเปลี่ยนวันพยากรณ์บนแผนที่ทั้ง 77 จังหวัดและกราฟรายชั่วโมงทันที
        </p>

        {/* 7-DAY DAILY SVG CURVE WITH 5 SEVERITY ZONES */}
        <div className="fs-curve-svg-wrap">
          <svg
            viewBox="0 0 760 148"
            className="fs-curve-svg"
            role="img"
            aria-label={`กราฟพยากรณ์รายวัน 7 วันแยกสีความรุนแรงของ ${activeArea.name}`}
          >
            <defs>
              <linearGradient id="fs-daily-curve-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={activeTierColor} stopOpacity="0.26" />
                <stop offset="100%" stopColor={activeTierColor} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* 5 Horizontal Severity Color Zone Backgrounds */}
            {hourlyCurve.zoneBands.map((z) => (
              <g key={`dzone-${z.tier}`}>
                <rect
                  x="24"
                  y={z.yTop}
                  width="712"
                  height={z.height}
                  fill={z.color}
                  fillOpacity="0.09"
                />
                <line
                  x1="24"
                  y1={z.yTop}
                  x2="736"
                  y2={z.yTop}
                  stroke={z.color}
                  strokeOpacity="0.25"
                  strokeWidth="0.8"
                />
                <text
                  x="30"
                  y={z.yTop + 12}
                  fill={z.color}
                  fontSize="9.6"
                  fontWeight="800"
                  opacity="0.92"
                >
                  {z.label}
                </text>
              </g>
            ))}

            <line
              x1="24"
              y1={hourlyCurve.thresholdY}
              x2="736"
              y2={hourlyCurve.thresholdY}
              stroke="#f43f5e"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
            <text
              x="732"
              y={Math.max(12, hourlyCurve.thresholdY - 5)}
              textAnchor="end"
              fill="#f43f5e"
              fontSize="10.2"
              fontWeight="800"
            >
              --- {hourlyCurve.thresholdLabel}
            </text>

            <path d={dailyCurve.areaPath} fill="url(#fs-daily-curve-fill)" />

            {/* Per-Day Severity-Colored Columns & Connecting Line Segments */}
            {dailyCurve.pts.map((p, idx) => {
              const nextP = dailyCurve.pts[idx + 1];
              const isSel = idx === dayIdx;
              return (
                <g key={`dseg-${p.day.dayLabel}`}>
                  <rect
                    x={p.x - 16}
                    y={p.y}
                    width="32"
                    height={Math.max(4, 122 - p.y)}
                    rx="6"
                    fill={p.sev.color}
                    fillOpacity={isSel ? "0.38" : "0.18"}
                    stroke={p.sev.color}
                    strokeOpacity={isSel ? "0.85" : "0.35"}
                    strokeWidth={isSel ? "2" : "1"}
                    style={{ cursor: "pointer" }}
                    onClick={() => onSelectDay(idx)}
                  />
                  {nextP && (
                    <line
                      x1={p.x}
                      y1={p.y}
                      x2={nextP.x}
                      y2={nextP.y}
                      stroke={nextP.sev.color}
                      strokeWidth="3.8"
                      strokeLinecap="round"
                    />
                  )}
                </g>
              );
            })}

            {/* Interactive Day Nodes & Labels */}
            {dailyCurve.pts.map((p, idx) => {
              const isSel = idx === dayIdx;
              return (
                <g
                  key={`dpt-${p.day.dayLabel}`}
                  transform={`translate(${p.x}, ${p.y})`}
                  onClick={() => onSelectDay(idx)}
                  style={{ cursor: "pointer" }}
                >
                  {isSel && <circle r="12" fill={p.sev.color} opacity="0.28" />}
                  <circle
                    r={isSel ? 6.5 : 4.8}
                    fill={isSel ? "#ffffff" : p.sev.color}
                    stroke={p.sev.color}
                    strokeWidth={isSel ? "3.5" : "2"}
                  />
                  <text
                    x="0"
                    y="-11"
                    textAnchor="middle"
                    fill={p.sev.color}
                    fontSize={isSel ? "11.5" : "10.2"}
                    fontWeight="900"
                    paintOrder="stroke"
                    stroke={dark ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.88)"}
                    strokeWidth="2.4"
                  >
                    {p.valLabel}
                  </text>
                  <text
                    x="0"
                    y={138 - p.y}
                    textAnchor="middle"
                    fill={isSel ? p.sev.color : dark ? "#e2e8f0" : "#1e293b"}
                    fontSize={isSel ? "11.5" : "10.2"}
                    fontWeight={isSel ? "900" : "700"}
                  >
                    {p.day.dayLabel} (Lv.{p.sev.tier})
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* 7-DAY INTERACTIVE SEVERITY BAR CARDS */}
        <div
          className="fs-daily-bars-grid"
          role="group"
          aria-label="การ์ดกราฟแท่งพยากรณ์รายวัน 7 วันแยกสีความรุนแรง"
        >
          {dailyCurve.pts.map((p, idx) => {
            const isSel = idx === dayIdx;
            return (
              <button
                key={`dbar-${p.day.dayLabel}`}
                type="button"
                className={`fs-daily-bar-card ${isSel ? "is-selected" : ""}`}
                style={
                  isSel
                    ? { borderColor: p.sev.color, background: `${p.sev.color}15` }
                    : undefined
                }
                onClick={() => onSelectDay(idx)}
              >
                <div className="fs-dbc-head">
                  <strong>{p.day.dayLabel}</strong>
                  <span
                    className="fs-dbc-lv"
                    style={{ background: `${p.sev.color}22`, color: p.sev.color }}
                  >
                    Lv.{p.sev.tier}
                  </span>
                </div>
                <div className="fs-dbc-val" style={{ color: p.sev.color }}>
                  {p.valLabel}
                </div>
                <div className="fs-dbc-bar-track">
                  <i style={{ height: `${p.barPct}%`, background: p.sev.color }} />
                </div>
                <span className="fs-dbc-tag" style={{ color: p.sev.color }}>
                  {p.sev.shortTag}
                </span>
                <small className="fs-dbc-sub">{p.subLabel}</small>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
