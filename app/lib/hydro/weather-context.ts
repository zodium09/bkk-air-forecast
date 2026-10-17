/** A three-hour forecast window belongs to a Bangkok calendar day. */
import type { RainPoint } from "../rain-forecast-data.ts";

export function forecastWindowState(dateKey: string, start: string, end: string, now: number): "elapsed" | "current" | "future" {
  const startAt = Date.parse(`${dateKey}T${start}:00+07:00`);
  const endAt = Date.parse(`${dateKey}T${end}:00+07:00`) + (end === "00:00" ? 86_400_000 : 0);
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) return "future";
  return now >= endAt ? "elapsed" : now >= startAt ? "current" : "future";
}

/** Future complete clock hours only; missing model cells are not converted to zero. */
export function nextForecastHours(points: RainPoint[], now: number, count = 6) {
  const hourMs = 3_600_000;
  const nextLocalHour = Math.floor((now + 7 * hourMs) / hourMs) * hourMs + hourMs;
  return Array.from({ length: count }, (_, index) => {
    const wall = new Date(nextLocalHour + index * hourMs).toISOString().slice(0, 13);
    const key = `${wall}:00`;
    const values = points.map(point => point.hourly?.find(hour => hour.time === key)?.rainMm)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);
    return { key, rainMm: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : null, samples: values.length };
  });
}
