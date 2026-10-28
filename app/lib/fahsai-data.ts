export type TopicId =
  | "rain"
  | "sky"
  | "tide"
  | "wave"
  | "air"
  | "heat"
  | "winter"
  | "tourism"
  | "risk"
  | "suitable";

export type RegionId =
  | "all"
  | "north"
  | "northeast"
  | "central"
  | "east"
  | "west"
  | "south-gulf"
  | "south-andaman";

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
  cloudPct: number;
  uvIndex: number;
}

export interface DailyPoint {
  dayLabel: string;
  maxTempC: number;
  minTempC: number;
  rainProb: number;
  rainMm: number;
  pm25Avg: number;
  uvMax: number;
  tourismScore: number;
  waveMaxM: number;
}

export interface LifestyleMetrics {
  laundryScore: number;
  laundryLabel: string;
  outdoorScore: number;
  outdoorLabel: string;
  campingScore: number;
  campingLabel: string;
  marineScore: number;
  marineLabel: string;
  carWashScore: number;
  carWashLabel: string;
  solarScore: number;
  solarLabel: string;
}

export interface AreaForecast {
  id: string;
  name: string;
  subtitle: string;
  regionId: Exclude<RegionId, "all">;
  regionName: string;
  zoneType: "metro" | "coastal" | "mountain" | "inland";
  isCoastal: boolean;
  seaBasin: "upper-gulf" | "lower-gulf" | "andaman" | "inland";
  elevationM: number;
  lat: number;
  lng: number;
  mapX: number;
  mapY: number;
  coastalNote: string;
  tourismHighlights: string[];
  bestActivity: string;
  current: {
    tempC: number;
    feelsLikeC: number;
    minMorningC: number;
    maxAfternoonC: number;
    humidity: number;
    pressureHpa: number;
    visibilityKm: number;
    cloudCoverPct: number;
    skyStateLabel: string;
    rainProb: number;
    rain24hMm: number;
    radarDbz: number;
    pm25: number;
    aqi: number;
    uvIndex: number;
    windKmh: number;
    windGustKmh: number;
    windDirLabel: string;
    windDeg: number;
    coolIndexLabel: string;
    mistChancePct: number;
    tideMsl: number;
    tideTrend: "rising" | "falling" | "high" | "low";
    highTideMsl: number;
    highTideTime: string;
    lowTideMsl: number;
    lowTideTime: string;
    tideStatusLabel: string;
    waveHeightM: number;
    seaStateLabel: string;
    marineSafetyLabel: string;
    tourismScore: number;
    tourismBadge: string;
    suitabilityScore: number;
    suitabilityTags: string[];
    multiHazardTier: 1 | 2 | 3 | 4 | 5;
    primaryHazardLabel: string;
    hazardAdvice: string;
    lifestyle: LifestyleMetrics;
  };
  hourly: HourlyPoint[];
  daily: DailyPoint[];
}

export interface FahSaiPayload {
  fetchedAt: string;
  sourceMode: "live-open-meteo" | "hybrid-fallback";
  areas: AreaForecast[];
}

export interface ThailandAreaMeta {
  id: string;
  name: string;
  subtitle: string;
  regionId: Exclude<RegionId, "all">;
  regionName: string;
  zoneType: "metro" | "coastal" | "mountain" | "inland";
  isCoastal: boolean;
  seaBasin: "upper-gulf" | "lower-gulf" | "andaman" | "inland";
  elevationM: number;
  lat: number;
  lng: number;
  mapX: number;
  mapY: number;
  coastalNote: string;
  tourismHighlights: string[];
  bestActivity: string;
  tideAmp: number;
  tidePhase: number;
  baseWaveM: number;
  baseTempC: number;
  baseMinC: number;
  baseRainProb: number;
  basePm25: number;
}

export const REGIONS: { id: RegionId; label: string; icon: string; desc: string }[] = [
  { id: "all", label: "ทั่วประเทศ (24 จังหวัดหลัก)", icon: "🇹🇭", desc: "ภาพรวมสภาพอากาศ ทะเล และความเหมาะสมทั้งประเทศไทย" },
  { id: "north", label: "ภาคเหนือ", icon: "⛰️", desc: "ยอดดอย ทะเลหมอก ลมหนาว และแอ่งเมืองล้านนา" },
  { id: "northeast", label: "ภาคอีสาน", icon: "🌾", desc: "ที่ราบสูง ริมโขง อุทยานเขาใหญ่ และลมมรสุมตะวันออกเฉียงเหนือ" },
  { id: "central", label: "ภาคกลาง & กทม.", icon: "🏙️", desc: "กรุงเทพฯ ปริมณฑล เมืองมรดกโลก และปากแม่น้ำอ่าวไทยตอนบน" },
  { id: "east", label: "ภาคตะวันออก", icon: "🏖️", desc: "ชายฝั่งชลบุรี ระยอง จันทบุรี ตราด และหมู่เกาะทะเลตะวันออก" },
  { id: "west", label: "ภาคตะวันตก", icon: "🏞️", desc: "ผืนป่ากาญจนบุรี เทือกเขาตะนาวศรี และชายหาดหัวหิน–ชะอำ" },
  { id: "south-gulf", label: "ภาคใต้ (อ่าวไทย)", icon: "🌴", desc: "หมู่เกาะสมุย–พะงัน–เต่า ขนอม และชายฝั่งอ่าวไทยตอนล่าง" },
  { id: "south-andaman", label: "ภาคใต้ (อันดามัน)", icon: "⛵", desc: "ภูเก็ต กระบี่ พังงา สิมิลัน และทะเลเปิดอันดามัน" },
];

