import type { ForecastPayload } from "./forecast-data.ts";
import type { RainForecastPayload } from "./rain-forecast-data.ts";
import type { HeatForecastPayload } from "./heat-forecast-data.ts";
import { getLevel } from "./forecast-data.ts";
import { getHeatRisk } from "./heat-forecast-data.ts";

export type EnvironmentLayer = "air" | "rain" | "heat";
export type DataMode = "forecast" | "observation" | "estimate";
export type Metric = "primary" | "secondary";
export type MapPoint = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  values: (number | null)[];
  secondary: (number | null)[];
  observedAt?: string;
  source?: string;
};
export type MapStep = {
  key: string;
  day: number;
  date: string;
  label: string;
  window: number | null;
  startHour?: number;
  endHour?: number;
  sourceMode?: string;
  uncertainty?: number;
  reliability?: number;
};
export type MapDataset = {
  layer: EnvironmentLayer;
  status: string;
  timestamp: string;
  timestampLabel: string;
  model: string;
  sources: string[];
  notes: string[];
  points: MapPoint[];
  steps: MapStep[];
  quality: Record<string, unknown>;
};
export const layerInfo = {
  air: {
    name: "PM2.5",
    thai: "ฝุ่น PM2.5",
    description: "ความเข้มข้นฝุ่น",
    unit: "µg/m³",
    secondaryUnit: "µg/m³",
    accent: "#087e79",
  },
  rain: {
    name: "Rain",
    thai: "ฝน",
    description: "โอกาสเกิดฝน",
    unit: "%",
    secondaryUnit: "mm",
    accent: "#2666b0",
  },
  heat: {
    name: "Heat",
    thai: "ความร้อน",
    description: "Heat Index สูงสุด",
    unit: "°C",
    secondaryUnit: "°C",
    accent: "#b54b24",
  },
} as const;
export const modeLabels = {
  forecast: "พยากรณ์",
  observation: "ตรวจวัด",
  estimate: "ประมาณเชิงพื้นที่",
};
export function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export function average(values: (number | null)[]) {
  const valid = values.filter((v): v is number => v !== null);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}
