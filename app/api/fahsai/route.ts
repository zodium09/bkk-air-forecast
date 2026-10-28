export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import {
  buildFallbackPayload,
  buildSyntheticTide24h,
  computeAreaIntelligence,
  getBangkokHour,
  THAILAND_AREAS,
  windDirectionThai,
  type AreaForecast,
  type FahSaiPayload,
} from "../../lib/fahsai-data";

export async function GET() {
  try {
    const batch1 = THAILAND_AREAS.slice(0, 39);
    const batch2 = THAILAND_AREAS.slice(39);

    const buildUrls = (batch: typeof THAILAND_AREAS) => {
      const lats = batch.map(a => a.lat.toFixed(4)).join(",");
      const lngs = batch.map(a => a.lng.toFixed(4)).join(",");
      return {
        weatherUrl: `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,cloud_cover&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,uv_index_max&timezone=Asia%2FBangkok&forecast_days=7`,
        airUrl: `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lngs}&current=pm2_5,us_aqi,uv_index&hourly=pm2_5&timezone=Asia%2FBangkok&forecast_days=3`,
      };
    };

    const u1 = buildUrls(batch1);
    const u2 = buildUrls(batch2);

    const [wRes1, aRes1, wRes2, aRes2] = await Promise.all([
      fetch(u1.weatherUrl),
      fetch(u1.airUrl),
      fetch(u2.weatherUrl),
      fetch(u2.airUrl),
    ]);

    if (!wRes1.ok || !aRes1.ok || !wRes2.ok || !aRes2.ok) {
      return NextResponse.json(buildFallbackPayload());
    }

    const [wJson1, aJson1, wJson2, aJson2] = await Promise.all([
      wRes1.json(),
      aRes1.json(),
      wRes2.json(),
      aRes2.json(),
    ]);
    const weatherList = [
      ...(Array.isArray(wJson1) ? wJson1 : [wJson1]),
      ...(Array.isArray(wJson2) ? wJson2 : [wJson2]),
    ];
    const airList = [
      ...(Array.isArray(aJson1) ? aJson1 : [aJson1]),
      ...(Array.isArray(aJson2) ? aJson2 : [aJson2]),
    ];
    const fallback = buildFallbackPayload();
    const dayNames = ["วันนี้", "พรุ่งนี้", "มะรืน", "วันที่ 4", "วันที่ 5", "วันที่ 6", "วันที่ 7"];
    const nowHour = getBangkokHour();

    const areas: AreaForecast[] = THAILAND_AREAS.map((meta, idx) => {
      const w = weatherList[idx];
      const a = airList[idx];
      const fb = fallback.areas[idx];
      if (!w?.current) return fb;

      const tide = buildSyntheticTide24h(meta.tideAmp, meta.tidePhase);
      const tempC = Number((w.current.temperature_2m ?? fb.current.tempC).toFixed(1));
      const feelsLikeC = Number((w.current.apparent_temperature ?? fb.current.feelsLikeC).toFixed(1));
      const humidity = Math.round(w.current.relative_humidity_2m ?? fb.current.humidity);
      const windKmh = Number((w.current.wind_speed_10m ?? fb.current.windKmh).toFixed(1));
      const windGustKmh = Number((w.current.wind_gusts_10m ?? windKmh * 1.35).toFixed(1));
      const windDeg = Math.round(w.current.wind_direction_10m ?? 45);
      const pm25 = Number((a?.current?.pm2_5 ?? fb.current.pm25).toFixed(1));
      const aqi = Math.round(a?.current?.us_aqi ?? fb.current.aqi);
      const uvIndex = Number((a?.current?.uv_index ?? w?.daily?.uv_index_max?.[0] ?? fb.current.uvIndex).toFixed(1));
      const minMorningC = Number((w?.daily?.temperature_2m_min?.[0] ?? fb.current.minMorningC).toFixed(1));
      const maxAfternoonC = Number((w?.daily?.temperature_2m_max?.[0] ?? fb.current.maxAfternoonC).toFixed(1));
      const rainProb = Math.round(w?.daily?.precipitation_probability_max?.[0] ?? fb.current.rainProb);
      const rain24hMm = Number((w?.daily?.precipitation_sum?.[0] ?? fb.current.rain24hMm).toFixed(1));
      const waveHeightM = meta.isCoastal
        ? Number(Math.max(0.2, meta.baseWaveM + (windKmh - 12) * 0.025).toFixed(2))
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
      });

      const hourly = Array.from({ length: 24 }, (_, h) => {
        const hRainProb = Math.round(w?.hourly?.precipitation_probability?.[h] ?? fb.hourly[h].rainProb);
        const hUv = h >= 7 && h <= 17 ? Number((Math.sin(((h - 7) / 10) * Math.PI) * uvIndex).toFixed(1)) : 0;
        return {
          hourLabel: `${String(h).padStart(2, "0")}:00`,
          tempC: Number((w?.hourly?.temperature_2m?.[h] ?? fb.hourly[h].tempC).toFixed(1)),
          feelsLikeC: Number((w?.hourly?.apparent_temperature?.[h] ?? fb.hourly[h].feelsLikeC).toFixed(1)),
          rainProb: hRainProb,
          rainMm: Number((w?.hourly?.precipitation?.[h] ?? fb.hourly[h].rainMm).toFixed(1)),
          pm25: Number((a?.hourly?.pm2_5?.[h] ?? fb.hourly[h].pm25).toFixed(1)),
          windKmh: Number((w?.hourly?.wind_speed_10m?.[h] ?? fb.hourly[h].windKmh).toFixed(1)),
          tideMsl: tide.hourlyTide[h] ?? 0,
          waveM: meta.isCoastal
            ? Number(Math.max(0.15, waveHeightM + ((w?.hourly?.wind_speed_10m?.[h] ?? windKmh) - windKmh) * 0.02).toFixed(2))
            : 0,
          cloudPct: Math.round(w?.hourly?.cloud_cover?.[h] ?? Math.min(95, Math.max(15, hRainProb * 0.9 + 15))),
          uvIndex: hUv,
        };
      });

      const daily = dayNames.map((dayLabel, d) => {
        const dRainProb = Math.round(w?.daily?.precipitation_probability_max?.[d] ?? fb.daily[d].rainProb);
        return {
          dayLabel,
          maxTempC: Number((w?.daily?.temperature_2m_max?.[d] ?? fb.daily[d].maxTempC).toFixed(1)),
          minTempC: Number((w?.daily?.temperature_2m_min?.[d] ?? fb.daily[d].minTempC).toFixed(1)),
          rainProb: dRainProb,
          rainMm: Number((w?.daily?.precipitation_sum?.[d] ?? fb.daily[d].rainMm).toFixed(1)),
          pm25Avg: fb.daily[d].pm25Avg,
          uvMax: Number((w?.daily?.uv_index_max?.[d] ?? fb.daily[d].uvMax).toFixed(1)),
          tourismScore: Math.max(40, Math.min(98, Math.round(92 - (dRainProb > 50 ? 22 : dRainProb > 30 ? 10 : 0) - (pm25 > 37.5 ? 12 : 0)))),
          waveMaxM: meta.isCoastal ? Number((waveHeightM + (dRainProb > 50 ? 0.25 : 0)).toFixed(2)) : 0,
        };
      });

      return {
        ...fb,
        current: {
          tempC,
          feelsLikeC,
          minMorningC,
          maxAfternoonC,
          humidity,
          pressureHpa: intel.pressureHpa,
          visibilityKm: intel.visibilityKm,
          cloudCoverPct: Math.round(w.current.cloud_cover ?? intel.cloudCoverPct),
          skyStateLabel: intel.skyStateLabel,
          rainProb,
          rain24hMm,
          radarDbz: intel.radarDbz,
          pm25,
          aqi,
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
        daily,
      };
    });

    const payload: FahSaiPayload = {
      fetchedAt: new Date().toISOString(),
      sourceMode: "live-open-meteo",
      areas,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return NextResponse.json(buildFallbackPayload());
  }
}
