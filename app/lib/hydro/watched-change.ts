import type { WaterStation } from "../water-levels.ts";
import type { WaterHistoryPoint } from "../water-history-store.ts";

/** Only compare archived observations when the archive contains the current reading. */
export function watchedWaterChange(station: WaterStation, points: WaterHistoryPoint[], now = Date.now()) {
  if (station.status !== "fresh" || station.value === null || !station.observedAt) return null;
  const currentTime = Date.parse(station.observedAt);
  if (!Number.isFinite(currentTime) || currentTime > now + 300000 || now - currentTime > 3600000) return null;
  if (points.some(point => Date.parse(point.observedAt) > currentTime)) return null;
  const current = points.findLast(point => Date.parse(point.observedAt) === currentTime);
  if (!current || !Number.isFinite(current.value) || Math.abs(current.value - station.value) > 0.0001) return null;
  const previous = points.filter(point => Number.isFinite(point.value) && Date.parse(point.observedAt) < currentTime).sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
  if (!previous) return null;
  const minutes = (currentTime - Date.parse(previous.observedAt)) / 60000;
  if (minutes < 5 || minutes > 120) return null;
  return { changeCm: (current.value - previous.value) * 100, minutes, from: previous.observedAt, to: station.observedAt };
}
