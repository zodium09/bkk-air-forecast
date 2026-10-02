"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import EnvironmentMap from "../components/intelligence/environment-map";
import { MapIcon } from "../components/intelligence/map-ui";
import ThemeToggle from "../components/theme-toggle";
import type {
  SurveillanceEvent,
  SurveillanceHazard,
  SurveillanceSeverity,
  SurveillanceSignalKind,
  SurveillanceSnapshot,
} from "../lib/surveillance";
import type { MapPoint } from "../lib/map-intelligence";
import { acknowledgementKey, isRevisionAcknowledged, compareSurveillanceEvents, surveillanceAreas } from "../lib/surveillance";
import "../components/intelligence/map-workspace.css";
import "../components/intelligence/night-theme.css";
import "./surveillance.css";

const hazardLabels: Record<SurveillanceHazard, string> = {
  rain: "ฝน",
  heat: "ความร้อน",
  pm25: "PM2.5",
};
const signalLabels: Record<SurveillanceSignalKind, string> = {
  official: "ประกาศ (fixture)",
  app_forecast: "สัญญาณพยากรณ์",
  app_observation: "สัญญาณตรวจวัด",
  data_quality: "ปัญหาข้อมูล",
};
const severityLabels: Record<SurveillanceSeverity, string> = {
  advisory: "ติดตาม",
  watch: "เฝ้าระวัง",
  warning: "เร่งด่วน",
  unknown: "ยังประเมินไม่ได้",
};
const statusLabels = {
  pending: "รอยืนยัน",
  active: "กำลังติดตาม",
  resolved: "คลี่คลายตามกฎ",
  expired: "พ้นช่วงมีผล",
  withdrawn: "ถอนข้อมูล",
  cancelled: "ยกเลิก",
} as const;
const severityColors: Record<SurveillanceSeverity, string> = {
  advisory: "#38bdf8",
  watch: "#f59e0b",
  warning: "#f97316",
  unknown: "#94a3b8",
};
const severityRanks: Record<SurveillanceSeverity, number> = {
  unknown: 5,
  advisory: 20,
  watch: 50,
  warning: 80,
};

