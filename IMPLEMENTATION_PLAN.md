# แผนพัฒนาแผนที่พยากรณ์ PM2.5 กรุงเทพฯ ล่วงหน้า 1–5 วัน

## 1. เป้าหมายผลิตภัณฑ์

สร้างแผนที่ที่ตอบได้ว่าในอีก 1–5 วัน ค่าฝุ่น PM2.5 ของกรุงเทพฯ มีแนวโน้มเท่าใด พื้นที่ใดควรเฝ้าระวัง และผลพยากรณ์มีความเชื่อมั่นเพียงใด โดยแยกค่าตรวจวัดจริง ค่าพยากรณ์ และค่าประมาณเชิงพื้นที่ออกจากกันอย่างชัดเจน

ผลลัพธ์รุ่นแรก:

- ค่ากลาง PM2.5 รายวันสำหรับ D+1 ถึง D+5
- แผนที่จุดสถานีและพื้นผิวเชิงพื้นที่ระดับกรุงเทพฯ
- ช่วงความไม่แน่นอนและคะแนนความเชื่อมั่นตาม lead time
- พื้นที่เฝ้าระวัง 5 อันดับแรก
- เวลาออกรอบ เวลาใช้ได้ของข้อมูล และสถานะความสดใหม่
- API contract กลางที่ frontend ใช้ได้โดยไม่ผูกกับผู้ให้ข้อมูลรายใดรายหนึ่ง

## 2. ขอบเขตและสิ่งที่ยังไม่ทำ

### ในขอบเขต

- พยากรณ์ค่ากลางรายวัน 1–5 วัน
- PM2.5 หน่วย µg/m³
- พื้นที่กรุงเทพมหานคร
- ค่าจากสถานี AirBKK เป็น ground truth สำหรับฝึกและปรับ bias
- CAMS PM2.5 และข้อมูลอุตุนิยมวิทยาเป็นตัวแปรพยากรณ์
- fallback เมื่อแหล่งข้อมูลภายนอกล่ม

### นอกขอบเขตรุ่นแรก

- การประกาศเตือนสาธารณะอย่างเป็นทางการ
- การฟันธงค่ารายชั่วโมงเกิน D+3
- การพยากรณ์รายเดือน/รายปี
- การระบุแหล่งกำเนิดมลพิษรายจุด
- การใช้ข้อมูล AirBKK เพื่อเผยแพร่ต่อก่อนยืนยันสิทธิ์และเงื่อนไข

## 3. สถาปัตยกรรมข้อมูล

```text
AirBKK observations ──> ingestion ──> raw observations
TMD/ECMWF weather ────> ingestion ──> weather forecast
CAMS PM2.5 ───────────> ingestion ──> atmospheric forecast
station metadata ─────> validation ─> canonical station registry
                                         │
                                         ▼
                              feature engineering / QC
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                               ▼
                 bias-correction model           spatial residual model
                         └───────────────┬───────────────┘
                                         ▼
                                forecast grid + stations
                                         ▼
                               forecast API / web map
```

### ตารางหลัก

1. `stations`: รหัสกลาง พิกัด เขต ประเภทเครื่องมือ ช่วงเวลาที่ใช้งาน
2. `observations_hourly`: PM2.5 และตัวแปรอากาศพร้อม QC flag
3. `model_inputs`: CAMS/TMD แต่ละรอบและ lead time
4. `forecasts_station`: ค่ากลาง quantile 10/50/90 และ model version
5. `forecasts_grid`: กริดหรือ vector tiles สำหรับแผนที่
6. `model_metrics`: MAE, RMSE, bias, threshold recall แยกฤดู/สถานี/lead time

## 4. Data contract ที่ frontend ต้องได้รับ

```json
{
  "issuedAt": "ISO-8601",
  "validDate": "YYYY-MM-DD",
  "leadHours": 24,
  "modelVersion": "string",
  "dataStatus": "operational|degraded|stale|demo",
  "stationId": "string",
  "pm25P10": 24.1,
  "pm25P50": 31.8,
  "pm25P90": 40.2,
  "confidence": 0.88,
  "qc": []
}
```

ข้อบังคับ: ห้ามส่งค่าเดียวโดยไม่มี `issuedAt`, `validDate`, `modelVersion`, `dataStatus` และ uncertainty

## 5. ขั้นตอนพัฒนาโมเดล

### ระยะ A — สร้างคลังข้อมูล

- ขอข้อมูล AirBKK ย้อนหลังอย่างน้อย 2–3 ปี เป้าหมาย 5 ปี
- เก็บค่าปัจจุบันทุก 5–15 นาทีผ่าน backend cache
- ทำ station registry เพื่อรองรับการย้ายสถานี เปลี่ยน sensor และช่วงข้อมูลขาด
- ดึง CAMS forecast ทุก 00/12 UTC และเก็บทั้ง forecast issue เพื่อทำ hindcast
- เก็บอุตุนิยมวิทยา: ลม ฝน RH อุณหภูมิ ความกดอากาศ และ boundary-layer height
- ตรวจ timezone ให้เป็น UTC ในฐานข้อมูลและแสดง Asia/Bangkok ในหน้าเว็บ

### ระยะ B — Baseline ที่ต้องชนะให้ได้

1. Persistence: ใช้ค่าล่าสุด/ค่าเวลาเดียวกันของวันก่อน
2. Seasonal climatology: ค่ามัธยฐานตามสถานี เดือน วันในสัปดาห์ และชั่วโมง
3. Raw CAMS: เทียบ CAMS ที่จุดสถานีโดยไม่ปรับค่า
4. CAMS linear correction: ปรับ intercept/slope รายสถานี

