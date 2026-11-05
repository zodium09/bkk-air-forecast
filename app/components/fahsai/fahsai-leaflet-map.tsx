"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AreaForecast, RegionId, TopicId } from "../../lib/fahsai-data";
import {
  classifyAreaRisk,
  classifyDailyPointRisk,
  classifyHourlyPointRisk,
  getTopicRiskBands,
  getTopicScopeConfig,
  pinMetricLabel,
  THAILAND_LABEL_OFFSETS,
  TOPICS,
} from "./fahsai-helpers.ts";

let cachedProvincesGeoJson: GeoJSON.FeatureCollection | null = null;
let cachedBmaDistrictsGeoJson: GeoJSON.FeatureCollection | null = null;

async function loadProvincesGeoJson(): Promise<GeoJSON.FeatureCollection> {
  if (cachedProvincesGeoJson) return cachedProvincesGeoJson;
  const mod = await import("../../data/thailand-provinces-geojson.json");
  cachedProvincesGeoJson = (mod.default ?? mod) as unknown as GeoJSON.FeatureCollection;
  return cachedProvincesGeoJson;
}

async function loadBmaDistrictsGeoJson(): Promise<GeoJSON.FeatureCollection> {
  if (cachedBmaDistrictsGeoJson) return cachedBmaDistrictsGeoJson;
  const mod = await import("../../data/bangkok-districts.json");
  cachedBmaDistrictsGeoJson = (mod.default ?? mod) as unknown as GeoJSON.FeatureCollection;
  return cachedBmaDistrictsGeoJson;
}

export type RealBasemapMode = "street" | "satellite" | "dark";
export type PinDisplayMode = "smart" | "all77" | "polygons-only";

interface FahSaiLeafletMapProps {
  areas: AreaForecast[];
  allAreas: AreaForecast[];
  selectedArea: AreaForecast;
  onSelectArea: (id: string) => void;
  activeTopic: TopicId;
  activeRegion: RegionId;
  basemapMode: RealBasemapMode;
  onChangeBasemapMode: (mode: RealBasemapMode) => void;
  showAllProvincesScope: boolean;
  onToggleAllProvincesScope: () => void;
  isExpandedWide?: boolean;
  onToggleExpandedWide?: () => void;
  dayIdx?: number;
  onChangeDayIdx?: (dayIdx: number) => void;
  hourIdx?: number;
  onChangeHourIdx?: (hourIdx: number) => void;
  isLiveNow?: boolean;
  onResetLiveNow?: () => void;
  isPlayingTime?: boolean;
  onTogglePlayTime?: () => void;
}

interface ProvinceFeatureProps {
  PROV_CODE?: string;
  PROV_NAM_T?: string;
  PROV_NAM_E?: string;
  primaryAreaId?: string | null;
  mappedAreaId?: string;
}

interface DistrictFeatureProps {
  OBJECTID?: number;
  NAME_T?: string;
  NAME_E?: string;
}

const TILE_CONFIGS: Record<
  RealBasemapMode,
  {
    url: string;
    noLabelUrl?: string;
    labelUrl?: string;
    attribution: string;
    name: string;
  }
> = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    noLabelUrl: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; CARTO · ขอบเขตการปกครองจริง 77 จังหวัด กรมทรัพยากรธรณี (DMR) & กทม. (BMA)',
    name: "แผนที่ถนน & เขตปกครองจริง (OSM)",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    labelUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "&copy; Esri, Maxar, Earthstar Geographics · ขอบเขตการปกครองจริง 77 จังหวัด DMR & BMA",
    name: "ดาวเทียมจริง Esri World Imagery",
  },
  dark: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    labelUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "&copy; Esri, HERE, Garmin, OpenStreetMap · ขอบเขตการปกครองจริง 77 จังหวัด DMR & BMA",
    name: "แผนที่มืดเน้นข้อมูล (Dark GIS)",
  },
};

