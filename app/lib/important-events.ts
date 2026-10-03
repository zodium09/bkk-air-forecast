import { currentRoadFloods, type RoadFloodPayload } from "./road-floods.ts";
import { currentWaterStations, waterRisk, waterStationsForArea, type WaterPayload } from "./water-levels.ts";
import { type AirObservationPayload } from "./air-observations.ts";
import { observationAge } from "./observation-time.ts";
import { currentNearbyRain, rainDistanceKm, type NearbyRainPayload, type RainPosition } from "./rain-nearby.ts";
import { bangkokDate, type MapDataset } from "./map-intelligence.ts";
import { isCombinedRegion, regionContains, type RegionId } from "./provinces.ts";
import { validRiskCoordinate, type RiskAreaPoint, type RiskRank } from "./risk-area-data.ts";

export type EventTopic = "road" | "water" | "air" | "rain" | "heat";
export type ImportantEvent = {
  id: string; topic: EventTopic; title: string; detail: string; count: number;
  priority: number; alertCount?: number; kind: "ตรวจวัด" | "Nowcast" | "พยากรณ์"; source: string;
  observedAt: string | null; href: string;
};
export type EventCoverage = { topic: EventTopic; title: string; used: number; total: number; summary: string; href: string };
export type ImportantEventsInput = {
  region: RegionId; place: RainPosition | null; now: number;
  roads: RoadFloodPayload | null; water: WaterPayload | null; air: AirObservationPayload | null;
  rain: NearbyRainPayload | null; heat: MapDataset | null;
};
const latest = (rows: { observedAt: string | null }[]) => rows.map(r => r.observedAt).filter((v): v is string => !!v).sort().at(-1) ?? null;
const examples = (rows: { name: string }[]) => rows.slice(0, 2).map(r => r.name).join(" · ");