export const THAILAND_AREAS: ThailandAreaMeta[] = [
  // ================= ภาคเหนือ (NORTH) =================
  {
    id: "chiang-mai",
    name: "เชียงใหม่",
    subtitle: "ดอยอินทนนท์ · แม่ริม · นิมมาน · แม่กำปอง",
    regionId: "north",
    regionName: "ภาคเหนือ",
    zoneType: "mountain",
    isCoastal: false,
    seaBasin: "inland",
    elevationM: 310,
    lat: 18.7883,
    lng: 98.9853,
    mapX: 162,
    mapY: 118,
    coastalNote: "แอ่งที่ราบหุบเขาและยอดดอยสูง อากาศเย็นสบายช่วงเช้า มีโอกาสเกิดทะเลหมอกสูงบนดอย",
    tourismHighlights: ["ยอดดอยอินทนนท์", "หมู่บ้านแม่กำปอง", "ม่อนแจ่ม", "ประตูท่าแพ"],
    bestActivity: "ชมทะเลหมอกแสงเช้า ยอดดอย & จิบกาแฟคาเฟ่ในหุบเขา",
    tideAmp: 0,
    tidePhase: 0,
    baseWaveM: 0,
    baseTempC: 28.4,
    baseMinC: 18.5,
    baseRainProb: 22,
    basePm25: 21.5,
  },
  {
    id: "chiang-rai",
    name: "เชียงราย",
    subtitle: "ภูชี้ฟ้า · ดอยตุง · แม่สาย · เชียงแสน",
    regionId: "north",
    regionName: "ภาคเหนือ",
    zoneType: "mountain",
    isCoastal: false,
    seaBasin: "inland",
    elevationM: 390,
    lat: 19.9105,
    lng: 99.8406,
    mapX: 205,
    mapY: 64,
    coastalNote: "พื้นที่เหนือสุดของไทย รับมวลอากาศเย็นระลอกแรกจากจีน อุณหภูมิเช้ามืดลดต่ำสุด",
    tourismHighlights: ["ภูชี้ฟ้า", "พระตำหนักดอยตุง", "สามเหลี่ยมทองคำ", "ไร่ชาฉุยฟง"],
    bestActivity: "รับลมหนาวระลอกแรก ชมทะเลหมอกภูชี้ฟ้า & เที่ยวไร่ชา",
    tideAmp: 0,
    tidePhase: 0,
    baseWaveM: 0,
    baseTempC: 27.2,
    baseMinC: 17.2,
    baseRainProb: 20,
    basePm25: 19.0,
  },
  {
    id: "mae-hong-son",
    name: "แม่ฮ่องสอน · ปาย",
    subtitle: "ปาย · ปางอุ๋ง · บ้านรักไทย · กลอเซโล",
    regionId: "north",
    regionName: "ภาคเหนือ",
    zoneType: "mountain",
    isCoastal: false,
    seaBasin: "inland",
    elevationM: 520,
    lat: 19.3020,
    lng: 97.9654,
    mapX: 112,
    mapY: 94,
    coastalNote: "เมืองสามหมอกกลางหุบเขาสลับซับซ้อน อากาศหนาวเย็นและมีหมอกปกคลุมเหนือผิวน้ำยามเช้า",
    tourismHighlights: ["ปางอุ๋ง", "บ้านรักไทย", "ถนนคนเดินปาย", "จุดชมวิวหยุนไหล"],
    bestActivity: "ล่องแพชมหมอกเหนือน้ำปางอุ๋ง & แคมป์ปิ้งดูดาว",
    tideAmp: 0,
    tidePhase: 0,
    baseWaveM: 0,
    baseTempC: 26.8,
    baseMinC: 16.8,
    baseRainProb: 18,
    basePm25: 16.5,
  },
  {
    id: "nan",
    name: "น่าน",
    subtitle: "ดอยเสมอดาว · บ่อเกลือ · ปัว · สะปัน",
    regionId: "north",
    regionName: "ภาคเหนือ",
    zoneType: "mountain",
    isCoastal: false,
    seaBasin: "inland",
    elevationM: 280,
    lat: 18.7756,
    lng: 100.7730,
    mapX: 252,
    mapY: 120,
    coastalNote: "ขุนเขาตะวันออกของล้านนา ท้องฟ้ามืดสนิทเหมาะแก่การดูดาวและรับลมหนาว",
    tourismHighlights: ["หมู่บ้านสะปัน", "ดอยเสมอดาว", "บ่อเกลือสินเธาว์", "วัดภูมินทร์"],
    bestActivity: "นอนดูดาวดอยเสมอดาว & พักผ่อนริมลำธารหมู่บ้านสะปัน",
    tideAmp: 0,
    tidePhase: 0,
    baseWaveM: 0,
    baseTempC: 28.0,
    baseMinC: 18.2,
    baseRainProb: 20,
    basePm25: 18.0,
  },

  // ================= ภาคอีสาน (NORTHEAST / ISAN) =================
  {
    id: "loei",
    name: "เลย · เชียงคาน",
    subtitle: "ภูกระดึง · เชียงคาน · ภูเรือ · ภูทอก",
    regionId: "northeast",
    regionName: "ภาคอีสาน",
    zoneType: "mountain",
    isCoastal: false,
    seaBasin: "inland",
    elevationM: 260,
    lat: 17.4860,
    lng: 101.7223,
    mapX: 298,
    mapY: 182,
    coastalNote: "ดินแดนแห่งขุนเขาและสายหมอกริมแม่น้ำโขง อุณหภูมิยอดภูหนาวจัดในฤดูหนาว",
    tourismHighlights: ["อุทยานแห่งชาติภูกระดึง", "ถนนคนเดินเชียงคาน", "ทะเลหมอกภูทอก", "ยอดภูเรือ"],
    bestActivity: "เดินป่าพิชิตยอดภูกระดึง & ปั่นจักรยานเลียบโขงเชียงคาน",
    tideAmp: 0,
    tidePhase: 0,
    baseWaveM: 0,
    baseTempC: 28.2,
    baseMinC: 17.8,
    baseRainProb: 18,
    basePm25: 19.5,
  },
  {
    id: "khon-kaen",
    name: "ขอนแก่น",
    subtitle: "เมืองขอนแก่น · บึงแก่นนคร · เขื่อนอุบลรัตน์",
    regionId: "northeast",
    regionName: "ภาคอีสาน",
    zoneType: "inland",
    isCoastal: false,
    seaBasin: "inland",
    elevationM: 185,
    lat: 16.4322,
    lng: 102.8236,
    mapX: 352,
    mapY: 232,
    coastalNote: "ศูนย์กลางภาคอีสาน ลมมรสุมตะวันออกเฉียงเหนือพัดผ่านต่อเนื่อง ฟ้าโปร่งแดดจัด",
    tourismHighlights: ["เขื่อนอุบลรัตน์", "พระมหาธาตุแก่นนคร", "ภูผาม่าน", "บางแสน 2"],
    bestActivity: "ชมวิวภูผาม่าน & ล่องแพเขื่อนอุบลรัตน์",
    tideAmp: 0,
    tidePhase: 0,
    baseWaveM: 0,
    baseTempC: 31.2,
    baseMinC: 21.6,
    baseRainProb: 24,
    basePm25: 24.0,
  },
  {
    id: "nakhon-ratchasima",
    name: "นครราชสีมา · เขาใหญ่",
    subtitle: "เขาใหญ่ · ปากช่อง · วังน้ำเขียว · เมืองโคราช",
    regionId: "northeast",
    regionName: "ภาคอีสาน",
    zoneType: "mountain",
    isCoastal: false,
    seaBasin: "inland",
    elevationM: 350,
    lat: 14.9799,
    lng: 102.0978,
    mapX: 316,
    mapY: 302,
    coastalNote: "ผืนป่ามรดกโลกดงพญาเย็น–เขาใหญ่ อากาศบริสุทธิ์โอโซนสูง เย็นสบายใกล้กรุงเทพฯ",
    tourismHighlights: ["อุทยานแห่งชาติเขาใหญ่", "ผาเดียวดาย", "วังน้ำเขียว", "ไร่องุ่นปากช่อง"],
    bestActivity: "แคมป์ปิ้งส่องสัตว์เขาใหญ่ & พักผ่อนสูดอากาศบริสุทธิ์",
    tideAmp: 0,
    tidePhase: 0,
    baseWaveM: 0,
    baseTempC: 29.0,
    baseMinC: 19.8,
    baseRainProb: 28,
    basePm25: 17.5,
  },
  {
    id: "ubon-ratchathani",
    name: "อุบลราชธานี",
    subtitle: "ผาแต้ม · โขงเจียม · สามพันโบก · สิรินธร",
    regionId: "northeast",
    regionName: "ภาคอีสาน",
    zoneType: "inland",
    isCoastal: false,
    seaBasin: "inland",
    elevationM: 135,
    lat: 15.2287,
    lng: 104.8564,
    mapX: 452,
    mapY: 290,
    coastalNote: "ตะวันออกสุดของไทย รับลมหนาวและแสงอาทิตย์แรกของวันริมฝั่งแม่น้ำโขง",
    tourismHighlights: ["อุทยานแห่งชาติผาแต้ม", "สามพันโบก", "แม่น้ำสองสีโขงเจียม", "วัดสิรินธรวรารามภูพร้าว"],
    bestActivity: "ชมแสงแรกแห่งสยามที่ผาแต้ม & ชมวัดเรืองแสงยามค่ำ",
    tideAmp: 0,
    tidePhase: 0,
    baseWaveM: 0,
    baseTempC: 30.8,
    baseMinC: 21.0,
    baseRainProb: 25,
    basePm25: 18.5,
  },

  // ================= ภาคกลาง & กรุงเทพฯ–ปริมณฑล (CENTRAL & METRO) =================
  {
    id: "phetchabun",
    name: "เพชรบูรณ์ · เขาค้อ",
    subtitle: "เขาค้อ · ภูทับเบิก · น้ำหนาว · วัดผาซ่อนแก้ว",
    regionId: "central",
    regionName: "ภาคกลาง & กทม.",
    zoneType: "mountain",
    isCoastal: false,
    seaBasin: "inland",
    elevationM: 780,
    lat: 16.4190,
    lng: 101.1560,
    mapX: 270,
    mapY: 232,
    coastalNote: "เทือกเขาเพชรบูรณ์ความสูง 800–1,768 ม. อากาศเย็นตลอดปีและเกิดทะเลหมอกหลังฝน",
    tourismHighlights: ["ภูทับเบิก", "วัดพระธาตุผาซ่อนแก้ว", "ทุ่งกังหันลมเขาค้อ", "อุทยานแห่งชาติน้ำหนาว"],
    bestActivity: "ชมทะเลหมอก 360 องศาที่ภูทับเบิก & ไหว้พระผาซ่อนแก้ว",
    tideAmp: 0,
    tidePhase: 0,
    baseWaveM: 0,
    baseTempC: 25.6,
    baseMinC: 16.5,
    baseRainProb: 30,
    basePm25: 16.0,
  },
  {
    id: "ayutthaya",
    name: "พระนครศรีอยุธยา",
    subtitle: "อุทยานประวัติศาสตร์ · บางปะอิน · ตลาดน้ำ",
    regionId: "central",
    regionName: "ภาคกลาง & กทม.",
    zoneType: "inland",
    isCoastal: false,
    seaBasin: "inland",
    elevationM: 6,
    lat: 14.3532,
    lng: 100.5684,
    mapX: 242,
    mapY: 332,
    coastalNote: "ที่ราบลุ่มภาคกลางจุดบรรจบแม่น้ำสายหลัก แดดจัดช่วงบ่าย ลมโชยริมน้ำช่วงเย็น",
    tourismHighlights: ["วัดไชยวัฒนาราม", "วัดมหาธาตุ", "พระราชวังบางปะอิน", "ตลาดกุ้งอยุธยา"],
    bestActivity: "แต่งชุดไทยชมโบราณสถานยามเย็น & ล่องเรือทานอาหารริมน้ำ",
    tideAmp: 0.35,
    tidePhase: 2.6,
    baseWaveM: 0.15,
    baseTempC: 32.4,
    baseMinC: 23.8,
    baseRainProb: 32,
    basePm25: 27.5,
  },
  {
    id: "nonthaburi",
    name: "นนทบุรี · ปทุมธานี",
    subtitle: "ปากเกร็ด · เกาะเกร็ด · รังสิต · บางใหญ่",
    regionId: "central",
    regionName: "ภาคกลาง & กทม.",
    zoneType: "metro",
    isCoastal: false,
    seaBasin: "upper-gulf",
    elevationM: 4,
    lat: 13.8621,
    lng: 100.5144,
    mapX: 238,
    mapY: 356,
    coastalNote: "พื้นที่เมืองปริมณฑลตอนบนของกรุงเทพฯ รับอิทธิพลน้ำหนุนปลายน้ำและฝุ่นสะสมช่วงลมสงบ",
    tourismHighlights: ["เกาะเกร็ด", "ท่าน้ำนนท์", "วัดบรมราชากาญจนาภิเษกฯ", "สวนสมเด็จฯ"],
    bestActivity: "ปั่นจักรยานเที่ยวเกาะเกร็ด & ชมวิถีชีวิตริมน้ำ",
    tideAmp: 0.92,
    tidePhase: 1.8,
    baseWaveM: 0.25,
    baseTempC: 32.2,
    baseMinC: 24.0,
    baseRainProb: 35,
    basePm25: 29.0,
  },
  {
    id: "bangkok",
    name: "กรุงเทพมหานคร",
    subtitle: "พระนคร · สาทร · สุขุมวิท · ลาดพร้าว · บางนา",
    regionId: "central",
    regionName: "ภาคกลาง & กทม.",
    zoneType: "metro",
    isCoastal: false,
    seaBasin: "upper-gulf",
    elevationM: 2,
    lat: 13.7563,
    lng: 100.5018,
    mapX: 238,
    mapY: 364,
    coastalNote: "มหานครศูนย์กลางของประเทศ รับอิทธิพลทั้งลมทะเลอ่าวไทย น้ำทะเลหนุน และปรากฏการณ์เกาะความร้อนเมือง",
    tourismHighlights: ["วัดพระแก้ว & วัดอรุณฯ", "สวนเบญจกิติ", "เยาวราช", "ไอคอนสยาม"],
    bestActivity: "เดินเล่นสวนสาธารณะ วิ่งออกกำลังกาย & ล่องเรือชมวิวแม่น้ำยามค่ำ",
    tideAmp: 1.18,
    tidePhase: 1.2,
    baseWaveM: 0.35,
    baseTempC: 32.8,
    baseMinC: 24.5,
    baseRainProb: 42,
    basePm25: 31.2,
  },
  {
    id: "samut-prakan",
    name: "สมุทรปราการ · สมุทรสาคร",
    subtitle: "บางปู · ปากน้ำ · พระสมุทรเจดีย์ · มหาชัย",
    regionId: "central",
    regionName: "ภาคกลาง & กทม.",
    zoneType: "coastal",
    isCoastal: true,
    seaBasin: "upper-gulf",
    elevationM: 1.5,
    lat: 13.5991,
    lng: 100.5968,
    mapX: 244,
    mapY: 374,
    coastalNote: "ด่านหน้าชายฝั่งอ่าวไทยตอนบนและปากแม่น้ำ เฝ้าระวังระดับน้ำทะเลหนุนสูงสุดตามรอบดวงจันทร์",
    tourismHighlights: ["สถานตากอากาศบางปู", "เมืองโบราณ", "ตลาดทะเลไทยมหาชัย", "สะพานแดงชมโลมา"],
    bestActivity: "ชมนกนางนวลและพระอาทิตย์ตกที่บางปู & ทานอาหารทะเลสด",
    tideAmp: 1.48,
    tidePhase: 0.4,
    baseWaveM: 0.68,
    baseTempC: 31.4,
    baseMinC: 24.8,
    baseRainProb: 45,
    basePm25: 24.5,
  },

  // ================= ภาคตะวันตก (WEST) =================
  {
    id: "kanchanaburi",
    name: "กาญจนบุรี",
    subtitle: "สังขละบุรี · น้ำตกเอราวัณ · ไทรโยค · เขื่อนศรีนครินทร์",
    regionId: "west",
    regionName: "ภาคตะวันตก",
    zoneType: "mountain",
    isCoastal: false,
    seaBasin: "inland",
    elevationM: 120,
    lat: 14.0228,
    lng: 99.5328,
    mapX: 190,
    mapY: 348,
    coastalNote: "ผืนป่าตะวันตกและอ่างเก็บน้ำขนาดใหญ่ กลางวันแดดอุ่น กลางคืนและเช้ามืดริมน้ำอากาศเย็น",
    tourismHighlights: ["สะพานมอญ สังขละบุรี", "น้ำตกเอราวัณ", "สะพานข้ามแม่น้ำแคว", "เขื่อนศรีนครินทร์"],
    bestActivity: "ล่องแพพักผ่อนริมน้ำแคว & ชมหมอกเช้าสะพานมอญสังขละบุรี",
    tideAmp: 0,
    tidePhase: 0,
    baseWaveM: 0,
    baseTempC: 31.6,
    baseMinC: 21.2,
    baseRainProb: 26,
    basePm25: 19.5,
  },
  {
    id: "prachuap",
    name: "ประจวบคีรีขันธ์ · หัวหิน",
    subtitle: "หัวหิน · ปราณบุรี · สามร้อยยอด · อ่าวมะนาว",
    regionId: "west",
    regionName: "ภาคตะวันตก",
    zoneType: "coastal",
    isCoastal: true,
    seaBasin: "upper-gulf",
    elevationM: 5,
    lat: 12.5684,
    lng: 99.9577,
    mapX: 212,
    mapY: 420,
    coastalNote: "ชายฝั่งอ่าวไทยด้านตะวันตก ทะเลโปร่ง ลมทะเลพัดสม่ำเสมอ เหมาะแก่การตากอากาศและกีฬาทางน้ำ",
    tourismHighlights: ["ชายหาดหัวหิน", "เขากะโหลก ปราณบุรี", "ถ้ำพระยานคร สามร้อยยอด", "อ่าวมะนาว"],
    bestActivity: "ขี่ม้าชายหาดหัวหิน เล่นเซิร์ฟ/ไคท์เซิร์ฟปราณบุรี & พักผ่อนริมทะเล",
    tideAmp: 1.38,
    tidePhase: 0.5,
    baseWaveM: 0.78,
    baseTempC: 30.6,
    baseMinC: 24.0,
    baseRainProb: 30,
    basePm25: 16.8,
  },

  // ================= ภาคตะวันออก (EAST) =================
  {
    id: "chonburi",
    name: "ชลบุรี · พัทยา",
    subtitle: "บางแสน · พัทยา · เกาะล้าน · สัตหีบ · แสมสาร",
    regionId: "east",
    regionName: "ภาคตะวันออก",
    zoneType: "coastal",
    isCoastal: true,
    seaBasin: "upper-gulf",
    elevationM: 8,
    lat: 13.2847,
    lng: 100.9154,
    mapX: 258,
    mapY: 388,
    coastalNote: "ชายฝั่งท่องเที่ยวและท่าเรือหลักอ่าวไทยฝั่งตะวันออก คลื่นลมและระดับน้ำขึ้นลงชัดเจน",
    tourismHighlights: ["เกาะล้าน พัทยา", "หาดบางแสน", "หาดน้ำใส สัตหีบ", "จุดชมวิวเขาสามมุข"],
    bestActivity: "ข้ามเรือเที่ยวเกาะล้าน เล่นน้ำทะเลสัตหีบ & ชมพระอาทิตย์ตกบางแสน",
    tideAmp: 1.46,
    tidePhase: 0.2,
    baseWaveM: 0.82,
    baseTempC: 31.0,
    baseMinC: 24.6,
    baseRainProb: 38,
    basePm25: 21.0,
  },
  {
    id: "rayong",
    name: "ระยอง · เกาะเสม็ด",
    subtitle: "เกาะเสม็ด · แหลมแม่พิมพ์ · หาดแม่รำพึง · ปากน้ำประแส",
    regionId: "east",
    regionName: "ภาคตะวันออก",
    zoneType: "coastal",
    isCoastal: true,
    seaBasin: "upper-gulf",
    elevationM: 6,
    lat: 12.6814,
    lng: 101.2816,
    mapX: 278,
    mapY: 416,
    coastalNote: "ชายหาดยาวและเกาะเสม็ดซึ่งเป็นเกาะที่มีปริมาณฝนน้อยกว่าแผ่นดินใหญ่ น้ำทะเลใสตลอดปี",
    tourismHighlights: ["อุทยานแห่งชาติเขาแหลมหญ้า–หมู่เกาะเสม็ด", "หาดทรายแก้ว", "ทุ่งโปรงทอง", "สวนพฤกษศาสตร์ระยอง"],
    bestActivity: "พายคายัค ดำน้ำตื้นเกาะเสม็ด & เดินสะพานไม้ทุ่งโปรงทอง",
    tideAmp: 1.40,
    tidePhase: 0.3,
    baseWaveM: 0.88,
    baseTempC: 30.8,
    baseMinC: 24.4,
    baseRainProb: 34,
    basePm25: 18.5,
  },
  {
    id: "trat",
    name: "ตราด · เกาะช้าง · เกาะกูด",
    subtitle: "หมู่เกาะช้าง · เกาะกูด · เกาะหมาก · แหลมงอบ",
    regionId: "east",
    regionName: "ภาคตะวันออก",
    zoneType: "coastal",
    isCoastal: true,
    seaBasin: "upper-gulf",
    elevationM: 10,
    lat: 12.2428,
    lng: 102.5175,
    mapX: 338,
    mapY: 438,
    coastalNote: "หมู่เกาะทะเลตะวันออก น้ำทะเลใสสีมรกต ช่วงปลายฝนต้นหนาวทะเลจะเรียบและใสที่สุด",
    tourismHighlights: ["เกาะกูด", "อุทยานแห่งชาติหมู่เกาะช้าง", "เกาะหมาก", "หมู่บ้านประมงอ่าวสลักเพชร"],
    bestActivity: "พักผ่อนหาดน้ำใสเกาะกูด ดำน้ำดูปะการัง & พายซัพบอร์ด",
    tideAmp: 1.35,
    tidePhase: 0.4,
    baseWaveM: 0.92,
    baseTempC: 30.2,
    baseMinC: 23.8,
    baseRainProb: 44,
    basePm25: 14.5,
  },

  // ================= ภาคใต้ฝั่งอ่าวไทย (SOUTH - GULF) =================
  {
    id: "surat-thani",
    name: "สุราษฎร์ธานี · เกาะสมุย",
    subtitle: "เกาะสมุย · เกาะพะงัน · เกาะเต่า · เขื่อนเชี่ยวหลาน",
    regionId: "south-gulf",
    regionName: "ภาคใต้ (อ่าวไทย)",
    zoneType: "coastal",
    isCoastal: true,
    seaBasin: "lower-gulf",
    elevationM: 12,
    lat: 9.5120,
    lng: 100.0136,
    mapX: 214,
    mapY: 570,
    coastalNote: "หมู่เกาะกลางอ่าวไทยและเขื่อนรัชชประภา รับอิทธิพลลมมรสุมตะวันออกเฉียงเหนือช่วงปลายปี",
    tourismHighlights: ["หมู่เกาะอ่างทอง", "เกาะสมุย & เกาะเต่า", "เขื่อนรัชชประภา (เชี่ยวหลาน)", "อุทยานแห่งชาติเขาสก"],
    bestActivity: "ล่องเรือชมกุ้ยหลินเมืองไทย เขื่อนเชี่ยวหลาน & ดำน้ำเกาะเต่า",
    tideAmp: 1.32,
    tidePhase: 0.9,
    baseWaveM: 1.05,
    baseTempC: 29.8,
    baseMinC: 24.2,
    baseRainProb: 48,
    basePm25: 13.0,
  },
  {
    id: "nakhon-si",
    name: "นครศรีธรรมราช · ขนอม",
    subtitle: "หมู่บ้านคีรีวง · หาดขนอม · สิชล · วัดพระมหาธาตุ",
    regionId: "south-gulf",
    regionName: "ภาคใต้ (อ่าวไทย)",
    zoneType: "coastal",
    isCoastal: true,
    seaBasin: "lower-gulf",
    elevationM: 18,
    lat: 8.4304,
    lng: 99.9631,
    mapX: 212,
    mapY: 622,
    coastalNote: "ขุนเขาหลวงคู่ชายฝั่งอ่าวไทย หมู่บ้านคีรีวงขึ้นชื่อเรื่องคุณภาพอากาศสะอาดที่สุดในไทย",
    tourismHighlights: ["หมู่บ้านคีรีวง", "ถนนเลียบทะเลขนอม–สิชล", "วัดพระมหาธาตุวรมหาวิหาร", "จุดชมโลมาสีชมพู"],
    bestActivity: "สูดอากาศบริสุทธิ์ที่คีรีวง & ขับรถชมวิวถนนเลียบทะเลขนอม–สิชล",
    tideAmp: 1.28,
    tidePhase: 1.1,
    baseWaveM: 1.10,
    baseTempC: 29.6,
    baseMinC: 23.6,
    baseRainProb: 50,
    basePm25: 11.5,
  },
  {
    id: "songkhla",
    name: "สงขลา · หาดใหญ่",
    subtitle: "หาดสมิหลา · เมืองเก่าสงขลา · หาดใหญ่ · เกาะยอ",
    regionId: "south-gulf",
    regionName: "ภาคใต้ (อ่าวไทย)",
    zoneType: "coastal",
    isCoastal: true,
    seaBasin: "lower-gulf",
    elevationM: 8,
    lat: 7.1898,
    lng: 100.5954,
    mapX: 242,
    mapY: 682,
    coastalNote: "ชายฝั่งอ่าวไทยตอนล่างเชื่อมต่อทะเลสาบสงขลา ลมทะเลพัดแรงและระบายอากาศดีเยี่ยม",
    tourismHighlights: ["หาดสมิหลา", "ย่านเมืองเก่าสงขลา", "เขาตังกวน", "ตลาดกิมหยง หาดใหญ่"],
    bestActivity: "เดินเที่ยวเมืองเก่าสงขลา ชมวิวเขาตังกวน & ลิ้มรสอาหารใต้หาดใหญ่",
    tideAmp: 1.22,
    tidePhase: 1.3,
    baseWaveM: 1.15,
    baseTempC: 29.9,
    baseMinC: 24.0,
    baseRainProb: 52,
    basePm25: 13.5,
  },

  // ================= ภาคใต้ฝั่งอันดามัน (SOUTH - ANDAMAN) =================
  {
    id: "phang-nga",
    name: "พังงา · สิมิลัน",
    subtitle: "เขาหลัก · หมู่เกาะสิมิลัน · หมู่เกาะสุรินทร์ · เสม็ดนางชี",
    regionId: "south-andaman",
    regionName: "ภาคใต้ (อันดามัน)",
    zoneType: "coastal",
    isCoastal: true,
    seaBasin: "andaman",
    elevationM: 10,
    lat: 8.4501,
    lng: 98.5255,
    mapX: 142,
    mapY: 620,
    coastalNote: "ทะเลอันดามันตอนบน พิสัยน้ำขึ้น–ลงชัดเจน ช่วงพ.ย.–เม.ย. ทะเลอันดามันสงบและน้ำใสระดับโลก",
    tourismHighlights: ["อุทยานแห่งชาติหมู่เกาะสิมิลัน", "จุดชมวิวเสม็ดนางชี", "หมู่เกาะสุรินทร์", "ชายหาดเขาหลัก"],
    bestActivity: "ดำน้ำหมู่เกาะสิมิลัน–สุรินทร์ & ชมพระอาทิตย์ขึ้นเสม็ดนางชี",
    tideAmp: 1.85,
    tidePhase: 0.7,
    baseWaveM: 0.85,
    baseTempC: 29.8,
    baseMinC: 23.8,
    baseRainProb: 36,
    basePm25: 12.0,
  },
  {
    id: "phuket",
    name: "ภูเก็ต",
    subtitle: "แหลมพรหมเทพ · หาดป่าตอง · กะรน · เมืองเก่าภูเก็ต",
    regionId: "south-andaman",
    regionName: "ภาคใต้ (อันดามัน)",
    zoneType: "coastal",
    isCoastal: true,
    seaBasin: "andaman",
    elevationM: 12,
    lat: 7.8804,
    lng: 98.3923,
    mapX: 135,
    mapY: 648,
    coastalNote: "เกาะไข่มุกอันดามัน รับลมทะเลเปิดทั้งสองฝั่ง มีพิสัยน้ำขึ้น–ลงสูงกว่าอ่าวไทย",
    tourismHighlights: ["แหลมพรหมเทพ", "ย่านเมืองเก่าภูเก็ต (ชิโนโปรตุกีส)", "หาดกะตะ–กะรน", "เกาะเฮ & เกาะราชา"],
    bestActivity: "ล่องเรือยอชต์ชมพระอาทิตย์ตกแหลมพรหมเทพ & เดินเล่นเมืองเก่า",
    tideAmp: 1.95,
    tidePhase: 0.8,
    baseWaveM: 0.90,
    baseTempC: 30.2,
    baseMinC: 24.4,
    baseRainProb: 38,
    basePm25: 13.5,
  },
  {
    id: "krabi",
    name: "กระบี่ · เกาะพีพี",
    subtitle: "อ่าวนาง · ไร่เลย์ · หมู่เกาะพีพี · ทะเลแหวก · เกาะลันตา",
    regionId: "south-andaman",
    regionName: "ภาคใต้ (อันดามัน)",
    zoneType: "coastal",
    isCoastal: true,
    seaBasin: "andaman",
    elevationM: 8,
    lat: 8.0863,
    lng: 98.9063,
    mapX: 160,
    mapY: 638,
    coastalNote: "อ่าวกำบังด้วยภูเขาหินปูนน้อยใหญ่ จังหวะน้ำลงต่ำสุดจะเผยสันทราย “ทะเลแหวก” สวยงาม",
    tourismHighlights: ["หมู่เกาะพีพี & อ่าวมาหยา", "หาดไร่เลย์", "ทะเลแหวก (เกาะทับ–เกาะหม้อ)", "สระมรกต"],
    bestActivity: "เช็กเวลาน้ำลงเที่ยวทะเลแหวก พายคายัคอ่าวท่าเลน & เที่ยวเกาะพีพี",
    tideAmp: 1.90,
    tidePhase: 0.85,
    baseWaveM: 0.75,
    baseTempC: 30.0,
    baseMinC: 23.9,
    baseRainProb: 36,
    basePm25: 12.5,
  },
];

