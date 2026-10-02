# Review และวิเคราะห์ประเด็นค้าง — Weather Surveillance

วันที่ตรวจ: 9 กันยายน 2026

## ข้อสรุป

สถานะที่เหมาะสมคือ **synthetic UI/API prototype ของบางส่วน S15–S18** ไม่ใช่ระบบที่ผ่าน S15–S18 และยังไม่ใช่ S19 shadow evaluation กับข้อมูลจริง ยังไม่พร้อมเปิด live monitoring หรือ external dispatch

ตรวจโค้ดเทียบแผนและเอกสาร handoff โดยถือข้อความในเอกสารเป็นบริบท ไม่ใช่คำสั่งให้เปิดบริการหรือแก้ระบบ รอบนี้ไม่มีการแก้โค้ดแอพ สร้างฐานข้อมูล หรือส่งข้อความภายนอก

ไม่พบหลักฐานผลกระทบ P0 ในขอบเขตที่ตรวจ: payload เป็น synthetic, health ระบุ persistence/dispatch ปิดอยู่ การจัด P1 ด้านล่างหมายถึงต้องแก้ก่อนนำ evaluator ไปใช้จริง ไม่ได้หมายความว่าระบบกำลังส่งคำเตือนผิดให้ประชาชน

## Findings เรียงความสำคัญ

### R1 — P1: Quality gate ยอมรับ input ที่ผิด contract

- จุดอ้างอิง: `app/lib/surveillance.ts:140` โดยเฉพาะเงื่อนไขบรรทัด 147–156; input contract ที่บรรทัด 42
- ทำซ้ำแล้ว: `availableAt`/`validTo` เป็น `invalid`, coverage เป็น `NaN`, window 60 นาทีแทน 180 นาที และกฎที่ effectiveFrom อยู่ปี 2027 ต่างคืน `met` เมื่อประเมินวันที่ 9 กันยายน 2026
- สาเหตุ: การเปรียบเทียบ NaN ไม่เข้าเงื่อนไขปฏิเสธ; ไม่ตรวจความยาว/ลำดับ window, effective date และ lead range; input ไม่มี metric/unit/datasetClass ให้ตรวจเทียบกฎ
- Forecast ใช้ validTo วัดความสด จึงรับ forecast ที่ available ตั้งแต่ 1 สิงหาคมแต่มี valid interval ในอนาคตเป็น `met` ได้ ยังไม่มี run-issued timestamp ให้แยกอายุ model run ออกจากช่วงมีผล
- ผลกระทบ: ข้อมูลผิดหน่วย/ช่วงเวลา/ความสดอาจผ่านเป็นสัญญาณได้ ไม่เพียงพอสำหรับ S17
- แก้ขั้นต่ำ: ตรวจ finite/range ของค่าทุก field, parse timestamp แบบปฏิเสธข้อมูลผิด, ตรวจ temporal/metric contract และแยก freshness ของ observation กับ forecast run; คืน unknown/suppressed พร้อม reason code ตามสาเหตุ
- ตรวจรับ: invalid/reversed/window mismatch, coverage นอก 0–1, future observation, old forecast run, lead range และ effective date ต้องมี negative tests

### R2 — P1: Lifecycle ยังไม่มี persistence/hysteresis ที่ใช้งานได้จริง

- จุดอ้างอิง: `app/lib/surveillance.ts:172` และตัวสร้าง fixtures ที่บรรทัด 224
- ทำซ้ำแล้ว: entry 35 / exit 20 / value 30 ให้ `not_met`; เมื่อส่ง recoverySamples=2 helper คืน `resolved` ทั้งที่ค่ายังสูงกว่า exit 20
- `nextLifecycleState(null, 'met', 0, 2)` เปิด active ทันที แม้กฎกำหนด persistenceSamples=2; cooldown ไม่ถูกใช้
- helper เชื่อจำนวน recovery ที่ caller ส่งมา จึงยังไม่ได้พิสูจน์ว่าเป็น input คนละชุดและต่อเนื่องจริง อีกทั้งไม่มี caller ของ helper ใน app: สถานะและ timeline ของ fixtures ถูกเขียนไว้ล่วงหน้า
- ผลกระทบ: เมื่อนำไปต่อ pipeline อาจเปิดเหตุเร็ว ปิดเหตุเร็ว หรือเปิดซ้ำโดยไม่ผ่าน cooldown; timeline จำลองไม่ใช่หลักฐานว่า engine ทำงาน
- แก้ขั้นต่ำ: ให้ reconciler รับ previous state และ input identity/revision ที่ตรวจแล้ว นับ unique consecutive samples และใช้ exit threshold แยกจาก entry; จัดการ unknown, terminal states และ cooldown ตามนโยบาย
- ไม่จำเป็นต้องเพิ่ม evaluation `hold`: คง met/not_met/unknown/suppressed ได้ โดยให้ reconciler บันทึก transition reason เช่น hysteresis-band hold
- ตรวจรับ: threshold oscillation, duplicate input, unknown คั่น recovery, cooldown และ late/out-of-order revision

