"use client";

export type LocationSelection = {
  lat: number;
  lng: number;
  source: "gps" | "map";
};

export type LocationSeriesPoint = {
  label: string;
  primary: number | null;
  secondary?: number | null;
};

function linePath(values: Array<number | null>, width: number, height: number, maximum: number) {
  const points = values.map((value, index) => ({
    x: values.length <= 1 ? width / 2 : index * width / (values.length - 1),
    y: height - ((value ?? 0) / Math.max(1, maximum)) * height,
    valid: value !== null,
  }));
  return points.reduce((path, point) => point.valid
    ? `${path}${path ? " L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    : path, "");
}

export default function LocationForecastCard({
  kind,
  selection,
  series,
  onClear,
}: {
  kind: "air" | "rain";
  selection: LocationSelection | null;
  series: LocationSeriesPoint[];
  onClear: () => void;
}) {
  const primaryValues = series.map((point) => point.primary);
  const primaryMaximum = Math.max(1, ...primaryValues.filter((value): value is number => value !== null));
  const airPath = kind === "air" ? linePath(primaryValues, 232, 54, Math.max(45, primaryMaximum * 1.15)) : "";
  const probabilityPath = kind === "rain"
    ? linePath(series.map((point) => point.secondary ?? null), 232, 54, 100)
    : "";

  return (
    <section className={`location-forecast-card ${kind}`} aria-live="polite" aria-label="พยากรณ์ ณ จุดที่เลือก">
      <div className="location-card-heading">
        <div>
          <span>{selection ? selection.source === "gps" ? "ตำแหน่งของฉัน" : "จุดที่เลือกบนแผนที่" : "พยากรณ์รายตำแหน่ง"}</span>
          <b>{selection ? `${selection.lat.toFixed(4)}, ${selection.lng.toFixed(4)}` : "แตะแผนที่หรือใช้ตำแหน่งของฉัน"}</b>
        </div>
        {selection && <button type="button" onClick={onClear} aria-label="ยกเลิกจุดที่เลือก">×</button>}
      </div>

      {selection && series.some((point) => point.primary !== null) ? (
        <div className="location-chart-wrap">
          <svg viewBox="0 0 240 82" role="img" aria-label={kind === "air" ? "กราฟ PM2.5 เจ็ดวัน ณ จุดที่เลือก" : "กราฟฝนสามชั่วโมง ณ จุดที่เลือก"}>
            <line x1="4" y1="58" x2="236" y2="58" className="location-chart-axis" />
            {kind === "rain" && series.map((point, index) => {
              const value = point.primary ?? 0;
              const barWidth = 20;
              const x = 4 + index * (232 / Math.max(1, series.length)) + 3;
              const height = value / primaryMaximum * 48;
              return <rect key={`${point.label}-${index}`} x={x} y={58 - height} width={barWidth} height={height} rx="3" className="location-rain-bar" />;
            })}
            {kind === "air" && airPath && <path d={airPath} transform="translate(4 4)" className="location-air-line" />}
            {kind === "rain" && probabilityPath && <path d={probabilityPath} transform="translate(4 4)" className="location-probability-line" />}
            {series.map((point, index) => {
              const x = 4 + index * (232 / Math.max(1, series.length - 1));
              return <text key={`${point.label}-label`} x={x} y="76" textAnchor={index === 0 ? "start" : index === series.length - 1 ? "end" : "middle"}>{point.label}</text>;
            })}
          </svg>
          <div className="location-chart-values">
            <span><i className="primary" />{kind === "air" ? `PM2.5 ${series[0]?.primary ?? "—"} µg/m³` : `ฝน ${series[0]?.primary ?? "—"} มม.`}</span>
            {kind === "rain" && <span><i className="secondary" />แนวโน้มฝนโดยประมาณ ณ จุดนี้ {series[0]?.secondary ?? "—"}%</span>}
          </div>
        </div>
      ) : selection ? (
        <p className="location-card-empty">จุดนี้อยู่นอกระยะข้อมูลที่รองรับ กรุณาเลือกใกล้กรุงเทพฯ และปริมณฑล</p>
      ) : (
        <p className="location-card-empty">ค่าจะแสดงจากกริดแบบจำลองใกล้เคียง พร้อมกราฟแนวโน้มโดยไม่บันทึกพิกัด</p>
      )}
      <small>{kind === "rain" ? "คำนวณจากจุดแบบจำลองใกล้เคียง ไม่ใช่เรดาร์หรือสถานีตรวจวัด ณ พิกัด" : "ค่าประมาณเชิงพื้นที่ ไม่ใช่สถานีตรวจวัด ณ พิกัด"}</small>
    </section>
  );
}
