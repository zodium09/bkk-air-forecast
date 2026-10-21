"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useLiveResource } from "../intelligence/use-live-resource";
import { currentRadar } from "../../lib/rain-nearby";
import { provinces } from "../../lib/provinces";
import { bangkokDateKey } from "../../lib/forecast/timestamps";
import { thaiObservationTime } from "../../lib/observation-time";
import type { TmdRadarPayload, TmdRadarMode } from "../../lib/tmd-radar-data";
import type { RainForecastPayload } from "../../lib/rain-forecast-data";
import type { RadarImageState } from "../intelligence/rain-radar-map";
import { forecastWindowState, nextForecastHours } from "../../lib/hydro/weather-context";

const RadarMap = dynamic(() => import("../intelligence/rain-radar-map"), { ssr: false, loading: () => <p className="hy-weather-map-loading">กำลังเตรียมแผนที่เรดาร์…</p> });
const number = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 });

export default function HydroWeatherContext({ detailed, refresh }: { detailed: boolean; refresh: number }) {
  const [provinceId, setProvinceId] = useState("nakhon-sawan");
  const [dayIndex, setDayIndex] = useState(0);
  const [selectedWin, setSelectedWin] = useState<number | null>(null);
  const [mode, setMode] = useState<TmdRadarMode>("observed");
  const [frameId, setFrameId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [opacity, setOpacity] = useState(0.82);
  const [showSummaryRadarMap, setShowSummaryRadarMap] = useState(false);
  const [imageState, setImageState] = useState<RadarImageState | null>(null);
  const forecast = useLiveResource<RainForecastPayload>(`/api/rain-forecast?province=${encodeURIComponent(provinceId)}`, refresh, 30 * 60_000);
  const catalog = useLiveResource<TmdRadarPayload>("/api/tmd-radar", refresh, 5 * 60_000);
  const radar = currentRadar(catalog.data, catalog.clock);
  const frames = useMemo(() => (mode === "observed" ? radar?.observedFrames ?? [] : radar?.nowcastFrames ?? []), [mode, radar]);
  const activeFrame = frames.find(frame => frame.id === frameId) ?? (mode === "observed" ? frames.at(-1) : frames[0]) ?? null;
  const activeIndex = activeFrame ? frames.findIndex(frame => frame.id === activeFrame.id) : -1;

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const timer = window.setInterval(() => {
      setFrameId(prev => {
        const idx = frames.findIndex(f => f.id === prev);
        const cur = idx >= 0 ? idx : (mode === "observed" ? frames.length - 1 : 0);
        return frames[(cur + 1) % frames.length]?.id ?? null;
      });
    }, 900);
    return () => window.clearInterval(timer);
  }, [playing, frames, mode]);

  const forecastDate = forecast.data?.days[0]?.dateKey;
  const forecastAgeMinutes = forecast.data ? (forecast.clock - Date.parse(forecast.data.fetchedAt)) / 60_000 : NaN;
  const forecastReady = forecast.data?.status !== "unavailable" && forecastDate === bangkokDateKey(forecast.clock) && Number.isFinite(forecastAgeMinutes) && forecastAgeMinutes >= -5 && forecastAgeMinutes <= 180;
  const day = forecastReady ? forecast.data?.days[dayIndex] : null;
  const windows = forecastReady ? forecast.data?.windows.filter(window => window.dayIndex === dayIndex) ?? [] : [];
  const hours = forecastReady && detailed ? nextForecastHours(forecast.data!.points, forecast.clock) : [];
  const scope = provinces.find(province => province.id === provinceId);
  const mapVisible = detailed || showSummaryRadarMap;
  const imageFailed = mapVisible && activeFrame && imageState?.id === activeFrame.id && imageState.status === "error";
  const maxWinRain = Math.max(5, ...windows.map(w => w.rainMeanMm ?? 0));
  const maxDayRain = Math.max(10, ...(forecastReady ? forecast.data!.days.slice(0, detailed ? 7 : 5).map(d => d.rainMeanMm ?? 0) : [10]));
  const activeWindow = windows.find(w => w.windowIndex === selectedWin) ?? windows.find(w => forecastWindowState(day?.dateKey ?? "", w.start, w.end, forecast.clock) === "current") ?? windows[0] ?? null;

  return <section className="hy-section hy-weather" aria-labelledby="hy-weather-title">
    <div className="hy-section-head"><div><span className="hy-eyebrow">คนละหลักฐาน · คนละเวลา</span><h2 id="hy-weather-title">เรดาร์และพยากรณ์ฝน</h2></div><p>ประกอบการติดตามสถานีฝน ไม่ใช่ค่าฝนที่ตกแล้วทั้งลุ่มน้ำ</p></div>
    <div className="hy-weather-grid">
      <article className="hy-weather-card"><div className="hy-weather-card-head"><span className="hy-weather-tag">เรดาร์ · {mode === "observed" ? "ตรวจจริง" : "คาดการณ์ระยะสั้น"}</span><a href="/rain#rain-radar">เปิดเครื่องมือเรดาร์ →</a></div>
        <h3>ภาพฝนจากกรมอุตุนิยมวิทยา</h3>
        <p>ภาพเรดาร์ประมาณอัตราฝนเป็น มม./ชม. ไม่ใช่ฝนสะสม 24 ชม. ของสถานี</p>
        <div className="hy-weather-switch" role="group" aria-label="ชนิดภาพเรดาร์">
          <button type="button" aria-pressed={mode === "observed"} onClick={() => { setMode("observed"); setFrameId(null); setPlaying(false); }}>ภาพตรวจจริง</button>
          <button type="button" aria-pressed={mode === "nowcast"} onClick={() => { setMode("nowcast"); setFrameId(null); setPlaying(false); }}>คาดการณ์ระยะสั้น</button>
          {!detailed && <button type="button" className="hy-radar-map-toggle" aria-pressed={showSummaryRadarMap} onClick={() => setShowSummaryRadarMap(v => !v)}>{showSummaryRadarMap ? "ซ่อนแผนที่เรดาร์" : "ดูแผนที่เรดาร์"}</button>}
        </div>
        {catalog.loading && !catalog.data ? <p className="hy-weather-empty">กำลังอ่านเรดาร์…</p> : !radar || !frames.length ? <p className="hy-weather-empty">{mode === "nowcast" && radar ? "ยังไม่มีภาพคาดการณ์ระยะสั้นที่ไม่หมดเวลา" : "ภาพเรดาร์ล่าสุดไม่พร้อม"} ไม่ใช้ภาพเก่ามาสรุปฝนปัจจุบัน</p> : <>
          <div className="hy-weather-reading">
            <div>
              <strong>{activeFrame ? thaiObservationTime(activeFrame.validAt) : "—"}</strong>
              <span>{mode === "observed" ? "เวลาภาพตรวจจริง" : `เวลาที่คาดการณ์ · +${activeFrame?.leadMinutes ?? 0} นาทีจากภาพฐาน`}</span>
            </div>
            {frames.length > 1 && <div className="hy-radar-playback" role="group" aria-label="ควบคุมการเล่นภาพเรดาร์">
              <button type="button" onClick={() => { setPlaying(false); setFrameId(frames[(activeIndex - 1 + frames.length) % frames.length].id); }} aria-label="ภาพก่อนหน้า">◀</button>
              <button type="button" className="is-play" aria-pressed={playing} onClick={() => setPlaying(v => !v)}>{playing ? "⏸ หยุด" : "▶ เล่นภาพ"}</button>
              <button type="button" onClick={() => { setPlaying(false); setFrameId(frames[(activeIndex + 1) % frames.length].id); }} aria-label="ภาพถัดไป">▶</button>
            </div>}
          </div>
          {frames.length > 1 && <div className="hy-radar-controls-row">
            <label className="hy-weather-range">เลือกภาพ {activeIndex + 1} / {frames.length}<input type="range" min="0" max={frames.length - 1} value={activeIndex} onChange={event => { setPlaying(false); setFrameId(frames[Number(event.target.value)].id); }}/></label>
            {mapVisible && <label className="hy-weather-range is-opacity">ความเข้ม {Math.round(opacity * 100)}%<input type="range" min="0.25" max="1" step="0.05" value={opacity} onChange={event => setOpacity(Number(event.target.value))}/></label>}
          </div>}
          {mapVisible && <div className="hy-weather-map"><RadarMap region="chao-phraya" position={null} frame={activeFrame} opacity={opacity} onSelect={() => {}} onImageState={setImageState} interactive={false}/></div>}
          {imageFailed && <p role="status" className="hy-weather-empty">โหลดภาพเรดาร์ไม่สำเร็จ ตรวจภาพที่ต้นทางได้</p>}
        </>}
        <p className="hy-weather-provenance">ภาพฐาน {radar?.observedAt ? thaiObservationTime(radar.observedAt) : "ยังไม่มี"} · ดึงข้อมูล {catalog.data ? thaiObservationTime(catalog.data.fetchedAt) : "ยังไม่สำเร็จ"} · {catalog.error || "TMD RadarGIS"}</p><a className="hy-weather-source" href="https://radargis.tmd.go.th/" target="_blank" rel="noreferrer">ตรวจภาพต้นทาง ↗</a>
      </article>
      <article className="hy-weather-card"><div className="hy-weather-card-head"><span className="hy-weather-tag is-forecast">แบบจำลอง · พยากรณ์</span><a href="/rain">เปิดพยากรณ์เต็มหน้า →</a></div>
        <h3>ฝนข้างหน้าในจังหวัดที่เลือก</h3><p>ค่าจากจุดตัวอย่างในจังหวัดที่ครอบคลุมส่วนลุ่มเจ้าพระยาตอนกลาง–ล่าง ไม่ใช่พยากรณ์รวมทั้ง 7 ลุ่มน้ำ</p>
        <label className="hy-weather-select">พื้นที่พยากรณ์<select value={provinceId} onChange={event => { setProvinceId(event.target.value); setDayIndex(0); setSelectedWin(null); }}>{provinces.map(province => <option key={province.id} value={province.id}>{province.nameTh}{province.scopeNote ? " · ส่วนในลุ่มน้ำ" : ""}</option>)}</select></label>
        {forecast.loading && !forecast.data ? <p className="hy-weather-empty">กำลังอ่านพยากรณ์…</p> : !forecastReady || !day ? <p className="hy-weather-empty">พยากรณ์สำหรับ {scope?.nameTh} ยังไม่พร้อมหรือเลยวันที่ออกข้อมูลแล้ว · ไม่เติมค่าจากการตรวจวัด</p> : <>
          <div className="hy-weather-days is-bar-strip" role="group" aria-label="เลือกวันพยากรณ์">{forecast.data!.days.slice(0, detailed ? 7 : 5).map((item, index) => {
            const pct = item.rainMeanMm === null ? 0 : Math.min(100, Math.round((item.rainMeanMm / maxDayRain) * 100));
            return <button key={item.dateKey} type="button" aria-pressed={dayIndex === index} onClick={() => { setDayIndex(index); setSelectedWin(null); }}>
              <span className="hy-day-bar-wrap" aria-hidden="true"><i style={{ height: `${Math.max(item.rainMeanMm && item.rainMeanMm > 0 ? 12 : 3, pct)}%` }}/></span>
              <strong>{item.rainMeanMm === null ? "—" : `${number.format(item.rainMeanMm)}`} <small>มม.</small></strong>
              <span>{item.weekday} {item.date}</span>
            </button>;
          })}</div>
          <div className="hy-weather-reading">
            <div>
              <strong>{day.rainMeanMm === null ? "—" : number.format(day.rainMeanMm)} <small>มม.</small></strong>
              <span>ฝนสะสมพยากรณ์ 00:00–24:00 วันที่ {day.date} · เฉลี่ยจุดตัวอย่างที่มีข้อมูล{day.dateKey === bangkokDateKey(forecast.clock) ? " · รวมช่วงที่ผ่านไปแล้ว" : ""}</span>
            </div>
            {activeWindow && <div className="hy-win-highlight">
              <small>ช่วง {activeWindow.start}–{activeWindow.end === "00:00" ? "24:00" : activeWindow.end} น.</small>
              <b>{activeWindow.rainMeanMm === null ? "—" : `${number.format(activeWindow.rainMeanMm)} มม.`}</b>
            </div>}
          </div>
          {windows.length > 0 && <div className="hy-weather-windows">
            <h4>กราฟพยากรณ์ช่วงละ 3 ชั่วโมงของวันที่เลือก (คลิกแท่งเพื่อดูค่า)</h4>
            <div className="hy-win-bars" role="group" aria-label="เลือกช่วงเวลา 3 ชั่วโมง">{windows.map(window => {
              const timing = forecastWindowState(day.dateKey, window.start, window.end, forecast.clock);
              const barPct = window.rainMeanMm === null ? 0 : Math.min(100, Math.round((window.rainMeanMm / maxWinRain) * 100));
              const isSelected = activeWindow?.windowIndex === window.windowIndex;
              return <button type="button" key={window.windowIndex} aria-pressed={isSelected} className={`${timing === "elapsed" ? "is-elapsed" : timing === "current" ? "is-current" : ""}`} onClick={() => setSelectedWin(window.windowIndex)}>
                <span className="hy-win-bar-track" aria-hidden="true"><i style={{ height: `${Math.max(window.rainMeanMm && window.rainMeanMm > 0 ? 14 : 4, barPct)}%` }}/></span>
                <b>{window.rainMeanMm === null ? "—" : `${number.format(window.rainMeanMm)}`}</b>
                <span>{window.start}–{window.end === "00:00" ? "24:00" : window.end}</span>
                <small>{timing === "elapsed" ? "ผ่านแล้ว" : timing === "current" ? "ตอนนี้" : "ข้างหน้า"}</small>
              </button>;
            })}</div>
            <p>ค่าแต่ละช่วงเป็นปริมาณสะสมจากแบบจำลอง เฉลี่ยจุดตัวอย่าง ไม่ใช่ฝนตรวจวัด</p>
          </div>}
          {detailed && <div className="hy-weather-windows"><h4>พยากรณ์รายชั่วโมงถัดจากขณะนี้</h4><div>{hours.map(hour => <div key={hour.key}><span>{hour.key.slice(8, 10)}/{hour.key.slice(5, 7)} · {hour.key.slice(11, 16)}</span><b>{hour.rainMm === null ? "—" : `${number.format(hour.rainMm)} มม.`}</b><small>{hour.samples ? `${hour.samples} จุดตัวอย่าง` : "ไม่มีค่าที่ใช้ได้"}</small></div>)}</div><p>เฉพาะชั่วโมงเต็มที่ยังมาไม่ถึง · 0 มม. เป็นค่าพยากรณ์ศูนย์ ไม่ใช่ข้อมูลขาด</p></div>}
        </>}
        <p className="hy-weather-provenance">{forecastReady ? `${forecast.error ? "ใช้ข้อมูลรอบก่อน · " : ""}${forecast.data!.province.nameTh} · ดึงพยากรณ์ ${thaiObservationTime(forecast.data!.fetchedAt)} · ${forecast.data!.dataQuality.acceptedPoints}/${forecast.data!.dataQuality.expectedPoints} จุดตัวอย่าง` : "ขอบเขตพยากรณ์: จังหวัดที่เลือก"}{forecast.error && ` · ${forecast.error}`}</p><p className="hy-weather-provenance">{forecastReady ? `แหล่งข้อมูลที่ใช้: ${forecast.data!.sources.slice(0, 2).join(" / ")} · ค่าพยากรณ์อาจเปลี่ยนเมื่อแบบจำลองอัปเดต` : "ยังไม่ยืนยันแหล่งพยากรณ์ที่ใช้ได้สำหรับพื้นที่นี้"}</p>
      </article>
    </div>
  </section>;
}
