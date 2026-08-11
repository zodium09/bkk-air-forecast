"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  forecastDays as bundledDays,
  forecastStations as bundledStations,
  getLevel,
  issuedAt as bundledIssuedAt,
  type ForecastDay,
  type ForecastStation,
} from "./lib/forecast-data";
import "leaflet/dist/leaflet.css";

type ForecastPayload = {
  status: string;
  issuedAt: string;
  model?: string;
  disclaimer?: string;
  sources?: string[];
  dataQuality?: { acceptedStations?: number; observationAgeHours?: number; camsMinimumCoverageHours?: number };
  days: ForecastDay[];
  stations: ForecastStation[];
};

type Coordinate = [number, number];
type PolygonCoordinates = Coordinate[][];
type BoundaryFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: PolygonCoordinates | PolygonCoordinates[];
  };
};
type BoundaryCollection = {
  type: "FeatureCollection";
  features: BoundaryFeature[];
};

const fallbackBoundary: BoundaryCollection = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: { NAME_T: "กรุงเทพมหานคร (ขอบเขตสำรอง)" },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [100.327, 13.652], [100.376, 13.615], [100.47, 13.63], [100.568, 13.645],
        [100.668, 13.638], [100.759, 13.69], [100.875, 13.735], [100.915, 13.816],
        [100.895, 13.925], [100.801, 13.956], [100.703, 13.951], [100.622, 13.934],
        [100.533, 13.961], [100.442, 13.914], [100.348, 13.861], [100.327, 13.779],
        [100.327, 13.652],
      ]],
    },
  }],
};

const colorStops = [
  { value: 0, color: [56, 189, 248] },
  { value: 15, color: [56, 189, 248] },
  { value: 25, color: [52, 211, 153] },
  { value: 37.5, color: [250, 204, 21] },
  { value: 75, color: [251, 146, 60] },
  { value: 120, color: [244, 63, 94] },
];

function getPolygons(boundary: BoundaryCollection): PolygonCoordinates[] {
  return boundary.features.flatMap((feature) =>
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates as PolygonCoordinates]
      : feature.geometry.coordinates as PolygonCoordinates[],
  );
}

function getBoundaryBounds(boundary: BoundaryCollection) {
  const coordinates = getPolygons(boundary).flat(2);
  const lngs = coordinates.map(([lng]) => lng);
  const lats = coordinates.map(([, lat]) => lat);
  return {
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}

function interpolateColor(value: number) {
  const upperIndex = colorStops.findIndex((stop) => value <= stop.value);
  if (upperIndex <= 0) return colorStops[0].color;
  if (upperIndex === -1) return colorStops[colorStops.length - 1].color;
  const lower = colorStops[upperIndex - 1];
  const upper = colorStops[upperIndex];
  const ratio = (value - lower.value) / (upper.value - lower.value || 1);
  return lower.color.map((channel, index) => Math.round(channel + (upper.color[index] - channel) * ratio));
}

function interpolateIdw(lng: number, lat: number, stations: ForecastStation[], dayIndex: number) {
  const longitudeScale = Math.cos((lat * Math.PI) / 180);
  let weightedValue = 0;
  let totalWeight = 0;

  for (const station of stations) {
    const dx = (lng - station.lng) * longitudeScale;
    const dy = lat - station.lat;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared < 0.0000002) return station.values[dayIndex];
    const weight = 1 / distanceSquared;
    weightedValue += station.values[dayIndex] * weight;
    totalWeight += weight;
  }

  return weightedValue / totalWeight;
}

