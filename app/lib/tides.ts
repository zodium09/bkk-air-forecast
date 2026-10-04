import stationCatalog from "../data/tide-stations.json" with { type: "json" };
import { observationAge } from "./observation-time.ts";
import { waterRisk, type WaterPayload } from "./water-levels.ts";
import type { RoadFloodPayload } from "./road-floods.ts";

export const TIDE_SOURCE_PAGE = "https://hydro.navy.mi.th/waterlaveltable";
export const TIDE_RAIN_THRESHOLD = 10; // App watch filter: mm in a complete three-hour period, not an official flood threshold.
export const TIDE_NEAR_PEAK = .2; // Relative to THIS station's daily hourly maximum, not a bank level.
export const tideStations = stationCatalog;
export type TideStation = typeof tideStations[number];
export type TidePoint = { at: string; metres: number | null };
export type TideRainHour = { start: string; end: string; mm: number | null };
export type TideTable = { year: number; datum: string; cadenceMinutes: number; retrievedAt: string; stations: Record<string, { sourceUrl: string; sha256: string; hourlyDecimetres: number[] }> };
export type TidePayload = { station: TideStation; dates: string[]; points: TidePoint[]; rain: TideRainHour[]; rainStatus: "available" | "partial" | "unavailable"; rainFetchedAt: string | null; fetchedAt: string; tableRetrievedAt: string; tableYear: number; status: "available" | "unavailable"; sourcePage: string; sourceUrl: string; sourceHash: string };
export type TideWindow = { start: string; end: string; tideMax: number | null; rainMm: number | null; nearPeak: boolean | null; kind: "combined" | "tide" | "rain" | "other" | "unknown" };

