import {
  aggregateMetroHeat,
  buildHeatDayShells,
  calculateHeatIndexC,
  formatHeatDate,
  type HeatDay,
  type HeatForecastPayload,
  type HeatPoint,
  type HeatPointDay,
} from "../../lib/heat-forecast-data.ts";
import { FORECAST_DAYS } from "../../lib/forecast-horizon.ts";
import { fetchWithTimeout } from "../../lib/fetch-with-timeout.ts";
import {
  buildHeatForecastUrl,
  getHeatForecastContext,
  heatForecastProviders,
  tmdHybridHeatProvider,
  type HeatForecastProviderLike,
} from "../../lib/heat-forecast-provider.ts";
import { METRO_REGION_ID, provinces } from "../../lib/provinces.ts";
import { buildTmdPointForecastUrls, mergeTmdHeatForecast, type TmdNwpPayload } from "../../lib/tmd-nwp-provider.ts";

const EXPECTED_HOURLY_VALUES = FORECAST_DAYS * 24;
const MINIMUM_HOURLY_COVERAGE = 0.8;

type OpenMeteoHeatLocation = {
  latitude: number;
  longitude: number;
  hourly?: {
    time: string[];
    temperature_2m: Array<number | null>;
    relative_humidity_2m: Array<number | null>;
  };
};

function finite(value: unknown, minimum: number, maximum: number) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

