import { createWaterHistoryResponse } from "../../lib/water-history-response.ts";
import { getWaterHistoryStore } from "../../lib/water-history-store.ts";

export async function GET(request: Request) { return createWaterHistoryResponse(request, getWaterHistoryStore()); }
