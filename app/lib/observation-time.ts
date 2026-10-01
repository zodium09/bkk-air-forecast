/** Validate wall times before applying Bangkok's fixed UTC+7 offset. */
export function observationTime(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const dotNet = /^\/Date\((\d{12,14})(?:[+-]\d{4})?\)\/$/.exec(value);
  if (dotNet) return Number(dotNet[1]);
  const local = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(value);
  if (!local) return null;
  const timestamp = Date.parse(`${local[1]}T${local[2]}:${local[3] ?? "00"}+07:00`);
  return Number.isFinite(timestamp) && new Date(timestamp + 25200000).toISOString().slice(0, 19) === `${local[1]}T${local[2]}:${local[3] ?? "00"}` ? timestamp : null;
}

export function observationNumber(value: unknown, minimum: number, maximum: number): number | null {
  if (value === null || value === undefined || typeof value === "boolean" || typeof value === "string" && !value.trim()) return null;
  const result = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(result) && result >= minimum && result <= maximum ? result : null;
}

export function observationAge(observedAt: string | null, now = Date.now()) {
  if (!observedAt) return null;
  const timestamp = Date.parse(observedAt);
  return Number.isFinite(timestamp) && timestamp <= now + 300000 ? Math.max(0, (now - timestamp) / 60000) : null;
}

export function thaiObservationTime(value: string | null) {
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(value)) : "ไม่ระบุเวลา";
}
