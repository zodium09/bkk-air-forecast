export type TmdRadarStatus = "live" | "degraded" | "unavailable";
export type TmdRadarMode = "observed" | "nowcast";

export type TmdRadarFrame = {
  id: string;
  mode: TmdRadarMode;
  validAt: string;
  leadMinutes: number;
  label: string;
  imageUrl: string;
  bounds: [[number, number], [number, number]];
  opacity: number;
  unit: "mm/h";
};

export type TmdRadarPayload = {
  status: TmdRadarStatus;
  fetchedAt: string;
  observedAt: string | null;
  ageMinutes: number | null;
  source: string;
  sourcePage: string;
  disclaimer: string;
  reason?: "stale" | "missing-observed" | "missing-nowcast" | "upstream-error";
  observedFrames: TmdRadarFrame[];
  nowcastFrames: TmdRadarFrame[];
};
