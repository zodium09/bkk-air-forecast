export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import {
  buildFallbackPayload,
  buildSyntheticTide24h,
  getBangkokHour,
  UPPER_GULF_AREAS,
  windDirectionThai,
  type AreaForecast,
  type FahSaiPayload,
} from "../../lib/fahsai-data";

export async function GET() {
  try {
    const lats = UPPER_GULF_AREAS.map(a => a.lat.toFixed(4)).join(",");
    const lngs = UPPER_GULF_AREAS.map(a => a.lng.toFixed(4)).join(",");

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,uv_index_max&timezone=Asia%2FBangkok&forecast_days=7`;
    const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lngs}&current=pm2_5,us_aqi,uv_index&hourly=pm2_5&timezone=Asia%2FBangkok&forecast_days=3`;

    const [weatherRes, airRes] = await Promise.all([
      fetch(weatherUrl),
      fetch(airUrl),
    ]);

    if (!weatherRes.ok || !airRes.ok) {
      return NextResponse.json(buildFallbackPayload());
    }

    const weatherJson = await weatherRes.json();
    const airJson = await airRes.json();
    const weatherList = Array.isArray(weatherJson) ? weatherJson : [weatherJson];
    const airList = Array.isArray(airJson) ? airJson : [airJson];
    const fallback = buildFallbackPayload();
    const dayNames = ["วันนี้", "พรุ่งนี้", "มะรืน", "วันที่ 4", "วันที่ 5", "วันที่ 6", "วันที่ 7"];

    const areas: AreaForecast[] = UPPER_GULF_AREAS.map((meta, idx) => {
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
      const rainProb = Math.round(w?.daily?.precipitation_probability_max?.[0] ?? fb.current.rainProb);
      const rain24hMm = Number((w?.daily?.precipitation_sum?.[0] ?? fb.current.rain24hMm).toFixed(1));
      const waveHeightM = Number(Math.max(0.2, meta.baseWaveM + (windKmh - 12) * 0.025).toFixed(2));

      const hourly = Array.from({ length: 24 }, (_, h) => ({
        hourLabel: `${String(h).padStart(2, "0")}:00`,
        tempC: Number((w?.hourly?.temperature_2m?.[h] ?? fb.hourly[h].tempC).toFixed(1)),
        feelsLikeC: Number((w?.hourly?.apparent_temperature?.[h] ?? fb.hourly[h].feelsLikeC).toFixed(1)),
        rainProb: Math.round(w?.hourly?.precipitation_probability?.[h] ?? fb.hourly[h].rainProb),
        rainMm: Number((w?.hourly?.precipitation?.[h] ?? fb.hourly[h].rainMm).toFixed(1)),
        pm25: Number((a?.hourly?.pm2_5?.[h] ?? fb.hourly[h].pm25).toFixed(1)),
        windKmh: Number((w?.hourly?.wind_speed_10m?.[h] ?? fb.hourly[h].windKmh).toFixed(1)),
        tideMsl: tide.hourlyTide[h],
        waveM: Number(Math.max(0.15, waveHeightM + ((w?.hourly?.wind_speed_10m?.[h] ?? windKmh) - windKmh) * 0.02).toFixed(2)),
      }));

      const daily = dayNames.map((dayLabel, d) => ({
        dayLabel,
        maxTempC: Number((w?.daily?.temperature_2m_max?.[d] ?? fb.daily[d].maxTempC).toFixed(1)),
        minTempC: Number((w?.daily?.temperature_2m_min?.[d] ?? fb.daily[d].minTempC).toFixed(1)),
        rainProb: Math.round(w?.daily?.precipitation_probability_max?.[d] ?? fb.daily[d].rainProb),
        rainMm: Number((w?.daily?.precipitation_sum?.[d] ?? fb.daily[d].rainMm).toFixed(1)),
        pm25Avg: fb.daily[d].pm25Avg,
        uvMax: Number((w?.daily?.uv_index_max?.[d] ?? fb.daily[d].uvMax).toFixed(1)),
      }));

      const nowHour = getBangkokHour();
      const curTide = tide.hourlyTide[nowHour] ?? tide.hourlyTide[14];
      const nextTide = tide.hourlyTide[(nowHour + 1) % 24] ?? curTide;

      return {
        ...fb,
        current: {
          tempC,
          feelsLikeC,
          minMorningC,
          humidity,
          rainProb,
          rain24hMm,
          pm25,
          aqi,
          uvIndex,
          windKmh,
          windGustKmh,
          windDirLabel: windDirectionThai(windDeg),
          windDeg,
          coolIndexLabel:
            minMorningC <= 23
              ? "🍃 เช้าอากาศเย็นสดชื่น เหมาะเดินรับลม"
              : minMorningC <= 25.5
                ? "🌤️ เช้าอากาศสบาย ลมโชยกำลังดี"
                : "☀️ อากาศค่อนข้างอุ่น มีลมทะเลพัดช่วยระบายอากาศ",
          tideMsl: curTide,
          tideTrend: nextTide >= curTide ? "rising" : "falling",
          highTideMsl: tide.highTideMsl,
          highTideTime: tide.highTideTime,
          lowTideMsl: tide.lowTideMsl,
          lowTideTime: tide.lowTideTime,
          waveHeightM,
          seaStateLabel:
            waveHeightM >= 1.2
              ? "🌊 คลื่นปานกลาง (1.2+ ม.) เรือเล็กชายฝั่งควรระมัดระวัง"
              : "⚓ ทะเลเรียบถึงคลื่นเล็กน้อย เที่ยวชายหาดและเดินเรือปลอดภัย",
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