function createIdwSurface(boundary: BoundaryCollection, stations: ForecastStation[], dayIndex: number) {
  const bounds = getBoundaryBounds(boundary);
  const width = 460;
  const height = Math.max(320, Math.round(width * (bounds.maxLat - bounds.minLat) / (bounds.maxLng - bounds.minLng)));
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true })!;
  maskContext.fillStyle = "#fff";

  for (const polygon of getPolygons(boundary)) {
    maskContext.beginPath();
    for (const ring of polygon) {
      ring.forEach(([lng, lat], index) => {
        const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * width;
        const y = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * height;
        if (index === 0) maskContext.moveTo(x, y);
        else maskContext.lineTo(x, y);
      });
      maskContext.closePath();
    }
    maskContext.fill("evenodd");
  }

  const mask = maskContext.getImageData(0, 0, width, height).data;
  const surfaceCanvas = document.createElement("canvas");
  surfaceCanvas.width = width;
  surfaceCanvas.height = height;
  const surfaceContext = surfaceCanvas.getContext("2d")!;
  const image = surfaceContext.createImageData(width, height);

  for (let y = 0; y < height; y += 1) {
    const lat = bounds.maxLat - ((y + 0.5) / height) * (bounds.maxLat - bounds.minLat);
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = (y * width + x) * 4;
      if (mask[pixelIndex + 3] === 0) continue;
      const lng = bounds.minLng + ((x + 0.5) / width) * (bounds.maxLng - bounds.minLng);
      const value = interpolateIdw(lng, lat, stations, dayIndex);
      const [red, green, blue] = interpolateColor(value);
      image.data[pixelIndex] = red;
      image.data[pixelIndex + 1] = green;
      image.data[pixelIndex + 2] = blue;
      image.data[pixelIndex + 3] = 168;
    }
  }

  surfaceContext.putImageData(image, 0, 0);
  return {
    url: surfaceCanvas.toDataURL("image/png"),
    bounds: [[bounds.minLat, bounds.minLng], [bounds.maxLat, bounds.maxLng]] as [[number, number], [number, number]],
  };
}