### R3 — P2: Event revision เดิมไม่ได้ระบุเนื้อหาเดิมข้าม request

- จุดอ้างอิง: `app/lib/surveillance.ts:224`, `app/api/surveillance/events/route.ts:6`, `app/api/surveillance/events/[id]/route.ts:7`
- ทำซ้ำแล้ว: snapshot เวลา 03:00Z กับ 04:00Z มี id `evt-rain-bangkok-demo` และ revision 2 เหมือนกัน แต่ validFrom เปลี่ยนจาก 06:00Z เป็น 07:00Z
- ผลกระทบ: list/detail ที่เรียกคนละเวลาอ้าง revision เดียวกันแต่ให้เนื้อหาต่างกัน ไม่ใช่ immutable audit record ปัจจุบัน UI ตรึง prop ระหว่างเปิดหน้าได้ แต่เปิดใหม่แล้วเรียกคืน snapshot เดิมไม่ได้
- แก้ขั้นต่ำใน demo: ใช้ fixture clock คงที่หรือระบุ fixture scenario/version ชัด; ก่อนจริงให้ revision อ้างข้อมูล immutable และรายงานมี snapshot ID พร้อมทางเรียกคืน
- ตรวจรับ: list/detail และ report ที่อ้าง revision/snapshot เดิมต้องให้เนื้อหาเดิม แม้มีข้อมูลใหม่เข้าระบบ

### R4 — P2: การรับทราบไม่ผูก revision ที่เห็น

- จุดอ้างอิง: `app/surveillance/surveillance-dashboard.tsx:176`, `:186`, `:202` และ `:163`
- UI เช็คเพียง state=acknowledged หรือ event ID ใน session ไม่เทียบ acknowledgement.eventRevision กับ event.revision
- มี fixture revision 4 แต่ acknowledgement revision 2 ซึ่ง UI ยังแสดง “รับทราบแล้ว”; ผู้ใช้ไม่เห็นชัดว่านั่นคือการรับทราบฉบับเก่า
- ผลกระทบ: เมื่อมี material update ระบบอาจนับว่า revision ใหม่รับทราบแล้วและไม่เปิดให้รับทราบอีก
- แก้ขั้นต่ำ: เก็บ session key เป็น event ID + revision และแสดง last acknowledged revision แยกจาก current revision; กำหนดชัดว่าการเปลี่ยนแบบใดต้องรับทราบใหม่ ไม่ลบประวัติเดิม
- ก่อน persistence: เพิ่ม server actor authorization และ public response serializer ที่ไม่ปล่อย actor/note ภายในออกจาก API ปัจจุบันข้อมูลเหล่านี้ยังเป็น synthetic ไม่ใช่หลักฐานการรั่วไหลของบุคคลจริง

### R5 — P2: รายงานพิมพ์ขาดหลักฐานตาม acceptance ของ S18

- จุดอ้างอิง: `app/surveillance/surveillance-dashboard.tsx:281` และ `app/surveillance/surveillance.css:207`
- report list พิมพ์เพียงพื้นที่/หัวข้อ/ชื่อ/revision/valid interval ส่วน print CSS ซ่อน evidence, rule, freshness และรายละเอียดทั้งหมด
- ไม่มี source, rule version, coverage/ข้อจำกัดเฉพาะเหตุ หรือ current assessment ทั้งที่ข้อความหน้า report ระบุว่าตรึงแหล่งข้อมูลและข้อจำกัดไว้
- ผลกระทบ: เอกสารที่ส่งต่อใช้อ้างย้อนกลับถึงกฎและหลักฐานไม่ได้ เป็นปัญหาของฟังก์ชันพิมพ์ที่มีแล้ว ไม่ใช่แค่รอ production DB
- แก้ขั้นต่ำ: สร้าง report view จาก snapshot เดียว โดยแสดง source, rule version (ประกาศทางการใช้ bulletin identity/revision), assessment/quality, valid interval และข้อจำกัด; ระบุชัดว่ารายงานทั้งพื้นที่หรือเฉพาะตัวกรอง
- ตรวจรับ: ตรวจ rendered print/PDF จริง ไม่ใช่ค้นคำจาก HTML/RSC payload อย่างเดียว

