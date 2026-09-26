import { boundaryContains, prepareMapInterpolation, type MapBoundary } from "./map-surface.ts";
import { formatValue, pointValue, type EnvironmentLayer, type MapDataset, type MapPoint, type MapStep, type Metric } from "./map-intelligence.ts";
import { placeArea, placeLabel, type MapPlace } from "./map-places.ts";

/** Both the dots and the readable list use these same bounded IDW estimates. */
export function createPlacePoints(data: MapDataset | null, boundary: MapBoundary | null, places: MapPlace[]): MapPoint[] {
  if (!data || data.status === "unavailable" || !boundary || !data.points.length) return [];
  return places.filter((place) => boundaryContains(boundary, place.lat, place.lng)).map((point) => {
    const interpolate = prepareMapInterpolation(data.points, point.lat, point.lng);
    return {
      id: `place-${point.id}`, label: placeLabel(point), area: placeArea(point),
      lat: point.lat, lng: point.lng, place: point,
      values: data.steps.map((_, index) => interpolate(index, "primary")),
      secondary: data.steps.map((_, index) => interpolate(index, "secondary")),
      source: data.model,
    };
  });
}

export type PlaceReading = { title: string; description: string; action: string; priority: number };
export function placeReading(layer: EnvironmentLayer, metric: Metric, value: number | null, step?: MapStep): PlaceReading {
  if (value === null) return { title: "ยังประมาณค่าไม่ได้", description: "จุดข้อมูลใกล้เคียงไม่เพียงพอสำหรับช่วงเวลานี้", action: "ตรวจสอบแหล่งข้อมูลหรือเลือกช่วงเวลาอื่น", priority: -1 };
  const daily = step?.window === null;
  const amount = formatValue(value);
  if (layer === "air") {
    const priority = value > 75 ? 3 : value > 37.5 ? 2 : value > 25 ? 1 : 0;
    return {
      title: priority >= 2 ? "ควรติดตามฝุ่นสูง" : priority === 1 ? "ฝุ่นอยู่ระดับปานกลาง" : "คาดว่าฝุ่นอยู่ระดับดี",
      description: `PM2.5 ประมาณ ${amount} µg/m³ เฉลี่ยรายวันบริเวณจุดนี้`,
      action: priority >= 2 ? "เช็กค่าตรวจวัดล่าสุดก่อนวางแผนกิจกรรมกลางแจ้ง" : "ติดตามค่าตรวจวัดอีกครั้งเมื่อใกล้เวลาออกเดินทาง",
      priority,
    };
  }
  if (layer === "rain" && metric === "primary") {
    const priority = value >= 80 ? 2 : value >= 60 ? 1 : 0;
    return {
      title: value >= 60 ? "เตรียมรับฝน" : value > 20 ? "อาจมีฝนเป็นบางช่วง" : "โอกาสฝนค่อนข้างน้อย",
      description: `โอกาสเกิดฝนประมาณ ${amount}% ${daily ? "ในช่วงใดช่วงหนึ่งของวันที่เลือก" : "ในช่วงเวลาที่เลือก"}`,
      action: value >= 60 ? "เตรียมร่ม เผื่อเวลาเดินทาง และดูเรดาร์ก่อนออกจากบ้าน" : "ยังอาจมีฝนเฉพาะจุด ดูเรดาร์ก่อนเดินทาง",
      priority,
    };
  }
  if (layer === "rain") {
    const priority = daily && value > 90 ? 3 : daily && value > 35.5 ? 2 : value > 0 ? 1 : 0;
    return {
      title: priority >= 2 ? "ควรติดตามฝนสะสมสูง" : value > 0 ? "แบบจำลองคาดว่ามีฝน" : "แบบจำลองยังไม่ให้ฝน",
      description: `ฝนสะสมประมาณ ${amount} มม. ${daily ? "ตลอดวัน" : "ในช่วงเวลาที่เลือก"}`,
      action: value > 0 ? "เผื่อเวลาเดินทาง ติดตามเรดาร์และประกาศในพื้นที่" : "ตรวจเรดาร์อีกครั้ง เพราะยังอาจมีฝนเฉพาะจุด",
      priority,
    };
  }
  const priority = metric === "primary" ? value >= 52 ? 3 : value >= 42 ? 2 : value >= 33 ? 1 : 0 : value >= 40 ? 2 : value >= 35 ? 1 : 0;
  return {
    title: priority >= 2 ? "ควรติดตามความร้อนสูง" : priority === 1 ? "คาดว่าอากาศร้อน" : "ความร้อนยังไม่เด่นในช่วงนี้",
    description: `${metric === "primary" ? "ดัชนีความร้อนที่รู้สึก" : "อุณหภูมิอากาศ"}ประมาณ ${amount}°C ${daily ? "ค่าสูงสุดของวัน" : "ในช่วงเวลาที่เลือก"}`,
    action: priority > 0 ? "ดูแนวโน้มเพื่อเลือกช่วงที่อากาศเย็นกว่าสำหรับกิจกรรมกลางแจ้ง" : "เช็กแนวโน้มช่วงบ่ายก่อนวางแผนกิจกรรม",
    priority,
  };
}

export function sortedPlaceReadings(points: MapPoint[], index: number, layer: EnvironmentLayer, metric: Metric, step?: MapStep) {
  return points.map((point) => {
    const value = pointValue(point, index, metric);
    return { point, value, ...placeReading(layer, metric, value, step) };
  }).sort((a, b) => b.priority - a.priority || (b.value ?? -Infinity) - (a.value ?? -Infinity) || a.point.label.localeCompare(b.point.label, "th"));
}
