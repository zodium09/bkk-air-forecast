"use client";
import {
  formatValue,
  interpretation,
  layerInfo,
  metricName,
  modeLabels,
  pointValue,
  relativeDay,
  valueColor,
  type DataMode,
  type EnvironmentLayer,
  type MapDataset,
  type MapPoint,
  type Metric,
} from "../../lib/map-intelligence";
import { MapIcon } from "./map-ui";

export default function LocationInsight({
  layer,
  data,
  point,
  selected,
  index,
  metric,
  mode,
  onTime,
  onSelect,
  compare,
  onClear,
  values,
  spatialSelection,
}: {
  layer: EnvironmentLayer;
  data: MapDataset | null;
  point: MapPoint | null;
  selected: { lat: number; lng: number; label?: string } | null;
  index: number;
  metric: Metric;
  mode: DataMode;
  onTime: (index: number) => void;
  onSelect: (point: MapPoint) => void;
  compare: number | null;
  onClear: () => void;
  values: (number | null)[];
  spatialSelection: boolean;
}) {
  const current = data?.steps[index];
  const unit =
    metric === "primary"
      ? layerInfo[layer].unit
      : layerInfo[layer].secondaryUnit;
  const valueAt = (i: number) => values[i] ?? null;
  const value = valueAt(index);
  const daily =
    data?.steps
      .map((step, i) => ({ step, i, value: valueAt(i) }))
      .filter((s) => s.step.window === null) ?? [];
  const next = daily.find((d) => d.step.day > (current?.day ?? -1));
  const max = Math.max(1, ...daily.map((d) => d.value ?? 0));
  const todayValues = (data?.steps ?? [])
    .map((step, i) => ({ step, value: valueAt(i) }))
    .filter(
      (s) =>
        s.step.day === current?.day &&
        s.step.window !== null &&
        s.value !== null,
    )
    .map((s) => s.value!);
  const topPoints = [...(data?.points ?? [])]
    .filter((p) => pointValue(p, index, metric) !== null)
    .sort(
      (a, b) => pointValue(b, index, metric)! - pointValue(a, index, metric)!,
    )
    .slice(0, 3);
  const label = spatialSelection
    ? "ตำแหน่งบนพื้นผิว IDW"
    : selected
      ? (selected.label ?? point?.label ?? "ตำแหน่งที่เลือก")
      : "ภาพรวมพื้นที่";
  const approximateSelection =
    point &&
    selected &&
    Math.hypot(point.lat - selected.lat, point.lng - selected.lng) > 0.0001;
  const delta =
    next?.value !== null && next?.value !== undefined && value !== null
      ? next.value - value
      : null;
  const compared = compare === null ? null : valueAt(compare);
  const deltaUnit =
    layer === "rain" && metric === "primary" ? "จุดเปอร์เซ็นต์" : unit;
  return (
    <>
      <div className="mi-insight-heading">
        <span>
          <MapIcon name="location" size={16} />
          {selected ? "ตำแหน่งที่เลือก" : "ภาพรวมกรุงเทพฯ–ปริมณฑล"}
        </span>
        {selected && (
          <button onClick={onClear} aria-label="ยกเลิกเลือกตำแหน่ง">
            <MapIcon name="close" size={16} />
          </button>
        )}
        <h2>{label}</h2>
        <p>
          {current
            ? `${current.date ? relativeDay(current.date) : "ล่าสุด"} · ${current.label}`
            : "เลือกตำแหน่งบนแผนที่เพื่อสำรวจ"}
        </p>
      </div>
      <div className="mi-condition">
        <span className="mi-risk-label">
          <i style={{ background: valueColor(layer, metric, value) }} />
          {interpretation(layer, metric, value)}
        </span>
        <div>
          <strong>{formatValue(value)}</strong>
          <span>
            {unit}
            <small>{metricName(layer, metric)}</small>
          </span>
        </div>
        <p>
          {spatialSelection
            ? value === null
              ? "ข้อมูลรอบตำแหน่งนี้ไม่เพียงพอ หรืออยู่นอกขอบเขตที่ยืนยันได้"
              : "ประมาณจากจุดรอบข้างด้วย IDW ไม่ใช่ค่าตรวจวัด ณ ตำแหน่งนี้"
            : approximateSelection
              ? `อ้างอิงจุดใกล้ที่สุด: ${point.label}`
              : selected && !point
                ? "ไม่พบจุดข้อมูลภายใน 20 กม. จึงไม่ประมาณค่าให้ตำแหน่งนี้"
                : !selected
                  ? "ค่าเฉลี่ยของจุดที่มีข้อมูลในพื้นที่ที่เลือก"
                  : mode === "observation"
                    ? "ค่าที่สถานีรายงานตามเวลาตรวจวัด"
                    : "ค่าจากแบบจำลอง ณ จุดนี้"}
        </p>
      </div>
      <div className="mi-interpretation">
        <MapIcon name="arrow" size={18} />
        <p>
          {delta === null
            ? mode === "observation"
              ? "เปลี่ยนเป็นพยากรณ์เพื่อสำรวจวันถัดไป"
              : "ยังไม่มีข้อมูลเพียงพอเพื่อเปรียบเทียบวันถัดไป"
            : `${next ? relativeDay(next.step.date) : "วันถัดไป"} คาดว่า${Math.abs(delta) < 0.5 ? "ใกล้เคียงเดิม" : delta > 0 ? "เพิ่มขึ้น" : "ลดลง"}${Math.abs(delta) >= 0.5 ? `ประมาณ ${formatValue(Math.abs(delta))} ${deltaUnit}` : ""}`}
        </p>
      </div>
      {compare !== null && (
        <section className="mi-comparison">
          <h3>เปรียบเทียบช่วงเวลา</h3>
          <div>
            <span>
              {data?.steps[compare]?.date
                ? relativeDay(data.steps[compare].date)
                : "ล่าสุด"}{" "}
              · {data?.steps[compare]?.label}
              <b>
                {formatValue(compared)} {unit}
              </b>
            </span>
            <MapIcon name="arrow" size={16} />
            <span>
              {current?.date ? relativeDay(current.date) : "ล่าสุด"} ·{" "}
              {current?.label}
              <b>
                {formatValue(value)} {unit}
              </b>
            </span>
          </div>
          <p>
            {compared !== null && value !== null
              ? `เปลี่ยนแปลง ${value - compared > 0 ? "+" : ""}${formatValue(value - compared)} ${deltaUnit}`
              : "ข้อมูลไม่ครบสำหรับเปรียบเทียบ"}{" "}
            · {modeLabels[mode]}
          </p>
        </section>
      )}
      {mode !== "observation" && (
        <section className="mi-local-trend">
          <div className="mi-section-title">
            <h3>แนวโน้ม 7 วัน</h3>
            <span>{unit}</span>
          </div>
          <div className="mi-trend-bars">
            {daily.map(({ step, i, value: dayValue }) => (
              <button
                key={step.key}
                onClick={() => onTime(i)}
                aria-pressed={current?.day === step.day}
                aria-label={`${relativeDay(step.date)} ${formatValue(dayValue)} ${unit}`}
              >
                <b>{formatValue(dayValue)}</b>
                <div>
                  <i
                    style={{
                      height: `${Math.max(4, ((dayValue ?? 0) / max) * 100)}%`,
                      background: valueColor(layer, metric, dayValue),
                    }}
                  />
                </div>
                <span>{relativeDay(step.date).split(" ")[0]}</span>
              </button>
            ))}
          </div>
          <p>
            แตะวันเพื่อดูบนแผนที่ ·{" "}
            {point ? "แนวโน้มจุดที่เลือก" : "เฉลี่ยจุดในพื้นที่"}
          </p>
        </section>
      )}
      {todayValues.length > 0 && (
        <div className="mi-range">
          <span>ช่วงค่ารายช่วงเวลาของวันที่เลือก</span>
          <b>
            {formatValue(Math.min(...todayValues))}–
            {formatValue(Math.max(...todayValues))} {unit}
          </b>
          <small>ช่วงค่าพยากรณ์ ไม่ใช่ช่วงความเชื่อมั่น</small>
        </div>
      )}
      {!selected && (
        <section className="mi-concern">
          <div className="mi-section-title">
            <h3>จุดที่ค่าสูงสุด</h3>
            <span>ช่วงที่เลือก</span>
          </div>
          {topPoints.length ? (
            topPoints.map((p, i) => (
              <button key={p.id} onClick={() => onSelect(p)}>
                <span className="mi-rank">{i + 1}</span>
                <span>{p.label}</span>
                <b>{formatValue(pointValue(p, index, metric))}</b>
                <MapIcon name="arrow" size={14} />
              </button>
            ))
          ) : (
            <p>ไม่มีจุดที่มีข้อมูลในช่วงนี้</p>
          )}
          <small>จัดอันดับเฉพาะจุดที่แหล่งข้อมูลรองรับ</small>
        </section>
      )}
      <section className="mi-trust">
        <div className="mi-section-title">
          <h3>
            <MapIcon name="info" size={16} />
            ที่มาและความน่าเชื่อถือ
          </h3>
        </div>
        <dl>
          <div>
            <dt>ชนิดข้อมูล</dt>
            <dd>{modeLabels[mode]}</dd>
          </div>
          <div>
            <dt>สถานะ</dt>
            <dd>
              {data?.status === "live"
                ? "แหล่งข้อมูลพร้อม"
                : data?.status === "unavailable" || !data
                  ? "ไม่พร้อม"
                  : "ข้อมูลลดทอน / สำรอง"}
            </dd>
          </div>
          {point?.observedAt && mode === "observation" && (
            <div>
              <dt>เวลาตรวจวัด</dt>
              <dd>{point.observedAt} ICT</dd>
            </div>
          )}
          <div>
            <dt>ความเชื่อมั่น</dt>
            <dd>ยังไม่มี % ความมั่นใจที่ยืนยันได้</dd>
          </div>
          {current?.sourceMode && (
            <div>
              <dt>ช่วงพยากรณ์</dt>
              <dd>
                {current.sourceMode === "extrapolated"
                  ? "ขยายแนวโน้ม ความแน่นอนลดลง"
                  : "ช่วงข้อมูลแบบจำลอง"}
              </dd>
            </div>
          )}
        </dl>
        <p className="mi-model-name">
          {data?.model ?? "กำลังตรวจสอบแหล่งข้อมูล"}
        </p>
        <details className="mi-technical">
          <summary>รายละเอียดข้อมูลและข้อจำกัด</summary>
          <dl>
            <div>
              <dt>{data?.timestampLabel ?? "เวลา"}</dt>
              <dd>{data?.timestamp || "ไม่ระบุ"}</dd>
            </div>
            <div>
              <dt>เวลาเริ่มรันแบบจำลอง</dt>
              <dd>API ไม่ระบุ</dd>
            </div>
            <div>
              <dt>จุดที่มีค่าในช่วงนี้</dt>
              <dd>
                {data?.points.filter(
                  (p) => pointValue(p, index, metric) !== null,
                ).length ?? 0}{" "}
                / {data?.points.length ?? 0}
              </dd>
            </div>
            {current?.reliability !== undefined && (
              <div>
                <dt>คะแนนความน่าเชื่อถือเชิงกฎ</dt>
                <dd>{current.reliability}/100 · ไม่ใช่ % ความมั่นใจ</dd>
              </div>
            )}
          </dl>
          {mode === "estimate" && (
            <p>
              พื้นผิว IDW ใช้จุดใกล้เคียงอย่างน้อย 3 จุดภายใน 50 กม.
              สีที่ต่อเนื่องไม่ได้เพิ่มความละเอียดของแหล่งข้อมูล
              พื้นที่ว่างคือไม่มีข้อมูลรองรับ
            </p>
          )}
          {layer === "rain" && (
            <p>
              โอกาสฝนคือโอกาสเกิดฝนที่จุดแบบจำลองในช่วงที่เลือก
              ไม่ใช่สัดส่วนพื้นที่ฝนตกหรือความแน่นอนของปริมาณฝน
            </p>
          )}
          {layer === "heat" && (
            <p>
              Heat Index คำนวณจากอุณหภูมิและความชื้น
              ค่าอุณหภูมิอากาศเป็นคนละตัวชี้วัด
            </p>
          )}
          {data?.notes.map((note, i) => (
            <p key={i}>{note}</p>
          ))}
          {data?.sources.map((source, i) =>
            /^https:\/\//.test(source) ? (
              <a key={i} href={source} target="_blank" rel="noreferrer">
                {new URL(source).hostname} ↗
              </a>
            ) : (
              <p key={i}>{source}</p>
            ),
          )}
        </details>
      </section>
    </>
  );
}
