import { getProvincePoints, type ProvinceId, type ProvincePoint } from "./provinces.ts";

export const TMD_NWP_BASE_URL = "https://data.tmd.go.th/nwpapi";
type TmdForecast = { time?: unknown; data?: { rain?: unknown } };
type TmdWeatherForecast = { location?: { lat?: unknown; lon?: unknown; latitude?: unknown; longitude?: unknown }; forecasts?: unknown };
export type TmdNwpPayload = { WeatherForecasts?: unknown };
export type TmdMergeableLocation = {
  latitude: number; longitude: number;
  hourly?: { time: string[]; precipitation_probability: Array<number | null>; precipitation: Array<number | null>; rain: Array<number | null>; showers: Array<number | null>; weather_code: Array<number | null> };
  daily?: { time: string[]; precipitation_sum: Array<number | null>; precipitation_probability_max: Array<number | null>; precipitation_hours: Array<number | null>; weather_code: Array<number | null> };
};

function bangkokParts(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Bangkok" }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, hour: value("hour") };
}

export function buildTmdPointForecastUrls(provinceId: ProvinceId, baseUrl = TMD_NWP_BASE_URL) {
  const points = getProvincePoints(provinceId);
  return [points[0], points[4], points[8]].filter(Boolean).map((point) => {
    const url = new URL("v1/forecast/location/hourly/at", `${baseUrl.replace(/\/$/, "")}/`);
    url.searchParams.set("lat", String(point.lat));
    url.searchParams.set("lon", String(point.lng));
    url.searchParams.set("fields", "rain,cond");
    url.searchParams.set("duration", "48");
    return url;
  });
}

function finite(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}
function hourKey(value: unknown) {
  if (typeof value !== "string" || value.length < 13) return null;
  const trimmed = value.trim();
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const timestamp = Date.parse(trimmed);
    if (!Number.isFinite(timestamp)) return null;
    const parts = bangkokParts(timestamp);
    return `${parts.date}T${parts.hour}:00`;
  }
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2})/);
  return match ? `${match[1]}T${match[2]}:00` : null;
}
function cadence(keys: string[]) {
  const gaps = keys.slice(1).map((key, index) => (Date.parse(`${key}:00Z`) - Date.parse(`${keys[index]}:00Z`)) / 3_600_000).filter((value) => value > 0 && value <= 6).sort((a, b) => a - b);
  return gaps.length ? Math.max(1, Math.round(gaps[Math.floor(gaps.length / 2)])) : 1;
}
function distance(point: ProvincePoint, location: { lat: number; lng: number }) {
  const dx = (point.lng - location.lng) * Math.cos((point.lat * Math.PI) / 180);
  const dy = point.lat - location.lat;
  return dx * dx + dy * dy;
}
function parseTmd(payload: TmdNwpPayload) {
  const items = Array.isArray(payload?.WeatherForecasts) ? payload.WeatherForecasts as TmdWeatherForecast[] : [];
  return items.map((item) => {
    const lat = finite(item.location?.lat ?? item.location?.latitude, -90, 90);
    const lng = finite(item.location?.lon ?? item.location?.longitude, -180, 180);
    const forecasts = Array.isArray(item.forecasts) ? item.forecasts as TmdForecast[] : [];
    const values = forecasts.map((forecast) => ({ key: hourKey(forecast.time), rain: finite(forecast.data?.rain, 0, 1_000) })).filter((item): item is { key: string; rain: number } => item.key !== null && item.rain !== null);
    return lat === null || lng === null || values.length < 8 ? null : { lat, lng, values, cadenceHours: cadence(values.map((value) => value.key)) };
  }).filter((item): item is NonNullable<typeof item> => item !== null);
}

export function mergeTmdRainForecast<T extends TmdMergeableLocation>(raw: T[] | T, payload: TmdNwpPayload, provinceId: ProvinceId) {
  const locations = (Array.isArray(raw) ? raw : [raw]).map((location) => structuredClone(location));
  const tmdLocations = parseTmd(payload);
  let acceptedPoints = 0;
  let forecastValues = 0;
  const cadences: number[] = [];
  locations.forEach((location, index) => {
    const point = getProvincePoints(provinceId)[index];
    if (!point || !location.hourly || !location.daily || !tmdLocations.length) return;
    const nearest = [...tmdLocations].sort((a, b) => distance(point, a) - distance(point, b))[0];
    if (!nearest || distance(point, nearest) > 0.12) return;
    const indices = new Map(location.hourly.time.map((time, timeIndex) => [hourKey(time), timeIndex]));
    let merged = 0;
    nearest.values.forEach(({ key, rain }) => {
      const target = indices.get(key);
      if (target === undefined) return;
      location.hourly!.precipitation[target] = rain;
      location.hourly!.rain[target] = rain;
      location.hourly!.showers[target] = 0;
      for (let offset = 1; offset < nearest.cadenceHours && target + offset < location.hourly!.time.length; offset += 1) {
        location.hourly!.precipitation[target + offset] = 0;
        location.hourly!.rain[target + offset] = 0;
        location.hourly!.showers[target + offset] = 0;
      }
      merged += 1;
    });
    if (merged < 8) return;
    acceptedPoints += 1;
    forecastValues += merged;
    cadences.push(nearest.cadenceHours);
    location.daily.time.forEach((date, dayIndex) => {
      const values = location.hourly!.time.map((time, timeIndex) => ({ time, value: location.hourly!.precipitation[timeIndex] })).filter((item) => item.time.startsWith(date) && typeof item.value === "number" && Number.isFinite(item.value));
      if (!values.length) return;
      location.daily!.precipitation_sum[dayIndex] = Math.round(values.reduce((sum, item) => sum + (item.value ?? 0), 0) * 10) / 10;
      location.daily!.precipitation_hours[dayIndex] = values.filter((item) => (item.value ?? 0) >= 0.1).length;
    });
  });
  return { locations, acceptedPoints, forecastValues, cadenceHours: cadences.length ? Math.max(...cadences) : null };
}
