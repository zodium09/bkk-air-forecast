import { FORECAST_DAYS } from "./forecast-horizon.ts";
import { DEFAULT_PROVINCE_ID, getProvince, getProvincePoints, type ProvinceId } from "./provinces.ts";

export const rainForecastProviders = [
  { id: "best-match", url: "https://api.open-meteo.com/v1/forecast", model: "Open-Meteo Best Match", source: "Open-Meteo Weather Forecast" },
  { id: "gfs", url: "https://api.open-meteo.com/v1/gfs", model: "Open-Meteo GFS Seamless", source: "Open-Meteo GFS Forecast" },
] as const;

export const rainForecastSources = ["tmd", "open-meteo"] as const;
export type RainForecastSource = (typeof rainForecastSources)[number];
export const DEFAULT_RAIN_FORECAST_SOURCE: RainForecastSource = "tmd";

export const rainForecastModes = ["chance", "accumulation"] as const;
export type RainForecastMode = (typeof rainForecastModes)[number];
export const DEFAULT_RAIN_FORECAST_MODE: RainForecastMode = "chance";

export type RainForecastProvider = (typeof rainForecastProviders)[number];
export type RainForecastProviderLike = { id: string; url: string; model: string; source: string };
export type RainForecastProviderId = RainForecastProvider["id"];

export const tmdHybridRainProvider: RainForecastProviderLike = {
  id: "tmd-nwp-hybrid",
  url: "https://data.tmd.go.th/nwpapi/v1/forecast/location/hourly/at",
  model: "TMD NWP 3 km (0–48h) + Open-Meteo (days 3–7)",
  source: "กรมอุตุนิยมวิทยา (TMD NWP)",
};

export const tmdDailyRainProvider: RainForecastProviderLike = {
  id: "tmd-nwp-daily",
  url: "https://data.tmd.go.th/nwpapi/v1/forecast/location/daily/at",
  model: "TMD NWP Daily (7 days)",
  source: "กรมอุตุนิยมวิทยา (TMD NWP Daily)",
};

export const rainForecastPoints = getProvincePoints(DEFAULT_PROVINCE_ID);

export function buildRainForecastUrl(baseUrl: string = rainForecastProviders[0].url, provinceId: ProvinceId = DEFAULT_PROVINCE_ID) {
  const points = getProvincePoints(provinceId);
  const url = new URL(baseUrl);
  url.searchParams.set("latitude", points.map((point) => point.lat).join(","));
  url.searchParams.set("longitude", points.map((point) => point.lng).join(","));
  url.searchParams.set("hourly", "precipitation_probability,precipitation,rain,showers,weather_code");
  url.searchParams.set("daily", "precipitation_sum,precipitation_probability_max,precipitation_hours,weather_code");
  url.searchParams.set("timezone", "Asia/Bangkok");
  url.searchParams.set("forecast_days", String(FORECAST_DAYS));
  return url;
}

export function getRainForecastContext(value: unknown) {
  const province = getProvince(value);
  return { province, points: getProvincePoints(province.id) };
}

export function getRainForecastProvider(id: unknown) {
  return rainForecastProviders.find((provider) => provider.id === id) ?? null;
}

export function getRainForecastSource(value: unknown): RainForecastSource {
  return rainForecastSources.find((source) => source === value) ?? DEFAULT_RAIN_FORECAST_SOURCE;
}

export function getRainForecastMode(value: unknown): RainForecastMode {
  return rainForecastModes.find((mode) => mode === value) ?? DEFAULT_RAIN_FORECAST_MODE;
}