/** Source classifications only. A selected area means actual points within 8 km, not district-wide conditions. */
export function buildImportantEvents(input: ImportantEventsInput) {
  const { region, place, now } = input;
  const near = (point: RainPosition) => !place || rainDistanceKm(place, point) <= 8;
  const events: ImportantEvent[] = [];
  const coverage: EventCoverage[] = [];
  const roadRows = (isCombinedRegion(region) || region === "bangkok" ? currentRoadFloods(input.roads?.stations ?? [], now) : []).filter(near);
  const freshRoads = roadRows.filter(s => s.status === "fresh");
  const roadAttention = freshRoads.filter(s => s.level === "flood" || s.level === "minor");
  const flooded = roadAttention.filter(s => s.level === "flood");
  coverage.push({ topic: "road", title: "น้ำบนถนน", used: freshRoads.length, total: roadRows.length, summary: freshRoads.length ? `${roadAttention.length} จุดที่ต้นทางรายงานน้ำท่วม${flooded.length ? ` (${flooded.length} จุดระดับน้ำท่วม)` : ""}` : !isCombinedRegion(region) && region !== "bangkok" ? "ชุดจุดวัดถนนครอบคลุมกรุงเทพฯ" : "ยังไม่มีจุดวัดล่าสุดที่ใช้ได้", href: "#road-floods" });
  if (roadAttention.length) events.push({ id: "road-flood", topic: "road", title: `ต้นทางรายงานน้ำบนถนน ${roadAttention.length} จุด`, detail: `${examples(roadAttention)} · น้ำท่วม ${flooded.length} จุด ท่วมเล็กน้อย ${roadAttention.length - flooded.length} จุด`, count: roadAttention.length, priority: flooded.length ? 3 : 1, kind: "ตรวจวัด", source: "สำนักการระบายน้ำ กทม.", observedAt: latest(roadAttention), href: "#road-floods" });

  const waterRows = waterStationsForArea(currentWaterStations(input.water?.stations ?? [], now), region).filter(near);
  const assessedWater = waterRows.filter(s => waterRisk(s).priority >= 0);
  const high = waterRows.filter(s => ["high", "overflow"].includes(waterRisk(s).id));
  const overflowing = high.filter(s => waterRisk(s).id === "overflow");
  const low = waterRows.filter(s => ["low", "critical-low"].includes(waterRisk(s).id));
  coverage.push({ topic: "water", title: "คลองและแม่น้ำ", used: assessedWater.length, total: waterRows.length, summary: assessedWater.length ? `น้ำมาก/ถึงตลิ่ง ${high.length} · น้ำน้อย ${low.length} สถานี` : "ยังไม่มีสถานีล่าสุดพร้อมเกณฑ์ที่ใช้ได้", href: "#water-levels" });
  if (high.length) events.push({ id: "water-high", topic: "water", title: `น้ำมากหรือถึงตลิ่ง ${high.length} สถานี`, detail: `${examples(high)} · ${overflowing.length} สถานีถึงตลิ่ง/ล้นตามเกณฑ์ต้นทาง`, count: high.length, priority: overflowing.length ? 3 : 2, kind: "ตรวจวัด", source: "ThaiWater", observedAt: latest(high), href: "#water-levels" });
  if (low.length) events.push({ id: "water-low", topic: "water", title: `น้ำน้อย ${low.length} สถานี`, detail: `${examples(low)} · ${low.filter(s => waterRisk(s).id === "critical-low").length} สถานีน้ำน้อยวิกฤติ แสดงแยกจากน้ำมาก`, count: low.length, priority: low.some(s => waterRisk(s).id === "critical-low") ? 3 : 1, kind: "ตรวจวัด", source: "ThaiWater", observedAt: latest(low), href: "#water-levels" });

  const airRows = (input.air?.stations ?? []).filter(s => (regionContains(region, s.lat, s.lng, s.provinceId)) && near(s));
  const freshAir = airRows.filter(s => s.value !== null && observationAge(s.observedAt, now) !== null && observationAge(s.observedAt, now)! <= 90);
  // Unknown averaging periods cannot be compared with a 24-hour concentration threshold.
  const classifiedAir = freshAir.filter(s => s.sourceLevel !== null);
  const airAttention = classifiedAir.filter(s => s.sourceLevel === "orange" || s.sourceLevel === "red");
  coverage.push({ topic: "air", title: "ฝุ่น PM2.5", used: classifiedAir.length, total: airRows.length, summary: classifiedAir.length ? `ต้นทางจัดระดับส้ม/แดง ${airAttention.length} รายการสถานี` : freshAir.length ? "มีค่าฝุ่น แต่ต้นทางไม่ได้ส่งระดับสีที่ใช้ได้" : "ยังไม่มีค่าฝุ่นล่าสุดที่ใช้ได้", href: "#current-observations" });
  if (airAttention.length) events.push({ id: "air-source-level", topic: "air", title: `ฝุ่นระดับส้ม/แดงจากต้นทาง ${airAttention.length} รายการสถานี`, detail: examples(airAttention), count: airAttention.length, priority: airAttention.some(s => s.sourceLevel === "red") ? 3 : 2, kind: "ตรวจวัด", source: [...new Set(airAttention.map(s => s.source))].join(" / "), observedAt: latest(airAttention), href: "#current-observations" });

  const rain = currentNearbyRain(input.rain, now);
  const rainReady = !!place && rain?.status === "live" && rain.found !== null;
  coverage.push({ topic: "rain", title: "ฝนใกล้พื้นที่", used: rainReady ? 1 : 0, total: place ? 1 : 0, summary: !place ? "เลือกพื้นที่เพื่อวิเคราะห์ฝนรอบตัว" : rainReady ? rain.found ? "ต้นทางพบสัญญาณฝนใกล้จุดที่เลือก" : "ต้นทางยังไม่พบสัญญาณฝนใกล้จุดนี้" : rain?.message ?? "ผลวิเคราะห์ระยะสั้นยังไม่พร้อม", href: "#rain-radar" });
  if (rainReady && rain.found) events.push({ id: "nearby-rain", topic: "rain", title: "พบสัญญาณฝนใกล้พื้นที่ที่เลือก", detail: rain.message, count: 1, priority: 2, kind: "Nowcast", source: "TMD RadarGIS", observedAt: rain.observedAt, href: "#rain-radar" });

  const heat = input.heat;
  const heatAge = heat ? (now - Date.parse(heat.timestamp)) / 60000 : NaN;
  const hour = new Date(now + 7 * 3600000).getUTCHours();
  const currentStep = (cadence: "hour" | "window") => heat?.steps.findIndex(s => s.date === bangkokDate(new Date(now)) && s.cadence === cadence && s.startHour !== undefined && s.endHour !== undefined && s.startHour <= hour && hour < s.endHour) ?? -1;
  const hourly = currentStep("hour");
  const index = hourly >= 0 ? hourly : currentStep("window");
  const heatRows = heat?.points.filter(p => regionContains(region, p.lat, p.lng, p.place?.provinceId) && near(p) && p.method !== "idw") ?? [];
  const usableHeat = heat?.layer === "heat" && heat.status !== "unavailable" && Number.isFinite(heatAge) && heatAge >= -5 && heatAge <= 180 && index >= 0 ? heatRows.filter(p => typeof p.values[index] === "number" && Number.isFinite(p.values[index])) : [];
  const peak = [...usableHeat].sort((a, b) => b.values[index]! - a.values[index]!)[0];
  const heatStep = heat?.steps[index];
  const heatPeriod = heatStep ? `${String(heatStep.startHour).padStart(2, "0")}:00–${String(heatStep.endHour).padStart(2, "0")}:00 น.` : "";
  coverage.push({ topic: "heat", title: "ความร้อน", used: usableHeat.length, total: heatRows.length, summary: peak ? `แบบจำลองสูงสุด ${peak.values[index]!.toFixed(1)}°C · ${heatPeriod}` : "ยังไม่มีพยากรณ์ชั่วโมงปัจจุบันที่ใช้ได้", href: "#forecast-heat" });
  if (peak && peak.values[index]! >= 42) events.push({ id: "heat-current", topic: "heat", title: `ดัชนีความร้อนพยากรณ์สูงสุด ${peak.values[index]!.toFixed(1)}°C`, detail: `${peak.label} · ช่วง ${heatPeriod} · ค่าของจุดแบบจำลอง`, count: 1, priority: peak.values[index]! >= 52 ? 3 : 2, kind: "พยากรณ์", source: heat!.model, observedAt: heat!.timestamp, href: "#forecast-heat" });
  for (const event of events) {
    // Track growth of the highest source category even if the group's total stays unchanged.
    if (event.id === "road-flood") event.alertCount = flooded.length || roadAttention.length;
    if (event.id === "water-high") event.alertCount = overflowing.length || high.length;
    if (event.id === "water-low") event.alertCount = low.filter(s => waterRisk(s).id === "critical-low").length || low.length;
    if (event.id === "air-source-level") event.alertCount = airAttention.filter(s => s.sourceLevel === "red").length || airAttention.length;
  }
  const topicOrder = { road: 0, water: 1, air: 2, rain: 3, heat: 4 };
  const points: RiskAreaPoint[] = [];
  for (const s of roadRows) {
    const rank: RiskRank = s.status !== "fresh" || s.level === "unknown" ? -1 : s.level === "flood" ? 3 : s.level === "minor" ? 1 : 0;
    points.push({ id: `road:${s.id}`, topic: "road", name: s.name, area: s.district ? `เขต${s.district} · กรุงเทพมหานคร` : "กรุงเทพมหานคร", lat: s.lat, lng: s.lng, rank, status: rank < 0 ? "ข้อมูลเก่าหรือใช้ไม่ได้" : s.sourceStatus || (rank === 3 ? "ต้นทางรายงานน้ำท่วม" : rank === 1 ? "ท่วมเล็กน้อย" : "ต้นทางรายงานปกติ"), value: s.status === "fresh" ? s.value : null, unit: "ซม.", detail: [s.road, s.direction].filter(Boolean).join(" · "), kind: "ตรวจวัด", source: "สำนักการระบายน้ำ กทม.", observedAt: s.observedAt, href: "#road-floods", eventId: rank > 0 ? "road-flood" : undefined });
  }
  for (const s of waterRows) {
    const risk = waterRisk(s), rank = risk.priority as RiskRank;
    points.push({ id: `water:${s.id}`, topic: "water", name: s.name, area: [s.district, s.province].filter(Boolean).join(" · ") || s.waterway || "สถานีน้ำ", lat: s.lat, lng: s.lng, rank, status: risk.title, value: s.status === "fresh" ? s.value : null, unit: s.datum === "msl" ? "ม. รทก." : "ม.จากศูนย์เกจ", detail: `${s.waterway || "สถานีน้ำ"} · ${risk.message}`, kind: "ตรวจวัด", source: s.agency || "ThaiWater", observedAt: s.observedAt, href: "#water-levels", eventId: ["high", "overflow"].includes(risk.id) ? "water-high" : ["low", "critical-low"].includes(risk.id) ? "water-low" : undefined });
  }
  for (const s of airRows) {
    const fresh = freshAir.includes(s), level = fresh ? s.sourceLevel : null;
    const rank: RiskRank = level === "red" ? 3 : level === "orange" ? 2 : level === "yellow" ? 1 : level === "blue" || level === "green" ? 0 : -1;
    points.push({ id: `air:${s.id}`, topic: "air", name: s.name, area: s.area || "พื้นที่สถานีตรวจวัด", lat: s.lat, lng: s.lng, rank, status: rank < 0 ? "ยังไม่มีระดับจากต้นทางที่ใช้ได้" : `ระดับ${({ blue: "ฟ้า", green: "เขียว", yellow: "เหลือง", orange: "ส้ม", red: "แดง" } as Record<string,string>)[level!] }จากต้นทาง`, value: fresh ? s.value : null, unit: "µg/m³", detail: "ใช้ระดับสีที่หน่วยงานส่ง ไม่เทียบค่าที่ไม่ทราบช่วงเฉลี่ยกับเกณฑ์รายวัน", kind: "ตรวจวัด", source: s.source, observedAt: s.observedAt, href: "#current-observations", eventId: rank >= 2 ? "air-source-level" : undefined });
  }
  if (place) points.push({ id: "rain:nearby", topic: "rain", name: place.label || "จุดที่เลือก", area: rain?.place || "บริเวณรอบจุดที่เลือก", lat: place.lat, lng: place.lng, rank: !rainReady ? -1 : rain!.found ? 1 : 0, status: !rainReady ? "ผลวิเคราะห์ยังไม่พร้อม" : rain!.found ? "พบสัญญาณฝนใกล้จุดนี้" : "ต้นทางยังไม่พบสัญญาณฝน", value: null, unit: "", detail: rain?.message || "รอผลวิเคราะห์ฝน", kind: "Nowcast", source: "TMD RadarGIS", observedAt: rain?.observedAt ?? null, href: "#rain-radar", eventId: rainReady && rain!.found ? "nearby-rain" : undefined });
  for (const p of heatRows) {
    const value = usableHeat.includes(p) ? p.values[index]! : null;
    const rank: RiskRank = value === null ? -1 : value >= 52 ? 3 : value >= 42 ? 2 : value >= 33 ? 1 : 0;
    points.push({ id: `heat:${p.id}`, topic: "heat", name: p.label, area: p.area || p.label.split(" · ")[0] || "จุดแบบจำลอง", lat: p.lat, lng: p.lng, rank, status: rank < 0 ? "ยังไม่มีพยากรณ์ช่วงปัจจุบัน" : rank === 3 ? "ดัชนีความร้อนสูงมาก" : rank === 2 ? "ดัชนีความร้อนสูง" : rank === 1 ? "ควรเฝ้าระวังความร้อน" : "ยังไม่เข้าเกณฑ์ติดตาม", value, unit: "°C", detail: "ค่าดัชนีความร้อนของจุดแบบจำลอง ไม่ใช่ค่าตรวจวัดอุณหภูมิ", kind: "พยากรณ์", source: heat!.model, observedAt: heat!.timestamp, period: heatPeriod, href: "#forecast-heat", eventId: rank >= 2 ? "heat-current" : undefined });
  }
  return { events: events.sort((a, b) => b.priority - a.priority || topicOrder[a.topic] - topicOrder[b.topic] || a.id.localeCompare(b.id)), coverage, points: points.filter(validRiskCoordinate) };
}

