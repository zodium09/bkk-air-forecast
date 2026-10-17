import type { WaterHistoryPoint } from "../water-history-store.ts";

const STATION_ID = /^[a-zA-Z0-9_-]{1,96}$/;

export function parseComparisonIds(raw: string | null): string[] {
  return [...new Set((raw ?? "").split(",").filter(id => STATION_ID.test(id)))].slice(0, 4);
}

export function comparisonTimes(groups: WaterHistoryPoint[][]): number[] {
  return [...new Set(groups.flatMap(points => points.map(point => Date.parse(point.observedAt)).filter(Number.isFinite)))].sort((a, b) => a - b);
}

/** An actual reading near the shared cursor; never interpolate a level between stations. */
export function readingAtCursor(points: WaterHistoryPoint[], cursor: number, maxAgeMs = 3600000): WaterHistoryPoint | null {
  const last = [...points].reverse().find(point => Date.parse(point.observedAt) <= cursor);
  return last && cursor - Date.parse(last.observedAt) <= maxAgeMs ? last : null;
}

/** Each track owns its vertical scale, while every track shares the same time axis. */
export function comparisonTrack(points: WaterHistoryPoint[], from: number, to: number) {
  const valid = points.filter(point => Number.isFinite(point.value) && Number.isFinite(Date.parse(point.observedAt)) && Date.parse(point.observedAt) >= from && Date.parse(point.observedAt) <= to).sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  if (!valid.length) return { paths: [] as string[], dots: [] as { x: number; y: number }[], min: null as number | null, max: null as number | null };
  const values = valid.map(point => point.value);
  const low = Math.min(...values), high = Math.max(...values), pad = Math.max(0.03, (high - low) * 0.2);
  const min = low - pad, max = high + pad;
  const paths: string[] = [];
  const dots: { x: number; y: number }[] = [];
  valid.forEach((point, index) => {
    const timestamp = Date.parse(point.observedAt);
    const x = 42 + (timestamp - from) / Math.max(1, to - from) * 516;
    const y = 12 + (max - point.value) / (max - min) * 64;
    dots.push({ x, y });
    const command = `${index && timestamp - Date.parse(valid[index - 1].observedAt) <= 3600000 ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    if (command.startsWith("M")) paths.push(command); else paths[paths.length - 1] += ` ${command}`;
  });
  return { paths, dots, min, max };
}
