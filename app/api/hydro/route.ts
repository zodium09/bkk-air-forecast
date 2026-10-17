import { createHydroResponse } from "../../lib/hydro/response.ts";
import { getWaterHistoryStore } from "../../lib/water-history-store.ts";

export async function GET() { return createHydroResponse({ store: getWaterHistoryStore() }); }