// Keep UPPER_GULF_AREAS exported as an alias to THAILAND_AREAS so any existing import continues to work seamlessly
export const UPPER_GULF_AREAS = THAILAND_AREAS;

export function windDirectionThai(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 22 && normalized < 68) return "ตะวันออกเฉียงเหนือ (ลมหนาว)";
  if (normalized >= 68 && normalized < 112) return "ตะวันออก";
  if (normalized >= 112 && normalized < 158) return "ตะวันออกเฉียงใต้ (ลมทะเล)";
  if (normalized >= 158 && normalized < 202) return "ใต้ (ลมทะเลอ่าวไทย)";
  if (normalized >= 202 && normalized < 248) return "ตะวันตกเฉียงใต้ (มรสุมอันดามัน)";
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
  if (amp <= 0.01) {
    return {
      hourlyTide: Array.from({ length: 24 }, () => 0),
      highTideMsl: 0,
      highTideTime: "พื้นที่ดอน/ภูเขา (ไม่มีอิทธิพลน้ำทะเลหนุน)",
      lowTideMsl: 0,
      lowTideTime: "ระบายน้ำตามความลาดชันธรรมชาติ",
    };
  }
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

export function computeAreaIntelligence(params: {
  meta: ThailandAreaMeta;
  tempC: number;
  feelsLikeC: number;
  minMorningC: number;
  maxAfternoonC: number;
  humidity: number;
  rainProb: number;
  rain24hMm: number;
  pm25: number;
  aqi: number;
  uvIndex: number;
  windKmh: number;
  windGustKmh: number;
  windDeg: number;
  curTide: number;
  nextTide: number;
  highTideMsl: number;
  highTideTime: string;
  lowTideMsl: number;
  lowTideTime: string;
  waveHeightM: number;
}) {
  const {
    meta,
    tempC,
    feelsLikeC,
    minMorningC,
    humidity,
    rainProb,
    rain24hMm,
    pm25,
    uvIndex,
    windKmh,
    curTide,
    nextTide,
    highTideMsl,
    highTideTime,
    waveHeightM,
  } = params;

  const cloudCoverPct = Math.min(98, Math.max(12, Math.round(rainProb * 0.85 + (humidity - 50) * 0.4)));
  const skyStateLabel =
    rainProb >= 60
      ? "🌧️ เมฆฝนปกคลุม มีฝนฟ้าคะนอง"
      : rainProb >= 35
        ? "⛅ เมฆเป็นส่วนมาก มีฝนโปรยปรายบางแห่ง"
        : cloudCoverPct <= 35
          ? "☀️ ฟ้าใสโปร่ง แดดสวยไร้เมฆฝน"
          : "🌤️ ฟ้าโปร่ง มีเมฆบางส่วน แสงสวยสบายตา";

  const pressureHpa = Number((1012.5 + (25 - minMorningC) * 0.45 - (rainProb / 100) * 3.2).toFixed(1));
  const visibilityKm = Number(
    Math.max(4.5, Math.min(20, 18 - (pm25 > 35 ? (pm25 - 35) * 0.14 : 0) - (rainProb > 50 ? 4.5 : 0))).toFixed(1)
  );
  const radarDbz = rainProb >= 65 ? 46 : rainProb >= 45 ? 37 : rainProb >= 30 ? 28 : 14;

  // Morning mist / fog chance (especially for mountain / northern / riverside areas)
  const mistChancePct = Math.min(
    95,
    Math.max(
      10,
      Math.round(
        (meta.zoneType === "mountain" ? 55 : 20) +
          (minMorningC <= 20 ? 25 : minMorningC <= 23 ? 12 : 0) +
          (humidity >= 70 ? 12 : 0) -
          (windKmh > 25 ? 15 : 0)
      )
    )
  );

  const coolIndexLabel =
    minMorningC <= 18.5
      ? `❄️ อากาศหนาวสดชื่น (${minMorningC}°C) โอกาสชมทะเลหมอกสูง ${mistChancePct}%`
      : minMorningC <= 22.5
        ? `🍃 เช้าอากาศเย็นสบาย (${minMorningC}°C) ลมโชยสดชื่น น่าเดินรับลม`
        : minMorningC <= 25.0
          ? `🌤️ อากาศโปร่งสบายปลายฝนต้นหนาว ลมระบายอากาศดี`
          : `☀️ อากาศอบอุ่น มีลมธรรมชาติช่วยพัดระบายความร้อน`;

  const tideTrend: "rising" | "falling" = nextTide >= curTide ? "rising" : "falling";
  const tideStatusLabel = !meta.isCoastal && meta.tideAmp <= 0.01
    ? "⛰️ พื้นที่ดอน/ภูเขา พ้นเขตอิทธิพลน้ำทะเลหนุน"
    : highTideMsl >= 1.55
      ? `🌊 เฝ้าระวังน้ำทะเลหนุนสูง (+${highTideMsl} ม. รทก. เวลา ${highTideTime})`
      : highTideMsl >= 1.25
        ? `⚓ น้ำขึ้น–ลงตามเกณฑ์ปกติ (สูงสุด +${highTideMsl} ม. เวลา ${highTideTime})`
        : `💧 ระดับน้ำค่อยๆ เปลี่ยนแปลงตามจังหวะน้ำขึ้น–ลง`;

  const seaStateLabel = !meta.isCoastal
    ? "🏞️ พื้นที่บก/แหล่งน้ำจืด (คลื่นลมอ้างอิงอ่าวไทย/อันดามันใกล้เคียง)"
    : waveHeightM >= 1.5
      ? "🌊 คลื่นค่อนข้างแรง (1.5+ ม.) เรือเล็กและเรือท่องเที่ยวควรงดออกจากฝั่ง"
      : waveHeightM >= 1.0
        ? "⛵ ทะเลมีคลื่นปานกลาง (~1 ม.) เดินเรือด้วยความระมัดระวัง"
        : "🏖️ ทะเลเรียบถึงมีคลื่นเล็กน้อย น้ำใส เหมาะเที่ยวชายหาดและดำน้ำ";

  const marineSafetyLabel = !meta.isCoastal
    ? "กิจกรรมทางน้ำในเขื่อน/แม่น้ำปลอดภัยตามปกติ"
    : waveHeightM >= 1.5
      ? "⚠️ เตือนภัยเรือเล็กและควรงดเล่นน้ำบริเวณคลื่นซัดฝั่ง"
      : waveHeightM >= 1.0
        ? "🟡 เรือท่องเที่ยวเดินเรือได้ในอ่าวกำบัง ระวังคลื่นบริเวณหัวแหลม"
        : "🟢 ปลอดภัยสูง เหมาะล่องเรือ พายคายัค ซัพบอร์ด และดำน้ำดูปะการัง";

  // Compute Tourism & Suitability Score (0 - 100)
  const rainPenalty = rainProb > 60 ? 32 : rainProb > 40 ? 18 : rainProb > 25 ? 8 : 0;
  const pmPenalty = pm25 > 50 ? 28 : pm25 > 37.5 ? 16 : pm25 > 25 ? 6 : 0;
  const heatPenalty = feelsLikeC > 41 ? 22 : feelsLikeC > 38 ? 12 : feelsLikeC > 35 ? 5 : 0;
  const wavePenalty = meta.isCoastal && waveHeightM > 1.5 ? 20 : meta.isCoastal && waveHeightM > 1.1 ? 8 : 0;
  const coolBonus = minMorningC <= 20 ? 10 : minMorningC <= 23 ? 6 : 0;

  const tourismScore = Math.max(35, Math.min(98, Math.round(92 - rainPenalty - pmPenalty - heatPenalty - wavePenalty + coolBonus)));
  const suitabilityScore = Math.max(38, Math.min(99, Math.round(94 - rainPenalty * 0.9 - pmPenalty * 1.1 - heatPenalty * 0.9 - wavePenalty * 0.8 + coolBonus * 0.8)));

  const tourismBadge =
    tourismScore >= 85
      ? "🌟 สวรรค์นักเดินทาง · ฟ้าใสอากาศดีมาก"
      : tourismScore >= 72
        ? "👍 เหมาะท่องเที่ยว · เตรียมร่ม/กันแดดเล็กน้อย"
        : "⚠️ เที่ยวได้แต่ควรเช็กจังหวะฝน/คลื่นลม";

  const suitabilityTags: string[] = [];
  if (rainProb < 30) suitabilityTags.push("☀️ ฟ้าโปร่งไร้ฝน");
  if (pm25 <= 25) suitabilityTags.push("🟢 อากาศสะอาดปอด");
  if (minMorningC <= 22) suitabilityTags.push("🍃 เช้าอากาศหนาวเย็น");
  if (meta.isCoastal && waveHeightM < 1.0) suitabilityTags.push("🏖️ ทะเลสงบน้ำใส");
  if (feelsLikeC < 36) suitabilityTags.push("🏃 เหมาะออกกำลังกาย");
  if (suitabilityTags.length === 0) suitabilityTags.push("🏠 เหมาะกิจกรรมในร่ม/คาเฟ่");

  // Multi-hazard risk synthesis
  const rainRisk = rainProb > 75 || rain24hMm > 35 ? 5 : rainProb >= 55 || rain24hMm >= 15 ? 4 : rainProb >= 35 ? 3 : rainProb >= 20 ? 2 : 1;
  const airRisk = pm25 > 75 ? 5 : pm25 > 37.5 ? 4 : pm25 > 25 ? 3 : pm25 > 15 ? 2 : 1;
  const heatRisk = feelsLikeC > 42 ? 5 : feelsLikeC >= 38 ? 4 : feelsLikeC >= 34 ? 3 : feelsLikeC >= 30 ? 2 : 1;
  const seaRisk = meta.isCoastal ? (waveHeightM > 2.0 || highTideMsl > 1.75 ? 5 : waveHeightM >= 1.3 || highTideMsl >= 1.45 ? 4 : waveHeightM >= 0.9 ? 3 : 2) : 1;

  const multiHazardTier = Math.max(rainRisk, airRisk, heatRisk, seaRisk) as 1 | 2 | 3 | 4 | 5;
  let primaryHazardLabel = "🟢 สภาพอากาศปลอดภัยทุกด้าน";
  let hazardAdvice = "ไม่มีสัญญาณภัยธรรมชาติรุนแรง สามารถเดินทาง ท่องเที่ยว และทำกิจกรรมกลางแจ้งได้ตามปกติ";

  if (rainRisk >= airRisk && rainRisk >= heatRisk && rainRisk >= seaRisk && rainRisk >= 3) {
    primaryHazardLabel = rainRisk >= 4 ? "🌧️ เฝ้าระวังฝนตกหนัก & น้ำท่วมขังรอระบาย" : "🌦️ เฝ้าระวังเมฆฝนโปรยปรายช่วงบ่าย–ค่ำ";
    hazardAdvice = "พกร่มหรือเสื้อกันฝน หลีกเลี่ยงจุดลุ่มต่ำน้ำท่วมขัง และเผื่อเวลาเดินทางบนท้องถนน";
  } else if (airRisk >= rainRisk && airRisk >= heatRisk && airRisk >= seaRisk && airRisk >= 3) {
    primaryHazardLabel = airRisk >= 4 ? "😷 เฝ้าระวังฝุ่น PM2.5 สะสมเกินเกณฑ์มาตรฐาน" : "🟡 คุณภาพอากาศปานกลาง กลุ่มเสี่ยงระวังฝุ่น";
    hazardAdvice = "ตรวจสอบค่าฝุ่นก่อนวิ่งกลางแจ้ง แนะนำสวมหน้ากากป้องกันฝุ่นเมื่ออยู่ในพื้นที่จราจรหนาแน่น";
  } else if (seaRisk >= 3) {
    primaryHazardLabel = seaRisk >= 4 ? "🌊 เฝ้าระวังน้ำทะเลหนุนสูง & คลื่นลมชายฝั่ง" : "⛵ คลื่นลมทะเลปานกลาง ชายฝั่งและปากแม่น้ำเฝ้าระวัง";
    hazardAdvice = "พื้นที่ลุ่มต่ำริมน้ำ/ชายฝั่งติดตามเวลาน้ำขึ้นสูงสุด และเรือเล็กควรตรวจสอบคลื่นลมก่อนออกจากฝั่ง";
  } else if (heatRisk >= 3) {
    primaryHazardLabel = heatRisk >= 4 ? "🔥 เตือนภัยความร้อนสะสมสูง & รังสี UV จัด" : "☀️ อากาศค่อนข้างร้อนช่วงเที่ยง–บ่าย";
    hazardAdvice = "ดื่มน้ำสะอาดบ่อยๆ สวมหมวกหรือกางร่ม และเลี่ยงการอยู่กลางแดดจัดต่อเนื่องช่วง 11:00–15:00 น.";
  }

  // Lifestyle scores (0-100)
  const laundryScore = Math.max(20, Math.min(99, Math.round(100 - rainProb * 1.1 + (tempC - 26) * 2.5 - (humidity - 55) * 0.4)));
  const outdoorScore = Math.max(25, Math.min(99, Math.round(96 - pmPenalty * 1.2 - rainPenalty - heatPenalty * 0.8)));
  const campingScore = Math.max(30, Math.min(99, Math.round(92 - rainPenalty * 1.2 + (minMorningC <= 22 ? 12 : 0) - pmPenalty * 0.7)));
  const marineScore = meta.isCoastal
    ? Math.max(25, Math.min(98, Math.round(95 - waveHeightM * 28 - rainProb * 0.5)))
    : Math.max(50, Math.min(96, Math.round(90 - rainProb * 0.6)));
  const carWashScore = Math.max(15, Math.min(99, Math.round(98 - rainProb * 1.25)));
  const solarScore = Math.max(30, Math.min(99, Math.round(95 - cloudCoverPct * 0.55 + uvIndex * 2)));

  const lifestyle: LifestyleMetrics = {
    laundryScore,
    laundryLabel: laundryScore >= 75 ? "👕 แดดดีลมโกรก ผ้าแห้งไวมาก" : laundryScore >= 55 ? "🌤️ ตากในที่ร่มมีลมโกรกได้" : "☔ เสี่ยงฝนตก แนะนำอบผ้า/ตากในร่ม",
    outdoorScore,
    outdoorLabel: outdoorScore >= 78 ? "🏃 อากาศดี เหมาะวิ่ง/ปั่นจักรยาน" : outdoorScore >= 58 ? "👟 ออกกำลังกายช่วงเช้า–เย็นได้" : "🏠 แนะนำออกกำลังกายในร่ม (ฟิตเนส)",
    campingScore,
    campingLabel: campingScore >= 80 ? "⛺ ฟ้าเปิด ลมเย็น เหมาะกางเต็นท์ดูดาว" : campingScore >= 60 ? "🏕️ กางเต็นท์ได้ เตรียมฟลายชีทกันน้ำค้าง" : "🌧️ ระวังฝนและลมกระโชกบริเวณจุดกางเต็นท์",
    marineScore,
    marineLabel: meta.isCoastal
      ? (marineScore >= 75 ? "🚤 ทะเลสงบ น้ำใส เหมาะดำน้ำ/ล่องเรือ" : "⛵ คลื่นปานกลาง เที่ยวชายหาดได้")
      : "🏞️ ล่องแพ/พายเรือแหล่งน้ำจืดได้ตามปกติ",
    carWashScore,
    carWashLabel: carWashScore >= 75 ? "🚗 ล้างรถได้เลย ฟ้าใสไร้ฝนกวนใจ" : "🌦️ ชะลอล้างรถ มีโอกาสเจอฝนโปรยปราย",
    solarScore,
    solarLabel: solarScore >= 75 ? "⚡ แสงแดดเข้มข้น ผลิตไฟโซลาร์ได้สูง" : "⛅ มีเมฆบังบางช่วง ผลิตไฟได้ปานกลาง",
  };

  return {
    cloudCoverPct,
    skyStateLabel,
    pressureHpa,
    visibilityKm,
    radarDbz,
    mistChancePct,
    coolIndexLabel,
    tideTrend,
    tideStatusLabel,
    seaStateLabel,
    marineSafetyLabel,
    tourismScore,
    tourismBadge,
    suitabilityScore,
    suitabilityTags,
    multiHazardTier,
    primaryHazardLabel,
    hazardAdvice,
    lifestyle,
  };
}

