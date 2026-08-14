import {
  buildRainDayShells,
  formatRainDate,
  type RainDay,
  type RainPoint,
  type RainPointDay,
  type RainPointWindow,
  type RainWindow,
} from "../../lib/rain-forecast-data";

const forecastProviders = [
  {
    id: "best-match",
    url: "https://api.open-meteo.com/v1/forecast",
    model: "Open-Meteo Best Match · 9-point Bangkok grid",
    source: "Open-Meteo Weather Forecast",
  },
  {
    id: "gfs",
    url: "https://api.open-meteo.com/v1/gfs",
    model: "Open-Meteo GFS Seamless · 9-point Bangkok grid",
    source: "Open-Meteo GFS Forecast",
  },
] as const;
const FORECAST_DAYS = 5;
const EXPECTED_HOURLY_VALUES = FORECAST_DAYS * 24;
const MINIMUM_HOURLY_COVERAGE = 0.8;

const forecastPoints = [
  { id: "southwest", label: "ตะวันตกเฉียงใต้", lat: 13.64, lng: 100.34 },
  { id: "south", label: "ตอนใต้", lat: 13.64, lng: 100.60 },
  { id: "southeast", label: "ตะวันออกเฉียงใต้", lat: 13.64, lng: 100.88 },
  { id: "west", label: "ฝั่งตะวันตก", lat: 13.80, lng: 100.34 },
  { id: "center", label: "ใจกลางกรุงเทพฯ", lat: 13.80, lng: 100.60 },
  { id: "east", label: "ฝั่งตะวันออก", lat: 13.80, lng: 100.88 },
  { id: "northwest", label: "ตะวันตกเฉียงเหนือ", lat: 13.96, lng: 100.34 },
  { id: "north", label: "ตอนเหนือ", lat: 13.96, lng: 100.60 },
  { id: "northeast", label: "ตะวันออกเฉียงเหนือ", lat: 13.96, lng: 100.88 },
];

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

function buildForecastUrl(baseUrl = forecastProviders[0].url) {
  const url = new URL(baseUrl);
  url.searchParams.set("latitude", forecastPoints.map((point) => point.lat).join(","));
  url.searchParams.set("longitude", forecastPoints.map((point) => point.lng).join(","));
  url.searchParams.set("hourly", "precipitation_probability,precipitation,rain,showers,weather_code");
  url.searchParams.set("daily", "precipitation_sum,precipitation_probability_max,precipitation_hours,weather_code");
  url.searchParams.set("timezone", "Asia/Bangkok");
  url.searchParams.set("forecast_days", String(FORECAST_DAYS));
  return url;
}

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

function aggregatePoint(raw: OpenMeteoLocation, index: number): RainPoint | null {
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

function unavailableResponse(error: unknown) {
  return Response.json({
    status: "unavailable",
    fetchedAt: new Date().toISOString(),
    model: "Open-Meteo Best Match / GFS",
    disclaimer: "ยังโหลดค่าพยากรณ์จากแบบจำลองไม่ได้ในขณะนี้ และไม่มีการสร้างค่าฝนสำรองขึ้นมา กรุณาลองใหม่ภายหลัง",
    sources: forecastProviders.map((provider) => provider.source),
    dataQuality: {
      expectedPoints: forecastPoints.length,
      acceptedPoints: 0,
      coverageHours: 0,
      rejectedPoints: forecastPoints.length,
      minimumHourlyCoverage: MINIMUM_HOURLY_COVERAGE,
      providersTried: forecastProviders.map((provider) => provider.id),
      error: error instanceof Error ? error.message : "unknown upstream error",
    },
    days: buildRainDayShells(),
    windows: [],
    points: [],
  }, {
    headers: { "Cache-Control": "no-store", "X-Rain-Forecast-Status": "unavailable" },
  });
}

export async function GET() {
  const failures: string[] = [];

  for (const provider of forecastProviders) {
    try {
      const response = await fetch(buildForecastUrl(provider.url), {
        headers: { Accept: "application/json", "User-Agent": "BKK-Air-Forecast/1.0" },
        signal: AbortSignal.timeout(9_000),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const raw = await response.json() as OpenMeteoLocation[] | OpenMeteoLocation;
      const locations = Array.isArray(raw) ? raw : [raw];
      const points = locations
        .map((location, index) => aggregatePoint(location, index))
        .filter((point): point is RainPoint => point !== null);
      if (points.length < 6) throw new Error(`insufficient forecast points ${points.length}/${forecastPoints.length}`);

      const dateKeys = locations.find((location) => location.daily)?.daily?.time.slice(0, FORECAST_DAYS);
      if (!dateKeys || dateKeys.length !== FORECAST_DAYS) throw new Error("missing five-day forecast dates");
      const { days, windows } = aggregateCity(points, dateKeys);
      const coverageHours = Math.min(...points.map((point) => point.windows.filter((window) => window.rainMm !== null).length * 3));
      const status = points.length === forecastPoints.length ? "live" : "degraded";

      return Response.json({
        status,
        fetchedAt: new Date().toISOString(),
        model: provider.model,
        disclaimer: "ข้อมูลพยากรณ์จริงจากแบบจำลองอากาศ ไม่ใช่เรดาร์ฝนหรือประกาศเตือนภัย โอกาสฝนและปริมาณฝนเป็นคนละตัวชี้วัด และความละเอียดไม่เท่าการพยากรณ์รายเขต",
        sources: [provider.source, "BMA GIS district boundary", "OpenStreetMap"],
        dataQuality: {
          expectedPoints: forecastPoints.length,
          acceptedPoints: points.length,
          coverageHours,
          rejectedPoints: forecastPoints.length - points.length,
          minimumHourlyCoverage: MINIMUM_HOURLY_COVERAGE,
          provider: provider.id,
          providerFallback: provider.id !== forecastProviders[0].id,
        },
        days,
        windows,
        points,
      }, {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=1800, stale-while-revalidate=7200",
          "X-Rain-Forecast-Status": status,
          "X-Rain-Forecast-Provider": provider.id,
        },
      });
    } catch (error) {
      failures.push(`${provider.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  return unavailableResponse(new Error(failures.join("; ")));
}
