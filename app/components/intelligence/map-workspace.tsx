"use client";
/* eslint-disable @next/next/no-html-link-for-pages */
import { useEffect, useMemo, useRef, useState } from "react";
import EnvironmentMap from "./environment-map";
import LocationInsight from "./location-insight";
import ThemeToggle from "../theme-toggle";
import {
  boundaryContains,
  interpolateMapValue,
  type MapBoundary,
} from "../../lib/map-surface";
import {
  DataStatus,
  ForecastTimeline,
  LayerSwitcher,
  MapErrorState,
  MapIcon,
  MapLegend,
  MapLoadingState,
  MapShell,
  LocationPanel,
  goToStory,
} from "./map-ui";
import { useEnvironmentData } from "./use-environment-data";
import {
  average,
  closestPoint,
  formatValue,
  interpretation,
  layerInfo,
  metricName,
  modeLabels,
  pointValue,
  relativeDay,
  type DataMode,
  type EnvironmentLayer,
  type MapPoint,
  type Metric,
} from "../../lib/map-intelligence";
import { getRegion, provinces, type RegionId } from "../../lib/provinces";
import "./map-workspace.css";
import "./night-theme.css";
import "./mobile-story.css";

const emptyPoints: MapPoint[] = [];
export default function MapWorkspace({
  initialLayer = "air",
}: {
  initialLayer?: EnvironmentLayer;
}) {
  const [layer, setLayer] = useState(initialLayer);
  const [province, setProvince] = useState<RegionId>("metro");
  const [mode, setMode] = useState<DataMode>("estimate");
  const [metric, setMetric] = useState<Metric>("primary");
  const [timeKey, setTimeKey] = useState("");
  const [selected, setSelected] = useState<{
    lat: number;
    lng: number;
    label?: string;
  } | null>(null);
  const [focus, setFocus] = useState(0);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [storySection, setStorySection] = useState("map-story");
  const [satellite, setSatellite] = useState(false);
  const [showValues, setShowValues] = useState(false);
  const [showPlaceNames, setShowPlaceNames] = useState(true);
  const [exploring, setExploring] = useState(false);
  const exploreReturn = useRef<{ y: number; element: HTMLElement | null }>({
    y: 0,
    element: null,
  });
  const enterExplore = () => {
    exploreReturn.current = {
      y: window.scrollY,
      element: document.activeElement as HTMLElement | null,
    };
    setSearchOpen(false);
    setOptionsOpen(false);
    setExploring(true);
  };
  const [weatherMotion, setWeatherMotion] = useState(true);
  const [surfaceOpacity, setSurfaceOpacity] = useState(0.72);
  const [boundary, setBoundary] = useState<{
    region: RegionId;
    data: MapBoundary;
  } | null>(null);
  const [legend, setLegend] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [compareKey, setCompareKey] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const { data, loading, error } = useEnvironmentData(
    layer,
    province,
    mode,
    refresh,
  );
  const points = data?.points ?? emptyPoints;
  const index = Math.max(
    0,
    data?.steps.findIndex((s) => s.key === timeKey) ?? 0,
  );
  const step = data?.steps[index];
  const compare = compareKey
    ? (data?.steps.findIndex((s) => s.key === compareKey) ?? -1)
    : -1;
  const point = useMemo(
    () => (selected ? closestPoint(points, selected.lat, selected.lng) : null),
    [points, selected],
  );
  const selectionSupported = useMemo(
    () =>
      !!selected &&
      boundary?.region === province &&
      boundaryContains(boundary.data, selected.lat, selected.lng),
    [selected, boundary, province],
  );
  const values = useMemo(
    () =>
      data?.steps.map((_, i) =>
        mode === "estimate" &&
        selected &&
        (!point ||
          Math.hypot(point.lat - selected.lat, point.lng - selected.lng) >
            0.0001)
          ? selectionSupported
            ? interpolateMapValue(points, i, metric, selected.lat, selected.lng)
            : null
          : point
            ? pointValue(point, i, metric)
            : selected
              ? null
              : average(points.map((p) => pointValue(p, i, metric))),
      ) ?? [],
    [data, points, point, metric, selected, mode, selectionSupported],
  );
  const spatialSelection =
    mode === "estimate" &&
    !!selected &&
    (!point ||
      Math.hypot(point.lat - selected.lat, point.lng - selected.lng) > 0.0001);
  useEffect(() => {
    document.title = `BKK Air Forecast — แผนที่${layerInfo[layer].name} กรุงเทพฯ–ปริมณฑล`;
  }, [layer]);
  useEffect(() => {
    if (!exploring) return;
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !(event.target as HTMLElement)?.closest(".mi-options, .mi-search")
      )
        setExploring(false);
    };
    window.addEventListener("keydown", escape);
    document
      .querySelector<HTMLElement>(".mi-map-canvas")
      ?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("keydown", escape);
      requestAnimationFrame(() => {
        window.scrollTo({ top: exploreReturn.current.y, behavior: "instant" });
        exploreReturn.current.element?.focus({ preventScroll: true });
      });
    };
  }, [exploring]);
  useEffect(() => {
    if (!optionsOpen) return;
    document
      .querySelector<HTMLElement>(".mi-options select")
      ?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOptionsOpen(false);
      document
        .querySelector<HTMLButtonElement>(".mi-options-button")
        ?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [optionsOpen]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.find((item) => item.isIntersecting);
        if (entry) setStorySection(entry.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    ["map-story", "forecast-story", "location-story"].forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReducedMotion(media.matches);
      if (media.matches) setPlaying(false);
    };
    sync();
    media.addEventListener("change", sync);
    const params = new URLSearchParams(location.search);
    const initialSync = window.setTimeout(() => {
      try {
        const saved = JSON.parse(
          localStorage.getItem("bkk-map-display") ?? "{}",
        );
        if (typeof saved.showValues === "boolean")
          setShowValues(saved.showValues);
        if (typeof saved.showPlaceNames === "boolean")
          setShowPlaceNames(saved.showPlaceNames);
        if (typeof saved.weatherMotion === "boolean")
          setWeatherMotion(saved.weatherMotion);
        if (typeof saved.satellite === "boolean") setSatellite(saved.satellite);
        if (
          typeof saved.surfaceOpacity === "number" &&
          saved.surfaceOpacity >= 0.2 &&
          saved.surfaceOpacity <= 0.95
        )
          setSurfaceOpacity(saved.surfaceOpacity);
      } catch {
        /* Defaults remain usable when browser storage is unavailable. */
      }
      setProvince(getRegion(params.get("province") ?? "metro").id);
      if (params.get("time")) setTimeKey(params.get("time")!);
      const initialMode = params.get("mode");
      if (
        initialMode === "forecast" ||
        (initialMode === "observation" && initialLayer === "air")
      )
        setMode(initialMode);
      if (params.get("metric") === "secondary" && initialLayer !== "air")
        setMetric("secondary");
      const lat = Number(params.get("lat")),
        lng = Number(params.get("lng"));
      if (
        params.has("lat") &&
        params.has("lng") &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180
      )
        setSelected({ lat, lng });
      setInitialized(true);
    }, 0);
    return () => {
      window.clearTimeout(initialSync);
      media.removeEventListener("change", sync);
    };
  }, [initialLayer]);
  useEffect(() => {
    if (!initialized) return;
    try {
      localStorage.setItem(
        "bkk-map-display",
        JSON.stringify({
          showValues,
          showPlaceNames,
          weatherMotion,
          satellite,
          surfaceOpacity,
        }),
      );
    } catch {
      /* Browser preference storage is optional. */
    }
  }, [
    initialized,
    showValues,
    showPlaceNames,
    weatherMotion,
    satellite,
    surfaceOpacity,
  ]);
  useEffect(() => {
    if (!initialized) return;
    const params = new URLSearchParams({ province, mode, metric });
    if (timeKey) params.set("time", timeKey);
    if (selected) {
      params.set("lat", String(selected.lat));
      params.set("lng", String(selected.lng));
    }
    history.replaceState(null, "", `/${layer}?${params}`);
  }, [initialized, province, mode, metric, timeKey, selected, layer]);
  useEffect(() => {
    if (!playing || !data?.steps.length || reducedMotion) return;
    const timer = window.setInterval(
      () =>
        setTimeKey((key) => {
          const next = data.steps.findIndex((s) => s.key === key) + 1;
          return data.steps[next % data.steps.length].key;
        }),
      1800,
    );
    const stopWhenHidden = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", stopWhenHidden);
    };
  }, [playing, data, reducedMotion]);
  useEffect(() => {
    function onPop() {
      const nextLayer = location.pathname.split("/")[1];
      if (nextLayer === "air" || nextLayer === "rain" || nextLayer === "heat") {
        setLayer(nextLayer);
        const params = new URLSearchParams(location.search),
          nextMode = params.get("mode");
        setProvince(getRegion(params.get("province") ?? "metro").id);
        setTimeKey(params.get("time") ?? "");
        setMode(
          nextMode === "forecast" ||
            (nextMode === "observation" && nextLayer === "air")
            ? nextMode
            : "estimate",
        );
        setMetric(
          params.get("metric") === "secondary" && nextLayer !== "air"
            ? "secondary"
            : "primary",
        );
        const lat = Number(params.get("lat")),
          lng = Number(params.get("lng"));
        setSelected(
          params.has("lat") &&
            params.has("lng") &&
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            Math.abs(lat) <= 90 &&
            Math.abs(lng) <= 180
            ? { lat, lng }
            : null,
        );
        setLegend(null);
        setCompareKey(null);
        setPlaying(false);
      }
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  function changeLayer(next: EnvironmentLayer) {
    if (next === layer) return;
    setLayer(next);
    setMode("estimate");
    setMetric("primary");
    setLegend(null);
    setCompareKey(null);
    setPlaying(false);
    const date = step?.date;
    setTimeKey(date ? `${date}${next === "air" ? "" : ":day"}` : "");
    const params = new URLSearchParams({ province });
    if (date) params.set("time", `${date}${next === "air" ? "" : ":day"}`);
    if (selected) {
      params.set("lat", String(selected.lat));
      params.set("lng", String(selected.lng));
    }
    history.pushState(null, "", `/${next}?${params}`);
  }
  function selectFromList(p: MapPoint) {
    setSelected({ lat: p.lat, lng: p.lng, label: p.label });
    setFocus((n) => n + 1);
    setSearchOpen(false);
    setQuery("");
  }
  function changeTime(i: number) {
    if (data?.steps[i]) setTimeKey(data.steps[i].key);
    setPlaying(false);
  }
  function changeMode(next: DataMode) {
    setMode(next);
    setCompareKey(null);
    setPlaying(false);
  }
  const top = [...points]
    .filter((p) => pointValue(p, index, metric) !== null)
    .sort(
      (a, b) => pointValue(b, index, metric)! - pointValue(a, index, metric)!,
    )[0];
  const results = points
    .filter((p) =>
      p.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    )
    .slice(0, 8);
  const activeType =
    mode === "forecast" &&
    layer === "air" &&
    points.some((p) => p.source?.includes("residual"))
      ? "พยากรณ์ ณ จุดประมาณ"
      : modeLabels[mode];
  const currentValue = values[index] ?? null;
  return (
    <MapShell layer={layer} exploring={exploring}>
      <nav className="mi-rail" aria-label="การนำทางหลัก">
        <a className="mi-brand-mark" href="/" title="BKK Air Forecast หน้าหลัก">
          <MapIcon name="map" size={25} />
        </a>
        <div className="mi-rail-main">
          {(["air", "rain", "heat"] as const).map((item) => (
            <button
              key={item}
              aria-label={`สำรวจ ${layerInfo[item].name}`}
              aria-pressed={item === layer}
              onClick={() => changeLayer(item)}
            >
              <MapIcon name={item} size={23} />
              <span>{layerInfo[item].name}</span>
            </button>
          ))}
        </div>
        <a className="mi-rail-home" href="/" title="ภาพรวมกรุงเทพฯ">
          <MapIcon name="arrow" />
          <span>ภาพรวม</span>
        </a>
      </nav>
      <div className="mi-workspace">
        <header className="mi-header">
          <a href="/" className="mi-brand">
            <b>
              BKK <span>AIR FORECAST</span>
            </b>
            <small>สิ่งแวดล้อมกรุงเทพฯ และปริมณฑล</small>
          </a>
          <div className="mi-header-context">
            <span>แผนที่สิ่งแวดล้อม</span>
            <i />
            <span>เวลา ICT (UTC+7)</span>
          </div>
          <div className="mi-header-actions">
            <ThemeToggle />
            <a className="mi-overview-link" href="/">
              ภาพรวม <MapIcon name="arrow" size={16} />
            </a>
          </div>
        </header>
        <nav className="mi-story-nav" aria-label="ข้ามไปยังส่วนของหน้า">
          <button
            aria-current={storySection === "map-story" ? "location" : undefined}
            onClick={() => goToStory("map-story")}
          >
            <MapIcon name="map" size={17} />
            แผนที่
          </button>
          <button
            aria-current={
              storySection === "forecast-story" ? "location" : undefined
            }
            onClick={() => goToStory("forecast-story")}
          >
            พยากรณ์ 7 วัน
          </button>
          <button
            aria-current={
              storySection === "location-story" ? "location" : undefined
            }
            onClick={() => goToStory("location-story")}
          >
            รายละเอียด
          </button>
        </nav>
        <div className="mi-work-area">
          <section
            id="map-story"
            tabIndex={-1}
            className="mi-geography"
            aria-label="พื้นที่สำรวจแผนที่"
          >
            <div className="mi-story-section-title mi-map-story-title">
              <h1>สำรวจแผนที่สิ่งแวดล้อม</h1>
            </div>
            <div className="mi-map-stage">
              <EnvironmentMap
                layer={layer}
                mode={mode}
                points={points}
                index={index}
                metric={metric}
                province={province}
                selected={selected}
                onSelect={setSelected}
                legend={legend}
                degraded={!!data && data.status !== "live"}
                satellite={satellite}
                showValues={showValues}
                showPlaceNames={showPlaceNames}
                exploring={exploring}
                onToggleExplore={() =>
                  exploring ? setExploring(false) : enterExplore()
                }
                focus={focus}
                weatherAnimation={
                  weatherMotion && !reducedMotion && mode !== "observation"
                }
                onToggleWeather={() => setWeatherMotion((value) => !value)}
                surfaceOpacity={surfaceOpacity}
                onBoundary={setBoundary}
                motionDisabled={reducedMotion}
              />
              {loading && <MapLoadingState />}
              {!loading &&
                (error ||
                  !data ||
                  data.status === "unavailable" ||
                  !points.length) && (
                  <MapErrorState
                    message={
                      error ||
                      (mode === "observation"
                        ? "ไม่มีค่าตรวจวัดที่ผ่านเกณฑ์ในพื้นที่นี้"
                        : "ไม่มีข้อมูลที่ใช้ได้ในพื้นที่นี้")
                    }
                    retry={() => setRefresh((n) => n + 1)}
                  />
                )}
            </div>
            <div
              className={`mi-map-top ${mobileControlsOpen ? "mi-mobile-controls-open" : ""}`}
            >
              <LayerSwitcher layer={layer} onChange={changeLayer} />
              <button
                className="mi-story-controls-toggle"
                aria-label="ค้นหาและตั้งค่าแผนที่"
                aria-expanded={mobileControlsOpen}
                aria-controls="map-search-controls map-data-controls"
                onClick={() => {
                  setMobileControlsOpen(!mobileControlsOpen);
                  setOptionsOpen(false);
                  setSearchOpen(false);
                }}
              >
                <MapIcon
                  name={mobileControlsOpen ? "close" : "search"}
                  size={18}
                />
                <span>
                  {mobileControlsOpen ? "ปิดเครื่องมือ" : "ค้นหา / ตั้งค่า"}
                </span>
              </button>
              <div
                id="map-search-controls"
                className={`mi-search-row ${searchOpen ? "search-open" : ""}`}
              >
                <div className="mi-search">
                  <button
                    className="mi-mobile-search-trigger"
                    aria-label="เปิดค้นหาตำแหน่ง"
                    onClick={() => setSearchOpen(true)}
                  >
                    <MapIcon name="search" size={18} />
                  </button>
                  <MapIcon name="search" size={18} />
                  <input
                    aria-label="ค้นหาสถานีหรือจุดแบบจำลอง"
                    placeholder="ค้นหาสถานี / จุดแบบจำลอง"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setSearchOpen(false);
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        document
                          .querySelector<HTMLButtonElement>(
                            ".mi-search-results button",
                          )
                          ?.focus();
                      }
                      if (e.key === "Enter" && results[0])
                        selectFromList(results[0]);
                    }}
                  />
                  {searchOpen && (
                    <button
                      aria-label="ปิดผลค้นหา"
                      onClick={() => setSearchOpen(false)}
                    >
                      <MapIcon name="close" size={16} />
                    </button>
                  )}
                  {searchOpen && (
                    <div className="mi-search-results">
                      <b>
                        {query ? "ผลการค้นหาในพื้นที่" : "เลือกจุดบนแผนที่"}
                      </b>
                      {results.length ? (
                        results.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => selectFromList(p)}
                            onKeyDown={(event) => {
                              const buttons = Array.from(
                                event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                                  "button",
                                ),
                              );
                              const current = buttons.indexOf(
                                event.currentTarget,
                              );
                              if (
                                event.key === "ArrowDown" ||
                                event.key === "ArrowUp"
                              ) {
                                event.preventDefault();
                                buttons[
                                  (current +
                                    (event.key === "ArrowDown" ? 1 : -1) +
                                    buttons.length) %
                                    buttons.length
                                ]?.focus();
                              }
                              if (event.key === "Escape") {
                                document
                                  .querySelector<HTMLInputElement>(
                                    ".mi-search input",
                                  )
                                  ?.focus();
                                setSearchOpen(false);
                              }
                            }}
                          >
                            <MapIcon name="location" size={15} />
                            <span>{p.label}</span>
                            <b>{formatValue(pointValue(p, index, metric))}</b>
                          </button>
                        ))
                      ) : (
                        <p>
                          {loading
                            ? "กำลังค้นหาจุดข้อมูล…"
                            : "ไม่พบจุด ลองเลือกจังหวัดอื่น"}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <button
                  className="mi-options-button"
                  aria-label="ตัวเลือกแผนที่และจังหวัด"
                  aria-expanded={optionsOpen}
                  onClick={() => setOptionsOpen(!optionsOpen)}
                >
                  <MapIcon name="layers" />
                </button>
              </div>
              {optionsOpen && (
                <div
                  className="mi-options"
                  role="dialog"
                  aria-label="ตัวเลือกแผนที่"
                  tabIndex={-1}
                >
                  <div>
                    <h2>ตัวเลือกแผนที่</h2>
                    <button
                      aria-label="ปิดตัวเลือก"
                      onClick={() => setOptionsOpen(false)}
                    >
                      <MapIcon name="close" size={18} />
                    </button>
                  </div>
                  <label>
                    พื้นที่
                    <select
                      aria-label="เลือกจังหวัด"
                      value={province}
                      onChange={(e) => {
                        setProvince(e.target.value as RegionId);
                        setSelected(null);
                        setCompareKey(null);
                        setPlaying(false);
                      }}
                    >
                      <option value="metro">
                        กรุงเทพฯ และปริมณฑล (6 จังหวัด)
                      </option>
                      {provinces.map((p) => (
                        <option value={p.id} key={p.id}>
                          {p.nameTh}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="mi-check">
                    <input
                      type="checkbox"
                      checked={showValues}
                      onChange={(e) => setShowValues(e.target.checked)}
                    />
                    แสดงค่าที่จุดข้อมูล
                  </label>
                  <label className="mi-check">
                    <input
                      type="checkbox"
                      checked={showPlaceNames}
                      onChange={(e) => setShowPlaceNames(e.target.checked)}
                    />
                    ชื่อจังหวัดและเขต
                  </label>
                  <label className="mi-check">
                    <input
                      type="checkbox"
                      checked={satellite}
                      onChange={(e) => setSatellite(e.target.checked)}
                    />
                    ภาพถ่ายดาวเทียม
                  </label>
                  <label className="mi-check">
                    <input
                      type="checkbox"
                      checked={
                        weatherMotion &&
                        !reducedMotion &&
                        mode !== "observation"
                      }
                      disabled={reducedMotion || mode === "observation"}
                      onChange={(e) => setWeatherMotion(e.target.checked)}
                    />
                    อนิเมชันสภาพอากาศ
                  </label>
                  <p>
                    อนิเมชันเป็นภาพประกอบตามข้อมูลพยากรณ์
                    ไม่ใช่ภาพเรดาร์หรือทิศทางลมตรวจวัด
                  </p>
                  {mode === "estimate" && (
                    <label className="mi-opacity-control">
                      ความเข้มพื้นผิว IDW{" "}
                      <output>{Math.round(surfaceOpacity * 100)}%</output>
                      <input
                        type="range"
                        min="0.2"
                        max="0.95"
                        step="0.01"
                        value={surfaceOpacity}
                        onChange={(e) =>
                          setSurfaceOpacity(Number(e.target.value))
                        }
                      />
                    </label>
                  )}
                  <p>
                    {layer === "air"
                      ? "พยากรณ์รายวันและจุดประมาณจากแบบจำลอง ไม่ใช่ค่าตรวจวัดทุกจุด"
                      : "แสดงจุดตัวอย่างของแบบจำลอง ไม่ใช่สถานีตรวจวัด"}
                  </p>
                  <a href={`/${layer}/advanced?province=${province}`}>
                    เครื่องมือขั้นสูง{layer === "rain" ? " / เรดาร์ TMD" : ""}{" "}
                    <MapIcon name="arrow" size={15} />
                  </a>
                  <button onClick={() => setRefresh((n) => n + 1)}>
                    <MapIcon name="refresh" size={16} />
                    โหลดข้อมูลล่าสุด
                  </button>
                </div>
              )}
              <div id="map-data-controls" className="mi-mode-row">
                <div className="mi-data-modes" aria-label="ชนิดข้อมูล">
                  {(layer === "air"
                    ? (["observation", "forecast", "estimate"] as DataMode[])
                    : (["forecast", "estimate"] as DataMode[])
                  ).map((item) => (
                    <button
                      key={item}
                      aria-pressed={mode === item}
                      aria-label={
                        item === "estimate"
                          ? "ประมาณเชิงพื้นที่ IDW"
                          : modeLabels[item]
                      }
                      onClick={() => changeMode(item)}
                    >
                      {item === "estimate" ? "IDW" : modeLabels[item]}
                    </button>
                  ))}
                </div>
                {layer !== "air" && (
                  <select
                    aria-label="ตัวชี้วัดบนแผนที่"
                    value={metric}
                    onChange={(e) => {
                      setMetric(e.target.value as Metric);
                      setLegend(null);
                    }}
                  >
                    <option value="primary">
                      {metricName(layer, "primary")}
                    </option>
                    <option value="secondary">
                      {metricName(layer, "secondary")}
                    </option>
                  </select>
                )}
              </div>
              <div className="mi-map-caption">
                <span>
                  <b>
                    {layerInfo[layer].name} · {activeType}
                  </b>
                  <small>
                    {step?.date
                      ? `${relativeDay(step.date)} · ${step.label}`
                      : mode === "observation"
                        ? "ตรวจวัดล่าสุดที่มีข้อมูล"
                        : "กำลังตรวจสอบช่วงเวลา"}
                  </small>
                </span>
                <span className="mi-place-chip">
                  {getRegion(province).shortNameTh}
                </span>
              </div>
            </div>
            <div className="mi-map-bottom">
              <div className="mi-story-map-reading">
                <div>
                  <span>{selected ? "ตำแหน่งที่เลือก" : "ภาพรวมพื้นที่"}</span>
                  <b>
                    {formatValue(currentValue)}{" "}
                    <small>
                      {metric === "primary"
                        ? layerInfo[layer].unit
                        : layerInfo[layer].secondaryUnit}
                    </small>
                  </b>
                  <p>{interpretation(layer, metric, currentValue)}</p>
                </div>
                <button onClick={() => goToStory("location-story")}>
                  ดูรายละเอียด <MapIcon name="arrow" size={18} />
                </button>
              </div>
              <div className="mi-story-map-guide">
                <span>แตะดูค่า · เปิดเต็มจอเพื่อลากแผนที่</span>
                <button onClick={enterExplore}>
                  <MapIcon name="expand" size={17} />
                  เปิดเต็มจอ
                </button>
              </div>
              {mode === "estimate" && (
                <div className="mi-surface-label">
                  <span />
                  พื้นผิว IDW · พยากรณ์เชิงพื้นที่
                  {weatherMotion && !reducedMotion && (
                    <small>อนิเมชันประกอบ ไม่ใช่เรดาร์</small>
                  )}
                </div>
              )}
              <div className="mi-map-actions">
                {top && (
                  <button
                    className="mi-peak-button"
                    onClick={() => selectFromList(top)}
                  >
                    <span className="mi-peak-dot" />
                    <span>ดูจุดค่าสูงสุด</span>
                    <MapIcon name="arrow" size={15} />
                  </button>
                )}
                {mode !== "observation" && (
                  <button
                    className="mi-compare-button"
                    aria-pressed={compareKey !== null}
                    disabled={!data?.steps.length}
                    onClick={() =>
                      setCompareKey(compareKey ? null : (step?.key ?? null))
                    }
                  >
                    <MapIcon name="compare" size={17} />
                    {compareKey ? "เลิกเปรียบเทียบ" : "เปรียบเทียบเวลา"}
                  </button>
                )}
              </div>
              {compareKey && (
                <div className="mi-compare-hint">
                  ตรึง{" "}
                  {data?.steps[compare]?.date
                    ? relativeDay(data.steps[compare].date)
                    : ""}{" "}
                  {data?.steps[compare]?.label} · เลือกอีกช่วงบนเส้นเวลา
                </div>
              )}
              <MapLegend
                layer={layer}
                metric={metric}
                active={legend}
                onChange={setLegend}
              />
            </div>
          </section>
          <ForecastTimeline
            scope={
              selected
                ? spatialSelection
                  ? "ตำแหน่งบนพื้นผิว IDW"
                  : (selected.label ?? point?.label ?? "ตำแหน่งที่เลือก")
                : `ภาพรวม${getRegion(province).shortNameTh}`
            }
            data={data}
            index={index}
            onChange={changeTime}
            playing={playing}
            animationAllowed={!reducedMotion}
            onPlay={() => {
              if (!reducedMotion) setPlaying((p) => !p);
            }}
            mode={mode}
            values={values}
            metric={metric}
          />
          <LocationPanel>
            <LocationInsight
              layer={layer}
              values={values}
              spatialSelection={spatialSelection}
              data={data}
              point={point}
              selected={selected}
              index={index}
              metric={metric}
              mode={mode}
              onTime={changeTime}
              onSelect={selectFromList}
              compare={compare < 0 ? null : compare}
              onClear={() => setSelected(null)}
            />
          </LocationPanel>
        </div>
        <footer className="mi-footer">
          <DataStatus data={data} mode={mode} loading={loading} step={step} />
          <span>
            {reducedMotion
              ? "ลดการเคลื่อนไหว: เลื่อนเวลาเองได้"
              : mode === "estimate"
                ? "สีต่อเนื่องเป็นการประมาณ ไม่ใช่ความละเอียดของสถานี"
                : "เลือกจุดเพื่อดูแนวโน้มและแหล่งข้อมูล"}
          </span>
        </footer>
      </div>
    </MapShell>
  );
}
