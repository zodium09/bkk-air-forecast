"use client";
import {
  useState,
  type KeyboardEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  bangkokDate,
  formatValue,
  getLegend,
  layerInfo,
  metricName,
  modeLabels,
  relativeDay,
  interpretation,
  valueColor,
  type DataMode,
  type EnvironmentLayer,
  type MapDataset,
  type MapStep,
  type Metric,
} from "../../lib/map-intelligence";

/** Arrow navigation stays within the focused forecast group. */
function navigateForecast(
  event: KeyboardEvent<HTMLButtonElement>,
  onChange: (index: number) => void,
) {
  if (
    ![
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
    ].includes(event.key)
  )
    return;
  const buttons = Array.from(
    event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
      "button[data-time-index]:not(:disabled)",
    ),
  );
  const current = buttons.indexOf(event.target as HTMLButtonElement);
  if (current < 0) return;
  event.preventDefault();
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? buttons.length - 1
        : (current +
            (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) +
            buttons.length) %
          buttons.length;
  buttons[next].focus();
  onChange(Number(buttons[next].dataset.timeIndex));
}

export function goToStory(id: string) {
  const section = document.getElementById(id);
  let parent = section?.parentElement;
  while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
  if (section instanceof HTMLDetailsElement) section.open = true;
  section?.focus({ preventScroll: true });
  section?.scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
    block: "start",
  });
}

