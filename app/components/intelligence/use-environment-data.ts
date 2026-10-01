"use client";
import { useEffect, useState } from "react";
import {
  aggregateMetroForecast,
  type ForecastPayload,
} from "../../lib/forecast-data";
import { provinces, type RegionId } from "../../lib/provinces";
import {
  normalizeAir,
  normalizeWeather,
  type DataMode,
  type EnvironmentLayer,
  type MapDataset,
} from "../../lib/map-intelligence";

import { environmentRequest, type WeatherSource } from "../../lib/dashboard-controls";
import { useRefreshPulse } from "./use-live-resource";

const cache = new Map<string, { data: MapDataset; at: number }>();
export function useEnvironmentData(
  layer: EnvironmentLayer,
  province: RegionId,
  mode: DataMode,
  refresh: number,
  source: WeatherSource = "open-meteo",
  metric: "primary" | "secondary" = "primary",
  directRain = false,
) {
  const requestMode = mode === "observation" ? "observation" : "forecast";
  const { pulse } = useRefreshPulse(300000);
  const request = environmentRequest(layer, province, requestMode, source, metric, directRain);
  const cacheKey = request.key;
  const key = `${cacheKey}:${refresh}:${pulse}`;
  const [result, setResult] = useState<{
    key: string;
    resource: string;
    data: MapDataset | null;
    loading: boolean;
    error: string;
  }>({ key, resource: cacheKey, data: null, loading: true, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    const saved = cache.get(cacheKey);
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    async function get(url: string) {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: refresh || pulse ? "no-cache" : "default",
      });
      if (!response.ok) throw new Error("แหล่งข้อมูลไม่ตอบกลับ");
      return response.json();
    }
    async function load() {
      if (!refresh && !pulse && saved && Date.now() - saved.at < 300_000)
        return saved.data;
      if (layer === "air") {
        const payload: ForecastPayload =
          requestMode === "observation" && province === "metro"
            ? aggregateMetroForecast(
                await Promise.all(
                  provinces.map((p) => get(`/api/forecast?province=${p.id}`)),
                ),
              )
            : await get(`/api/forecast?province=${province}`);
        return normalizeAir(payload, requestMode);
      }

      if (layer === "rain" && directRain) return await get(request.url) as MapDataset;
      return normalizeWeather(
        await get(request.url),
        layer,
      );
    }
    let active = true;
    load()
      .then((data) => {
        if (!active) return;
        cache.set(cacheKey, { data, at: Date.now() });
        setResult({ key, resource: cacheKey, data, loading: false, error: "" });
      })
      .catch(() => {
        if (active)
          setResult(previous => ({
            key,
            resource: cacheKey,
            data: previous.resource === cacheKey ? previous.data : null,
            loading: false,
            error: "โหลดรอบใหม่ไม่ได้ · ตรวจสอบเวลาในข้อมูลที่แสดง",
          }));
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [key, cacheKey, layer, province, requestMode, refresh, pulse, request.url, directRain]);
  return result.resource === cacheKey
    ? { ...result, loading: result.loading || result.key !== key && !result.data, refreshing: result.key !== key && !!result.data }
    : { key, data: null, loading: true, refreshing: false, error: "" };
}
