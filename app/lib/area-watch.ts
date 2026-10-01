import { provinces } from "./provinces.ts";
import { finite, pointValue, type MapDataset, type MapPoint, type MapStep, type Metric } from "./map-intelligence.ts";
import { placeArea } from "./map-places.ts";

export type AreaWatch = { point: MapPoint; layer: MapDataset["layer"]; step: MapStep; severity: number; title: string; description: string; value: number; unit: string; area: string; source: string; degraded: boolean };

/** Select an actual source period on the requested date, never a different day. */
export function watchStepIndex(data: MapDataset, date: string, hour?: number, cadence?: MapStep["cadence"]) {
  if (hour !== undefined) {
    if (cadence === "window") {
      const exactWindow = data.steps.findIndex((s) => s.date === date && s.cadence === "window" && s.startHour === hour);
      if (exactWindow >= 0) return exactWindow;
    }
    const exact = data.steps.findIndex((s) => s.date === date && s.cadence === "hour" && s.startHour === hour);
    if (exact >= 0) return exact;
    const window = data.steps.findIndex((s) => s.date === date && s.window !== null && s.cadence !== "hour" && s.startHour !== undefined && s.endHour !== undefined && s.startHour <= hour && s.endHour > hour);
    if (window >= 0) return window;
  }
  return data.steps.findIndex((s) => s.date === date && s.window === null);
}

export function buildAreaWatch(data: MapDataset | null, date: string, hour?: number, cadence?: MapStep["cadence"], rainMetric: Metric = "primary"): AreaWatch[] {
  if (!data || data.status === "unavailable") return [];
  const index = watchStepIndex(data, date, hour, cadence);
  const step = data.steps[index];
  if (!step) return [];
  return data.points.flatMap((point) => {
    const value = finite(pointValue(point, index, "primary"));
    const rain = finite(pointValue(point, index, "secondary"));
    let severity = 0, title = "", description = "", unit = "";
    if (data.layer === "air" && value !== null && value > 37.5) {
      severity = value > 75 ? 3 : 2; title = "ฝุ่น PM2.5 สูง"; unit = "µg/m³";
      description = "ค่าพยากรณ์เฉลี่ยรายวันสูงกว่า 37.5 µg/m³ ติดตามคุณภาพอากาศในพื้นที่";
    } else if (data.layer === "rain") {
      // Daily accumulation thresholds must never be applied to a single hour.
      const heavyDaily = step.window === null && rain !== null && rain > 35.5;
      if ((rainMetric === "primary" && value !== null && value >= 60) || heavyDaily) {
        severity = heavyDaily ? rain > 90 ? 3 : 2 : 1;
        title = heavyDaily ? "พยากรณ์ฝนสะสมสูง" : "โอกาสฝนสูง"; unit = heavyDaily ? "mm / วัน" : "%";
        description = heavyDaily ? "แบบจำลองให้ฝนสะสมมากในจุดนี้ ยังไม่ยืนยันฝนตกจริงหรือน้ำท่วม" : step.cadence === "hour" ? "โอกาสฝนรายชั่วโมงสูง ติดตามเรดาร์และประกาศในพื้นที่" : "โอกาสฝนสูงสุดรายชั่วโมงในช่วงที่เลือกสูง ติดตามเรดาร์และประกาศในพื้นที่";
      }
    } else if (data.layer === "heat" && value !== null && value >= 33) {
      severity = value >= 52 ? 3 : value >= 42 ? 2 : 1;
      title = "ดัชนีความร้อนสูง"; unit = "°C";
      description = "ดัชนีความร้อนจากอุณหภูมิและความชื้นในแบบจำลอง เป็นค่าความร้อนที่รู้สึก";
    }
    if (!severity) return [];
    const province = provinces.find((p) => point.id.startsWith(`${p.id}-`) || point.label.includes(p.shortNameTh) || point.label.includes(p.nameTh));
    return [{ point, layer: data.layer, step, severity, title, description, value: unit.startsWith("mm") ? rain! : value!, unit, area: point.place ? placeArea(point.place) : province?.shortNameTh ?? point.area ?? "พื้นที่ของจุดข้อมูล", source: data.model, degraded: data.status !== "live" }];
  }).sort((a, b) => b.severity - a.severity || b.value - a.value || a.point.label.localeCompare(b.point.label, "th"));
}