export function tideStation(id: unknown) { return tideStations.find(s => s.id === id) ?? null; }
export function tideDistance(a: {lat:number;lng:number}, b: {lat:number;lng:number}) { return Math.hypot((a.lat-b.lat)*111, (a.lng-b.lng)*108); }
/** Automatic reference is geographically bounded. It never asserts a district-wide tidal effect. */
export function tideReference(place: {lat:number;lng:number} | null, region: string) {
  if (place && Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
    const nearest = [...tideStations].sort((a,b) => tideDistance(a,place)-tideDistance(b,place))[0];
    const distance = tideDistance(nearest,place);
    return { station: distance <= 25 ? nearest : tideStations[0], distance, nearby: distance <= 25 };
  }
  const station = region === "samut-sakhon" ? tideStations[3] : region === "bangkok" ? tideStations[1] : tideStations[0];
  return {station, distance:null, nearby:false};
}
export function tideTime(date: string, hour: number) { return validTideDate(date)&&Number.isFinite(hour)?new Date(Date.parse(`${date}T00:00:00+07:00`)+hour*3600000).toISOString():""; }
export function localTideDate(at:string) {const value=Date.parse(at);return Number.isFinite(value)?new Date(value+7*3600000).toISOString().slice(0,10):"";}
export function tideDateAfter(date: string, days: number) { return localTideDate(tideTime(date,days*24)); }
export function validTideDate(date: string) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00+07:00`)) && localTideDate(`${date}T00:00:00+07:00`) === date; }
/** Annual facts are never reused outside their year; source precision is 0.1 m. */
export function tidePoints(table: TideTable, id: string, date: string, days = 7): TidePoint[] {
  if (!validTideDate(date) || !Number.isInteger(days) || days < 1 || days > 7 || table.datum !== "msl" || table.cadenceMinutes !== 60) return [];
  const record = table.stations[id];
  if (!record) return [];
  const origin = Date.parse(`${table.year}-01-01T00:00:00+07:00`);
  return Array.from({length:days*24+1},(_,i) => {
    const at=tideTime(date,i), index=(Date.parse(at)-origin)/3600000;
    const value = record.hourlyDecimetres[index];
    return {at,metres:Number.isInteger(index)&&index>=0&&localTideDate(at).startsWith(`${table.year}-`)&&typeof value==="number"&&Number.isFinite(value) ? value/10 : null};
  });
}
/** Open-Meteo precipitation is the preceding hour ending at its timestamp. */
export function normalizeTideRain(raw: unknown, date: string, days = 7): TideRainHour[] {
  const row = raw && typeof raw === "object" ? raw as {utc_offset_seconds?:number;hourly_units?:{precipitation?:string};hourly?:{time?:unknown[];precipitation?:unknown[]}} : {};
  const goodUnits=row.utc_offset_seconds===25200&&row.hourly_units?.precipitation==="mm";
  const hours = new Map<string, number|null>();
  if(goodUnits && Array.isArray(row.hourly?.time)) row.hourly!.time!.forEach((t,i) => {
    if(typeof t!=="string")return;
    const v=row.hourly?.precipitation?.[i];
    // Repeated time bins are ambiguous, not silently overwritten.
    const n=typeof v==="number"&&Number.isFinite(v)&&v>=0?v:null;
    hours.set(t,hours.has(t)?null:n);
  });
  return Array.from({length:days*24},(_,i) => {
    const start=tideTime(date,i),end=tideTime(date,i+1);
    const wall=new Date(Date.parse(end)+7*3600000).toISOString().slice(0,16);
    return {start,end,mm:hours.get(wall)??null};
  });
}
export function tideWindows(points: TidePoint[], rain: TideRainHour[], date: string): TideWindow[] {
  if(!validTideDate(date))return [];
  const daily=points.filter(p=>localTideDate(p.at)===date).map(p=>p.metres);
  const completeDay=daily.length===24&&daily.every(v=>v!==null&&Number.isFinite(v));
  const dailyMax=completeDay?Math.max(...daily as number[]):null;
  const tideMap=new Map(points.map(p=>[p.at,p.metres]));
  const rainMap=new Map(rain.map(p=>[p.start,p]));
  return Array.from({length:8},(_,i) => {
    const start=tideTime(date,i*3),end=tideTime(date,i*3+3);
    const heights=Array.from({length:4},(_,h)=>tideMap.get(tideTime(date,i*3+h))??null);
    const amounts=Array.from({length:3},(_,h)=>rainMap.get(tideTime(date,i*3+h))?.mm??null);
    const tideMax=heights.every(v=>v!==null&&Number.isFinite(v))?Math.max(...heights as number[]):null;
    const rainMm=amounts.every(v=>v!==null&&Number.isFinite(v)&&v>=0)?Number((amounts as number[]).reduce((a,b)=>a+b,0).toFixed(3)):null;
    const nearPeak=tideMax===null||dailyMax===null?null:tideMax>=dailyMax-TIDE_NEAR_PEAK-1e-9;
    const kind=nearPeak===null||rainMm===null?"unknown":nearPeak&&rainMm>=TIDE_RAIN_THRESHOLD?"combined":nearPeak?"tide":rainMm>=TIDE_RAIN_THRESHOLD?"rain":"other";
    return {start,end,tideMax,rainMm,nearPeak,kind};
  });
}
export function tideDayExtremes(points:TidePoint[],date:string) {
  const day=points.filter(p=>localTideDate(p.at)===date);
  if(day.length!==24||day.some(p=>p.metres===null||!Number.isFinite(p.metres)))return null;
  const max=Math.max(...day.map(p=>p.metres!)),min=Math.min(...day.map(p=>p.metres!));
  return {max,min,high:day.filter(p=>p.metres===max).map(p=>p.at),low:day.filter(p=>p.metres===min).map(p=>p.at)};
}
/** Observed evidence keeps agency classes, freshness and 8 km location. No forecast is called observed flooding. */
export function tideObservedEvidence(station:TideStation,water:WaterPayload|null,roads:RoadFloodPayload|null,now:number) {
  const nearbyWater=(water?.stations??[]).filter(s=>tideDistance(station,s)<=8&&s.value!==null&&observationAge(s.observedAt,now)!==null&&observationAge(s.observedAt,now)!<=60);
  const classified=nearbyWater.filter(s=>waterRisk({...s,status:"fresh"}).priority>=0);
  const high=classified.filter(s=>["high","overflow"].includes(waterRisk({...s,status:"fresh"}).id));
  const nearbyRoads=(roads?.stations??[]).filter(s=>tideDistance(station,s)<=8&&s.value!==null&&observationAge(s.observedAt,now)!==null&&observationAge(s.observedAt,now)!<=30&&s.status==="fresh"&&s.level!=="unknown");
  const flood=nearbyRoads.filter(s=>s.level==="minor"||s.level==="flood");
  return {waterTotal:nearbyWater.length,waterClassified:classified.length,high,roadTotal:nearbyRoads.length,flood};
}
