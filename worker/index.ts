/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const CACHEABLE_API_PATHS = new Set([
  "/api/forecast",
  "/api/rain-forecast",
  "/api/tmd-radar",
  "/api/bangkok-boundary",
  "/api/province-boundary",
]);

function normalizedCacheRequest(request: Request) {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (!CACHEABLE_API_PATHS.has(url.pathname)) return null;
  url.searchParams.delete("refresh");
  url.searchParams.sort();
  return new Request(url.toString(), { method: "GET", headers: { Accept: request.headers.get("accept") ?? "*/*" } });
}

function responseWithCacheStatus(response: Response, status: "HIT" | "MISS" | "BYPASS") {
  const headers = new Headers(response.headers);
  const browserCacheControl = headers.get("X-Browser-Cache-Control");
  if (browserCacheControl) headers.set("Cache-Control", browserCacheControl);
  headers.delete("X-Browser-Cache-Control");
  headers.set("X-Edge-Cache", status);
  return new Response(response.body, { headers, status: response.status, statusText: response.statusText });
}

async function fetchWithEdgeCache(request: Request, env: Env, ctx: ExecutionContext) {
  const cacheRequest = normalizedCacheRequest(request);
  if (!cacheRequest) return handler.fetch(request, env, ctx);

  // Some managed Workers runtimes do not expose the default Cache API. Accessing
  // the getter throws before a route can run, so degrade to the application
  // response instead of taking every data endpoint down.
  let cache: Cache;
  try {
    cache = caches.default;
  } catch {
    const response = await handler.fetch(request, env, ctx);
    return responseWithCacheStatus(response, "BYPASS");
  }

  const cached = await cache.match(cacheRequest);
  if (cached) return responseWithCacheStatus(cached, "HIT");

  const response = await handler.fetch(request, env, ctx);
  const cacheControl = response.headers.get("Cache-Control") ?? "";
  if (response.ok && !cacheControl.includes("no-store")) {
    const headers = new Headers(response.headers);
    const edgeCacheControl = headers.get("CDN-Cache-Control") ?? cacheControl;
    headers.set("X-Browser-Cache-Control", cacheControl);
    headers.set("Cache-Control", edgeCacheControl);
    const cacheResponse = new Response(response.clone().body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
    ctx.waitUntil(cache.put(cacheRequest, cacheResponse));
  }
  return responseWithCacheStatus(response, "MISS");
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return fetchWithEdgeCache(request, env, ctx);
  },
};

export default worker;
