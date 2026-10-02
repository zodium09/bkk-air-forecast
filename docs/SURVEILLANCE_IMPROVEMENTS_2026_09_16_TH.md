# Surveillance: ผลปรับปรุงและส่งต่อ Astra review

วันที่ 16 กันยายน 2026 — ขอบเขต /surveillance และ shared map contract เท่านั้น

## สถานะ

ปรับ UX/UI และแก้ findings ของ prototype แล้ว แต่ยังเป็น synthetic shadow-mode fixtures ไม่ใช่ข้อมูลสถานการณ์จริง ไม่มี deploy, production DB, scheduler หรือ external notifications

ติดตั้ง Impeccable จาก pbakaus/impeccable ลง C:/Users/BMAGID5/.codex/skills/impeccable ใช้ SKILL.md และ reference operate/polish/craft-floor ประกอบการปรับงาน คงอัตลักษณ์เดิมจาก PRODUCT.md และ DESIGN.md ตัว context launcher ไม่ส่งผลลัพธ์จึงหยุดและอ่านเอกสารบริบทโดยตรง

## การแก้ตาม review

| Finding | สิ่งที่แก้ | ข้อจำกัด |
| --- | --- | --- |
| R1 Quality gate | ตรวจ timestamp, coverage finite/range, metric/unit/dataset class, exact window, future availability, observation validity และ forecast run/lead/freshness; กฎยังไม่ effective ถูก suppressed | ต้องตรวจ configuration ของ live rule และ source adapter เพิ่มเมื่อเชื่อมจริง |
| R2 Lifecycle | เปลี่ยนเป็น reconcileLifecycle reducer: consecutive entry/recovery, hysteresis, duplicate/out-of-order rejection, cooldown, terminal states | เป็น pure reducer ที่ unit-test เท่านั้น ยังไม่ต่อ D1 transaction และ fixture statuses/timelines ยังเขียนไว้ล่วงหน้า ห้ามอ้างว่าพิสูจน์ live lifecycle แล้ว |
| R3 Snapshot | default fixture ใช้เวลาอ้างอิงคงที่; custom scenario มี snapshot/event identity ต่างกัน | ยังไม่ใช่ immutable revision storage หรือ evidence archive ของระบบจริง |
| R4 Acknowledgement | ตรวจ eventRevision, session key id@revision, KPI และประวัติแยกฉบับปัจจุบัน | ไม่ persist และ mutation API ยังปิด; ต้องมี actor authorization/audit ก่อนใช้จริง |
| R5 Print | รายงานตามตัวกรองมี revision, validity, source, rule version, coverage, evidence, acknowledgement และคำเตือน fixture | ยังไม่มี server-persisted report snapshot, hash/signature หรือ policy retention |
| R6 PM2.5 | quality event ใช้ hazard pm25 และ signalKind data_quality ทำให้กรอง PM2.5 แล้วไม่หาย | ไม่ได้อนุมัติเกณฑ์ PM2.5 สำหรับเปิด live |

## UX/UI

- ลำดับสายตาชัดขึ้น: ชื่อหน้า → คำเตือนชุดสาธิต → สรุป → สุขภาพข้อมูล → คิว/แผนที่/หลักฐาน
- ลดคอลัมน์แคบและกรอบซ้อน เพิ่มตัวอักษร/ระยะห่าง โดยคงสี navy, teal, amber ของ BKK Air
- จังหวัดครบหกพื้นที่ มี empty state/reset และลำดับรายการตามสถานะ/ระดับ/ช่วงมีผล
- KPI กับรายงานใช้ตัวกรองเดียวกัน ยกเว้นสถานะแหล่งข้อมูลที่ระบุชัดว่าเป็นทุกแหล่ง
- การคลิก marker ส่ง event ID; คลิกพื้นที่ว่างไม่เดาเหตุที่ใกล้ที่สุด
- มือถือ list-first และเปิดรายละเอียดพร้อมย้าย focus/เลื่อนเข้า viewport
- ประกาศแสดง issuer/bulletin/revision และลิงก์ต้นทางเมื่อมี; fixture ไม่มีต้นฉบับต้องบอกตรง ๆ

## หลักฐานตรวจสอบ

- Unit tests 95/95 ผ่าน
- Rendered HTML/API tests 29/29 ผ่าน
- Next.js production build ผ่าน
- Cloudflare/Vinext build ผ่านรอบสุดท้ายหลังแก้ข้อความรับทราบ/focus/map selection
- ESLint ผ่านรอบสุดท้าย; production build ตรวจ TypeScript ผ่าน
- Browser verification: 1440, 390, 320 px ไม่ horizontal overflow; PM2.5 ไม่ซ่อน quality event; จังหวัดไม่มีเหตุแสดง empty state/reset; เลือกเหตุ focus รายละเอียด; รับทราบแล้วปุ่ม disabled; print มี source
- ภาพตรวจ: output/playwright/surveillance-desktop-final.png, surveillance-theme-final.png, surveillance-mobile-detail.png
- รายงานตัวอย่าง: output/playwright/surveillance-report.pdf
- สคริปต์ตรวจจริง: output/playwright/verify-surveillance.txt (playwright-cli run-code --filename)
- Dev Turbopack เคยตอบ 404 ใน session เดิม; webpack dev เปิด route ได้ และ production Turbopack build ผ่าน ไม่ได้แก้ config ทั้งโปรเจกต์เพื่อ workaround

## ประเด็นค้างก่อนเปิดจริง / ให้ Astra ตรวจต่อ

1. อนุมัติ rule matrix โดยผู้เชี่ยวชาญ รวม threshold, metric, averaging window, persistence, exit/cooldown และ source freshness
2. เชื่อม live ingestion กับ reducer ผ่าน transactional persistence; นิยาม sample identity/revision correction, replay retention, episode reopening และหลาย worker ให้ชัด
3. วาง D1 schema/migrations, authorization, audit trail และ revision conflict handling; public API ไม่ควรเผย actor/note ที่เป็นข้อมูลส่วนบุคคล
4. ยืนยัน official feed, สิทธิ์ cache/เผยแพร่ซ้ำ, cancellation/expiry/scope และ attribution
5. แผนที่ยังใช้ centroid จังหวัดและ marker อาจซ้อนเมื่อหลายเหตุอยู่จุดเดียวกัน; รายการเป็นทางเลือกที่เลือกเหตุได้ครบ ต้องออกแบบ cluster/offset ก่อนมีเหตุจำนวนมาก
6. ตรวจ print pagination และ keyboard/screen-reader จริงเพิ่มเติม; ปัจจุบันมี automated focus/visible checks ไม่ใช่ accessibility audit เต็มรูปแบบ
7. ไม่ถือว่าหน้าอื่นผ่าน visual regression เต็มรูปแบบ: shared map เปลี่ยนเพียง optional ID ใน selection payload แต่ต้อง smoke-test live providers ก่อน release
8. ยังไม่มี end-to-end live-shadow soak test, failure/retry monitoring หรือ notification approval; อย่าเปิดส่งแจ้งเตือนจากผลผ่าน unit tests

## คำสั่งส่งต่อ review

ตรวจ app/lib/surveillance.ts, app/surveillance/**, shared EnvironmentMap และ tests/unit/surveillance.test.mjs เทียบ WEATHER_SURVEILLANCE_PENDING_REVIEW_TH.md โดยให้ findings พร้อม severity/file/line ก่อนสรุป readiness เน้น reducer integration gap, corrected input identities, revision-scoped acknowledgement และ print evidence ห้ามเปิด production mutation หรือ deploy ระหว่าง review
