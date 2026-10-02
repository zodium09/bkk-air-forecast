# แผนเพิ่มระบบเฝ้าระวังอากาศ — BKK Air
ปรับวันที่9กันยายน2026 • สถานะ: แผน ยังไม่เปิดการเฝ้าระวังหรือส่งแจ้งเตือนจริง

เอกสารนี้ต่อจาก [แผน Dashboard](D:/MyWebApps/bkkair/docs/WEATHER_ANALYTICS_REPORT_REDESIGN_PLAN_TH.md) และ [แผนข้อมูลย้อนหลัง S01–S14](D:/MyWebApps/bkkair/docs/HISTORICAL_DATA_CONNECTION_SESSION_PLAN_TH.md) เพิ่มงาน S15–S20 พร้อมงานเตรียมที่ต้องแทรกใน sessions เดิม ไม่เปลี่ยนการอ้างอิงหมายเลขเดิม

## 1. เป้าหมาย
สร้างหน้าศูนย์เฝ้าระวังที่ตอบได้ว่า “พื้นที่ใดมีประเด็นอะไร เริ่มเมื่อใด คาดว่าจะเกิดช่วงไหน หลักฐานจากไหน และมีผู้รับทราบแล้วหรือยัง” ครอบคลุมฝน ความร้อน และ PM2.5 ใน6จังหวัดเดิม โดยแสดงข้อมูลตรวจวัด พยากรณ์ และประกาศทางการแยกกัน

MVP เป็นศูนย์ติดตามในแอพพร้อมรายการเหตุการณ์ การรับทราบ และรายงานสถานการณ์ เริ่มกฎแบบอธิบายได้ ใช้ historical replay และ shadow mode ก่อนเปิดการแจ้งเตือนภายนอก ขอบเขตนี้เป็นแผนสร้างระบบในแอพ ไม่ใช่คำสั่งให้ Codex ตั้ง automation เฝ้าเว็บตั้งแต่ตอนนี้

## 2. สัญญาณสามประเภท
| ประเภท | ความหมาย | กติกาที่แสดงต่อผู้ใช้ |
|---|---|---|
| ประกาศหน่วยงาน | ข้อความ/ขอบเขต/ช่วงมีผลจากหน่วยงานผู้ออก | แสดงผู้ออก เลขฉบับ เวลาเผยแพร่ ช่วงมีผล ลิงก์ต้นฉบับ และสถานะปรับปรุง/ยกเลิก; แอพไม่ตั้งชื่อให้ดูเหมือนออกประกาศเอง |
| สัญญาณเฝ้าระวังของแอพ | กฎบนค่าตรวจวัดหรือพยากรณ์ที่ผ่านคุณภาพข้อมูล | แสดงกฎ เวอร์ชัน ค่า/หน่วย window หลักฐาน และประเภทข้อมูล; เป็นผลประเมินของระบบ |
| ปัญหาคุณภาพข้อมูล | stale, missing, partial, station offline, ingest failure | แสดงเป็นสถานะข้อมูล ไม่ใช้สี/ถ้อยคำที่สื่ออากาศปกติหรือภัยรุนแรง |

