import { FORECAST_DAYS } from "./forecast-horizon.ts";
import { DEFAULT_PROVINCE_ID, getProvince, getProvincePoints, type ProvinceId } from "./provinces.ts";

export const heatForecastProviders = [
  { id: "best-match", url: "https://api.open-meteo.com/v1/forecast", model: "Open-Meteo Best Match", source: "Open-Meteo Weather Forecast" },
  { id: "gfs", url: "https://api.open-meteo.com/v1/gfs", model: "Open-Meteo GFS Seamless", source: "Open-Meteo GFS Forecast" },
] as const;

export type HeatForecastProviderLike = { id: string; url: string; model: string; source: string };

export const tmdHybridHeatProvider: HeatForecastProviderLike = {
  id: "tmd-nwp-hybrid",
  url: "https://data.tmd.go.th/nwpapi/v1/forecast/location/hourly/at",
  model: "TMD NWP 3 km (0–48h) + Open-Meteo extended range",
  source: "กรมอุตุนิยมวิทยา (TMD NWP)",
};

export function buildHeatForecastUrl(baseUrl: string = heatForecastProviders[0].url, provinceId: ProvinceId = DEFAULT_PROVINCE_ID) {
  const points = getProvincePoints(provinceId);
  const url = new URL(baseUrl);
  url.searchParams.set("latitude", points.map((point) => point.lat).join(","));
  url.searchParams.set("longitude", points.map((point) => point.lng).join(","));
  url.searchParams.set("hourly", "temperature_2m,relative_humidity_2m");
  url.searchParams.set("timezone", "Asia/Bangkok");
  url.searchParams.set("forecast_days", String(FORECAST_DAYS));
  return url;
}

export function getHeatForecastContext(value: unknown) {
  const province = getProvince(value);
  return { province, points: getProvincePoints(province.id) };
}
