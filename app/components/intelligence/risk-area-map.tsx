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
  const [rankFilter, setRankFilter] = useState<number | "all">("all");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [wheelZoom, setWheelZoom] = useState(false);
  const visiblePoints = rankFilter === "all" ? points : points.filter(p => p.rank === rankFilter);
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
        const m = L.map(host,{ trackResize:false, scrollWheelZoom:false, zoomAnimation:true, markerZoomAnimation:true, fadeAnimation:true }).setView([14.6,100.5],8);
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
    const m = map.current;
    if (!ready || !m) return;
    if (wheelZoom) m.scrollWheelZoom.enable(); else m.scrollWheelZoom.disable();
  }, [ready, wheelZoom]);
  useEffect(() => {
    const m = map.current, L = library.current;
    if(!ready || !m || !L) return;
    const controller = new AbortController();
    let active = true, outline: Leaflet.GeoJSON | null = null;
    const draw = (data: MapBoundary) => { if(active) outline = L.geoJSON(data as GeoJsonObject,{interactive:false,style:{color:"#0d9488",weight:1.6,fillColor:"#0d9488",fillOpacity:.05}}).addTo(m); };
    if(boundary) draw(boundary);
    else fetch(`/api/province-boundary?province=${encodeURIComponent(region)}`,{signal:controller.signal}).then(r => { if(!r.ok) throw new Error("boundary"); return r.json(); }).then(draw).catch(() => { /* Points and accessible detail remain usable without an outline. */ });
    return () => { active=false; controller.abort(); outline?.remove(); };
  },[ready,region,boundary]);
  useEffect(() => {
    const m = map.current, L = library.current;
    if(!ready || !m || !L) return;
    const group = L.layerGroup().addTo(m), current = new Map<string,Leaflet.Marker>();
    for(const point of [...visiblePoints].sort((a,b) => a.rank-b.rank)) {
      const band = riskBands.find(b => b.rank === point.rank)!;
      const pulse = point.rank >= 2 ? `<span class="ra-marker-pulse" style="--ra-point:${band.color}"></span>` : "";
      const icon = L.divIcon({className:"ra-marker",iconSize:[44,44],iconAnchor:[22,22],html:`${pulse}<span class="ra-marker-dot ra-rank-${point.rank}" style="--ra-point:${band.color}"><i>${point.rank < 0 ? "?" : point.rank > 0 ? point.rank : ""}</i></span>`});
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
      marker.on("mouseover",() => setHoveredId(point.id));
      marker.on("mouseout",() => setHoveredId(prev => prev === point.id ? null : prev));
      current.set(point.id,marker);
    }
    markers.current=current;
    return () => { group.remove(); if(markers.current===current) markers.current=new Map(); };
  },[ready,visiblePoints,detailId]);
  useEffect(() => {
    for(const [id,marker] of markers.current) {
      const active = id === selectedId;
      const point = visiblePoints.find(p => p.id === id);
      marker.getElement()?.classList.toggle("is-selected",active);
      marker.getElement()?.setAttribute("aria-pressed",String(active));
      if (point) marker.setZIndexOffset(active ? 1000 : point.rank * 10);
    }
  },[ready,visiblePoints,selectedId]);
  const hasPoints = visiblePoints.length > 0;
  const geometryKey = visiblePoints.map(p=>`${p.id}:${p.lat}:${p.lng}`).join("|");
  const latestPoints = useRef(visiblePoints);
  useEffect(() => { latestPoints.current=visiblePoints; },[visiblePoints]);
  const fitAllPoints = () => {
    const m=map.current,L=library.current;
    if(!ready || !m || !L) return;
    const rows=latestPoints.current.length ? latestPoints.current : points;
    if(rows.length) m.fitBounds(L.latLngBounds(rows.map(p => [p.lat,p.lng])),{padding:[40,40],maxZoom:12,animate:false});
    else { const b=getRegion(region).bounds; m.fitBounds([[b.minLat,b.minLng],[b.maxLat,b.maxLng]],{padding:[22,22],animate:false}); }
  };
  useEffect(() => {
    fitAllPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ready,region,viewKey,hasPoints,geometryKey]);
  useEffect(() => {
    if(!ready || !focusId) return;
    const marker = markers.current.get(focusId);
    if(marker) map.current?.panTo(marker.getLatLng(),{animate:false});
  },[ready,visiblePoints,focusId]);
  const activePoint = points.find(p => p.id === (hoveredId ?? selectedId));
  const counts = {
    3: points.filter(p => p.rank === 3).length,
    2: points.filter(p => p.rank === 2).length,
    0: points.filter(p => p.rank === 0).length,
    [-1]: points.filter(p => p.rank < 0).length,
  };
  return <div className="ra-map-wrap">
    {ready && points.length > 0 && <div className="ra-map-overlay-top" role="toolbar" aria-label="ตัวกรองและมุมมองแผนที่">
      <div className="ra-map-pills">
        <button type="button" aria-pressed={rankFilter === "all"} onClick={() => setRankFilter("all")}>ทั้งหมด <b>{points.length}</b></button>
        {counts[3] > 0 && <button type="button" className="is-rank-3" aria-pressed={rankFilter === 3} onClick={() => setRankFilter(rankFilter === 3 ? "all" : 3)}><i />เกินเกณฑ์ <b>{counts[3]}</b></button>}
        {counts[2] > 0 && <button type="button" className="is-rank-2" aria-pressed={rankFilter === 2} onClick={() => setRankFilter(rankFilter === 2 ? "all" : 2)}><i />น้ำมาก <b>{counts[2]}</b></button>}
        {counts[0] > 0 && <button type="button" className="is-rank-0" aria-pressed={rankFilter === 0} onClick={() => setRankFilter(rankFilter === 0 ? "all" : 0)}><i />ปกติ <b>{counts[0]}</b></button>}
        {counts[-1] > 0 && <button type="button" className="is-rank--1" aria-pressed={rankFilter === -1} onClick={() => setRankFilter(rankFilter === -1 ? "all" : -1)}><i />รอประเมิน <b>{counts[-1]}</b></button>}
      </div>
      <div className="ra-map-actions">
        <button type="button" onClick={fitAllPoints} title="ปรับมุมมองให้เห็นทุกสถานี">พอดีขอบเขต</button>
        {selectedId && <button type="button" onClick={() => { const pt = points.find(p => p.id === selectedId); if (pt && map.current) map.current.setView([pt.lat, pt.lng], Math.max(map.current.getZoom(), 11), { animate: false }); }}>โฟกัสจุดที่เลือก</button>}
        <button type="button" aria-pressed={wheelZoom} onClick={() => setWheelZoom(v => !v)}>{wheelZoom ? "ล็อกซูมเมาส์" : "ซูมด้วยเมาส์"}</button>
      </div>
    </div>}
    <div ref={container} className="ra-map" role="region" aria-label="แผนที่จุดแบ่งสีระดับติดตาม เลือกจุดเพื่ออ่านรายละเอียด">{!ready && <p className="ra-map-placeholder" role="status">{error ? "เปิดแผนที่ไม่ได้ อ่านรายละเอียดพื้นที่ด้านข้างได้" : "กำลังเตรียมแผนที่พื้นที่…"}</p>}</div>
    {ready && activePoint && <div className={`ra-map-hud ra-hud-rank-${activePoint.rank}`} role="status" aria-live="polite">
      <div className="ra-map-hud-main">
        <span className="ra-map-hud-badge"><i />{activePoint.status}</span>
        <strong>{activePoint.name}</strong>
        <small>{activePoint.area} · {activePoint.source}</small>
      </div>
      <div className="ra-map-hud-reading">
        <b>{activePoint.value !== null ? new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(activePoint.value) : "—"}</b>
        <span>{activePoint.unit}</span>
      </div>
    </div>}
    {tilesMissing && <p className="ra-tile-note" role="status">ภาพพื้นหลังบางส่วนโหลดไม่ได้ จุดข้อมูลและรายการพื้นที่ยังใช้ได้</p>}
  </div>;
}