export type EventWatchState = { enabled: boolean; scope: string; baseline: Record<string, { priority: number; count: number }>; pending: string[] };
export const initialEventWatch: EventWatchState = { enabled: false, scope: "", baseline: {}, pending: [] };
export type EventWatchAction = { type: "sync" | "toggle"; scope: string; events: ImportantEvent[] } | { type: "dismiss" };
/** A timestamp refresh is not a new event. Resolution clears the baseline so a later recurrence can alert. */
export function eventWatchReducer(state: EventWatchState, action: EventWatchAction): EventWatchState {
  if (action.type === "dismiss") return { ...state, pending: [] };
  const enabled = action.type === "toggle" ? !state.enabled : state.enabled;
  const baseline = Object.fromEntries(action.events.map(e => [e.id, { priority: e.priority, count: e.alertCount ?? e.count }]));
  const reset = action.scope !== state.scope || action.type === "toggle";
  const pending = enabled ? action.events.filter(e => reset || state.pending.includes(e.id) || !state.baseline[e.id] || e.priority > state.baseline[e.id].priority || (e.alertCount ?? e.count) > state.baseline[e.id].count).map(e => e.id) : [];
  if (enabled === state.enabled && action.scope === state.scope && JSON.stringify(baseline) === JSON.stringify(state.baseline) && pending.join() === state.pending.join()) return state;
  return { enabled, scope: action.scope, baseline, pending };
}
