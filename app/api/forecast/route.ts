import { buildForecastDayShells, type ForecastDay, type ForecastStation, type ForecastStatus, type UpstreamStatus } from "../../lib/forecast-data.ts";
import { buildCamsDailyForecast, calculateBiasCorrection, calculateReliabilityScore, clamp } from "../../lib/forecast/forecast-model.ts";
import { spatialIdw } from "../../lib/forecast/interpolation.ts";
import { deduplicateStations, filterFreshStations, filterOutliers, isValidStation, type RejectedStations } from "../../lib/forecast/quality-control.ts";
import { addDays, parseBangkokTimestamp } from "../../lib/forecast/timestamps.ts";

const AIRBKK_URL = "https://official.airbkk.com/airbkk/Api";
const CAMS_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_TIMEOUTS = { airbkk: 9_000, cams: 9_000, weather: 7_000 } as const;

const camsAnchors = [
  { lat: 13.64, lng: 100.34 }, { lat: 13.64, lng: 100.60 }, { lat: 13.64, lng: 100.88 },
  { lat: 13.80, lng: 100.34 }, { lat: 13.80, lng: 100.60 }, { lat: 13.80, lng: 100.88 },
  { lat: 13.96, lng: 100.34 }, { lat: 13.96, lng: 100.60 }, { lat: 13.96, lng: 100.88 },
];

type AirBkkRecord = { MeasIndex: string; District: string; Area: string; Lat: string; Long: string; DateTime: string; Type: string; "PM2.5": number | string | null };
type AirBkkResponse = { status: string; message: AirBkkRecord[] };
type CamsLocation = { latitude: number; longitude: number; current?: { time: string; pm2_5: number | null }; hourly: { time: string[]; pm2_5: Array<number | null> } };
type WeatherResponse = { daily: { time: string[]; wind_speed_10m_max: Array<number | null>; wind_direction_10m_dominant: Array<number | null>; precipitation_probability_max: Array<number | null> } };
type SourceResult = { status: UpstreamStatus; data?: unknown };
export type ForecastHandlerOptions = { fetchImpl?: typeof fetch; now?: () => number; timeouts?: Partial<typeof DEFAULT_TIMEOUTS> };

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

function buildCamsUrl() {
  const url = new URL(CAMS_URL);
  url.searchParams.set("latitude", camsAnchors.map((point) => point.lat).join(","));
  url.searchParams.set("longitude", camsAnchors.map((point) => point.lng).join(","));
  url.searchParams.set("hourly", "pm2_5"); url.searchParams.set("current", "pm2_5");
  url.searchParams.set("domains", "cams_global"); url.searchParams.set("timezone", "Asia/Bangkok"); url.searchParams.set("forecast_days", "7");
  return url;
}