function formatDateTime(value: string | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function formatInterval(from: string, to: string) {
  return `${formatDateTime(from)} – ${formatDateTime(to)} น.`;
}

function eventMarkerLabel(event: SurveillanceEvent) {
  if (event.signalKind === "data_quality") return "QC";
  if (event.hazard === "rain") return "ฝน";
  if (event.hazard === "heat") return "HI";
  if (event.hazard === "pm25") return "PM";
  return "QC";
}

function SummaryCard({ label, value, note, tone }: { label: string; value: number; note: string; tone: string }) {
  return (
    <article className={`sw-summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{new Intl.NumberFormat("th-TH").format(value)}</strong>
      <small>{note}</small>
    </article>
  );
}

function EventListItem({ event, selected, acknowledged, onSelect }: { event: SurveillanceEvent; selected: boolean; acknowledged: boolean; onSelect: () => void }) {
  return (
    <button className="sw-event-item" aria-pressed={selected} onClick={onSelect}>
      <span className={`sw-hazard sw-hazard-${event.hazard}`}>{hazardLabels[event.hazard]}</span>
      <span className={`sw-severity sw-severity-${event.severity}`}><i aria-hidden="true" />{severityLabels[event.severity]}</span>
      <strong>{event.title}</strong>
      <span className="sw-event-area">{event.area.name} · {signalLabels[event.signalKind]}</span>
      <small>{event.status === "active" ? formatInterval(event.validFrom, event.validTo) : statusLabels[event.status]}</small>
      <span className={`sw-ack-state ${acknowledged ? "done" : ""}`}>{acknowledged ? "รับทราบฉบับนี้แล้ว" : event.status !== "active" ? "ประวัติ" : "รอรับทราบ"}</span>
    </button>
  );
}

function EventDetail({ event, acknowledged, onAcknowledge }: { event: SurveillanceEvent; acknowledged: boolean; onAcknowledge: () => void }) {
  return (
    <aside className="sw-detail" id="event-detail" tabIndex={-1} aria-label="รายละเอียดเหตุที่เลือก">
      <div className="sw-detail-heading">
        <div><span>{signalLabels[event.signalKind]} · revision {event.revision}</span><h2>{event.title}</h2></div>
        <span className={`sw-status sw-status-${event.status}`}>{statusLabels[event.status]}</span>
      </div>
      <p className="sw-detail-summary">{event.summary}</p>
      <div className="sw-detail-meta">
        <span><small>พื้นที่</small><b>{event.area.name}</b></span>
        <span><small>{event.leadHours === null ? "ช่วงตรวจพบ / มีผล" : "ช่วงคาดว่าจะเกิด"}</small><b>{formatInterval(event.validFrom, event.validTo)}</b></span>
        <span><small>ประเมินล่าสุด</small><b>{formatDateTime(event.evaluation?.evaluatedAt ?? event.updatedAt)} น.</b></span>
      </div>

      <section className="sw-evidence" aria-labelledby="sw-evidence-title">
        <div className="sw-section-heading"><span>หลักฐาน</span><h3 id="sw-evidence-title">ค่าที่ใช้ตัดสินใจ</h3></div>
        <div className="sw-evidence-grid">
          {event.evidence.map((item) => (
            <article key={`${event.id}-${item.label}`}>
              <span>{item.label}<i className={`sw-quality sw-quality-${item.quality}`} />{item.quality}</span>
              <strong>{item.value}</strong><small>{item.source}</small><small>{item.validInterval.split("/").map(formatDateTime).join(" – ")} น.</small>
            </article>
          ))}
        </div>
        {event.evaluation && <p className={`sw-evaluation sw-evaluation-${event.evaluation.result}`}>ผลประเมิน: <b>{event.evaluation.result}</b> · coverage {Math.round(event.evaluation.coverage * 100)}% · {event.evaluation.reasonCodes.join(", ")}</p>}
      </section>

      {event.rule ? (
        <details className="sw-rule">
          <summary>ดู rule contract · {event.rule.id}@{event.rule.version}</summary>
          <dl>
            <div><dt>Metric / unit</dt><dd>{event.rule.metric} · {event.rule.unit}</dd></div>
            <div><dt>ข้อมูล</dt><dd>{event.rule.datasetClass} · {event.rule.sourceProduct}</dd></div>
            <div><dt>Window</dt><dd>{event.rule.windowMinutes} นาที · persistence {event.rule.persistenceSamples} input</dd></div>
            <div><dt>Entry / exit</dt><dd>{event.rule.entryThreshold} / {event.rule.exitThreshold} {event.rule.unit}</dd></div>
            <div><dt>Coverage / freshness</dt><dd>{Math.round(event.rule.minimumCoverage * 100)}% · {event.rule.freshnessBudgetMinutes} นาที</dd></div>
            <div><dt>ที่มา</dt><dd>{event.rule.definitionSource}</dd></div>
          </dl>
        </details>
      ) : <div className="sw-official-note"><b>{event.source.issuer ?? "ไม่ระบุผู้ออกประกาศ"}</b><p>เลขประกาศ {event.source.bulletinId ?? "ไม่ระบุ"} · ฉบับ {event.revision}</p>{event.source.url ? <a href={event.source.url} target="_blank" rel="noreferrer">อ่านประกาศต้นทาง</a> : <span>ไม่มีต้นฉบับทางการ — เป็นข้อมูลจำลอง</span>}</div>}

      <section className="sw-timeline" aria-labelledby="sw-timeline-title">
        <div className="sw-section-heading"><span>ประวัติ</span><h3 id="sw-timeline-title">ลำดับเหตุการณ์</h3></div>
        <ol>
          {event.timeline.map((item) => <li key={item.id}><i aria-hidden="true" /><time dateTime={item.at}>{formatDateTime(item.at)} น.</time><b>{item.label}</b><p>{item.detail}</p></li>)}
          {acknowledged && !isRevisionAcknowledged(event) && <li><i aria-hidden="true" /><time>session ปัจจุบัน</time><b>รับทราบใน session ทดสอบ · ฉบับ {event.revision}</b><p>สถานะเหตุยังคงเดิมและข้อมูลนี้ไม่ถูกบันทึกที่ server</p></li>}
        </ol>
      </section>

      <div className="sw-detail-actions">
        <div><span>{acknowledged ? "รับทราบฉบับปัจจุบันแล้ว" : "ฉบับปัจจุบันยังไม่มีผู้รับทราบ"}</span><small>{event.acknowledgement.actor ? `ประวัติ: ${event.acknowledgement.actor} รับทราบฉบับ ${event.acknowledgement.eventRevision}` : "Shadow mode · ยังไม่มีระบบ actor/persistence"}</small></div>
        <button disabled={acknowledged || event.status !== "active"} onClick={onAcknowledge}>{acknowledged ? "รับทราบแล้ว" : "รับทราบใน session ทดสอบ"}</button>
      </div>
    </aside>
  );
}

export default function SurveillanceDashboard({ snapshot }: { snapshot: SurveillanceSnapshot }) {
  const [province, setProvince] = useState("all");
  const [hazard, setHazard] = useState<"all" | SurveillanceHazard>("all");
  const [signal, setSignal] = useState<"all" | SurveillanceSignalKind>("all");
  const [status, setStatus] = useState<"active" | "all">("active");
  const [selectedId, setSelectedId] = useState(snapshot.events.find((event) => event.status === "active")?.id ?? snapshot.events[0]?.id ?? "");
  const [sessionAcknowledged, setSessionAcknowledged] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");

  const filtered = useMemo(() => snapshot.events.filter((event) => {
    if (province !== "all" && event.area.id !== province) return false;
    if (hazard !== "all" && event.hazard !== hazard) return false;
    if (signal !== "all" && event.signalKind !== signal) return false;
    if (status === "active" && event.status !== "active") return false;
    return true;
  }).sort(compareSurveillanceEvents), [hazard, province, signal, snapshot.events, status]);
  const selected = filtered.find((event) => event.id === selectedId) ?? filtered[0] ?? null;
  const acknowledged = useCallback((event: SurveillanceEvent) => isRevisionAcknowledged(event, sessionAcknowledged), [sessionAcknowledged]);
  const active = filtered.filter((event) => event.status === "active");
  const activeAreas = new Set(active.map((event) => event.area.id)).size;
  const unacknowledged = active.filter((event) => !acknowledged(event)).length;
  const unavailableSources = snapshot.sources.filter((source) => source.status !== "fresh").length;
  const points = useMemo<MapPoint[]>(() => filtered.map((event) => ({ id: event.id, label: event.area.name, lat: event.area.lat, lng: event.area.lng, values: [severityRanks[event.severity]], secondary: [] })), [filtered]);
  const presentation = useCallback((point: MapPoint) => {
    const event = snapshot.events.find((item) => item.id === point.id)!;
    return { color: event.status === "resolved" ? "#10b981" : severityColors[event.severity], label: eventMarkerLabel(event), title: `${event.area.name}: ${event.title} · ${severityLabels[event.severity]}` };
  }, [snapshot.events]);
  const selectEvent = (event: SurveillanceEvent) => {
    setSelectedId(event.id);
    setAnnouncement(`เลือก ${event.area.name}: ${event.title}`);
    requestAnimationFrame(() => {
      const detail = document.getElementById("event-detail");
      detail?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 1100px)").matches) detail?.scrollIntoView({ block: "start" });
    });
  };
  const selectFromMap = (id?: string) => {
    const event = filtered.find((item) => item.id === id);
    if (event) selectEvent(event);
  };
  const acknowledgeSelected = () => {
    if (!selected || acknowledged(selected)) return;
    setSessionAcknowledged((current) => [...current, acknowledgementKey(selected)]);
    setAnnouncement(`รับทราบฉบับ ${selected.revision} ใน session นี้แล้ว สถานะเหตุยังคงเดิม`);
  };

  return (
    <main className="mi-shell sw-shell" style={{ "--mi-accent": "#df9b52" } as React.CSSProperties}>
      <a className="sw-skip" href="#surveillance-center">ข้ามไปศูนย์ติดตาม</a>
      <p className="sw-sr-only" role="status">{announcement}</p>
      <nav className="mi-rail sw-rail" aria-label="การนำทางหลัก">
        <Link className="mi-brand-mark" href="/" title="BKK Air Forecast หน้าหลัก"><MapIcon name="map" size={25} /></Link>
        <div className="mi-rail-main">
          <Link className="sw-rail-link" href="/air"><MapIcon name="air" size={22} /><span>PM2.5</span></Link>
          <Link className="sw-rail-link" href="/rain"><MapIcon name="rain" size={22} /><span>ฝน</span></Link>
          <Link className="sw-rail-link" href="/heat"><MapIcon name="heat" size={22} /><span>ร้อน</span></Link>
          <Link className="sw-rail-link active" href="/surveillance" aria-current="page"><MapIcon name="info" size={22} /><span>เฝ้าระวัง</span></Link>
        </div>
        <Link className="mi-rail-home" href="/"><MapIcon name="arrow" /><span>แผนที่</span></Link>
      </nav>

      <div className="mi-workspace sw-workspace">
        <header className="mi-header sw-header">
          <Link href="/" className="mi-brand"><b>BKK <span>AIR FORECAST</span></b><small>ศูนย์เฝ้าระวังสิ่งแวดล้อม</small></Link>
          <div className="mi-header-context"><span>กรุงเทพฯ + 5 จังหวัด</span><i /><span>เวลา ICT (UTC+7)</span></div>
          <div className="mi-header-actions"><ThemeToggle /><Link className="mi-overview-link" href="/">กลับแผนที่ <MapIcon name="arrow" size={16} /></Link></div>
        </header>

        <div className="sw-scroll">
          <section className="sw-titlebar">
            <div><h1>ศูนย์เฝ้าระวัง</h1><p>ติดตามเหตุในกรุงเทพฯ และปริมณฑล พร้อมหลักฐานประกอบการประเมิน</p><span className="sw-shadow-badge"><i />SHADOW MODE · ชุดสาธิต</span></div>
            <div className="sw-reference"><span>เวลาอ้างอิงชุดข้อมูลจำลอง</span><b>{formatDateTime(snapshot.generatedAt)} น.</b><small>ชุดข้อมูลคงที่สำหรับทดสอบ ไม่ใช่ข้อมูลล่าสุด</small></div>
          </section>

          <nav className="sw-tabs" aria-label="ส่วนของศูนย์เฝ้าระวัง">
            <a href="#surveillance-center">ศูนย์ติดตาม</a>
            <a href="#data-quality">คุณภาพข้อมูล</a>
            <a href="#situation-report">รายงานสถานการณ์</a>
          </nav>

          <div className="sw-disclaimer" role="status"><MapIcon name="info" size={18} /><b>ข้อมูลสังเคราะห์สำหรับทดสอบ workflow</b><span>{snapshot.disclaimer}</span></div>

          <section id="surveillance-center" tabIndex={-1} className="sw-summary" aria-label="สรุปเหตุการณ์ตามตัวกรอง">
            <SummaryCard label="เหตุที่กำลังติดตาม" value={active.length} note="ตามตัวกรองที่เลือก" tone="active" />
            <SummaryCard label="พื้นที่เกี่ยวข้อง" value={activeAreas} note="ในเหตุที่กำลังติดตาม" tone="area" />
            <SummaryCard label="รอรับทราบฉบับปัจจุบัน" value={unacknowledged} note="การรับทราบไม่เปลี่ยนสถานะเหตุ" tone="ack" />
            <SummaryCard label="แหล่งข้อมูลมีข้อจำกัด" value={unavailableSources} note="ทุกแหล่งในชุดข้อมูล" tone="quality" />
          </section>

          <section id="data-quality" tabIndex={-1} className="sw-freshness" aria-labelledby="sw-freshness-title">
            <div><h2 id="sw-freshness-title">สถานะแหล่งข้อมูล</h2><p>ณ เวลาอ้างอิงชุดสาธิต</p></div>
            <ul>{snapshot.sources.map((source) => <li key={source.id}><i className={`sw-source-${source.status}`} /><span><b>{source.label}</b><small>{source.note}</small><small>ข้อมูล {formatDateTime(source.validAt ?? undefined)} · ตรวจ {formatDateTime(source.checkedAt)} น.</small></span><em>{source.status === "fresh" ? "พร้อม" : source.status === "delayed" ? "ล่าช้า" : "ยังไม่เชื่อม"}</em></li>)}</ul>
          </section>

          <div className="sw-layout">
            <section className="sw-operations" aria-label="แผนที่และรายการเหตุการณ์">
              <div className="sw-filters">
                <label>พื้นที่<select aria-label="กรองพื้นที่เฝ้าระวัง" value={province} onChange={(event) => setProvince(event.target.value)}><option value="all">ทุกจังหวัด</option>{surveillanceAreas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label>หัวข้อ<select aria-label="กรองหัวข้อเฝ้าระวัง" value={hazard} onChange={(event) => setHazard(event.target.value as "all" | SurveillanceHazard)}><option value="all">ทุกหัวข้อ</option>{Object.entries(hazardLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <div className="sw-filter-buttons" role="group" aria-label="ชนิดสัญญาณ">
                  {(["all", "official", "app_forecast", "app_observation", "data_quality"] as const).map((item) => <button key={item} aria-pressed={signal === item} onClick={() => setSignal(item)}>{item === "all" ? "ทั้งหมด" : signalLabels[item]}</button>)}
                </div>
                <button className="sw-status-filter" aria-pressed={status === "all"} onClick={() => setStatus((current) => current === "active" ? "all" : "active")}>{status === "active" ? "แสดงประวัติ" : "เฉพาะเหตุที่ติดตาม"}</button>
              </div>

              <div className="sw-map-list">
                <section className="sw-map-card" aria-labelledby="sw-map-title">
                  <div className="sw-card-heading"><div><h2 id="sw-map-title">แผนที่เหตุที่เลือก</h2></div><small>จุดอ้างอิงจังหวัด ไม่ใช่ขอบเขตผลกระทบ</small></div>
                  <div className="sw-map-canvas">
                    <EnvironmentMap layer="air" mode="observation" points={points} index={0} metric="primary" province="metro" selected={selected ? { lat: selected.area.lat, lng: selected.area.lng } : null} onSelect={(point) => selectFromMap(point.id)} legend={null} degraded={false} satellite={false} showValues focus={0} weatherAnimation={false} showPlaceNames pointPresentation={presentation} />
                  </div>
                  <div className="sw-map-legend"><span><i className="watch" />เฝ้าระวัง</span><span><i className="advisory" />ติดตาม</span><span><i className="unknown" />ยังประเมินไม่ได้</span><span><i className="resolved" />คลี่คลาย</span></div>
                </section>

                <section className="sw-event-list" aria-labelledby="sw-list-title">
                  <div className="sw-card-heading"><div><h2 id="sw-list-title">คิวเหตุการณ์ <span>{filtered.length}</span></h2></div><small>เหตุที่ติดตามก่อน ตามระดับและช่วงมีผล</small></div>
                  <div className="sw-event-scroll">{filtered.length ? filtered.map((event) => <EventListItem key={event.id} event={event} selected={selected?.id === event.id} acknowledged={acknowledged(event)} onSelect={() => selectEvent(event)} />) : <div className="sw-empty"><MapIcon name="info" /><b>ยังไม่มีเหตุในตัวกรองนี้</b><span>ชุดสาธิตไม่ได้ยืนยันว่าสภาพอากาศปกติ</span><button onClick={() => { setProvince("all"); setHazard("all"); setSignal("all"); setStatus("active"); }}>ล้างตัวกรอง</button></div>}</div>
                </section>
              </div>
            </section>

            {selected ? <EventDetail event={selected} acknowledged={acknowledged(selected)} onAcknowledge={acknowledgeSelected} /> : <aside className="sw-detail sw-empty"><MapIcon name="info" /><b>ยังไม่มีเหตุให้แสดงรายละเอียด</b><span>ลองเปลี่ยนตัวกรอง หรือดูสถานะแหล่งข้อมูลด้านบน</span></aside>}
          </div>

          <section id="situation-report" tabIndex={-1} className="sw-report" aria-labelledby="sw-report-title">
            <div><h2 id="sw-report-title">รายงาน ณ {formatDateTime(snapshot.generatedAt)} น.</h2><p>ตามตัวกรอง: {province === "all" ? "ทุกจังหวัด" : surveillanceAreas.find((item) => item.id === province)?.name} · {hazard === "all" ? "ทุกหัวข้อ" : hazardLabels[hazard]} · {signal === "all" ? "ทุกชนิดสัญญาณ" : signalLabels[signal]} · {status === "all" ? "รวมประวัติ" : "กำลังติดตาม"}</p></div>
            <button onClick={() => window.print()}><MapIcon name="info" size={17} />พิมพ์รายงาน snapshot</button>
            <ul>{filtered.map((event) => <li key={event.id}><b>{event.area.name}</b><span>{hazardLabels[event.hazard]} · {event.title}</span><small>ฉบับ {event.revision} · {statusLabels[event.status]} · {severityLabels[event.severity]} · ผลประเมิน {event.currentAssessment}</small><small>{formatInterval(event.validFrom, event.validTo)}</small><small>แหล่งข้อมูล: {event.source.label}{event.source.issuer ? ` · ${event.source.issuer}` : ""}</small><small>{event.rule ? `กฎ: ${event.rule.id}@${event.rule.version} · coverage ${Math.round((event.evaluation?.coverage ?? 0) * 100)}%` : `ประกาศ: ${event.source.bulletinId ?? "ไม่มีต้นฉบับ"}`}</small>{event.evidence.map((item) => <small key={item.label}>{item.label}: {item.value} · {item.quality} · {item.source} · {item.validInterval}</small>)}<small>{acknowledged(event) ? "รับทราบฉบับปัจจุบันแล้ว" : "ฉบับปัจจุบันยังไม่มีการรับทราบ"} · {event.summary}</small></li>)}</ul>
            {!filtered.length && <p>ไม่มีเหตุที่ตรงตัวกรองในชุดสาธิตนี้</p>}
            <footer>SHADOW MODE · synthetic fixtures · ไม่มีการส่งแจ้งเตือนภายนอก · {snapshot.id}<br />เกณฑ์และเหตุทั้งหมดเป็นข้อมูลจำลอง การรับทราบใน session ไม่บันทึกลง server</footer>
          </section>
        </div>
      </div>
    </main>
  );
}