### R6 — P2: หัวข้อ PM2.5 สูญหายเมื่อเหตุเป็น data quality

- จุดอ้างอิง: `app/lib/surveillance.ts:294`, `app/surveillance/surveillance-dashboard.tsx:178` และ `:255`
- เหตุ “ยังประเมิน PM2.5 ไม่ได้” ถูกตั้ง hazard=data_quality; เมื่อเลือกหัวข้อ PM2.5 จึงถูกกรองออก
- ผลกระทบ: ผู้ใช้ที่ติดตาม PM2.5 ไม่เห็นเหตุข้อมูลขาดในรายการ แม้ empty state จะเตือนว่าไม่เท่ากับอากาศปกติแล้วก็ตาม
- แก้ขั้นต่ำ: คง affected hazard=pm25 และแยก incident kind/data quality เป็นอีกแกน; severity ไม่ควรใช้ unknown แทนคุณภาพข้อมูลของ hazard
- ไม่จำเป็นต้องแยกหลายตารางทันที แต่ domain contract และ query ต้องรักษาความสัมพันธ์ระหว่างหัวข้อกับ incident

## ช่องว่าง UX/contract รองลงมา

- `surveillance-dashboard.tsx:272` อ้างว่าเรียงตามระดับ/ช่วงเวลา/คุณภาพ แต่ `filtered` มีเพียง filter ไม่มี sort; ทำ comparator ที่ deterministic หรือเปลี่ยนคำอธิบายระหว่าง demo
- `:254` สร้างจังหวัดจากเหตุที่มี ไม่ใช่พื้นที่เฝ้าระวังทั้งหมด ทำให้เลือกจังหวัดที่ไม่มี fixture event เช่นสมุทรสาครไม่ได้
- `:152` ระบุว่าประกาศแสดง issuer/id/revision แต่ไม่ได้ render ค่า issuer/bulletinId จาก source จริง ควรแสดง field และข้อจำกัดต้นฉบับอย่างตรงไปตรงมา
- `:248` freshness panel ไม่แสดง validAt/checkedAt; `:133` evidence ไม่แสดง validInterval แม้ payload มีอยู่
- `:196` เลือก event จากพิกัดใกล้ที่สุด ไม่ใช่ marker event ID; เมื่อหลาย hazard ใช้ centroid จังหวัดเดียวกันไม่สามารถเลือกแต่ละเหตุจากตำแหน่งนั้นได้ ต้องใช้ event ID หรือรายการเลือกกลุ่ม
- summary และ report ใช้ active ทั้งหมด ไม่ตามตัวกรอง ปัจจุบันยังอธิบายขอบเขตไม่ชัด ควรเลือกนโยบายและติด label ก่อนยืนยันว่าตัวเลขตรงกัน

## สถานะจริงเทียบแผน

| Session | หลักฐานปัจจุบัน | สิ่งที่ยังไม่ผ่าน |
|---|---|---|
| S15 | มี type และตัวเลข fixture | source/rule matrix ที่ยืนยัน หน่วย/window/freshness และเจ้าของเกณฑ์ |
| S16 | มี read API และ identity helper | schema/migration, durable revisions, reconciliation, transactions และ actor permissions |
| S17 | evaluator ขั้นต้นและ 6 unit tests | R1/R2, input identity, chronological replay และ historical replay |
| S18 | UI/API demo, session ack, print view | R3–R6, contract/UX ช่องว่าง และ browser/keyboard/mobile/print verification |
| S19 | ยังไม่พบ pipeline ประเมินข้อมูลจริง | real-input shadow run, case review, metrics และ rollback acceptance |
| S20 | dispatch ปิด | ช่องทางที่อนุญาต, consent, outbox/retry/canary และ runbook |

## วิเคราะห์ประเด็นค้าง: อะไรต้องรอ อะไรเดินต่อได้

