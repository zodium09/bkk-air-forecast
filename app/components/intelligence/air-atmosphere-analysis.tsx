"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { coldWindSignal, windDirectionLabel, type AtmosphereDay, type AtmospherePayload } from "../../lib/air-atmosphere";
import { addDays } from "../../lib/forecast/timestamps";
import { formatValue, relativeDay } from "../../lib/map-intelligence";
import { getProvince, getRegion, type RegionId } from "../../lib/provinces";
import { placeLabel, type MapPlace } from "../../lib/map-places";
import { useLiveResource } from "./use-live-resource";
import { MapIcon } from "./map-ui";

type Factor = "windKmh" | "mixingHeightM" | "rainMm" | "humidityPct";
type ColdMetric = "morningMinC" | "pressureHpa" | "windKmh";
type PlotPoint = { key: string; label: string; value: number | null };
const factors: { key: Factor; title: string; unit: string; color: string; explanation: string }[] = [
  { key: "windKmh", title: "ความเร็วลม", unit: "กม./ชม.", color: "#007a61", explanation: "ลมช่วยพัดพาและกระจายฝุ่น แต่ทิศลมอาจพาอากาศจากพื้นที่อื่นเข้ามาได้ด้วย" },
  { key: "mixingHeightM", title: "ชั้นอากาศผสม", unit: "ม.", color: "#0862d8", explanation: "ชั้นอากาศผสมที่ตื้นจำกัดพื้นที่ให้ฝุ่นกระจายตัวในแนวดิ่ง ค่านี้มาจากแบบจำลอง ไม่ใช่ผลตรวจการผกผันอุณหภูมิ" },
  { key: "rainMm", title: "ฝนสะสม", unit: "มม.", color: "#7142c4", explanation: "ฝนอาจช่วยชะล้างฝุ่นได้ แต่ประสิทธิภาพขึ้นกับความแรงและระยะเวลาของฝน ฝนน้อยไม่ได้รับประกันว่าฝุ่นจะลด" },
  { key: "humidityPct", title: "ความชื้น", unit: "%", color: "#a84b08", explanation: "ความชื้นเกี่ยวข้องกับการเติบโตของอนุภาคและสภาพหมอก ต้องอ่านร่วมกับลมและชั้นอากาศ ไม่ใช้ชี้ว่าฝุ่นจะเพิ่มโดยลำพัง" },
];

