import { createIngestionHealthResponse } from "../../lib/ingestion-health.ts";
import { getWaterHistoryStore } from "../../lib/water-history-store.ts";

export async function GET() { return createIngestionHealthResponse(getWaterHistoryStore()); }
