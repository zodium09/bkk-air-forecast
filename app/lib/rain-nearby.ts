import type { MapDataset } from "./map-intelligence.ts";
import type { TmdRadarPayload } from "./tmd-radar-data.ts";

export const NEARBY_RAIN_RADIUS_KM = 8;
export const RADAR_SOURCE_PAGE = "https://radargis.tmd.go.th/";
export type RainPosition = { lat: number; lng: number; label?: string };
export type NearbyRainPayload = {
  status: "live" | "degraded" | "unavailable";
  found: boolean | null;
  message: string;
  place: string;
  checkedAt: string;
  observedAt: string | null;
  validUntil: string | null;
  radiusKm: number;
  sourcePage: string;
  reason?: "stale" | "missing-nowcast" | "upstream-error" | "invalid-analysis";
};

export function currentRadar(payload: TmdRadarPayload | null, now: number): TmdRadarPayload | null {
  if (!payload?.observedAt) return null;
  const age = (now - Date.parse(payload.observedAt)) / 60000;
  if (!Number.isFinite(age) || age < -5 || age > 90) return null;
  const nowcastFrames = age <= 30 ? payload.nowcastFrames.filter(frame => Date.parse(frame.validAt) > now) : [];
  return { ...payload, ageMinutes: Math.max(0, Math.floor(age)), status: age <= 30 && nowcastFrames.length ? "live" : "degraded", nowcastFrames };
}

export function normalizeNearbyRain(raw: unknown, radar: TmdRadarPayload | null, now: number): NearbyRainPayload {
  const current = currentRadar(radar, now);
  const base: NearbyRainPayload = { status: "unavailable", found: null, message: "ยังวิเคราะห์ฝนใกล้พื้นที่นี้ไม่ได้", place: "", checkedAt: new Date(now).toISOString(), observedAt: current?.observedAt ?? null, validUntil: current?.nowcastFrames.at(-1)?.validAt ?? null, radiusKm: NEARBY_RAIN_RADIUS_KM, sourcePage: RADAR_SOURCE_PAGE };
  if (!current || current.ageMinutes! > 30) return { ...base, status: current ? "degraded" : "unavailable", reason: "stale", message: "ข้อมูลเรดาร์ยังไม่ใหม่พอสำหรับวิเคราะห์ฝนใกล้คุณ" };
  if (!current.nowcastFrames.length) return { ...base, status: "degraded", reason: "missing-nowcast", message: "มีภาพเรดาร์ล่าสุด แต่แนวโน้มระยะสั้นยังไม่พร้อม" };
  const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : null;
  if (!row || typeof row.found !== "boolean" || typeof row.message !== "string" || !row.message.trim() || row.message.length > 1200) return { ...base, reason: "invalid-analysis" };
  return { ...base, status: "live", found: row.found, message: row.message.trim(), place: typeof row.place === "string" ? row.place.slice(0,200) : "" };
}

export function currentNearbyRain(payload: NearbyRainPayload | null, now: number): NearbyRainPayload | null {
  if (!payload) return null;
  if (payload.status !== "live" || payload.found === null) return payload;
  const age = (now - Date.parse(payload.observedAt ?? "")) / 60000;
  const checkedAge = (now - Date.parse(payload.checkedAt)) / 60000;
  if (!Number.isFinite(age) || age < -5 || age > 30 || !Number.isFinite(checkedAge) || checkedAge < -5 || checkedAge > 10 || Date.parse(payload.validUntil ?? "") <= now || !payload.validUntil) {
    return { ...payload, status: "degraded", found: null, reason: "stale", message: "ผลวิเคราะห์เกินช่วงปัจจุบันแล้ว กำลังรอข้อมูลรอบใหม่" };
  }
  return payload;
}

export function rainDistanceKm(a: RainPosition, b: RainPosition) {
  const rad = Math.PI / 180;
  const dLat = (b.lat-a.lat)*rad, dLng=(b.lng-a.lng)*rad;
  const h=Math.sin(dLat/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLng/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));
}

export type NearbyForecast = { id: string; label: string; lat: number; lng: number; distanceKm: number; total: number | null; probability: number | null; trend: "increasing" | "decreasing" | "steady" | "unknown"; hours: { label: string; amount: number | null; probability: number | null; key: string }[] };
/** Actual provider points and hourly intervals only. No pixel decoding, cloud velocity or arrival-time inference. */
export function nearbyRainOutlook(data: MapDataset | null, position: RainPosition | null, now: number): NearbyForecast[] {
  if (!position || data?.layer !== "rain" || data.valueMethod !== "provider" || data.status === "unavailable") return [];
  const age = now-Date.parse(data.timestamp);
  if (!Number.isFinite(age) || age < -300000 || age > 10800000) return [];
  const wall = new Date(now+7*3600000).toISOString();
  const baseHour = Date.parse(`${wall.slice(0,13)}:00:00Z`);
  const indices = Array.from({length:3},(_,i)=> {
    const instant=new Date(baseHour+i*3600000).toISOString();
    return data.steps.findIndex(step=>step.cadence === "hour" && step.date === instant.slice(0,10) && step.startHour === Number(instant.slice(11,13)) && step.endHour === step.startHour+1);
  });
  return data.points.filter(p=>p.method === "provider" && Number.isFinite(p.lat) && Number.isFinite(p.lng)).map(p=>({p,km:rainDistanceKm(position,p)})).filter(row=>row.km<=NEARBY_RAIN_RADIUS_KM).sort((a,b)=>a.km-b.km).slice(0,4).map(({p,km})=> {
    const hours=indices.map((index,i)=> {
      const instant=new Date(baseHour+i*3600000).toISOString();
      const amount=index>=0?p.secondary[index]:null, probability=index>=0?p.values[index]:null;
      return { key: index>=0?data.steps[index].key:instant, label:`${instant.slice(11,13)}:00`, amount: typeof amount === "number" && Number.isFinite(amount) && amount>=0?amount:null, probability:typeof probability === "number" && Number.isFinite(probability) && probability>=0 && probability<=100?probability:null };
    });
    const complete=hours.every(h=>h.amount!==null), chanceComplete=hours.every(h=>h.probability!==null);
    const first=hours[0].amount,last=hours[2].amount;
    return { id:p.id,label:p.label,lat:p.lat,lng:p.lng,distanceKm:km,hours,total:complete?Number(hours.reduce((sum,h)=>sum+h.amount!,0).toFixed(3)):null,probability:chanceComplete?Math.max(...hours.map(h=>h.probability!)):null,trend:first===null||last===null?"unknown":last-first>.1?"increasing":first-last>.1?"decreasing":"steady" };
  });
}
