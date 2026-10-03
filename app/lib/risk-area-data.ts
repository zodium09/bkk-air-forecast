import { getRegion, provinces, regionContains, type RegionId } from "./provinces.ts";
import { formatValue, pointValue, type EnvironmentLayer, type MapDataset, type Metric } from "./map-intelligence.ts";
import { placeArea } from "./map-places.ts";
import { rainAmountLevel } from "./rain-forecast-data.ts";

export type RiskRank = -1 | 0 | 1 | 2 | 3;
export type RiskAreaPoint = {
  id: string; topic: string; name: string; area: string; lat: number; lng: number;
  rank: RiskRank; status: string; value: number | null; unit: string; detail: string;
  kind: "ตรวจวัด" | "Nowcast" | "พยากรณ์"; source: string; observedAt: string | null;
  period?: string; timeLabel?: string; href: string; eventId?: string;
};
export type RiskMapTopic = { id: string; title: string; points: RiskAreaPoint[]; note: string; loading?: boolean };
export const riskBands = [
  { rank: 3, label: "สูงมาก", color: "#b62e4b" },
  { rank: 2, label: "สูง", color: "#bc5518" },
  { rank: 1, label: "เฝ้าระวัง", color: "#916400" },
  { rank: 0, label: "ไม่เข้าเกณฑ์ติดตาม", color: "#276e9a" },
  { rank: -1, label: "ยังประเมินไม่ได้", color: "#667b8b" },
] as const;
export function validRiskCoordinate(point: { lat: number; lng: number }) {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}
export function groupRiskAreas(points: RiskAreaPoint[]) {
  const groups = new Map<string, RiskAreaPoint[]>();
  for (const point of points) {
    const rows = groups.get(point.area) ?? [];
    rows.push(point); groups.set(point.area, rows);
  }
  return [...groups].map(([name, rows]) => ({ name, points: rows.sort((a,b) => b.rank-a.rank || a.name.localeCompare(b.name,"th")), rank: Math.max(...rows.map(p => p.rank)), attention: rows.filter(p => p.rank > 0).length }))
    .sort((a,b) => b.rank-a.rank || b.attention-a.attention || a.name.localeCompare(b.name,"th"));
}

/** Forecast colors apply only to the selected actual source period and geographic points. */
export function forecastRiskAreas(data: MapDataset | null, index: number, region: RegionId, metric: Metric = "primary", requestedLayer: EnvironmentLayer = "rain"): RiskMapTopic {
  const layer = data?.layer ?? requestedLayer, step = data?.steps[index];
  const title = layer === "rain" ? "ฝนพยากรณ์" : layer === "air" ? "ฝุ่นพยากรณ์" : "ความร้อนพยากรณ์";
  const hourlyRain = layer === "rain" && !!step && step.window !== null;
  const note = hourlyRain ? "สีใช้โอกาสฝนของช่วงที่เลือก ปริมาณฝนแสดงแยก ไม่ใช้เกณฑ์สะสมทั้งวันกับรายชั่วโมง" : "สีเป็นระดับติดตามจากพยากรณ์ ณ จุดข้อมูล ไม่ใช่ขอบเขตผลกระทบทั้งเขตหรือเหตุการณ์ที่ยืนยัน";
  if (!data || data.status === "unavailable" || !step) return { id: layer, title, note, points: [] };
  const points = data.points.filter(p => validRiskCoordinate(p) && regionContains(region, p.lat, p.lng, p.place?.provinceId)).map(p => {
    const primary = pointValue(p,index,"primary"), secondary = pointValue(p,index,"secondary");
    const finite = (v: number | null) => typeof v === "number" && Number.isFinite(v) ? v : null;
    const first = finite(primary), second = finite(secondary);
    let rank: RiskRank = -1, status = "ยังไม่มีค่าที่ใช้จัดระดับได้", value = first, unit = layer === "air" ? "µg/m³" : "°C", detail = "";
    if (layer === "air" && first !== null && first >= 0) {
      rank = first > 75 ? 3 : first > 37.5 ? 2 : first > 25 ? 1 : 0;
      status = rank === 3 ? "พยากรณ์ฝุ่นสูงมาก" : rank === 2 ? "พยากรณ์ฝุ่นสูง" : rank === 1 ? "พยากรณ์ฝุ่นปานกลาง" : "พยากรณ์ฝุ่นระดับดี";
      detail = "ค่าเฉลี่ยรายวันจากแบบจำลอง";
    } else if (layer === "heat") {
      if (first !== null) { rank = first >= 52 ? 3 : first >= 42 ? 2 : first >= 33 ? 1 : 0; status = rank === 3 ? "ดัชนีความร้อนสูงมาก" : rank === 2 ? "ดัชนีความร้อนสูง" : rank === 1 ? "ควรเฝ้าระวังความร้อน" : "ดัชนีความร้อนยังไม่เข้าเกณฑ์ติดตาม"; }
      detail = `ใช้ดัชนีความร้อนจัดระดับ${second === null ? "" : ` · อุณหภูมิอากาศ ${formatValue(second)}°C`}`;
    } else if (layer === "rain") {
      const amount = metric === "secondary";
      value = amount ? second : first; unit = amount ? "มม." : "%";
      if (step.window === null && amount) {
        if (second !== null && second >= 0) { rank = second > 90 ? 3 : second > 35 ? 2 : second > 10 ? 1 : 0; status = rainAmountLevel(second).label; }
        detail = "ยอดสะสมทั้งวันจากแบบจำลอง";
      } else {
        if (first !== null && first >= 0 && first <= 100) { rank = first >= 80 ? 2 : first >= 60 ? 1 : 0; status = first >= 80 ? "โอกาสฝนสูง" : first >= 60 ? "เฝ้าระวังโอกาสฝน" : "โอกาสฝนยังไม่เข้าเกณฑ์ติดตาม"; }
        detail = `${step.window === null ? "โอกาสฝนรายวัน" : "โอกาสฝนของช่วงที่เลือก"} ${formatValue(first)}%${amount ? " · สีแสดงระดับโอกาสฝน" : ""}`;
      }
    }
    const province = provinces.find(province => p.id.startsWith(`${province.id}-`));
    const params = new URLSearchParams({ province: region, lat: String(p.lat), lng: String(p.lng), time: step.key });
    return { id: `${layer}:${p.id}`, topic: layer, name: p.label, area: p.place ? placeArea(p.place) : p.area && p.area !== p.label ? p.area : province?.nameTh || p.area || getRegion(region).shortNameTh, lat: p.lat, lng: p.lng, rank, status, value, unit, detail,
      kind: "พยากรณ์" as const, source: p.source || data.model, observedAt: data.timestamp, timeLabel: data.timestampLabel || "ข้อมูลอ้างอิง", period: `${step.date} · ${step.label}`, href: `/${layer}?${params}` };
  });
  return { id: layer, title, note, points };
}
