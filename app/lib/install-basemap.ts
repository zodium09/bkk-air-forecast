import type * as Leaflet from "leaflet";
import { getBasemapConfig, getFallbackBasemapConfig, type BasemapKind, type BasemapTheme } from "./basemap";
import "maplibre-gl/dist/maplibre-gl.css";
import "./basemap.css";

let vectorLibrary: Promise<typeof import("@maplibre/maplibre-gl-leaflet")> | undefined;
function loadVectorLibrary() {
  return vectorLibrary ??= import("maplibre-gl").then(async library => {
    library.setWorkerUrl("/maps/maplibre/maplibre-gl-worker.mjs");
    library.setWorkerCount(2);
    return import("@maplibre/maplibre-gl-leaflet");
  }).catch(error => { vectorLibrary = undefined; throw error; });
}

/** Keeps Leaflet's data overlays above a vector basemap, with cancellable loading. */
export function installBasemap(L: typeof Leaflet, map: Leaflet.Map, kind: BasemapKind, theme: BasemapTheme, onStatus?: (message: string) => void) {
  let disposed = false, layer: Leaflet.Layer | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  const config = getBasemapConfig(kind, theme);
  const remove = () => { clearTimeout(timer); map.getContainer().classList.remove("uses-vector-basemap"); if (layer && map.hasLayer(layer)) layer.remove(); layer = undefined; };
  const raster = (fallback: boolean) => {
    if (disposed) return;
    remove();
    const source = fallback ? getFallbackBasemapConfig(theme) : config;
    const tile = L.tileLayer(source.url, { attribution: source.attribution, maxZoom: source.maxZoom });
    layer = tile;
    tile.on("tileerror", () => { if (!disposed) onStatus?.("แผนที่พื้นหลังโหลดไม่ครบ จุดข้อมูลยังเลือกได้"); });
    tile.on("tileload", () => { if (!disposed) onStatus?.(fallback ? "ใช้แผนที่สำรองระหว่างที่ OpenFreeMap ไม่พร้อม" : ""); });
    tile.addTo(map);
  };
  if (config.renderer === "raster") raster(false);
  else void loadVectorLibrary().then(({ maplibreGL }) => {
    if (disposed) return;
    const vector = maplibreGL({ style: config.url, attributionControl: { customAttribution: config.attribution }, maxZoom: config.maxZoom, interactive: false });
    layer = vector;
    try {
      map.getContainer().classList.add("uses-vector-basemap");
      vector.addTo(map);
      const renderer = vector.getMaplibreMap();
      const loaded = () => { clearTimeout(timer); if (!disposed) onStatus?.(""); };
      renderer.once("load", loaded);
      renderer.on("error", () => { if (!disposed && layer === vector && !renderer.isStyleLoaded()) raster(true); });
      timer = setTimeout(() => { if (!disposed && !renderer.isStyleLoaded()) raster(true); }, 18_000);
    } catch { raster(true); }
  }).catch(() => raster(true));
  return () => { disposed = true; remove(); };
}
