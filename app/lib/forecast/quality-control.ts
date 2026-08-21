export type StationRecord = { id: string; lat: number; lng: number; pm25: number; timestamp: number };
export type RejectedStations = { stale: number; invalid: number; duplicate: number; outlier: number };

export function isValidStation(record: StationRecord): boolean {
  return Boolean(record.id) && [record.lat, record.lng, record.pm25, record.timestamp].every(Number.isFinite) &&
    record.pm25 >= 0 && record.pm25 <= 500 && record.lat >= 13.45 && record.lat <= 14.1 &&
    record.lng >= 100.2 && record.lng <= 101;
}

export function deduplicateStations<T extends StationRecord>(records: T[]): { records: T[]; rejected: number } {
  const newest = new Map<string, T>();
  for (const record of records) {
    const current = newest.get(record.id);
    if (!current || record.timestamp > current.timestamp) newest.set(record.id, record);
  }
  return { records: [...newest.values()], rejected: records.length - newest.size };
}

export function filterFreshStations<T extends StationRecord>(records: T[], now: number, maxAgeMs = 6 * 3_600_000) {
  const accepted: T[] = [];
  let stale = 0;
  for (const record of records) {
    if (record.timestamp > now + 3_600_000 || now - record.timestamp > maxAgeMs) stale += 1;
    else accepted.push(record);
  }
  return { records: accepted, rejected: stale };
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function distanceSquared(a: StationRecord, b: StationRecord): number {
  const longitudeScale = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const dx = (a.lng - b.lng) * longitudeScale;
  const dy = a.lat - b.lat;
  return dx * dx + dy * dy;
}

/** Global MAD nominates suspicious values; nearby corroboration preserves genuine local hotspots. */
export function filterOutliers<T extends StationRecord>(records: T[]): { records: T[]; rejected: number } {
  const center = median(records.map((record) => record.pm25));
  if (center === null || records.length < 5) return { records, rejected: 0 };
  const mad = median(records.map((record) => Math.abs(record.pm25 - center))) ?? 0;
  const globalLimit = Math.max(50, mad * 8);
  const accepted = records.filter((record) => {
    if (Math.abs(record.pm25 - center) <= globalLimit) return true;
    const neighbors = records
      .filter((candidate) => candidate !== record)
      .sort((a, b) => distanceSquared(record, a) - distanceSquared(record, b))
      .slice(0, 3);
    const localCenter = median(neighbors.map((neighbor) => neighbor.pm25));
    return localCenter !== null && Math.abs(record.pm25 - localCenter) <= Math.max(35, mad * 6);
  });
  return { records: accepted, rejected: records.length - accepted.length };
}
