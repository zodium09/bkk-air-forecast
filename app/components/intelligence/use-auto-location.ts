"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { nearestLocationPlace, requestAppLocation } from "../../lib/app-location";
import { placeLabel, type MapPlace } from "../../lib/map-places";

export function useAutoLocation(places: MapPlace[] | undefined, onLocated: (place: MapPlace) => void, enabled = true) {
  const [locating, setLocating] = useState(false), [message, setMessage] = useState("");
  const latest = useRef({ places, onLocated }), revision = useRef(0), attempted = useRef(false);
  useEffect(() => { latest.current = { places, onLocated }; }, [places, onLocated]);
  const cancel = useCallback(() => { revision.current++; attempted.current = true; setLocating(false); setMessage(""); }, []);
  const locate = useCallback(async (retry = false) => {
    const current = ++revision.current;
    setLocating(true); setMessage("กำลังค้นหาพื้นที่ใกล้คุณ…");
    const result = await requestAppLocation(navigator.geolocation, retry);
    if (current !== revision.current) return;
    setLocating(false);
    if (result.error) { setMessage(result.error === "denied" ? "ยังไม่ได้อนุญาตตำแหน่ง เลือกพื้นที่เองได้ หรืออนุญาตในเบราว์เซอร์แล้วลองอีกครั้ง" : "ค้นหาตำแหน่งไม่ได้ เลือกพื้นที่จากรายชื่อแทนได้"); return; }
    const nearby = nearestLocationPlace(latest.current.places ?? [], result.position);
    if (!nearby) { setMessage("ตำแหน่งอยู่นอกพื้นที่ข้อมูล เลือกพื้นที่ในเจ้าพระยาหรือกรุงเทพฯ–ปริมณฑลได้"); return; }
    latest.current.onLocated(nearby.place);
    setMessage(`จุดอ้างอิง ${placeLabel(nearby.place)} · ห่างจากคุณประมาณ ${nearby.km.toFixed(1)} กม. ข้อมูลไม่ใช่ค่าตรวจวัด ณ ตำแหน่งของคุณ`);
  }, []);
  useEffect(() => {
    if (!enabled || !places?.length || attempted.current) return;
    const timer = setTimeout(() => { attempted.current = true; void locate(); }, 0);
    return () => clearTimeout(timer);
  }, [enabled, places, locate]);
  useEffect(() => () => { revision.current++; }, []);
  return { locating, message, cancel, locate: () => void locate(true) };
}
