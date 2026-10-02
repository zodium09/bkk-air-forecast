import { finite, relativeDay, type MapDataset, type MapStep } from "./map-intelligence.ts";

/** A value is labeled by its own source period, never the page's selected day. */
export function forecastPeriod(step: MapStep | undefined, today?: string) {
  return step ? `${relativeDay(step.date, today)} · ${step.label}` : "ยังไม่มีช่วงพยากรณ์ที่ใช้ได้";
}

/** Prefer the finest source cadence when opening a day's time detail. */
export function forecastDetailIndex(data: MapDataset | null, date?: string) {
  if (!data || data.status === "unavailable" || !date) return -1;
  const hour = data.steps.findIndex(step => step.date === date && step.cadence === "hour" && step.startHour !== undefined);
  return hour >= 0 ? hour : data.steps.findIndex(step => step.date === date && step.window !== null && step.startHour !== undefined);
}

/** Keep source indices, cadence, missing readings and dates in each chart. */
export function forecastSamples(data: MapDataset | null, values: (number | null)[], index: number, nextHours = false, today?: string) {
  const step = data?.steps[index];
  if (!data || !step || data.status === "unavailable") return [];
  const cadence = step.cadence ?? (step.window === null ? "day" : "window");
  const indices = data.steps.flatMap((candidate, i) => (candidate.cadence ?? (candidate.window === null ? "day" : "window")) === cadence ? [i] : []);
  const timeOf = (candidate: MapStep) => candidate.startHour === undefined ? NaN : Date.parse(`${candidate.date}T${String(candidate.startHour).padStart(2, "0")}:00:00+07:00`);
  const startTime = timeOf(step);
  const shown = cadence === "day" ? indices : nextHours && Number.isFinite(startTime) ? indices.filter(i => {
    const time = timeOf(data.steps[i]);
    return time >= startTime && time < startTime + 24 * 60 * 60 * 1000;
  }) : indices.filter(i => data.steps[i].date === step.date);
  return shown.map(i => ({ index: i, key: data.steps[i].key, value: finite(values[i]),
    label: cadence === "day" ? relativeDay(data.steps[i].date, today) : `${data.steps[i].date !== step.date ? relativeDay(data.steps[i].date, today) + " · " : ""}${data.steps[i].label}` }));
}
