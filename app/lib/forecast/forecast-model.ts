export type CamsDailyInput = { current: number | null; hourly: { time: string[]; pm2_5: Array<number | null> } };
export type CamsDailyForecast = { values: number[]; coverage: number[]; extrapolated: boolean[] };

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function buildCamsDailyForecast(input: CamsDailyInput, targetDates: string[]): CamsDailyForecast {
  const grouped = new Map<string, number[]>();
  input.hourly.time.forEach((time, index) => {
    const value = input.hourly.pm2_5[index];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return;
    const values = grouped.get(time.slice(0, 10)) ?? [];
    values.push(value);
    grouped.set(time.slice(0, 10), values);
  });
  const values: number[] = [];
  const coverage = targetDates.map((date) => grouped.get(date)?.length ?? 0);
  const extrapolated: boolean[] = [];
  targetDates.forEach((date, index) => {
    const hourly = grouped.get(date) ?? [];
    if (hourly.length >= 6) {
      values.push(hourly.reduce((sum, value) => sum + value, 0) / hourly.length);
      extrapolated.push(false);
      return;
    }
    const current = typeof input.current === "number" && Number.isFinite(input.current) ? input.current : 0;
    const previous = values[index - 1] ?? current;
    const beforePrevious = values[index - 2] ?? previous;
    values.push(clamp(previous + clamp(previous - beforePrevious, -3, 3), 0, 500));
    extrapolated.push(true);
  });
  return { values, coverage, extrapolated };
}

export function calculateBiasCorrection(observation: number, modelCurrent: number | null): number {
  return modelCurrent === null ? 0 : clamp(observation - modelCurrent, -60, 60);
}

/** Heuristic score, not a probability: lead time, sources, CAMS coverage, and observation age. */
export function calculateReliabilityScore(input: { leadDays: number; sourceAvailability: number; camsCoverageHours: number; observationAgeHours: number }): number {
  const leadPenalty = Math.max(0, input.leadDays - 1) * 8;
  const sourcePenalty = (1 - clamp(input.sourceAvailability, 0, 1)) * 25;
  const coveragePenalty = (1 - clamp(input.camsCoverageHours / 24, 0, 1)) * 20;
  const agePenalty = clamp(input.observationAgeHours / 6, 0, 1) * 15;
  return Math.round(clamp(95 - leadPenalty - sourcePenalty - coveragePenalty - agePenalty, 20, 95));
}
