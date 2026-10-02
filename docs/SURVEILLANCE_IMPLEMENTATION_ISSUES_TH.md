# ประเด็นก่อนเปิดระบบเฝ้าระวังจริง — BKK Air

ปรับวันที่ 9 กันยายน 2026
สถานะ: เปิดเฉพาะหน้า **shadow mode ด้วย synthetic fixtures** ในโค้ด ยังไม่มีการเฝ้าระวังหรือส่งแจ้งเตือนจริง

## สิ่งที่ทำได้ในรอบนี้

- เพิ่มหน้า `/surveillance` สำหรับดู summary, freshness แยกรายแหล่ง, แผนที่กับ event list, event detail, evidence, rule contract, timeline, acknowledgement แบบ session ทดสอบ และรายงาน snapshot สำหรับพิมพ์
- เพิ่ม rule contract และ quality gate ที่คืน `met / not_met / unknown / suppressed`; missing, stale, coverage ต่ำ, source mismatch และข้อมูลที่ยังไม่ available ณ เวลา replay ไม่ถูกตีความเป็น `not_met`
- เพิ่มกติกา lifecycle ขั้นต้น: `unknown` ไม่ปิดเหตุ active และ `not_met` ต้องผ่าน recovery samples ก่อนเป็น resolved
- เพิ่ม read-only API สำหรับ list/detail/health ของ fixture; acknowledgement endpoint ปฏิเสธด้วย `503 shadow_mode_persistence_unavailable` จนกว่าจะมี persistence และ actor authorization
- ข้อมูลทุกชิ้นติด `synthetic: true`, response header ระบุ `shadow-synthetic` และ UI แสดงคำเตือนชัดเจน
- ไม่มี notification outbox, scheduler, collector ใหม่ หรือ external dispatch

## ประเด็นค้างที่ต้องตัดสินใจก่อน S19/S20

### 1. เกณฑ์กฎจริงยังไม่มีเจ้าของอนุมัติ

- สถานะ: Block live mode
- ต้องยืนยัน threshold, entry/exit, persistence, recovery, cooldown, coverage, freshness budget, effective date และเจ้าของนิยามสำหรับฝน ความร้อน และ PM2.5
- ตัวเลขในโค้ดปัจจุบันเป็น fixture เพื่อทดสอบ boundary เท่านั้น ห้ามนำไปเปิดแจ้งเตือนจริง
- เกณฑ์ผ่าน: มี rule matrix ที่อ้างอิงเอกสารและลงชื่อผู้รับผิดชอบครบทุก field ของ `RuleVersion`

### 2. Contract ประกาศทางการยังไม่ยืนยัน

- สถานะ: Block official feed
- ต้องยืนยัน machine-readable source, identity/revision/cancelled semantics, polling cadence, สิทธิ์ cache และสิทธิ์เผยแพร่ซ้ำของประกาศ TMD
- ระหว่างนี้ห้ามเดา endpoint, issuer, bulletin id หรือ polygon; event ประกาศในหน้าเป็น fixture ที่ระบุว่าไม่ใช่หน่วยงานจริง
- เกณฑ์ผ่าน: fixture จากเอกสารจริงที่ตรวจสิทธิ์แล้วสามารถทดสอบ revision, cancellation, expiry และ scope unknown ได้

### 3. นิยาม PM2.5 และ averaging window

- สถานะ: Block PM2.5 live rule
- ต้องยืนยันนิยาม 1 ชั่วโมง/24 ชั่วโมง, coverage, rounding และขอบช่วงตาม Air4Thai/PCD
- ห้ามใช้ค่ารายชั่วโมงหรือ model daily ไปติดป้ายเป็น AQI ตรวจวัดทางการ
- เกณฑ์ผ่าน: test fixtures มีหน่วย, window และ provenance ตรงกับ contract ต้นทาง

### 4. Persistence และสิทธิ์ผู้ใช้

