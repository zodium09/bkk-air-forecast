import { addDays, bangkokDateKey } from "./forecast/timestamps.ts";

export type AtmosphereHour = {
  time: string; temperatureC: number | null; humidityPct: number | null;
  rainMm: number | null; windKmh: number | null; windFromDeg: number | null;
  pressureHpa: number | null; mixingHeightM: number | null;
};
export type AtmosphereDay = {
  date: string; morningMinC: number | null; meanTemperatureC: number | null;
  humidityPct: number | null; rainMm: number | null; windKmh: number | null;
  windFromDeg: number | null; pressureHpa: number | null; mixingHeightM: number | null;
  northerlyFraction: number | null; stagnantHours: number | null; mixingHours: number;
  coverage: Record<string, number>;
};
export type AtmospherePayload = {
  status: "live" | "degraded" | "unavailable"; fetchedAt: string;
  model: string; requested: { lat: number; lng: number };
  grid: { lat: number; lng: number } | null;
  hours: AtmosphereHour[]; days: AtmosphereDay[];
};
type RawWeather = {
  latitude?: unknown; longitude?: unknown; utc_offset_seconds?: unknown;
  hourly_units?: Record<string, unknown>;
  hourly?: Record<string, unknown>;
};
const variables = {
  temperatureC: ["temperature_2m", "°C", -50, 60],
  humidityPct: ["relative_humidity_2m", "%", 0, 100],
  rainMm: ["precipitation", "mm", 0, 500],
  windKmh: ["wind_speed_10m", "km/h", 0, 300],
  windFromDeg: ["wind_direction_10m", "°", 0, 360],
  pressureHpa: ["pressure_msl", "hPa", 850, 1100],
  mixingHeightM: ["boundary_layer_height", "m", 0, 10000],
} as const;
export const ATMOSPHERE_METHOD = {
  minimumHours: 18, calmWindKmh: 5, shallowLayerM: 300,
  coolingC: 2, pressureRiseHpa: 1.5, northerlyFraction: 0.5,
} as const;

function finite(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}
function values(hours: AtmosphereHour[], key: keyof Omit<AtmosphereHour, "time">) {
  return hours.map(hour => hour[key]).filter((v): v is number => v !== null);
}
function mean(list: number[], minimum = ATMOSPHERE_METHOD.minimumHours) {
  return list.length >= minimum ? list.reduce((a, b) => a + b, 0) / list.length : null;
}
export function isNortherly(degrees: number) { return degrees >= 315 || degrees <= 90; }
export function windDirectionLabel(degrees: number | null) {
  if (degrees === null) return "ยังระบุทิศลมไม่ได้";
  return ["เหนือ", "ตะวันออกเฉียงเหนือ", "ตะวันออก", "ตะวันออกเฉียงใต้", "ใต้", "ตะวันตกเฉียงใต้", "ตะวันตก", "ตะวันตกเฉียงเหนือ"][Math.round(degrees / 45) % 8];
}
/** Circular, speed-weighted meteorological direction. Calm/opposing winds have no reliable mean direction. */
export function meanWindDirection(hours: AtmosphereHour[]) {
  const usable = hours.filter(h => h.windKmh !== null && h.windFromDeg !== null);
  if (usable.length < ATMOSPHERE_METHOD.minimumHours) return null;
  const weight = usable.reduce((sum, h) => sum + h.windKmh!, 0);
  const x = usable.reduce((sum, h) => sum + Math.cos(h.windFromDeg! * Math.PI / 180) * h.windKmh!, 0);
  const y = usable.reduce((sum, h) => sum + Math.sin(h.windFromDeg! * Math.PI / 180) * h.windKmh!, 0);
  if (weight < usable.length * 0.5 || Math.hypot(x, y) / weight < 0.1) return null;
  const degrees = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  return degrees > 359.999 ? 0 : degrees;
}