function average(values: number[]) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export default function ForecastDashboard() {
  const [selectedDay, setSelectedDay] = useState(0);
  const [days, setDays] = useState(bundledDays);
  const [stations, setStations] = useState(bundledStations);
  const [issuedAt, setIssuedAt] = useState(bundledIssuedAt);
  const [dataState, setDataState] = useState<"loading" | "live" | "degraded" | "fallback">("loading");
  const [modelName, setModelName] = useState("กำลังเชื่อม AirBKK และ CAMS");
  const [disclaimer, setDisclaimer] = useState("กำลังตรวจสอบความสดใหม่ของข้อมูลจริง");
  const [sourceNames, setSourceNames] = useState<string[]>([]);
  const [showRange, setShowRange] = useState(false);
  const [showSurface, setShowSurface] = useState(true);
  const [showStations, setShowStations] = useState(true);
  const [boundary, setBoundary] = useState<BoundaryCollection | null>(null);
  const [boundaryState, setBoundaryState] = useState<"loading" | "official" | "fallback">("loading");
  const [mapReady, setMapReady] = useState(false);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const stationLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const surfaceLayerRef = useRef<import("leaflet").ImageOverlay | null>(null);
  const boundaryLayerRef = useRef<import("leaflet").GeoJSON | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/forecast")
      .then((response) => {
        if (!response.ok) throw new Error("forecast unavailable");
        return response.json() as Promise<ForecastPayload>;
      })
      .then((payload) => {
        if (!active) return;
        setDays(payload.days);
        setStations(payload.stations);
        setIssuedAt(payload.issuedAt);
        setDataState(payload.status === "live" ? "live" : payload.status === "degraded" ? "degraded" : "fallback");
        setModelName(payload.model ?? "AirBKK + CAMS baseline");
        setDisclaimer(payload.disclaimer ?? "โปรดตรวจสอบสถานะข้อมูลก่อนใช้งาน");
        setSourceNames(payload.sources ?? []);
      })
      .catch(() => {
        if (active) setDataState("fallback");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/bangkok-boundary")
      .then((response) => {
        if (!response.ok) throw new Error("boundary unavailable");
        return response.json() as Promise<BoundaryCollection>;
      })
      .then((payload) => {
        if (!active) return;
        setBoundary(payload);
        setBoundaryState("official");
      })
      .catch(() => {
        if (!active) return;
        setBoundary(fallbackBoundary);
        setBoundaryState("fallback");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!mapElementRef.current || mapInstanceRef.current) return;

    import("leaflet").then((leafletModule) => {
      if (cancelled || !mapElementRef.current || mapInstanceRef.current) return;
      const L = leafletModule.default;
      const map = L.map(mapElementRef.current, {
        zoomControl: true,
        attributionControl: true,
        minZoom: 9,
        maxZoom: 15,
      }).setView([13.765, 100.595], 10);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      map.createPane("surfacePane").style.zIndex = "350";
      map.getPane("surfacePane")!.style.pointerEvents = "none";
      map.createPane("boundaryPane").style.zIndex = "420";
      map.getPane("boundaryPane")!.style.pointerEvents = "none";
      map.createPane("stationPane").style.zIndex = "450";
      stationLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      setMapReady(true);
      window.setTimeout(() => map.invalidateSize(), 80);
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        stationLayerRef.current = null;
        surfaceLayerRef.current = null;
        boundaryLayerRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !stationLayerRef.current) return;

    let cancelled = false;
    import("leaflet").then((leafletModule) => {
      if (cancelled || !stationLayerRef.current) return;
      const L = leafletModule.default;
      stationLayerRef.current.clearLayers();

      if (!showStations) return;
      stations.forEach((station) => {
        const value = station.values[selectedDay];
        const level = getLevel(value);
        L.circleMarker([station.lat, station.lng], {
          pane: "stationPane",
          radius: 6,
          color: "#fff",
          weight: 2,
          fillColor: level.color,
          fillOpacity: 1,
        })
          .bindTooltip(`${station.district} · ${value} µg/m³`, {
            direction: "top",
            className: "forecast-tooltip",
          })
          .bindPopup(
            `<div class="map-popup"><strong>${station.district}</strong><span>${station.label}</span><b>${value} µg/m³</b><small>${level.label} · ค่าล่วงหน้า D+${selectedDay + 1}</small>${station.observed === undefined ? "" : `<em>AirBKK ล่าสุด ${station.observed} µg/m³<br>${station.observedAt ?? ""}</em>`}</div>`,
          )
          .addTo(stationLayerRef.current!);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [mapReady, selectedDay, showStations, stations]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !boundary) return;
    let cancelled = false;

    import("leaflet").then((leafletModule) => {
      if (cancelled || !mapInstanceRef.current) return;
      const L = leafletModule.default;
      const map = mapInstanceRef.current;

      if (surfaceLayerRef.current) map.removeLayer(surfaceLayerRef.current);
      if (boundaryLayerRef.current) map.removeLayer(boundaryLayerRef.current);

      if (showSurface) {
        const surface = createIdwSurface(boundary, stations, selectedDay);
        surfaceLayerRef.current = L.imageOverlay(surface.url, surface.bounds, {
          pane: "surfacePane",
          opacity: 0.78,
          interactive: false,
        }).addTo(map);
      } else {
        surfaceLayerRef.current = null;
      }

      boundaryLayerRef.current = L.geoJSON(boundary as GeoJSON.GeoJsonObject, {
        pane: "boundaryPane",
        style: {
          color: "#173c2b",
          weight: 1.05,
          opacity: 0.72,
          fillOpacity: 0,
        },
      }).addTo(map);

      if (boundaryState === "official") {
        map.fitBounds(boundaryLayerRef.current.getBounds(), { padding: [14, 14], animate: false });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [boundary, boundaryState, mapReady, selectedDay, showSurface, stations]);

  const day = days[selectedDay];
  const values = useMemo(
    () => stations.map((station) => station.values[selectedDay]),
    [selectedDay, stations],
  );
  const mean = average(values);
  const meanLevel = getLevel(mean);
  const sortedStations = useMemo(
    () => [...stations].sort((a, b) => b.values[selectedDay] - a.values[selectedDay]).slice(0, 5),
    [selectedDay, stations],
  );
  const dailyMeans = useMemo(
    () => days.map((_, index) => average(stations.map((station) => station.values[index]))),
    [days, stations],
  );
  const peakDayIndex = dailyMeans.indexOf(Math.max(...dailyMeans));

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="BKK Air Outlook หน้าแรก">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><b>BKK AIR</b><small>OUTLOOK</small></span>
        </a>
        <div className="issued">
          <span className={`status-dot ${dataState}`} aria-hidden="true" />
          <span>ออกรอบล่าสุด <b>{issuedAt}</b></span>
        </div>
        <button className="method-link" onClick={() => document.getElementById("method")?.scrollIntoView({ behavior: "smooth" })}>
          วิธีอ่านผลพยากรณ์
        </button>
      </header>

      <section className={`notice ${dataState}`} role="status">
        <b>{dataState === "live" ? "ข้อมูลจริง · LIVE BASELINE" : dataState === "degraded" ? "ข้อมูลจริง · DEGRADED" : dataState === "fallback" ? "ข้อมูลสำรอง · FALLBACK" : "กำลังโหลดข้อมูลจริง"}</b>
        <span>{disclaimer}</span>
      </section>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">พยากรณ์ PM2.5 กรุงเทพฯ ล่วงหน้า 1–5 วัน</p>
          <h1>เห็นวันที่เสี่ยง<br /><em>ก่อนฝุ่นจะมา</em></h1>
        </div>
        <div className="hero-summary">
          <p>ค่ากลางสูงสุดในช่วง 5 วัน</p>
          <strong>D+{peakDayIndex + 1} · {dailyMeans[peakDayIndex]} µg/m³</strong>
          <span>คำนวณจาก AirBKK {stations.length} สถานี และ CAMS Global; กดแต่ละวันเพื่อดูพื้นที่เสี่ยง</span>
        </div>
      </section>

      <nav className="day-tabs" aria-label="เลือกวันพยากรณ์">
        {days.map((forecastDay, index) => {
          const dailyValues = stations.map((station) => station.values[index]);
          const dailyMean = average(dailyValues);
          return (
            <button
              key={forecastDay.lead}
              className={selectedDay === index ? "active" : ""}
              onClick={() => setSelectedDay(index)}
              aria-pressed={selectedDay === index}
            >
              <span>D+{forecastDay.lead}</span>
              <b>{forecastDay.weekday} {forecastDay.date}</b>
              <i style={{ backgroundColor: getLevel(dailyMean).color }} />
              <small>{dailyMean} µg/m³ {forecastDay.sourceMode === "extrapolated" && <em>แนวโน้ม</em>}</small>
            </button>
          );
        })}
      </nav>

      <section className="workspace">
        <div className="map-card">
          <div className="map-heading">
            <div>
              <p>พื้นผิว IDW interpolation · D+{day.lead}</p>
              <h2>{day.weekday}ที่ {day.date} {day.year ?? 2569}</h2>
            </div>
            <div className="map-controls" aria-label="ตัวเลือกชั้นข้อมูลแผนที่">
              <label className="layer-toggle">
                <input type="checkbox" checked={showSurface} onChange={(event) => setShowSurface(event.target.checked)} />
                <span />พื้นผิว IDW
              </label>
              <label className="layer-toggle">
                <input type="checkbox" checked={showStations} onChange={(event) => setShowStations(event.target.checked)} />
                <span />จุดสถานี
              </label>
              <label className="range-toggle">
                <input type="checkbox" checked={showRange} onChange={(event) => setShowRange(event.target.checked)} />
                <span />ช่วงความไม่แน่นอน
              </label>
            </div>
          </div>

          <div className="map-wrap">
            <div ref={mapElementRef} className="map" role="application" aria-label={`แผนที่ PM2.5 พยากรณ์ล่วงหน้า ${day.lead} วัน`} />
            <div className="map-metric">
              <span>ค่าเฉลี่ย กทม.</span>
              <strong>{mean}<small>µg/m³</small></strong>
              <b style={{ color: meanLevel.color }}>{meanLevel.label}</b>
              {showRange && <em>ช่วงคาดการณ์ {Math.max(0, mean - day.uncertainty)}–{mean + day.uncertainty}</em>}
            </div>
            <div className={`surface-status ${boundaryState}`}>
              <b>{dataState === "live" ? "LIVE · AirBKK + CAMS" : dataState === "degraded" ? "DEGRADED BASELINE" : dataState === "fallback" ? "FALLBACK DATA" : "LOADING"}</b>
              <span>IDW power 2 · {day.sourceMode === "extrapolated" ? "ช่วงแนวโน้ม" : `CAMS ${day.coverageHours ?? "—"} ชม.`}</span>
              <em>{boundaryState === "official" ? "ขอบเขต 50 เขตจาก BMA GIS" : boundaryState === "fallback" ? "กำลังใช้ขอบเขตสำรอง" : "กำลังโหลดขอบเขต กทม."}</em>
            </div>
            <div className="legend" aria-label="คำอธิบายระดับ PM2.5">
              <span><i style={{ background: "#38bdf8" }} />0–15</span>
              <span><i style={{ background: "#34d399" }} />16–25</span>
              <span><i style={{ background: "#facc15" }} />26–37.5</span>
              <span><i style={{ background: "#fb923c" }} />38–75</span>
              <span><i style={{ background: "#f43f5e" }} />&gt;75</span>
              <small>PM2.5 · µg/m³</small>
            </div>
          </div>
        </div>

        <aside className="insights">
          <div className="confidence-card">
            <div className="confidence-ring" style={{ "--progress": `${day.confidence * 3.6}deg` } as React.CSSProperties}>
              <span>{day.confidence}<small>%</small></span>
            </div>
            <div><p>ความเชื่อมั่นของโมเดล</p><strong>{day.confidence >= 80 ? "สูง" : day.confidence >= 65 ? "ปานกลาง" : "ควรติดตามใกล้ชิด"}</strong></div>
          </div>

          <div className="weather-card">
            <p>ปัจจัยสภาพอากาศ</p>
            <div><span aria-hidden="true">↗</span><b>{day.wind}</b></div>
            <div><span aria-hidden="true">◌</span><b>{day.weather}</b></div>
          </div>

          <div className="watch-card">
            <p>พื้นที่เฝ้าระวัง</p>
            <ol>
              {sortedStations.map((station) => {
                const value = station.values[selectedDay];
                return <li key={station.id}><span>{station.district}</span><b>{value}</b><i style={{ background: getLevel(value).color }} /></li>;
              })}
            </ol>
            <small>หน่วย µg/m³ · เรียงจากค่าคาดการณ์สูงสุด</small>
          </div>

          <div className="forecast-note">
            <span aria-hidden="true">!</span>
            <p><b>สิ่งที่ควรรู้</b>{day.note}</p>
          </div>
        </aside>
      </section>

      <section className="method" id="method">
        <div>
          <p className="eyebrow">จากข้อมูลสู่การตัดสินใจ</p>
          <h2>ข้อมูลจริงไหลอย่างไร<br />ก่อนขึ้นแผนที่</h2>
        </div>
        <div className="method-flow">
          <article><span>01</span><h3>รับ AirBKK จริง</h3><p>กรองสถานีที่ PM2.5 หาย พิกัดผิด หรือเวลาล้ากว่ารอบล่าสุดเกิน 6 ชั่วโมง</p></article>
          <article><span>02</span><h3>รับ CAMS + Weather</h3><p>ใช้ CAMS Global รายชั่วโมงและพยากรณ์ลม/ฝนจาก Open-Meteo สำหรับ 1–5 วัน</p></article>
          <article><span>03</span><h3>ปรับ bias รายสถานี</h3><p>นำส่วนต่าง AirBKK–CAMS ล่าสุดมาปรับค่าล่วงหน้า โดยลดน้ำหนักเมื่อ lead time เพิ่มขึ้น</p></article>
          <article><span>04</span><h3>สร้างพื้นผิว IDW</h3><p>ประมาณค่าระหว่างจุดสถานี แล้วตัด raster ให้แสดงเฉพาะภายในขอบเขต 50 เขตของกรุงเทพฯ</p></article>
        </div>
        <div className="source-row">
          <span>แหล่งข้อมูลที่ใช้งานจริง</span>
          {(sourceNames.length ? sourceNames : ["AirBKK", "CAMS / Open-Meteo", "BMA GIS"]).map((source) => <b key={source}>{source}</b>)}
        </div>
      </section>

      <footer>
        <span>BKK Air Outlook · Live baseline 0.2</span>
        <p>{modelName} · ยังต้องผ่าน backtest ก่อนใช้เป็นคำเตือนสาธารณะ</p>
      </footer>
    </main>
  );
}