/** Source values, broken lines for gaps and explicit non-zero axes for temperature/pressure. */
function WeatherChart({ points, title, unit, active, color, onSelect, zoom = false }: { points: PlotPoint[]; title: string; unit: string; active: string; color: string; onSelect: (key: string) => void; zoom?: boolean }) {
  const scroll = useRef<HTMLDivElement>(null);
  const valid = points.flatMap(p => p.value === null ? [] : [p.value]);
  const low = valid.length ? Math.min(...valid) : 0, high = valid.length ? Math.max(...valid) : 1;
  const padding = Math.max((high - low) * .2, unit === "hPa" ? 1 : 2);
  const minimum = zoom ? Math.floor(low - padding) : Math.min(0, Math.floor(low));
  const maximum = unit === "%" ? 100 : Math.max(minimum + 1, Math.ceil(high + padding));
  const x = (index: number) => 80 + index * 644 / Math.max(1, points.length - 1);
  const y = (value: number) => 174 - (value - minimum) / (maximum - minimum) * 140;
  const segments: { value: number; index: number }[][] = [[]];
  points.forEach((point, index) => { if (point.value === null) segments.push([]); else segments.at(-1)!.push({ value: point.value, index }); });
  const reading = points.find(p => p.key === active);
  useEffect(() => {
    const item = scroll.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (item && points.length > 12) {
      const box = scroll.current!.getBoundingClientRect(), target = item.getBoundingClientRect();
      const offset = target.left < box.left ? target.left - box.left : target.right > box.right ? target.right - box.right : 0;
      if (offset) scroll.current!.scrollBy({ left: offset, behavior: "instant" });
    }
  }, [active, points.length]);
  return <div className="aa-chart" style={{ "--aa-plot-color": color } as CSSProperties}>
    <div className="aa-chart-readout"><span>{reading?.label ?? title}</span><strong>{formatValue(reading?.value ?? null)} <small>{unit}</small></strong></div>
    <div className="aa-chart-scroll" ref={scroll} role="region" aria-label={`${title}${points.length > 12 ? " เลื่อนแนวนอนเพื่อดูทุกชั่วโมง" : ""}`} tabIndex={points.length > 12 ? 0 : undefined}>
      <div className={`aa-chart-inner${points.length > 12 ? " is-dense" : ""}`} style={points.length > 12 ? { minWidth: points.length * 42 } : undefined}>
        <svg viewBox="0 0 760 210" role="img" aria-label={`${title} · ${valid.length} ช่วงที่มีข้อมูล · ${unit}${zoom ? " · แกนตั้งแสดงช่วงค่าที่มีข้อมูล" : ""}`}>
          {[minimum, (minimum + maximum) / 2, maximum].map(value => <g key={value}><line x1="80" x2="724" y1={y(value)} y2={y(value)} className="aa-grid"/><text x="70" y={y(value) + 4} textAnchor="end">{formatValue(value)}</text></g>)}
          {segments.filter(segment => segment.length).map((segment, i) => <path key={i} d={segment.map((p, j) => `${j ? "L" : "M"}${x(p.index)},${y(p.value)}`).join(" ")} fill="none" stroke="var(--aa-plot-color)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>)}
          {points.map((point, i) => point.value === null ? <text key={point.key} x={x(i)} y="190" textAnchor="middle">—</text> : <g key={point.key}>{point.key === active && <line x1={x(i)} x2={x(i)} y1="25" y2="181" className="aa-selected-line"/>}<circle cx={x(i)} cy={y(point.value)} r={point.key === active ? 6 : 3.5} fill="var(--aa-plot-color)" stroke="var(--ov-paper)" strokeWidth="2"/></g>)}
        </svg>
        <div className="aa-chart-dates" style={{ gridTemplateColumns: `repeat(${Math.max(1, points.length)},minmax(0,1fr))` }}>{points.map(point => <button key={point.key} aria-pressed={point.key === active} aria-label={`${title} ${point.label} ${formatValue(point.value)} ${unit}`} onClick={() => onSelect(point.key)}>{point.label}</button>)}</div>
      </div>
    </div>
    {!valid.length && <p className="aa-empty">ยังไม่มีข้อมูลที่ใช้วาดกราฟได้</p>}
    <p className="aa-chart-note">แตะวันที่หรือเวลาเพื่ออ่านค่า · — คือไม่มีข้อมูล{zoom && " · แกนตั้งขยายช่วงเพื่อให้เห็นการเปลี่ยนแปลง"}</p>
    <details className="aa-table"><summary>ดูค่ากราฟเป็นตาราง</summary><div><table><caption>{title} ({unit})</caption><thead><tr><th>วันที่ / เวลา</th><th>ค่า ({unit})</th></tr></thead><tbody>{points.map(point => <tr key={point.key}><th scope="row">{point.label}</th><td>{formatValue(point.value)}</td></tr>)}</tbody></table></div></details>
  </div>;
}

function WindCompass({ day }: { day?: AtmosphereDay }) {
  const direction = day?.windFromDeg ?? null;
  return <figure className="aa-wind-compass">
    <svg viewBox="0 0 220 220" role="img" aria-label={`ลมพัดมาจาก${windDirectionLabel(direction)} ความเร็วเฉลี่ย ${formatValue(day?.windKmh ?? null)} กิโลเมตรต่อชั่วโมง`}>
      <circle cx="110" cy="110" r="76" fill="none" className="aa-compass-circle"/><circle cx="110" cy="110" r="52" fill="none" className="aa-compass-circle inner"/>
      <path d="M110 29v15M110 176v15M29 110h15M176 110h15" className="aa-compass-ticks"/>
      <text x="110" y="20" textAnchor="middle">เหนือ</text><text x="110" y="211" textAnchor="middle">ใต้</text><text x="9" y="114">ตต.</text><text x="211" y="114" textAnchor="end">ตอ.</text>
      {direction !== null ? <g key={direction} transform={`rotate(${direction + 180},110,110)`} className="aa-wind-arrow"><path d="M110 158V64M94 81l16-17 16 17" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/></g> : <text x="110" y="118" textAnchor="middle" className="aa-compass-missing">—</text>}
    </svg>
    <figcaption><span>{direction === null ? "ลมสงบ ทิศแปรปรวน หรือข้อมูลไม่ครบ" : `พัดมาจากทิศ${windDirectionLabel(direction)}`}</span><strong>{formatValue(day?.windKmh ?? null)} <small>กม./ชม.</small></strong><small>ความเร็วเฉลี่ยที่ระดับ 10 ม. · ลูกศรชี้ไปทางที่ลมพัด</small></figcaption>
  </figure>;
}

export default function AirAtmosphereAnalysis({ region, selected, date, today, refresh, pmValue, previousPm, pmStatus, onDate, onRetry }: {
  region: RegionId; selected: MapPlace | null; date: string; today: string; refresh: number;
  pmValue: number | null; previousPm: number | null; pmStatus?: string; onDate: (date: string) => void; onRetry: () => void;
}) {
  const [factor, setFactor] = useState<Factor>("windKmh");
  const [hourly, setHourly] = useState(false);
  const [hour, setHour] = useState(12);
  const [coldMetric, setColdMetric] = useState<ColdMetric>("morningMinC");
  const center = selected ?? getProvince(region).center;
  const params = new URLSearchParams({ province: region });
  if (selected) { params.set("lat", String(Math.round(center.lat * 50) / 50)); params.set("lng", String(Math.round(center.lng * 50) / 50)); }
  const weather = useLiveResource<AtmospherePayload>(`/api/air-atmosphere?${params}`, refresh, 900000);
  const data = weather.data;
  const day = data?.days.find(d => d.date === date);
  const previous = data?.days.find(d => d.date === addDays(date || "2000-01-01", -1));
  const upcoming = data?.days.filter(d => d.date >= today) ?? [];
  const signal = coldWindSignal(day, previous);
  const candidate = upcoming.find(d => coldWindSignal(d, data?.days.find(p => p.date === addDays(d.date, -1))).status === "signal");
  const assessedColdDays = upcoming.filter(d => coldWindSignal(d, data?.days.find(p => p.date === addDays(d.date, -1))).status !== "unknown").length;
  const currentFactor = factors.find(f => f.key === factor)!;
  const dayHours = data?.hours.filter(h => h.time.startsWith(date)) ?? [];
  const selectedTime = `${date}T${String(hour).padStart(2, "0")}:00`;
  const points: PlotPoint[] = hourly ? dayHours.map(h => ({ key: h.time, label: `${h.time.slice(11, 16)}`, value: h[factor] })) : upcoming.map(d => ({ key: d.date, label: relativeDay(d.date, today), value: d[factor] }));
  const trend = pmValue === null || previousPm === null ? null : pmValue - previousPm;
  const forecastDate = date ? relativeDay(date, today) : "รอวันที่พยากรณ์";
  const scope = selected ? `${placeLabel(selected)} · กริดแบบจำลองใกล้จุดอ้างอิง` : `${getRegion(region).shortNameTh} · จุดอ้างอิงกลาง${region === "metro" ? "กรุงเทพฯ" : "จังหวัด"}`;
  const limited = data?.status === "unavailable" || weather.error;
  const ventilation = !day || day.stagnantHours === null ? "ข้อมูลยังไม่พออ่านการกระจายฝุ่น" : day.stagnantHours >= 6 ? "มีช่วงลมอ่อนและชั้นอากาศตื้น" : day.windKmh !== null && day.windKmh >= 18 ? "ลมค่อนข้างแรง ช่วยพัดพาอากาศ" : "สภาพลมและชั้นอากาศเปลี่ยนระหว่างวัน";
  const coldTitle = coldMetric === "morningMinC" ? "อุณหภูมิต่ำสุดช่วงเช้า 00:00–08:00" : coldMetric === "pressureHpa" ? "ความกดอากาศระดับน้ำทะเลเฉลี่ยรายวัน" : "ความเร็วลมเฉลี่ยรายวัน";
  const coldUnit = coldMetric === "morningMinC" ? "°C" : coldMetric === "pressureHpa" ? "hPa" : "กม./ชม.";
  const fetched = data?.fetchedAt ? new Intl.DateTimeFormat("th-TH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(data.fetchedAt)) : "รอข้อมูล";
  return <section className="aa-analysis" id="air-analysis" aria-labelledby="air-analysis-heading">
    <header className="aa-heading"><div><h3 id="air-analysis-heading">ทำไมฝุ่นถึงเปลี่ยน?</h3><p>อ่านฝุ่นคู่กับลม ฝน และการผสมตัวของอากาศ เพื่อเข้าใจแนวโน้มของย่านนี้</p></div><a className="ov-text-link" href="#cold-wind">ดูแนวโน้มลมหนาว<MapIcon name="arrow" size={17}/></a></header>
    <p className="aa-period"><MapIcon name="pin" size={16}/>{scope}<span>{forecastDate} · ปัจจัยอากาศตลอดวัน</span></p>
    {(weather.loading || limited || weather.refreshing) && <p className="aa-resource" role="status">{weather.loading ? "กำลังโหลดลมและสภาพอากาศจากแบบจำลอง…" : limited ? weather.error || "ต้นทางยังไม่มีปัจจัยอากาศที่ใช้วิเคราะห์ได้" : "กำลังโหลดข้อมูลอากาศรอบใหม่…"}{limited && <button onClick={onRetry}>ลองโหลดอีกครั้ง</button>}</p>}
    <div className="aa-explainer">
      <div className="aa-summary"><h4>{ventilation}</h4><p>{day?.stagnantHours != null ? day.stagnantHours === 0 ? <>ยังไม่พบลมไม่เกิน 5 กม./ชม. และชั้นอากาศผสมไม่เกิน 300 ม. พร้อมกันใน <strong>{day.mixingHours} ชั่วโมงที่มีข้อมูล</strong> แต่ยังมีปัจจัยอื่นที่ทำให้ฝุ่นสูงได้ จึงต้องอ่านค่าฝุ่นประกอบ</> : <>แบบจำลองมีช่วงลมไม่เกิน 5 กม./ชม. และชั้นอากาศผสมไม่เกิน 300 ม. พร้อมกัน <strong>{day.stagnantHours} จาก {day.mixingHours} ชั่วโมงที่มีข้อมูล</strong> ช่วงเหล่านี้อาจเอื้อต่อการสะสมฝุ่น หากยังมีการปล่อยมลพิษ</> : "ต้องมีค่าลมและชั้นอากาศในเวลาเดียวกันอย่างน้อย 18 ชั่วโมง จึงสรุปช่วงที่อาจสะสมฝุ่นได้"}</p>
        <div className="aa-pm-context"><span>เทียบพยากรณ์ฝุ่นกับวันก่อนหน้า</span><strong>{trend === null ? "ยังเทียบไม่ได้" : Math.abs(trend) < .05 ? "ค่าใกล้เคียงวันก่อน" : `${trend > 0 ? "เพิ่ม" : "ลด"} ${formatValue(Math.abs(trend))} µg/m³`}</strong><p>{trend === null ? "ยังไม่มีค่าฝุ่นรายวันครบทั้งสองวัน จึงไม่ใช้ค่าตรวจวัดคนละช่วงเวลามาแทน" : `จาก ${formatValue(previousPm)} เป็น ${formatValue(pmValue)} µg/m³ · เป็นแนวโน้มจากโมเดลฝุ่น${pmStatus !== "live" ? "ที่มีข้อมูลบางส่วน" : ""}`}</p></div>
        <p className="aa-causal-note">ปัจจัยอากาศช่วยอธิบายสภาพที่ฝุ่นอาจสะสมหรือกระจาย แต่ยังระบุแหล่งกำเนิดและสัดส่วนสาเหตุไม่ได้</p>
      </div><WindCompass day={day}/>
    </div>
    <div className="aa-factors" aria-label="เลือกปัจจัยอากาศบนกราฟ">{factors.map(item => <button key={item.key} aria-pressed={factor === item.key} className={`aa-factor aa-${item.key}`} onClick={() => setFactor(item.key)}><span>{item.title}</span><strong>{formatValue(day?.[item.key] ?? null)} <small>{item.unit}</small></strong><small>{item.key === "rainMm" ? "สะสม 00:00–24:00" : "ค่าเฉลี่ยรายวัน"}</small></button>)}</div>
    <div className="aa-plot-heading"><div><h4>{currentFactor.title}กับแนวโน้มฝุ่น</h4><p>{currentFactor.explanation}</p></div><div className="aa-switch" aria-label="เลือกความละเอียดปัจจัยอากาศ"><button aria-pressed={!hourly} onClick={() => setHourly(false)}>รายวัน</button><button aria-pressed={hourly} onClick={() => setHourly(true)}>รายชั่วโมง</button></div></div>
    <WeatherChart points={points} title={`${currentFactor.title}${hourly ? ` · ${forecastDate}` : factor === "rainMm" ? "รายวัน" : "เฉลี่ยรายวัน"}`} unit={currentFactor.unit} active={hourly ? selectedTime : date} color={currentFactor.color} onSelect={key => hourly ? setHour(Number(key.slice(11, 13))) : onDate(key)}/>
    <p className="aa-note">{hourly && factor === "rainMm" ? "ฝนรายชั่วโมงเป็นยอดสะสมในหนึ่งชั่วโมงก่อนเวลาที่ระบุ เช่น 14:00 หมายถึง 13:00–14:00" : "ค่าเฉลี่ยใช้ข้อมูลอย่างน้อย 18 จาก 24 ชั่วโมง ส่วนฝนสะสมทั้งวันต้องมีครบ 24 ชั่วโมง"} · ปัจจัยชุดนี้ใช้ GFS อาจต่างจากแบบจำลองในกราฟฝนและความร้อน</p>
    <section className="aa-cold" id="cold-wind" aria-labelledby="cold-wind-heading">
      <header className="aa-heading"><div><h3 id="cold-wind-heading">ลมหนาวจะมาหรือยัง?</h3><p>ติดตามลมฝ่ายเหนือ อุณหภูมิช่วงเช้า และความกดอากาศในช่วงพยากรณ์เดียวกัน</p></div><span className="aa-model-tag">แนวโน้มจากแบบจำลอง</span></header>
      <div className="aa-cold-verdict"><MapIcon name="air" size={32}/><div><strong>{signal.title}</strong><p>{forecastDate} · {candidate ? `พบวันเข้าเกณฑ์ในช่วงข้อมูล: ${relativeDay(candidate.date, today)}` : assessedColdDays ? `ประเมินได้ ${assessedColdDays} จาก ${upcoming.length} วัน ยังไม่พบวันเข้าเกณฑ์ครบ` : "กำลังรอข้อมูลครบทั้งสามปัจจัย"}</p></div></div>
      <div className="aa-cold-evidence"><div><span>ลมฝ่ายเหนือ</span><strong>{day?.northerlyFraction != null ? `${formatValue(day.northerlyFraction * 100)}%` : "—"}</strong><small>สัดส่วนชั่วโมงที่ลมมาจาก 315°–90° และเร็ว ≥5 กม./ชม.</small></div><div><span>อุณหภูมิเช้าเปลี่ยนจากวันก่อน</span><strong>{signal.cooling === null ? "—" : `${signal.cooling > 0 ? "ลด" : signal.cooling < 0 ? "เพิ่ม" : "คงที่"} ${formatValue(Math.abs(signal.cooling))} °C`}</strong><small>เทียบค่าต่ำสุดช่วง 00:00–08:00 ของสองวันติดกัน</small></div><div><span>ความกดอากาศเปลี่ยนจากวันก่อน</span><strong>{signal.pressureRise === null ? "—" : `${signal.pressureRise > 0 ? "+" : ""}${formatValue(signal.pressureRise)} hPa`}</strong><small>เทียบความกดอากาศระดับน้ำทะเลเฉลี่ยรายวัน</small></div></div>
      <div className="aa-plot-heading"><h4>แนวโน้มวันนี้และอีก 7 วัน</h4><div className="aa-switch" aria-label="เลือกกราฟลมหนาว">{(["morningMinC", "pressureHpa", "windKmh"] as const).map(metric => <button key={metric} aria-pressed={coldMetric === metric} onClick={() => setColdMetric(metric)}>{metric === "morningMinC" ? "อุณหภูมิเช้า" : metric === "pressureHpa" ? "ความกดอากาศ" : "ลม"}</button>)}</div></div>
      <WeatherChart points={upcoming.map(d => ({ key: d.date, label: relativeDay(d.date, today), value: d[coldMetric] }))} title={coldTitle} unit={coldUnit} active={date} color="#0862d8" zoom={coldMetric !== "windKmh"} onSelect={onDate}/>
      <div className="aa-cold-meaning"><h4>ลมหนาวเกี่ยวกับฝุ่นอย่างไร?</h4><p>ช่วงที่ลมแรงขึ้น อากาศอาจกระจายตัวได้มากขึ้น แต่เมื่อลมอ่อนลงและชั้นอากาศตื้น ฝุ่นอาจกลับมาสะสมได้ จึงควรดูทิศลมและชั้นอากาศร่วมกัน อากาศเย็นลงเพียงอย่างเดียวไม่ได้หมายความว่าฝุ่นจะลด</p></div>
      <details className="aa-method"><summary>เกณฑ์วิเคราะห์ลมหนาวและข้อจำกัด</summary><p>เกณฑ์ทดลองของแอปต้องพบพร้อมกัน: ลมฝ่ายเหนือที่เร็วอย่างน้อย 5 กม./ชม. ใน ≥50% ของชั่วโมงที่มีข้อมูล อุณหภูมิเช้าลด ≥2°C จากวันก่อน และความกดอากาศเฉลี่ยเพิ่ม ≥1.5 hPa จากวันก่อน ค่าเฉลี่ยต้องมีอย่างน้อย 18 ชั่วโมง และอุณหภูมิเช้าต้องครบ 9 ชั่วโมง</p><p>การเข้าเกณฑ์เป็นเพียงสัญญาณที่จุดกริดนี้ ไม่ยืนยันว่ามวลอากาศเย็นจากจีนมาถึง ไม่ประกาศเริ่มฤดูหนาว และไม่ใช่คำเตือนของกรมอุตุนิยมวิทยา ต้องตรวจแผนที่อากาศและพยากรณ์ระดับภูมิภาคเพิ่มเติม</p><p>ช่วงเวลาที่ระบุว่าสะสมฝุ่นใช้เกณฑ์ลม ≤5 กม./ชม. กับชั้นอากาศ ≤300 ม. ของแอป เป็นการอ่านปัจจัยร่วม ไม่ใช่ดัชนีการระบายอากาศ (VR) ของกรมอุตุฯ</p></details>
      <a className="ov-text-link" href="https://www.tmd.go.th/forecast/sevenday" target="_blank" rel="noreferrer">อ่านพยากรณ์ 7 วันจากกรมอุตุนิยมวิทยา<MapIcon name="arrow" size={17}/></a>
    </section>
    <footer className="aa-provenance"><p><strong>{data?.model ?? "NOAA GFS · Open-Meteo"}</strong> · โหลดข้อมูล {fetched} (เวลาไทย) · {weather.error ? "โหลดรอบใหม่ไม่สำเร็จ" : weather.loading ? "กำลังโหลด" : data?.status === "live" ? "ปัจจัยครบ" : data?.status === "degraded" ? "ข้อมูลบางส่วน" : "ยังไม่มีข้อมูล"}</p><p>เป็นพยากรณ์ระดับกริด ไม่ใช่สถานี ณ ถนนที่เลือก{data?.grid && ` · กริดต้นทาง ${data.grid.lat.toFixed(3)}, ${data.grid.lng.toFixed(3)}`} · ช่วงย้อนหลังเป็นข้อมูลจากแบบจำลอง</p><div><a href="https://open-meteo.com/en/docs/gfs-api" target="_blank" rel="noreferrer">แหล่งข้อมูล GFS / Open-Meteo</a><a href="https://ozone.tmd.go.th/PM2.5/dashboard/" target="_blank" rel="noreferrer">ฝุ่นและการระบายอากาศ กรมอุตุฯ</a><a href="https://acp.copernicus.org/articles/22/7681/2022/" target="_blank" rel="noreferrer">งานวิจัยเรื่องความชื้นกับอนุภาคฝุ่น</a></div></footer>
  </section>;
}
