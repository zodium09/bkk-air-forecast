import metroCatalog from "../data/map-places.json" with { type: "json" };
import riverPlaces from "../data/chao-phraya-places.json" with { type: "json" };
import type { MapPlaceCatalog } from "./map-places.ts";

export const mapPlaceCatalog = {
  ...metroCatalog,
  generatedAt: riverPlaces.generatedAt,
  sources: [...metroCatalog.sources, { name: "DMR subdistricts intersected with DWR T22Basin", url: riverPlaces.sourceUrl }],
  places: [...metroCatalog.places, ...riverPlaces.places],
} as MapPlaceCatalog;
