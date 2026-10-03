"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { GeoJsonObject } from "geojson";
import { getRegion, type RegionId } from "../../lib/provinces";
import { installBasemap } from "../../lib/install-basemap";
import { observeVisibleMap } from "../../lib/visible-map";
import { riskBands, type RiskAreaPoint } from "../../lib/risk-area-data";
import type { MapBoundary } from "../../lib/map-surface";
import "leaflet/dist/leaflet.css";

export default function RiskAreaMap({ region, points, selectedId, focusId, viewKey, boundary, detailId, onSelect }: {
  region: RegionId; points: RiskAreaPoint[]; selectedId?: string; focusId?: string; viewKey: string;
  boundary?: MapBoundary | null; detailId: string; onSelect: (point: RiskAreaPoint) => void;
}) {
  const container = useRef<HTMLDivElement>(null), map = useRef<Leaflet.Map | null>(null), library = useRef<typeof Leaflet | null>(null);
  const select = useRef(onSelect), markers = useRef(new Map<string,Leaflet.Marker>());
  const [ready,setReady] = useState(false), [error,setError] = useState(false), [tilesMissing,setTilesMissing] = useState(false);
  useEffect(() => { select.current = onSelect; }, [onSelect]);
  useEffect(() => {
    let active = true, seen = false, initializing = false, observer: MutationObserver | null = null, removeBase: (()=>void) | undefined;
    const host = container.current;
    if (!host) return;
    const initialize = async () => {
      if (initializing || !active || !host.clientWidth || !host.clientHeight) return;
      initializing = true;
      try {
        const L = await import("leaflet");
        if (!active || !host.clientWidth || !host.clientHeight) return;
        library.current = L;
        const m = L.map(host,{ trackResize:false, scrollWheelZoom:false, zoomAnimation:false, markerZoomAnimation:false, fadeAnimation:false }).setView([14.6,100.5],8);
        map.current = m;
        const theme = () => {
          removeBase?.(); setTilesMissing(false);
          removeBase = installBasemap(L,m,"street",document.documentElement.dataset.theme === "dark" ? "dark" : "light",message => { if(active) setTilesMissing(!!message); });
        };
        theme(); observer = new MutationObserver(theme); observer.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
        setReady(true);
      } catch { if(active) setError(true); } finally { initializing = false; }
    };
    const stopResize = observeVisibleMap(host, () => { if(map.current) map.current.invalidateSize(); else if(seen) void initialize(); });
    const visible = new IntersectionObserver(entries => { if(entries.some(e => e.isIntersecting)) { seen = true; visible.disconnect(); void initialize(); } },{rootMargin:"240px"});
    visible.observe(host);
    return () => { active=false; visible.disconnect(); observer?.disconnect(); stopResize(); removeBase?.(); map.current?.remove(); map.current=null; markers.current.clear(); };
  },[]);
  useEffect(() => {
    const m = map.current, L = library.current;
    if(!ready || !m || !L) return;
    const controller = new AbortController();
    let active = true, outline: Leaflet.GeoJSON | null = null;
    const draw = (data: MapBoundary) => { if(active) outline = L.geoJSON(data as GeoJsonObject,{interactive:false,style:{color:"#6a91a5",weight:1.2,fillColor:"#6a91a5",fillOpacity:.035}}).addTo(m); };
    if(boundary) draw(boundary);
    else fetch(`/api/province-boundary?province=${encodeURIComponent(region)}`,{signal:controller.signal}).then(r => { if(!r.ok) throw new Error("boundary"); return r.json(); }).then(draw).catch(() => { /* Points and accessible detail remain usable without an outline. */ });
    return () => { active=false; controller.abort(); outline?.remove(); };
  },[ready,region,boundary]);
  useEffect(() => {
    const m = map.current, L = library.current;
    if(!ready || !m || !L) return;
    const group = L.layerGroup().addTo(m), current = new Map<string,Leaflet.Marker>();
    for(const point of [...points].sort((a,b) => a.rank-b.rank)) {
      const band = riskBands.find(b => b.rank === point.rank)!;
      const icon = L.divIcon({className:"ra-marker",iconSize:[44,44],iconAnchor:[22,22],html:`<span class="ra-marker-dot ra-rank-${point.rank}" style="--ra-point:${band.color}"><i>${point.rank < 0 ? "?" : point.rank > 0 ? point.rank : ""}</i></span>`});
      const marker = L.marker([point.lat,point.lng],{icon,keyboard:true,title:`${point.name} · ${point.status}`,zIndexOffset:point.rank*10}).addTo(group);
      const element = marker.getElement();
      element?.setAttribute("aria-label",`${point.name} · ${point.area} · ${point.status}`);
      element?.setAttribute("aria-controls",detailId);
      element?.addEventListener("keydown",event => {
        if(event.key === "Enter" || event.key === " ") {
          event.preventDefault(); event.stopPropagation(); select.current(point);
        }
      });
      marker.on("click",() => select.current(point));
      current.set(point.id,marker);
    }
    markers.current=current;
    return () => { group.remove(); if(markers.current===current) markers.current=new Map(); };
  },[ready,points,detailId]);
  useEffect(() => {
    for(const [id,marker] of markers.current) {
      const active = id === selectedId;
      marker.getElement()?.classList.toggle("is-selected",active);
      marker.getElement()?.setAttribute("aria-pressed",String(active));
      marker.setZIndexOffset(active ? 1000 : points.find(p => p.id === id)!.rank * 10);
    }
  },[ready,points,selectedId]);
  const hasPoints = points.length > 0;
  const geometryKey = points.map(p=>`${p.id}:${p.lat}:${p.lng}`).join("|");
  const latestPoints = useRef(points);
  useEffect(() => { latestPoints.current=points; },[points]);
  useEffect(() => {
    const m=map.current,L=library.current;
    if(!ready || !m || !L) return;
    const rows=latestPoints.current;
    if(rows.length) m.fitBounds(L.latLngBounds(rows.map(p => [p.lat,p.lng])),{padding:[40,40],maxZoom:12,animate:false});
    else { const b=getRegion(region).bounds; m.fitBounds([[b.minLat,b.minLng],[b.maxLat,b.maxLng]],{padding:[22,22],animate:false}); }
  },[ready,region,viewKey,hasPoints,geometryKey]);
  useEffect(() => {
    if(!ready || !focusId) return;
    const marker = markers.current.get(focusId);
    if(marker) map.current?.panTo(marker.getLatLng(),{animate:false});
  },[ready,points,focusId]);
  return <div className="ra-map-wrap"><div ref={container} className="ra-map" role="region" aria-label="แผนที่จุดแบ่งสีระดับติดตาม เลือกจุดเพื่ออ่านรายละเอียด">{!ready && <p className="ra-map-placeholder" role="status">{error ? "เปิดแผนที่ไม่ได้ อ่านรายละเอียดพื้นที่ด้านข้างได้" : "กำลังเตรียมแผนที่พื้นที่…"}</p>}</div>{tilesMissing && <p className="ra-tile-note" role="status">ภาพพื้นหลังบางส่วนโหลดไม่ได้ จุดข้อมูลและรายการพื้นที่ยังใช้ได้</p>}</div>;
}
