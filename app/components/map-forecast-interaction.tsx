"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { AdministrativeArea } from "../api/administrative-area/route";
import type { LocationSelection } from "./location-forecast-card";

export type MapForecastSnapshot = {
  value: number | null;
  valueLabel: string;
  unit: string;
  secondary?: string;
  interpretation: string;
  color: string;
};

type HoverState = {
  lat: number;
  lng: number;
  x: number;
  y: number;
  mapWidth: number;
  mapHeight: number;
  snapshot: MapForecastSnapshot;
  area: AdministrativeArea | null;
  loadingArea: boolean;
};

const areaCache = new Map<string, AdministrativeArea | null>();

function cacheKey(lat: number, lng: number) {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

async function loadArea(lat: number, lng: number, signal?: AbortSignal) {
  const key = cacheKey(lat, lng);
  if (areaCache.has(key)) return areaCache.get(key) ?? null;
  const response = await fetch(`/api/administrative-area?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}`, { signal });
  if (!response.ok) {
    areaCache.set(key, null);
    return null;
  }
  const area = await response.json() as AdministrativeArea;
  areaCache.set(key, area);
  return area;
}

export function useMapForecastInteraction({
  mapReady,
  mapRef,
  selection,
  getSnapshot,
  onSelect,
}: {
  mapReady: boolean;
  mapRef: RefObject<import("leaflet").Map | null>;
  selection: LocationSelection | null;
  getSnapshot: (lat: number, lng: number) => MapForecastSnapshot;
  onSelect: (selection: LocationSelection) => void;
}) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const [selectedAreaResult, setSelectedAreaResult] = useState<{ key: string; area: AdministrativeArea | null } | null>(null);
  const snapshotRef = useRef(getSnapshot);
  const selectRef = useRef(onSelect);
  const hoverTimerRef = useRef<number | null>(null);
  const hoverRequestRef = useRef<AbortController | null>(null);
  useEffect(() => { snapshotRef.current = getSnapshot; }, [getSnapshot]);
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!selection) return;
    const controller = new AbortController();
    const key = cacheKey(selection.lat, selection.lng);
    loadArea(selection.lat, selection.lng, controller.signal)
      .then((area) => setSelectedAreaResult({ key, area }))
      .catch(() => setSelectedAreaResult({ key, area: null }));
    return () => controller.abort();
  }, [selection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    let animationFrame = 0;
    let pendingEvent: import("leaflet").LeafletMouseEvent | null = null;

    const scheduleArea = (lat: number, lng: number) => {
      if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
      hoverRequestRef.current?.abort();
      setHover((current) => current ? { ...current, area: null, loadingArea: true } : current);
      hoverTimerRef.current = window.setTimeout(() => {
        const controller = new AbortController();
        hoverRequestRef.current = controller;
        loadArea(lat, lng, controller.signal).then((area) => {
          setHover((current) => current && cacheKey(current.lat, current.lng) === cacheKey(lat, lng)
            ? { ...current, area, loadingArea: false }
            : current);
        }).catch(() => undefined);
      }, 520);
    };

    const updateHover = () => {
      animationFrame = 0;
      if (!pendingEvent) return;
      const event = pendingEvent;
      const point = map.latLngToContainerPoint(event.latlng);
      const size = map.getSize();
      const next = {
        lat: event.latlng.lat,
        lng: event.latlng.lng,
        x: point.x,
        y: point.y,
        mapWidth: size.x,
        mapHeight: size.y,
        snapshot: snapshotRef.current(event.latlng.lat, event.latlng.lng),
      };
      setHover((current) => ({ ...next, area: current?.area ?? null, loadingArea: true }));
      scheduleArea(next.lat, next.lng);
    };
    const move = (event: import("leaflet").LeafletMouseEvent) => {
      pendingEvent = event;
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateHover);
    };
    const leave = () => {
      setHover(null);
      if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
      hoverRequestRef.current?.abort();
    };
    const click = (event: import("leaflet").LeafletMouseEvent) => selectRef.current({ lat: event.latlng.lat, lng: event.latlng.lng, source: "map" });
    map.on("mousemove", move);
    map.on("mouseout", leave);
    map.on("dragstart zoomstart", leave);
    map.on("click", click);
    return () => {
      map.off("mousemove", move);
      map.off("mouseout", leave);
      map.off("dragstart zoomstart", leave);
      map.off("click", click);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
      hoverRequestRef.current?.abort();
    };
  }, [mapReady, mapRef]);

  const selectedArea = selection && selectedAreaResult?.key === cacheKey(selection.lat, selection.lng) ? selectedAreaResult.area : null;
  return { hover, selectedArea };
}

export function MapForecastHover({ hover }: { hover: HoverState | null }) {
  if (!hover) return null;
  const rightEdge = hover.x > hover.mapWidth - 250;
  const bottomEdge = hover.y > hover.mapHeight - 170;
  const place = hover.area?.label || (hover.loadingArea ? "กำลังระบุตำบล/แขวง…" : "ไม่พบชื่อพื้นที่");
  return (
    <div
      className={`map-forecast-hover ${rightEdge ? "edge-right" : ""} ${bottomEdge ? "edge-bottom" : ""}`}
      style={{ left: hover.x, top: hover.y, "--hover-color": hover.snapshot.color } as React.CSSProperties}
      role="status"
    >
      <span>{hover.snapshot.valueLabel}</span>
      <strong>{hover.snapshot.value === null ? "—" : hover.snapshot.value}<small>{hover.snapshot.unit}</small></strong>
      {hover.snapshot.secondary && <em>{hover.snapshot.secondary}</em>}
      <b>{hover.snapshot.interpretation}</b>
      <p>{place}</p>
      <small>คลิกเพื่อดูแนวโน้ม 48 ชั่วโมง</small>
    </div>
  );
}