export function FahSaiLeafletMap({
  areas,
  allAreas,
  selectedArea,
  onSelectArea,
  activeTopic,
  activeRegion,
  basemapMode,
  onChangeBasemapMode,
  showAllProvincesScope,
  onToggleAllProvincesScope,
  isExpandedWide = false,
  onToggleExpandedWide,
  dayIdx = 0,
  onChangeDayIdx,
  hourIdx = 14,
  onChangeHourIdx,
  isLiveNow = true,
  onResetLiveNow,
  isPlayingTime = false,
  onTogglePlayTime,
}: FahSaiLeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const mapInstanceRef = useRef<Leaflet.Map | null>(null);
  const baseTileLayerRef = useRef<Leaflet.TileLayer | null>(null);
  const labelTileLayerRef = useRef<Leaflet.TileLayer | null>(null);
  const provinceLayerRef = useRef<Leaflet.GeoJSON | null>(null);
  const bmaDistrictLayerRef = useRef<Leaflet.GeoJSON | null>(null);
  const markersLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const markerInstancesRef = useRef<Map<string, Leaflet.Marker>>(new Map());
  const onSelectAreaRef = useRef(onSelectArea);
  const areasRef = useRef(areas);

  useEffect(() => {
    onSelectAreaRef.current = onSelectArea;
    areasRef.current = areas;
  }, [onSelectArea, areas]);

  const [showAdminBoundaries, setShowAdminBoundaries] = useState(true);
  const [showBmaDistricts, setShowBmaDistricts] = useState(false);
  const [pinDisplayMode, setPinDisplayMode] = useState<PinDisplayMode>("polygons-only");
  const [showBasemapLabels, setShowBasemapLabels] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number>(6);
  const [mapReady, setMapReady] = useState(false);
  const [provincesGeoData, setProvincesGeoData] = useState<GeoJSON.FeatureCollection | null>(
    cachedProvincesGeoJson
  );
  const [bmaGeoData, setBmaGeoData] = useState<GeoJSON.FeatureCollection | null>(
    cachedBmaDistrictsGeoJson
  );
  const [showMobileLayers, setShowMobileLayers] = useState(false);
  const [showAllProvinceChipsMobile, setShowAllProvinceChipsMobile] = useState(false);

  const topicMeta = useMemo(
    () => TOPICS.find((t) => t.id === activeTopic) ?? TOPICS[0],
    [activeTopic]
  );
  const scopeConfig = useMemo(() => getTopicScopeConfig(activeTopic), [activeTopic]);
  const riskBands = useMemo(() => getTopicRiskBands(activeTopic), [activeTopic]);

  const areaById = useMemo(() => {
    const map = new Map<string, AreaForecast>();
    for (const a of allAreas) map.set(a.id, a);
    return map;
  }, [allAreas]);

  const relevantAreaIds = useMemo(() => new Set(areas.map((a) => a.id)), [areas]);

  // Initialize Leaflet map once on client with Canvas renderer for fast polygon drawing
  useEffect(() => {
    let cancelled = false;
    const markersMap = markerInstancesRef.current;
    if (!mapContainerRef.current) return;

    void Promise.all([import("leaflet"), loadProvincesGeoJson()]).then(([L, geoJson]) => {
      if (cancelled || !mapContainerRef.current || mapInstanceRef.current) return;
      leafletRef.current = L;
      setProvincesGeoData(geoJson);

      const map = L.map(mapContainerRef.current, {
        center: [13.2, 101.0],
        zoom: 6,
        minZoom: 5,
        maxZoom: 14,
        zoomControl: false,
        attributionControl: true,
        preferCanvas: true,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);
      map.on("zoomend", () => {
        setCurrentZoom(map.getZoom());
      });
      mapInstanceRef.current = map;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      markersMap.clear();
      provinceLayerRef.current = null;
      bmaDistrictLayerRef.current = null;
      markersLayerRef.current = null;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Lazy-load BMA 50 districts GeoJSON only when needed
  const shouldShowBmaLayer = showBmaDistricts || selectedArea.id === "bangkok";
  useEffect(() => {
    if (!shouldShowBmaLayer || bmaGeoData) return;
    let cancelled = false;
    void loadBmaDistrictsGeoJson().then((data) => {
      if (!cancelled) setBmaGeoData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [shouldShowBmaLayer, bmaGeoData]);

  // Invalidate map size when expanded/collapsed so tiles fill the larger container cleanly
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [isExpandedWide, mapReady]);

  // Update real tile basemap (OSM Street / Esri Satellite / Esri Dark Gray)
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map || !mapReady) return;

    if (baseTileLayerRef.current) {
      baseTileLayerRef.current.remove();
      baseTileLayerRef.current = null;
    }
    if (labelTileLayerRef.current) {
      labelTileLayerRef.current.remove();
      labelTileLayerRef.current = null;
    }

    const cfg = TILE_CONFIGS[basemapMode];
    const tileUrl = !showBasemapLabels && cfg.noLabelUrl ? cfg.noLabelUrl : cfg.url;
    const baseLayer = L.tileLayer(tileUrl, {
      attribution: cfg.attribution,
      maxZoom: 18,
    });
    baseLayer.addTo(map);
    baseLayer.bringToBack();
    baseTileLayerRef.current = baseLayer;

    if (showBasemapLabels && cfg.labelUrl) {
      const labelLayer = L.tileLayer(cfg.labelUrl, {
        maxZoom: 18,
        opacity: 0.85,
      });
      labelLayer.addTo(map);
      labelTileLayerRef.current = labelLayer;
    }
  }, [basemapMode, mapReady, showBasemapLabels]);

  // Lifecycle Effect: Create/Remove 77-province GeoJSON layer once (no destroy/recreate on state ticks)
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map || !mapReady) return;

    if (!showAdminBoundaries || !provincesGeoData) {
      if (provinceLayerRef.current) {
        provinceLayerRef.current.remove();
        provinceLayerRef.current = null;
      }
      return;
    }

    if (!provinceLayerRef.current) {
      const layer = L.geoJSON(provincesGeoData, {
        onEachFeature: (feature, featureLayer) => {
          const geoMeta = (feature?.properties ?? {}) as ProvinceFeatureProps;
          const targetAreaId = geoMeta.primaryAreaId || geoMeta.mappedAreaId || "bangkok";
          featureLayer.bindTooltip("", {
            sticky: true,
            direction: "top",
            className: "fahsai-leaflet-tooltip",
          });
          featureLayer.on("click", () => {
            onSelectAreaRef.current(targetAreaId);
          });
        },
      });
      layer.addTo(map);
      provinceLayerRef.current = layer;
    }
  }, [mapReady, showAdminBoundaries, provincesGeoData]);

  // Fast In-Place Update Effect: Update 77-province styles & tooltips without recreating GeoJSON DOM/Canvas
  useEffect(() => {
    const layer = provinceLayerRef.current;
    if (!layer || !mapReady || !showAdminBoundaries) return;

    const isDark = basemapMode !== "street";

    layer.setStyle((feature) => {
      const geoMeta = (feature?.properties ?? {}) as ProvinceFeatureProps;
      const primaryId = geoMeta.primaryAreaId ?? null;
      const mappedId = geoMeta.mappedAreaId ?? "bangkok";
      const area = areaById.get(primaryId ?? mappedId);

      const isRelevant = Boolean(primaryId && relevantAreaIds.has(primaryId));
      const isSelectedProvince = (primaryId ?? mappedId) === selectedArea.id;

      if (!area) {
        return {
          color: isDark ? "#475569" : "#94a3b8",
          weight: 1,
          fillOpacity: 0.1,
        };
      }

      const tier = classifyAreaRisk(area, activeTopic);
      const bandColor =
        riskBands.find((b) => b.tier === tier)?.color ?? topicMeta.color;

      if (isSelectedProvince) {
        return {
          color: isDark ? "#facc15" : "#0f172a",
          weight: 3.6,
          fillColor: bandColor,
          fillOpacity: 0.62,
          dashArray: undefined,
        };
      }

      if (showAllProvincesScope || isRelevant) {
        return {
          color: isDark ? "rgba(255,255,255,0.62)" : "#ffffff",
          weight: 1.5,
          fillColor: bandColor,
          fillOpacity: 0.44,
          dashArray: undefined,
        };
      }

      return {
        color: isDark ? "rgba(203, 213, 225, 0.45)" : "rgba(71, 85, 105, 0.48)",
        weight: 1.1,
        fillColor: bandColor,
        fillOpacity: 0.24,
        dashArray: undefined,
      };
    });

    layer.eachLayer((subLayer) => {
      const featureLayer = subLayer as Leaflet.Layer & {
        feature?: GeoJSON.Feature;
        setTooltipContent?: (html: string) => void;
      };
      const geoMeta = (featureLayer.feature?.properties ?? {}) as ProvinceFeatureProps;
      const provNameThai = geoMeta.PROV_NAM_T ?? "จังหวัด";
      const provNameEng = geoMeta.PROV_NAM_E ?? "";
      const provCode = geoMeta.PROV_CODE ?? "";
      const targetAreaId = geoMeta.primaryAreaId || geoMeta.mappedAreaId || "bangkok";
      const area = areaById.get(targetAreaId);
      if (area && typeof featureLayer.setTooltipContent === "function") {
        const metric = pinMetricLabel(area, activeTopic);
        const tier = classifyAreaRisk(area, activeTopic);
        const bandInfo = riskBands.find((b) => b.tier === tier);
        const tooltipHtml = `
          <div class="fahsai-geo-tooltip">
            <strong>จ.${provNameThai}</strong> <span style="opacity:0.78">(${provNameEng} · รหัส ${provCode})</span>
            <div>${topicMeta.icon} ${topicMeta.label}: <b>${metric}</b> (${bandInfo?.label ?? `ระดับ ${tier}/5`})</div>
            <div style="font-size:11px;opacity:0.85">🌡️ ${area.current.tempC}°C · 🌧️ ฝน ${area.current.rainProb}% ของพื้นที่ · 😷 PM2.5 ${area.current.pm25} µg/m³</div>
          </div>
        `;
        featureLayer.setTooltipContent(tooltipHtml);
      }
    });
  }, [
    activeTopic,
    areaById,
    basemapMode,
    mapReady,
    provincesGeoData,
    relevantAreaIds,
    riskBands,
    selectedArea.id,
    showAdminBoundaries,
    showAllProvincesScope,
    topicMeta.color,
    topicMeta.icon,
    topicMeta.label,
  ]);

  // Optional BMA 50 Districts layer lifecycle & style update
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map || !mapReady) return;

    if (!shouldShowBmaLayer || !bmaGeoData) {
      if (bmaDistrictLayerRef.current) {
        bmaDistrictLayerRef.current.remove();
        bmaDistrictLayerRef.current = null;
      }
      return;
    }

    if (!bmaDistrictLayerRef.current) {
      const bmaLayer = L.geoJSON(bmaGeoData, {
        onEachFeature: (feature, featureLayer) => {
          const distMeta = (feature?.properties ?? {}) as DistrictFeatureProps;
          if (distMeta.NAME_T) {
            featureLayer.bindTooltip(
              `<strong>${distMeta.NAME_T}</strong> (${distMeta.NAME_E ?? "BMA District"}) · ขอบเขตปกครอง กทม.`,
              { sticky: true, direction: "top" }
            );
          }
          featureLayer.on("click", () => onSelectAreaRef.current("bangkok"));
        },
      });
      bmaLayer.addTo(map);
      bmaDistrictLayerRef.current = bmaLayer;
    }

    bmaDistrictLayerRef.current.setStyle({
      color: basemapMode === "street" ? "#0284c7" : "#38bdf8",
      weight: 1.2,
      fillColor: "#0ea5e9",
      fillOpacity: 0.1,
    });
  }, [basemapMode, bmaGeoData, mapReady, shouldShowBmaLayer]);

  // Render Interactive Province Markers across Thailand (in-place icon update without layer teardown)
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map || !mapReady) return;

    if (pinDisplayMode === "polygons-only") {
      if (markersLayerRef.current) {
        markersLayerRef.current.clearLayers();
        markersLayerRef.current.remove();
        markersLayerRef.current = null;
      }
      markerInstancesRef.current.clear();
      return;
    }

    if (!markersLayerRef.current) {
      const group = L.layerGroup();
      group.addTo(map);
      markersLayerRef.current = group;
    }

    const group = markersLayerRef.current;
    const existingMarkers = markerInstancesRef.current;

    const baseCandidates =
      pinDisplayMode === "all77"
        ? showAllProvincesScope
          ? activeRegion === "all"
            ? allAreas
            : allAreas.filter((a) => a.regionId === activeRegion)
          : areas
        : currentZoom >= 7
          ? allAreas
          : areas.slice(0, 24);

    const candidateMap = new Map<string, AreaForecast>();
    for (const a of baseCandidates) candidateMap.set(a.id, a);
    candidateMap.set(selectedArea.id, selectedArea);

    // Remove markers that are no longer in candidateMap
    existingMarkers.forEach((marker, id) => {
      if (!candidateMap.has(id)) {
        group.removeLayer(marker);
        existingMarkers.delete(id);
      }
    });

    const isCompact77 = candidateMap.size > 28 && currentZoom <= 6;

    candidateMap.forEach((area) => {
      const isSelected = area.id === selectedArea.id;
      const tier = classifyAreaRisk(area, activeTopic);
      const bandColor =
        riskBands.find((b) => b.tier === tier)?.color ?? topicMeta.color;
      const shortName =
        THAILAND_LABEL_OFFSETS[area.id]?.shortName ?? area.name.split(" ")[0];
      const metric = pinMetricLabel(area, activeTopic);

      const html = `
        <div class="fahsai-map-pin ${isSelected ? "is-selected" : ""} ${isCompact77 && !isSelected ? "is-compact-77" : ""}" style="--pin-color: ${bandColor}">
          ${isSelected ? `<span class="fahsai-map-pin-pulse" style="border-color:${bandColor}"></span>` : ""}
          <span class="fahsai-map-pin-dot" style="background:${bandColor}"></span>
          <span class="fahsai-map-pin-chip">
            <strong class="fahsai-map-pin-name">${shortName}</strong>
            <em class="fahsai-map-pin-val" style="color:${bandColor}">${metric}</em>
          </span>
        </div>
      `;

      const icon = L.divIcon({
        className: "fahsai-map-div-icon",
        html,
        iconSize: isCompact77 && !isSelected ? [96, 24] : [124, 32],
        iconAnchor: isCompact77 && !isSelected ? [48, 12] : [62, 16],
      });

      const existing = existingMarkers.get(area.id);
      if (existing) {
        existing.setIcon(icon);
        existing.setZIndexOffset(isSelected ? 1000 : 100);
      } else {
        const marker = L.marker([area.lat, area.lng], {
          icon,
          zIndexOffset: isSelected ? 1000 : 100,
        });
        marker.on("click", () => {
          onSelectAreaRef.current(area.id);
        });
        group.addLayer(marker);
        existingMarkers.set(area.id, marker);
      }
    });
  }, [
    activeRegion,
    activeTopic,
    allAreas,
    areas,
    currentZoom,
    mapReady,
    pinDisplayMode,
    riskBands,
    selectedArea,
    showAllProvincesScope,
    topicMeta.color,
  ]);

  // Fit bounds ONLY when topic, region, or scope changes (never on hour/day scrubber ticks)
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map || !mapReady) return;

    const scoped = areasRef.current;
    if (scoped.length > 1) {
      const latLngs = scoped.map((a) => [a.lat, a.lng] as [number, number]);
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [34, 34], maxZoom: 8, animate: true });
    } else if (scoped.length === 1) {
      map.flyTo([scoped[0].lat, scoped[0].lng], 8, { duration: 0.7 });
    }
  }, [activeTopic, activeRegion, showAllProvincesScope, mapReady]);

  const handleZoomToAll77Thailand = () => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;
    const bounds = L.latLngBounds(allAreas.map((a) => [a.lat, a.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 7, animate: true });
  };

  const handleZoomToTopicScope = () => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;
    if (areas.length > 1) {
      const bounds = L.latLngBounds(areas.map((a) => [a.lat, a.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [34, 34], maxZoom: 8, animate: true });
    } else {
      map.fitBounds(scopeConfig.defaultBounds, { padding: [30, 30], animate: true });
    }
  };

  const handleZoomToSelectedProvince = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo([selectedArea.lat, selectedArea.lng], selectedArea.id === "bangkok" ? 10 : 8.5, {
      duration: 0.8,
    });
  };

  return (
    <div className={`fahsai-real-map-wrapper ${isExpandedWide ? "is-expanded-wide" : ""}`}>
      {/* Mobile Quick Toggle for Map Layer & Scope Settings */}
      <div className="fahsai-mobile-tools-bar">
        <button
          type="button"
          className={`fahsai-mobile-tools-toggle ${showMobileLayers ? "is-open" : ""}`}
          aria-expanded={showMobileLayers}
          onClick={() => setShowMobileLayers((v) => !v)}
        >
          <span>🎛️ ตั้งค่าชั้นแผนที่ &amp; ขอบเขต ({basemapMode === "street" ? "ถนน OSM" : basemapMode === "satellite" ? "ดาวเทียม" : "แผนที่มืด"})</span>
          <strong>{showMobileLayers ? "▲ ซ่อนตัวเลือก" : "▼ เปิดตั้งค่า"}</strong>
        </button>
        <button
          type="button"
          className="fahsai-mobile-zoom-btn"
          onClick={handleZoomToSelectedProvince}
        >
          📍 ซูม {selectedArea.name.split(" ")[0]}
        </button>
        <button
          type="button"
          className="fahsai-mobile-zoom-btn"
          onClick={handleZoomToAll77Thailand}
        >
          🇹🇭 ทั่วไทย
        </button>
      </div>

      {/* Top Scope Banner */}
      <div className={`fahsai-scope-banner ${showMobileLayers ? "is-mobile-open" : "is-mobile-collapsed"}`}>
        <div className="fahsai-scope-banner-left">
          <span
            className="fahsai-scope-pill"
            style={{ background: topicMeta.accentLight, color: topicMeta.color }}
          >
            {showAllProvincesScope
              ? `🇹🇭 แสดงข้อมูลครบทุกจังหวัดทั่วไทย (${allAreas.length} จังหวัด)`
              : scopeConfig.scopeBadge}
          </span>
          <p className="fahsai-scope-desc">{scopeConfig.scopeDescription}</p>
        </div>
        <div className="fahsai-scope-banner-actions">
          <button
            type="button"
            className={`fahsai-mini-btn ${showAllProvincesScope ? "is-active" : ""}`}
            onClick={onToggleAllProvincesScope}
          >
            {showAllProvincesScope
              ? `✅ กำลังแสดงครบ ${allAreas.length} จังหวัดทั่วไทย · กดเพื่อกรองเฉพาะพื้นที่หัวข้อนี้`
              : `แสดงเฉพาะพื้นที่เกี่ยวข้อง (${areas.length} จ.) · กดดูครบทั้ง ${allAreas.length} จังหวัด`}
          </button>
          {onToggleExpandedWide && (
            <button
              type="button"
              className={`fahsai-mini-btn is-expand-btn ${isExpandedWide ? "is-active" : ""}`}
              onClick={onToggleExpandedWide}
            >
              {isExpandedWide ? "🗗 ย่อกลับมุมมองคู่" : "⛶ ขยายแผนที่ใหญ่เต็มความกว้าง"}
            </button>
          )}
        </div>
      </div>

      {/* Real Basemap & Administrative Layer Controls */}
      <div
        className={`fahsai-map-toolbar ${showMobileLayers ? "is-mobile-open" : "is-mobile-collapsed"}`}
        role="group"
        aria-label="ควบคุมชั้นแผนที่จริงและขอบเขตการปกครอง"
      >
        <div className="fahsai-map-toolbar-group">
          <span className="fahsai-toolbar-label">Basemap:</span>
          <button
            type="button"
            className={`fahsai-LayerBtn ${basemapMode === "street" ? "is-active" : ""}`}
            aria-pressed={basemapMode === "street"}
            onClick={() => onChangeBasemapMode("street")}
          >
            🗺️ แผนที่ถนนจริง (OSM)
          </button>
          <button
            type="button"
            className={`fahsai-LayerBtn ${basemapMode === "satellite" ? "is-active" : ""}`}
            aria-pressed={basemapMode === "satellite"}
            onClick={() => onChangeBasemapMode("satellite")}
          >
            🛰️ ดาวเทียมจริง (Esri)
          </button>
          <button
            type="button"
            className={`fahsai-LayerBtn ${basemapMode === "dark" ? "is-active" : ""}`}
            aria-pressed={basemapMode === "dark"}
            onClick={() => onChangeBasemapMode("dark")}
          >
            🌑 แผนที่มืด GIS
          </button>
        </div>

        <div className="fahsai-map-toolbar-group">
          <span className="fahsai-toolbar-label">ป้ายข้อมูลบนแผนที่:</span>
          <button
            type="button"
            className={`fahsai-LayerBtn ${pinDisplayMode === "polygons-only" ? "is-active" : ""}`}
            aria-pressed={pinDisplayMode === "polygons-only"}
            onClick={() => setPinDisplayMode("polygons-only")}
          >
            🎨 ปิดป้ายข้อมูล (เฉพาะสีขอบเขตจังหวัด)
          </button>
          <button
            type="button"
            className={`fahsai-LayerBtn ${pinDisplayMode === "smart" ? "is-active" : ""}`}
            aria-pressed={pinDisplayMode === "smart"}
            onClick={() => setPinDisplayMode("smart")}
          >
            ✨ ป้ายอัจฉริยะตามระยะซูม
          </button>
          <button
            type="button"
            className={`fahsai-LayerBtn ${pinDisplayMode === "all77" ? "is-active" : ""}`}
            aria-pressed={pinDisplayMode === "all77"}
            onClick={() => setPinDisplayMode("all77")}
          >
            🇹🇭 ป้ายครบทุกจังหวัด ({showAllProvincesScope ? allAreas.length : areas.length})
          </button>
          <button
            type="button"
            className={`fahsai-LayerBtn ${showBasemapLabels ? "is-active" : ""}`}
            aria-pressed={showBasemapLabels}
            onClick={() => setShowBasemapLabels((v) => !v)}
          >
            🏷️ {showBasemapLabels ? "แสดงชื่อเมืองบนแผนที่" : "ปิดชื่อเมืองพื้นหลัง"}
          </button>
        </div>

        <div className="fahsai-map-toolbar-group">
          <button
            type="button"
            className={`fahsai-LayerBtn ${showAdminBoundaries ? "is-active" : ""}`}
            aria-pressed={showAdminBoundaries}
            onClick={() => setShowAdminBoundaries((v) => !v)}
          >
            🏛️ ขอบเขต 77 จังหวัดจริง (DMR)
          </button>
          <button
            type="button"
            className={`fahsai-LayerBtn ${showBmaDistricts || selectedArea.id === "bangkok" ? "is-active" : ""}`}
            aria-pressed={showBmaDistricts || selectedArea.id === "bangkok"}
            onClick={() => setShowBmaDistricts((v) => !v)}
          >
            🏙️ 50 เขตปกครอง กทม. (BMA)
          </button>
          <button type="button" className="fahsai-LayerBtn" onClick={handleZoomToAll77Thailand}>
            🇹🇭 ซูมทั่วไทย 77 จ.
          </button>
          <button type="button" className="fahsai-LayerBtn" onClick={handleZoomToTopicScope}>
            🎯 ซูมขอบเขตหัวข้อนี้
          </button>
          <button type="button" className="fahsai-LayerBtn" onClick={handleZoomToSelectedProvince}>
            📍 ซูม {selectedArea.name.split(" ")[0]}
          </button>
        </div>
      </div>

      {/* MAP FORECAST DAY & TIME SELECTOR DECK ("แผนที่เลือกวันเวลาพยากรณ์ได้") */}
      <div className="fahsai-map-time-deck" role="region" aria-label="เลือกวันและเวลาพยากรณ์บนแผนที่ประเทศไทย">
        <div className="fahsai-map-time-top">
          <div className="fahsai-map-day-pills" role="group" aria-label="เลือกวันพยากรณ์ 7 วันบนแผนที่">
            <span className="fahsai-toolbar-label">📅 เลือกวันพยากรณ์:</span>
            {selectedArea.daily.map((d, idx) => {
              const daySev = classifyDailyPointRisk(selectedArea, d, activeTopic);
              const isDayActive = idx === dayIdx;
              return (
                <button
                  key={d.dayLabel}
                  type="button"
                  className={`fahsai-day-pill ${isDayActive ? "is-active" : ""}`}
                  aria-pressed={isDayActive}
                  style={
                    isDayActive
                      ? { background: daySev.color, borderColor: daySev.color, color: "#ffffff" }
                      : undefined
                  }
                  onClick={() => onChangeDayIdx?.(idx)}
                >
                  <span
                    className="fahsai-day-pill-dot"
                    style={{ background: isDayActive ? "#ffffff" : daySev.color }}
                  />
                  <strong>{d.dayLabel}</strong>
                </button>
              );
            })}
          </div>

          <div className="fahsai-map-hour-presets" role="group" aria-label="เลือกช่วงเวลาพยากรณ์อย่างรวดเร็ว">
            <button
              type="button"
              className={`fahsai-time-preset-btn ${dayIdx === 0 && isLiveNow ? "is-live" : ""}`}
              onClick={() => onResetLiveNow?.()}
            >
              🟢 ตอนนี้ (สด)
            </button>
            {[
              { h: 6, label: "🌅 เช้า 06:00" },
              { h: 9, label: "🌤️ สาย 09:00" },
              { h: 12, label: "☀️ เที่ยง 12:00" },
              { h: 15, label: "🌧️ บ่าย 15:00" },
              { h: 18, label: "🌇 เย็น 18:00" },
              { h: 21, label: "🌙 ดึก 21:00" },
            ].map((preset) => (
              <button
                key={preset.h}
                type="button"
                className={`fahsai-time-preset-btn ${!isLiveNow && hourIdx === preset.h ? "is-active" : ""}`}
                onClick={() => onChangeHourIdx?.(preset.h)}
              >
                {preset.label}
              </button>
            ))}
            {onTogglePlayTime && (
              <button
                type="button"
                className={`fahsai-time-play-btn ${isPlayingTime ? "is-playing" : ""}`}
                onClick={onTogglePlayTime}
              >
                {isPlayingTime ? "⏸️ หยุดเล่นเวลา" : "▶️ เล่นเวลาพยากรณ์"}
              </button>
            )}
          </div>
        </div>

        <div className="fahsai-map-scrubber-row">
          <div className="fahsai-map-scrubber-label">
            <span>
              🕒 เวลาพยากรณ์บนแผนที่:{" "}
              <strong>
                {selectedArea.daily[dayIdx]?.dayLabel ?? "วันนี้"} ·{" "}
                {String(hourIdx).padStart(2, "0")}:00 น.
              </strong>
              {dayIdx === 0 && isLiveNow ? " (ข้อมูลเวลาปัจจุบัน)" : " (โหมดพยากรณ์ล่วงหน้า)"}
            </span>
            <small>เลื่อนแถบหรือคลิกช่วงเวลาเพื่อดูสีความรุนแรงทั้ง 77 จังหวัดเปลี่ยนตามวันและเวลา</small>
          </div>
          <input
            type="range"
            min={0}
            max={23}
            value={hourIdx}
            onChange={(e) => onChangeHourIdx?.(Number(e.target.value))}
            className="fahsai-map-hour-slider"
            aria-label="เลื่อนเวลาพยากรณ์รายชั่วโมงบนแผนที่"
          />
          <div className="fahsai-map-hour-ticks" aria-hidden="true">
            {selectedArea.hourly.map((h, i) => {
              const sev = classifyHourlyPointRisk(selectedArea, h, activeTopic);
              const isCurH = i === hourIdx;
              return (
                <button
                  key={h.hourLabel}
                  type="button"
                  className={`fahsai-map-tick ${isCurH ? "is-active" : ""}`}
                  onClick={() => onChangeHourIdx?.(i)}
                  title={`${h.hourLabel} น. · ${sev.shortTag}`}
                >
                  <i style={{ background: sev.color }} />
                  {i % 3 === 0 && <span>{h.hourLabel.slice(0, 2)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Large, High-Clarity Interactive Leaflet Map Viewport */}
      <div className="fahsai-leaflet-stage">
        <div
          ref={mapContainerRef}
          className={`fahsai-leaflet-container ${isExpandedWide ? "is-tall" : ""}`}
          aria-label={`แผนที่ประเทศไทยจริงแสดง${topicMeta.label}และขอบเขตการปกครองจริงครบทั้ง 77 จังหวัด`}
        />

        {/* Floating Active Province Summary Overlay */}
        <div className="fahsai-map-floating-card">
          <div className="fahsai-map-floating-head">
            <span className="fahsai-map-floating-tag">
              📅 {selectedArea.daily[dayIdx]?.dayLabel ?? "วันนี้"} · {String(hourIdx).padStart(2, "0")}:00 น.
            </span>
            <strong>📍 จ.{selectedArea.name}</strong>
          </div>
          <div
            className="fahsai-map-floating-metric"
            style={{
              color:
                riskBands.find((b) => b.tier === classifyAreaRisk(selectedArea, activeTopic))
                  ?.color ?? topicMeta.color,
            }}
          >
            {topicMeta.icon} {pinMetricLabel(selectedArea, activeTopic)}{" "}
            <small className="fahsai-map-floating-tier">
              (ระดับ {classifyAreaRisk(selectedArea, activeTopic)}/5)
            </small>
          </div>
          <div className="fahsai-map-floating-sub">
            🌡️ {selectedArea.current.tempC}°C · 🌧️ ฝน {selectedArea.current.rainProb}% · 😷 PM2.5 {selectedArea.current.pm25} µg/m³
          </div>
          <div className="fahsai-map-floating-sub">
            พิกัด {selectedArea.lat.toFixed(2)}°N, {selectedArea.lng.toFixed(2)}°E · ขอบเขตปกครองจริง 77 จังหวัด (DMR)
          </div>
        </div>
      </div>

      {/* Compact 5-Level Legend Bar */}
      <div className="fahsai-compact-legend" aria-label="คำอธิบายระดับสีบนขอบเขตจังหวัดจริง">
        {riskBands.map((band) => (
          <div key={band.tier} className="fahsai-compact-legend-item">
            <span className="fahsai-compact-legend-swatch" style={{ background: band.color }} />
            <div className="fahsai-compact-legend-text">
              <strong>{band.label}</strong>
              <span>{band.rangeText}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick-Select Province Chips under the map */}
      <div className="fahsai-scoped-chip-bar" aria-label={`รายชื่อจังหวัดในขอบเขต${topicMeta.label}`}>
        <div className="fahsai-scoped-chip-head">
          <span>
            📌 เลือกจังหวัดอย่างรวดเร็ว ({areas.length} จังหวัดในมุมมองนี้ จากทั้งหมด {allAreas.length} จังหวัดทั่วไทย):
          </span>
          <div className="fahsai-scoped-chip-head-actions">
            <small>ปัดซ้าย-ขวา หรือคลิกเพื่อดูข้อมูลเชิงลึกทันที</small>
            <button
              type="button"
              className="fahsai-chip-expand-btn"
              onClick={() => setShowAllProvinceChipsMobile((v) => !v)}
            >
              {showAllProvinceChipsMobile ? "▲ ย่อเป็นแถบเลื่อน" : `▼ แสดงทั้งหมด (${areas.length} จ.)`}
            </button>
          </div>
        </div>
        <div className={`fahsai-scoped-chip-list ${showAllProvinceChipsMobile ? "is-expanded-all" : ""}`}>
          {areas.map((area) => {
            const isSelected = area.id === selectedArea.id;
            const tier = classifyAreaRisk(area, activeTopic);
            const bandColor =
              riskBands.find((b) => b.tier === tier)?.color ?? topicMeta.color;
            return (
              <button
                key={area.id}
                type="button"
                className={`fahsai-scoped-chip ${isSelected ? "is-selected" : ""}`}
                style={
                  isSelected
                    ? {
                        borderColor: bandColor,
                        background: `${bandColor}18`,
                      }
                    : undefined
                }
                onClick={() => onSelectArea(area.id)}
              >
                <span className="fahsai-scoped-chip-dot" style={{ background: bandColor }} />
                <span className="fahsai-scoped-chip-name">{area.name}</span>
                <strong className="fahsai-scoped-chip-val" style={{ color: bandColor }}>
                  {pinMetricLabel(area, activeTopic)}
                </strong>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
