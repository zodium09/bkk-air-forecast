"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AreaForecast, RegionId, TopicId } from "../../lib/fahsai-data";
import {
  classifyAreaRisk,
  getTopicRiskBands,
  getTopicScopeConfig,
  pinMetricLabel,
  THAILAND_LABEL_OFFSETS,
  TOPICS,
} from "./fahsai-helpers";
import thailandProvincesGeoJson from "../../data/thailand-provinces-geojson.json";
import bangkokDistrictsGeoJson from "../../data/bangkok-districts.json";

export type RealBasemapMode = "street" | "satellite" | "dark";

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
    labelUrl?: string;
    attribution: string;
    name: string;
  }
> = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · ขอบเขตการปกครอง กรมทรัพยากรธรณี (DMR) & กทม. (BMA)',
    name: "แผนที่ถนน & เขตปกครองจริง (OSM)",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    labelUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "&copy; Esri, Maxar, Earthstar Geographics · ขอบเขตการปกครองจริง DMR & BMA",
    name: "ดาวเทียมจริง Esri World Imagery",
  },
  dark: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    labelUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "&copy; Esri, HERE, Garmin, OpenStreetMap · ขอบเขตการปกครองจริง DMR & BMA",
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
}: FahSaiLeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const mapInstanceRef = useRef<Leaflet.Map | null>(null);
  const baseTileLayerRef = useRef<Leaflet.TileLayer | null>(null);
  const labelTileLayerRef = useRef<Leaflet.TileLayer | null>(null);
  const provinceLayerRef = useRef<Leaflet.GeoJSON | null>(null);
  const bmaDistrictLayerRef = useRef<Leaflet.GeoJSON | null>(null);
  const markersLayerRef = useRef<Leaflet.LayerGroup | null>(null);

  const [showAdminBoundaries, setShowAdminBoundaries] = useState(true);
  const [showBmaDistricts, setShowBmaDistricts] = useState(false);
  const [mapReady, setMapReady] = useState(false);

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

  // Initialize Leaflet map once on client
  useEffect(() => {
    let cancelled = false;
    if (!mapContainerRef.current) return;

    void import("leaflet").then((L) => {
      if (cancelled || !mapContainerRef.current || mapInstanceRef.current) return;
      leafletRef.current = L;

      const map = L.map(mapContainerRef.current, {
        center: [13.2, 100.8],
        zoom: 6,
        minZoom: 5,
        maxZoom: 14,
        zoomControl: false,
        attributionControl: true,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapInstanceRef.current = map;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

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
    const baseLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: 18,
    });
    baseLayer.addTo(map);
    baseLayer.bringToBack();
    baseTileLayerRef.current = baseLayer;

    if (cfg.labelUrl) {
      const labelLayer = L.tileLayer(cfg.labelUrl, {
        maxZoom: 18,
        opacity: 0.85,
      });
      labelLayer.addTo(map);
      labelTileLayerRef.current = labelLayer;
    }
  }, [basemapMode, mapReady]);

  // Render real 77-province administrative boundaries (DMR MapServer/8 GeoJSON) + BMA 50 districts
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map || !mapReady) return;

    if (provinceLayerRef.current) {
      provinceLayerRef.current.remove();
      provinceLayerRef.current = null;
    }
    if (bmaDistrictLayerRef.current) {
      bmaDistrictLayerRef.current.remove();
      bmaDistrictLayerRef.current = null;
    }

    if (showAdminBoundaries) {
      const geoData = thailandProvincesGeoJson as unknown as GeoJSON.FeatureCollection;
      const isDark = basemapMode !== "street";

      const layer = L.geoJSON(geoData, {
        style: (feature) => {
          const geoMeta = (feature?.properties ?? {}) as ProvinceFeatureProps;
          const primaryId = geoMeta.primaryAreaId ?? null;
          const mappedId = geoMeta.mappedAreaId ?? "bangkok";
          const area = areaById.get(primaryId ?? mappedId);

          const isRelevantPrimary = Boolean(primaryId && relevantAreaIds.has(primaryId));
          const isSelectedProvince = primaryId === selectedArea.id;

          if (!area) {
            return {
              color: isDark ? "#475569" : "#94a3b8",
              weight: 0.8,
              fillOpacity: 0.03,
            };
          }

          const tier = classifyAreaRisk(area, activeTopic);
          const bandColor =
            riskBands.find((b) => b.tier === tier)?.color ?? topicMeta.color;

          if (isSelectedProvince) {
            return {
              color: isDark ? "#ffffff" : "#0f172a",
              weight: 3.2,
              fillColor: bandColor,
              fillOpacity: 0.52,
              dashArray: undefined,
            };
          }

          if (isRelevantPrimary) {
            return {
              color: bandColor,
              weight: 1.8,
              fillColor: bandColor,
              fillOpacity: 0.28,
              dashArray: undefined,
            };
          }

          // Background Thailand provinces outside current topic's active stations:
          // Keep real administrative borders visible but subtle so map is uncluttered!
          return {
            color: isDark ? "rgba(148, 163, 184, 0.35)" : "rgba(100, 116, 139, 0.42)",
            weight: 0.9,
            fillColor: bandColor,
            fillOpacity: showAllProvincesScope ? 0.14 : 0.04,
            dashArray: "3 3",
          };
        },
        onEachFeature: (feature, featureLayer) => {
          const geoMeta = (feature?.properties ?? {}) as ProvinceFeatureProps;
          const provNameThai = geoMeta.PROV_NAM_T ?? "จังหวัด";
          const provNameEng = geoMeta.PROV_NAM_E ?? "";
          const provCode = geoMeta.PROV_CODE ?? "";
          const targetAreaId = geoMeta.primaryAreaId || geoMeta.mappedAreaId || "bangkok";
          const area = areaById.get(targetAreaId);

          if (area) {
            const metric = pinMetricLabel(area, activeTopic);
            const isPrimary = Boolean(geoMeta.primaryAreaId);
            const tooltipHtml = `
              <div class="fahsai-geo-tooltip">
                <strong>จ.${provNameThai}</strong> <span style="opacity:0.75">(${provNameEng} · รหัส ${provCode})</span>
                <div>${isPrimary ? `สถานี${area.name}` : `อ้างอิงสถานีใกล้เคียง: ${area.name}`} · <b>${metric}</b></div>
              </div>
            `;
            featureLayer.bindTooltip(tooltipHtml, {
              sticky: true,
              direction: "top",
              className: "fahsai-leaflet-tooltip",
            });
            featureLayer.on("click", () => {
              onSelectArea(area.id);
            });
          }
        },
      });

      layer.addTo(map);
      provinceLayerRef.current = layer;
    }

    // Optional BMA 50 Districts layer when Bangkok is selected or toggled
    if (showBmaDistricts || selectedArea.id === "bangkok") {
      const bmaData = bangkokDistrictsGeoJson as unknown as GeoJSON.FeatureCollection;
      const bmaLayer = L.geoJSON(bmaData, {
        style: () => ({
          color: basemapMode === "street" ? "#0284c7" : "#38bdf8",
          weight: 1.1,
          fillColor: "#0ea5e9",
          fillOpacity: 0.08,
        }),
        onEachFeature: (feature, featureLayer) => {
          const distMeta = (feature?.properties ?? {}) as DistrictFeatureProps;
          if (distMeta.NAME_T) {
            featureLayer.bindTooltip(
              `<strong>${distMeta.NAME_T}</strong> (${distMeta.NAME_E ?? "BMA District"}) · ขอบเขตปกครอง กทม.`,
              { sticky: true, direction: "top" }
            );
          }
          featureLayer.on("click", () => onSelectArea("bangkok"));
        },
      });
      bmaLayer.addTo(map);
      bmaDistrictLayerRef.current = bmaLayer;
    }
  }, [
    activeTopic,
    areaById,
    basemapMode,
    mapReady,
    onSelectArea,
    relevantAreaIds,
    riskBands,
    selectedArea.id,
    showAdminBoundaries,
    showAllProvincesScope,
    showBmaDistricts,
    topicMeta.color,
  ]);

  // Render clean, uncluttered Interactive Markers for the topic's relevant areas
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map || !mapReady) return;

    if (markersLayerRef.current) {
      markersLayerRef.current.remove();
      markersLayerRef.current = null;
    }

    const group = L.layerGroup();

    areas.forEach((area) => {
      const isSelected = area.id === selectedArea.id;
      const tier = classifyAreaRisk(area, activeTopic);
      const bandColor =
        riskBands.find((b) => b.tier === tier)?.color ?? topicMeta.color;
      const shortName =
        THAILAND_LABEL_OFFSETS[area.id]?.shortName ?? area.name.split(" ")[0];
      const metric = pinMetricLabel(area, activeTopic);

      const html = `
        <div class="fahsai-map-pin ${isSelected ? "is-selected" : ""}" style="--pin-color: ${bandColor}">
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
        iconSize: [120, 32],
        iconAnchor: [60, 16],
      });

      const marker = L.marker([area.lat, area.lng], {
        icon,
        zIndexOffset: isSelected ? 1000 : 100,
      });

      marker.on("click", () => {
        onSelectArea(area.id);
      });

      group.addLayer(marker);
    });

    group.addTo(map);
    markersLayerRef.current = group;
  }, [activeTopic, areas, mapReady, onSelectArea, riskBands, selectedArea.id, topicMeta.color]);

  // Fit bounds when topic or region changes
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map || !mapReady) return;

    if (areas.length > 1) {
      const latLngs = areas.map((a) => [a.lat, a.lng] as [number, number]);
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [38, 38], maxZoom: 8, animate: true });
    } else if (areas.length === 1) {
      map.flyTo([areas[0].lat, areas[0].lng], 8, { duration: 0.7 });
    }
  }, [activeTopic, activeRegion, mapReady, areas]);

  const handleZoomToTopicScope = () => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;
    if (areas.length > 1) {
      const bounds = L.latLngBounds(areas.map((a) => [a.lat, a.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 8, animate: true });
    } else {
      map.fitBounds(scopeConfig.defaultBounds, { padding: [30, 30], animate: true });
    }
  };

  const handleZoomToSelectedProvince = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo([selectedArea.lat, selectedArea.lng], selectedArea.id === "bangkok" ? 10 : 8, {
      duration: 0.8,
    });
  };

  return (
    <div className="fahsai-real-map-wrapper">
      {/* Top Scope Banner: Explains why this topic covers these specific areas */}
      <div className="fahsai-scope-banner">
        <div className="fahsai-scope-banner-left">
          <span
            className="fahsai-scope-pill"
            style={{ background: topicMeta.accentLight, color: topicMeta.color }}
          >
            {scopeConfig.scopeBadge}
          </span>
          <p className="fahsai-scope-desc">{scopeConfig.scopeDescription}</p>
        </div>
        <div className="fahsai-scope-banner-actions">
          <button
            type="button"
            className={`fahsai-mini-btn ${showAllProvincesScope ? "is-active" : ""}`}
            onClick={onToggleAllProvincesScope}
            title="สลับดูเฉพาะพื้นที่เกี่ยวข้องกับเรื่องนี้ หรือดูทั้ง 24 จังหวัดทั่วไทย"
          >
            {showAllProvincesScope
              ? `กำลังแสดงทั่วไทย (${allAreas.length} จ.) · กดเพื่อกรองเฉพาะพื้นที่หัวข้อนี้`
              : `แสดงเฉพาะพื้นที่เกี่ยวข้อง (${areas.length} จ.) · กดดูครบ 24 จ.`}
          </button>
        </div>
      </div>

      {/* Real Basemap & Administrative Layer Controls */}
      <div className="fahsai-map-toolbar" role="group" aria-label="ควบคุมชั้นแผนที่จริงและขอบเขตการปกครอง">
        <div className="fahsai-map-toolbar-group">
          <span className="fahsai-toolbar-label">พื้นหลังแผนที่จริง (Basemap):</span>
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
          <button type="button" className="fahsai-LayerBtn" onClick={handleZoomToTopicScope}>
            🎯 ซูมขอบเขตหัวข้อนี้
          </button>
          <button type="button" className="fahsai-LayerBtn" onClick={handleZoomToSelectedProvince}>
            📍 ซูม {selectedArea.name.split(" ")[0]}
          </button>
        </div>
      </div>

      {/* Interactive Leaflet Map Viewport */}
      <div className="fahsai-leaflet-stage">
        <div
          ref={mapContainerRef}
          className="fahsai-leaflet-container"
          aria-label={`แผนที่ประเทศไทยจริงแสดง${topicMeta.label}และขอบเขตการปกครองจริง 77 จังหวัด`}
        />

        {/* Floating Active Province Summary Overlay */}
        <div className="fahsai-map-floating-card">
          <div className="fahsai-map-floating-head">
            <span className="fahsai-map-floating-tag">{selectedArea.regionName}</span>
            <strong>📍 {selectedArea.name}</strong>
          </div>
          <div className="fahsai-map-floating-metric" style={{ color: topicMeta.color }}>
            {topicMeta.icon} {pinMetricLabel(selectedArea, activeTopic)}
          </div>
          <div className="fahsai-map-floating-sub">
            พิกัดจริง {selectedArea.lat.toFixed(2)}°N, {selectedArea.lng.toFixed(2)}°E · ขอบเขตปกครองจริง DMR/BMA
          </div>
        </div>
      </div>

      {/* Quick-Select Relevant Province Chips under the map (Accessible in SSR & 1-click navigation) */}
      <div className="fahsai-scoped-chip-bar" aria-label={`รายชื่อจังหวัดในขอบเขต${topicMeta.label}`}>
        <div className="fahsai-scoped-chip-head">
          <span>
            📌 พื้นที่ในหัวข้อ <strong>{topicMeta.label}</strong> ({areas.length} จังหวัด):
          </span>
          <small>คลิกที่ชื่อจังหวัดหรือคลิกบนขอบเขตแผนที่จริงเพื่อดูรายละเอียดและ Digital Twin</small>
        </div>
        <div className="fahsai-scoped-chip-list">
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
    </div>
  );
}
