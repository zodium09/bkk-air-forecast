import {
  aggregateMetroRain,
  buildRainDayShells,
  formatRainDate,
  getCorroboratedRainMm,
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
  getRainForecastMode,
  getRainForecastSource,
  getRainForecastContext,
  rainForecastProviders,
  tmdDailyRainProvider,
  tmdHybridRainProvider,
  type RainForecastMode,
  type RainForecastProviderLike,
  type RainForecastSource,
} from "../../lib/rain-forecast-provider.ts";
import {
  buildTmdDailyPointForecastUrls,
  buildTmdPointForecastUrls,
  combineTmdNwpPayloads,
  mergeTmdDailyRainForecast,
  mergeTmdRainForecast,
  type TmdNwpPayload,
} from "../../lib/tmd-nwp-provider.ts";

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

function meanProbability(values: number[]) {
  const value = mean(values);
  return value === null ? null : Math.round(value);
}

function mostCommon(values: number[]) {
  if (!values.length) return null;
  const counts = new Map<number, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
}

function windowLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}.00`;
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

  const daily: RainPointDay[] = raw.daily.time.slice(0, FORECAST_DAYS).map((dateKey, dayIndex) => {
    const dailyProbabilities = raw.hourly!.time
      .map((time, hourlyIndex) => time.startsWith(dateKey)
        ? finiteOrNull(raw.hourly!.precipitation_probability[hourlyIndex], 0, 100)
        : null)
      .filter((value): value is number => value !== null);
    return {
      pointProbabilityMax: finiteOrNull(raw.daily!.precipitation_probability_max[dayIndex], 0, 100),
      pointProbabilityMean: meanProbability(dailyProbabilities),
      rainMm: finiteOrNull(raw.daily!.precipitation_sum[dayIndex], 0, 1000),
      wetHours: finiteOrNull(raw.daily!.precipitation_hours[dayIndex], 0, 24),
      weatherCode: finiteOrNull(raw.daily!.weather_code[dayIndex], 0, 99),
    };
  });

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
        pointProbabilityPeak: probabilities.length ? Math.round(Math.max(...probabilities)) : null,
        rainMm: rainValues.length ? rounded(rainValues.reduce((sum, value) => sum + value, 0)) : null,
      });
    }
  });

  return { ...point, daily, windows };
}

function aggregateCity(points: RainPoint[], dateKeys: string[], requestedMode: RainForecastMode) {
  const windows: RainWindow[] = [];
  const days: RainDay[] = dateKeys.map((dateKey, dayIndex) => {
    const pointDays = points.map((point) => point.daily[dayIndex]).filter(Boolean);
    const rain = pointDays.map((day) => day.rainMm).filter((value): value is number => value !== null);
    const wetHours = pointDays.map((day) => day.wetHours).filter((value): value is number => value !== null);
    const weatherCodes = pointDays.map((day) => day.weatherCode).filter((value): value is number => value !== null);

    const dayWindows: RainWindow[] = Array.from({ length: 8 }, (_, windowIndex) => {
      const pointWindows = points
        .map((point) => point.windows.find((window) => window.dayIndex === dayIndex && window.windowIndex === windowIndex))
        .filter((window): window is RainPointWindow => Boolean(window));
      const windowProbability = pointWindows.map((window) => window.pointProbabilityPeak).filter((value): value is number => value !== null);
      const windowRain = pointWindows.map((window) => window.rainMm).filter((value): value is number => value !== null);
      const startHour = windowIndex * 3;
      return {
        dayIndex,
        windowIndex,
        start: `${String(startHour).padStart(2, "0")}:00`,
        end: `${String((startHour + 3) % 24).padStart(2, "0")}:00`,
        label: windowLabel(startHour),
        // A province summary must represent the sampled area, not the single
        // wettest grid point. Point-level probabilities remain available for
        // the map and selected-location chart.
        areaMeanProbabilityPeak: meanProbability(windowProbability),
        rainMeanMm: windowRain.length ? rounded(mean(windowRain) ?? 0) : null,
        rainMaxMm: windowRain.length ? rounded(Math.max(...windowRain)) : null,
      };
    });
    windows.push(...dayWindows);
    const peak = [...dayWindows]
      .filter((window) => window.rainMeanMm !== null || window.areaMeanProbabilityPeak !== null)
      .sort((a, b) => requestedMode === "chance"
        ? (b.areaMeanProbabilityPeak ?? -1) - (a.areaMeanProbabilityPeak ?? -1) || (b.rainMeanMm ?? -1) - (a.rainMeanMm ?? -1)
        : (b.rainMeanMm ?? -1) - (a.rainMeanMm ?? -1) || (b.areaMeanProbabilityPeak ?? -1) - (a.areaMeanProbabilityPeak ?? -1))[0];
    const formatted = formatRainDate(dateKey);
    const dailyProbabilities = pointDays
      .map((pointDay) => pointDay.pointProbabilityMax)
      .filter((value): value is number => value !== null);
    const rainMeanMm = rain.length ? rounded(mean(rain) ?? 0) : null;
    const corroboratedRainMm = getCorroboratedRainMm(points, dayIndex);
    return {
      lead: dayIndex + 1,
      dateKey,
      ...formatted,
      // A daily chance answers whether rain may occur at some time during the day:
      // take each point's provider-supplied daily maximum, then summarize space.
      dailyAreaMeanProbability: meanProbability(dailyProbabilities),
      dailyAreaMaxProbability: dailyProbabilities.length ? Math.max(...dailyProbabilities) : null,
      rainMeanMm,
      rainWatchMm: rain.length ? rounded(Math.max(rainMeanMm ?? 0, corroboratedRainMm ?? 0)) : null,
      rainMaxMm: rain.length ? rounded(Math.max(...rain)) : null,
      wetHours: wetHours.length ? rounded(mean(wetHours) ?? 0) : null,
      peakWindow: peak?.label ?? null,
      weatherCode: mostCommon(weatherCodes),
    };
  });
  return { days, windows };
}

function unavailableResponse(error: unknown, provinceId: unknown, requestedSource: RainForecastSource = "tmd", requestedMode: RainForecastMode = "chance") {
  const { province, points } = getRainForecastContext(provinceId);
  const horizonDays = requestedMode === "chance" && requestedSource === "tmd" ? 2 : FORECAST_DAYS;
  return Response.json({
    province: { id: province.id, nameTh: province.nameTh, shortNameTh: province.shortNameTh, nameEn: province.nameEn },
    status: "unavailable",
    fetchedAt: new Date().toISOString(),
    model: requestedSource === "tmd"
      ? requestedMode === "accumulation" ? "TMD NWP Daily 7 days" : "TMD NWP 0–48h + Open-Meteo probability"
      : "Open-Meteo Best Match / GFS",
    disclaimer: "ยังโหลดค่าพยากรณ์จากแบบจำลองไม่ได้ในขณะนี้ และไม่มีการสร้างค่าฝนสำรองขึ้นมา กรุณาลองใหม่ภายหลัง",
    sources: requestedSource === "tmd"
      ? [requestedMode === "accumulation" ? tmdDailyRainProvider.source : tmdHybridRainProvider.source, ...rainForecastProviders.map((provider) => provider.source)]
      : rainForecastProviders.map((provider) => provider.source),
    dataQuality: {
      expectedPoints: points.length,
      acceptedPoints: 0,
      coverageHours: 0,
      rejectedPoints: points.length,
      minimumHourlyCoverage: MINIMUM_HOURLY_COVERAGE,
      requestedMode,
      requestedSource,
      providersTried: rainForecastProviders.map((provider) => provider.id),
      error: error instanceof Error ? error.message : "unknown upstream error",
    },
    days: buildRainDayShells().slice(0, horizonDays),
    windows: [],
    points: [],
  }, {
    headers: { "Cache-Control": "no-store", "X-Rain-Forecast-Status": "unavailable" },
  });
}

type TmdIntegration = {
  status: "live" | "unavailable" | "not-configured";
  acceptedPoints?: number;
  forecastValues?: number;
  cadenceHours?: number | null;
  product?: "hourly-48h" | "daily-7d";
  failureReason?: string;
};

function tmdFailureReason(error: unknown) {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "timeout";
  const message = error instanceof Error ? error.message : String(error);
  const status = message.match(/status (\d{3})/)?.[1];
  if (status) return `http_${status}`;
  if (message.includes("insufficient TMD points")) return "insufficient_points";
  return "invalid_payload_or_network";
}

function normalizedResponse(
  raw: OpenMeteoLocation[] | OpenMeteoLocation,
  provider: RainForecastProviderLike,
  provinceId: unknown,
  deliveryFallback = false,
  tmdIntegration: TmdIntegration = { status: "not-configured" },
  requestedSource: RainForecastSource = "tmd",
  requestedMode: RainForecastMode = "chance",
) {
  const { province, points: forecastPoints } = getRainForecastContext(provinceId);
  const locations = Array.isArray(raw) ? raw : [raw];
  const points = locations
    .map((location, index) => aggregatePoint(location, index, forecastPoints))
    .filter((point): point is RainPoint => point !== null);
  if (points.length < 6) throw new Error(`insufficient forecast points ${points.length}/${forecastPoints.length}`);

  const dateKeys = locations.find((location) => location.daily)?.daily?.time.slice(0, FORECAST_DAYS);
  if (!dateKeys || dateKeys.length !== FORECAST_DAYS) throw new Error("missing seven-day forecast dates");
  const { days, windows } = aggregateCity(points, dateKeys, requestedMode);
  const horizonDays = requestedMode === "chance" && requestedSource === "tmd" ? 2 : FORECAST_DAYS;
  const coverageHours = Math.min(horizonDays * 24, ...points.map((point) => point.windows.filter((window) => window.dayIndex < horizonDays && window.rainMm !== null).length * 3));
  const status = points.length === forecastPoints.length ? "live" : "degraded";
  const model = requestedSource === "tmd" && tmdIntegration.status !== "live"
    ? `${provider.model} (temporary TMD fallback)`
    : provider.model;

  return Response.json({
    province: { id: province.id, nameTh: province.nameTh, shortNameTh: province.shortNameTh, nameEn: province.nameEn },
    status,
    fetchedAt: new Date().toISOString(),
    model: `${model} · 9 boundary-aware ${province.nameEn} samples`,
    disclaimer: requestedMode === "accumulation"
      ? "ปริมาณฝนสะสมเป็นค่ารวม 24 ชั่วโมงจากแบบจำลองรายวัน แต่ละพื้นที่อาจได้รับฝนต่างกัน และไม่ใช่ค่าตรวจวัดหรือประกาศเตือนภัย"
      : "โอกาสฝนรายวันใช้ค่าสูงสุดตามเวลาของแต่ละจุด แล้วเฉลี่ยจากจุดแบบจำลอง ส่วนไทม์ไลน์ 3 ชั่วโมงแสดงค่าเฉลี่ยจากจุดแบบจำลองของสัญญาณสูงสุดในช่วงนั้น และไม่ยืนยันว่าจะตกทุกแห่ง",
    sources: [provider.source, ...(provider.id.startsWith("tmd-nwp-") ? ["Open-Meteo Weather Forecast"] : []), province.id === "bangkok" ? "BMA GIS district boundary" : "DMR province boundary", "OpenStreetMap"],
    dataQuality: {
      expectedPoints: forecastPoints.length,
      acceptedPoints: points.length,
      coverageHours,
      rejectedPoints: forecastPoints.length - points.length,
      minimumHourlyCoverage: MINIMUM_HOURLY_COVERAGE,
      requestedMode,
      requestedSource,
      provider: provider.id,
      providerFallback: provider.id === rainForecastProviders[1].id
        || (requestedSource === "tmd" && tmdIntegration.status !== "live"),
      tmdStatus: tmdIntegration.status,
      tmdAcceptedPoints: tmdIntegration.acceptedPoints,
      tmdForecastValues: tmdIntegration.forecastValues,
      tmdCadenceHours: tmdIntegration.cadenceHours,
      tmdProduct: tmdIntegration.product,
      tmdFailureReason: tmdIntegration.failureReason,
      deliveryFallback,
    },
    days: days.slice(0, horizonDays),
    windows: windows.filter((window) => window.dayIndex < horizonDays),
    points: points.map((point) => ({
      ...point,
      daily: point.daily.slice(0, horizonDays),
      windows: point.windows.filter((window) => window.dayIndex < horizonDays),
    })),
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

export async function createRainForecastResponse(options: {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  provinceId?: unknown;
  tmdToken?: string | null;
  tmdBaseUrl?: string;
  forecastSource?: unknown;
  forecastMode?: unknown;
  now?: () => number;
} = {}) {
  const failures: string[] = [];
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 9_000;
  const { province } = getRainForecastContext(options.provinceId);
  const tmdToken = options.tmdToken === undefined ? process.env.TMD_NWP_TOKEN?.trim() : options.tmdToken?.trim();
  const forecastSource = getRainForecastSource(options.forecastSource);
  const forecastMode = getRainForecastMode(options.forecastMode);

  for (const provider of rainForecastProviders) {
    try {
      const response = await fetchWithTimeout(fetchImpl, buildRainForecastUrl(provider.url, province.id), {
        headers: { Accept: "application/json", "User-Agent": "BKK-Air-Forecast/1.0" },
      }, timeoutMs);
      if (!response.ok) throw new Error(`status ${response.status}`);
      let raw = await response.json() as OpenMeteoLocation[] | OpenMeteoLocation;
      let effectiveProvider: RainForecastProviderLike = provider;
      let tmdIntegration: TmdIntegration = {
        status: forecastSource === "tmd" && tmdToken ? "unavailable" : "not-configured",
      };
      if (forecastSource === "tmd" && tmdToken) {
        try {
          const tmdUrls = forecastMode === "accumulation"
            ? buildTmdDailyPointForecastUrls(province.id, options.tmdBaseUrl, "rain", 7)
            : buildTmdPointForecastUrls(province.id, options.tmdBaseUrl, "rain,cond", 48);
          const tmdPayloads = await Promise.all(tmdUrls.map(async (tmdUrl) => {
            const tmdResponse = await fetchWithTimeout(fetchImpl, tmdUrl, {
              headers: { Accept: "application/json", Authorization: `Bearer ${tmdToken}`, "User-Agent": "BKK-Air-Forecast/1.0" },
            }, timeoutMs);
            if (!tmdResponse.ok) throw new Error(`status ${tmdResponse.status}`);
            return tmdResponse.json() as Promise<TmdNwpPayload>;
          }));
          const tmdPayload = combineTmdNwpPayloads(tmdPayloads);
          const merged = forecastMode === "accumulation"
            ? mergeTmdDailyRainForecast(raw, tmdPayload, province.id)
            : mergeTmdRainForecast(raw, tmdPayload, province.id);
          if (merged.acceptedPoints < 6) throw new Error(`insufficient TMD points ${merged.acceptedPoints}`);
          raw = merged.locations;
          effectiveProvider = forecastMode === "accumulation" ? tmdDailyRainProvider : tmdHybridRainProvider;
          tmdIntegration = {
            status: "live",
            acceptedPoints: merged.acceptedPoints,
            forecastValues: merged.forecastValues,
            cadenceHours: "cadenceHours" in merged && typeof merged.cadenceHours === "number"
              ? merged.cadenceHours
              : null,
            product: forecastMode === "accumulation" ? "daily-7d" : "hourly-48h",
          };
        } catch (error) {
          failures.push(`tmd-nwp: ${error instanceof Error ? error.message : "unknown error"}`);
          tmdIntegration = { status: "unavailable", failureReason: tmdFailureReason(error) };
        }
      }
      return normalizedResponse(raw, effectiveProvider, province.id, false, tmdIntegration, forecastSource, forecastMode);
    } catch (error) {
      failures.push(`${provider.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  return unavailableResponse(new Error(failures.join("; ")), province.id, forecastSource, forecastMode);
}

export async function createMetroRainForecastResponse(options: {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  tmdToken?: string | null;
  tmdBaseUrl?: string;
  forecastSource?: unknown;
  forecastMode?: unknown;
} = {}) {
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
  const searchParams = new URL(request.url).searchParams;
  const provinceId = searchParams.get("province");
  const forecastSource = getRainForecastSource(searchParams.get("source"));
  const forecastMode = getRainForecastMode(searchParams.get("mode"));
  return provinceId === METRO_REGION_ID
    ? createMetroRainForecastResponse({ forecastSource, forecastMode })
    : createRainForecastResponse({ provinceId, forecastSource, forecastMode });
}
export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 500_000) throw new Error("fallback payload too large");
    const body = await request.json() as { provider?: unknown; province?: unknown; mode?: unknown; raw?: unknown };
    const provider = getRainForecastProvider(body.provider);
    if (!provider || !body.raw || typeof body.raw !== "object") throw new Error("invalid fallback payload");
    return normalizedResponse(body.raw as OpenMeteoLocation[] | OpenMeteoLocation, provider, body.province, true, { status: "not-configured" }, "open-meteo", getRainForecastMode(body.mode));
  } catch (error) {
    return unavailableResponse(error, null, "open-meteo");
  }
}
