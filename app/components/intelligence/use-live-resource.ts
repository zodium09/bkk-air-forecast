"use client";
import { useEffect, useRef, useState } from "react";
import { refreshDue } from "../../lib/refresh-policy";

export function useRefreshPulse(interval: number) {
  const [pulse, setPulse] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const last = useRef(clock);
  useEffect(() => {
    const check = (force = false) => {
      if (document.hidden) return;
      const now = Date.now(); setClock(now);
      if (force || refreshDue(now, last.current, interval)) { last.current = now; setPulse(v => v + 1); }
    };
    const visible = () => check();
    const online = () => check(true);
    const timer = window.setInterval(visible, Math.min(interval, 60000));
    document.addEventListener("visibilitychange", visible); window.addEventListener("online", online);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visible); window.removeEventListener("online", online); };
  }, [interval]);
  return { pulse, clock };
}

export type LiveResource<T> = { data: T | null; loading: boolean; refreshing: boolean; error: string; clock: number };
export function useLiveResource<T>(url: string | null, refresh = 0, interval = 300000): LiveResource<T> {
  const { pulse, clock } = useRefreshPulse(interval);
  const [result, setResult] = useState<{ url: string | null; key: string; data: T | null; error: string }>({ url: null, key: "", data: null, error: "" });
  const key = `${url}:${refresh}:${pulse}`;
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController(); let active = true;
    const timer = window.setTimeout(() => controller.abort(), 20000);
    fetch(url, { signal: controller.signal, cache: refresh || pulse ? "no-cache" : "default" }).then(response => { if (!response.ok) throw new Error("unavailable"); return response.json() as Promise<T>; }).then(data => { if (active) setResult({ url, key, data, error: "" }); }).catch(() => {
      if (active) setResult(previous => ({ url, key, data: previous.url === url ? previous.data : null, error: "โหลดรอบใหม่ไม่ได้ · ตรวจสอบเวลาในข้อมูลที่แสดง" }));
    }).finally(() => clearTimeout(timer));
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [url, refresh, pulse, key]);
  const data = result.url === url ? result.data : null;
  return { data, loading: !!url && !data && result.key !== key, refreshing: !!url && !!data && result.key !== key, error: result.url === url ? result.error : "", clock };
}
