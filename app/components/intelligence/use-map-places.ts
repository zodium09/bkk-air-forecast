"use client";
import { useEffect, useMemo, useState } from "react";
import { regionPlaces, type MapPlaceCatalog } from "../../lib/map-places";
import type { RegionId } from "../../lib/provinces";

export function useMapPlaces(region: RegionId, refresh: number) {
  const [result, setResult] = useState<{ catalog: MapPlaceCatalog | null; loading: boolean; error: string }>({ catalog: null, loading: true, error: "" });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    fetch("/api/map-places", { signal: controller.signal, cache: refresh ? "reload" : "default" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Geography unavailable");
        const catalog: MapPlaceCatalog = await response.json();
        if (!catalog.places?.length) throw new Error("Empty geography");
        if (active) setResult({ catalog, loading: false, error: "" });
      })
      .catch(() => {
        if (active) setResult({ catalog: null, loading: false, error: "โหลดตำแหน่งถนนและพื้นที่ไม่สำเร็จ ลองโหลดข้อมูลอีกครั้ง" });
      })
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [refresh]);
  const places = useMemo(() => regionPlaces(result.catalog?.places ?? [], region), [result.catalog, region]);
  return { ...result, places };
}
