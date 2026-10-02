"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { TmdRadarFrame } from "../../lib/tmd-radar-data";
import type { RainPosition } from "../../lib/rain-nearby";
import { getRegion, type RegionId } from "../../lib/provinces";
import { getBasemapConfig } from "../../lib/basemap";
import "leaflet/dist/leaflet.css";

export type RadarImageState={id:string;status:"loading"|"ready"|"error"};
export default function RainRadarMap({region,position,frame,opacity,onSelect,onImageState}:{region:RegionId;position:RainPosition|null;frame:TmdRadarFrame|null;opacity:number;onSelect:(position:RainPosition)=>void;onImageState:(state:RadarImageState)=>void}) {
  const container=useRef<HTMLDivElement>(null), map=useRef<Leaflet.Map|null>(null);
  const leaflet=useRef<typeof Leaflet|null>(null), overlay=useRef<Leaflet.ImageOverlay|null>(null);
  const onClick=useRef(onSelect), onImage=useRef(onImageState), alpha=useRef(opacity);
  const [ready,setReady]=useState(false),[error,setError]=useState(false);
  const latitude=position?.lat,longitude=position?.lng;
  useEffect(()=>{onClick.current=onSelect;onImage.current=onImageState;alpha.current=opacity;},[onSelect,onImageState,opacity]);
  useEffect(()=> {
    let active=true;let tile:Leaflet.TileLayer|null=null;let observer:MutationObserver|null=null;let resize:ResizeObserver|null=null;
    import("leaflet").then(L=> {
      if(!active||!container.current)return;
      leaflet.current=L;
      // Frames can be replaced while the area changes. Keep their projection synchronous.
      const m=L.map(container.current,{scrollWheelZoom:false,zoomControl:true,attributionControl:true,zoomAnimation:false,markerZoomAnimation:false}).setView([13.76,100.56],9);
      map.current=m;
      const theme=()=> {
        if(tile)m.removeLayer(tile);
        const config=getBasemapConfig("street",document.documentElement.dataset.theme === "dark"?"dark":"light");
        tile=L.tileLayer(config.url,{attribution:config.attribution,maxZoom:config.maxZoom}).addTo(m);
      };
      theme();observer=new MutationObserver(theme);observer.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
      m.on("click",event=>onClick.current({lat:event.latlng.lat,lng:event.latlng.lng}));
      resize=new ResizeObserver(()=>m.invalidateSize());resize.observe(container.current);
      setReady(true);
    }).catch(()=>{if(active)setError(true);});
    return ()=>{active=false;observer?.disconnect();resize?.disconnect();map.current?.remove();map.current=null;};
  },[]);
  useEffect(()=> {
    const m=map.current,L=leaflet.current;if(!ready||!m||!L)return;
    const group=L.layerGroup().addTo(m),area=getRegion(region);
    if(latitude!==undefined&&longitude!==undefined) {
      L.circle([latitude,longitude],{radius:8000,color:"#0862d8",weight:1.5,fillColor:"#0862d8",fillOpacity:.04,dashArray:"5 5",interactive:false}).addTo(group);
      L.circleMarker([latitude,longitude],{radius:6,color:"#fff",weight:2,fillColor:"#0862d8",fillOpacity:1}).addTo(group);
      m.setView([latitude,longitude],11,{animate:false});
    }else m.fitBounds([[area.bounds.minLat,area.bounds.minLng],[area.bounds.maxLat,area.bounds.maxLng]],{padding:[24,24],animate:false});
    return ()=>{group.remove();};
  },[ready,region,latitude,longitude]);
  useEffect(()=> {
    const m=map.current,L=leaflet.current;if(!ready||!m||!L||!frame)return;
    const image=L.imageOverlay(frame.imageUrl,frame.bounds,{opacity:0,interactive:false,alt:`เรดาร์ฝน กรมอุตุนิยมวิทยา ${frame.validAt}`}).addTo(m);
    overlay.current=image;onImage.current({id:frame.id,status:"loading"});
    let finished=false;
    const fail=()=>{if(finished)return;finished=true;image.setOpacity(0);onImage.current({id:frame.id,status:"error"});};
    const timer=window.setTimeout(fail,15000);
    const loaded=()=>{if(finished)return;finished=true;clearTimeout(timer);image.setOpacity(alpha.current);onImage.current({id:frame.id,status:"ready"});};
    image.on("load",loaded);image.on("error",fail);
    return ()=>{finished=true;clearTimeout(timer);image.off();image.remove();if(overlay.current===image)overlay.current=null;};
  },[ready,frame]);
  useEffect(()=>{overlay.current?.setOpacity(opacity);},[opacity]);
  return <div className="rb-map-surface" ref={container} role="region" aria-label="แผนที่เรดาร์ฝน กดตำแหน่งเพื่อวิเคราะห์บริเวณใกล้เคียง">{!ready&&<p className="rb-map-placeholder" role="status">{error?"เปิดแผนที่ไม่ได้ ลองโหลดหน้านี้ใหม่":"กำลังเตรียมแผนที่เรดาร์…"}</p>}</div>;
}
