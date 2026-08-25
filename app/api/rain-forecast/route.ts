import {
  aggregateMetroRain,
  buildRainDayShells,
  formatRainDate,
  type RainDay,
  type RainPoint,
  type RainPointDay,
  type RainPointWindow,
  type RainWindow,
  type RainForecastPayload,
} from "../../lib/rain-forecast-data.ts";
import { FORECAST_DAYS } from "../../lib/forecast-horizon.ts";
import { METRO_REGION_ID, provinces } from "../../lib/provinces.ts";
import { fetchWithTimeout } from "../../lib/fetch-with-timeout.ts";
import {
  buildRainForecastUrl,
  getRainForecastProvider,
  getRainForecastContext,
  rainForecastProviders,
  type RainForecastProvider,
} from "../../lib/rain-forecast-provider.ts";

const EXPECTED_HOURLY_VALUES = FORECAST_DAYS * 24;
const MINIMUM_HOURLY_COVERAGE = 0.8;

type OpenMeteoLocation = {
  latitude: number;
  longitude: number;
  hourly?: {
    time: string[];
    precipitation_probability: Array<number | null>;
    precipitation: Array<number | null>;
    rain: Array<number | null>;
    showers: Array<number | null>;
    weather_code: Array<number | null>;
  };
  daily?: {
    time: string[];
    precipitation_sum: Array<number | null>;
    precipitation_probability_max: Array<number | null>;
    precipitation_hours: Array<number | null>;
    weather_code: Array<number | null>;
  };
};

function finiteOrNull(value: number | null | undefined, minimum = 0, maximum = Number.POSITIVE_INFINITY) {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum ? value : null;
}

function rounded(value: number, digits = 1) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function mostCommon(values: number[]) {
  if (!values.length) return null;
  const counts = new Map<number, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
}

function windowLabel(hour: number) {
  const end = (hour + 3) % 24;
  return `${String(hour).padStart(2, "0")}:00–${String(end).padStart(2, "0")}:00 น.`;
}

function aggregatePoint(raw: OpenMeteoLocation, index: number, forecastPoints: ReturnType<typeof getRainForecastContext>["points"]): RainPoint | null {
  const point = forecastPoints[index];
  if (!point || !raw.hourly || !raw.daily || raw.daily.time.length < FORECAST_DAYS) return null;
  const hourlyLength = Math.min(
    raw.hourly.time.length,
    raw.hourly.precipitation_probability.length,
    raw.hourly.precipitation.length,
  );
  if (hourlyLength < EXPECTED_HOURLY_VALUES) return null;
  const usableHourlyValues = raw.hourly.precipitation
    .slice(0, EXPECTED_HOURLY_VALUES)
    .filter((value) => finiteOrNull(value, 0, 300) !== null).length;
  const usableProbabilityValues = raw.hourly.precipitation_probability
    .slice(0, EXPECTED_HOURLY_VALUES)
    .filter((value) => finiteOrNull(value, 0, 100) !== null).length;
  const minimumRequiredValues = Math.ceil(EXPECTED_HOURLY_VALUES * MINIMUM_HOURLY_COVERAGE);
  if (usableHourlyValues < minimumRequiredValues || usableProbabilityValues < minimumRequiredValues) return null;

  const daily: RainPointDay[] = raw.daily.time.slice(0, FORECAST_DAYS).map((_, dayIndex) => ({
    probabilityMax: finiteOrNull(raw.daily!.precipitation_probability_max[dayIndex], 0, 100),
    rainMm: finiteOrNull(raw.daily!.precipitation_sum[dayIndex], 0, 1000),
    wetHours: finiteOrNull(raw.daily!.precipitation_hours[dayIndex], 0, 24),
    weatherCode: finiteOrNull(raw.daily!.weather_code[dayIndex], 0, 99),
  }));

  const windows: RainPointWindow[] = [];
  raw.daily.time.slice(0, FORECAST_DAYS).forEach((dateKey, dayIndex) => {
    for (let windowIndex = 0; windowIndex < 8; windowIndex += 1) {
      const hourStart = windowIndex * 3;
      const indices: number[] = [];
      for (let hourOffset = 0; hourOffset < 3; hourOffset += 1) {
        const target = `${dateKey}T${String(hourStart + hourOffset).padStart(2, "0")}:00`;
        const hourlyIndex = raw.hourly!.time.indexOf(target);
        if (hourlyIndex >= 0 && hourlyIndex < hourlyLength) indices.push(hourlyIndex);
      }
      const probabilities = indices
        .map((hourlyIndex) => finiteOrNull(raw.hourly!.precipitation_probability[hourlyIndex], 0, 100))
        .filter((value): value is number => value !== null);
      const rainValues = indices
        .map((hourlyIndex) => finiteOrNull(raw.hourly!.precipitation[hourlyIndex], 0, 300))
        .filter((value): value is number => value !== null);
      windows.push({
        dayIndex,
        windowIndex,
        probabilityMax: probabilities.length ? Math.round(Math.max(...probabilities)) : null,
        rainMm: rainValues.length ? rounded(rainValues.reduce((sum, value) => sum + value, 0)) : null,
      });
    }
  });

  return { ...point, daily, windows };
}

