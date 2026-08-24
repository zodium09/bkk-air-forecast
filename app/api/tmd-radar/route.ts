import type {
  TmdRadarFrame,
  TmdRadarMode,
  TmdRadarPayload,
  TmdRadarStatus,
} from "../../lib/tmd-radar-data.ts";

const TMD_RADAR_CATALOG = "https://radargis.tmd.go.th/api/overlays";
const TMD_RADAR_ORIGIN = "https://radargis.tmd.go.th";
const OBSERVED_GROUP = "02 Rain Rate Overlay";
const NOWCAST_GROUP = "05 Rain Rate Nowcast Overlay";
const MAX_OBSERVED_FRAMES = 8;
const MAX_NOWCAST_FRAMES = 12;

type RawOverlay = {
  bounds?: unknown;
  group?: unknown;
  opacity?: unknown;
  product_kind?: unknown;
  title?: unknown;
  unit?: unknown;
  url?: unknown;
  valid_dt_iso?: unknown;
};

type RawCatalog = {
  overlays?: unknown;
};

function parseUtc(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?$/.test(value)) return null;
  const timestamp = Date.parse(value.endsWith("Z") ? value : `${value}Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function parseBounds(value: unknown): [[number, number], [number, number]] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [southWest, northEast] = value;
  if (!Array.isArray(southWest) || !Array.isArray(northEast) || southWest.length !== 2 || northEast.length !== 2) return null;
  const bounds = [southWest.map(Number), northEast.map(Number)] as [[number, number], [number, number]];
  if (!bounds.flat().every(Number.isFinite)) return null;
  if (bounds[0][0] >= bounds[1][0] || bounds[0][1] >= bounds[1][1]) return null;
  return bounds;
}

function parseImageUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value, TMD_RADAR_ORIGIN);
    if (url.origin !== TMD_RADAR_ORIGIN || !url.pathname.endsWith(".png")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeFrame(raw: RawOverlay, mode: TmdRadarMode, baseTime: number | null): TmdRadarFrame | null {
  if (raw.product_kind !== "rainrate" || raw.unit !== "mm/h") return null;
  const validTimestamp = parseUtc(raw.valid_dt_iso);
  const bounds = parseBounds(raw.bounds);
  const imageUrl = parseImageUrl(raw.url);
  if (validTimestamp === null || !bounds || !imageUrl) return null;
  const leadMinutes = mode === "nowcast" && baseTime !== null
    ? Math.max(0, Math.round((validTimestamp - baseTime) / 60_000))
    : 0;
  if (mode === "nowcast" && (leadMinutes < 15 || leadMinutes > 180)) return null;
  const opacityValue = Number(raw.opacity);
  const opacity = Number.isFinite(opacityValue) ? Math.min(0.9, Math.max(0.35, opacityValue)) : 0.78;
  return {
    id: `${mode}-${validTimestamp}`,
    mode,
    validAt: new Date(validTimestamp).toISOString(),
    leadMinutes,
    label: mode === "observed" ? "เรดาร์ตรวจจริง" : `คาดการณ์ +${leadMinutes} นาที`,
    imageUrl,
    bounds,
    opacity,
    unit: "mm/h",
  };
}

function unavailablePayload(fetchedAt: string): TmdRadarPayload {
  return {
    status: "unavailable",
    fetchedAt,
    observedAt: null,
    ageMinutes: null,
    source: "กรมอุตุนิยมวิทยา (TMD RadarGIS)",
    sourcePage: "https://radargis.tmd.go.th/",
    disclaimer: "เรดาร์เป็นข้อมูลกึ่งเวลาจริงและอาจมีสัญญาณรบกวน ควรใช้ร่วมกับประกาศทางการ",
    observedFrames: [],
    nowcastFrames: [],
  };
}

export async function createTmdRadarResponse(options: {
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
} = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now?.() ?? Date.now();
  const fetchedAt = new Date(now).toISOString();

  try {
    const response = await fetchImpl(TMD_RADAR_CATALOG, {
      headers: {
        Accept: "application/json",
        "User-Agent": "BKK-Air-Forecast/1.0",
      },
      signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
    });
    if (!response.ok) throw new Error(`TMD RadarGIS status ${response.status}`);
    const catalog = await response.json() as RawCatalog;
    if (!Array.isArray(catalog.overlays)) throw new Error("invalid TMD RadarGIS catalog");

    const rawObserved = (catalog.overlays as RawOverlay[])
      .filter((overlay) => overlay.group === OBSERVED_GROUP)
      .map((overlay) => ({ overlay, timestamp: parseUtc(overlay.valid_dt_iso) }))
      .filter((entry): entry is { overlay: RawOverlay; timestamp: number } => entry.timestamp !== null)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-MAX_OBSERVED_FRAMES);
    const baseTime = rawObserved.at(-1)?.timestamp ?? null;
    const observedFrames = rawObserved
      .map(({ overlay }) => normalizeFrame(overlay, "observed", baseTime))
      .filter((frame): frame is TmdRadarFrame => frame !== null);
    const nowcastFrames = (catalog.overlays as RawOverlay[])
      .filter((overlay) => overlay.group === NOWCAST_GROUP)
      .map((overlay) => normalizeFrame(overlay, "nowcast", baseTime))
      .filter((frame): frame is TmdRadarFrame => frame !== null)
      .sort((a, b) => a.leadMinutes - b.leadMinutes)
      .slice(0, MAX_NOWCAST_FRAMES);

    if (!observedFrames.length || !nowcastFrames.length || baseTime === null) throw new Error("missing TMD RadarGIS frames");
    const ageMinutes = Math.max(0, Math.round((now - baseTime) / 60_000));
    const status: TmdRadarStatus = ageMinutes <= 30 ? "live" : ageMinutes <= 60 ? "degraded" : "unavailable";
    const payload: TmdRadarPayload = status === "unavailable" ? unavailablePayload(fetchedAt) : {
      status,
      fetchedAt,
      observedAt: new Date(baseTime).toISOString(),
      ageMinutes,
      source: "กรมอุตุนิยมวิทยา (TMD RadarGIS)",
      sourcePage: "https://radargis.tmd.go.th/",
      disclaimer: "เรดาร์เป็นข้อมูลกึ่งเวลาจริงและอาจมีสัญญาณรบกวน ควรใช้ร่วมกับประกาศทางการ",
      observedFrames,
      nowcastFrames,
    };
    return Response.json(payload, {
      headers: status === "live" ? {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
        "CDN-Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        "X-TMD-Radar-Status": status,
      } : {
        "Cache-Control": "no-store",
        "X-TMD-Radar-Status": status,
      },
    });
  } catch {
    return Response.json(unavailablePayload(fetchedAt), {
      headers: { "Cache-Control": "no-store", "X-TMD-Radar-Status": "unavailable" },
    });
  }
}

export async function GET() {
  return createTmdRadarResponse();
}
