"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect, useId, useMemo, useState } from "react";
import ThemeToggle from "../theme-toggle";
import RiskAreaMap from "../intelligence/risk-area-map";
import WaterHistoryChart from "../intelligence/water-history-chart";
import { useLiveResource } from "../intelligence/use-live-resource";
import { buildHydroBasins, hydroStation, HYDRO_BASINS, type HydroBasin, type HydroPayload } from "../../lib/hydro/model";
import { formatWaterValue, waterBankDifference, waterRisk, type WaterStation } from "../../lib/water-levels";
import { thaiObservationTime } from "../../lib/observation-time";
import { parseComparisonIds } from "../../lib/hydro/comparison";
import type { RiskAreaPoint, RiskRank } from "../../lib/risk-area-data";
import HydroComparison from "./hydro-comparison";
import HydroWeatherContext from "./hydro-weather-context";
import HydroTideContext from "./hydro-tide-context";
import HydroFollowedStations from "./hydro-followed-stations";
import HydroQgisLayout from "./hydro-qgis-layout";
import "./hydro.css";

type View = "summary" | "explore" | "basin" | "station" | "watchlist" | "sources";
type Saved = { version: 1; basins: string[]; stations: { id: string; basinId: string }[] };
type IngestionHealthPayload = { status: "available" | "stale" | "failed" | "unknown" | "unavailable"; storage: string; lastSuccessAt?: string | null; latestObservedAt?: string | null; observationLagMs?: number | null; runs: { status: "success" | "failed"; endedAt: string; accepted: number; rejected: number }[] };
type StatusFilter = "all" | "exceeded" | "high" | "fresh";

const EMPTY_SAVED: Saved = { version: 1, basins: [], stations: [] };
const nf = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
const basinName = (id: string) => HYDRO_BASINS.find(basin => basin.id === id)?.name ?? "ลุ่มเจ้าพระยา";
const link = (path: string, basinId: string, stationId = "") => {
  const params = new URLSearchParams({ ...(basinId && basinId !== "all" ? { basin: basinId } : {}), ...(stationId ? { station: stationId } : {}) });
  return params.size ? `${path}?${params}` : path;
};
function readSaved(): Saved {
  try {
    const value = JSON.parse(localStorage.getItem("hydro-watchlist-v1") ?? "null");
    if (value?.version === 1 && Array.isArray(value.basins) && Array.isArray(value.stations)) {
      const basins = [...new Set(value.basins.filter((id: unknown) => typeof id === "string" && HYDRO_BASINS.some(basin => basin.id === id)))] as string[];
      const rawStations: unknown[] = value.stations;
      const stations = rawStations.filter((item): item is { id: string; basinId: string } => !!item && typeof item === "object" && "id" in item && "basinId" in item && typeof item.id === "string" && /^[a-zA-Z0-9_-]{1,96}$/.test(item.id) && typeof item.basinId === "string" && HYDRO_BASINS.some(basin => basin.id === item.basinId));
      return { version: 1, basins, stations: [...new Map(stations.map((item: { id: string; basinId: string }) => [`${item.basinId}:${item.id}`, item])).values()] };
    }
  } catch { /* Storage can be disabled. */ }
  return EMPTY_SAVED;
}
function time(value: string | null) { return value ? `${thaiObservationTime(value)} น.` : "ไม่ระบุเวลา"; }
function status(station: WaterStation) {
  if (station.status === "unavailable") return "ยังไม่มีค่าที่ใช้ได้";
  if (station.status === "stale") return "ข้อมูลล่าช้า";
  const risk = waterRisk(station);
  return risk.id === "overflow" ? "เกินเกณฑ์สถานี" : risk.id === "high" ? "น้ำมาก · ติดตาม" : risk.id === "unknown" || risk.id === "below-bank" ? "ยังจัดระดับไม่ได้" : risk.title;
}
function rank(station: WaterStation): RiskRank {
  if (station.status !== "fresh") return -1;
  const id = waterRisk(station).id;
  return id === "overflow" ? 3 : id === "high" || id === "critical-low" ? 2 : id === "low" ? 1 : id === "unknown" || id === "below-bank" ? -1 : 0;
}
function SourceStamp({ data, error }: { data: HydroPayload | null; error: string }) {
  const incomplete = data && Object.values(data.sources).some(state => state !== "live");
  return <div className="hy-source-stamp" role="status"><span className={`hy-dot ${error || !data || incomplete ? "is-muted" : ""}`}/><span>{error ? "อัปเดตล่าสุดไม่สำเร็จ · ตรวจเวลาค่าด้านล่าง" : data ? `${incomplete ? "บางแหล่งไม่พร้อม · ค่าที่เก็บไว้มีเวลาตรวจวัดเดิม" : "รับข้อมูล"} ${time(data.fetchedAt)} · แต่ละสถานีมีเวลาตรวจวัดต่างกัน` : "กำลังอ่านข้อมูลจากต้นทาง"}</span><a href="/sources">ตรวจแหล่งข้อมูล</a></div>;
}
function sourceLabel(data: HydroPayload, source: keyof HydroPayload["sources"]) {
  return data.sources[source] === "live" ? "ต้นทางตอบกลับ" : data.sources[source] === "last-known" ? `ใช้ข้อมูลที่เก็บไว้ ${time(data.lastKnownAt[source] ?? null)}` : "ต้นทางไม่พร้อมและไม่มีข้อมูลเก็บไว้";
}
function coverageCount(basin: HydroBasin, source: "rain" | "dams", data: HydroPayload | null) {
  if (basin.id === "chao-phraya" && source === "dams") return "ไม่ครอบคลุม";
  const count = basin[source].length;
  if (!data) return "กำลังโหลด";
  return count || (data.sources[source] === "unavailable" ? "ต้นทางไม่พร้อม" : "ยังไม่มีค่าล่าสุด");
}
function StationReading({ station }: { station: WaterStation }) {
  return <div className="hy-reading"><strong>{formatWaterValue(station.value)}</strong><span>{station.datum === "msl" ? "ม. รทก." : "ม. จากศูนย์เกจ"}</span></div>;
}

function friendlyWaterSummary(station: WaterStation): { emoji: string; tone: "ok" | "warn" | "danger" | "muted"; headline: string; tip: string } {
  if (station.status !== "fresh") {
    return {
      emoji: "⏳",
      tone: "muted",
      headline: "รอสัญญาณอัปเดตล่าสุดจากสถานี",
      tip: "ข้อมูลสถานีนี้เกิน 60 นาที จึงยังไม่ใช้สรุปสถานการณ์ปัจจุบัน",
    };
  }
  const r = waterRisk(station);
  const diff = waterBankDifference(station);
  const diffText = diff !== null ? (diff >= 0 ? `สูงกว่าเกณฑ์ตลิ่ง +${nf2.format(diff)} ม.` : `ต่ำกว่าตลิ่งอีก ${nf2.format(Math.abs(diff))} ม.`) : "";
  if (r.id === "overflow") {
    return {
      emoji: "🚨",
      tone: "danger",
      headline: `น้ำแตะหรือเกินเกณฑ์ตลิ่งของสถานี ${diffText}`,
      tip: "พื้นที่ลุ่มต่ำริมน้ำนอกแนวคันกั้นน้ำควรระวังน้ำเอ่อล้นตลิ่งและติดตามประกาศท้องถิ่น",
    };
  }
  if (r.id === "high") {
    return {
      emoji: "⚠️",
      tone: "warn",
      headline: `น้ำค่อนข้างมาก (70–100% ของลำน้ำ) ${diffText}`,
      tip: "น้ำยังอยู่ในลำน้ำแต่มีปริมาณมาก ชุมชนริมตลิ่งควรติดตามการเปลี่ยนแปลงต่อเนื่อง",
    };
  }
  return {
    emoji: "✅",
    tone: "ok",
    headline: `น้ำอยู่ในเกณฑ์ปกติ ${diffText}`,
    tip: "ระดับน้ำยังต่ำกว่าตลิ่งพอสมควร การระบายน้ำในลำน้ำเป็นปกติ",
  };
}

