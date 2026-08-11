import {
  forecastDays as fallbackDays,
  forecastStations as fallbackStations,
  issuedAt as fallbackIssuedAt,
  type ForecastDay,
  type ForecastStation,
} from "../../lib/forecast-data";

const AIRBKK_URL = "https://official.airbkk.com/airbkk/Api";
const CAMS_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

const camsAnchors = [
  { lat: 13.64, lng: 100.34 }, { lat: 13.64, lng: 100.60 }, { lat: 13.64, lng: 100.88 },
  { lat: 13.80, lng: 100.34 }, { lat: 13.80, lng: 100.60 }, { lat: 13.80, lng: 100.88 },
  { lat: 13.96, lng: 100.34 }, { lat: 13.96, lng: 100.60 }, { lat: 13.96, lng: 100.88 },
];

type AirBkkRecord = {
  MeasIndex: string;
  District: string;
  Area: string;
  Lat: string;
  Long: string;
  DateTime: string;
  Type: string;
  "PM2.5": number | string | null;
};

type AirBkkResponse = { status: string; message: AirBkkRecord[] };
type CamsLocation = {
  latitude: number;
  longitude: number;
  current?: { time: string; pm2_5: number | null };
  hourly: { time: string[]; pm2_5: Array<number | null> };
};
type WeatherResponse = {
  daily: {
    time: string[];
    wind_speed_10m_max: Array<number | null>;
    wind_direction_10m_dominant: Array<number | null>;
    precipitation_probability_max: Array<number | null>;
  };
};