function aggregateCity(points: RainPoint[], dateKeys: string[]) {
  const windows: RainWindow[] = [];
  const days: RainDay[] = dateKeys.map((dateKey, dayIndex) => {
    const pointDays = points.map((point) => point.daily[dayIndex]).filter(Boolean);
    const probabilities = pointDays.map((day) => day.probabilityMax).filter((value): value is number => value !== null);
    const rain = pointDays.map((day) => day.rainMm).filter((value): value is number => value !== null);
    const wetHours = pointDays.map((day) => day.wetHours).filter((value): value is number => value !== null);
    const weatherCodes = pointDays.map((day) => day.weatherCode).filter((value): value is number => value !== null);

    const dayWindows: RainWindow[] = Array.from({ length: 8 }, (_, windowIndex) => {
      const pointWindows = points
        .map((point) => point.windows.find((window) => window.dayIndex === dayIndex && window.windowIndex === windowIndex))
        .filter((window): window is RainPointWindow => Boolean(window));
      const windowProbability = pointWindows.map((window) => window.probabilityMax).filter((value): value is number => value !== null);
      const windowRain = pointWindows.map((window) => window.rainMm).filter((value): value is number => value !== null);
      const startHour = windowIndex * 3;
      return {
        dayIndex,
        windowIndex,
        start: `${String(startHour).padStart(2, "0")}:00`,
        end: `${String((startHour + 3) % 24).padStart(2, "0")}:00`,
        label: windowLabel(startHour),
        probabilityMax: windowProbability.length ? Math.round(Math.max(...windowProbability)) : null,
        rainMeanMm: windowRain.length ? rounded(mean(windowRain) ?? 0) : null,
        rainMaxMm: windowRain.length ? rounded(Math.max(...windowRain)) : null,
      };
    });
    windows.push(...dayWindows);
    const peak = [...dayWindows]
      .filter((window) => window.rainMeanMm !== null)
      .sort((a, b) => (b.rainMeanMm ?? 0) - (a.rainMeanMm ?? 0) || (b.probabilityMax ?? 0) - (a.probabilityMax ?? 0))[0];
    const formatted = formatRainDate(dateKey);
    return {
      lead: dayIndex + 1,
      dateKey,
      ...formatted,
      probabilityMax: probabilities.length ? Math.round(Math.max(...probabilities)) : null,
      rainMeanMm: rain.length ? rounded(mean(rain) ?? 0) : null,
      rainMaxMm: rain.length ? rounded(Math.max(...rain)) : null,
      wetHours: wetHours.length ? rounded(mean(wetHours) ?? 0) : null,
      peakWindow: peak?.label ?? null,
      weatherCode: mostCommon(weatherCodes),
    };
  });
  return { days, windows };
}

function unavailableResponse(error: unknown, provinceId: unknown) {
  const { province, points } = getRainForecastContext(provinceId);
  return Response.json({
    province: { id: province.id, nameTh: province.nameTh, shortNameTh: province.shortNameTh, nameEn: province.nameEn },
    status: "unavailable",
    fetchedAt: new Date().toISOString(),
    model: "Open-Meteo Best Match / GFS",
    disclaimer: "ยังโหลดค่าพยากรณ์จากแบบจำลองไม่ได้ในขณะนี้ และไม่มีการสร้างค่าฝนสำรองขึ้นมา กรุณาลองใหม่ภายหลัง",
    sources: rainForecastProviders.map((provider) => provider.source),
    dataQuality: {
      expectedPoints: points.length,
      acceptedPoints: 0,
      coverageHours: 0,
      rejectedPoints: points.length,
      minimumHourlyCoverage: MINIMUM_HOURLY_COVERAGE,
      providersTried: rainForecastProviders.map((provider) => provider.id),
      error: error instanceof Error ? error.message : "unknown upstream error",
    },
    days: buildRainDayShells(),
    windows: [],
    points: [],
  }, {
    headers: { "Cache-Control": "no-store", "X-Rain-Forecast-Status": "unavailable" },
  });
}