[กรมอุตุนิยมวิทยามีหน้าประกาศเตือนภัยทางการ](https://www.tmd.go.th/warning-and-events) ที่ใช้เป็นจุดเริ่มตรวจ feed/รูปแบบเอกสาร แต่รอบนี้ยังไม่ได้ยืนยัน machine-readable warning API และสิทธิ์ cache/เผยแพร่ซ้ำ จึงต้องตรวจ contract ใน S15 หากยังไม่มี ให้เริ่มแสดงลิงก์ต้นฉบับหรือรับเข้าโดยผู้ดูแลพร้อมตรวจทาน ห้ามเดา endpoint หรือเติม polygon จากชื่อจังหวัดแล้วอ้างว่าเป็นขอบเขตละเอียดทางการ

สำหรับ PM2.5 ตรวจเอกสารเกณฑ์ของ [กรมควบคุมมลพิษ](https://www.pcd.go.th/wp-content/uploads/2025/05/pcdnew-2025-05-14_02-32-38_602516.pdf) และนิยาม averaging window จาก [Air4Thai](https://air4thai.pcd.go.th/) ก่อนเปิดกฎจริง เกณฑ์ราย24ชั่วโมงใช้กับค่าที่มี window/coverage ตรงกัน ไม่ใช้ค่ารายชั่วโมงหรือ daily model ไปติดป้ายว่าเป็น AQI ตรวจวัดทางการโดยอัตโนมัติ

## 3. ชุดกฎเริ่มต้นและสิ่งที่ต้องยืนยัน
| หัวข้อ | ตัวแปร / กฎที่เสนอ | ข้อมูลที่ต้องมี | จุดตรวจรับก่อนเปิด |
|---|---|---|---|
| ฝนคาดการณ์ | ปริมาณฝนสะสมใน window และระยะนำที่เลือก; โอกาสฝนเป็นสัญญาณอีกชนิด | forecast run, valid interval, mm/% และ provenance แยก | threshold/cadence/พื้นที่มีเจ้าของนิยาม; ไม่ใช้ probability แทนความหนักของฝน |
| ฝนตรวจวัด | ฝนสะสมจริงตามช่วงที่สถานีรองรับ | สถานี/ตำแหน่ง/QC/window | มี feed ที่ยืนยันแล้ว; ถ้ายังไม่มีให้ปิดกฎนี้ ไม่ใช้ ERA5 แทน real-time observation |
| ความร้อน | อุณหภูมิหรือ Heat Index เกินระดับที่กำหนดต่อเนื่องตาม window | temp/RH เวลาเดียวกัน สูตรHIเวอร์ชันตรงกัน | ยืนยันแหล่งเกณฑ์และขอบเขตใช้; ไม่ผสมHIกับ apparent temperature |
| PM2.5 | ระดับค่าเฉลี่ยตาม window และ persistence; แยก observed กับ forecast | unit µg/m³, averaging window, coverage และ QC | ตรวจนิยามต้นทาง/การปัดเศษ/ขอบช่วง; ข้อมูลรายวันย้อนหลังไม่ใช้เฝ้าระวังรายชั่วโมง |
| แนวโน้มผิดจากฐานย้อนหลัง | percentile/anomaly ตามฤดูกาลและ source เดียวกัน | baseline ที่ผ่าน coverage/QC และเวอร์ชันคำนวณ | ระยะต่อยอดหลังข้อมูลพร้อม; “ผิดจากฐาน” ไม่เท่ากับระดับอันตราย |
| ประกาศทางการ | พื้นที่และช่วงมีผลทับพื้นที่ติดตาม | issuer/id/revision/issued/valid/cancelled | เก็บฉบับแก้ไข ไม่ส่งฉบับเก่าซ้ำ; แปลพื้นที่ไม่ได้ให้แสดง scope unknown |
| ข้อมูลล่าช้า | อายุข้อมูล/รอบที่ขาดเกิน freshness policy | source schedule, valid/fetched/ingested times | แยก provider delay กับ ingestion failure; ไม่ใช้ fetchedAt อย่างเดียวตัดสินว่าข้อมูลสด |

ค่าตัวเลขจริงของ threshold, persistence, cooldown, recovery และขั้นต่ำ coverage เป็นผลส่งมอบ S15 ต้องมีแหล่งอ้างอิง/เจ้าของ/วันที่มีผล การยังไม่ระบุตัวเลขในแผนนี้หมายถึงกฎยังไม่พร้อมเปิด ไม่ตั้งค่าทางวิชาการจากความสวยงามของสี และไม่สร้างคะแนนรวมฝุ่น–ฝน–ร้อนที่ไม่มีนิยามรองรับ

ระบบนี้ยังไม่พยากรณ์น้ำท่วมจากปริมาณฝนเพียงตัวเดียว และไม่อ้างว่าเป็น radar/nowcast นาทีต่อนาทีจากโมเดลกริดที่มีความถี่ต่ำกว่า

## 4. Rule contract และคุณภาพข้อมูล
ruleVersion ต้องบันทึก metric/unit, datasetClass/sourceProduct, area/location policy, aggregation/window, lead range, entry/exit threshold, minimum coverage, freshness budget, persistence, cooldown และ effectiveFrom พร้อมที่มานิยาม/ผู้รับผิดชอบ

evaluation ทุกครั้งมี id, ruleVersion, evaluatedAt, input asset/revision/run, valid interval, value, coverage, result และ reason codes ผลลัพธ์เป็น met/not_met/unknown/suppressed โดย unknown ไม่ถูกตีความเป็น not_met แสดง “ยังประเมินไม่ได้” เมื่อ data gate ไม่ผ่าน

ใช้เวลา validity ของข้อมูลและรอบโมเดลควบคู่เวลา fetch ข้อมูลเก่าที่เพิ่งโหลดใหม่ยังเก่าอยู่ กรณี source fallback ให้ตรวจว่ากฎรองรับแหล่งใหม่หรือไม่ ไม่เปลี่ยน input silently และไม่ปิดเหตุเพียงเพราะ provider หายไป

กฎพยากรณ์แสดงช่วงคาดว่าจะเกิดและระยะนำชัด กฎตรวจวัดแสดงช่วงตรวจพบ; พยากรณ์รอบใหม่อาจเลื่อนเวลา/ลดระดับ ต้องเก็บเหตุผลและหลักฐาน revision เพื่อย้อนดูว่าหน้าจอเคยบอกอะไร

## 5. วงจรเหตุการณ์และลดการแจ้งซ้ำ
สถานะทางข้อมูล: pending → active → resolved หรือ expired; เพิ่ม withdrawn/cancelled เมื่อประกาศถูกยกเลิกหรือข้อมูลต้นทางแก้จนสัญญาณใช้ไม่ได้ แต่ต้องเก็บประวัติ เหตุใหม่หลัง recovery ที่ผ่านเกณฑ์เป็น episode ใหม่

แยก workflow ผู้ใช้เป็น unacknowledged/acknowledged พร้อมผู้รับทราบ/เวลา/หมายเหตุและ event revision ที่เห็น; ถ้าเหตุเปลี่ยนสาระสำคัญต้องแสดงว่า ack เดิมอ้างฉบับก่อน การกดรับทราบไม่ทำให้สภาพอากาศคลี่คลาย และไม่ปิดเหตุอัตโนมัติ การพักแจ้งเตือนเป็น preference มีเวลา expiry แยกจาก lifecycle

- entry persistence นับช่วงข้อมูลต้นทางที่ไม่ซ้ำ ไม่ใช่จำนวนครั้ง fetch; ลดการสลับระดับจากค่าจุดเดียว; exit threshold/hysteresis และ recovery duration ลดการเปิดปิดถี่
- missing/stale ขณะ active คงหลักฐานล่าสุดและแสดง “สถานะปัจจุบันไม่ทราบ”; ห้ามเปลี่ยน resolved
- expired หมายถึงพ้นช่วงมีผล ไม่ใช่ยืนยันว่าปลอดภัย; ประกาศใหม่เชื่อมกับฉบับเดิมตาม identity
- logical identity ใช้ชนิดกฎ+scope+episode; repeated evaluation อัปเดตเหตุเดิม ไม่สร้างหนึ่งเหตุทุก polling
- forecast run ใหม่ที่ช่วงเหตุทับกันให้ reconcile ภายใน identity เดิมตามกติกาที่ระบุ; การเลื่อนช่วงต้องบันทึกและอาจแจ้ง material update
- รวมเหตุใกล้เคียงบนหน้าจอได้ แต่เก็บ child evidence รายสถานี/metric; ไม่รวมประกาศทางการกับกฎแอพจนที่มาหาย
- แจ้งเฉพาะเปิดเหตุ ระดับ/พื้นที่/เวลาที่เปลี่ยนอย่างมีนัยสำคัญ และคลี่คลายตาม preference; dedup key ผูก event revision/channel/recipient
- ใช้ outbox, delivery attempt, provider message id และ idempotency; ไม่รับรอง exactly-once delivery หากปลายทางไม่รองรับ ต้องลดผลจาก duplicate ด้วย key และข้อความที่ระบุเหตุเดิม

## 6. หน้าศูนย์เฝ้าระวังและรายงาน
เพิ่ม view “เฝ้าระวัง” ภายใน workspace เดิม ใช้ตัวกรองพื้นที่/หัวข้อร่วมกับแผนที่ แต่เวลาปัจจุบันของศูนย์ติดตามต้องเห็นชัดและไม่สับสนกับ history date ของ analysis

ลำดับหน้า:
1. Header: พื้นที่ติดตาม เวลาอ้างอิง และสถานะความสดแยกรายแหล่ง
2. Summary: เหตุที่ยัง active, พื้นที่เกี่ยวข้อง, เหตุรอรับทราบ และแหล่งที่ประเมินไม่ได้; ไม่นับจำนวนสถานีเป็นจำนวนประชากร
3. แผนที่กับ event list ที่เชื่อมกัน; filter ประกาศทางการ/ตรวจวัด/คาดการณ์/ข้อมูลขัดข้อง
4. Event detail: เกิดอะไร–ที่ไหน–เมื่อใด–หลักฐาน–กฎ–แนวโน้ม–ประวัติเปลี่ยนสถานะ–ลิงก์ต้นทาง
5. Timeline: เหตุเปิด/เปลี่ยนระดับ/ประกาศฉบับใหม่/รับทราบ/คลี่คลาย; สีมี label/icon ไม่พึ่งสีอย่างเดียว
6. มุมรายงานสถานการณ์: snapshot ณ เวลาที่เลือก พร้อมเหตุค้าง ความครบข้อมูล และข้อจำกัด

การจัดลำดับพิจารณาระดับ ความเร่งด่วน ช่วงเวลา และความน่าเชื่อถือที่นิยาม ไม่จัดตามเวลามาล่าสุดอย่างเดียว ความรุนแรงกับคุณภาพข้อมูลเป็นคนละแกน มี empty state “ยังไม่พบสัญญาณในข้อมูลที่ประเมินได้” และ no-data state “ยังประเมินไม่ได้”

มือถือให้ event list มาก่อนแผนที่ ลดการ์ดสรุปซ้ำ; keyboard เปิดรายละเอียดและรับทราบได้โดยไม่ใช้ hover รายงานพิมพ์ต้องมี source/valid interval/rule version และไม่อัปเดตตัวเลขเงียบ ๆ หลัง snapshot

## 7. สถาปัตยกรรมที่ต่อจากฐานเดิม
collector → normalized/versioned data → quality gate → evaluator → event reconciliation → events/evidence/audit → API → surveillance dashboard/report
event revisions → notification outbox → channel adapter → delivery status (เปิดหลัง shadow mode ผ่าน)

เพิ่มตารางเชิงตรรกะ rule_versions, evaluations, surveillance_events, event_revisions/evidence, acknowledgements และ notification_outbox/delivery_attempts โดยผูกกับ source/location/assets/forecast_runs จาก S03 ไม่สร้างสำเนา measurements อีกชุด Evaluation เก็บเฉพาะข้อมูลพอ audit พร้อม retention plan ไม่สร้าง raw hourly ซ้ำในทุกเหตุ

API ที่เสนอ: GET /api/surveillance/events, /events/:id, /health และ POST /events/:id/acknowledgements; rule changes และ collector endpoints ต้องมี authentication/authorization ฝั่ง server การเปลี่ยนสถานะโดยผู้ใช้ต้องบันทึก actor ห้าม client เขียน severity/source evidence เอง หน้าสาธารณะอาจอ่าน summary ได้ แต่ชื่อ/หมายเหตุภายในไม่ควรออกใน public API

ประเมินฝั่ง server โดยไม่พึ่งผู้ใช้เปิดหน้าเว็บ; trigger เมื่อ ingestion batch สำเร็จและมีข้อมูลใหม่; งาน reconciliation/expiry ตาม cadence ที่ยืนยัน เริ่ม manual job และ shadow run ก่อนผูก scheduler production หากหลาย worker ชนกันต้องมี transaction/lease/idempotent commit และทดสอบ duplicate/out-of-order run

## 8. แจ้งเตือนและการปฏิบัติงาน
ค่าเริ่มต้นเป็นในแอพ ภายนอก เช่น email/LINE/webhook เป็นทางเลือก S20 ตามช่องทางที่รองรับจริงและผู้ใช้อนุญาต ไม่สมมติ API/ราคา/สิทธิ์ส่งข้อความไว้ล่วงหน้า ต้องตรวจเอกสารช่องทางนั้นก่อนเชื่อม

preferences มีพื้นที่/หัวข้อ/ขั้นต่ำระดับ/quiet hours/digest/ช่องทาง/opt-in; ออกแบบนโยบาย quiet hours และ escalation ชัดก่อนเปิดใช้ ไม่ข้ามการ mute อัตโนมัติ การ ack/ส่งต่อ/ปิดด้วยมือเป็น role-based workflow ที่มีเหตุผลและ audit

runbook ระบุผู้ดูแลแหล่งข้อมูล ผู้ดูแลกฎ และผู้ตอบสนองเหตุ; freshness budget, lag, evaluation latency, delivery failures, retry backlog, false positives และ missed events ต้องวัดแยกกัน กรณีประกาศต้นทางอ่านไม่ได้ให้แสดงเวลาฉบับล่าสุดและข้อจำกัด ไม่อ้างว่าไม่มีประกาศ

## 9. แผน session ที่เพิ่มและ dependency
แทรกงานเตรียมในแผนเดิม:
- S01–S02: เพิ่ม warning source/access audit, freshness/cadence และ averaging windows
- S03: เตรียม stable identities/revision/evidence contracts; migration เหตุการณ์ทำจริงใน S16
- S04: capture พยากรณ์และ availability ให้ replay เฝ้าระวังได้
- S08: ส่ง quality/provenance/coverage ให้ evaluator; historical backfill ไม่ยิง live alerts
- S12: เพิ่ม template รายงานเฝ้าระวังหลัง S18 พร้อม โดยรายงานเดิมทำได้ก่อน
- S13–S14: rollout เฉพาะ dashboard/history/collector เดิม; ไม่เปิดแจ้งเตือนเฝ้าระวังภายนอกก่อน S19–S20

| Session | งานและผลส่งมอบ | เกณฑ์ผ่าน / จุดหยุด |
|---|---|---|
| S15 — นิยามเฝ้าระวัง | hazard/source/rule matrix, thresholds อ้างอิงและเวอร์ชัน, freshness/coverage, official bulletin contract และผู้รับผิดชอบ | ทุกกฎมี window/unit/class/entry/exit ชัด; แหล่งยังไม่พร้อมปิดเฉพาะกฎนั้น |
| S16 — ฐานเหตุการณ์ | migration, rule/evaluation/event schema, reconciliation และ audit, API contract | rerun ไม่สร้างซ้ำ; revision/out-of-order/concurrent ingest ผ่าน; actor permissions ชัด |
| S17 — ตัวประเมินกฎ | quality gate, persistence/hysteresis, unknown handling; replay fixtures และ historical replay | threshold boundary/missing/stale/fallback/late revision ผ่าน; ไม่ใช้อนาคตในการ replay |
| S18 — ศูนย์เฝ้าระวัง | map/list/detail/timeline/ack, freshness panel และรายงาน snapshot | ตัวเลข/evidence ตรงกัน; ack ไม่ resolve; keyboard/mobile/print ผ่าน |
| S19 — Shadow mode | รันประเมินโดยไม่ส่งภายนอก, ทบทวนเหตุจริงกับผู้ดูแล, วัด false positives/duplicate/missed signals และ alert volume | ระยะและจำนวนกรณีเพียงพอตามที่กำหนด S15; ไม่ถือไม่มีเหตุในช่วงทดลองว่าแม่นยำ100%; มี rollback |
| S20 — เปิดใช้งานเป็นขั้น | feature flags, ช่องทางที่เลือกพร้อม opt-in, outbox/retry, monitoring และ runbook | ทดลอง end-to-end ด้วยผู้รับทดสอบที่อนุญาต; replay ไม่ส่งจริง; canary ผ่านก่อนขยายพื้นที่ |

S15 เริ่มหลัง S02 โดยไม่ต้องรอ S14; S16 พึ่ง S03; S17 พึ่ง S08 และข้อมูลนำร่อง; S18 ใช้ contracts จาก S16 และ fixtures ได้; S19 พึ่ง S17/S18 และแหล่ง live ที่ยืนยัน; S20 พึ่ง S19 ส่วน anomaly ระยะยาวรอ S07/S10 coverage ผ่าน ไม่มีเหตุให้รอ backfill ห้าปีเพื่อแสดงประกาศหรือ threshold ที่มีข้อมูลพร้อม

หนึ่ง session อาจแตกเป็น a/b ตามขนาด แต่ต้องส่งมอบไฟล์และผลตรวจรับพร้อม docs/sessions/Sxx.md เช่นแผนเดิม ทุกขั้นข้างต้นยังเป็น planned ไม่มี collector/notification ใหม่ที่เปิดแล้ว

## 10. กรณีตรวจรับสำคัญ
1. Backfill ปีเก่าไม่สร้าง live notification แม้ค่าเกิน threshold
2. ค่าเท่าขอบเกณฑ์และ precision/window ถูกต้อง; ตัวอย่างข้อมูลทดสอบระบุว่า synthetic
3. missing ไม่เป็น0 และเหตุ active ไม่ resolve เพราะแหล่งล่ม
4. สอง worker ประเมิน input เดียวกันไม่เปิดเหตุซ้ำ
5. ข้อมูลใหม่กว่ามาก่อนข้อมูลเก่า เหตุไม่ย้อนสถานะโดยไร้ revision policy
6. รอบพยากรณ์เลื่อนช่วงเหตุ มีประวัติเดิมและ update เหมาะสม
7. ประกาศฉบับแก้ไข/ยกเลิก/หมดอายุแสดงต่างจากสภาพอากาศคลี่คลาย
8. หลายสถานีเหตุเดียวกันจัดกลุ่มได้ แต่ evidence และ source รายสถานียังอ่านได้
9. ack/mute ไม่ลบเหตุ และไม่มีผู้ไม่มีสิทธิ์แก้ rule/ack ของคนอื่น
10. delivery timeout หลังปลายทางรับแล้วไม่สร้าง duplicate ที่ระบบป้องกันได้; กรณีป้องกันไม่ได้ระบุข้อจำกัด
11. รายงาน snapshot มีข้อมูล/เวลา/สถานะตามจังหวะที่สร้าง แม้ live event เปลี่ยนภายหลัง
12. สถานะข้อมูล unknown และอากาศปกติแยกกันทั้งสี ข้อความ CSV และ API
13. replay ใช้ข้อมูลที่ available ณ เวลาจำลอง; หากมีเพียง reanalysis ให้รายงานเป็น rule sensitivity study ไม่ใช่พิสูจน์ live warning performance
14. ปิด feature/collector/dispatch ได้โดยไม่ทำลายประวัติ และทดสอบ restore ตาม runbook

## 11. ผลส่งมอบของรอบวางแผนนี้
เพิ่มแผนเฝ้าระวังและเชื่อม sessions เดิมแล้ว ขั้นถัดไปยังเริ่มจาก S01 source/runtime inventory พร้อมเพิ่มรายการของ S15 ที่ตรวจคู่ขนานได้ ไม่มีการส่งข้อความภายนอก สมัครบริการ สร้าง production DB หรือตั้ง scheduler ในรอบนี้