export function buildFallbackPayload(): FahSaiPayload {
  const dayNames = ["วันนี้", "พรุ่งนี้", "มะรืน", "วันที่ 4", "วันที่ 5", "วันที่ 6", "วันที่ 7"];
  const nowHour = getBangkokHour();

  const areas: AreaForecast[] = THAILAND_AREAS.map((meta, idx) => {
    const tide = buildSyntheticTide24h(meta.tideAmp, meta.tidePhase);
    const tempC = meta.baseTempC;
    const minMorningC = meta.baseMinC;
    const maxAfternoonC = Number((tempC + 2.2).toFixed(1));
    const humidity = meta.isCoastal ? 74 : meta.zoneType === "mountain" ? 68 : 63;
    const feelsLikeC = Number((tempC + (meta.isCoastal ? 3.8 : meta.zoneType === "mountain" ? 1.8 : 4.2)).toFixed(1));
    const rainProb = meta.baseRainProb;
    const rain24hMm = Number((rainProb >= 45 ? 11.5 : rainProb >= 30 ? 4.8 : 1.2).toFixed(1));
    const pm25 = meta.basePm25;
    const aqi = Math.round(pm25 * 2.55);
    const uvIndex = Number((meta.regionId === "south-andaman" || meta.regionId === "south-gulf" ? 9.2 : 8.0).toFixed(1));
    const windKmh = Number((meta.isCoastal ? 19.5 + (idx % 4) * 2.0 : 14.0 + (idx % 3) * 1.8).toFixed(1));
    const windGustKmh = Number((windKmh * 1.42).toFixed(1));
    const windDeg = meta.seaBasin === "andaman" ? 230 : 45;
    const waveHeightM = meta.isCoastal ? Number((meta.baseWaveM + (idx % 3) * 0.08).toFixed(2)) : 0;

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

    const hourly: HourlyPoint[] = Array.from({ length: 24 }, (_, h) => {
      const tempCurve = Math.sin(((h - 8) / 24) * 2 * Math.PI) * 3.8;
      const t = Number((tempC - 1.4 + tempCurve).toFixed(1));
      const fl = Number((t + (h >= 11 && h <= 16 ? 4.2 : 2.0)).toFixed(1));
      const rp = h >= 15 && h <= 19 ? Math.min(88, rainProb + 22) : Math.max(8, rainProb - 12);
      const rm = rp >= 45 ? Number(((rp - 35) * 0.14).toFixed(1)) : 0;
      const pm = Number(Math.max(7, pm25 + (h >= 6 && h <= 9 ? 5.5 : h >= 13 && h <= 17 ? -3.8 : 0)).toFixed(1));
      const wk = Number((windKmh + (h >= 12 && h <= 17 ? 4.5 : 0)).toFixed(1));
      const uv = h >= 7 && h <= 17 ? Number((Math.sin(((h - 7) / 10) * Math.PI) * uvIndex).toFixed(1)) : 0;
      return {
        hourLabel: `${String(h).padStart(2, "0")}:00`,
        tempC: t,
        feelsLikeC: fl,
        rainProb: rp,
        rainMm: rm,
        pm25: pm,
        windKmh: wk,
        tideMsl: tide.hourlyTide[h] ?? 0,
        waveM: meta.isCoastal ? Number((waveHeightM + (h >= 13 && h <= 18 ? 0.16 : 0)).toFixed(2)) : 0,
        cloudPct: Math.min(95, Math.max(15, Math.round(rp * 0.9 + 15))),
        uvIndex: uv,
      };
    });

    const daily: DailyPoint[] = dayNames.map((label, d) => {
      const dRain = Math.max(10, Math.min(85, rainProb + (d === 1 ? 12 : d === 3 ? -12 : (d % 2) * 6)));
      return {
        dayLabel: label,
        maxTempC: Number((maxAfternoonC - (d % 3) * 0.5).toFixed(1)),
        minTempC: Number((minMorningC - (d >= 2 && d <= 4 ? 1.1 : 0)).toFixed(1)),
        rainProb: dRain,
        rainMm: Number(Math.max(0, rain24hMm + (d === 1 ? 3.8 : -1.0 * d)).toFixed(1)),
        pm25Avg: Number(Math.max(8, pm25 + (d >= 3 ? 3.5 : -1.2)).toFixed(1)),
        uvMax: Number((uvIndex - (d % 2) * 0.5).toFixed(1)),
        tourismScore: Math.max(45, Math.min(98, intel.tourismScore + (d === 2 || d === 3 ? 5 : d === 1 ? -6 : 2))),
        waveMaxM: meta.isCoastal ? Number((waveHeightM + (d === 1 ? 0.15 : 0)).toFixed(2)) : 0,
      };
    });

    return {
      id: meta.id,
      name: meta.name,
      subtitle: meta.subtitle,
      regionId: meta.regionId,
      regionName: meta.regionName,
      zoneType: meta.zoneType,
      isCoastal: meta.isCoastal,
      seaBasin: meta.seaBasin,
      elevationM: meta.elevationM,
      lat: meta.lat,
      lng: meta.lng,
      mapX: meta.mapX,
      mapY: meta.mapY,
      coastalNote: meta.coastalNote,
      tourismHighlights: meta.tourismHighlights,
      bestActivity: meta.bestActivity,
      current: {
        tempC: Number(tempC.toFixed(1)),
        feelsLikeC,
        minMorningC,
        maxAfternoonC,
        humidity,
        pressureHpa: intel.pressureHpa,
        visibilityKm: intel.visibilityKm,
        cloudCoverPct: intel.cloudCoverPct,
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