function parseBangkokTimestamp(value: string) {
  return new Date(`${value.replace(" ", "T")}+07:00`).getTime();
}

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function formatThaiDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00+07:00`);
  return {
    date: new Intl.DateTimeFormat("th-TH", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Bangkok",
    }).format(date),
    weekday: new Intl.DateTimeFormat("th-TH", {
      weekday: "short",
      timeZone: "Asia/Bangkok",
    }).format(date).replace(".", ""),
    year: Number(new Intl.DateTimeFormat("th-TH-u-nu-latn", {
      year: "numeric",
      timeZone: "Asia/Bangkok",
    }).format(date)),
  };
}

function formatIssuedAt(timestamp: number) {
  return new Intl.DateTimeFormat("th-TH-u-nu-latn", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(timestamp)).replace(".", "");
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function spatialIdw(
  lat: number,
  lng: number,
  anchors: Array<{ lat: number; lng: number; value: number }>,
) {
  const longitudeScale = Math.cos((lat * Math.PI) / 180);
  let weighted = 0;
  let weightSum = 0;
  for (const anchor of anchors) {
    const dx = (lng - anchor.lng) * longitudeScale;
    const dy = lat - anchor.lat;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared < 0.000001) return anchor.value;
    const weight = 1 / distanceSquared;
    weighted += anchor.value * weight;
    weightSum += weight;
  }
  return weighted / weightSum;
}

function windDirectionLabel(degrees: number | null) {
  if (degrees === null || !Number.isFinite(degrees)) return "ไม่ทราบทิศ";
  const directions = ["เหนือ", "ตะวันออกเฉียงเหนือ", "ตะวันออก", "ตะวันออกเฉียงใต้", "ใต้", "ตะวันตกเฉียงใต้", "ตะวันตก", "ตะวันตกเฉียงเหนือ"];
  return directions[Math.round(degrees / 45) % 8];
}

function buildCamsUrl() {
  const url = new URL(CAMS_URL);
  url.searchParams.set("latitude", camsAnchors.map((point) => point.lat).join(","));
  url.searchParams.set("longitude", camsAnchors.map((point) => point.lng).join(","));
  url.searchParams.set("hourly", "pm2_5");
  url.searchParams.set("current", "pm2_5");
  url.searchParams.set("domains", "cams_global");
  url.searchParams.set("timezone", "Asia/Bangkok");
  url.searchParams.set("forecast_days", "7");
  return url;
}

function buildWeatherUrl() {
  const url = new URL(WEATHER_URL);
  url.searchParams.set("latitude", "13.7563");
  url.searchParams.set("longitude", "100.5018");
  url.searchParams.set("daily", "wind_speed_10m_max,wind_direction_10m_dominant,precipitation_probability_max");
  url.searchParams.set("timezone", "Asia/Bangkok");
  url.searchParams.set("forecast_days", "7");
  return url;
}

export async function GET() {
  try {
    const [airbkkResponse, camsResponse, weatherResponse] = await Promise.all([
      fetch(AIRBKK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: "{}",
      }),
      fetch(buildCamsUrl(), { headers: { Accept: "application/json" } }),
      fetch(buildWeatherUrl(), { headers: { Accept: "application/json" } }),
    ]);

    if (!airbkkResponse.ok || !camsResponse.ok || !weatherResponse.ok) {
      throw new Error(`upstream status ${airbkkResponse.status}/${camsResponse.status}/${weatherResponse.status}`);
    }

    const [airbkk, camsRaw, weather] = await Promise.all([
      airbkkResponse.json() as Promise<AirBkkResponse>,
      camsResponse.json() as Promise<CamsLocation[] | CamsLocation>,
      weatherResponse.json() as Promise<WeatherResponse>,
    ]);

    if (airbkk.status !== "Success" || !Array.isArray(airbkk.message)) {
      throw new Error("invalid AirBKK response");
    }

    const parsedRecords = airbkk.message
      .map((record) => ({
        record,
        lat: Number(record.Lat),
        lng: Number(record.Long),
        pm25: Number(record["PM2.5"]),
        timestamp: parseBangkokTimestamp(record.DateTime),
      }))
      .filter(({ lat, lng, pm25, timestamp }) =>
        Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(pm25) && Number.isFinite(timestamp) &&
        pm25 >= 0 && pm25 <= 500 && lat >= 13.45 && lat <= 14.1 && lng >= 100.2 && lng <= 101,
      );

    const latestObservation = Math.max(...parsedRecords.map((item) => item.timestamp));
    const validRecords = parsedRecords.filter((item) => latestObservation - item.timestamp <= 6 * 60 * 60 * 1000);
    if (validRecords.length < 20) throw new Error("insufficient fresh AirBKK stations");

    const camsLocations = Array.isArray(camsRaw) ? camsRaw : [camsRaw];
    if (camsLocations.length < 3) throw new Error("insufficient CAMS anchors");

    const latestRecord = validRecords.find((item) => item.timestamp === latestObservation)!;
    const observationDate = latestRecord.record.DateTime.slice(0, 10);
    const targetDates = Array.from({ length: 5 }, (_, index) => addDays(observationDate, index + 1));

    const anchorForecasts = camsLocations.map((location) => {
      const grouped = new Map<string, number[]>();
      location.hourly.time.forEach((time, index) => {
        const value = location.hourly.pm2_5[index];
        if (value === null || !Number.isFinite(value)) return;
        const dateKey = time.slice(0, 10);
        const list = grouped.get(dateKey) ?? [];
        list.push(value);
        grouped.set(dateKey, list);
      });

      const coverage = targetDates.map((dateKey) => grouped.get(dateKey)?.length ?? 0);
      const values: number[] = [];
      targetDates.forEach((dateKey, index) => {
        const dailyMean = mean(grouped.get(dateKey) ?? []);
        if (dailyMean !== null && coverage[index] >= 6) {
          values.push(dailyMean);
          return;
        }
        const previous = values[index - 1] ?? Number(location.current?.pm2_5 ?? 0);
        const beforePrevious = values[index - 2] ?? previous;
        const trend = clamp(previous - beforePrevious, -3, 3);
        values.push(Math.max(0, previous + trend));
      });

      const currentValue = Number(location.current?.pm2_5);
      return {
        lat: Number(location.latitude),
        lng: Number(location.longitude),
        current: Number.isFinite(currentValue) ? currentValue : values[0],
        values,
        coverage,
      };
    });

    const forecastCoverage = targetDates.map((_, index) => Math.min(...anchorForecasts.map((anchor) => anchor.coverage[index])));
    const nowAgeHours = (Date.now() - latestObservation) / 3_600_000;
    const status = nowAgeHours <= 6 ? "live" : "degraded";
    const weatherByDate = new Map(weather.daily.time.map((dateKey, index) => [dateKey, {
      windSpeed: weather.daily.wind_speed_10m_max[index],
      windDirection: weather.daily.wind_direction_10m_dominant[index],
      rainProbability: weather.daily.precipitation_probability_max[index],
    }]));

    const confidenceBase = [80, 72, 64, 55, 40];
    const uncertainty = [6, 8, 11, 14, 18];
    const days: ForecastDay[] = targetDates.map((dateKey, index) => {
      const formatted = formatThaiDate(dateKey);
      const weatherDay = weatherByDate.get(dateKey);
      const hasCamsCoverage = forecastCoverage[index] >= 6;
      const windSpeed = weatherDay?.windSpeed;
      const rainProbability = weatherDay?.rainProbability;
      return {
        lead: index + 1,
        date: formatted.date,
        weekday: formatted.weekday,
        year: formatted.year,
        confidence: Math.max(25, confidenceBase[index] - (status === "degraded" ? 10 : 0) - (hasCamsCoverage ? 0 : 8)),
        uncertainty: uncertainty[index],
        wind: `ลม${windDirectionLabel(weatherDay?.windDirection ?? null)} สูงสุด ${windSpeed === null || windSpeed === undefined ? "—" : Math.round(windSpeed)} กม./ชม.`,
        weather: `โอกาสฝนสูงสุด ${rainProbability === null || rainProbability === undefined ? "—" : Math.round(rainProbability)}%`,
        note: hasCamsCoverage
          ? `CAMS มีข้อมูล ${forecastCoverage[index]} ชั่วโมงในวันนี้ และปรับ bias ด้วย AirBKK ล่าสุดแบบลดน้ำหนักตามระยะเวลา`
          : "CAMS ยังไม่ครอบคลุมครบช่วงวันนี้ จึงแสดงแนวโน้มต่อจากวันล่าสุดและลดระดับความเชื่อมั่น",
        sourceMode: hasCamsCoverage ? "cams" : "extrapolated",
        coverageHours: forecastCoverage[index],
      };
    });

    const stations: ForecastStation[] = validRecords.map(({ record, lat, lng, pm25 }) => {
      const currentCams = spatialIdw(lat, lng, anchorForecasts.map((anchor) => ({ lat: anchor.lat, lng: anchor.lng, value: anchor.current })));
      const bias = pm25 - currentCams;
      const values = targetDates.map((_, index) => {
        const camsValue = spatialIdw(lat, lng, anchorForecasts.map((anchor) => ({ lat: anchor.lat, lng: anchor.lng, value: anchor.values[index] })));
        const biasWeight = Math.exp(-(index + 1) / 2.2);
        return Math.round(Math.max(0, camsValue + bias * biasWeight) * 10) / 10;
      });
      return {
        id: String(record.MeasIndex),
        district: record.District.replace(/^เขต/, ""),
        label: record.Area?.trim() || record.District,
        lat,
        lng,
        values,
        observed: pm25,
        observedAt: record.DateTime,
        sourceType: record.Type,
      };
    });

    return Response.json({
      status,
      issuedAt: formatIssuedAt(latestObservation),
      model: "AirBKK + CAMS bias-corrected IDW baseline 0.2",
      disclaimer: "ค่าตรวจวัดมาจาก AirBKK จริง ส่วนค่าล่วงหน้าเป็น CAMS Global ที่ปรับ bias ด้วยสถานีล่าสุด ยังไม่ใช่โมเดลที่ผ่านการรับรองเพื่อออกคำเตือน",
      sources: ["AirBKK live observations", "CAMS Global via Open-Meteo", "Open-Meteo Weather Forecast", "BMA GIS district boundary"],
      dataQuality: {
        rawStations: airbkk.message.length,
        acceptedStations: stations.length,
        latestObservation: latestRecord.record.DateTime,
        observationAgeHours: Math.round(nowAgeHours * 10) / 10,
        camsMinimumCoverageHours: Math.min(...forecastCoverage),
      },
      days,
      stations,
    }, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
        "X-Forecast-Status": status,
      },
    });
  } catch (error) {
    return Response.json({
      status: "fallback",
      issuedAt: fallbackIssuedAt,
      model: "BKK-AIR-MVP fallback dataset",
      disclaimer: "ไม่สามารถอัปเดตแหล่งข้อมูลจริงบางส่วนได้ ขณะนี้แสดงชุดข้อมูลสำรองและไม่ควรใช้ตัดสินใจ",
      sources: ["Bundled fallback dataset"],
      dataQuality: { error: error instanceof Error ? error.message : "unknown upstream error" },
      days: fallbackDays.map((day) => ({ ...day, sourceMode: "demo" as const, year: 2569 })),
      stations: fallbackStations,
    }, {
      headers: { "Cache-Control": "no-store", "X-Forecast-Status": "fallback" },
    });
  }
}