export function formatValue(value: number | null) {
  return value === null
    ? "—"
    : new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(
        value,
      );
}
export function bangkokDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function relativeDay(date: string, today = bangkokDate()) {
  if (date === today) return "วันนี้";
  const tomorrow = new Date(`${today}T12:00:00+07:00`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (date === bangkokDate(tomorrow)) return "พรุ่งนี้";
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${date}T12:00:00+07:00`));
}
function airDate(day: ForecastPayload["days"][number]) {
  const months = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  const [date, month] = day.date.split(" ");
  return `${day.year - 543}-${String(months.indexOf(month) + 1).padStart(2, "0")}-${date.padStart(2, "0")}`;
}
export function normalizeAir(
  payload: ForecastPayload,
  mode: DataMode,
): MapDataset {
  const observed = mode === "observation";
  const steps: MapStep[] = observed
    ? [
        {
          key: "observed",
          day: 0,
          date: "",
          label: "ตรวจวัดล่าสุด",
          window: null,
        },
      ]
    : payload.days.map((day, index) => ({
        key: airDate(day),
        day: index,
        date: airDate(day),
        label: "เฉลี่ยรายวัน",
        window: null,
        sourceMode: day.sourceMode,
        uncertainty: day.uncertainty,
        reliability: day.forecastReliabilityScore,
      }));
  return {
    layer: "air",
    status: payload.status,
    timestamp: payload.issuedAt,
    timestampLabel: "ข้อมูลอ้างอิง",
    model: observed
      ? "AirBKK / Air4Thai · สถานีตรวจวัด"
      : (payload.model ?? "ไม่ระบุแบบจำลอง"),
    sources: payload.sources ?? [],
    notes: [
      payload.disclaimer ?? "",
      ...(payload.degradedReasons ?? []),
    ].filter(Boolean),
    quality: payload.dataQuality ?? {},
    steps,
    points: (payload.status === "unavailable" ? [] : payload.stations)
      .filter((s) => !observed || finite(s.observed) !== null)
      .map((s) => ({
        id: s.id,
        label: s.label || s.district,
        lat: s.lat,
        lng: s.lng,
        observedAt: s.observedAt,
        source: s.sourceType,
        values: observed
          ? [finite(s.observed)]
          : s.values.map((v, i) =>
              payload.days[i]?.sourceMode === "placeholder" ? null : finite(v),
            ),
        secondary: [],
      })),
  };
}
export function normalizeWeather(
  payload: RainForecastPayload | HeatForecastPayload,
  layer: "rain" | "heat",
): MapDataset {
  const dailyTmd = layer === "rain" && "tmdProduct" in payload.dataQuality && payload.dataQuality.tmdProduct === "daily-7d" && payload.dataQuality.tmdStatus === "live";
  const steps: MapStep[] = payload.days.flatMap((day, dayIndex) => [
    {
      key: `${day.dateKey}:day`,
      day: dayIndex,
      date: day.dateKey,
      label: "ทั้งวัน",
      window: null,
    },
    ...payload.windows
      .filter((w) => w.dayIndex === dayIndex && !dailyTmd)
      .map((w) => ({
        key: `${day.dateKey}:${w.windowIndex}`,
        day: dayIndex,
        date: day.dateKey,
        label: `${w.start}–${w.end}`,
        window: w.windowIndex,
        startHour: Number(w.start.split(":")[0]),
        endHour: Number(w.end.split(":")[0]) || 24,
      })),
  ]);
  const points: MapPoint[] = (
    payload.status === "unavailable" ? [] : payload.points
  ).map((point) => ({
    id: point.id,
    label: point.label,
    lat: point.lat,
    lng: point.lng,
    source: payload.model,
    values: steps.map((step) => {
      if (layer === "rain") {
        const p = point as RainForecastPayload["points"][number];
        return finite(
          step.window === null
            ? p.daily[step.day]?.pointProbabilityMax
            : p.windows.find(
                (w) => w.dayIndex === step.day && w.windowIndex === step.window,
              )?.pointProbabilityPeak,
        );
      }
      const p = point as HeatForecastPayload["points"][number];
      return finite(
        step.window === null
          ? p.daily[step.day]?.maxHeatIndexC
          : p.windows.find(
              (w) => w.dayIndex === step.day && w.windowIndex === step.window,
            )?.maxHeatIndexC,
      );
    }),
    secondary: steps.map((step) => {
      if (layer === "rain") {
        const p = point as RainForecastPayload["points"][number];
        return finite(
          step.window === null
            ? p.daily[step.day]?.rainMm
            : p.windows.find(
                (w) => w.dayIndex === step.day && w.windowIndex === step.window,
              )?.rainMm,
        );
      }
      const p = point as HeatForecastPayload["points"][number];
      return finite(
        step.window === null
          ? p.daily[step.day]?.maxTemperatureC
          : p.windows.find(
              (w) => w.dayIndex === step.day && w.windowIndex === step.window,
            )?.maxTemperatureC,
      );
    }),
  }));
  return {
    layer,
    status: payload.status,
    timestamp: payload.fetchedAt,
    timestampLabel: "ดึงข้อมูล",
    model: payload.model,
    sources: payload.sources,
    notes: [
      payload.disclaimer,
      payload.dataQuality.providerFallback ? "ใช้ผู้ให้บริการสำรอง" : "",
      payload.dataQuality.error ?? "",
    ].filter(Boolean),
    quality: payload.dataQuality,
    points,
    steps,
  };
}
export function pointValue(point: MapPoint, index: number, metric: Metric) {
  return (
    (metric === "secondary" ? point.secondary[index] : point.values[index]) ??
    null
  );
}
export function metricName(layer: EnvironmentLayer, metric: Metric) {
  return metric === "primary"
    ? layerInfo[layer].description
    : layer === "rain"
      ? "ปริมาณฝนสะสม"
      : "อุณหภูมิสูงสุด";
}
export function getLegend(layer: EnvironmentLayer, metric: Metric) {
  if (layer === "air")
    return [
      { max: 15, label: "ดีมาก", color: "#38bdf8" },
      { max: 25, label: "ดี", color: "#34d399" },
      { max: 37.5, label: "ปานกลาง", color: "#facc15" },
      { max: 75, label: "เริ่มมีผลกระทบ", color: "#fb923c" },
      { max: Infinity, label: "มีผลกระทบ", color: "#f43f5e" },
    ];
  if (layer === "rain")
    return metric === "primary"
      ? [
          { max: 20, label: "โอกาสน้อย", color: "#cadde9" },
          { max: 40, label: "อาจมีฝน", color: "#8dbad9" },
          { max: 60, label: "มีโอกาส", color: "#5192c4" },
          { max: 80, label: "โอกาสสูง", color: "#2866a8" },
          { max: Infinity, label: "โอกาสสูงมาก", color: "#403e91" },
        ]
      : [
          { max: 0, label: "ไม่พบฝน", color: "#cadde9" },
          { max: 10, label: "0–10", color: "#8dbad9" },
          { max: 35, label: "10–35", color: "#5192c4" },
          { max: 90, label: "35–90", color: "#2866a8" },
          { max: Infinity, label: ">90", color: "#403e91" },
        ];
  return metric === "primary"
    ? [
        { max: 27, label: "<27", color: "#38bdf8" },
        { max: 33, label: "27–33", color: "#22c55e" },
        { max: 42, label: "33–42", color: "#eab308" },
        { max: 52, label: "42–52", color: "#f97316" },
        { max: Infinity, label: "≥52", color: "#dc2626" },
      ]
    : [
        { max: 30, label: "<30", color: "#a8cfc2" },
        { max: 35, label: "30–35", color: "#e5cf73" },
        { max: 40, label: "35–40", color: "#e99451" },
        { max: Infinity, label: "≥40", color: "#d64b3e" },
      ];
}
export function legendIndex(
  layer: EnvironmentLayer,
  metric: Metric,
  value: number,
) {
  return getLegend(layer, metric).findIndex((b) =>
    layer === "heat" ? value < b.max : value <= b.max,
  );
}
export function valueColor(
  layer: EnvironmentLayer,
  metric: Metric,
  value: number | null,
) {
  return value === null
    ? "#9aa7ac"
    : (getLegend(layer, metric)[legendIndex(layer, metric, value)]?.color ??
        "#9aa7ac");
}
export function interpretation(
  layer: EnvironmentLayer,
  metric: Metric,
  value: number | null,
) {
  if (value === null) return "ไม่มีข้อมูลสำหรับช่วงนี้";
  if (layer === "air") return getLevel(value).label;
  if (layer === "heat")
    return metric === "primary"
      ? getHeatRisk(value).label
      : "อุณหภูมิอากาศจากแบบจำลอง";
  return metric === "primary"
    ? `${getLegend(layer, metric)[legendIndex(layer, metric, value)]?.label}ในช่วงที่เลือก`
    : "ปริมาณสะสมในช่วงที่เลือก";
}
export function closestPoint(
  points: MapPoint[],
  lat: number,
  lng: number,
  maxKm = 20,
) {
  let best: MapPoint | null = null;
  let distance = maxKm;
  for (const point of points) {
    const km = Math.hypot((point.lat - lat) * 111, (point.lng - lng) * 108);
    if (km < distance) {
      best = point;
      distance = km;
    }
  }
  return best;
}