export function MapIcon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    radar: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 19 5"/><circle cx="12" cy="12" r="1"/></>,
    bell: <><path d="M6 8a6 6 0 0 1 12 0v5l2 3H4l2-3ZM10 20h4"/></>,
    water: <><path d="M3 6q2-3 4 0t4 0t4 0t4 0M3 12q2-3 4 0t4 0t4 0t4 0M3 18q2-3 4 0t4 0t4 0t4 0"/></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    map: (
      <>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" />
        <path d="M9 3v15M15 6v15" />
      </>
    ),
    warning: <><path d="m12 3 10 18H2Z" /><path d="M12 9v5M12 17v.1" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    chart: <><path d="M3 3v18h18M6 15l5-6 4 3 6-7" /></>,
    air: (
      <>
        <path d="M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h5a3 3 0 1 1-3 3" />
      </>
    ),
    rain: (
      <>
        <path d="M6 14a4 4 0 0 1 0-8 6 6 0 0 1 11-1 4.5 4.5 0 0 1 1 9M8 17l-1 3M13 17l-1 3M18 17l-1 3" />
      </>
    ),
    heat: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    location: (
      <>
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 10 6-10 6L2 9Zm-9 11 9 5 9-5M3 18l9 5 9-5" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    compare: (
      <>
        <path d="M3 7h18m-4-4 4 4-4 4M21 17H3m4-4-4 4 4 4" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7v.1" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    refresh: (
      <>
        <path d="M20 11a8 8 0 1 0-2 7M20 4v7h-7" />
      </>
    ),
    chevron: <path d="m6 14 6-6 6 6" />,
    play: <path d="m8 4 12 8-12 8Z" />,
    pause: <path d="M8 4v16M16 4v16" />,
    expand: <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />,
    contract: <path d="M3 8h5V3M21 8h-5V3M8 21v-5H3M16 21v-5h5" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.map}
    </svg>
  );
}
export function LayerSwitcher({
  layer,
  onChange,
  waterHref="/water",
}: {
  layer: EnvironmentLayer;
  onChange: (layer: EnvironmentLayer) => void;
  waterHref?: string;
}) {
  return (
    <div className="mi-layer-switch" aria-label="เลือกชั้นข้อมูลสิ่งแวดล้อม">
      {(["rain", "water", "air", "heat"] as const).map((item) => item === "water" ? <a key={item} className="ex-water-nav" href={waterHref}><MapIcon name="water"/><span>ระดับน้ำ</span></a> : (
        <button
          key={item}
          aria-pressed={layer === item}
          onClick={() => onChange(item)}
        >
          <MapIcon name={item} />
          <span>
            {item === "air" ? "ฝุ่น PM2.5" : item === "rain" ? "ฝน" : "ความร้อน"}
            <small>
              {item === "air" ? "คุณภาพอากาศ" : layerInfo[item].thai}
            </small>
          </span>
        </button>
      ))}
    </div>
  );
}
export function DataStatus({
  data,
  mode,
  loading,
  step,
}: {
  data: MapDataset | null;
  mode: DataMode;
  loading: boolean;
  step?: MapStep;
}) {
  const stamp =
    data?.timestamp && Number.isFinite(Date.parse(data.timestamp))
      ? new Intl.DateTimeFormat("th-TH", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Bangkok",
        }).format(new Date(data.timestamp))
      : data?.timestamp;
  return (
    <div className="mi-data-status">
      <span
        className={`mi-status-dot ${data?.status === "live" ? "ready" : ""}`}
      />
      <div>
        <strong>
          {loading
            ? "กำลังเชื่อมต่อข้อมูล"
            : !data || data.status === "unavailable"
              ? "ข้อมูลไม่พร้อมใช้งาน"
              : data.status === "live"
                ? "แหล่งข้อมูลพร้อมใช้งาน"
                : "ข้อมูลบางส่วน / แหล่งสำรอง"}
        </strong>
        <span>
          {data?.valueMethod === "provider" ? "พยากรณ์จากต้นทาง" : modeLabels[mode]}
          {step?.sourceMode === "extrapolated" ? " · ขยายแนวโน้ม" : ""} ·{" "}
          {data ? `${data.timestampLabel} ${stamp}` : "รอตรวจสอบแหล่งข้อมูล"} ·
          ICT
        </span>
        {data && (
          <span className="mi-source-line" title={data.model}>
            {mode === "observation"
              ? "AirBKK / Air4Thai"
              : data.layer === "air"
                ? "CAMS Global"
                : data.quality.tmdStatus === "live"
                  ? "TMD + Open-Meteo"
                  : `Open-Meteo · ${data.quality.provider ?? "weather model"}`}{" "}
            · ยังไม่มี % ความมั่นใจที่ยืนยันได้
          </span>
        )}
      </div>
    </div>
  );
}
export function MapLegend({
  layer,
  metric,
  active,
  onChange,
}: {
  layer: EnvironmentLayer;
  metric: Metric;
  active: number | null;
  onChange: (index: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const bands = getLegend(layer, metric);
  const unit =
    metric === "primary"
      ? layerInfo[layer].unit
      : layerInfo[layer].secondaryUnit;
  return (
    <div className={`mi-legend ${open ? "expanded" : ""}`}>
      <button
        className="mi-legend-heading"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <b>{metricName(layer, metric)}</b>
        <span>
          {unit} <MapIcon name="chevron" size={14} />
        </span>
      </button>
      <div className="mi-legend-bands">
        {bands.map((band, index) => (
          <button
            key={index}
            className={active === index ? "active" : ""}
            onClick={() => onChange(active === index ? null : index)}
            aria-pressed={active === index}
            title={`${band.colorName ? `${band.colorName} · ` : ""}${band.label}: เน้นช่วงนี้`}
            aria-label={`${band.colorName ? `${band.colorName} · ` : ""}${band.label} ${unit}: เน้นช่วงนี้`}
          >
            <i style={{ background: band.color }} />
            <span>
              {layer === "air"
                ? ["0–15", "15–25", "25–37.5", "37.5–75", ">75"][index]
                : layer === "rain" && metric === "primary"
                  ? ["0–20", ">20–60", ">60–80", ">80"][index]
                  : band.label}
            </span>
          </button>
        ))}
      </div>
      <div className="mi-legend-detail">
        <p>{bands.map((b) => `${b.colorName ? `${b.colorName} ` : ""}${b.label}`).join(" · ")}</p>
        <span>○ ไม่มีข้อมูล · เส้นประ = ข้อมูลลดทอน</span>
        <small>แตะช่วงเพื่อเน้นพื้นที่ โดยยังเห็นบริบททั้งหมด</small>
      </div>
    </div>
  );
}
export function ForecastTimeline({
  data,
  index,
  onChange,
  playing,
  onPlay,
  animationAllowed,
  mode,
  values,
  metric,
  scope,
}: {
  data: MapDataset | null;
  index: number;
  onChange: (index: number) => void;
  playing: boolean;
  onPlay: () => void;
  animationAllowed: boolean;
  mode: DataMode;
  values: (number | null)[];
  metric: Metric;
  scope: string;
}) {
  const steps = data?.steps ?? [];
  const current = steps[index];
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
  const nowIndex = steps.findIndex(
    (s) =>
      s.date === bangkokDate() &&
      s.window !== null &&
      hour >= (s.startHour ?? 24) &&
      hour < (s.endHour ?? 0),
  );
  const tonightIndex = steps.findIndex(
    (s) => s.date === bangkokDate() && s.window !== null && s.startHour === 18,
  );
  const daily = steps
    .map((step, i) => ({ step, i }))
    .filter(({ step }) => step.window === null);
  const windows = steps
    .map((step, i) => ({ step, i }))
    .filter(({ step }) => step.day === current?.day);
  const max = Math.max(1, ...daily.map(({ i }) => values[i] ?? 0));
  const peak = daily.reduce<{ i: number; value: number } | null>(
    (best, { i }) =>
      values[i] !== null &&
      values[i] !== undefined &&
      (!best || values[i]! > best.value)
        ? { i, value: values[i]! }
        : best,
    null,
  );
  if (mode === "observation")
    return (
      <section
        id="forecast-story"
        tabIndex={-1}
        className="mi-timeline mi-observation-time"
      >
        <MapIcon name="info" />
        <div>
          <b>ตรวจวัดล่าสุดที่มีข้อมูล</b>
          <p>เวลาแต่ละสถานีอาจต่างกัน ดูเวลาที่วัดในรายละเอียดตำแหน่ง</p>
        </div>
      </section>
    );
  return (
    <section
      id="forecast-story"
      tabIndex={-1}
      className="mi-timeline"
      aria-label="เส้นเวลาพยากรณ์"
    >
      <div className="mi-story-section-title">
        <span>02 / วางแผนล่วงหน้า</span>
        <h2>วันไหนเหมาะกับแผนของคุณ</h2>
        <p>เลือกวันเพื่อเปลี่ยนข้อมูลบนแผนที่ สีแสดงระดับของแต่ละวัน</p>
      </div>
      <div className="mi-timeline-top">
        <div>
          <b>{current ? relativeDay(current.date) : "แนวโน้ม 7 วัน"}</b>
          <span>{current?.label ?? "รอข้อมูลเวลา"} · เวลากรุงเทพฯ</span>
        </div>
        <button
          className="mi-play"
          onClick={onPlay}
          disabled={steps.length < 2 || !animationAllowed}
          title={
            !animationAllowed ? "ลดการเคลื่อนไหว: เลื่อนเวลาเองได้" : undefined
          }
          aria-label={playing ? "หยุดเล่นพยากรณ์" : "เล่นพยากรณ์"}
          aria-pressed={playing}
        >
          <MapIcon name={playing ? "pause" : "play"} size={16} />
          <span>{playing ? "หยุด" : "เล่น"}</span>
        </button>
      </div>
      <p id="forecast-scope" className="mi-forecast-scope">
        {scope}
        {data
          ? ` · ${metricName(data.layer, metric)} (${metric === "primary" ? layerInfo[data.layer].unit : layerInfo[data.layer].secondaryUnit})`
          : ""}
      </p>
      <div
        className="mi-days"
        role="group"
        aria-label="เลือกวันพยากรณ์"
        aria-describedby="forecast-scope"
      >
        {daily.length ? (
          daily.map(({ step, i }) => (
            <button
              key={step.key}
              data-time-index={i}
              onKeyDown={(event) => navigateForecast(event, onChange)}
              onClick={() => onChange(i)}
              aria-label={`${relativeDay(step.date)} ${formatValue(values[i] ?? null)} ${data ? (metric === "primary" ? layerInfo[data.layer].unit : layerInfo[data.layer].secondaryUnit) : ""} ${data ? interpretation(data.layer, metric, values[i] ?? null) : ""}`}
              aria-pressed={step.day === current?.day}
              className={step.day === current?.day ? "active" : ""}
              style={
                {
                  "--day-color": data
                    ? valueColor(data.layer, metric, values[i] ?? null)
                    : "var(--mi-muted)",
                } as CSSProperties
              }
            >
              <span className="mi-day-full">{relativeDay(step.date)}</span>
              <span className="mi-day-short">
                {relativeDay(step.date) === "วันนี้" ||
                relativeDay(step.date) === "พรุ่งนี้"
                  ? relativeDay(step.date)
                  : `${Number(step.date.slice(8))}/${Number(step.date.slice(5, 7))}`}
              </span>
              <div className="mi-day-bar">
                <i
                  style={{
                    height: `${Math.max(4, ((values[i] ?? 0) / max) * 100)}%`,
                    opacity: values[i] === null ? 0.2 : 1,
                    background: "var(--day-color)",
                  }}
                />
              </div>
              <b>{formatValue(values[i] ?? null)}</b>
              <span className="mi-day-risk">
                <i />
                {data
                  ? interpretation(data.layer, metric, values[i] ?? null)
                  : "รอข้อมูล"}
              </span>
              <small>
                {peak?.i === i
                  ? "สูงสุดที่คาด"
                  : step.sourceMode === "extrapolated"
                    ? "ขยายแนวโน้ม"
                    : step.label}
              </small>
            </button>
          ))
        ) : (
          <p className="mi-empty-timeline">
            เส้นเวลาจะปรากฏเมื่อแหล่งข้อมูลพร้อม
          </p>
        )}
      </div>
      {windows.length > 1 && (
        <div className="mi-windows" role="group" aria-label="เลือกช่วงเวลา">
          {nowIndex >= 0 && (
            <button
              onClick={() => onChange(nowIndex)}
              title="พยากรณ์ช่วงปัจจุบัน ไม่ใช่ตรวจวัด"
            >
              ตอนนี้
            </button>
          )}
          {tonightIndex >= 0 && (
            <button onClick={() => onChange(tonightIndex)}>คืนนี้</button>
          )}
          {windows.map(({ step, i }) => (
            <button
              key={step.key}
              data-time-index={i}
              onKeyDown={(event) => navigateForecast(event, onChange)}
              aria-pressed={i === index}
              onClick={() => onChange(i)}
            >
              {step.label}
            </button>
          ))}
        </div>
      )}
      <div className="mi-scrubber">
        <input
          type="range"
          min={0}
          max={Math.max(0, steps.length - 1)}
          value={index}
          disabled={!steps.length}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="เลื่อนเวลาพยากรณ์"
          aria-valuetext={
            current
              ? `${relativeDay(current.date)} ${current.label}`
              : "รอข้อมูล"
          }
        />
        <span>
          {data ? metricName(data.layer, metric) : "ข้อมูลพยากรณ์"}
          {data?.layer === "air"
            ? " · รายวัน เริ่มพรุ่งนี้"
            : " · ตามช่วงเวลาที่แหล่งข้อมูลให้"}
        </span>
      </div>
      <div className="mi-story-time-action">
        <p role="status" aria-live={playing ? "off" : "polite"}>
          {current
            ? `${relativeDay(current.date)} · ${current.label} · ${formatValue(values[index] ?? null)}`
            : "กำลังตรวจสอบข้อมูลพยากรณ์"}
        </p>
        <button onClick={() => goToStory("map-story")}>
          <MapIcon name="map" size={18} />
          ดูช่วงที่เลือกบนแผนที่
        </button>
      </div>
      <details className="mi-keyboard-help">
        <summary>ใช้คีย์บอร์ดสำรวจ</summary>
        <p>
          Tab ไปยังวันหรือช่วงเวลา · ลูกศรเลือกช่วงก่อนหน้า / ถัดไป · Home / End
          ไปช่วงแรก / สุดท้าย · Enter หรือ Space เลือกปุ่ม ·
          บนแผนที่ใช้ลูกศรเลื่อนและ + / − ซูม · Esc ออกจากเต็มจอ
        </p>
      </details>
    </section>
  );
}
export function LocationPanel({ children }: { children: ReactNode }) {
  return (
    <aside
      id="location-story"
      tabIndex={-1}
      className="mi-insight"
      aria-label="ข้อมูลตำแหน่ง"
    >
      <div className="mi-story-section-title">
        <span>03 / รู้จักพื้นที่</span>
        <h2>เจาะรายละเอียดตำแหน่ง</h2>
      </div>
      <div className="mi-insight-scroll">{children}</div>
      <button
        className="mi-story-return"
        onClick={() => goToStory("map-story")}
      >
        <MapIcon name="map" size={18} />
        กลับไปเลือกพื้นที่บนแผนที่
      </button>
    </aside>
  );
}
export function MapLoadingState() {
  return (
    <div className="mi-map-message" role="status">
      <div className="mi-loading-lines">
        <i />
        <i />
        <i />
      </div>
      <b>กำลังโหลดข้อมูลแผนที่</b>
      <span>เลื่อนและซูมแผนที่ได้ระหว่างรอ</span>
    </div>
  );
}
export function MapErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="mi-map-message" role="status">
      <MapIcon name="info" />
      <b>{message}</b>
      <span>ไม่มีการแสดงค่าจำลองแทนข้อมูลที่ขาด</span>
      <button onClick={retry}>
        <MapIcon name="refresh" size={16} />
        โหลดข้อมูลอีกครั้ง
      </button>
    </div>
  );
}
export function MapShell({
  children,
  layer,
  exploring = false,
  mapFirst = false,
}: {
  children: ReactNode;
  layer: EnvironmentLayer;
  exploring?: boolean;
  mapFirst?: boolean;
}) {
  return (
    <main
      className={`mi-shell mi-layer-${layer} ${exploring ? "mi-exploring" : ""} ${mapFirst ? "mi-map-first" : ""}`}
      style={{ "--mi-accent": layerInfo[layer].accent } as CSSProperties}
    >
      {children}
    </main>
  );
}
