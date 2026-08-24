import { aggregateMetroForecast, buildForecastDayShells, type ForecastDay, type ForecastPayload, type ForecastStation, type ForecastStatus, type UpstreamStatus } from "../../lib/forecast-data.ts";
import { buildCamsDailyForecast, calculateBiasCorrection, calculateReliabilityScore, clamp } from "../../lib/forecast/forecast-model.ts";
import { spatialIdw } from "../../lib/forecast/interpolation.ts";
import { deduplicateStations, filterFreshStations, filterOutliers, isValidStation, type RejectedStations } from "../../lib/forecast/quality-control.ts";
import { addDays, parseBangkokTimestamp } from "../../lib/forecast/timestamps.ts";
import { FORECAST_DAYS } from "../../lib/forecast-horizon.ts";
import { METRO_REGION_ID, getProvince, getProvincePoints, provinces, type ProvinceId } from "../../lib/provinces.ts";
import { createDeduplicatedFetch } from "../../lib/deduplicated-fetch.ts";

const AIRBKK_URL = "https://official.airbkk.com/airbkk/Api";
const AIR4THAI_URL = "https://air4thai.pcd.go.th/services/getNewAQI_JSON.php";
const CAMS_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_TIMEOUTS = { airbkk: 9_000, air4thai: 9_000, cams: 9_000, weather: 7_000 } as const;

type AirBkkRecord = { MeasIndex: string; District: string; Area: string; Lat: string; Long: string; DateTime: string; Type: string; "PM2.5": number | string | null };
type AirBkkResponse = { status: string; message: AirBkkRecord[] };
type Air4ThaiStation = {
  stationID?: unknown;
  nameTH?: unknown;
  areaTH?: unknown;
  lat?: unknown;
  long?: unknown;
  AQILast?: { date?: unknown; time?: unknown; PM25?: { value?: unknown } };
};
type Air4ThaiResponse = { stations?: unknown };type CamsLocation = { latitude: number; longitude: number; current?: { time: string; pm2_5: number | null }; hourly: { time: string[]; pm2_5: Array<number | null> } };
type WeatherResponse = { daily: { time: string[]; wind_speed_10m_max: Array<number | null>; wind_direction_10m_dominant: Array<number | null>; precipitation_probability_max: Array<number | null> } };
type SourceResult = { status: UpstreamStatus; data?: unknown };
export type ForecastHandlerOptions = { fetchImpl?: typeof fetch; now?: () => number; timeouts?: Partial<typeof DEFAULT_TIMEOUTS>; provinceId?: unknown; air4ThaiFallbackUrl?: string };

const AIR4THAI_PROVINCE_NAMES: Record<ProvinceId, string> = {
  bangkok: "กรุงเทพ",
  nonthaburi: "นนทบุรี",
  "pathum-thani": "ปทุมธานี",
  "samut-prakan": "สมุทรปราการ",
  "samut-sakhon": "สมุทรสาคร",
  "nakhon-pathom": "นครปฐม",
};

function normalizeAir4ThaiRecords(raw: Air4ThaiResponse | undefined, provinceId: ProvinceId): AirBkkRecord[] {
  if (!Array.isArray(raw?.stations)) return [];
  const province = getProvince(provinceId);
  const provinceName = AIR4THAI_PROVINCE_NAMES[province.id];
  return (raw.stations as Air4ThaiStation[]).flatMap((station) => {
    const area = typeof station.areaTH === "string" ? station.areaTH.trim() : "";
    const lat = Number(station.lat);
    const lng = Number(station.long);
    const value = Number(station.AQILast?.PM25?.value);
    const date = station.AQILast?.date;
    const time = station.AQILast?.time;
    if (!area.includes(provinceName) || !Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(value) || value < 0) return [];
    if (lat < province.bounds.minLat || lat > province.bounds.maxLat || lng < province.bounds.minLng || lng > province.bounds.maxLng) return [];
    if (typeof date !== "string" || typeof time !== "string") return [];
    const dateTime = `${date} ${time.length === 5 ? `${time}:00` : time}`;
    return [{
      MeasIndex: `air4thai-${String(station.stationID ?? `${lat},${lng}`)}`,
      District: area.split(",")[0] || province.nameTh,
      Area: typeof station.nameTH === "string" ? station.nameTH.trim() : area,
      Lat: String(lat),
      Long: String(lng),
      DateTime: dateTime,
      Type: "Air4Thai PCD",
      "PM2.5": value,
    }];
  });
}

