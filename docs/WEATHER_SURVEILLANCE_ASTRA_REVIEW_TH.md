# Handoff สำหรับ Astra Review — Weather Surveillance Shadow Mode

> อัปเดต 16 ก.ย. 2026: ดู [ผลปรับปรุง UX/UI และแก้ findings รอบล่าสุด](SURVEILLANCE_IMPROVEMENTS_2026_09_16_TH.md) ก่อนตรวจรายการเดิมด้านล่าง โดย lifecycle เปลี่ยนเป็น `reconcileLifecycle` และ snapshot เป็น fixture คงที่แล้ว ยังไม่พร้อมเปิด live dispatch

วันที่ 9 กันยายน 2026
ฐานงาน: `docs/WEATHER_SURVEILLANCE_SYSTEM_PLAN_TH.md`
reference UI ที่ผู้ใช้ให้: `https://lpho-dengue-surv.netlify.app/`

## ขอบเขตที่ขอ review

รอบนี้ทำ vertical slice ของ S15–S18 เพื่อพิสูจน์ contract และ UX ด้วย synthetic fixtures เท่านั้น ยังไม่ทำ S19 live shadow ingestion หรือ S20 external dispatch ขอให้ Astra review แบบ production-readiness review โดยเน้น finding ที่ทำให้ผู้ใช้เข้าใจสถานะผิด, event lifecycle ผิด หรือเปิดช่องให้ client เขียนข้อมูลสำคัญ

## สิ่งที่เปลี่ยน

- `app/lib/surveillance.ts` — types, rule evaluator, lifecycle helper, logical identity และ snapshot fixtures
- `app/surveillance/page.tsx` — dynamic surveillance route
- `app/surveillance/surveillance-dashboard.tsx` — summary, filters, linked map/list, event detail, evidence, timeline, acknowledgement session และ report snapshot
- `app/surveillance/surveillance.css` — responsive/light-dark/print styles; mobile ให้ list มาก่อน map
- `app/components/intelligence/environment-map.tsx` — optional `pointPresentation` สำหรับ marker semantics โดยคง default behavior ของแผนที่เดิม
- `app/components/intelligence/map-workspace.tsx` — ลิงก์เข้าศูนย์เฝ้าระวัง
- `app/api/surveillance/**` — list/detail/health read API และ acknowledgement secure-default 503
- `tests/unit/surveillance.test.mjs` — boundary, missing, stale, replay availability, disabled rule, recovery และ synthetic labeling
- `docs/SURVEILLANCE_IMPLEMENTATION_ISSUES_TH.md` — ประเด็นค้างก่อนเปิดจริง

## จุดที่ต้องตรวจละเอียด

1. `evaluateRule` ต้องไม่คืน `not_met` เมื่อ missing/stale/coverage ต่ำ/source mismatch/future input และ reason code ต้องครบพอ audit
2. `nextLifecycleState` ต้องคง active เมื่อ evaluation เป็น unknown และไม่ resolve ก่อน recovery ครบ
3. official fixture ต้องไม่ดูเหมือนประกาศจริง; ไม่มีการสร้าง polygon หรือ attribution ให้หน่วยงานจริง
4. หน้า UI ต้องแยก severity ออกจาก data quality ทั้งสี ข้อความ รายการ และแผนที่
5. acknowledgement แบบ session ต้องไม่ทำให้ผู้ใช้เข้าใจว่า persist แล้ว และไม่เปลี่ยน lifecycle
6. report snapshot ต้องใช้ `generatedAt`/revision เดิม ไม่ดึงค่าปัจจุบันระหว่างพิมพ์
7. `pointPresentation` ต้องไม่เปลี่ยน marker/title/color ของหน้า PM2.5/ฝน/ความร้อนเดิมเมื่อไม่ได้ส่ง prop
8. API mutation ต้องปิดอย่างชัดเจนจนกว่าจะมี D1 และ actor authorization; ตรวจว่าไม่มี client-controlled severity/evidence path
9. keyboard focus, labels, mobile order และ print output ควรตรง S18 acceptance criteria
10. ตรวจ Cloudflare/Vinext compatibility และ bundle impact จากการ reuse แผนที่เดิม

## คำถามให้ Astra ตัดสิน

- ควรแยก `data_quality` ออกจาก `SurveillanceHazard` เป็น incident domain ต่างหากก่อนทำ schema จริงหรือไม่
- official bulletin ควรมี lifecycle type แยกจาก app event เพื่อบังคับ `cancelled/expired/withdrawn` semantics ที่เข้มกว่าเดิมหรือไม่
- `not_met` ใน hysteresis band ควรเปลี่ยนเป็นผลลัพธ์ `hold` แทนการใช้ previous state ใน reconciler เพื่อให้ audit อ่านง่ายขึ้นหรือไม่
- synthetic fixtures ควรย้ายออกจาก production bundle ไปอยู่ dev/test adapter เมื่อเริ่ม S16 persistence หรือเก็บ endpoint นี้ไว้หลัง admin feature flag
- report snapshot ควร persist เป็น immutable record ตั้งแต่ S16 หรือสร้าง on-demand หลัง S18 เท่านั้น

## Validation ที่ทำแล้ว

- `npm run test:unit` — ผ่าน 77/77 tests
- `npm test` — ผ่าน Cloudflare/Vinext build, unit 77/77 และ rendered/API acceptance 29/29
- `npm run build` — ผ่านรอบสุดท้าย; Next.js compile, TypeScript และ route generation สำเร็จ
- local route `/surveillance` — HTTP 200 และส่ง preview เข้า Codex แล้ว
- `npm run lint` — ผ่านหลังแก้ Next Link 4 จุดและ hook dependency 1 จุดจากรอบแรก

## Known limitations / ห้ามตีความเกินจริง

- ทุก event/value/threshold เป็น synthetic acceptance fixture ไม่ใช่ข้อมูลอากาศจริง
- ไม่มี production DB, durable acknowledgement, actor identity, collector, scheduler, outbox หรือ notification channel
- official feed/API/caching rights ยังไม่ยืนยัน
- หน้า map ใช้ตำแหน่ง centroid จังหวัดเพื่อทดสอบ interaction ไม่ใช่ขอบเขตผลกระทบของเหตุ
- event sorting ใน fixture ยังเป็นลำดับข้อมูลคงที่; ก่อน production ต้องทำ comparator ตาม severity + urgency + valid interval + confidence ที่นิยามใน S15

## รูปแบบผล review ที่ต้องการ

ให้ส่ง finding เรียง P0–P3 พร้อม file/line, ผลกระทบ, scenario ที่ทำให้เกิด และข้อเสนอแก้ที่เล็กที่สุด หากไม่มี blocker ให้ระบุ residual risks ที่ต้องย้ายไป S16–S19 อย่างชัดเจน
