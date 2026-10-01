import { provinces, type ProvinceId, type RegionId } from "./provinces.ts";
import { observationAge } from "./observation-time.ts";

export const WATER_SOURCE_PAGE = "https://www.thaiwater.net/water";
export const WATER_SOURCE_API = "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load";
export type WaterStation = {
  id: string; name: string; waterway: string; kind: "canal" | "river" | "other";
  provinceId: ProvinceId; province: string; district: string; lat: number; lng: number;
  value: number | null; datum: "msl" | "gauge"; bank: number | null;
  capacityPercent: number | null; ground: number | null;
  observedAt: string | null; ageMinutes: number | null;
  status: "fresh" | "stale" | "unavailable"; agency: string;
};
export type WaterPayload = { status: "live" | "degraded" | "unavailable"; fetchedAt: string; stations: WaterStation[]; source: string; sourcePage: string };

export function formatWaterValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value !== 0 && Math.abs(value) < .001) return value < 0 ? ">−0.001" : "<0.001";
  return new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(value);
}

function number(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === "boolean" || typeof value === "string" && !value.trim()) return null;
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function thai(value: unknown) { const text = typeof value === "string" ? value : object(value).th; return typeof text === "string" ? text.trim() : ""; }
function localTime(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  const iso = `${value.replace(" ", "T")}${value.length === 16 ? ":00" : ""}+07:00`;
  const timestamp = Date.parse(iso);
  return Number.isFinite(timestamp) && new Date(timestamp + 7 * 3600000).toISOString().slice(0, 16) === value.replace(" ", "T").slice(0, 16) ? timestamp : null;
}

/** Station measurements remain at their source coordinates and source datum. Never interpolate them. */
export function normalizeWaterLevels(raw: unknown, now = Date.now()): WaterPayload {
  const feed = object(object(raw).waterlevel_data);
  const rows = feed.result === "OK" && Array.isArray(feed.data) ? feed.data : [];
  const unique = new Map<string, WaterStation>();
  for (const item of rows) {
    const row = object(item), station = object(row.station), geocode = object(row.geocode);
    const province = provinces.find((province) => province.code === String(geocode.province_code));
    const lat = number(station.tele_station_lat), lng = number(station.tele_station_long);
    const name = thai(station.tele_station_name), id = typeof station.id === "number" || typeof station.id === "string" ? String(station.id) : "";
    if (!province || !id || !name || lat === null || lng === null || lat < 5 || lat > 21 || lng < 97 || lng > 106) continue;
    const observed = localTime(row.waterlevel_datetime);
    const validTime = observed !== null && observed <= now + 5 * 60000;
    const ageMinutes = validTime ? Math.max(0, Math.floor((now - observed!) / 60000)) : null;
    const msl = number(row.waterlevel_msl), gauge = number(row.waterlevel_m);
    const datum = msl !== null ? "msl" : "gauge";
    const reading = msl ?? gauge;
    const value = validTime && ageMinutes! <= 1440 ? reading : null;
    const waterway = thai(row.river_name);
    const record: WaterStation = {
      id, name, waterway: waterway || "ต้นทางไม่ระบุชื่อทางน้ำ", kind: waterway.startsWith("แม่น้ำ") ? "river" : waterway.startsWith("คลอง") ? "canal" : "other",
      provinceId: province.id, province: province.nameTh, district: thai(geocode.amphoe_name), lat, lng,
      value, datum, bank: datum === "msl" ? number(station.min_bank) : null,
      capacityPercent: value !== null ? number(row.storage_percent) : null,
      ground: datum === "msl" ? number(station.ground_level) : null,
      observedAt: observed === null ? null : new Date(observed).toISOString(), ageMinutes,
      status: value === null ? "unavailable" : ageMinutes! <= 60 ? "fresh" : "stale",
      agency: thai(object(row.agency).agency_name) || "ต้นทางไม่ระบุหน่วยงาน",
    };
    const previous = unique.get(id);
    // A future or malformed duplicate must not displace a valid measurement.
    if (!previous || (record.value !== null && (previous.value === null || (record.observedAt ?? "") > (previous.observedAt ?? "")))) unique.set(id, record);
  }
  const stations = [...unique.values()];
  const fresh = stations.filter((station) => station.status === "fresh").length;
  return { status: fresh === stations.length && fresh > 0 ? "live" : stations.some((station) => station.value !== null) ? "degraded" : "unavailable", fetchedAt: new Date(now).toISOString(), stations, source: "ThaiWater · คลังข้อมูลน้ำแห่งชาติ", sourcePage: WATER_SOURCE_PAGE };
}

