const BANGKOK_OFFSET = "+07:00";

export function parseBangkokTimestamp(value: string): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(value)) return Number.NaN;
  const timestamp = new Date(`${value.replace(" ", "T")}${BANGKOK_OFFSET}`).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function bangkokDateKey(timestamp = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Bangkok",
  }).format(new Date(timestamp));
}