โมเดลใหม่จะ go-live ได้เมื่อชนะ baseline อย่างสม่ำเสมอ ไม่ใช่เฉพาะค่าเฉลี่ยรวม

### ระยะ C — Operational model

- โมเดลแรก: LightGBM/XGBoost แยก lead time หรือ multi-horizon model
- features: PM2.5 lag 1/3/6/12/24/48 ชม., rolling mean, CAMS PM2.5, wind vector, rain, RH, temperature, pressure, seasonality และ station embedding
- คำนวณ quantile P10/P50/P90 แทนการให้ค่ากลางอย่างเดียว
- ปรับ residual เชิงพื้นที่ด้วย kriging หรือ graph-based interpolation
- จำกัดผลลัพธ์ด้วย physical/range checks และตรวจ discontinuity ระหว่างรอบ

## 6. การสร้างแผนที่

- แสดงจุดสถานีเป็นค่าพยากรณ์ ณ สถานี ไม่ใช่ค่าตรวจวัดปัจจุบัน
- พื้นผิวกริดใช้ residual interpolation ระหว่างสถานี ผสมกับ CAMS background
- mask ผลลัพธ์เฉพาะกรุงเทพฯ และไม่ extrapolate ไกลเกิน coverage ที่กำหนด
- ความละเอียดแสดงผลเริ่มต้น 1–2 กม. แต่ห้ามสื่อว่าความแม่นยำจริงละเอียดเท่าขนาด pixel
- เมื่อข้อมูลขาด ให้ซ่อนชั้นพยากรณ์หรือแสดงสถานะ degraded ห้ามใช้ค่ารอบเก่าโดยไม่ติดป้าย

## 7. การประเมินและเกณฑ์ผ่าน

ใช้ rolling-origin backtest โดยห้ามสุ่มแบ่งแถว เพราะจะเกิด data leakage

- แบ่ง train/validation/test ตามเวลาและแยกฤดูฝุ่น
- ทดสอบแบบ leave-station-out เพื่อวัดพื้นที่ไม่มีสถานีหนาแน่น
- รายงาน MAE, RMSE และ mean bias สำหรับ D+1…D+5
- รายงาน recall/precision สำหรับเหตุการณ์เกิน 37.5 และ 75 µg/m³
- ตรวจ coverage ของ P10–P90 ให้ใกล้ 80%
- ตรวจผลแยกตามเขต สถานี เดือน ช่วงค่า และ lead time

เกณฑ์ go-live รุ่นทดลอง:

- D+1–D+3 ชนะ persistence และ raw CAMS ใน MAE อย่างมีนัยสำคัญ
- ไม่มีสถานีกลุ่มใดมี systematic bias ที่ไม่ได้อธิบาย
- uncertainty ผ่าน calibration test
- pipeline สำเร็จตามเวลาอย่างน้อย 95% ในช่วง shadow run
- ผู้เชี่ยวชาญเจ้าของข้อมูลอนุมัติคำอธิบายและเงื่อนไขการใช้

## 8. Fallback และการปฏิบัติการ

1. AirBKK ช้ากว่าเกณฑ์: ใช้รอบ observation ล่าสุดแต่เพิ่ม uncertainty และติดป้าย degraded
2. CAMS ขาด: ใช้ weather + persistence เฉพาะ D+1 และงด D+2–D+5
3. Weather ขาด: ไม่ออกรอบใหม่
4. โมเดลล้ม: ใช้ baseline ที่ผ่านการประเมิน พร้อม model version เฉพาะ
5. ทุกกรณีบันทึกสาเหตุ เวลา และ source freshness ใน health endpoint

## 9. แผนส่งมอบ

### Sprint 0 — สิทธิ์และข้อมูล

- ยืนยันสิทธิ์ AirBKK และขอข้อมูลย้อนหลัง
- ตรวจ schema, missingness, station history และ sampling interval
- กำหนดผู้อนุมัติผลพยากรณ์และข้อความเตือน

### Sprint 1 — Pipeline และ baseline

- ingestion, canonical schema, QC และ feature store
- CAMS/TMD archive
- baseline 4 แบบและ dashboard metrics

### Sprint 2 — โมเดลและ backtest

- train multi-horizon model
- quantile forecast และ spatial residual
- backtest แยกฤดู/สถานี/lead time

### Sprint 3 — Shadow operation

- ออกรอบอัตโนมัติแต่ยังไม่เผยแพร่
- เทียบผลกับ AirBKK จริงทุกวัน
- ปรับ threshold, uncertainty และ fallback

### Sprint 4 — Pilot

- เปิดให้ผู้ใช้กลุ่มจำกัด
- ติดตามความเข้าใจ UI และ false alarm/missed event
- ตัดสิน go/no-go สำหรับ public beta

## 10. สถานะของต้นแบบใน repository นี้

หน้าเว็บปัจจุบันใช้ข้อมูลจำลองและ endpoint `/api/forecast` เพื่อยืนยัน data contract, interaction และรูปแบบการสื่อ uncertainty เท่านั้น ยังไม่มีการฝึกโมเดลหรือเชื่อมข้อมูล AirBKK/CAMS จริง จึงไม่ควรนำค่าตัวเลขไปใช้ตัดสินใจด้านสุขภาพ