function mean(values: number[]) {
  return values.length ? rounded(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function aggregatePoint(raw: OpenMeteoHeatLocation, index: number, forecastPoints: ReturnType<typeof getHeatForecastContext>["points"], dateKeys: string[]): HeatPoint | null {
  const point = forecastPoints[index];
  if (!point || !raw.hourly) return null;
  const length = Math.min(raw.hourly.time.length, raw.hourly.temperature_2m.length, raw.hourly.relative_humidity_2m.length);
  const validCount = Array.from({ length: Math.min(length, EXPECTED_HOURLY_VALUES) }, (_, hour) => {
    const temperature = finite(raw.hourly!.temperature_2m[hour], -20, 60);
    const humidity = finite(raw.hourly!.relative_humidity_2m[hour], 0, 100);
    return temperature !== null && humidity !== null;
  }).filter(Boolean).length;
  if (validCount < Math.ceil(EXPECTED_HOURLY_VALUES * MINIMUM_HOURLY_COVERAGE)) return null;

  const daily: HeatPointDay[] = dateKeys.map((dateKey) => {
    const values = raw.hourly!.time.slice(0, length).map((time, hour) => {
      if (!time.startsWith(dateKey)) return null;
      const temperature = finite(raw.hourly!.temperature_2m[hour], -20, 60);
      const humidity = finite(raw.hourly!.relative_humidity_2m[hour], 0, 100);
      if (temperature === null || humidity === null) return null;
      return { temperature, heatIndex: calculateHeatIndexC(temperature, humidity), time };
    }).filter((item): item is { temperature: number; heatIndex: number; time: string } => item !== null && item.heatIndex !== null);
    if (!values.length) return { maxTemperatureC: null, maxHeatIndexC: null, peakHour: null };
    const hottest = [...values].sort((a, b) => b.heatIndex - a.heatIndex)[0];
    return {
      maxTemperatureC: rounded(Math.max(...values.map((item) => item.temperature))),
      maxHeatIndexC: rounded(hottest.heatIndex),
      peakHour: `${hottest.time.slice(11, 16)} น.`,
    };
  });
  return { ...point, daily };
}

function aggregateRegion(points: HeatPoint[], dateKeys: string[]): HeatDay[] {
  return dateKeys.map((dateKey, dayIndex) => {
    const values = points.map((point) => point.daily[dayIndex]).filter(Boolean);
    const temperatures = values.map((day) => day.maxTemperatureC).filter((value): value is number => value !== null);
    const heatIndices = values.map((day) => day.maxHeatIndexC).filter((value): value is number => value !== null);
    const hottest = [...values].sort((a, b) => (b.maxHeatIndexC ?? -999) - (a.maxHeatIndexC ?? -999))[0];
    return {
      lead: dayIndex + 1,
      dateKey,
      ...formatHeatDate(dateKey),
      maxTemperatureC: mean(temperatures),
      maxHeatIndexC: mean(heatIndices),
      pointMaxTemperatureC: temperatures.length ? rounded(Math.max(...temperatures)) : null,
      pointMaxHeatIndexC: heatIndices.length ? rounded(Math.max(...heatIndices)) : null,
      peakHour: hottest?.peakHour ?? null,
    };
  });
}

function tmdFailureReason(error: unknown) {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "timeout";
  const message = error instanceof Error ? error.message : String(error);
  const status = message.match(/status (\d{3})/)?.[1];
  if (status) return `http_${status}`;
  if (message.includes("insufficient TMD points")) return "insufficient_points";
  return "invalid_payload_or_network";
}

function unavailableResponse(error: unknown, provinceId: unknown) {
  const { province, points } = getHeatForecastContext(provinceId);
  return Response.json({
    province: { id: province.id, nameTh: province.nameTh, shortNameTh: province.shortNameTh, nameEn: province.nameEn },
    status: "unavailable",
    fetchedAt: new Date().toISOString(),
    model: "TMD NWP / Open-Meteo",
    disclaimer: "ยังโหลดข้อมูลอุณหภูมิและความชื้นจากแบบจำลองไม่ได้ในขณะนี้ ระบบไม่สร้างค่าจำลองสำรองขึ้นมา กรุณาลองใหม่ภายหลัง",
    sources: heatForecastProviders.map((provider) => provider.source),
    dataQuality: { expectedPoints: points.length, acceptedPoints: 0, coverageHours: 0, rejectedPoints: points.length, minimumHourlyCoverage: MINIMUM_HOURLY_COVERAGE, providersTried: heatForecastProviders.map((provider) => provider.id), error: error instanceof Error ? error.message : "unknown upstream error" },
    days: buildHeatDayShells(),
    points: [],
  }, { headers: { "Cache-Control": "no-store", "X-Heat-Forecast-Status": "unavailable" } });
}

function normalizedResponse(raw: OpenMeteoHeatLocation[] | OpenMeteoHeatLocation, provider: HeatForecastProviderLike, provinceId: unknown, tmdIntegration: { status: "live" | "unavailable" | "not-configured"; acceptedPoints?: number; forecastValues?: number; failureReason?: string }) {
  const { province, points: forecastPoints } = getHeatForecastContext(provinceId);
  const locations = Array.isArray(raw) ? raw : [raw];
  const dateKeys = locations.find((location) => location.hourly)?.hourly?.time
    .map((time) => time.slice(0, 10))
    .filter((date, index, values) => values.indexOf(date) === index)
    .slice(0, FORECAST_DAYS);
  if (!dateKeys || dateKeys.length !== FORECAST_DAYS) throw new Error("missing seven-day forecast dates");
  const points = locations.map((location, index) => aggregatePoint(location, index, forecastPoints, dateKeys)).filter((point): point is HeatPoint => point !== null);
  if (points.length < 6) throw new Error(`insufficient forecast points ${points.length}/${forecastPoints.length}`);
  const status = points.length === forecastPoints.length ? "live" : "degraded";
  return Response.json({
    province: { id: province.id, nameTh: province.nameTh, shortNameTh: province.shortNameTh, nameEn: province.nameEn },
    status,
    fetchedAt: new Date().toISOString(),
    model: `${provider.model} · 9-point ${province.nameEn} grid`,
    disclaimer: "Heat Index คำนวณจากอุณหภูมิและความชื้นสัมพัทธ์รายชั่วโมงด้วยสมการ Rothfusz ของ NOAA/NWS และจัดระดับตามเกณฑ์กรมอนามัย ใช้เพื่อวางแผนเบื้องต้น ไม่ใช่ประกาศเตือนภัย",
    sources: [provider.source, ...(provider.id === "tmd-nwp-hybrid" ? ["Open-Meteo Weather Forecast"] : []), "NOAA/NWS Heat Index equation", "กรมอนามัย กระทรวงสาธารณสุข", province.id === "bangkok" ? "BMA GIS district boundary" : "DMR province boundary", "OpenStreetMap"],
    dataQuality: { expectedPoints: forecastPoints.length, acceptedPoints: points.length, rejectedPoints: forecastPoints.length - points.length, coverageHours: Math.min(...points.map((point) => point.daily.filter((day) => day.maxHeatIndexC !== null).length * 24)), minimumHourlyCoverage: MINIMUM_HOURLY_COVERAGE, provider: provider.id, providerFallback: provider.id === "gfs" || tmdIntegration.status === "unavailable", tmdStatus: tmdIntegration.status, tmdAcceptedPoints: tmdIntegration.acceptedPoints, tmdForecastValues: tmdIntegration.forecastValues, tmdFailureReason: tmdIntegration.failureReason },
    days: aggregateRegion(points, dateKeys),
    points,
  } satisfies HeatForecastPayload, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=7200", "CDN-Cache-Control": "public, max-age=1800, stale-while-revalidate=7200", "X-Heat-Forecast-Status": status, "X-Heat-Forecast-Provider": provider.id },
  });
}

export async function createHeatForecastResponse(options: { fetchImpl?: typeof fetch; timeoutMs?: number; provinceId?: unknown; tmdToken?: string | null; tmdBaseUrl?: string } = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 9_000;
  const { province } = getHeatForecastContext(options.provinceId);
  const tmdToken = options.tmdToken === undefined ? process.env.TMD_NWP_TOKEN?.trim() : options.tmdToken?.trim();
  const failures: string[] = [];

  for (const provider of heatForecastProviders) {
    try {
      const response = await fetchWithTimeout(fetchImpl, buildHeatForecastUrl(provider.url, province.id), { headers: { Accept: "application/json", "User-Agent": "BKK-Air-Forecast/1.0" } }, timeoutMs);
      if (!response.ok) throw new Error(`status ${response.status}`);
      let raw = await response.json() as OpenMeteoHeatLocation[] | OpenMeteoHeatLocation;
      let effectiveProvider: HeatForecastProviderLike = provider;
      let tmdIntegration: { status: "live" | "unavailable" | "not-configured"; acceptedPoints?: number; forecastValues?: number; failureReason?: string } = { status: tmdToken ? "unavailable" : "not-configured" };
      if (tmdToken) {
        try {
          const tmdPayloads = await Promise.all(buildTmdPointForecastUrls(province.id, options.tmdBaseUrl, "tc,rh", 48).map(async (url) => {
            const tmdResponse = await fetchWithTimeout(fetchImpl, url, { headers: { Accept: "application/json", Authorization: `Bearer ${tmdToken}`, "User-Agent": "BKK-Air-Forecast/1.0" } }, timeoutMs);
            if (!tmdResponse.ok) throw new Error(`status ${tmdResponse.status}`);
            return tmdResponse.json() as Promise<TmdNwpPayload>;
          }));
          const merged = mergeTmdHeatForecast(raw, { WeatherForecasts: tmdPayloads.flatMap((payload) => Array.isArray(payload.WeatherForecasts) ? payload.WeatherForecasts : []) }, province.id);
          if (merged.acceptedPoints < 6) throw new Error(`insufficient TMD points ${merged.acceptedPoints}`);
          raw = merged.locations;
          effectiveProvider = tmdHybridHeatProvider;
          tmdIntegration = { status: "live", acceptedPoints: merged.acceptedPoints, forecastValues: merged.forecastValues };
        } catch (error) {
          failures.push(`tmd-nwp: ${error instanceof Error ? error.message : "unknown error"}`);
          tmdIntegration = { status: "unavailable", failureReason: tmdFailureReason(error) };
        }
      }
      return normalizedResponse(raw, effectiveProvider, province.id, tmdIntegration);
    } catch (error) {
      failures.push(`${provider.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
  return unavailableResponse(new Error(failures.join("; ")), province.id);
}

export async function createMetroHeatForecastResponse(options: { fetchImpl?: typeof fetch; timeoutMs?: number; tmdToken?: string | null; tmdBaseUrl?: string } = {}) {
  const payloads = await Promise.all(provinces.map(async (province) => (await createHeatForecastResponse({ ...options, provinceId: province.id })).json() as Promise<HeatForecastPayload>));
  const payload = aggregateMetroHeat(payloads);
  return Response.json(payload, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=7200", "CDN-Cache-Control": "public, max-age=1800, stale-while-revalidate=7200", "X-Heat-Forecast-Status": payload.status, "X-Province": METRO_REGION_ID } });
}

export async function GET(request: Request) {
  const provinceId = new URL(request.url).searchParams.get("province");
  return provinceId === METRO_REGION_ID ? createMetroHeatForecastResponse() : createHeatForecastResponse({ provinceId });
}
