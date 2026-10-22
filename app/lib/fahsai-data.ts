export type TopicId = "rain" | "air" | "heat" | "winter" | "sea";

export interface HourlyPoint {
  hourLabel: string;
  tempC: number;
  feelsLikeC: number;
  rainProb: number;
  rainMm: number;
  pm25: number;
  windKmh: number;
  tideMsl: number;
  waveM: number;
}

export interface DailyPoint {
  dayLabel: string;
  maxTempC: number;
  minTempC: number;
  rainProb: number;
  rainMm: number;
  pm25Avg: number;
  uvMax: number;
}

export interface AreaForecast {
  id: string;
  name: string;
  subtitle: string;
  zoneType: "metro" | "coastal";
  lat: number;
  lng: number;
  mapX: number;
  mapY: number;
  coastalNote: string;
  current: {
    tempC: number;
    feelsLikeC: number;
    minMorningC: number;
    humidity: number;
    rainProb: number;
    rain24hMm: number;
    pm25: number;
    aqi: number;
    uvIndex: number;
    windKmh: number;
    windGustKmh: number;
    windDirLabel: string;
    windDeg: number;
    coolIndexLabel: string;
    tideMsl: number;
    tideTrend: "rising" | "falling" | "high" | "low";
    highTideMsl: number;
    highTideTime: string;
    lowTideMsl: number;
    lowTideTime: string;
    waveHeightM: number;
    seaStateLabel: string;
  };
  hourly: HourlyPoint[];
  daily: DailyPoint[];
}

export interface FahSaiPayload {
  fetchedAt: string;
  sourceMode: "live-open-meteo" | "hybrid-fallback";
  areas: AreaForecast[];
}