- สถานะ: Block durable acknowledgement / audit
- `.openai/hosting.json` ยังไม่มี D1 และ `db/schema.ts` ยังไม่มีตาราง surveillance
- ต้องออกแบบ `rule_versions`, `evaluations`, `surveillance_events`, `event_revisions`, `event_evidence`, `acknowledgements`, `notification_outbox` และ `delivery_attempts` พร้อม migration, retention และ indexes
- ต้องยืนยัน actor identity/role ฝั่ง server; client ห้ามเขียน severity, source evidence หรือ acknowledgement แทนผู้อื่น
- เกณฑ์ผ่าน: duplicate/out-of-order/concurrent tests ผ่าน และ audit ระบุ actor กับ event revision ที่เห็นได้

### 5. Trigger, lease และ idempotency

- สถานะ: Block evaluator scheduling
- ต้องผูก evaluation กับ ingestion batch ที่มีข้อมูลใหม่ ไม่ใช่การเปิดหน้าเว็บ และมี transaction/lease สำหรับหลาย worker
- ต้องกำหนด logical event identity, material revision และ dedup key สำหรับ outbox
- เกณฑ์ผ่าน: rerun input เดิมไม่เปิดเหตุซ้ำ; late revision ไม่ย้อนสถานะโดยไร้นโยบาย

### 6. แผน historical replay และ shadow acceptance

- สถานะ: Block live dispatch
- ต้องกำหนดช่วงเวลาและจำนวนกรณีขั้นต่ำ, owner ผู้ review, วิธีวัด false positive, missed event, duplicate และ alert volume
- replay ต้องใช้เฉพาะ asset ที่ `availableAt <= replay time`; backfill ห้ามส่ง live notification
- เกณฑ์ผ่าน: S19 มีผลเทียบเหตุจริง, ข้อจำกัด และ rollback ไม่ใช้ “ช่วงทดลองไม่มีเหตุ” เป็นหลักฐานความแม่นยำ 100%

### 7. ช่องทางแจ้งเตือนและ consent

- สถานะ: Block external notification
- ยังไม่เลือก email/LINE/webhook และยังไม่ยืนยัน API, ราคา, rate limit, quiet hours, escalation, opt-in/opt-out หรือผู้รับทดสอบ
- เกณฑ์ผ่าน: outbox/retry/idempotency ผ่าน end-to-end กับผู้รับ canary ที่อนุญาต และสามารถปิด dispatch โดยไม่ทำลายประวัติ

### 8. Freshness budget ของแต่ละแหล่ง

- สถานะ: ต้องตัดสินใน S15
- ต้องแยก `validAt`, model run, fetchedAt และ ingestedAt พร้อม schedule ต้นทาง เพื่อแยก provider delay จาก ingest failure
- เกณฑ์ผ่าน: health API อธิบายเหตุ fresh/delayed/unavailable ได้ด้วย reason code ที่ตรวจสอบย้อนกลับได้

## ข้อสังเกตจากเว็บตัวอย่าง

เว็บตัวอย่าง LPHO–Dengue ใช้ลำดับแบบศูนย์ปฏิบัติการ: header ที่บอกเวลา/สถานะ, แท็บตามงาน, KPI row, แผนที่คู่รายละเอียด และรายงานผู้บริหาร รอบนี้นำ pattern ดังกล่าวมาปรับเป็นแท็บ “ศูนย์ติดตาม / คุณภาพข้อมูล / รายงานสถานการณ์” และคงธีม BKK Air โดยไม่ยกข้อมูลโรค สีแบรนด์ หรือเกณฑ์ของระบบต้นฉบับมาใช้
## อัปเดต 16 ก.ย. 2026

แก้ quality gate, lifecycle reducer, fixture identity, revision-aware acknowledgement, รายงานหลักฐาน และตัวกรอง PM2.5 แล้วในขอบเขตทดสอบ ดู [รายละเอียดและประเด็นค้างสำหรับ Astra](SURVEILLANCE_IMPROVEMENTS_2026_09_16_TH.md) — รายการก่อนเปิดจริงในเอกสารนี้ยังไม่ถือว่าปิด
