import { normalizeUpstream, UPSTREAM_SOURCES } from "../../lib/chao-phraya-upstream.ts";
import { fetchWithTimeout } from "../../lib/fetch-with-timeout.ts";

export async function createUpstreamResponse(options: { fetchImpl?: typeof fetch; now?: number } = {}) {
  const entries = await Promise.all(Object.entries(UPSTREAM_SOURCES).map(async ([key,url]) => {
    try { const response = await fetchWithTimeout(options.fetchImpl ?? fetch, url, { headers: { Accept: "application/json" }, next: { revalidate: 300 } }, 9000); return [key, response.ok ? await response.json() : null] as const; }
    catch { return [key,null] as const; }
  }));
  const payload = normalizeUpstream(Object.fromEntries(entries), options.now ?? Date.now());
  return Response.json(payload, { headers: payload.status === "unavailable" ? { "Cache-Control": "no-store" } : { "Cache-Control": "public, max-age=60", "CDN-Cache-Control": "public, max-age=300" } });
}
export async function GET() { return createUpstreamResponse(); }