export const UPPER_GULF_AREAS: {
  id: string;
  name: string;
  subtitle: string;
  zoneType: "metro" | "coastal";
  lat: number;
  lng: number;
  mapX: number;
  mapY: number;
  coastalNote: string;
  tideAmp: number;
  tidePhase: number;
  baseWaveM: number;
}[] = [
  {
    id: "bangkok",
    name: "กรุงเทพมหานคร",
    subtitle: "พระนคร · สาทร · สุขุมวิท · บางนา",
    zoneType: "metro",
    lat: 13.7563,
    lng: 100.5018,
    mapX: 288,
    mapY: 146,
    coastalNote: "รับอิทธิพลน้ำทะเลหนุนผ่านแม่น้ำเจ้าพระยาตอนล่างและลมทะเลอ่าวไทย",
    tideAmp: 1.15,
    tidePhase: 1.2,
    baseWaveM: 0.35,
  },
  {
    id: "samut-prakan",
    name: "สมุทรปราการ",
    subtitle: "ปากน้ำ · บางปู · พระสมุทรเจดีย์",
    zoneType: "coastal",
    lat: 13.5991,
    lng: 100.5968,
    mapX: 306,
    mapY: 186,
    coastalNote: "จุดบรรจบปากแม่น้ำเจ้าพระยากับอ่าวไทยตอนบน เฝ้าระวังน้ำทะเลหนุนสูงสุด",
    tideAmp: 1.42,
    tidePhase: 0.4,
    baseWaveM: 0.65,
  },
  {
    id: "samut-sakhon",
    name: "สมุทรสาคร",
    subtitle: "มหาชัย · ปากน้ำท่าจีน · ชายทะเลกาหลง",
    zoneType: "coastal",
    lat: 13.5475,
    lng: 100.2744,
    mapX: 236,
    mapY: 184,
    coastalNote: "ชายฝั่งอ่าวไทยตอนบนและปากแม่น้ำท่าจีน สำคัญต่อประมงชายฝั่งและนาเกลือ",
    tideAmp: 1.38,
    tidePhase: 0.6,
    baseWaveM: 0.6,
  },
  {
    id: "samut-songkhram",
    name: "สมุทรสงคราม",
    subtitle: "แม่กลอง · ดอนหอยหลอด · อัมพวา",
    zoneType: "coastal",
    lat: 13.4098,
    lng: 100.0023,
    mapX: 186,
    mapY: 202,
    coastalNote: "ปากแม่น้ำแม่กลองและสันดอนหอยหลอด ระดับน้ำขึ้น–ลงชัดเจนตามดวงจันทร์",
    tideAmp: 1.45,
    tidePhase: 0.8,
    baseWaveM: 0.65,
  },
  {
    id: "chonburi",
    name: "ชลบุรี (บางแสน · พัทยา)",
    subtitle: "บางแสน · ศรีราชา · เกาะสีชัง · พัทยา",
    zoneType: "coastal",
    lat: 13.2847,
    lng: 100.9154,
    mapX: 378,
    mapY: 242,
    coastalNote: "ชายฝั่งท่องเที่ยวและท่าเรือหลักอ่าวไทยฝั่งตะวันออก คลื่นลมเปลี่ยนตามมรสุม",
    tideAmp: 1.48,
    tidePhase: 0.2,
    baseWaveM: 0.85,
  },
  {
    id: "nonthaburi",
    name: "นนทบุรี",
    subtitle: "เมืองนนท์ · ปากเกร็ด · บางใหญ่",
    zoneType: "metro",
    lat: 13.8621,
    lng: 100.5144,
    mapX: 278,
    mapY: 112,
    coastalNote: "พื้นที่เมืองหนาแน่นริมเจ้าพระยา รับลมหนาวและฝุ่นสะสมช่วงเช้า",
    tideAmp: 0.92,
    tidePhase: 1.8,
    baseWaveM: 0.25,
  },
  {
    id: "pathum-thani",
    name: "ปทุมธานี",
    subtitle: "รังสิต · ธัญบุรี · สามโคก",
    zoneType: "metro",
    lat: 14.0208,
    lng: 100.525,
    mapX: 286,
    mapY: 76,
    coastalNote: "โซนเหนือของกรุงเทพฯ รับลมหนาวระลอกแรกก่อนเข้าตัวเมือง",
    tideAmp: 0.65,
    tidePhase: 2.3,
    baseWaveM: 0.2,
  },
  {
    id: "nakhon-pathom",
    name: "นครปฐม",
    subtitle: "เมืองนครปฐม · ศาลายา · สามพราน",
    zoneType: "metro",
    lat: 13.8199,
    lng: 100.0621,
    mapX: 192,
    mapY: 134,
    coastalNote: "ที่ราบลุ่มท่าจีนฝั่งตะวันตก อุณหภูมิเช้ามืดลดลงเร็วในฤดูหนาว",
    tideAmp: 0.55,
    tidePhase: 2.0,
    baseWaveM: 0.2,
  },
  {
    id: "chachoengsao",
    name: "ฉะเชิงเทรา (บางปะกง)",
    subtitle: "เมืองแปดริ้ว · ปากแม่น้ำบางปะกง",
    zoneType: "coastal",
    lat: 13.6904,
    lng: 101.078,
    mapX: 392,
    mapY: 162,
    coastalNote: "ปากแม่น้ำบางปะกงเชื่อมสู่อ่าวไทยตอนบนและช่องเขาภาคตะวันออก",
    tideAmp: 1.36,
    tidePhase: 0.5,
    baseWaveM: 0.55,
  },
  {
    id: "phetchaburi",
    name: "เพชรบุรี (ชะอำ · แหลมผักเบี้ย)",
    subtitle: "หาดชะอำ · บ้านแหลม · แหลมผักเบี้ย",
    zoneType: "coastal",
    lat: 12.8004,
    lng: 99.9667,
    mapX: 146,
    mapY: 268,
    coastalNote: "ชายฝั่งอ่าวไทยตอนบนฝั่งตะวันตก น้ำทะเลใสและรับคลื่นลมตะวันออก",
    tideAmp: 1.5,
    tidePhase: 0.3,
    baseWaveM: 0.9,
  },
];