export function normalizeAtmosphere(raw: unknown, requested: { lat: number; lng: number }, now = Date.now()): AtmospherePayload {
  const payload = (raw && typeof raw === "object" ? raw : {}) as RawWeather;
  const times = Array.isArray(payload.hourly?.time) ? payload.hourly!.time : [];
  const first = addDays(bangkokDateKey(now), -2);
  const dates = Array.from({ length: 10 }, (_, i) => addDays(first, i));
  const byTime = new Map<string, AtmosphereHour>();
  // The endpoint explicitly requests Bangkok-local hours and exact units.
  if (payload.utc_offset_seconds === 25200) times.forEach((time: unknown, index: number) => {
    if (typeof time !== "string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):00$/.test(time) || byTime.has(time)) return;
    const timestamp = Date.parse(`${time}+07:00`);
    if (!Number.isFinite(timestamp) || new Date(timestamp + 7 * 3600000).toISOString().slice(0, 16) !== time) return;
    const hour: AtmosphereHour = { time, temperatureC: null, humidityPct: null, rainMm: null, windKmh: null, windFromDeg: null, pressureHpa: null, mixingHeightM: null };
    for (const [field, [name, unit, min, max]] of Object.entries(variables)) {
      const column = payload.hourly?.[name];
      hour[field as keyof Omit<AtmosphereHour, "time">] = payload.hourly_units?.[name] === unit && Array.isArray(column) ? finite(column[index], min, max) : null;
    }
    byTime.set(time, hour);
  });
  const hours = dates.flatMap(date => Array.from({ length: 24 }, (_, i) => {
    const time = `${date}T${String(i).padStart(2, "0")}:00`;
    return byTime.get(time) ?? { time, temperatureC: null, humidityPct: null, rainMm: null, windKmh: null, windFromDeg: null, pressureHpa: null, mixingHeightM: null };
  }));
  const days = dates.map(date => {
    const dayHours = hours.filter(h => h.time.startsWith(date));
    const coverage = Object.fromEntries(Object.keys(variables).map(field => [field, values(dayHours, field as keyof Omit<AtmosphereHour, "time">).length]));
    const morning = values(dayHours.filter(h => Number(h.time.slice(11, 13)) <= 8), "temperatureC");
    const paired = dayHours.filter(h => h.windKmh !== null && h.windFromDeg !== null);
    const mixing = dayHours.filter(h => h.windKmh !== null && h.mixingHeightM !== null);
    // Precipitation is the preceding-hour total: 01:00 through next day's 00:00 covers this local calendar day.
    const rain = Array.from({ length: 24 }, (_, i) => byTime.get(i === 23 ? `${addDays(date, 1)}T00:00` : `${date}T${String(i + 1).padStart(2, "0")}:00`)?.rainMm).filter((v): v is number => typeof v === "number");
    coverage.rainMm = rain.length;
    return {
      date, morningMinC: morning.length === 9 ? Math.min(...morning) : null,
      meanTemperatureC: mean(values(dayHours, "temperatureC")), humidityPct: mean(values(dayHours, "humidityPct")),
      rainMm: rain.length === 24 ? rain.reduce((a, b) => a + b, 0) : null,
      windKmh: mean(values(dayHours, "windKmh")), windFromDeg: meanWindDirection(dayHours),
      pressureHpa: mean(values(dayHours, "pressureHpa")), mixingHeightM: mean(values(dayHours, "mixingHeightM")),
      northerlyFraction: paired.length >= ATMOSPHERE_METHOD.minimumHours ? paired.filter(h => h.windKmh! >= 5 && isNortherly(h.windFromDeg!)).length / paired.length : null,
      stagnantHours: mixing.length >= ATMOSPHERE_METHOD.minimumHours ? mixing.filter(h => h.windKmh! <= ATMOSPHERE_METHOD.calmWindKmh && h.mixingHeightM! <= ATMOSPHERE_METHOD.shallowLayerM).length : null,
      mixingHours: mixing.length, coverage,
    };
  });
  const upcoming = days.filter(day => day.date >= bangkokDateKey(now));
  const good = upcoming.filter(day => [day.windKmh, day.windFromDeg, day.morningMinC, day.pressureHpa, day.mixingHeightM, day.humidityPct, day.rainMm].every(v => v !== null));
  const any = upcoming.some(day => Object.values(day.coverage).some(count => count >= 18));
  const lat = finite(payload.latitude, -90, 90), lng = finite(payload.longitude, -180, 180);
  return {
    status: !any ? "unavailable" : good.length === upcoming.length ? "live" : "degraded",
    fetchedAt: new Date(now).toISOString(), model: "NOAA GFS · Open-Meteo", requested,
    grid: lat !== null && lng !== null ? { lat, lng } : null, hours, days,
  };
}

export function coldWindSignal(day?: AtmosphereDay, previous?: AtmosphereDay) {
  if (!day || previous?.date !== addDays(day.date, -1)) previous = undefined;
  const cooling = day?.morningMinC != null && previous?.morningMinC != null ? previous.morningMinC - day.morningMinC : null;
  const pressureRise = day?.pressureHpa != null && previous?.pressureHpa != null ? day.pressureHpa - previous.pressureHpa : null;
  const northerly = day?.northerlyFraction != null ? day.northerlyFraction >= ATMOSPHERE_METHOD.northerlyFraction : null;
  const complete = cooling !== null && pressureRise !== null && northerly !== null;
  const status = !complete ? "unknown" : northerly && cooling >= ATMOSPHERE_METHOD.coolingC && pressureRise >= ATMOSPHERE_METHOD.pressureRiseHpa ? "signal" : northerly ? "northerly" : "none";
  return { status, cooling, pressureRise, northerly, title: status === "unknown" ? "ข้อมูลยังไม่พอวิเคราะห์ลมหนาว" : status === "signal" ? "มีสัญญาณลมเหนือและอากาศเย็นลง" : status === "northerly" ? "มีลมฝ่ายเหนือ แต่สัญญาณเย็นลงยังไม่ครบ" : "ยังไม่เห็นสัญญาณลมหนาวตามเกณฑ์นี้" };
}