export function waterStationsForArea(stations: WaterStation[], region: RegionId, place: { lat: number; lng: number } | null = null) {
  return stations.filter((station) => region === "metro" || station.provinceId === region).map((station) => ({ ...station, distanceKm: place ? Math.hypot((station.lat - place.lat) * 111, (station.lng - place.lng) * 108) : null })).sort((a, b) => {
    const rank = { fresh: 0, stale: 1, unavailable: 2 };
    return rank[a.status] - rank[b.status] || (place ? a.distanceKm! - b.distanceKm! : a.name.localeCompare(b.name, "th"));
  });
}

export function currentWaterStations(stations: WaterStation[], now = Date.now()) {
  return stations.map(station => {
    const ageMinutes = observationAge(station.observedAt, now);
    const value = ageMinutes === null || ageMinutes > 1440 ? null : station.value;
    return { ...station, value, ageMinutes, status: value === null ? "unavailable" as const : ageMinutes! <= 60 ? "fresh" as const : "stale" as const };
  });
}

export function waterBankDifference(station: WaterStation) {
  return station.status === "fresh" && station.datum === "msl" && station.value !== null && station.bank !== null ? station.value - station.bank : null;
}

export type WaterRisk = { id: "unknown" | "critical-low" | "low" | "normal" | "high" | "overflow" | "below-bank"; title: string; priority: number; message: string };

/** Published ThaiWater capacity bands; an old observation never creates a current signal. */
export function waterRisk(station: WaterStation): WaterRisk {
  if (station.status !== "fresh" || station.value === null) return { id: "unknown", title: "ยังประเมินสถานะล่าสุดไม่ได้", priority: -1, message: "รอค่าตรวจวัดล่าสุดก่อนใช้ติดตามสถานการณ์" };
  const capacity = station.capacityPercent;
  if (capacity !== null && Number.isFinite(capacity) && capacity >= 0) {
    if (capacity <= 10) return { id: "critical-low", title: "น้ำน้อยวิกฤติ", priority: 3, message: "ความจุลำน้ำไม่เกิน 10% · ตรวจสถานการณ์กับหน่วยงานในพื้นที่" };
    if (capacity <= 30) return { id: "low", title: "น้ำน้อย", priority: 1, message: "ความจุลำน้ำมากกว่า 10–30% · ติดตามค่าครั้งถัดไป" };
    if (capacity <= 70) return { id: "normal", title: "น้ำปกติตามเกณฑ์ความจุ", priority: 0, message: "ความจุลำน้ำมากกว่า 30–70% · ยังต้องติดตามเวลาตรวจวัด" };
    if (capacity <= 100) return { id: "high", title: "น้ำมาก · ควรติดตาม", priority: 2, message: "ความจุลำน้ำมากกว่า 70–100% · ติดตามระดับน้ำและประกาศในพื้นที่" };
    return { id: "overflow", title: "น้ำล้นตลิ่งตามเกณฑ์ความจุ", priority: 3, message: "ความจุลำน้ำเกิน 100% ณ สถานีนี้ · ตรวจประกาศและสถานการณ์ในพื้นที่" };
  }
  const difference = waterBankDifference(station);
  if (difference === null) return { id: "unknown", title: "ไม่มีเกณฑ์ความจุที่ใช้ได้", priority: -1, message: "มีค่าระดับน้ำ แต่ยังจัดระดับสถานการณ์ไม่ได้" };
  return difference >= 0
    ? { id: "overflow", title: "ถึงหรือสูงกว่าระดับตลิ่ง", priority: 3, message: "ระดับน้ำถึงตลิ่งที่ต้นทางระบุ ณ สถานีนี้ · ตรวจประกาศในพื้นที่" }
    : { id: "below-bank", title: "ยังต่ำกว่าระดับตลิ่ง", priority: -1, message: "ต้นทางไม่มีเปอร์เซ็นต์ความจุ จึงยังจัดระดับความเสี่ยงไม่ได้" };
}