export function windDirectionThai(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 22 && normalized < 68) return "ตะวันออกเฉียงเหนือ (ลมหนาว)";
  if (normalized >= 68 && normalized < 112) return "ตะวันออก";
  if (normalized >= 112 && normalized < 158) return "ตะวันออกเฉียงใต้ (ลมทะเล)";
  if (normalized >= 158 && normalized < 202) return "ใต้ (ลมทะเลอ่าวไทย)";
  if (normalized >= 202 && normalized < 248) return "ตะวันตกเฉียงใต้ (มรสุมฝน)";
  if (normalized >= 248 && normalized < 292) return "ตะวันตก";
  if (normalized >= 292 && normalized < 338) return "ตะวันตกเฉียงเหนือ";
  return "เหนือ (ลมหนาว)";
}

export function buildSyntheticTide24h(amp: number, phase: number): {
  hourlyTide: number[];
  highTideMsl: number;
  highTideTime: string;
  lowTideMsl: number;
  lowTideTime: string;
} {
  const hourlyTide: number[] = [];
  let maxVal = -99;
  let maxHour = 0;
  let minVal = 99;
  let minHour = 0;
  for (let h = 0; h < 24; h++) {
    const semiDiurnal = amp * Math.sin(((2 * Math.PI * (h - 4)) / 12.42) + phase);
    const diurnal = 0.38 * amp * Math.cos(((2 * Math.PI * (h - 9)) / 24) + phase * 0.5);
    const level = Number((0.28 + semiDiurnal * 0.72 + diurnal).toFixed(2));
    hourlyTide.push(level);
    if (level > maxVal) {
      maxVal = level;
      maxHour = h;
    }
    if (level < minVal) {
      minVal = level;
      minHour = h;
    }
  }
  return {
    hourlyTide,
    highTideMsl: maxVal,
    highTideTime: `${String(maxHour).padStart(2, "0")}:00 น.`,
    lowTideMsl: minVal,
    lowTideTime: `${String(minHour).padStart(2, "0")}:00 น.`,
  };
}

