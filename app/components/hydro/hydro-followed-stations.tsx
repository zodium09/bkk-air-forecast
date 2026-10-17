"use client";

import { useEffect, useMemo, useState } from "react";
import { hydroStation, type HydroBasin } from "../../lib/hydro/model";
import { watchedWaterChange } from "../../lib/hydro/watched-change";
import type { WaterHistoryPayload } from "../../lib/water-history-store";
import { formatWaterValue, waterRisk, type WaterStation } from "../../lib/water-levels";
import { thaiObservationTime } from "../../lib/observation-time";

export type FollowedStationId = { id: string; basinId: string };
const MAX_TRENDS = 20;
const keyOf = (item: FollowedStationId) => `${item.basinId}:${item.id}`;
const trendText = (changeCm: number, minutes: number) => `${Math.abs(changeCm) < 0.05 ? "ระดับใกล้เคียงเดิม" : `${changeCm > 0 ? "เพิ่ม" : "ลด"} ${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(Math.abs(changeCm))} ซม.`} เทียบค่าก่อนหน้า ${Math.round(minutes)} นาที`;
const priority = (station: WaterStation | null, changeCm: number | null) => !station || station.status === "unavailable" ? 0 : station.status === "stale" ? 1 : changeCm !== null ? 2 : 3;

export default function HydroFollowedStations({ items, basins, refresh, compact = false }: { items: FollowedStationId[]; basins: HydroBasin[]; refresh: number; compact?: boolean }) {
  const entries = useMemo(() => items.map(item => ({ item, current: hydroStation(basins, item.id, item.basinId) })), [items, basins]);
  const requestKey = JSON.stringify(entries.slice(0, MAX_TRENDS).flatMap(({ item, current }) => current?.station.status === "fresh" ? [{ item, datum: current.station.datum, observedAt: current.station.observedAt }] : []));
  const requests = useMemo(() => JSON.parse(requestKey) as { item: FollowedStationId; datum: "msl" | "gauge"; observedAt: string | null }[], [requestKey]);
  const [history, setHistory] = useState<Record<string, WaterHistoryPayload | null>>({});
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const loadingTimer = requests.length ? window.setTimeout(() => setLoading(true), 0) : undefined;
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    async function load() {
      const next: Record<string, WaterHistoryPayload | null> = {};
      for (let offset = 0; offset < requests.length && !controller.signal.aborted; offset += 4) {
        await Promise.all(requests.slice(offset, offset + 4).map(async ({ item, datum, observedAt }) => {
          const query = new URLSearchParams({ station: item.id, datum, hours: "24", version: observedAt ?? "none" });
          try {
            const response = await fetch(`/api/water-history?${query}`, { signal: controller.signal, cache: "no-store" });
            next[keyOf(item)] = response.ok ? await response.json() as WaterHistoryPayload : null;
          } catch { next[keyOf(item)] = null; }
        }));
      }
      window.clearTimeout(loadingTimer);
      window.clearTimeout(timeout);
      if (active) { setHistory(next); setLoading(false); }
    }
    void load();
    return () => { active = false; window.clearTimeout(loadingTimer); window.clearTimeout(timeout); controller.abort(); };
  }, [requests, refresh]);
  if (!items.length) return compact ? <p className="hy-follow-empty">ยังไม่มีสถานีที่ติดตาม เลือกสถานีในแผนที่และกราฟเพื่อดูการเปลี่ยนแปลงที่มีหลักฐาน</p> : null;
  const rows = entries.map((entry, index) => {
    const station = entry.current?.station ?? null;
    const archive = history[keyOf(entry.item)];
    const change = station && archive?.storage !== "unavailable" ? watchedWaterChange(station, archive?.points ?? []) : null;
    return { ...entry, index, station, archive, change };
  }).sort((a, b) => priority(a.station, a.change?.changeCm ?? null) - priority(b.station, b.change?.changeCm ?? null) || (b.change?.changeCm ?? -Infinity) - (a.change?.changeCm ?? -Infinity) || a.index - b.index);
  const shown = compact ? rows.slice(0, 5) : rows;
  const comparable = rows.filter(row => row.change).length;
  const delayed = rows.filter(row => !row.station || row.station.status !== "fresh").length;
  return <div className="hy-followed"><p className="hy-follow-intro" role="status">{loading ? "กำลังตรวจค่าก่อนหน้าของสถานีที่ติดตาม…" : `${comparable} สถานีมีค่าก่อนหน้าที่เทียบได้ · ${delayed} สถานีข้อมูลล่าช้าหรือหายจากรายการล่าสุด`}{compact && <a href="/watchlist">ดูทั้งหมด →</a>}</p>
    <div className="hy-follow-grid">{shown.map(({ item, station, archive, change, index }) => {
      const missing = !station;
      const delayedStation = station?.status === "stale";
      const unavailable = station?.status === "unavailable";
      const risk = station?.status === "fresh" ? waterRisk(station) : null;
      const detail = missing ? "ต้นทางไม่ส่งสถานีนี้ในข้อมูลล่าสุด · เก็บรหัสไว้เพื่อกลับมาตรวจภายหลัง" : delayedStation ? `ข้อมูลล่าช้า · ตรวจวัด ${thaiObservationTime(station.observedAt)} น. · ไม่ใช้สรุปสถานการณ์ปัจจุบัน` : unavailable ? "ไม่มีค่าปัจจุบันที่ใช้ได้" : change ? `${trendText(change.changeCm, change.minutes)} · ตรวจวัด ${thaiObservationTime(change.to)} น.` : index >= MAX_TRENDS ? "ยังไม่ได้ตรวจประวัติสำหรับรายการนี้" : loading ? "กำลังตรวจค่าก่อนหน้า…" : archive?.storage === "unavailable" ? "คลังประวัติไม่พร้อม · ยังสรุปการเปลี่ยนแปลงไม่ได้" : archive === null ? "อ่านประวัติไม่ได้ · ยังสรุปการเปลี่ยนแปลงไม่ได้" : "ยังไม่มีค่าก่อนหน้าที่ต่อเนื่องและตรงกับค่าปัจจุบัน";
      return <a className={`hy-follow-card${missing || delayedStation || unavailable ? " is-delayed" : ""}`} key={keyOf(item)} href={`/stations/${encodeURIComponent(item.id)}?basin=${encodeURIComponent(item.basinId)}`}><span className="hy-follow-top"><strong>{station?.name ?? item.id}</strong><span>{station?.status === "fresh" ? `${formatWaterValue(station.value)} ${station.datum === "msl" ? "ม. รทก." : "ม. เกจ"}` : "—"}</span></span><small>{entryName(item.basinId, basins)} · {station?.waterway ?? item.id}</small><span className="hy-follow-detail">{detail}</span>{risk && <span className="hy-follow-risk">{risk.id === "overflow" ? "เกินเกณฑ์สถานี" : risk.id === "high" ? "น้ำมาก · ติดตาม" : risk.title}</span>}</a>;
    })}</div>{items.length > MAX_TRENDS && <p className="hy-follow-limit">ตรวจประวัติสูงสุด {MAX_TRENDS} สถานีล่าสุดต่อครั้ง รายการอื่นยังแสดงสถานะค่าปัจจุบัน</p>}
  </div>;
}

function entryName(id: string, basins: HydroBasin[]) { return basins.find(basin => basin.id === id)?.name ?? id; }
