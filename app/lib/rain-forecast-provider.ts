export const rainForecastProviders = [
  { id: "best-match", url: "https://api.open-meteo.com/v1/forecast", model: "Open-Meteo Best Match · 9-point Bangkok grid", source: "Open-Meteo Weather Forecast" },
  { id: "gfs", url: "https://api.open-meteo.com/v1/gfs", model: "Open-Meteo GFS Seamless · 9-point Bangkok grid", source: "Open-Meteo GFS Forecast" },
] as const;

export type RainForecastProvider = (typeof rainForecastProviders)[number];
export type RainForecastProviderId = RainForecastProvider["id"];

export const rainForecastPoints = [
  { id: "southwest", label: "ตะวันตกเฉียงใต้", lat: 13.64, lng: 100.34 },
  { id: "south", label: "ตอนใต้", lat: 13.64, lng: 100.60 },
  { id: "southeast", label: "ตะวันออกเฉียงใต้", lat: 13.64, lng: 100.88 },
  { id: "west", label: "ฝั่งตะวันตก", lat: 13.80, lng: 100.34 },
  { id: "center", label: "ใจกลางกรุงเทพฯ", lat: 13.80, lng: 100.60 },
  { id: "east", label: "ฝั่งตะวันออก", lat: 13.80, lng: 100.88 },
  { id: "northwest", label: "ตะวันตกเฉียงเหนือ", lat: 13.96, lng: 100.34 },
  { id: "north", label: "ตอนเหนือ", lat: 13.96, lng: 100.60 },
  { id: "northeast", label: "ตะวันออกเฉียงเหนือ", lat: 13.96, lng: 100.88 },
] as const;

export function buildRainForecastUrl(baseUrl: string = rainForecastProviders[0].url) {
  const url = new URL(baseUrl);
  url.searchParams.set("latitude", rainForecastPoints.map((point) => point.lat).join(","));
  url.searchParams.set("longitude", rainForecastPoints.map((point) => point.lng).join(","));
  url.searchParams.set("hourly", "precipitation_probability,precipitation,rain,showers,weather_code");
  url.searchParams.set("daily", "precipitation_sum,precipitation_probability_max,precipitation_hours,weather_code");
  url.searchParams.set("timezone", "Asia/Bangkok");
  url.searchParams.set("forecast_days", "5");
  return url;
}

export function getRainForecastProvider(id: unknown) {
  return rainForecastProviders.find((provider) => provider.id === id) ?? null;
}
