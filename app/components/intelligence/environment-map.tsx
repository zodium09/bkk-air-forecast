"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { GeoJsonObject } from "geojson";
import { getRegion, type RegionId } from "../../lib/provinces";
import { getBasemapConfig } from "../../lib/basemap";
import { boundaryLabels } from "../../lib/map-labels";
import {
  createMapSurface,
  surfaceDisplayUrl,
  type MapBoundary,
} from "../../lib/map-surface";
import { installWeatherMotion } from "./weather-motion";
import {
  closestPoint,
  formatValue,
  interpretation,
  legendIndex,
  pointValue,
  valueColor,
  type DataMode,
  type EnvironmentLayer,
  type MapPoint,
  type Metric,
} from "../../lib/map-intelligence";
import { MapIcon } from "./map-ui";
import "leaflet/dist/leaflet.css";

type Props = {
  layer: EnvironmentLayer;
  mode: DataMode;
  points: MapPoint[];
  index: number;
  metric: Metric;
  province: RegionId;
  selected: { lat: number; lng: number } | null;
  onSelect: (point: { lat: number; lng: number; label?: string }) => void;
  legend: number | null;
  degraded: boolean;
  satellite: boolean;
  showValues: boolean;
  focus: number;
  weatherAnimation?: boolean;
  onToggleWeather?: () => void;
  surfaceOpacity?: number;
  onBoundary?: (value: { region: RegionId; data: MapBoundary } | null) => void;
  motionDisabled?: boolean;
  showPlaceNames?: boolean;
  exploring?: boolean;
  onToggleExplore?: () => void;
};
type Boundary = MapBoundary;
export default function EnvironmentMap(props: Props) {
  const { onBoundary } = props;
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const lib = useRef<typeof Leaflet | null>(null);
  const latest = useRef(props);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [zoomRevision, setZoomRevision] = useState(0);
  const [mapError, setMapError] = useState("");
  const [boundary, setBoundary] = useState<{
    region: RegionId;
    data: Boundary;
    official: boolean;
  } | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  useEffect(() => {
    latest.current = props;
  }, [props]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(media.matches);
    const timer = window.setTimeout(syncMotion, 0);
    media.addEventListener("change", syncMotion);
    return () => {
      window.clearTimeout(timer);
      media.removeEventListener("change", syncMotion);
    };
  }, []);
  useEffect(() => {
    const sync = () =>
      setTheme(
        document.documentElement.dataset.theme === "light" ? "light" : "dark",
      );
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const timer = window.setTimeout(sync, 0);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    let active = true;
    let observer: ResizeObserver | undefined;
    import("leaflet")
      .then((L) => {
        if (!active || !container.current) return;
        lib.current = L;
        const instance = L.map(container.current, {
          zoomControl: false,
          attributionControl: true,
          preferCanvas: true,
          zoomSnap: 0.25,
          zoomDelta: 0.5,
          zoomAnimation: !matchMedia("(prefers-reduced-motion: reduce)")
            .matches,
        }).setView([13.8, 100.48], 10);
        map.current = instance;
        instance.on("moveend", () => setZoomRevision((n) => n + 1));
        L.control
          .scale({ imperial: false, position: "bottomleft" })
          .addTo(instance);
        instance.on("click", (event: Leaflet.LeafletMouseEvent) => {
          const p = latest.current;
          const nearest = closestPoint(
            p.points,
            event.latlng.lat,
            event.latlng.lng,
          );
          p.onSelect({
            lat: event.latlng.lat,
            lng: event.latlng.lng,
            label: nearest ? undefined : "ตำแหน่งนอกจุดข้อมูล",
          });
        });
        observer = new ResizeObserver(() => instance.invalidateSize());
        observer.observe(container.current);
        setReady(true);
      })
      .catch(() => setMapError("เปิดแผนที่ไม่สำเร็จ กรุณาโหลดหน้าใหม่"));
    return () => {
      active = false;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current || !lib.current) return;
    const config = getBasemapConfig(
      props.satellite ? "satellite" : "street",
      theme,
    );
    const tile = lib.current.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
    });
    let errors = 0;
    tile.on("tileerror", () => {
      errors++;
      if (errors >= 4)
        setMapError("แผนที่พื้นหลังโหลดไม่ครบ ยังเลือกจุดข้อมูลได้");
    });
    tile.on("tileload", () => {
      errors = 0;
      setMapError("");
    });
    tile.addTo(map.current);
    return () => {
      tile.remove();
    };
  }, [ready, props.satellite, theme]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(
      props.province === "bangkok"
        ? "/api/bangkok-boundary"
        : `/api/province-boundary?province=${props.province}`,
      {
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("boundary");
        const data = await response.json();
        if (data.type !== "FeatureCollection") throw new Error("boundary");
        setBoundary({
          region: props.province,
          data,
          official:
            !data.features.some(
              (f: { properties?: Record<string, unknown> }) =>
                f.properties?.fallback || f.properties?.approximate,
            ) && response.headers.get("x-boundary-source") !== "fallback",
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setBoundary(null);
      });
    return () => controller.abort();
  }, [props.province]);
  useEffect(() => {
    onBoundary?.(
      boundary?.official && boundary.region === props.province
        ? boundary
        : null,
    );
  }, [boundary, props.province, onBoundary]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const b = getRegion(props.province).bounds;
    map.current.fitBounds(
      [
        [b.minLat, b.minLng],
        [b.maxLat, b.maxLng],
      ],
      { padding: [30, 30], animate: false },
    );
  }, [ready, props.province]);
  useEffect(() => {
    if (
      !ready ||
      !map.current ||
      !lib.current ||
      boundary?.region !== props.province
    )
      return;
    const line = lib.current
      .geoJSON(boundary.data as GeoJsonObject, {
        interactive: false,
        style: {
          color: theme === "dark" ? "#8cb5ba" : "#587d81",
          weight: 1.2,
          fillOpacity: 0,
          dashArray: boundary.official ? "4 5" : "2 8",
        },
      })
      .addTo(map.current);
    return () => {
      line.remove();
    };
  }, [ready, boundary, props.province, theme]);
  useEffect(() => {
    const instance = map.current,
      L = lib.current;
    if (
      !ready ||
      !instance ||
      !L ||
      props.showPlaceNames === false ||
      boundary?.region !== props.province ||
      !boundary.official
    )
      return;
    const pane =
      instance.getPane("mi-geographic-labels") ??
      instance.createPane("mi-geographic-labels");
    pane.style.zIndex = "620";
    pane.style.pointerEvents = "none";
    const labels = L.layerGroup().addTo(instance),
      zoom = instance.getZoom(),
      size = instance.getSize();
    const occupied: { x: number; y: number; width: number }[] = [];
    const candidates = boundaryLabels(boundary.data).filter(
      (label) => label.kind === "province" || zoom >= 11,
    );
    if (
      zoom < 11 &&
      (props.province === "metro" || props.province === "bangkok") &&
      !candidates.some((label) => label.name === "กรุงเทพมหานคร")
    )
      candidates.unshift({
        name: "กรุงเทพมหานคร",
        lat: 13.7797,
        lng: 100.5543,
        kind: "province",
        area: 1,
      });
    candidates.sort((a, b) =>
      a.kind !== b.kind ? (a.kind === "province" ? -1 : 1) : b.area - a.area,
    );
    for (const label of candidates) {
      const p = instance.latLngToContainerPoint([label.lat, label.lng]),
        width = Math.max(70, label.name.length * 8);
      if (
        p.x < 20 ||
        p.y < 20 ||
        p.x > size.x - 20 ||
        p.y > size.y - 20 ||
        occupied.some(
          (o) =>
            Math.abs(p.x - o.x) < (width + o.width) / 2 + 8 &&
            Math.abs(p.y - o.y) < 30,
        )
      )
        continue;
      occupied.push({ x: p.x, y: p.y, width });
      const content = document.createElement("span");
      content.textContent = label.name;
      content.className = `mi-geographic-label mi-geographic-${label.kind}`;
      const marker = L.marker([label.lat, label.lng], {
        pane: "mi-geographic-labels",
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          html: content,
          className: "mi-geographic-root",
          iconSize: [width, 22],
          iconAnchor: [width / 2, 11],
        }),
      }).addTo(labels);
      marker.getElement()?.setAttribute("aria-hidden", "true");
    }
    return () => {
      labels.remove();
    };
  }, [ready, boundary, props.province, props.showPlaceNames, zoomRevision]);
  useEffect(() => {
    if (
      !ready ||
      !map.current ||
      !lib.current ||
      props.mode !== "estimate" ||
      boundary?.region !== props.province ||
      !boundary.official
    )
      return;
    const surface = createMapSurface(
      boundary.data,
      props.points,
      props.index,
      props.layer,
      props.metric,
    );
    if (!surface) return;
    const overlay = lib.current
      .imageOverlay(
        surfaceDisplayUrl(surface, props.layer, props.metric, props.legend),
        surface.bounds,
        {
          interactive: false,
          opacity: props.surfaceOpacity ?? 0.72,
        },
      )
      .addTo(map.current);
    return () => {
      overlay.remove();
    };
  }, [
    ready,
    boundary,
    props.province,
    props.mode,
    props.layer,
    props.points,
    props.index,
    props.metric,
    props.surfaceOpacity,
    props.legend,
  ]);
  useEffect(() => {
    const instance = map.current,
      L = lib.current;
    if (!ready || !instance || !L) return;
    const markers = L.layerGroup().addTo(instance);
    const nearestSelected = props.selected
      ? closestPoint(props.points, props.selected.lat, props.selected.lng)
      : null;
    const selectedPoint =
      props.mode === "estimate" &&
      nearestSelected &&
      props.selected &&
      Math.hypot(
        nearestSelected.lat - props.selected.lat,
        nearestSelected.lng - props.selected.lng,
      ) > 0.0001
        ? null
        : nearestSelected;
    const occupied: Leaflet.Point[] = [];
    const prioritized = [...props.points].sort((a, b) =>
      a.id === selectedPoint?.id
        ? -1
        : b.id === selectedPoint?.id
          ? 1
          : (pointValue(b, props.index, props.metric) ?? -1) -
            (pointValue(a, props.index, props.metric) ?? -1),
    );
    prioritized.forEach((point) => {
      const value = pointValue(point, props.index, props.metric);
      const color = valueColor(props.layer, props.metric, value);
      const selected = point.id === selectedPoint?.id;
      const screen = instance.latLngToContainerPoint([point.lat, point.lng]);
      const labelFits = !occupied.some(
        (p) => Math.abs(p.x - screen.x) < 45 && Math.abs(p.y - screen.y) < 35,
      );
      const labeled = selected || (props.showValues && labelFits);
      if (labeled) occupied.push(screen);
      const muted =
        props.legend !== null &&
        (value === null ||
          legendIndex(props.layer, props.metric, value) !== props.legend);
      const element = document.createElement("div");
      element.className = `mi-marker mi-marker-${props.layer} ${labeled ? "" : "compact"} ${selected ? "selected" : ""} ${props.degraded ? "degraded" : ""} ${muted ? "muted" : ""}`;
      element.style.setProperty("--marker-color", color);
      element.textContent = labeled ? formatValue(value) : "";
      const title = `${point.label}: ${formatValue(value)} · ${interpretation(props.layer, props.metric, value)}`;
      const marker = L.marker([point.lat, point.lng], {
        icon: L.divIcon({
          html: element,
          className: "mi-marker-root",
          iconSize: [40, 34],
          iconAnchor: [20, 17],
        }),
        keyboard: true,
        title,
        alt: title,
        zIndexOffset: selected ? 500 : 0,
      }).addTo(markers);
      const tooltip = document.createElement("span");
      tooltip.textContent = title;
      marker.bindTooltip(tooltip, { direction: "top" });
      marker.on("click", () =>
        latest.current.onSelect({
          lat: point.lat,
          lng: point.lng,
          label: point.label,
        }),
      );
      marker.getElement()?.setAttribute("aria-label", title);
    });
    if (props.selected)
      L.circleMarker([props.selected.lat, props.selected.lng], {
        radius: 22,
        color: theme === "dark" ? "#ecfbff" : "#143a40",
        weight: 2,
        fillOpacity: 0,
        interactive: false,
      }).addTo(markers);
    return () => {
      markers.remove();
    };
  }, [
    ready,
    zoomRevision,
    props.points,
    props.index,
    props.metric,
    props.layer,
    props.selected,
    props.legend,
    props.degraded,
    props.showValues,
    props.mode,
    theme,
  ]);
  useEffect(() => {
    if (
      !ready ||
      !map.current ||
      !props.weatherAnimation ||
      props.mode === "observation" ||
      boundary?.region !== props.province ||
      !boundary.official ||
      reducedMotion ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const surface = createMapSurface(
      boundary.data,
      props.points,
      props.index,
      props.layer,
      props.layer === "rain" ? "secondary" : "primary",
    );
    if (!surface) return;
    return installWeatherMotion(
      map.current,
      surface,
      props.layer,
      theme === "dark",
    );
  }, [
    ready,
    boundary,
    props.province,
    props.points,
    props.index,
    props.layer,
    props.mode,
    props.weatherAnimation,
    reducedMotion,
    theme,
  ]);
  useEffect(() => {
    const selection = latest.current.selected;
    if (ready && selection && map.current)
      map.current.panTo([selection.lat, selection.lng], { animate: false });
  }, [ready, props.focus]);
  function locate() {
    if (!navigator.geolocation) {
      setLocationMessage("อุปกรณ์นี้ไม่รองรับตำแหน่ง");
      return;
    }
    setLocationMessage("กำลังค้นหาตำแหน่ง…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        const nearest = closestPoint(props.points, lat, lng);
        setLocationMessage(
          nearest ? "" : "ตำแหน่งนี้อยู่นอกจุดข้อมูลที่รองรับ",
        );
        props.onSelect({ lat, lng, label: "ตำแหน่งของฉัน" });
        if (nearest) map.current?.panTo([lat, lng], { animate: false });
      },
      () => setLocationMessage("ไม่สามารถเข้าถึงตำแหน่ง เลือกบนแผนที่แทนได้"),
      { timeout: 10_000 },
    );
  }
  return (
    <>
      <div
        className={`mi-map-canvas ${props.satellite ? "mi-satellite-map" : "mi-street-map"}`}
        ref={container}
        aria-label="แผนที่สิ่งแวดล้อมกรุงเทพฯ ใช้ปุ่มลูกศรเลื่อน และบวกหรือลบเพื่อซูม"
      />
      <div className="mi-map-tools" aria-label="เครื่องมือแผนที่">
        <button
          title="ซูมเข้า"
          aria-label="ซูมเข้า"
          onClick={() => map.current?.zoomIn()}
        >
          +
        </button>
        <button
          title="ซูมออก"
          aria-label="ซูมออก"
          onClick={() => map.current?.zoomOut()}
        >
          −
        </button>
        <button
          title="แสดงพื้นที่ทั้งหมด"
          aria-label="แสดงพื้นที่ทั้งหมด"
          onClick={() => {
            const b = getRegion(props.province).bounds;
            map.current?.fitBounds(
              [
                [b.minLat, b.minLng],
                [b.maxLat, b.maxLng],
              ],
              { animate: false },
            );
          }}
        >
          <MapIcon name="map" />
        </button>
        <button
          title="ตำแหน่งของฉัน"
          aria-label="ตำแหน่งของฉัน"
          onClick={locate}
        >
          <MapIcon name="location" />
        </button>
        {props.onToggleWeather && (
          <button
            disabled={props.motionDisabled || props.mode === "observation"}
            aria-label={
              props.weatherAnimation
                ? "ปิดอนิเมชันสภาพอากาศ"
                : "เปิดอนิเมชันสภาพอากาศ"
            }
            title={
              props.motionDisabled
                ? "ลดการเคลื่อนไหวตามการตั้งค่าอุปกรณ์"
                : "อนิเมชันประกอบพยากรณ์ ไม่ใช่เรดาร์"
            }
            aria-pressed={props.weatherAnimation ?? false}
            onClick={props.onToggleWeather}
          >
            <MapIcon
              name={props.weatherAnimation ? "pause" : props.layer}
              size={18}
            />
          </button>
        )}
        {props.onToggleExplore && (
          <button
            aria-label={
              props.exploring ? "ออกจากโหมดสำรวจเต็มจอ" : "สำรวจแผนที่เต็มจอ"
            }
            aria-pressed={props.exploring ?? false}
            title={
              props.exploring ? "กลับสู่หน้าข้อมูล · Esc" : "สำรวจแผนที่เต็มจอ"
            }
            onClick={props.onToggleExplore}
          >
            <MapIcon name={props.exploring ? "contract" : "expand"} size={19} />
          </button>
        )}
      </div>
      {(mapError || locationMessage) && (
        <div className="mi-map-notice" role="status">
          {locationMessage || mapError}
          <button
            aria-label="ปิดข้อความ"
            onClick={() => {
              setLocationMessage("");
              setMapError("");
            }}
          >
            ×
          </button>
        </div>
      )}
      {props.mode === "estimate" &&
        (boundary?.region !== props.province || !boundary?.official) && (
          <div className="mi-surface-notice">
            ไม่มีขอบเขตที่ยืนยันได้ แสดงเฉพาะจุดข้อมูล
          </div>
        )}
    </>
  );
}