function buildWeatherUrl() {
  const url = new URL(WEATHER_URL);
  url.searchParams.set("latitude", "13.7563"); url.searchParams.set("longitude", "100.5018");
  url.searchParams.set("daily", "wind_speed_10m_max,wind_direction_10m_dominant,precipitation_probability_max");
  url.searchParams.set("timezone", "Asia/Bangkok"); url.searchParams.set("forecast_days", "7");
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

function unavailableResponse(now: number, upstream: Record<"airbkk" | "cams" | "weather", UpstreamStatus>, reasons: string[], rejectedStations: RejectedStations) {
  return Response.json({
    status: "unavailable" satisfies ForecastStatus,
    issuedAt: "ไม่พบข้อมูลล่าสุด",
    model: "AirBKK + CAMS forecast unavailable",
    disclaimer: "ไม่สามารถสร้างพยากรณ์ที่น่าเชื่อถือได้ ค่าบนแผนที่ถูกปิดไว้เพื่อป้องกันการเข้าใจผิด",
    sources: ["AirBKK observations", "CAMS Global via Open-Meteo", "Open-Meteo Weather Forecast"],
    degradedReasons: reasons,
    dataQuality: { upstream, rejectedStations, qualityControl: "validation + freshness + deduplication + global MAD with local corroboration" },
    days: buildForecastDayShells(now), stations: [],
  }, { headers: { "Cache-Control": "no-store", "X-Forecast-Status": "unavailable" } });
}

export async function createForecastResponse(options: ForecastHandlerOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now?.() ?? Date.now();
  const timeouts = { ...DEFAULT_TIMEOUTS, ...options.timeouts };
  const [airResult, camsResult, weatherResult] = await Promise.all([
    requestJson(fetchImpl, AIRBKK_URL, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: "{}" }, timeouts.airbkk),
    requestJson(fetchImpl, buildCamsUrl(), { headers: { Accept: "application/json" } }, timeouts.cams),
    requestJson(fetchImpl, buildWeatherUrl(), { headers: { Accept: "application/json" } }, timeouts.weather),
  ]);
  const upstream = { airbkk: airResult.status, cams: camsResult.status, weather: weatherResult.status };
  const rejectedStations: RejectedStations = { stale: 0, invalid: 0, duplicate: 0, outlier: 0 };
  const airbkk = airResult.data as AirBkkResponse | undefined;
  const camsRaw = camsResult.data as CamsLocation[] | CamsLocation | undefined;
  const weather = weatherResult.data as WeatherResponse | undefined;
  if (airResult.status === "ok" && (airbkk?.status !== "Success" || !Array.isArray(airbkk.message))) upstream.airbkk = "error";

  const camsLocations = camsRaw === undefined ? [] : (Array.isArray(camsRaw) ? camsRaw : [camsRaw]).filter((location) =>
    Number.isFinite(Number(location?.latitude)) && Number.isFinite(Number(location?.longitude)) &&
    Array.isArray(location?.hourly?.time) && Array.isArray(location?.hourly?.pm2_5) && location.hourly.time.length === location.hourly.pm2_5.length,
  );
  if (camsResult.status === "ok" && camsLocations.length < 3) upstream.cams = "error";
  const weatherAvailable = upstream.weather === "ok" && Array.isArray(weather?.daily?.time) && weather.daily.time.length > 0;
  if (upstream.weather === "ok" && !weatherAvailable) upstream.weather = "error";

  if (upstream.airbkk !== "ok" || upstream.cams !== "ok") {
    return unavailableResponse(now, upstream, [
      ...(upstream.airbkk !== "ok" ? [`airbkk_${upstream.airbkk}`] : []),
      ...(upstream.cams !== "ok" ? [`cams_${upstream.cams}`] : []),
      ...(upstream.weather !== "ok" ? [`weather_${upstream.weather}`] : []),
    ], rejectedStations);
  }

  const rawRecords = airbkk!.message.map((record) => ({
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
    return unavailableResponse(now, upstream, ["insufficient_fresh_airbkk_stations"], rejectedStations);
  }

  const latestObservation = Math.max(...accepted.map((item) => item.timestamp));
  const latestRecord = accepted.find((item) => item.timestamp === latestObservation)!;
  const observationAgeHours = Math.max(0, (now - latestObservation) / 3_600_000);
  const observationDate = latestRecord.record.DateTime.slice(0, 10);
  const targetDates = Array.from({ length: 5 }, (_, index) => addDays(observationDate, index + 1));
  const anchorForecasts = camsLocations.map((location) => ({
    lat: Number(location.latitude), lng: Number(location.longitude),
    current: typeof location.current?.pm2_5 === "number" && Number.isFinite(location.current.pm2_5) ? location.current.pm2_5 : null,
    ...buildCamsDailyForecast({ current: location.current?.pm2_5 ?? null, hourly: location.hourly }, targetDates),
  }));
  anchorForecasts.forEach((anchor) => { if (anchor.current === null) anchor.current = anchor.values[0] ?? 0; });
  const coverageByDay = targetDates.map((_, index) => Math.min(...anchorForecasts.map((anchor) => anchor.coverage[index])));
  const degradedReasons = [
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
  const uncertainty = [6, 8, 11, 14, 18];
  const sourceAvailability = (2 + (weatherAvailable ? 1 : 0)) / 3;
  const days: ForecastDay[] = targetDates.map((dateKey, index) => {
    const weatherDay = weatherByDate.get(dateKey);
    const score = calculateReliabilityScore({ leadDays: index + 1, sourceAvailability, camsCoverageHours: coverageByDay[index], observationAgeHours });
    return {
      lead: index + 1, ...formatThaiDate(dateKey), forecastReliabilityScore: score, confidence: score, uncertainty: uncertainty[index],
      wind: weatherDay ? `ลม${windDirectionLabel(weatherDay.windDirection)} สูงสุด ${weatherDay.windSpeed === null ? "—" : Math.round(weatherDay.windSpeed)} กม./ชม.` : "ไม่มีข้อมูลสภาพอากาศประกอบ",
      weather: weatherDay ? `โอกาสฝนสูงสุด ${weatherDay.rainProbability === null ? "—" : Math.round(weatherDay.rainProbability)}%` : "Weather source ไม่พร้อมใช้งาน",
      note: coverageByDay[index] >= 6 ? `CAMS มีข้อมูล ${coverageByDay[index]} ชั่วโมง; ปรับ bias ด้วย AirBKK ล่าสุด` : "CAMS ครอบคลุมไม่ครบ จึง extrapolate และลดคะแนนความน่าเชื่อถือ",
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
    status, issuedAt: formatIssuedAt(latestObservation), model: "AirBKK + CAMS quality-controlled bias-corrected IDW baseline 0.4",
    disclaimer: "AirBKK เป็นค่าตรวจวัด ส่วนค่าล่วงหน้าเป็น CAMS ที่ปรับ bias; คะแนนความน่าเชื่อถือเป็น heuristic ไม่ใช่ probability หรือคำแนะนำสุขภาพทางการ",
    sources: ["AirBKK observations", "CAMS Global via Open-Meteo", "Open-Meteo Weather Forecast", "BMA GIS district boundary"], degradedReasons,
    dataQuality: {
      upstream, rawStations: airbkk!.message.length, freshStations: fresh.records.length, deduplicatedStations: deduplicated.records.length,
      acceptedStations: stations.length, rejectedStations, latestObservation: latestRecord.record.DateTime,
      observationAgeHours: Math.round(observationAgeHours * 10) / 10, camsMinimumCoverageHours: Math.min(...coverageByDay),
      camsCoverageHoursByDay: coverageByDay, weatherAvailable, qualityControl: "validation + freshness + deduplication + global MAD with local corroboration",
    }, days, stations,
  }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600", "X-Forecast-Status": status } });
}

export async function GET() { return createForecastResponse(); }