function normalizedResponse(raw: OpenMeteoLocation[] | OpenMeteoLocation, provider: RainForecastProvider, provinceId: unknown, deliveryFallback = false) {
  const { province, points: forecastPoints } = getRainForecastContext(provinceId);
  const locations = Array.isArray(raw) ? raw : [raw];
  const points = locations
    .map((location, index) => aggregatePoint(location, index, forecastPoints))
    .filter((point): point is RainPoint => point !== null);
  if (points.length < 6) throw new Error(`insufficient forecast points ${points.length}/${forecastPoints.length}`);

  const dateKeys = locations.find((location) => location.daily)?.daily?.time.slice(0, FORECAST_DAYS);
  if (!dateKeys || dateKeys.length !== FORECAST_DAYS) throw new Error("missing seven-day forecast dates");
  const { days, windows } = aggregateCity(points, dateKeys);
  const coverageHours = Math.min(...points.map((point) => point.windows.filter((window) => window.rainMm !== null).length * 3));
  const status = points.length === forecastPoints.length ? "live" : "degraded";

  return Response.json({
    province: { id: province.id, nameTh: province.nameTh, shortNameTh: province.shortNameTh, nameEn: province.nameEn },
    status,
    fetchedAt: new Date().toISOString(),
    model: `${provider.model} · 9-point ${province.nameEn} grid`,
    disclaimer: "ข้อมูลพยากรณ์จริงจากแบบจำลองอากาศ ไม่ใช่เรดาร์ฝนหรือประกาศเตือนภัย โอกาสฝนและปริมาณฝนเป็นคนละตัวชี้วัด และความละเอียดไม่เท่าการพยากรณ์รายเขต",
    sources: [provider.source, province.id === "bangkok" ? "BMA GIS district boundary" : "DMR province boundary", "OpenStreetMap"],
    dataQuality: {
      expectedPoints: forecastPoints.length,
      acceptedPoints: points.length,
      coverageHours,
      rejectedPoints: forecastPoints.length - points.length,
      minimumHourlyCoverage: MINIMUM_HOURLY_COVERAGE,
      provider: provider.id,
      providerFallback: provider.id !== rainForecastProviders[0].id,
      deliveryFallback,
    },
    days,
    windows,
    points,
  }, {
    headers: deliveryFallback ? {
      "Cache-Control": "no-store",
      "X-Rain-Forecast-Status": status,
      "X-Rain-Forecast-Provider": provider.id,
      "X-Rain-Forecast-Delivery": "browser-fallback",
    } : {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=7200",
      "CDN-Cache-Control": "public, max-age=1800, stale-while-revalidate=7200",
      "X-Rain-Forecast-Status": status,
      "X-Rain-Forecast-Provider": provider.id,
    },
  });
}

export async function createRainForecastResponse(options: { fetchImpl?: typeof fetch; timeoutMs?: number; provinceId?: unknown } = {}) {
  const failures: string[] = [];
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 9_000;
  const { province } = getRainForecastContext(options.provinceId);

  for (const provider of rainForecastProviders) {
    try {
      const response = await fetchWithTimeout(fetchImpl, buildRainForecastUrl(provider.url, province.id), {
        headers: { Accept: "application/json", "User-Agent": "BKK-Air-Forecast/1.0" },
      }, timeoutMs);
      if (!response.ok) throw new Error(`status ${response.status}`);
      const raw = await response.json() as OpenMeteoLocation[] | OpenMeteoLocation;
      return normalizedResponse(raw, provider, province.id);
    } catch (error) {
      failures.push(`${provider.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  return unavailableResponse(new Error(failures.join("; ")), province.id);
}

export async function createMetroRainForecastResponse(options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}) {
  const results = await Promise.allSettled(provinces.map(async (province) => {
    const response = await createRainForecastResponse({ ...options, provinceId: province.id });
    if (!response.ok) throw new Error(`${province.id} rain forecast unavailable`);
    return response.json() as Promise<RainForecastPayload>;
  }));
  const payloads = results
    .filter((result): result is PromiseFulfilledResult<RainForecastPayload> => result.status === "fulfilled")
    .map((result) => result.value);
  if (!payloads.length) {
    return Response.json({ error: "metropolitan rain forecast unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "X-Rain-Forecast-Status": "unavailable" },
    });
  }
  const payload = aggregateMetroRain(payloads);
  return Response.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=7200",
      "CDN-Cache-Control": "public, max-age=1800, stale-while-revalidate=7200",
      "X-Rain-Forecast-Status": payload.status,
      "X-Province": METRO_REGION_ID,
    },
  });
}

export async function GET(request: Request) {
  const provinceId = new URL(request.url).searchParams.get("province");
  return provinceId === METRO_REGION_ID
    ? createMetroRainForecastResponse()
    : createRainForecastResponse({ provinceId });
}
export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 500_000) throw new Error("fallback payload too large");
    const body = await request.json() as { provider?: unknown; province?: unknown; raw?: unknown };
    const provider = getRainForecastProvider(body.provider);
    if (!provider || !body.raw || typeof body.raw !== "object") throw new Error("invalid fallback payload");
    return normalizedResponse(body.raw as OpenMeteoLocation[] | OpenMeteoLocation, provider, body.province, true);
  } catch (error) {
    return unavailableResponse(error, null);
  }
}