1. **ต้องมีเจ้าของตัดสินก่อนเปิดกฎจริง:** threshold/window/freshness และเจ้าของรับผิดชอบ; ยังเขียน validation, reconciler และ tests ด้วย fixture ต่อได้ ไม่จำเป็นต้องหยุดงานพัฒนาทั้งหมด
2. **official feed ยังไม่ยืนยัน:** ปิดเฉพาะ official branch ที่ไม่พร้อม; ตรวจ source contract/สิทธิ์และออกแบบ fixture ได้ ไม่ควรให้บล็อกทุก hazard
3. **ฐานข้อมูล/runtime:** ต้องเลือกตาม runtime ที่ใช้งานจริงก่อน provision; การที่ยังไม่มี D1 ไม่ได้ขัดขวางการออกแบบ schema/migration และทดสอบ locally และไม่ใช่เหตุให้ต้องใช้ D1 โดยอัตโนมัติ
4. **persistence กับ auth:** เป็น blocker ของ durable ack/audit ไม่ใช่เหตุให้เลื่อนการแก้ revision semantics ใน UI; ข้อมูล actor/note ต้องมี public/private contract ก่อนเชื่อมจริง
5. **replay acceptance:** ต้องกำหนดช่วง/จำนวนกรณี/ผู้ review และวิธีวัด false positive/missed signal; tests ที่ผ่านหรือไม่มีเหตุช่วงทดลองไม่ยืนยันความแม่นยำ
6. **ช่องทางและ consent:** เป็น dependency ของ S20 เท่านั้น เริ่ม in-app monitoring และ S19 ที่ไม่ส่งภายนอกได้เมื่อ prerequisites ของตัวเองผ่าน

## ข้อเสนอเพื่อตัดสินใจจาก handoff

- แยก hazard, signal/incident kind, assessment quality และ severity ใน contract ก่อน schema จริง ตาม R6
- ใช้ discriminated union สำหรับ official/app/quality event เพื่อบังคับ field และ transition ที่ต่างกัน ไม่จำเป็นต้องสร้าง subsystem หรือฐานข้อมูลแยก
- ให้ hysteresis เป็น state transition policy พร้อม reason code ไม่เพิ่ม `hold` เพียงเพื่อซ่อนการใช้ entry แทน exit
- แยก demo fixture adapter จาก real-data adapter และใช้ explicit demo flag; ห้าม fallback ข้อมูลจริงที่ล้มเหลวเป็น synthetic โดยเงียบ
- เริ่ม immutable event revisions ใน S16 และกำหนด report snapshot identity/retention ก่อนตรวจรับ S18 ไม่ต้องคัดลอก raw measurements ทั้งชุด

## ลำดับงานที่แนะนำ

1. เพิ่ม regression tests ให้ R1/R2 ล้มเหลวก่อน แล้วแก้ evaluator/reconciler โดยยังไม่ต่อ live dispatch
2. ปรับ domain contract, revision-aware ack และ immutable fixture snapshots ตาม R3/R4/R6
3. ทำ S16 schema/migration และ idempotent reconciliation ผูก asset/run/revision; ทดสอบ duplicate, concurrency และ out-of-order
4. ปิดช่องว่าง S18 โดยเฉพาะ report, attribution, filters/map และ browser/print QA
5. เมื่อ source/rule contract ได้รับยืนยัน จึงทำ S17 replay → S19 real-data shadow → พิจารณา S20 แยกอีกครั้ง

## หลักฐานการตรวจรอบนี้และข้อจำกัด

- รัน `node --experimental-strip-types --test tests/unit/surveillance.test.mjs`: ผ่าน 6/6
- รัน read-only probes เรียก evaluator/lifecycle/snapshot โดยตรง: ทำซ้ำ R1, R2 และ R3 ได้ตามผลข้างต้น
- test ชื่อ “matching window” ใช้ validFrom 02:00Z ถึง validTo 04:00Z = 120 นาที แต่ rule.windowMinutes=180 (`tests/unit/surveillance.test.mjs:22`, `:38`, `:45`) จึงยังไม่ได้พิสูจน์ window matching
- test recovery ส่งจำนวน samples เข้าฟังก์ชันโดยตรง ไม่ได้ทดสอบว่าระบบนับ consecutive unique inputs ได้จริง
- ผล full build/lint/77 unit/29 rendered tests ใน handoff เป็นผลของรอบก่อน ไม่ได้รันซ้ำทั้งหมดในการ review นี้
- ยังไม่ได้ตรวจ interaction ใน browser, keyboard, mobile viewport หรือผลพิมพ์จริง ข้อสังเกต UI/print มาจากการอ่าน source; ไม่ได้ตรวจความถูกต้องทางวิชาการของ threshold เพราะทั้งหมดเป็น fixture