export function buildFallbackPayload(): FahSaiPayload {
  const dayNames = ["วันนี้", "พรุ่งนี้", "มะรืน", "วันที่ 4", "วันที่ 5", "วันที่ 6", "วันที่ 7"];
  const areas: AreaForecast[] = UPPER_GULF_AREAS.map((meta, idx) => {
    const tide = buildSyntheticTide24h(meta.tideAmp, meta.tidePhase);
    const baseTemp = meta.zoneType === "coastal" ? 30.5 - (idx % 3) * 0.4 : 31.8 - (idx % 3) * 0.5;
    const minMorningC = Number((22.4 + (idx % 4) * 0.6).toFixed(1));
    const humidity = meta.zoneType === "coastal" ? 72 : 64;
    const feelsLikeC = Number((baseTemp + (meta.zoneType === "coastal" ? 3.8 : 4.4)).toFixed(1));
    const rainProb = meta.id === "samut-prakan" || meta.id === "chonburi" ? 45 : 30 + (idx % 4) * 5;
    const rain24hMm = Number(((rainProb > 40 ? 8.4 : 2.6) + (idx % 3) * 1.2).toFixed(1));
    const pm25 = Number((meta.zoneType === "coastal" ? 18.5 + idx * 1.4 : 26.8 + (idx % 4) * 3.5).toFixed(1));
    const aqi = Math.round(pm25 * 2.6);
    const windKmh = Number((meta.zoneType === "coastal" ? 19 + (idx % 4) * 2.5 : 14 + (idx % 3) * 2).toFixed(1));
    const windDeg = 42;
    const waveHeightM = Number((meta.baseWaveM + (idx % 3) * 0.1).toFixed(2));

    const hourly: HourlyPoint[] = Array.from({ length: 24 }, (_, h) => {
      const tempCurve = Math.sin(((h - 8) / 24) * 2 * Math.PI) * 3.8;
      const t = Number((baseTemp - 1.5 + tempCurve).toFixed(1));
      const fl = Number((t + (h >= 11 && h <= 16 ? 4.5 : 2.2)).toFixed(1));
      const rp = h >= 15 && h <= 19 ? Math.min(85, rainProb + 25) : Math.max(10, rainProb - 15);
      const rm = rp >= 50 ? Number(((rp - 40) * 0.12).toFixed(1)) : 0;
      const pm = Number((pm25 + (h >= 6 && h <= 9 ? 6.5 : h >= 13 && h <= 17 ? -4.2 : 0)).toFixed(1));
      const wk = Number((windKmh + (h >= 12 && h <= 17 ? 5 : 0)).toFixed(1));
      return {
        hourLabel: `${String(h).padStart(2, "0")}:00`,
        tempC: t,
        feelsLikeC: fl,
        rainProb: rp,
        rainMm: rm,
        pm25: Math.max(8, pm),
        windKmh: wk,
        tideMsl: tide.hourlyTide[h],
        waveM: Number((waveHeightM + (h >= 13 && h <= 18 ? 0.18 : 0)).toFixed(2)),
      };
    });

    const daily: DailyPoint[] = dayNames.map((label, d) => ({
      dayLabel: label,
      maxTempC: Number((baseTemp + 1.4 - (d % 3) * 0.5).toFixed(1)),
      minTempC: Number((minMorningC - (d >= 2 && d <= 4 ? 1.2 : 0)).toFixed(1)),
      rainProb: Math.max(15, Math.min(80, rainProb + (d === 1 ? 15 : d === 3 ? -15 : (d % 2) * 8))),
      rainMm: Number((Math.max(0, rain24hMm + (d === 1 ? 4.5 : -1.2 * d))).toFixed(1)),
      pm25Avg: Number((pm25 + (d >= 3 ? 4.5 : -1.5)).toFixed(1)),
      uvMax: 8 + (d % 3),
    }));

    return {
      id: meta.id,
      name: meta.name,
      subtitle: meta.subtitle,
      zoneType: meta.zoneType,
      lat: meta.lat,
      lng: meta.lng,
      mapX: meta.mapX,
      mapY: meta.mapY,
      coastalNote: meta.coastalNote,
      current: {
        tempC: Number(baseTemp.toFixed(1)),
        feelsLikeC,
        minMorningC,
        humidity,
        rainProb,
        rain24hMm,
        pm25,
        aqi,
        uvIndex: 7.5,
        windKmh,
        windGustKmh: Number((windKmh * 1.45).toFixed(1)),
        windDirLabel: windDirectionThai(windDeg),
        windDeg,
        coolIndexLabel: minMorningC <= 23.5 ? "เช้าอากาศเย็นสบาย ลมโชยสดชื่น" : "อากาศอุ่นมีลมทะเลขับความร้อน",
        tideMsl: tide.hourlyTide[getBangkokHour()] ?? tide.hourlyTide[14],
        tideTrend: (tide.hourlyTide[(getBangkokHour() + 1) % 24] ?? 0) >= (tide.hourlyTide[getBangkokHour()] ?? 0) ? "rising" : "falling",
        highTideMsl: tide.highTideMsl,
        highTideTime: tide.highTideTime,
        lowTideMsl: tide.lowTideMsl,
        lowTideTime: tide.lowTideTime,
        waveHeightM,
        seaStateLabel: waveHeightM >= 1.2 ? "คลื่นปานกลาง เรือเล็กควรเพิ่มความระมัดระวัง" : "ทะเลเรียบถึงมีคลื่นเล็กน้อย เที่ยวชายหาดและเดินเรือได้ปกติ",
      },
      hourly,
      daily,
    };
  });

  return {
    fetchedAt: new Date().toISOString(),
    sourceMode: "hybrid-fallback",
    areas,
  };
}
/** Always compute Bangkok (UTC+7) hour (0..23) regardless of server/cloud timezone (Vercel UTC). */
export function getBangkokHour(date = new Date()): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      hour12: false,
    });
    return parseInt(formatter.format(date), 10) % 24;
  } catch {
    return (date.getUTCHours() + 7) % 24;
  }
}

/** Always compute Bangkok (UTC+7) clock string "HH:MM" regardless of server/cloud timezone. */
export function getBangkokClockText(date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return formatter.format(date);
  } catch {
    const h = String((date.getUTCHours() + 7) % 24).padStart(2, "0");
    const m = String(date.getUTCMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
}