function StationChannelVisual({ station }: { station: WaterStation }) {
  const clipId = useId().replace(/:/g, "");
  const diff = waterBankDifference(station);
  const cap = station.status === "fresh" && station.capacityPercent !== null && Number.isFinite(station.capacityPercent) ? Math.max(0, station.capacityPercent) : null;
  const canDrawBank = station.status === "fresh" && station.value !== null && station.bank !== null && station.datum === "msl";
  const friendly = friendlyWaterSummary(station);

  let svgDiagram = null;
  if (canDrawBank && station.value !== null && station.bank !== null) {
    const bed = station.ground !== null && station.ground < station.bank && station.value >= station.ground ? station.ground : Math.min(station.value, station.bank) - 2.5;
    const top = Math.max(station.value, station.bank) + 0.8;
    const span = Math.max(0.5, top - bed);
    const yOf = (v: number) => 16 + ((top - v) / span) * 104;
    const waterY = Math.max(14, Math.min(120, yOf(station.value)));
    const bankY = Math.max(18, Math.min(116, yOf(station.bank)));
    const isOver = station.value >= station.bank;
    svgDiagram = <div className="hy-channel-svg-wrap">
      <div className="hy-channel-svg-head">
        <span>🌊 ภาพตัดขวางลำน้ำมีชีวิต (Live River Cross-Section)</span>
        {diff !== null && <b className={diff >= 0 ? "is-over" : "is-under"}>{diff > 0 ? `ล้นเกณฑ์ตลิ่ง +${nf2.format(diff)} ม.` : diff === 0 ? "เท่าระดับตลิ่งพอดี" : `เหลือระยะตลิ่งอีก ${nf2.format(Math.abs(diff))} ม.`}</b>}
      </div>
      <svg viewBox="0 0 320 142" className="hy-channel-svg" role="img" aria-label={`ภาพตัดขวางเทียบระดับน้ำ ${formatWaterValue(station.value)} เมตร รทก. กับตลิ่ง ${formatWaterValue(station.bank)} เมตร รทก.`}>
        <defs>
          <clipPath id={`ch-clip-${clipId}`}>
            <path d="M24,18 L54,120 L206,120 L236,18 Z" />
          </clipPath>
          <linearGradient id={`ch-water-${clipId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isOver ? "#fb7185" : "#06b6d4"} stopOpacity="0.92" />
            <stop offset="100%" stopColor={isOver ? "#e11d48" : "#0284c7"} stopOpacity="0.45" />
          </linearGradient>
        </defs>
        {/* Grass & Riverbanks */}
        <path d="M6,18 L26,18" stroke="#10b981" strokeWidth="5" strokeLinecap="round" />
        <path d="M234,18 L254,18" stroke="#10b981" strokeWidth="5" strokeLinecap="round" />
        <path d="M16,18 L24,18 L54,120 L206,120 L236,18 L244,18" fill="none" stroke="var(--hy-line)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <g clipPath={`url(#ch-clip-${clipId})`}>
          <rect x="20" y={waterY} width="220" height={Math.max(4, 122 - waterY)} fill={`url(#ch-water-${clipId})`} />
          <path className="hy-anim-wave-back" d={`M-40,${waterY} Q15,${waterY - 5} 70,${waterY} T180,${waterY} T290,${waterY}`} fill="none" stroke={isOver ? "#fda4af" : "#67e8f9"} strokeWidth="3" opacity="0.7" />
          <path className="hy-anim-wave-front" d={`M-20,${waterY + 1} Q35,${waterY + 5} 90,${waterY + 1} T200,${waterY + 1} T310,${waterY + 1}`} fill="none" stroke={isOver ? "#f43f5e" : "#0284c7"} strokeWidth="2.5" />
        </g>
        <line x1="16" y1={bankY} x2="246" y2={bankY} stroke="#f43f5e" strokeWidth="1.8" strokeDasharray="5 3" />
        <text x="250" y={bankY + 4} className="hy-channel-label is-bank">ตลิ่ง {formatWaterValue(station.bank)} ม.</text>
        <text x="250" y={Math.max(28, Math.min(116, waterY + 4))} className="hy-channel-label is-water">น้ำ {formatWaterValue(station.value)} ม.</text>
        {station.ground !== null && <text x="130" y="135" textAnchor="middle" className="hy-channel-bed">ท้องน้ำ {formatWaterValue(station.ground)} ม. รทก.</text>}
      </svg>
    </div>;
  }

  return <div className="hy-channel-visual-wrap">
    <div className={`hy-friendly-banner is-${friendly.tone}`}>
      <span className="hy-friendly-emoji" aria-hidden="true">{friendly.emoji}</span>
      <div>
        <strong>{friendly.headline}</strong>
        <p>{friendly.tip}</p>
      </div>
    </div>
    {(canDrawBank || cap !== null) && <div className="hy-channel-visual">
      {cap !== null && <div className="hy-cap-meter">
        <div className="hy-cap-head">
          <small>💧 หลอดวัดความจุลำน้ำ (เข้าใจง่าย)</small>
          <strong>{nf.format(cap)}% ของตลิ่ง</strong>
        </div>
        <div className="hy-cap-track" aria-hidden="true">
          <i className={cap > 100 ? "is-over" : cap > 70 ? "is-high" : ""} style={{ width: `${Math.min(100, cap)}%` }} />
          <span className="hy-cap-bank-marker" title="เกณฑ์ระดับตลิ่ง 100%" />
        </div>
        <div className="hy-cap-ticks">
          <span>{station.ground !== null && station.datum === "msl" ? `ท้องน้ำ (${formatWaterValue(station.ground)} ม.)` : "0% สบายใจ"}</span>
          <span>70% เริ่มน้ำมาก</span>
          <span className="is-bank-tick">{station.bank !== null && station.datum === "msl" ? `ตลิ่ง (${formatWaterValue(station.bank)} ม.)` : "100% ขอบตลิ่ง"}</span>
        </div>
      </div>}
      {svgDiagram}
    </div>}
  </div>;
}

function HydroBasinFlowDiagram({ basins, activeBasinId, onSelectBasin }: { basins: HydroBasin[]; activeBasinId: string; onSelectBasin: (id: string) => void }) {
  const [lens, setLens] = useState<"water" | "rain" | "dams">("water");
  const byId = new Map(basins.map(b => [b.id, b]));
  const upperIds = [
    { id: "06", short: "แม่น้ำปิง", icon: "⛰️", color: "#06b6d4" },
    { id: "07", short: "แม่น้ำวัง", icon: "🌲", color: "#14b8a6" },
    { id: "08", short: "แม่น้ำยม", icon: "🌾", color: "#0ea5e9" },
    { id: "09", short: "แม่น้ำน่าน", icon: "🏞️", color: "#3b82f6" },
  ] as const;
  const sideIds = [
    { id: "12", short: "+ แม่น้ำสะแกกรัง", side: "ฝั่งตะวันตก (อุทัยธานี)" },
    { id: "11", short: "+ แม่น้ำป่าสัก", side: "ฝั่งตะวันออก (สระบุรี–อยุธยา)" },
  ] as const;
  const core = byId.get("chao-phraya");
  const coreSelected = activeBasinId === "chao-phraya";

  const renderMetric = (b: HydroBasin | undefined) => {
    if (!b) return { big: "—", sub: "กำลังโหลด" };
    if (lens === "rain") {
      return {
        big: b.peakRain ? `${nf.format(b.peakRain.mm)} มม.` : "ไม่มีฝนเด่น",
        sub: b.peakRain ? `สูงสุดที่ ${b.peakRain.name}` : `ตรวจวัด ${b.rain.length} จุด`,
      };
    }
    if (lens === "dams") {
      const topDam = b.dams[0];
      return {
        big: topDam && topDam.storagePercent !== null ? `${nf.format(topDam.storagePercent)}%` : `${b.dams.length} แห่ง`,
        sub: topDam ? `${topDam.name}` : "อ่างเก็บน้ำรายวัน",
      };
    }
    return {
      big: `${b.freshWater}/${b.water.length}`,
      sub: b.exceededWater > 0 ? `🚨 ล้นตลิ่ง ${b.exceededWater} จุด` : b.highWater > 0 ? `⚠️ น้ำมาก ${b.highWater} จุด` : "✅ ปกติทุกสถานี",
    };
  };

  return <div className="hy-flow-card" aria-label="แผนผังโครงข่ายลุ่มน้ำเจ้าพระยาแบบโต้ตอบ">
    <div className="hy-flow-card-head">
      <div>
        <span className="hy-eyebrow">✨ Interactive River Flow · เส้นทางสายน้ำมีชีวิต</span>
        <h3>น้ำไหลจาก 4 แม่น้ำเหนือ สู่เจ้าพระยาและอ่าวไทยอย่างไร?</h3>
      </div>
      {activeBasinId !== "all" && <button type="button" className="hy-flow-reset" onClick={() => onSelectBasin("all")}>🔄 ดูครบทั้ง 7 ลุ่มน้ำ</button>}
    </div>

    <div className="hy-flow-lens-tabs" role="group" aria-label="เลือกมุมมองข้อมูลในผังสายน้ำ">
      <button type="button" aria-pressed={lens === "water"} onClick={() => setLens("water")}>🌊 ระดับน้ำในลำน้ำ</button>
      <button type="button" aria-pressed={lens === "rain"} onClick={() => setLens("rain")}>🌧️ ฝนตก 24 ชม.</button>
      <button type="button" aria-pressed={lens === "dams"} onClick={() => setLens("dams")}>🏞️ น้ำในเขื่อนหลัก</button>
    </div>

    <div className="hy-stitch-schematic">
      <div className="hy-stitch-tier4" role="group" aria-label="4 ลุ่มน้ำสายเหนือ">
        {upperIds.map(node => {
          const b = byId.get(node.id);
          const selected = activeBasinId === node.id;
          const hasExceeded = (b?.exceededWater ?? 0) > 0;
          const hasHigh = (b?.highWater ?? 0) > 0;
          const m = renderMetric(b);
          return <button
            key={node.id}
            type="button"
            className={`hy-stitch-node ${selected ? "is-selected" : ""} ${hasExceeded ? "is-exceeded" : hasHigh ? "is-high" : ""}`}
            aria-pressed={selected}
            onClick={() => onSelectBasin(selected ? "all" : node.id)}
          >
            <span className="hy-stitch-node-title">
              <span>{node.icon} {node.short}</span>
              {hasExceeded ? <i className="hy-dot-badge is-alert" /> : hasHigh ? <i className="hy-dot-badge is-warn" /> : <i className="hy-dot-badge is-ok" />}
            </span>
            <strong className="hy-stitch-node-val">{m.big}</strong>
            <small className="hy-stitch-node-sub">{m.sub}</small>
          </button>;
        })}
      </div>

      {/* Animated SVG River Confluence Streams */}
      <div className="hy-river-anim-stage" aria-hidden="true">
        <svg viewBox="0 0 400 58" className="hy-river-anim-svg">
          <defs>
            <linearGradient id="hy-stream-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>
          <path id="p-ping" d="M45,2 C45,30 165,28 200,52" className="hy-stream-line" />
          <path id="p-wang" d="M148,2 C148,26 185,30 200,52" className="hy-stream-line" />
          <path id="p-yom" d="M252,2 C252,26 215,30 200,52" className="hy-stream-line" />
          <path id="p-nan" d="M355,2 C355,30 235,28 200,52" className="hy-stream-line" />
          <circle r="4" className="hy-water-drop"><animateMotion dur="2.6s" repeatCount="indefinite" path="M45,2 C45,30 165,28 200,52" /></circle>
          <circle r="3.5" className="hy-water-drop"><animateMotion dur="2.2s" begin="0.5s" repeatCount="indefinite" path="M148,2 C148,26 185,30 200,52" /></circle>
          <circle r="3.5" className="hy-water-drop"><animateMotion dur="2.4s" begin="0.9s" repeatCount="indefinite" path="M252,2 C252,26 215,30 200,52" /></circle>
          <circle r="4" className="hy-water-drop"><animateMotion dur="2.5s" begin="0.2s" repeatCount="indefinite" path="M355,2 C355,30 235,28 200,52" /></circle>
        </svg>
        <span className="hy-confluence-pill">💧 ไหลมารวมกันที่ “ปากน้ำโพ จ.นครสวรรค์” (C.2)</span>
      </div>

      <div className="hy-stitch-tier2" role="group" aria-label="ลุ่มน้ำสาขาสมทบ">
        {sideIds.map(node => {
          const b = byId.get(node.id);
          const selected = activeBasinId === node.id;
          const hasExceeded = (b?.exceededWater ?? 0) > 0;
          const hasHigh = (b?.highWater ?? 0) > 0;
          const m = renderMetric(b);
          return <button
            key={node.id}
            type="button"
            className={`hy-stitch-side-node ${selected ? "is-selected" : ""} ${hasExceeded ? "is-exceeded" : hasHigh ? "is-high" : ""}`}
            aria-pressed={selected}
            onClick={() => onSelectBasin(selected ? "all" : node.id)}
          >
            <div>
              <strong>{node.short}</strong>
              <small>{node.side} · {m.sub}</small>
            </div>
            <b>{m.big}</b>
          </button>;
        })}
      </div>

      <button
        type="button"
        className={`hy-stitch-core-node ${coreSelected ? "is-selected" : ""}`}
        aria-pressed={coreSelected}
        onClick={() => onSelectBasin(coreSelected ? "all" : "chao-phraya")}
      >
        <div className="hy-stitch-core-left">
          <span className="hy-stitch-core-code">🌊</span>
          <div>
            <strong>แม่น้ำเจ้าพระยาตอนกลาง–ล่าง</strong>
            <small>นครสวรรค์ → เขื่อนเจ้าพระยา (ชัยนาท) → อยุธยา → ปทุมธานี → นนทบุรี → กรุงเทพฯ</small>
          </div>
        </div>
        <div className="hy-stitch-core-right">
          <b>{core ? `${core.freshWater}/${core.water.length}` : "—"} <small>สถานีสด</small></b>
          <span>{core?.exceededWater ? `🚨 เกินตลิ่ง ${core.exceededWater} · น้ำมาก ${core.highWater}` : core?.highWater ? `⚠️ เฝ้าระวังน้ำมาก ${core.highWater} จุด` : "✅ ระดับน้ำสายหลักปกติ · คลิกเพื่อดูเฉพาะเจ้าพระยา"}</span>
        </div>
      </button>

      <div className="hy-stitch-estuary">
        <span>⚓ ไหลออกสู่อ่าวไทยที่ ปากแม่น้ำเจ้าพระยา (จ.สมุทรปราการ)</span>
        <a href="#hy-tide-title">ดูจังหวะน้ำทะเลหนุน ↓</a>
      </div>
    </div>
    <p className="hy-flow-caption">💡 แตะที่ชื่อแม่น้ำใดก็ได้เพื่อซูมดูแผนที่และสถานีของแม่น้ำสายนั้น · แสดงความเชื่อมโยงของสายน้ำจริง ไม่ใช่การคำนวณเวลาน้ำเดินทาง</p>
  </div>;
}

function StationDetail({ station, basin, saved, watchlistFull, onToggle, compared, compareFull, onCompare, refresh }: { station: WaterStation; basin: HydroBasin; saved: boolean; watchlistFull: boolean; onToggle: () => void; compared?: boolean; compareFull?: boolean; onCompare?: () => void; refresh: number }) {
  const risk = waterRisk(station);
  const diff = waterBankDifference(station);
  const cap = station.status === "fresh" && station.capacityPercent !== null && Number.isFinite(station.capacityPercent) ? Math.max(0, station.capacityPercent) : null;
  return <article className="hy-station-detail" id="station-detail" aria-labelledby="station-title">
    <div className="hy-detail-heading">
      <div className="hy-detail-title-group">
        <div className="hy-station-code-badge" aria-hidden="true">
          <small>STATION</small>
          <strong>{station.id}</strong>
        </div>
        <div>
          <span className="hy-eyebrow">ลุ่มน้ำ{basin.name} · รหัส {station.id}</span>
          <h2 id="station-title">{station.name}</h2>
          <p>{station.waterway} · {station.district ? `${station.district} · ` : ""}{station.province}</p>
        </div>
      </div>
      <div className="hy-detail-actions">
        <b className={`hy-risk hy-risk-${rank(station)}`}>{status(station)}</b>
      </div>
    </div>

    <div className="hy-stitch-metrics-bento">
      <div className="hy-stitch-metric-card">
        <small>ระดับผิวน้ำตรวจวัด</small>
        <StationReading station={station}/>
        <p className={diff !== null && diff >= 0 ? "is-over" : "is-under"}>
          {diff !== null
            ? diff > 0 ? `▲ สูงกว่าตลิ่ง +${nf2.format(diff)} ม.` : diff === 0 ? "เท่าระดับตลิ่งพอดี" : `▼ ต่ำกว่าตลิ่ง ${nf2.format(Math.abs(diff))} ม.`
            : `ตรวจวัด ${time(station.observedAt)}`}
        </p>
      </div>
      <div className="hy-stitch-metric-card">
        <small>ความจุลำน้ำ & เกณฑ์ตลิ่ง</small>
        <div className="hy-reading">
          <strong>{cap !== null ? `${nf.format(cap)}%` : "—"}</strong>
          <span>ความจุลำน้ำ</span>
        </div>
        <p>{station.bank !== null && station.datum === "msl" ? `เกณฑ์ตลิ่ง ${formatWaterValue(station.bank)} ม. รทก.` : "ต้นทางไม่ระบุเกณฑ์ตลิ่ง รทก."}</p>
      </div>
    </div>

    <StationChannelVisual station={station} />
    <p className="hy-evidence">{station.status === "fresh" ? risk.message : "ค่าล่าสุดไม่พร้อมสำหรับสรุปสถานการณ์ปัจจุบัน"} · ตรวจวัด {time(station.observedAt)} ({station.agency}) · ระดับน้ำที่สถานีไม่ใช่ความลึกน้ำท่วมในชุมชน</p>
    <dl className="hy-definition"><div><dt>เกณฑ์ตลิ่ง</dt><dd>{station.bank === null || station.datum !== "msl" ? "ต้นทางไม่ระบุเกณฑ์ที่เทียบได้" : `${formatWaterValue(station.bank)} เมตร รทก.`}</dd></div><div><dt>ความจุลำน้ำ</dt><dd>{station.status !== "fresh" ? "ไม่ใช้จัดระดับจากข้อมูลล่าช้า" : station.capacityPercent === null ? "ไม่มีค่าที่ใช้ได้" : `${nf.format(station.capacityPercent)}% จากต้นทาง`}</dd></div><div><dt>สถานะข้อมูล</dt><dd>{station.status === "fresh" ? "ค่าภายใน 60 นาที" : station.status === "stale" ? "เก่ากว่า 60 นาที" : "ไม่มีค่าปัจจุบันที่ใช้ได้"}</dd></div></dl>
    <WaterHistoryChart station={station} version={station.observedAt ?? "none"} refresh={refresh} motion={false}/>
    <div className="hy-stitch-action-bar">
      <button type="button" className="hy-outline-button" aria-pressed={saved} disabled={watchlistFull && !saved} onClick={onToggle}>{saved ? "★ ติดตามแล้ว (เลิกติดตาม)" : watchlistFull ? "ติดตามครบ 20 สถานีแล้ว" : "☆ ติดตามสถานีนี้"}</button>
      {onCompare && <button type="button" className="hy-primary is-sm" aria-pressed={compared} disabled={compareFull && !compared} onClick={onCompare}>{compared ? "✓ อยู่ในตารางเทียบ (เอาออก)" : compareFull ? "เลือกครบ 4 สถานีแล้ว" : "+ เพิ่มในตารางเทียบกราฟ"}</button>}
    </div>
    <div className="hy-detail-links"><a href="https://www.thaiwater.net/water" target="_blank" rel="noreferrer">เปิดข้อมูลต้นทาง ↗</a><a href={link("/stations/" + encodeURIComponent(station.id), basin.id)}>ลิงก์สถานีนี้ →</a></div>
  </article>;
}

function BasinSignals({ basins }: { basins: HydroBasin[] }) {
  const rain = basins.flatMap(basin => basin.rain.map(point => ({ basin, point }))).sort((a, b) => b.point.mm - a.point.mm).slice(0, 8);
  const dams = basins.flatMap(basin => basin.dams.map(dam => ({ basin, dam }))).sort((a, b) => b.dam.date.localeCompare(a.dam.date)).slice(0, 8);
  const maxRain = Math.max(10, ...rain.map(r => r.point.mm));
  return <section className="hy-section hy-signals" aria-labelledby="hy-signals-title"><div className="hy-section-head"><div><span className="hy-eyebrow">หลักฐานประกอบ</span><h2 id="hy-signals-title">🌧️ ฝนตรวจวัดและ 🏞️ น้ำในเขื่อนหลัก</h2></div><p>ฝนสะสมย้อนหลัง 24 ชั่วโมงที่สถานี · อ่างเก็บน้ำเป็นรายงานรายวัน</p></div><div className="hy-signals-grid"><div><h3>🌧️ สถานีฝนที่รายงานสูงสุดล่าสุด</h3><p className="hy-signal-note">เรียงค่าสูงสุดจากสถานีที่มีข้อมูลภายใน 3 ชั่วโมง ไม่ใช่ฝนเฉลี่ยทั้งลุ่ม</p>{rain.length ? <ol className="hy-signal-list">{rain.map(({ basin, point }) => {
    const pct = Math.min(100, Math.round((point.mm / maxRain) * 100));
    return <li key={`${basin.id}:${point.id}`}>
      <div className="hy-signal-row-main">
        <strong>{point.name}</strong>
        <small>{basin.name} · ตรวจวัด {time(point.observedAt)}</small>
        <span className="hy-signal-bar" aria-hidden="true"><i style={{ width: `${Math.max(point.mm > 0 ? 6 : 0, pct)}%` }} /></span>
      </div>
      <b>{nf.format(point.mm)} <small>มม.</small></b>
    </li>;
  })}</ol> : <div className="hy-empty">ยังไม่มีค่าฝนตรวจวัดล่าสุดในพื้นที่นี้ ไม่ใช่ฝน 0 มม.</div>}<a className="hy-inline-link" href={basins.some(basin => basin.id === "chao-phraya") ? "#hy-weather-title" : "https://radargis.tmd.go.th/"}>{basins.some(basin => basin.id === "chao-phraya") ? "ดูเรดาร์และพยากรณ์ในหน้านี้ →" : "ตรวจเรดาร์กรมอุตุฯ ↗"}</a></div><div><h3>🏞️ ถังระดับน้ำอ่างเก็บน้ำรายวัน</h3><p className="hy-signal-note">ปริมาตรน้ำไหลเข้าและระบายออกเป็นล้านลูกบาศก์เมตรในวันที่รายงาน ไม่ใช่อัตราการไหลทันที</p>{dams.length ? <div className="hy-dam-list">{dams.map(({ basin, dam }) => {
    const capPct = dam.storagePercent !== null && Number.isFinite(dam.storagePercent) ? Math.min(100, Math.max(0, dam.storagePercent)) : null;
    return <article key={`${basin.id}:${dam.id}`} className="hy-dam-tank-card">
      <div className="hy-dam-visual-tank" aria-hidden="true">
        <div className={`hy-dam-liquid ${capPct !== null && capPct > 85 ? "is-high" : ""}`} style={{ height: `${capPct ?? 0}%` }}>
          <span className="hy-dam-wave" />
        </div>
        <span className="hy-dam-tank-pct">{capPct !== null ? `${nf.format(capPct)}%` : "—"}</span>
      </div>
      <div className="hy-dam-tank-body">
        <div className="hy-dam-head"><strong>{dam.name}</strong><small>ลุ่มน้ำ{basin.name} · วันที่ {dam.date}</small></div>
        {capPct !== null && <div className="hy-dam-bar" aria-hidden="true"><i className={capPct > 85 ? "is-high" : ""} style={{ width: `${capPct}%` }} /></div>}
        <dl><div><dt>💧 เก็บกัก</dt><dd>{dam.storagePercent === null ? "—" : `${nf.format(dam.storagePercent)}%`}</dd></div><div><dt>⬇️ ไหลเข้า</dt><dd>{dam.inflowMillionM3 === null ? "—" : nf.format(dam.inflowMillionM3)}</dd></div><div><dt>⬆️ ระบายออก</dt><dd>{dam.releasedMillionM3 === null ? "—" : nf.format(dam.releasedMillionM3)}</dd></div></dl><small>ไหลเข้า/ระบาย: ล้าน ลบ.ม. ในวันรายงาน</small>
      </div>
    </article>;
  })}</div> : <div className="hy-empty">ยังไม่มีรายงานอ่างรายวันที่ใช้ได้ในพื้นที่นี้</div>}{basins.some(basin => basin.id === "chao-phraya") && <p className="hy-downstream-note">บริบทปลายน้ำ: <a href="/water#tide-analysis">ดูน้ำขึ้นน้ำลงทำนายแยกจากระดับน้ำตรวจวัด →</a></p>}</div></div><p className="hy-signal-source">ที่มา: <a href="https://www.thaiwater.net/water" target="_blank" rel="noreferrer">ThaiWater ↗</a> · ตำแหน่งที่ไม่มี feed จะแสดงเป็นข้อมูลขาด ไม่เติมค่าจากพยากรณ์</p></section>;
}

function IngestionHealth({ refresh }: { refresh: number }) {
  const resource = useLiveResource<IngestionHealthPayload>("/api/ingestion-health", refresh);
  const data = resource.data;
  const latest = data?.runs[0];
  const label = !data ? "ยังตรวจการเก็บไม่ได้" : ({ available: "เก็บข้อมูลตามรอบ", stale: "ไม่มีรอบเก็บใหม่ตามกำหนด", failed: "รอบเก็บล่าสุดล้มเหลว", unknown: "ยังไม่มีบันทึกรอบเก็บ", unavailable: "อ่านบันทึกรอบเก็บไม่ได้" } as const)[data.status];
  return <article className="hy-ingestion-health"><div><span className="hy-eyebrow">การเก็บประวัติ · ไม่ใช่สถานะภัย</span><h2>ระบบเก็บระดับน้ำ</h2><p>ตรวจจากบันทึกรอบเก็บข้อมูล แยกจากเวลาค่าตรวจวัดของแต่ละสถานี</p></div><div><strong>{label}</strong>{latest && <p>รอบล่าสุด {time(latest.endedAt)} · {latest.status === "success" ? "สำเร็จ" : "ล้มเหลว"} · ผ่านเงื่อนไข {latest.accepted} / ไม่ผ่าน {latest.rejected} สถานี</p>}{data?.latestObservedAt && <p>ค่าตรวจวัดล่าสุดในรอบที่สำเร็จ {time(data.latestObservedAt)}</p>}{data?.lastSuccessAt && latest?.status === "failed" && <p>สำเร็จครั้งก่อน {time(data.lastSuccessAt)}</p>}{resource.error && <p>{resource.error}</p>}<small>สถานะนี้บอกการทำงานของตัวเก็บข้อมูล ไม่ยืนยันว่าทุกสถานีมีค่าล่าสุด</small></div></article>;
}

export default function HydroApp({ view = "summary", initialBasin = "all", initialStation = "" }: { view?: View; initialBasin?: string; initialStation?: string }) {
  const [basinId, setBasinId] = useState(HYDRO_BASINS.some(b => b.id === initialBasin) ? initialBasin : "all");
  const [stationId, setStationId] = useState(initialStation);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [exploreStageMode, setExploreStageMode] = useState<"geo" | "schematic">("geo");
  const [refresh, setRefresh] = useState(0);
  const [saved, setSaved] = useState<Saved>(EMPTY_SAVED);
  const [ready, setReady] = useState(false);
  const resource = useLiveResource<HydroPayload>("/api/hydro", refresh);
  const basins = useMemo(() => resource.data ? buildHydroBasins(resource.data, resource.clock) : [], [resource.data, resource.clock]);
  const selectedBasins = basinId === "all" ? basins : basins.filter(basin => basin.id === basinId);
  const allStations = selectedBasins.flatMap(basin => basin.water.map(station => ({ basin, station })));
  const matches = allStations.filter(({ station }) => {
    if (!`${station.name} ${station.id} ${station.waterway} ${station.province}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) return false;
    if (statusFilter === "exceeded") return rank(station) === 3;
    if (statusFilter === "high") return rank(station) >= 2;
    if (statusFilter === "fresh") return station.status === "fresh";
    return true;
  }).sort((a, b) => rank(b.station) - rank(a.station) || a.station.name.localeCompare(b.station.name, "th"));
  const selected = hydroStation(selectedBasins, stationId, basinId === "all" ? undefined : basinId) ?? (view === "summary" && matches[0] ? matches[0] : null);
  const comparedStations = useMemo(() => compareIds.map(id => {
    const item = hydroStation(basins, id);
    return { id, basinName: item?.basin.name ?? "ไม่ทราบลุ่มน้ำ", station: item?.station ?? null };
  }), [basins, compareIds]);
  const selectedKey = selected ? `${selected.basin.id}:${selected.station.id}` : "";
  const fresh = selectedBasins.reduce((sum, basin) => sum + basin.freshWater, 0);
  const total = selectedBasins.reduce((sum, basin) => sum + basin.water.length, 0);
  const high = selectedBasins.reduce((sum, basin) => sum + basin.highWater, 0);
  const exceeded = selectedBasins.reduce((sum, basin) => sum + basin.exceededWater, 0);
  const assessed = selectedBasins.reduce((sum, basin) => sum + basin.assessedWater, 0);
  const points: RiskAreaPoint[] = matches.map(({ basin, station }) => ({ id: `${basin.id}:${station.id}`, topic: "water", name: station.name, area: `${basin.name} · ${station.province}`, lat: station.lat, lng: station.lng, rank: rank(station), status: status(station), value: station.value, unit: station.datum === "msl" ? "ม. รทก." : "ม. จากศูนย์เกจ", detail: waterRisk(station).message, kind: "ตรวจวัด", source: station.agency, observedAt: station.observedAt, href: link(`/stations/${encodeURIComponent(station.id)}`, basin.id) }));
  useEffect(() => {
    const sync = () => { const params = new URLSearchParams(location.search); const requested = params.get("basin") ?? initialBasin; setBasinId(HYDRO_BASINS.some(b => b.id === requested) ? requested : "all"); setStationId(params.get("station") ?? initialStation); setCompareIds(parseComparisonIds(params.get("compare"))); };
    const timer = window.setTimeout(() => { setSaved(readSaved()); setReady(true); sync(); }, 0);
    window.addEventListener("popstate", sync); return () => { window.clearTimeout(timer); window.removeEventListener("popstate", sync); };
  }, [initialBasin, initialStation]);
  useEffect(() => {
    if (view !== "station" || !resource.data || !selectedKey) return;
    const timer = window.setTimeout(() => document.getElementById("station-detail")?.scrollIntoView({ block: "start" }), 0);
    return () => window.clearTimeout(timer);
  }, [view, resource.data, selectedKey]);
  function updateContext(nextBasin: string, nextStation = "") {
    if (view === "basin" && nextStation) { location.assign(link(`/stations/${encodeURIComponent(nextStation)}`, nextBasin)); return; }
    if (view === "basin") { location.assign(nextBasin === "all" ? "/" : `/basins/${encodeURIComponent(nextBasin)}`); return; }
    if (view === "station" && nextStation) { location.assign(link(`/stations/${encodeURIComponent(nextStation)}`, nextBasin)); return; }
    if (view === "station") { location.assign(link("/explore", nextBasin)); return; }
    setBasinId(nextBasin); setStationId(nextStation);
    const next = new URL(link(location.pathname, nextBasin, nextStation), location.origin);
    if (view === "explore" && compareIds.length) next.searchParams.set("compare", compareIds.join(","));
    history.pushState(null, "", next.pathname + next.search);
    if (nextStation && view !== "summary" && window.matchMedia("(max-width: 900px)").matches) window.setTimeout(() => document.getElementById("station-detail")?.scrollIntoView({ block: "start" }), 0);
  }
  function save(next: Saved) { setSaved(next); try { localStorage.setItem("hydro-watchlist-v1", JSON.stringify(next)); } catch { /* In-memory selection still works. */ } }
  function toggleStation(station: WaterStation, basin: HydroBasin) {
    const exists = saved.stations.some(row => row.id === station.id && row.basinId === basin.id);
    if (!exists && saved.stations.length >= 20) return;
    save({ ...saved, stations: exists ? saved.stations.filter(row => row.id !== station.id || row.basinId !== basin.id) : [...saved.stations, { id: station.id, basinId: basin.id }] });
  }
  function toggleBasin(id: string) { save({ ...saved, basins: saved.basins.includes(id) ? saved.basins.filter(item => item !== id) : [...saved.basins, id] }); }
  function toggleCompare(id: string) {
    const nextIds = compareIds.includes(id) ? compareIds.filter(item => item !== id) : compareIds.length < 4 ? [...compareIds, id] : compareIds;
    setCompareIds(nextIds);
    const next = new URL(location.href);
    if (nextIds.length) next.searchParams.set("compare", nextIds.join(",")); else next.searchParams.delete("compare");
    history.pushState(null, "", next.pathname + next.search);
  }
  function setQuickCompare(ids: string[]) {
    const nextIds = ids.slice(0, 4);
    setCompareIds(nextIds);
    const next = new URL(location.href);
    if (nextIds.length) next.searchParams.set("compare", nextIds.join(",")); else next.searchParams.delete("compare");
    history.pushState(null, "", next.pathname + next.search);
  }
  const exploreHref = (nextBasin = basinId, nextStation = stationId) => {
    const next = new URL(link("/explore", nextBasin, nextStation), "http://local.invalid");
    if (compareIds.length) next.searchParams.set("compare", compareIds.join(","));
    return next.pathname + next.search;
  };
  const selectedPoint = selectedKey || undefined;
  const freshPct = total > 0 ? Math.round((fresh / total) * 100) : 0;

  return <main className="hy-app">
    <a className="hy-skip" href="#hy-main">ข้ามไปเนื้อหา</a>
    <header className="hy-header"><a className="hy-brand" href="/"><span className="hy-mark" aria-hidden="true">🌊</span><span>สายน้ำเจ้าพระยา<small>ChaoPhraya Flow · ฝนและน้ำ 7 ลุ่มน้ำ</small></span></a><nav aria-label="เมนูหลัก"><a href="/" aria-current={view === "summary" ? "page" : undefined}>💧 สถานการณ์น้ำ</a><a href={exploreHref()} aria-current={view === "explore" ? "page" : undefined}>🗺️ แผนที่และกราฟ</a><a href="/watchlist" aria-current={view === "watchlist" ? "page" : undefined}>⭐ ที่ติดตาม</a><a href="/sources" aria-current={view === "sources" ? "page" : undefined}>📋 แหล่งข้อมูล</a><a href="/fahsai">🌤️ แอปฟ้าใส (อากาศ·ทะเล) ↗</a></nav><ThemeToggle/></header>
    <div className="hy-toolbar" id="hy-main"><div className="hy-mode" role="group" aria-label="รูปแบบการดูข้อมูล"><a aria-current={view === "summary" || view === "basin" ? "page" : undefined} href={link("/", basinId, stationId)}>✨ สรุปทั่วไป (เข้าใจง่าย)</a><a aria-current={view === "explore" || view === "station" ? "page" : undefined} href={exploreHref()}>🔍 ติดตามเชิงลึก</a></div><label>เลือกลุ่มน้ำ<select value={basinId} onChange={event => updateContext(event.target.value)}><option value="all">ทั้งลุ่มเจ้าพระยา (ครบ 7 สายน้ำ)</option>{HYDRO_BASINS.map(basin => <option key={basin.id} value={basin.id}>{basin.name}</option>)}</select></label><button type="button" onClick={() => setRefresh(v => v + 1)} disabled={resource.loading || resource.refreshing}>{resource.refreshing ? "กำลังอัปเดต…" : "🔄 อัปเดตข้อมูลสด"}</button></div>
    <SourceStamp data={resource.data} error={resource.error}/>
    {resource.loading && !resource.data ? <div className="hy-loading" role="status">กำลังอ่านค่าตรวจวัดฝน น้ำ และอ่าง…</div> : !resource.data ? <div className="hy-loading" role="status">ขณะนี้อ่านข้อมูลต้นทางไม่ได้ <button onClick={() => setRefresh(v => v + 1)}>ลองอีกครั้ง</button></div> : <>
      {view === "summary" && <>
        <section className="hy-hero" aria-labelledby="hy-title">
          <div className="hy-hero-copy">
            <div className="hy-stitch-hero-banner">
              <div className="hy-stitch-hero-top">
                <span className="hy-eyebrow">🌊 CHAO PHRAYA FLOW · สายน้ำเจ้าพระยา</span>
                <span className={`hy-stitch-live-pill ${exceeded > 0 ? "is-alert" : high > 0 ? "is-warn" : ""}`}>
                  {exceeded > 0 ? `🚨 ความเสี่ยงตอนนี้ (ณ ${time(resource.data.fetchedAt)}): ล้นตลิ่ง ${exceeded} สถานี` : high > 0 ? `⚠️ ความเสี่ยงตอนนี้ (ณ ${time(resource.data.fetchedAt)}): น้ำมาก ${high} สถานี` : `✅ ความเสี่ยงตอนนี้ (ณ ${time(resource.data.fetchedAt)}): สถานการณ์น้ำปกติ`}
                </span>
              </div>
              <h1 id="hy-title">
                {exceeded > 0
                  ? `วันนี้มีสถานีน้ำแตะ/เกินตลิ่ง ${exceeded} จุด · น้ำมากอีก ${high} จุด`
                  : high > 0
                    ? `วันนี้ระดับน้ำค่อนข้างมาก ${high} สถานี (70–100% ของตลิ่ง)`
                    : `วันนี้สายน้ำเจ้าพระยาและลำน้ำสาขาอยู่ในเกณฑ์ปกติ (${fresh} สถานีล่าสุด)`}
              </h1>
              <p>เช็กระดับน้ำ ฝนตก และน้ำในเขื่อนตั้งแต่ต้นน้ำภาคเหนือ (ปิง·วัง·ยม·น่าน) ไหลรวมสู่เจ้าพระยาถึงปากอ่าวไทย ด้วยภาพอนิเมชันที่เข้าใจง่ายสำหรับทุกคน</p>
              <div className="hy-hero-cta-row">
                <a className="hy-primary is-light" href={link("/explore", basinId, stationId)}>🗺️ เปิดแผนที่และกราฟเทียบระดับน้ำ <span aria-hidden="true">↗</span></a>
                <a className="hy-secondary-cta is-dark" href="#hy-quick-map">👇 สำรวจสถานีริมน้ำด่วน</a>
              </div>
            </div>

            <div className="hy-hero-facts">
              <div>
                <div className="hy-kpi-top"><small>สถานีน้ำล่าสุด</small><span className="hy-dot-badge is-ok" /></div>
                <b>{fresh}<span> / {total}</span></b>
                <div className="hy-mini-progress" aria-hidden="true"><i style={{ width: `${freshPct}%` }} /></div>
                <p>มีค่าใน 60 นาที ({freshPct}%) · เฉพาะสถานีที่ต้นทางส่งมา</p>
              </div>
              <div className={exceeded > 0 ? "is-alert" : ""}>
                <div className="hy-kpi-top"><small>เกินเกณฑ์สถานี</small><span className="hy-dot-badge is-danger" /></div>
                <b>{exceeded}</b>
                <div className="hy-mini-progress is-danger" aria-hidden="true"><i style={{ width: `${assessed > 0 ? Math.min(100, Math.max(exceeded > 0 ? 18 : 0, Math.round((exceeded / assessed) * 100))) : 0}%` }} /></div>
                <p>จาก {assessed} สถานีล่าสุดที่ประเมินได้ · ไม่ใช่จำนวนพื้นที่ท่วม</p>
              </div>
              <div className={high > 0 ? "is-warn" : ""}>
                <div className="hy-kpi-top"><small>น้ำมาก (70–100%)</small><span className="hy-dot-badge is-warn" /></div>
                <b>{high}</b>
                <div className="hy-mini-progress is-warn" aria-hidden="true"><i style={{ width: `${assessed > 0 ? Math.min(100, Math.max(high > 0 ? 18 : 0, Math.round((high / assessed) * 100))) : 0}%` }} /></div>
                <p>ยังไม่เกินเกณฑ์ตลิ่ง · แยกจากรายการด้านซ้าย</p>
              </div>
            </div>

            <nav className="hy-jump-nav" aria-label="ทางลัดไปยังส่วนต่างๆ ในหน้านี้">
              <a href="#hy-qgis-layout">🛰️ แผนที่ดาวเทียม & แจ้งเตือนรายช่วงเวลา</a>
              <a href="#hy-quick-map">📍 แผนที่และสถานี</a>
              <a href="#hy-basins-overview">🌿 รายลุ่มน้ำ ({selectedBasins.length})</a>
              {(basinId === "all" || basinId === "chao-phraya") && <a href="#hy-weather-title">🌧️ เรดาร์และพยากรณ์ฝน</a>}
              {(basinId === "all" || basinId === "chao-phraya") && <a href="#hy-tide-title">🌊 น้ำขึ้น–น้ำลงปากแม่น้ำ</a>}
            </nav>
          </div>
          <HydroBasinFlowDiagram basins={basins} activeBasinId={basinId} onSelectBasin={id => updateContext(id, "")} />
        </section>

        <HydroQgisLayout basins={basins} activeBasinId={basinId} onSelectStation={(bId, sId) => { setBasinId(bId); setStationId(sId); }} />

        {ready && (saved.stations.length > 0 ? (
          <section className="hy-section" aria-labelledby="hy-follow-summary">
            <div className="hy-section-head">
              <div><span className="hy-eyebrow">ค่าที่เปลี่ยนจริง</span><h2 id="hy-follow-summary">สถานีที่คุณติดตาม ({saved.stations.length})</h2></div>
              <p>เรียงสถานีข้อมูลล่าช้าก่อน แล้วค่าที่เพิ่มมากที่สุด · เทียบเฉพาะค่าตรวจวัดจริงที่มีประวัติ</p>
            </div>
            <HydroFollowedStations items={saved.stations} basins={basins} refresh={refresh} compact/>
          </section>
        ) : (
          <div className="hy-follow-onboarding" role="region" aria-label="เริ่มต้นติดตามสถานี">
            <div>
              <strong>★ ยังไม่มีสถานีในรายการติดตามด่วน</strong>
              <span>เลือกติดตามสถานีเพื่อดูอัตราการขึ้น–ลงของระดับน้ำเทียบค่าก่อนหน้าอัตโนมัติ</span>
            </div>
            <div className="hy-follow-onboarding-actions">
              {matches.filter(m => m.station.status === "fresh").length >= 3 && (
                <button type="button" className="hy-outline-button" onClick={() => {
                  const picks = matches.filter(m => m.station.status === "fresh").slice(0, 3).map(m => ({ id: m.station.id, basinId: m.basin.id }));
                  save({ ...saved, stations: picks });
                }}>
                  + ติดตาม 3 สถานีสำคัญอัตโนมัติ ⚡
                </button>
              )}
              <a href="/watchlist">จัดการรายการติดตาม →</a>
            </div>
          </div>
        ))}

        <section className="hy-section hy-quick-explorer" id="hy-quick-map" aria-labelledby="hy-quick-map-title">
          <div className="hy-section-head">
            <div><span className="hy-eyebrow">Interactive Overview Map</span><h2 id="hy-quick-map-title">แผนที่จุดตรวจวัดแนวลำน้ำ & สถานีหลัก</h2></div>
            <p>คลิกจุดบนแผนที่หรือเลือกตัวกรองสถานะเพื่อดูภาพตัดขวางลำน้ำและค่าล่าสุดทันที</p>
          </div>
          <div className="hy-filter-bar" role="group" aria-label="กรองสถานะสถานี">
            {([
              { id: "all", label: `ทั้งหมด (${allStations.length})` },
              { id: "exceeded", label: `เกินเกณฑ์ (${exceeded})` },
              { id: "high", label: `น้ำมาก/เกินเกณฑ์ (${exceeded + high})` },
              { id: "fresh", label: `ข้อมูลล่าสุด (${fresh})` },
            ] as const).map(tab => <button key={tab.id} type="button" aria-pressed={statusFilter === tab.id} onClick={() => setStatusFilter(tab.id)}>{tab.label}</button>)}
          </div>
          <div className="hy-summary-stage">
            <div className="hy-map-panel">
              <RiskAreaMap region="chao-phraya" points={points} selectedId={selectedPoint} focusId={selectedPoint} viewKey={`summary:${basinId}:${statusFilter}`} detailId="hy-summary-inspector" onSelect={point => { const [bId, sId] = point.id.split(":"); setBasinId(bId); setStationId(sId); }} />
            </div>
            <div className="hy-summary-inspector" id="hy-summary-inspector">
              {selected ? <>
                <div className="hy-inspector-top">
                  <div className="hy-detail-title-group">
                    <div className="hy-station-code-badge" aria-hidden="true">
                      <small>สถานีหลัก</small>
                      <strong>{selected.station.id}</strong>
                    </div>
                    <div>
                      <span className="hy-eyebrow">ลุ่มน้ำ{selected.basin.name}</span>
                      <h3>{selected.station.name}</h3>
                      <p>{selected.station.waterway} · {selected.station.province}</p>
                    </div>
                  </div>
                  <b className={`hy-risk hy-risk-${rank(selected.station)}`}>{status(selected.station)}</b>
                </div>
                <div className="hy-stitch-metrics-bento is-compact">
                  <div className="hy-stitch-metric-card">
                    <small>ระดับผิวน้ำปัจจุบัน</small>
                    <StationReading station={selected.station} />
                    <p>ตรวจวัด {time(selected.station.observedAt)}</p>
                  </div>
                  <div className="hy-stitch-metric-card">
                    <small>ความจุลำน้ำ & ตลิ่ง</small>
                    <div className="hy-reading">
                      <strong>{selected.station.status === "fresh" && selected.station.capacityPercent !== null ? `${nf.format(selected.station.capacityPercent)}%` : "—"}</strong>
                      <span>ความจุ</span>
                    </div>
                    <p>{selected.station.bank !== null && selected.station.datum === "msl" ? `ตลิ่ง ${formatWaterValue(selected.station.bank)} ม. รทก.` : selected.station.agency}</p>
                  </div>
                </div>
                <StationChannelVisual station={selected.station} />
                <div className="hy-inspector-actions">
                  <a className="hy-primary is-sm" href={link(`/stations/${encodeURIComponent(selected.station.id)}`, selected.basin.id)}>ดูกราฟย้อนหลังและรายละเอียด →</a>
                  <button type="button" className="hy-outline-button" aria-pressed={saved.stations.some(s => s.id === selected.station.id && s.basinId === selected.basin.id)} onClick={() => toggleStation(selected.station, selected.basin)}>
                    {saved.stations.some(s => s.id === selected.station.id && s.basinId === selected.basin.id) ? "★ ติดตามแล้ว" : "☆ ติดตาม"}
                  </button>
                </div>
                <div className="hy-quick-station-strip">
                  <small>ทำเนียบสถานีสำคัญในขอบเขตที่เลือก ({matches.length} แห่ง)</small>
                  <div>
                    {matches.slice(0, 6).map(({ basin, station }) => <button key={`${basin.id}:${station.id}`} type="button" aria-pressed={selectedPoint === `${basin.id}:${station.id}`} onClick={() => { setBasinId(basin.id); setStationId(station.id); }}>
                      <span className={`hy-status-dot hy-rank-${rank(station)}`} />
                      <strong>{station.name}</strong>
                      <b>{formatWaterValue(station.value)}</b>
                    </button>)}
                  </div>
                </div>
              </> : <div className="hy-empty">ไม่พบสถานีตามตัวกรองที่เลือก ลองสลับตัวกรองเป็น “ทั้งหมด”</div>}
            </div>
          </div>
        </section>

        <section className="hy-section" id="hy-basins-overview"><div className="hy-section-head"><div><span className="hy-eyebrow">01 / ภาพรวม</span><h2>แต่ละลุ่มน้ำมีข้อมูลอะไร</h2></div><p>จำนวนเป็นสถานีตรวจวัด ไม่ใช่การครอบคลุมทั้งลุ่มน้ำ</p></div><div className="hy-basin-grid">{selectedBasins.map(basin => {
          const bFreshPct = basin.water.length ? Math.round((basin.freshWater / basin.water.length) * 100) : 0;
          const isCurrentFilter = basinId === basin.id;
          return <article className={`hy-basin-card ${basin.exceededWater > 0 ? "has-exceeded" : basin.highWater > 0 ? "has-high" : ""}`} key={basin.id}><div className="hy-basin-top"><span className="hy-basin-number">{basin.id === "chao-phraya" ? "10" : basin.id}</span><span>{basin.freshWater}/{basin.water.length} สถานีน้ำล่าสุด</span></div><h3><a href={`/basins/${encodeURIComponent(basin.id)}`}>{basin.name} <span aria-hidden="true">↗</span></a></h3><p>{basin.connection}</p><div className="hy-mini-progress" aria-hidden="true"><i style={{ width: `${bFreshPct}%` }} /></div><div className="hy-basin-metrics"><div><small>เกินเกณฑ์ / น้ำมาก</small><b>{basin.exceededWater} / {basin.highWater}</b></div><div><small>ฝนสะสม 24 ชม. สูงสุดในสถานีที่มีข้อมูล</small><b>{basin.peakRain ? `${nf.format(basin.peakRain.mm)} มม.` : "ยังไม่มีข้อมูล"}</b></div></div><small className="hy-card-note">{basin.peakRain ? `${basin.peakRain.name} · ${time(basin.peakRain.observedAt)}` : basin.rainSourceAvailable ? "ไม่มีค่าฝนภายใน 3 ชั่วโมง" : "ต้นทางฝนไม่พร้อมหรือยังไม่มีสถานีที่ใช้ได้"}</small><div className="hy-basin-card-actions"><button type="button" className="hy-outline-button" aria-pressed={isCurrentFilter} onClick={() => updateContext(isCurrentFilter ? "all" : basin.id, "")}>{isCurrentFilter ? "✓ กำลังกรองลุ่มน้ำนี้ (ดูทั้งหมด)" : "กรองแผนที่หน้านี้"}</button><a className="hy-inline-link" href={`/basins/${encodeURIComponent(basin.id)}`}>เปิดหน้ารายลุ่มน้ำ →</a></div></article>;
        })}</div></section>
        {(basinId === "all" || basinId === "chao-phraya") && <HydroWeatherContext detailed={false} refresh={refresh}/>}
        {(basinId === "all" || basinId === "chao-phraya") && <HydroTideContext refresh={refresh}/>}
        <section className="hy-context-strip"><div><span className="hy-eyebrow">อ่านให้ตรงความหมาย</span><h2>ค่าระดับน้ำ ≠ ความลึกน้ำท่วม</h2><p>คำว่าเกินเกณฑ์อ้างอิงเกณฑ์ของสถานีต้นทางและต้องอ่านเวลา เรดาร์และพยากรณ์ด้านบนเป็นหลักฐานคนละชนิดกับฝนที่สถานีวัดได้</p></div><a href="/sources">อ่านข้อจำกัดข้อมูล →</a></section>
      </>}
      {view === "basin" && <><section className="hy-page-title"><span className="hy-eyebrow">ลุ่มน้ำ / {basinId}</span><h1>{basinName(basinId)}</h1><p>{selectedBasins[0]?.connection} · ติดตามเฉพาะสถานีที่มีข้อมูลจากต้นทาง</p></section>{selectedBasins[0] && <div className="hy-basin-facts"><div><small>สถานีน้ำล่าสุด</small><b>{selectedBasins[0].freshWater}/{selectedBasins[0].water.length}</b></div><div><small>เกินเกณฑ์สถานี</small><b>{selectedBasins[0].exceededWater}</b></div><div><small>ฝน 24 ชม. สูงสุดที่สถานี</small><b>{selectedBasins[0].peakRain ? `${nf.format(selectedBasins[0].peakRain.mm)} มม.` : "ไม่มีข้อมูลล่าสุด"}</b></div><div><small>อ่างรายวัน</small><b>{selectedBasins[0].dams.length} แห่ง</b></div></div>}<button className="hy-outline-button" aria-pressed={saved.basins.includes(basinId)} onClick={() => toggleBasin(basinId)}>{saved.basins.includes(basinId) ? "เลิกติดตามลุ่มน้ำ" : "ติดตามลุ่มน้ำนี้"}</button><a className="hy-inline-link" href={link("/explore", basinId)}>เปิดแผนที่และสถานี →</a></>}
      {(view === "explore" || view === "basin" || view === "station") && <section className="hy-workspace" aria-label="สำรวจสถานี"><div className="hy-workspace-head"><div><span className="hy-eyebrow">{view === "explore" ? "02 / ติดตามเชิงลึก" : "สถานีตรวจวัด"}</span><h2>{view === "station" ? "รายละเอียดสถานี" : "แผนที่ ผังการไหล และทำเนียบสถานี"}</h2></div><div className="hy-stage-mode-switch" role="group" aria-label="สลับมุมมองแผนที่และผังการไหล"><button type="button" aria-pressed={exploreStageMode === "geo"} onClick={() => setExploreStageMode("geo")}>🗺️ แผนที่ภูมิศาสตร์ (Geo Map)</button><button type="button" aria-pressed={exploreStageMode === "schematic"} onClick={() => setExploreStageMode("schematic")}>🌿 ผังการไหล 7 ลุ่มน้ำ (Schematic)</button></div></div><div className="hy-workspace-grid"><div className="hy-list-panel"><label>ค้นชื่อ รหัส หรือทางน้ำ<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="เช่น ปากน้ำโพ, C.2, C.29A หรือชื่อลำน้ำ"/></label><div className="hy-list-filters" role="group" aria-label="กรองสถานะในรายการ">{([
        { id: "all", label: "ทั้งหมด" },
        { id: "exceeded", label: `เกินเกณฑ์ (${exceeded})` },
        { id: "high", label: `น้ำมาก (${high})` },
        { id: "fresh", label: `ล่าสุด (${fresh})` },
      ] as const).map(f => <button key={f.id} type="button" aria-pressed={statusFilter === f.id} onClick={() => setStatusFilter(f.id)}>{f.label}</button>)}</div><div className="hy-list-count">{matches.length} สถานีที่ตรงเงื่อนไข · ล่าสุด {matches.filter(item => item.station.status === "fresh").length}</div><div className="hy-station-list">{matches.map(({ basin, station }) => <button key={`${basin.id}:${station.id}`} type="button" aria-pressed={selectedPoint === `${basin.id}:${station.id}`} onClick={() => updateContext(basin.id, station.id)}><span className={`hy-station-id-pill hy-rank-${rank(station)}`}>{station.id}</span><span className="hy-station-label"><strong>{station.name}</strong><small>{basin.name} · {station.waterway}{station.bank !== null && station.datum === "msl" ? ` (ตลิ่ง ${formatWaterValue(station.bank)})` : ""} · {status(station)}</small></span><span className="hy-station-value">{formatWaterValue(station.value)}<small>{station.datum === "msl" ? "ม. รทก." : "ม. เกจ"}</small></span></button>)}{matches.length === 0 && <p className="hy-empty">ไม่พบสถานีตามคำค้นหรือพื้นที่ที่เลือก ลองเปลี่ยนลุ่มน้ำหรือตัวกรอง</p>}</div></div><div className="hy-map-panel">{exploreStageMode === "geo" ? <><RiskAreaMap region="chao-phraya" points={points} selectedId={selectedPoint} focusId={selectedPoint} viewKey={`${basinId}:${query}:${statusFilter}`} detailId="station-detail" onSelect={point => { const [basin, id] = point.id.split(":"); updateContext(basin, id); }}/><p>จุดสีแสดงสถานะเฉพาะสถานี · สีไม่ได้ระบายขอบเขตน้ำท่วม · หากแผนที่โหลดไม่ได้ ใช้รายการด้านซ้ายได้</p></> : <div className="hy-explore-schematic-wrap"><HydroBasinFlowDiagram basins={basins} activeBasinId={basinId} onSelectBasin={id => updateContext(id, "")}/></div>}</div>{selected ? <StationDetail station={selected.station} basin={selected.basin} saved={saved.stations.some(item => item.id === selected.station.id && item.basinId === selected.basin.id)} watchlistFull={saved.stations.length >= 20} onToggle={() => toggleStation(selected.station, selected.basin)} compared={compareIds.includes(selected.station.id)} compareFull={compareIds.length >= 4} onCompare={view === "explore" ? () => toggleCompare(selected.station.id) : undefined} refresh={refresh}/> : <div className="hy-selection-empty">{view === "station" && stationId ? "ไม่พบรหัสสถานีนี้ในข้อมูลล่าสุด เลือกสถานีอื่นจากรายการได้" : "เลือกสถานีจากรายการหรือแผนที่ เพื่ออ่านค่าและกราฟย้อนหลัง"}</div>}</div></section>}
      {view === "explore" && <HydroComparison stations={comparedStations} refresh={refresh} onRemove={toggleCompare} candidates={matches.filter(m => m.station.status === "fresh").slice(0, 4).map(m => ({ id: m.station.id, name: m.station.name, basinName: m.basin.name }))} onQuickAdd={setQuickCompare}/>}
      {(view === "explore" || view === "basin") && <BasinSignals basins={selectedBasins}/>}
      {(view === "explore" || view === "basin") && (basinId === "all" || basinId === "chao-phraya") && <HydroWeatherContext detailed={view === "explore"} refresh={refresh}/>}
      {(view === "explore" || view === "basin") && (basinId === "all" || basinId === "chao-phraya") && <HydroTideContext refresh={refresh}/>}
      {(view === "explore" || view === "basin") && basinId !== "all" && basinId !== "chao-phraya" && <section className="hy-section hy-weather-gap"><h2>พยากรณ์ลุ่มต้นน้ำยังไม่พร้อม</h2><p>ส่วนพยากรณ์ในแอปยังครอบคลุมเฉพาะจังหวัดตอนกลาง–ล่าง จึงไม่ใช้ค่าจังหวัดอื่นแทนลุ่มน้ำ{basinName(basinId)} ข้อมูลฝนที่แสดงด้านบนเป็นค่าตรวจวัดตามสถานี</p><a href="https://radargis.tmd.go.th/" target="_blank" rel="noreferrer">ตรวจภาพเรดาร์ต้นทาง ↗</a></section>}
      {view === "watchlist" && <section className="hy-section"><div className="hy-page-title"><span className="hy-eyebrow">บันทึกในเครื่องนี้</span><h1>สถานีที่ติดตาม</h1><p>รายการเก็บในเบราว์เซอร์เครื่องนี้ ไม่ใช้บัญชีและไม่ซิงก์ข้ามอุปกรณ์</p></div>{saved.basins.length > 0 && <><h2>ลุ่มน้ำ</h2><div className="hy-watch-grid">{saved.basins.map(id => <a key={id} href={`/basins/${encodeURIComponent(id)}`}>{basinName(id)} ↗</a>)}</div></>}{saved.stations.length > 0 && <><h2>สถานี</h2><p className="hy-watch-explainer">ข้อมูลล่าช้าหรือหายจาก feed ขึ้นก่อน จากนั้นเรียงสถานีที่ระดับน้ำเพิ่มมากสุดเมื่อมีค่าก่อนหน้าที่เทียบได้</p><HydroFollowedStations items={saved.stations} basins={basins} refresh={refresh}/></>}{ready && !saved.basins.length && !saved.stations.length && <div className="hy-empty">ยังไม่มีรายการที่ติดตาม เปิดลุ่มน้ำหรือสถานีแล้วกด “ติดตาม”</div>}{(saved.basins.length > 0 || saved.stations.length > 0) && <button className="hy-outline-button" onClick={() => save(EMPTY_SAVED)}>ล้างรายการที่ติดตามในเครื่องนี้</button>}</section>}
      {view === "sources" && <section className="hy-section"><div className="hy-page-title"><span className="hy-eyebrow">ความโปร่งใสของข้อมูล</span><h1>แหล่งข้อมูลและข้อจำกัด</h1><p>ค่าที่แสดงเป็นข้อมูลสถานีและรายงานต้นทาง ไม่ใช่ประกาศเตือนภัยหรือแผนที่พื้นที่ท่วมที่ยืนยันแล้ว</p></div><div className="hy-source-grid"><article><h2>ระดับน้ำ</h2><p>ThaiWater / คลังข้อมูลน้ำแห่งชาติ · ค่ารายสถานี มีเวลาเก็บจริง เกณฑ์ความจุหรือตลิ่งเมื่อมีข้อมูล และ datum ที่ต้นทางระบุ</p><b>{sourceLabel(resource.data, "water")} · {fresh}/{total} สถานีภายใน 60 นาที</b><a href="https://www.thaiwater.net/water" target="_blank" rel="noreferrer">ตรวจต้นทาง ↗</a></article><article><h2>ฝนตรวจวัด</h2><p>ThaiWater / ฝนสะสม 24 ชั่วโมง ณ สถานีในลุ่มเจ้าพระยาและหกลุ่มต้นน้ำ ไม่ใช่ฝนเฉลี่ยทั้งลุ่ม ไม่รวมพยากรณ์</p><b>{sourceLabel(resource.data, "rain")}</b><a href="/rain">เรดาร์และพยากรณ์แยก →</a></article><article><h2>อ่างเก็บน้ำ</h2><p>ThaiWater / ข้อมูลรายวัน วันที่รายงานและหน่วยปริมาตรแสดงตามต้นทาง ข้อมูลรายวันไม่ใช่ live flow</p><b>{sourceLabel(resource.data, "dams")}</b><a href="https://www.thaiwater.net/water" target="_blank" rel="noreferrer">ตรวจต้นทาง ↗</a></article><article><h2>ประวัติระดับน้ำ</h2><p>ค่าที่ระบบสะสมจริงจากการเก็บตามรอบ สูงสุด 90 วัน ช่วงที่ไม่มีการเก็บจะไม่สร้างค่าขึ้นแทน</p><b>{resource.data.historyStorage === "unavailable" ? "คลังประวัติไม่พร้อม" : `คลังประวัติ: ${resource.data.historyStorage === "d1" ? "ถาวร" : "ในเครื่องเซิร์ฟเวอร์"}`}</b></article></div><IngestionHealth refresh={refresh}/><h2>ความครอบคลุมตามลุ่มน้ำ</h2><div className="hy-coverage-table"><table><thead><tr><th>ลุ่มน้ำ</th><th>สถานีน้ำล่าสุด/ทั้งหมด</th><th>ฝนสถานีล่าสุด</th><th>อ่างรายวัน</th></tr></thead><tbody>{basins.map(basin => <tr key={basin.id}><th scope="row">{basin.name}</th><td>{basin.freshWater}/{basin.water.length}</td><td>{coverageCount(basin, "rain", resource.data)}</td><td>{coverageCount(basin, "dams", resource.data)}</td></tr>)}</tbody></table></div><p className="hy-evidence">การไม่มีสถานีหรือค่าในตาราง ไม่ได้แปลว่าพื้นที่ปลอดภัยหรือไม่มีฝน/น้ำท่วม โปรดติดตามประกาศของหน่วยงานในพื้นที่เมื่อมีเหตุการณ์จริง</p></section>}
    </>}
    {view === "sources" && <section className="hy-section" aria-labelledby="hy-context-sources-title"><div className="hy-section-head"><div><span className="hy-eyebrow">ข้อมูลประกอบในหน้าใหม่</span><h2 id="hy-context-sources-title">ขอบเขตเรดาร์ พยากรณ์ และน้ำทำนาย</h2></div><p>ตรวจเวลาที่ใช้ได้บนหน้าสถานการณ์ทุกครั้ง</p></div><div className="hy-source-grid"><article><h2>ภาพเรดาร์</h2><p>กรมอุตุนิยมวิทยา TMD RadarGIS · ภาพตรวจจริงประมาณอัตราฝน มม./ชม. แสดงเมื่ออายุไม่เกิน 90 นาที ภาพคาดการณ์ระยะสั้นใช้เมื่อฐานภาพไม่เกิน 30 นาทีและเวลาภาพยังมาไม่ถึง</p><a href="https://radargis.tmd.go.th/" target="_blank" rel="noreferrer">ตรวจภาพต้นทาง ↗</a></article><article><h2>พยากรณ์ฝน</h2><p>แบบจำลองผ่าน API ของแอป · จังหวัดตอนกลาง–ล่างที่มีขอบเขตและจุดตัวอย่างเท่านั้น แสดงรายชั่วโมง ช่วง 3 ชั่วโมง และ 24 ชั่วโมง พร้อมเวลา “ดึงพยากรณ์” ซึ่งไม่ใช่เวลาออกพยากรณ์จากผู้ผลิต ลุ่มต้นน้ำยังไม่มีพยากรณ์รายลุ่มที่ตรวจรับได้</p><a href="/rain">ดูรายละเอียดพยากรณ์ →</a></article><article><h2>น้ำขึ้นน้ำลงทำนาย</h2><p>ตารางกรมอุทกศาสตร์ กองทัพเรือ · เฉพาะสถานีปลายน้ำที่เลือก เป็นระดับน้ำทำนายรายชั่วโมงเหนือระดับทะเลปานกลาง ไม่ใช้แทนระดับน้ำตรวจวัดหรือสรุปผลกระทบถึงสถานีต้นน้ำ</p><a href="https://hydro.navy.mi.th/waterlaveltable" target="_blank" rel="noreferrer">ตรวจตารางกรมอุทกศาสตร์ ↗</a></article></div></section>}
    <nav className="hy-bottom-nav" aria-label="แถบทางลัดด้านล่าง">
      <a href="/" className={view === "summary" ? "is-active" : ""}><span>💧</span><small>ภาพรวม</small></a>
      <a href={exploreHref()} className={view === "explore" || view === "station" ? "is-active" : ""}><span>📍</span><small>แผนที่ & สถานี</small></a>
      <a href={view === "summary" || view === "explore" ? "#hy-weather-title" : "/explore#hy-weather-title"}><span>🌧️</span><small>เรดาร์ & ฝน</small></a>
      <a href={view === "summary" || view === "explore" ? "#hy-tide-title" : "/explore#hy-tide-title"}><span>🌊</span><small>น้ำขึ้นน้ำลง</small></a>
    </nav>
    <footer className="hy-footer"><div><strong>สายน้ำเจ้าพระยา · ChaoPhraya Flow</strong><p>แอปติดตามเส้นทางน้ำ 7 ลุ่มน้ำ ฝน และเขื่อนสำหรับทุกคน · อ่านหลักฐานให้ตรงพื้นที่และเวลา</p></div><div><a href="/sources">ที่มาและข้อจำกัด</a><a href="/explore">แผนที่และกราฟเชิงลึก</a><a href="/watchlist">สถานีที่ติดตาม</a><a href="/fahsai">🌤️ แอปฟ้าใส (อากาศ·ฝุ่น·ร้อน·ลมหนาว·น้ำทะเล) ↗</a></div></footer>
  </main>;
}