function mergeObservationRecords(primary: AirBkkRecord[], secondary: AirBkkRecord[]) {
  return [...primary, ...secondary.filter((candidate) => !primary.some((record) =>
    Math.abs(Number(record.Lat) - Number(candidate.Lat)) < 0.0007 &&
    Math.abs(Number(record.Long) - Number(candidate.Long)) < 0.0007,
  ))];
}

function medianNumber(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function sourceFailure(error: unknown): UpstreamStatus {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError") ? "timeout" : "error";
}

async function requestJson(fetchImpl: typeof fetch, url: URL | string, init: RequestInit, timeoutMs: number): Promise<SourceResult> {
  try {
    const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return { status: "error" };
    return { status: "ok", data: await response.json() };
  } catch (error) {
    return { status: sourceFailure(error) };
  }
}

async function requestJsonWithFallback(fetchImpl: typeof fetch, url: string, fallbackUrl: string | undefined, init: RequestInit, timeoutMs: number) {
  const primary = await requestJson(fetchImpl, url, init, timeoutMs);
  return primary.status === "ok" || !fallbackUrl
    ? primary
    : requestJson(fetchImpl, fallbackUrl, init, timeoutMs);
}

function buildCamsUrl(provinceId: unknown) {
  const camsAnchors = getProvincePoints(provinceId);
  const url = new URL(CAMS_URL);
  url.searchParams.set("latitude", camsAnchors.map((point) => point.lat).join(","));
  url.searchParams.set("longitude", camsAnchors.map((point) => point.lng).join(","));
  url.searchParams.set("hourly", "pm2_5"); url.searchParams.set("current", "pm2_5");
  url.searchParams.set("domains", "cams_global"); url.searchParams.set("timezone", "Asia/Bangkok"); url.searchParams.set("forecast_days", String(FORECAST_DAYS));
  return url;
}

function buildWeatherUrl(provinceId: unknown) {
  const province = getProvince(provinceId);
  const url = new URL(WEATHER_URL);
  url.searchParams.set("latitude", String(province.center.lat)); url.searchParams.set("longitude", String(province.center.lng));
  url.searchParams.set("daily", "wind_speed_10m_max,wind_direction_10m_dominant,precipitation_probability_max");
  url.searchParams.set("timezone", "Asia/Bangkok"); url.searchParams.set("forecast_days", String(FORECAST_DAYS + 1));
  return url;
}

function formatThaiDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00+07:00`);
  return {
    date: new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(date),
    weekday: new Intl.DateTimeFormat("th-TH", { weekday: "short", timeZone: "Asia/Bangkok" }).format(date).replace(".", ""),
    year: Number(new Intl.DateTimeFormat("th-TH-u-nu-latn", { year: "numeric", timeZone: "Asia/Bangkok" }).format(date)),
  };
}

function formatIssuedAt(timestamp: number) {
  return new Intl.DateTimeFormat("th-TH-u-nu-latn", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(timestamp)).replace(".", "");
}

function windDirectionLabel(degrees: number | null) {
  if (degrees === null || !Number.isFinite(degrees)) return "ไม่ทราบทิศ";
  const directions = ["เหนือ", "ตะวันออกเฉียงเหนือ", "ตะวันออก", "ตะวันออกเฉียงใต้", "ใต้", "ตะวันตกเฉียงใต้", "ตะวันตก", "ตะวันตกเฉียงเหนือ"];
  return directions[Math.round(degrees / 45) % 8];
}

function unavailableResponse(now: number, upstream: Record<"airbkk" | "air4thai" | "cams" | "weather", UpstreamStatus>, reasons: string[], rejectedStations: RejectedStations, provinceId: unknown) {
  const province = getProvince(provinceId);
  return Response.json({
    province: { id: province.id, nameTh: province.nameTh, shortNameTh: province.shortNameTh, nameEn: province.nameEn },
    dataMode: province.id === "bangkok" ? "airbkk-cams" : "cams-only",
    status: "unavailable" satisfies ForecastStatus,
    issuedAt: "ไม่พบข้อมูลล่าสุด",
    model: "AirBKK + CAMS forecast unavailable",
    disclaimer: "ไม่สามารถสร้างพยากรณ์ที่น่าเชื่อถือได้ ค่าบนแผนที่ถูกปิดไว้เพื่อป้องกันการเข้าใจผิด",
    sources: [...(province.id === "bangkok" ? ["AirBKK observations"] : []), "CAMS Global via Open-Meteo", "Open-Meteo Weather Forecast"],
    degradedReasons: reasons,
    dataQuality: { upstream, rejectedStations, qualityControl: "validation + freshness + deduplication + global MAD with local corroboration" },
    days: buildForecastDayShells(now), stations: [],
  }, { headers: { "Cache-Control": "no-store", "X-Forecast-Status": "unavailable" } });
}

export async function createForecastResponse(options: ForecastHandlerOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now?.() ?? Date.now();
  const timeouts = { ...DEFAULT_TIMEOUTS, ...options.timeouts };
  const province = getProvince(options.provinceId);
  const isBangkok = province.id === "bangkok";
  const [airResult, air4ThaiResult, camsResult, weatherResult] = await Promise.all([
    isBangkok ? requestJson(fetchImpl, AIRBKK_URL, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: "{}" }, timeouts.airbkk) : Promise.resolve({ status: "ok" as const }),
    requestJsonWithFallback(fetchImpl, AIR4THAI_URL, options.air4ThaiFallbackUrl, { headers: { Accept: "application/json" } }, timeouts.air4thai),
    requestJson(fetchImpl, buildCamsUrl(province.id), { headers: { Accept: "application/json" } }, timeouts.cams),
    requestJson(fetchImpl, buildWeatherUrl(province.id), { headers: { Accept: "application/json" } }, timeouts.weather),
  ]);
  const upstream = { airbkk: airResult.status, air4thai: air4ThaiResult.status, cams: camsResult.status, weather: weatherResult.status };
  const rejectedStations: RejectedStations = { stale: 0, invalid: 0, duplicate: 0, outlier: 0 };
  const airbkk = airResult.data as AirBkkResponse | undefined;
  const air4thai = air4ThaiResult.data as Air4ThaiResponse | undefined;
  const camsRaw = camsResult.data as CamsLocation[] | CamsLocation | undefined;
  const weather = weatherResult.data as WeatherResponse | undefined;
  if (isBangkok && airResult.status === "ok" && (airbkk?.status !== "Success" || !Array.isArray(airbkk.message))) upstream.airbkk = "error";
  if (air4ThaiResult.status === "ok" && !Array.isArray(air4thai?.stations)) upstream.air4thai = "error";
  const air4thaiRecords = upstream.air4thai === "ok" ? normalizeAir4ThaiRecords(air4thai, province.id) : [];
  const freshAir4thaiRecords = air4thaiRecords.filter((record) => {
    const timestamp = parseBangkokTimestamp(record.DateTime);
    return Number.isFinite(timestamp) && timestamp <= now + 3_600_000 && now - timestamp <= 6 * 3_600_000;
  });
  const airbkkRecords = isBangkok && upstream.airbkk === "ok" ? airbkk!.message : [];
  const observationRecords = isBangkok ? mergeObservationRecords(airbkkRecords, freshAir4thaiRecords) : freshAir4thaiRecords;
  const useDetailedStationBias = isBangkok && observationRecords.length >= 20;

  const camsLocations = camsRaw === undefined ? [] : (Array.isArray(camsRaw) ? camsRaw : [camsRaw]).filter((location) =>
    Number.isFinite(Number(location?.latitude)) && Number.isFinite(Number(location?.longitude)) &&
    Array.isArray(location?.hourly?.time) && Array.isArray(location?.hourly?.pm2_5) && location.hourly.time.length === location.hourly.pm2_5.length,
  );
  if (camsResult.status === "ok" && camsLocations.length < 3) upstream.cams = "error";
  const weatherAvailable = upstream.weather === "ok" && Array.isArray(weather?.daily?.time) && weather.daily.time.length > 0;
  if (upstream.weather === "ok" && !weatherAvailable) upstream.weather = "error";

  if (upstream.cams !== "ok") {
    return unavailableResponse(now, upstream, [
      ...(isBangkok && upstream.airbkk !== "ok" ? [`airbkk_${upstream.airbkk}`] : []),
      ...(upstream.cams !== "ok" ? [`cams_${upstream.cams}`] : []),
      ...(upstream.weather !== "ok" ? [`weather_${upstream.weather}`] : []),
    ], rejectedStations, province.id);
  }

  if (!useDetailedStationBias) {
    const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(now));
    const targetDates = Array.from({ length: FORECAST_DAYS }, (_, index) => addDays(today, index + 1));
    const anchorForecasts = camsLocations.map((location) => ({
      lat: Number(location.latitude), lng: Number(location.longitude),
      current: typeof location.current?.pm2_5 === "number" && Number.isFinite(location.current.pm2_5) ? location.current.pm2_5 : null,
      ...buildCamsDailyForecast({ current: location.current?.pm2_5 ?? null, hourly: location.hourly }, targetDates),
    }));
    anchorForecasts.forEach((anchor) => { if (anchor.current === null) anchor.current = anchor.values[0] ?? 0; });
    const air4BiasSamples = freshAir4thaiRecords.map((record) => {
      const modelCurrent = spatialIdw(Number(record.Lat), Number(record.Long), anchorForecasts.map((anchor) => ({
        lat: anchor.lat, lng: anchor.lng, value: anchor.current ?? 0,
      })));
      return calculateBiasCorrection(Number(record["PM2.5"]), modelCurrent);
    });
    const regionalBias = medianNumber(air4BiasSamples);
    const latestAir4Timestamp = freshAir4thaiRecords.length
      ? Math.max(...freshAir4thaiRecords.map((record) => parseBangkokTimestamp(record.DateTime)))
      : now;
    const air4ObservationAgeHours = Math.max(0, (now - latestAir4Timestamp) / 3_600_000);
    const hasAir4Bias = air4BiasSamples.length > 0;
    const coverageByDay = targetDates.map((_, index) => Math.min(...anchorForecasts.map((anchor) => anchor.coverage[index])));
    const weatherByDate = new Map((weatherAvailable ? weather!.daily.time : []).map((dateKey, index) => [dateKey, {
      windSpeed: weather!.daily.wind_speed_10m_max[index] ?? null,
      windDirection: weather!.daily.wind_direction_10m_dominant[index] ?? null,
      rainProbability: weather!.daily.precipitation_probability_max[index] ?? null,
    }]));
    const degradedReasons = [
      hasAir4Bias ? "air4thai_bias_correction" : "no_local_station_bias_correction",
      ...(isBangkok && upstream.airbkk !== "ok" ? [`airbkk_${upstream.airbkk}`] : []),
      ...(upstream.weather !== "ok" ? ["weather_unavailable"] : []),
      ...(coverageByDay.some((coverage) => coverage < 6) ? ["cams_partial_coverage"] : []),
    ];
    const uncertainty = [8, 10, 13, 17, 21, 26, 32];
    const sourceAvailability = (1 + (weatherAvailable ? 1 : 0)) / 2;
    const days: ForecastDay[] = targetDates.map((dateKey, index) => {
      const weatherDay = weatherByDate.get(dateKey);
      const score = calculateReliabilityScore({ leadDays: index + 1, sourceAvailability, camsCoverageHours: coverageByDay[index], observationAgeHours: hasAir4Bias ? air4ObservationAgeHours : 0 });
      return {
        lead: index + 1, ...formatThaiDate(dateKey), forecastReliabilityScore: score, confidence: score, uncertainty: uncertainty[index],
        wind: weatherDay ? `ลม${windDirectionLabel(weatherDay.windDirection)} สูงสุด ${weatherDay.windSpeed === null ? "—" : Math.round(weatherDay.windSpeed)} กม./ชม.` : "ไม่มีข้อมูลสภาพอากาศประกอบ",
        weather: weatherDay ? `โอกาสฝนสูงสุด ${weatherDay.rainProbability === null ? "—" : Math.round(weatherDay.rainProbability)}%` : "Weather source ไม่พร้อมใช้งาน",
        note: coverageByDay[index] >= 6 ? `CAMS มีข้อมูล ${coverageByDay[index]} ชั่วโมง; ${hasAir4Bias ? `ปรับ bias ด้วย Air4Thai ${air4BiasSamples.length} สถานี` : "ไม่มีการปรับด้วยสถานีท้องถิ่น"}` : "CAMS ครอบคลุมไม่ครบ จึง extrapolate และลดคะแนนความน่าเชื่อถือ",
        sourceMode: coverageByDay[index] >= 6 ? "cams" : "extrapolated", coverageHours: coverageByDay[index],
      };
    });
    const stations: ForecastStation[] = getProvincePoints(province.id).map((point) => ({
      id: point.id, district: point.label, label: point.label, lat: point.lat, lng: point.lng,
      values: targetDates.map((_, index) => {
        const value = spatialIdw(point.lat, point.lng, anchorForecasts.map((anchor) => ({ lat: anchor.lat, lng: anchor.lng, value: anchor.values[index] }))) ?? 0;
        const adjusted = value + regionalBias * Math.exp(-(((index + 1) * 24) + air4ObservationAgeHours) / 48);
        return Math.round(clamp(adjusted, 0, 500) * 10) / 10;
      }),
      sourceType: "CAMS model grid",
    }));
    return Response.json({
      province: { id: province.id, nameTh: province.nameTh, shortNameTh: province.shortNameTh, nameEn: province.nameEn },
      dataMode: hasAir4Bias ? "air4thai-cams" : "cams-only", status: "degraded" satisfies ForecastStatus, issuedAt: formatIssuedAt(hasAir4Bias ? latestAir4Timestamp : now),
      model: `CAMS Global model grid · ${province.nameEn} · ${hasAir4Bias ? "Air4Thai bias correction" : "no local bias correction"}`,
      disclaimer: `ค่าล่วงหน้าของ${province.nameTh}มาจากแบบจำลอง CAMS${hasAir4Bias ? "ที่ปรับด้วยค่าตรวจวัด Air4Thai ล่าสุด" : "โดยไม่มีการปรับด้วยสถานีตรวจวัดท้องถิ่น"} คะแนนความน่าเชื่อถือเป็น heuristic ไม่ใช่ probability หรือคำแนะนำสุขภาพทางการ`,
      sources: [...(hasAir4Bias ? ["Air4Thai PCD observations"] : []), "CAMS Global via Open-Meteo", "Open-Meteo Weather Forecast", isBangkok ? "BMA GIS district boundary" : "DMR province boundary"], degradedReasons,
      dataQuality: { upstream, acceptedStations: stations.length, air4thaiStations: freshAir4thaiRecords.length, regionalBias: Math.round(regionalBias * 10) / 10, camsMinimumCoverageHours: Math.min(...coverageByDay), camsCoverageHoursByDay: coverageByDay, weatherAvailable, qualityControl: hasAir4Bias ? "CAMS 9-point spatial grid with median Air4Thai bias correction" : "CAMS 9-point spatial grid without local station bias correction" },
      days, stations,
    }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=3600", "CDN-Cache-Control": "public, max-age=600, stale-while-revalidate=3600", "X-Forecast-Status": "degraded", "X-Province": province.id } });
  }

  const rawRecords = observationRecords.map((record) => ({
    record, id: String(record.MeasIndex || `${record.Lat},${record.Long}`), lat: Number(record.Lat), lng: Number(record.Long),
    pm25: Number(record["PM2.5"]), timestamp: parseBangkokTimestamp(record.DateTime),
  }));
  const valid = rawRecords.filter(isValidStation); rejectedStations.invalid = rawRecords.length - valid.length;
  const fresh = filterFreshStations(valid, now); rejectedStations.stale = fresh.rejected;
  const deduplicated = deduplicateStations(fresh.records); rejectedStations.duplicate = deduplicated.rejected;
  const outliers = filterOutliers(deduplicated.records); rejectedStations.outlier = outliers.rejected;
  const accepted = outliers.records;
  if (accepted.length < 20) {
    upstream.airbkk = "error";
    return unavailableResponse(now, upstream, ["insufficient_fresh_airbkk_stations"], rejectedStations, province.id);
  }

  const latestObservation = Math.max(...accepted.map((item) => item.timestamp));
  const latestRecord = accepted.find((item) => item.timestamp === latestObservation)!;
  const observationAgeHours = Math.max(0, (now - latestObservation) / 3_600_000);
  const observationDate = latestRecord.record.DateTime.slice(0, 10);
  const targetDates = Array.from({ length: FORECAST_DAYS }, (_, index) => addDays(observationDate, index + 1));
  const anchorForecasts = camsLocations.map((location) => ({
    lat: Number(location.latitude), lng: Number(location.longitude),
    current: typeof location.current?.pm2_5 === "number" && Number.isFinite(location.current.pm2_5) ? location.current.pm2_5 : null,
    ...buildCamsDailyForecast({ current: location.current?.pm2_5 ?? null, hourly: location.hourly }, targetDates),
  }));
  anchorForecasts.forEach((anchor) => { if (anchor.current === null) anchor.current = anchor.values[0] ?? 0; });
  const coverageByDay = targetDates.map((_, index) => Math.min(...anchorForecasts.map((anchor) => anchor.coverage[index])));
  const degradedReasons = [
    ...(upstream.airbkk !== "ok" ? [`airbkk_${upstream.airbkk}`] : []),
    ...(upstream.weather !== "ok" ? ["weather_unavailable"] : []),
    ...(coverageByDay.some((coverage) => coverage < 6) ? ["cams_partial_coverage"] : []),
    ...(observationAgeHours > 3 ? ["observations_older_than_3h"] : []),
  ];
  const status: ForecastStatus = degradedReasons.length ? "degraded" : "live";
  const weatherByDate = new Map((weatherAvailable ? weather!.daily.time : []).map((dateKey, index) => [dateKey, {
    windSpeed: weather!.daily.wind_speed_10m_max[index] ?? null,
    windDirection: weather!.daily.wind_direction_10m_dominant[index] ?? null,
    rainProbability: weather!.daily.precipitation_probability_max[index] ?? null,
  }]));
  const uncertainty = [6, 8, 11, 14, 18, 23, 29];
  const sourceAvailability = (2 + (weatherAvailable ? 1 : 0)) / 3;
  const days: ForecastDay[] = targetDates.map((dateKey, index) => {
    const weatherDay = weatherByDate.get(dateKey);
    const score = calculateReliabilityScore({ leadDays: index + 1, sourceAvailability, camsCoverageHours: coverageByDay[index], observationAgeHours });
    return {
      lead: index + 1, ...formatThaiDate(dateKey), forecastReliabilityScore: score, confidence: score, uncertainty: uncertainty[index],
      wind: weatherDay ? `ลม${windDirectionLabel(weatherDay.windDirection)} สูงสุด ${weatherDay.windSpeed === null ? "—" : Math.round(weatherDay.windSpeed)} กม./ชม.` : "ไม่มีข้อมูลสภาพอากาศประกอบ",
      weather: weatherDay ? `โอกาสฝนสูงสุด ${weatherDay.rainProbability === null ? "—" : Math.round(weatherDay.rainProbability)}%` : "Weather source ไม่พร้อมใช้งาน",
      note: coverageByDay[index] >= 6 ? `CAMS มีข้อมูล ${coverageByDay[index]} ชั่วโมง; ปรับ bias ด้วย ${upstream.airbkk === "ok" ? "AirBKK + Air4Thai" : "Air4Thai"} ล่าสุด` : "CAMS ครอบคลุมไม่ครบ จึง extrapolate และลดคะแนนความน่าเชื่อถือ",
      sourceMode: coverageByDay[index] >= 6 ? "cams" : "extrapolated", coverageHours: coverageByDay[index],
    };
  });
  const stations: ForecastStation[] = accepted.map(({ record, id, lat, lng, pm25, timestamp }) => {
    const modelCurrent = spatialIdw(lat, lng, anchorForecasts.map((anchor) => ({ lat: anchor.lat, lng: anchor.lng, value: anchor.current ?? 0 })));
    const bias = calculateBiasCorrection(pm25, modelCurrent);
    const stationAgeHours = Math.max(0, (now - timestamp) / 3_600_000);
    return {
      id, district: record.District.replace(/^เขต/, ""), label: record.Area?.trim() || record.District, lat, lng,
      values: targetDates.map((_, index) => {
        const camsValue = spatialIdw(lat, lng, anchorForecasts.map((anchor) => ({ lat: anchor.lat, lng: anchor.lng, value: anchor.values[index] }))) ?? 0;
        return Math.round(clamp(camsValue + bias * Math.exp(-(((index + 1) * 24) + stationAgeHours) / 48), 0, 500) * 10) / 10;
      }),
      observed: pm25, observedAt: record.DateTime, sourceType: record.Type,
    };
  });
  return Response.json({
    province: { id: province.id, nameTh: province.nameTh, shortNameTh: province.shortNameTh, nameEn: province.nameEn },
    dataMode: upstream.airbkk === "ok" ? "airbkk-air4thai-cams" : "air4thai-cams",
    status, issuedAt: formatIssuedAt(latestObservation),
    model: `${upstream.airbkk === "ok" ? "AirBKK + Air4Thai" : "Air4Thai"} + CAMS quality-controlled bias-corrected IDW`,
    disclaimer: `${upstream.airbkk === "ok" ? "AirBKK และ Air4Thai เป็นค่าตรวจวัด" : "Air4Thai เป็นค่าตรวจวัดสำรอง"} ส่วนค่าล่วงหน้าเป็น CAMS ที่ปรับ bias; คะแนนความน่าเชื่อถือเป็น heuristic ไม่ใช่ probability หรือคำแนะนำสุขภาพทางการ`,
    sources: [...(upstream.airbkk === "ok" ? ["AirBKK observations"] : []), ...(freshAir4thaiRecords.length ? ["Air4Thai PCD observations"] : []), "CAMS Global via Open-Meteo", "Open-Meteo Weather Forecast", "BMA GIS district boundary"], degradedReasons,
    dataQuality: {
      upstream, rawStations: observationRecords.length, airbkkStations: airbkkRecords.length, air4thaiStations: freshAir4thaiRecords.length, freshStations: fresh.records.length, deduplicatedStations: deduplicated.records.length,
      acceptedStations: stations.length, rejectedStations, latestObservation: latestRecord.record.DateTime,
      observationAgeHours: Math.round(observationAgeHours * 10) / 10, camsMinimumCoverageHours: Math.min(...coverageByDay),
      camsCoverageHoursByDay: coverageByDay, weatherAvailable, qualityControl: "validation + freshness + deduplication + global MAD with local corroboration",
    }, days, stations,
  }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=3600", "CDN-Cache-Control": "public, max-age=600, stale-while-revalidate=3600", "X-Forecast-Status": status } });
}

export async function createMetroForecastResponse(options: Omit<ForecastHandlerOptions, "provinceId"> = {}) {
  const fetchImpl = createDeduplicatedFetch(options.fetchImpl ?? fetch);
  const results = await Promise.allSettled(provinces.map(async (province) => {
    const response = await createForecastResponse({ ...options, fetchImpl, provinceId: province.id });
    if (!response.ok) throw new Error(`${province.id} forecast unavailable`);
    return response.json() as Promise<ForecastPayload>;
  }));
  const payloads = results
    .filter((result): result is PromiseFulfilledResult<ForecastPayload> => result.status === "fulfilled")
    .map((result) => result.value);
  if (!payloads.length) {
    return Response.json({ error: "metropolitan forecast unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "X-Forecast-Status": "unavailable" },
    });
  }
  const payload = aggregateMetroForecast(payloads);
  return Response.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=3600",
      "CDN-Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
      "X-Forecast-Status": payload.status,
      "X-Province": METRO_REGION_ID,
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isLocalPreview = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  const provinceId = url.searchParams.get("province");
  const options = {
    air4ThaiFallbackUrl: isLocalPreview ? `${url.origin}/__air4thai` : undefined,
  };
  return provinceId === METRO_REGION_ID
    ? createMetroForecastResponse(options)
    : createForecastResponse({ ...options, provinceId });
}
