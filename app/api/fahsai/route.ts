export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import {
  buildFallbackPayload,
  buildSyntheticTide24h,
  calculateHeatIndexC,
  calculateUsAqiFromPm25,
  computeAreaIntelligence,
  getBangkokHour,
  THAILAND_AREAS,
  toTmdRainAreaPercent,
  windDirectionThai,
  type AreaForecast,
  type FahSaiPayload,
  type HourlyPoint,
} from "../../lib/fahsai-data";

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedPayload: FahSaiPayload | null = null;
let cachedAtMs = 0;
let inFlightRequest: Promise<FahSaiPayload> | null = null;

async function fetchWithTimeout(url: string, timeoutMs = 4800): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLiveFahSaiPayload(): Promise<FahSaiPayload> {
  const batch1 = THAILAND_AREAS.slice(0, 39);
  const batch2 = THAILAND_AREAS.slice(39);
  const coastalAreas = THAILAND_AREAS.filter((a) => a.isCoastal);

  const buildUrls = (batch: typeof THAILAND_AREAS) => {
    const lats = batch.map((a) => a.lat.toFixed(4)).join(",");
    const lngs = batch.map((a) => a.lng.toFixed(4)).join(",");
    return {
      weatherUrl: `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation,pressure_msl,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,cloud_cover&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max,precipitation_sum,uv_index_max&timezone=Asia%2FBangkok&forecast_days=7`,
      airUrl: `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lngs}&current=pm2_5,us_aqi,uv_index&hourly=pm2_5&timezone=Asia%2FBangkok&forecast_days=7`,
    };
  };

  const coastalLats = coastalAreas.map((a) => a.lat.toFixed(4)).join(",");
  const coastalLngs = coastalAreas.map((a) => a.lng.toFixed(4)).join(",");
  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${coastalLats}&longitude=${coastalLngs}&current=wave_height,wave_period&hourly=wave_height&daily=wave_height_max&timezone=Asia%2FBangkok&forecast_days=7`;

  const u1 = buildUrls(batch1);
  const u2 = buildUrls(batch2);

  const [wRes1, aRes1, wRes2, aRes2, mRes] = await Promise.all([
    fetchWithTimeout(u1.weatherUrl),
    fetchWithTimeout(u1.airUrl),
    fetchWithTimeout(u2.weatherUrl),
    fetchWithTimeout(u2.airUrl),
    fetchWithTimeout(marineUrl, 3800).catch(() => null),
  ]);

  if (!wRes1.ok || !aRes1.ok || !wRes2.ok || !aRes2.ok) {
    return buildFallbackPayload();
  }

  const [wJson1, aJson1, wJson2, aJson2, mJson] = await Promise.all([
    wRes1.json(),
    aRes1.json(),
    wRes2.json(),
    aRes2.json(),
    mRes && mRes.ok ? mRes.json().catch(() => null) : Promise.resolve(null),
  ]);

  const weatherList = [
    ...(Array.isArray(wJson1) ? wJson1 : [wJson1]),
    ...(Array.isArray(wJson2) ? wJson2 : [wJson2]),
  ];
  const airList = [
    ...(Array.isArray(aJson1) ? aJson1 : [aJson1]),
    ...(Array.isArray(aJson2) ? aJson2 : [aJson2]),
  ];
  const marineList = mJson ? (Array.isArray(mJson) ? mJson : [mJson]) : [];
  const marineByAreaId = new Map<string, (typeof marineList)[number]>();
  coastalAreas.forEach((cArea, cIdx) => {
    if (marineList[cIdx]) {
      marineByAreaId.set(cArea.id, marineList[cIdx]);
    }
  });

  const fallback = buildFallbackPayload();
  const dayNames = ["วันนี้", "พรุ่งนี้", "มะรืน", "วันที่ 4", "วันที่ 5", "วันที่ 6", "วันที่ 7"];
  const nowHour = getBangkokHour();

  const areas: AreaForecast[] = THAILAND_AREAS.map((meta, idx) => {
    const w = weatherList[idx];
    const a = airList[idx];
    const m = marineByAreaId.get(meta.id);
    const fb = fallback.areas[idx];
    if (!w?.current) return fb;

    const tide = buildSyntheticTide24h(meta.tideAmp, meta.tidePhase, 0);
    const tempC = Number((w.current.temperature_2m ?? fb.current.tempC).toFixed(1));
    const humidity = Math.round(w.current.relative_humidity_2m ?? fb.current.humidity);
    const feelsLikeC = Number(
      (w.current.apparent_temperature ?? calculateHeatIndexC(tempC, humidity)).toFixed(1)
    );
    const dewPointC =
      typeof w.current.dew_point_2m === "number"
        ? Number(w.current.dew_point_2m.toFixed(1))
        : undefined;
    const pressureHpa =
      typeof w.current.pressure_msl === "number"
        ? Number(w.current.pressure_msl.toFixed(1))
        : undefined;
    const visibilityKm =
      typeof w.current.visibility === "number"
        ? Number((w.current.visibility / 1000).toFixed(1))
        : undefined;
    const windKmh = Number((w.current.wind_speed_10m ?? fb.current.windKmh).toFixed(1));
    const windGustKmh = Number((w.current.wind_gusts_10m ?? windKmh * 1.35).toFixed(1));
    const windDeg = Math.round(w.current.wind_direction_10m ?? 45);
    const pm25 = Number((a?.current?.pm2_5 ?? fb.current.pm25).toFixed(1));
    const aqi = Math.round(a?.current?.us_aqi ?? calculateUsAqiFromPm25(pm25));
    const uvIndex = Number((a?.current?.uv_index ?? w?.daily?.uv_index_max?.[0] ?? fb.current.uvIndex).toFixed(1));
    const minMorningC = Number((w?.daily?.temperature_2m_min?.[0] ?? fb.current.minMorningC).toFixed(1));
    const maxAfternoonC = Number((w?.daily?.temperature_2m_max?.[0] ?? fb.current.maxAfternoonC).toFixed(1));
    const rainProb = toTmdRainAreaPercent(w?.daily?.precipitation_probability_max?.[0] ?? fb.current.rainProb);
    const rain24hMm = Number((w?.daily?.precipitation_sum?.[0] ?? fb.current.rain24hMm).toFixed(1));
    const currentRainRateMm = Number((w?.current?.precipitation ?? 0).toFixed(2));

    const waveHeightM = meta.isCoastal
      ? Number(
          (
            m?.current?.wave_height ??
            Math.max(0.2, meta.baseWaveM + (windKmh - 12) * 0.025)
          ).toFixed(2)
        )
      : 0;
    const wavePeriodS = meta.isCoastal
      ? Number((m?.current?.wave_period ?? 5.2 + waveHeightM * 1.8).toFixed(1))
      : 0;

    const curTide = tide.hourlyTide[nowHour] ?? tide.hourlyTide[14] ?? 0;
    const nextTide = tide.hourlyTide[(nowHour + 1) % 24] ?? curTide;

    const intel = computeAreaIntelligence({
      meta,
      tempC,
      feelsLikeC,
      minMorningC,
      maxAfternoonC,
      humidity,
      rainProb,
      rain24hMm,
      pm25,
      aqi,
      uvIndex,
      windKmh,
      windGustKmh,
      windDeg,
      curTide,
      nextTide,
      highTideMsl: tide.highTideMsl,
      highTideTime: tide.highTideTime,
      lowTideMsl: tide.lowTideMsl,
      lowTideTime: tide.lowTideTime,
      waveHeightM,
      wavePeriodS,
      pressureHpa,
      visibilityKm,
      dewPointC,
      cloudCoverPct: w.current.cloud_cover,
      rainRateMmHr: currentRainRateMm,
    });

    const daily = dayNames.map((dayLabel, d) => {
      const dRainProb = toTmdRainAreaPercent(
        w?.daily?.precipitation_probability_max?.[d] ?? fb.daily[d].rainProb
      );
      const dayPmSlice = Array.isArray(a?.hourly?.pm2_5)
        ? a.hourly.pm2_5.slice(d * 24, (d + 1) * 24).filter((v: unknown): v is number => typeof v === "number" && Number.isFinite(v))
        : [];
      const dayPmAvg =
        dayPmSlice.length > 0
          ? Number((dayPmSlice.reduce((acc: number, v: number) => acc + v, 0) / dayPmSlice.length).toFixed(1))
          : fb.daily[d].pm25Avg;
      const dWaveMax = meta.isCoastal
        ? Number(
            (
              m?.daily?.wave_height_max?.[d] ??
              waveHeightM + (dRainProb > 50 ? 0.25 : 0)
            ).toFixed(2)
          )
        : 0;

      return {
        dayLabel,
        maxTempC: Number((w?.daily?.temperature_2m_max?.[d] ?? fb.daily[d].maxTempC).toFixed(1)),
        minTempC: Number((w?.daily?.temperature_2m_min?.[d] ?? fb.daily[d].minTempC).toFixed(1)),
        rainProb: dRainProb,
        rainMm: Number((w?.daily?.precipitation_sum?.[d] ?? fb.daily[d].rainMm).toFixed(1)),
        pm25Avg: dayPmAvg,
        uvMax: Number((w?.daily?.uv_index_max?.[d] ?? fb.daily[d].uvMax).toFixed(1)),
        tourismScore: Math.max(
          40,
          Math.min(
            98,
            Math.round(
              92 -
                (dRainProb > 50 ? 22 : dRainProb > 30 ? 10 : 0) -
                (dayPmAvg > 37.5 ? 12 : 0)
            )
          )
        ),
        waveMaxM: dWaveMax,
      };
    });

    const hourlyByDay: HourlyPoint[][] = dayNames.map((_, d) => {
      const dayTide = d === 0 ? tide : buildSyntheticTide24h(meta.tideAmp, meta.tidePhase, d);
      const dayUvMax = daily[d]?.uvMax ?? uvIndex;
      const fbDayHourly = fb.hourlyByDay?.[d] ?? fb.hourly;

      return Array.from({ length: 24 }, (__, h) => {
        const idx168 = d * 24 + h;
        const hRainProb = toTmdRainAreaPercent(
          w?.hourly?.precipitation_probability?.[idx168] ?? fbDayHourly[h].rainProb
        );
        const hUv =
          h >= 7 && h <= 17
            ? Number((Math.sin(((h - 7) / 10) * Math.PI) * dayUvMax).toFixed(1))
            : 0;
        const hWind = Number(
          (w?.hourly?.wind_speed_10m?.[idx168] ?? fbDayHourly[h].windKmh).toFixed(1)
        );
        const hWave = meta.isCoastal
          ? Number(
              (
                m?.hourly?.wave_height?.[idx168] ??
                Math.max(0.15, waveHeightM + (hWind - windKmh) * 0.02)
              ).toFixed(2)
            )
          : 0;

        return {
          hourLabel: `${String(h).padStart(2, "0")}:00`,
          tempC: Number((w?.hourly?.temperature_2m?.[idx168] ?? fbDayHourly[h].tempC).toFixed(1)),
          feelsLikeC: Number(
            (w?.hourly?.apparent_temperature?.[idx168] ?? fbDayHourly[h].feelsLikeC).toFixed(1)
          ),
          rainProb: hRainProb,
          rainMm: Number((w?.hourly?.precipitation?.[idx168] ?? fbDayHourly[h].rainMm).toFixed(1)),
          pm25: Number((a?.hourly?.pm2_5?.[idx168] ?? fbDayHourly[h].pm25).toFixed(1)),
          windKmh: hWind,
          tideMsl: dayTide.hourlyTide[h] ?? 0,
          waveM: hWave,
          cloudPct: Math.round(
            w?.hourly?.cloud_cover?.[idx168] ?? Math.min(95, Math.max(15, hRainProb * 0.9 + 15))
          ),
          uvIndex: hUv,
        };
      });
    });

    const hourly = hourlyByDay[0];

    return {
      ...fb,
      current: {
        tempC,
        feelsLikeC,
        minMorningC,
        maxAfternoonC,
        humidity,
        dewPointC: intel.dewPointC,
        pressureHpa: intel.pressureHpa,
        visibilityKm: intel.visibilityKm,
        cloudCoverPct: intel.cloudCoverPct,
        skyStateLabel: intel.skyStateLabel,
        rainProb,
        rain24hMm,
        tmdRainCoverageLabel: intel.tmdRainCoverageLabel,
        tmdRainIntensityLabel: intel.tmdRainIntensityLabel,
        radarDbz: intel.radarDbz,
        pm25,
        aqi,
        thaiAqi: intel.thaiAqi,
        uvIndex,
        windKmh,
        windGustKmh,
        windDirLabel: windDirectionThai(windDeg),
        windDeg,
        coolIndexLabel: intel.coolIndexLabel,
        mistChancePct: intel.mistChancePct,
        tideMsl: curTide,
        tideTrend: intel.tideTrend,
        highTideMsl: tide.highTideMsl,
        highTideTime: tide.highTideTime,
        lowTideMsl: tide.lowTideMsl,
        lowTideTime: tide.lowTideTime,
        tideStatusLabel: intel.tideStatusLabel,
        waveHeightM,
        wavePeriodS,
        seaStateLabel: intel.seaStateLabel,
        marineSafetyLabel: intel.marineSafetyLabel,
        tourismScore: intel.tourismScore,
        tourismBadge: intel.tourismBadge,
        suitabilityScore: intel.suitabilityScore,
        suitabilityTags: intel.suitabilityTags,
        multiHazardTier: intel.multiHazardTier,
        primaryHazardLabel: intel.primaryHazardLabel,
        hazardAdvice: intel.hazardAdvice,
        lifestyle: intel.lifestyle,
      },
      hourly,
      hourlyByDay,
      daily,
    };
  });

  return {
    fetchedAt: new Date().toISOString(),
    sourceMode: "live-open-meteo",
    areas,
  };
}

export async function GET(request?: Request) {
  try {
    const url = request ? new URL(request.url) : null;
    const forceRefresh = url?.searchParams.get("refresh") === "1";
    const now = Date.now();

    if (!forceRefresh && cachedPayload && now - cachedAtMs < CACHE_TTL_MS) {
      return NextResponse.json(cachedPayload, {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
          "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "X-FahSai-Cache": "HIT",
        },
      });
    }

    if (!inFlightRequest) {
      inFlightRequest = fetchLiveFahSaiPayload().finally(() => {
        inFlightRequest = null;
      });
    }

    const payload = await inFlightRequest;
    cachedPayload = payload;
    cachedAtMs = Date.now();

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "X-FahSai-Cache": "MISS",
      },
    });
  } catch {
    return NextResponse.json(buildFallbackPayload(), {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=300",
      },
    });
  }
}
