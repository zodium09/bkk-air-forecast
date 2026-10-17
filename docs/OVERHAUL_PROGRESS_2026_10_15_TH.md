# ความคืบหน้าการยกเครื่อง · 15 ตุลาคม 2569

เอกสารนี้เป็นสถานะ **working tree** เพื่อให้ Sol รับช่วงจาก [แผนหลัก](SOL_OVERHAUL_HANDOFF_2026_10_15_TH.md) และ [รายงานตรวจแอป](APP_OVERHAUL_AUDIT_2026_10_15_TH.md) ได้ทันที ยังไม่มีการ deploy หรือยืนยัน Gate D; อย่าใช้จำนวนสถานีที่เห็นระหว่างทดสอบเป็นค่าคงที่ของระบบ ข้อมูลต้นทางเปลี่ยนตามเวลา

## สิ่งที่ทำแล้ว

| Ticket | สถานะและหลักฐานในโค้ด |
|---|---|
| T01 เนื้อหา | เพิ่มข้อกำหนดปัจจุบันใน `PRODUCT.md`, `DESIGN.md` และ `HYDRO_CONTENT_CONTRACT_2026_10_15_TH.md`; แยกคำว่าเกินเกณฑ์สถานีจากพื้นที่ท่วม, น้ำมากจากเกินเกณฑ์, ค่า 0 จากข้อมูลขาด |
| T03 พื้นที่ | `app/lib/hydro/station-registry.ts` กำหนด canonical source ID, dedupe และ assignment 7 ลุ่มน้ำด้วย polygon จริง; `normalizeHydroWaterLevels` รับสถานีในขอบเขตแม้จังหวัดไม่มีในเมนูเดิม ส่วน legacy adapter ยังเดิม; `central-rain.ts` รับฝนสถานี basin 10 เฉพาะส่วนกลางที่อยู่ใน polygon ดู `T03_STATION_REGISTRY_2026_10_15_TH.md` |
| T04 ข้อมูล | `/api/hydro` ดึงน้ำ ฝน อ่างแยกแหล่ง, บันทึก last-known snapshot แยก source, คำนวณความสดใหม่เมื่ออ่านซ้ำ; scheduled collector รวมสถานีต้นน้ำ; file/D1 เก็บ revision เมื่อแหล่งแก้ค่าที่ timestamp เดิม; `/api/ingestion-health` อ่านรอบเก็บแบบไม่สั่งเก็บเพิ่ม; schema ครบ 4 ตารางและ migration `0001_productive_daredevil` อยู่ใน Drizzle journal แล้ว, backfill แยก, runtime ไม่สร้างตาราง D1 ระหว่าง request รายละเอียดอยู่ใน `T04_DATA_FOUNDATION_2026_10_15_TH.md` |
| T05–T07 สองโหมด | `/` สรุปทั้งระบบ/รายลุ่ม, `/explore` มีรายการ ค้นชื่อ/รหัส แผนที่และกราฟจริง, `/basins/[id]`, `/stations/[id]` ใช้โมเดลเดียว; URL เก็บ basin/station และชุดเทียบ 2–4 สถานี; กราฟเทียบใช้เวลาแกนนอนร่วมแต่แกนตั้ง/หน่วยแยกสถานี พร้อมตารางค่าจริงและสถานะข้อมูลขาด ดู `T07_STATION_COMPARISON_2026_10_16_TH.md`; mobile แสดงรายละเอียดก่อนแผนที่หลังเลือกสถานี |
| T08–T09 ส่วนที่ทำแล้ว | หน้าแรก/เชิงลึก/ลุ่มกลาง–ล่างแยกฝนสถานี, ภาพเรดาร์ตรวจจริง, nowcast, พยากรณ์จังหวัด และตารางน้ำทำนายปากแม่น้ำพร้อมเวลา/หน่วย/แหล่ง; เชิงลึกมีแผนที่เรดาร์และพยากรณ์ 1/3/24 ชม. บอกช่วงที่ผ่านไป, ข้อมูลหมดอายุไม่แสดงเป็นปัจจุบัน; ลุ่มต้นน้ำทั้งหกยังไม่มีพยากรณ์รายลุ่มที่ตรวจรับได้และแสดง coverage gap ชัดเจน ดู `T08_T09_WEATHER_TIDE_CONTEXT_2026_10_17_TH.md` |
| T06/T10 ส่วนที่ทำแล้ว | หน้าแรกแสดงสถานีที่ผู้ใช้ติดตามพร้อมการเปลี่ยนแปลงเฉพาะเมื่อ archive ตรงกับค่าปัจจุบันและมีค่าก่อนหน้าที่ห่าง 5–120 นาที; watchlist เรียงค่าล่าช้า/feed หายก่อนแล้วเรียงการเพิ่ม พร้อมบอกเหตุผลเมื่อเทียบไม่ได้ จำกัด 20 สถานี/อ่านทีละ 4 คำขอ ดู `T06_T10_FOLLOWED_CHANGE_2026_10_18_TH.md` |
| T09–T10 ส่วนเริ่มต้น | `/sources` แสดง coverage และความพร้อมของแหล่ง/ตัวเก็บ, `/watchlist` เก็บ public basin/station IDs ในเครื่อง, มีล้างรายการและลิงก์สถานีแชร์ได้; ข้อมูลเก่าไม่สร้างสถานะภัยปัจจุบัน; แก้ F09/F10 ใน legacy brief ให้ daily rain probability เป็นค่าสูงสุดรายชั่วโมงและแยกค่าปัจจุบันจากเวลาพยากรณ์ที่ผู้ใช้เลือก |
| T12 ส่วนเริ่มต้น | เส้นทางเดิม `/rain`, `/water`, `/air`, `/heat` ยังเปิดได้; แยก handler ออกจาก Next API route หลายตัวเพื่อให้ Next 16 production build ผ่าน; lint ตรวจ authored code โดยไม่รวม generated/output |

`apps/chao-phraya-lab/` เป็นงานเดิมที่ untracked ของผู้ใช้ ไม่แก้และไม่ลบในรอบนี้ ไม่มี commit/PR/deploy จากงานนี้

## ผลตรวจล่าสุด

- Unit 256/256 ผ่าน รวม correction/revert, migration ซ้ำ, source outage/snapshot, boundary ของฝนและน้ำ, unknown province, current → D1 history, datum/เกณฑ์, เวลาร่วมของการเทียบสถานี, ช่วงพยากรณ์รายชั่วโมง/สามชั่วโมงข้ามเที่ยงคืนเวลาไทย และเงื่อนไขเทียบค่าก่อนหน้าของสถานีที่ติดตาม
- Rendered routes 34/34 ผ่านหลัง Cloudflare/vinext build
- `npm run lint`, `npx tsc --noEmit`, `npm test` (Cloudflare build + unit 256/256 + rendered 34/34), `npm run build -- --webpack` ผ่าน (Next/Turbopack เคยติดปัญหา process ภายในเครื่อง จึงตรวจ production ด้วย webpack)
- เบราว์เซอร์ท้องถิ่นตรวจ flow สรุป → เชิงลึก → สถานี/กราฟ → แหล่งข้อมูล, watchlist, back/forward, light/dark, 320/390/768 px ในรอบก่อน T07; หน้าแหล่งข้อมูลหลัง T04 แสดงสถานะรอบเก็บ, ลุ่มปิงแสดงฝนและอ่างจริง; ไม่พบ page overflow ที่ 320/390 px ในหน้ารอบนั้น
- T07 ตรวจจริงบนหน้ากว้าง 1280 px: เลือกสองสถานี, URL คืนชุดเทียบหลังเปิดแท็บใหม่, 24/72 ชั่วโมง, เลื่อนเวลาอ้างอิงร่วม, ตารางค่า 12 เวลา, จุดค่าตรวจวัดเดี่ยว; production browser ทดสอบลบ → back → forward และเทียบข้ามลุ่มเจ้าพระยา/ปิงผ่าน; CSS มี breakpoint 700 px แต่เครื่องมือทดสอบเบราว์เซอร์รอบนี้ไม่ยอมเปลี่ยน viewport จึงยังต้องตรวจ T07 ที่ 320/390/768 px และ text zoom ก่อน Gate D
- T08–T09 ตรวจเบราว์เซอร์ 17 ต.ค.: หน้าสรุปแสดงภาพเรดาร์ตรวจจริงที่มีเวลา, nowcast ที่หมดช่วงถูกปิด, พยากรณ์นครสวรรค์แสดงวันถัดไป/ค่า 0 แยกจากข้อมูลขาด; หน้าเชิงลึกแสดงภาพบนแผนที่และช่วงละ 3 ชม.; ตารางน้ำทำนายเปลี่ยนสถานีจากป้อมพระจุลฯ เป็นท่าเรือกรุงเทพแล้วค่า/เวลาต่างกันจริง หน้ากว้าง 320/390/768 px ไม่ล้นแนวนอน; เมื่อ provider พยากรณ์ไม่พร้อม แอปแสดงช่องว่างแทนค่า ยังต้องตรวจ 200% zoom, screen reader และ fixture กรณีแหล่งข้อมูลล้มก่อน Gate D
- อ่าน Sites ที่เผยแพร่อยู่แบบ read-only ซ้ำวันที่ 18 ต.ค. พบ database overview ยังไม่มี D1 binding แม้ source manifest ระบุ `DB`; ยังไม่มีหลักฐาน production scheduler, D1 persistence/redeploy, screen reader และ 200% text zoom รอบนี้เครื่องมือเบราว์เซอร์ปฏิเสธ local URL จึงไม่อ้างผล visual QA ใหม่

## งานต่อสำหรับ Sol ตามลำดับ

1. **P0 / Gate A–B: จัดหา D1 binding และตรวจ runtime จริง.** Site ที่เผยแพร่อยู่ยังไม่มี D1 binding จึงต้องตรวจ provisioning/deployment path ก่อน; อย่า deploy migration หรืออ้างว่ามีประวัติถาวรจากผล local test สำรอง D1 หากพบฐานเดิม, ใช้ migration ใน Drizzle journal `0000` → `0001_productive_daredevil` เฉพาะที่ยังไม่เคยใช้, รัน `scripts/backfill-water-revisions.sql` แยกเฉพาะฐานที่มีแถวเก่า, เปรียบเทียบจำนวนและตัวอย่าง observation ก่อน/หลัง แล้วตรวจ `/api/ingestion-health` หลัง collector รันจริงอย่างน้อยสองรอบ ตรวจ snapshot เมื่อ ThaiWater ล้มโดยใช้ staging/fixture และยืนยันว่าค่าเก่าถูกลดสถานะ ไม่สรุปภัยใหม่ เกณฑ์รับ: restart/redeploy แล้ว history และ revisions ยังอยู่, health แสดง last success/lag ตรง log, rollback app แบบ additive ทำได้
2. **P0 / T03 ที่เหลือ: master catalog และ reach.** Registry ปัจจุบันอนุมานจาก feed และแก้ unknown province/ID ซ้ำแล้ว แต่สถานีที่เลิกส่งยังไม่มี metadata ถาวร, aliases ข้ามหน่วยงานและทางน้ำต้น–ปลายยังไม่ยืนยัน ตรวจ sample สดทั้ง 7 ลุ่ม, source basin code ที่ขัด polygon และจำนวนจุดนอกขอบเขตก่อน freeze catalog. เกณฑ์รับ: station ID เดิมค้น/แชร์/อ่าน history ได้แม้ feed หาย, สถานีในลุ่มไม่ถูกทิ้งเพราะจังหวัดไม่อยู่ในเมนูเดิม และไม่มีการอ้าง upstream/downstream โดยไม่มี topology
3. **P0 / T07 ปิด Gate UX ที่เหลือ.** เทียบ 2–4 สถานีทำแล้ว; ตรวจ 320/390/768 px, keyboard/screen reader, 200% zoom, URL back/forward หลังเพิ่ม/ลบจริง, สถานี datum ต่าง, ประวัติว่างและ source ล้มบน staging fixture. ดูเกณฑ์ใน `T07_STATION_COMPARISON_2026_10_16_TH.md`
4. **P0 / T08–T09: ปิด coverage และ QA ฝน/น้ำทำนาย.** หน้าใหม่เชื่อมเรดาร์/พยากรณ์จังหวัดตอนกลาง–ล่างและ tide เฉพาะปลายน้ำแล้ว; ต้องหา/ตรวจแหล่งพยากรณ์ครอบคลุมปิง วัง ยม น่าน สะแกกรัง ป่าสักในระดับพื้นที่ที่อ้างได้ ก่อนแสดงค่าในหน้าลุ่มต้นน้ำ ห้ามนำจังหวัดตอนล่างมาแทนลุ่มต้นน้ำ ตรวจ mobile/zoom/screen reader, nowcast live/expired, 1/3/24 ชม. และ source fallback ด้วย fixture ดู `T08_T09_WEATHER_TIDE_CONTEXT_2026_10_17_TH.md`
5. **P1 / T06, T10: ปิดสาระที่ช่วยตัดสินใจ.** หน้าแรกบอกการเปลี่ยนของสถานีที่ติดตามเมื่อมีประวัติเทียบได้แล้ว; ยังต้องทำสรุปช่องว่างระดับทั้งลุ่ม, station master catalog สำหรับ ID ที่ feed เลิกส่ง, ตรวจ first-screen/mobile/zoom และ URL เก่า `province/time/lat/lng` ที่ต้องมี mapping/ข้อความ fallback ที่ตรวจสอบได้ ดู `T06_T10_FOLLOWED_CHANGE_2026_10_18_TH.md`
6. **P1 / T11–T12: ปิดคุณภาพและ rollout.** ตรวจ keyboard, screen reader, 200% zoom, contrast, map tiles blocked, offline/timeout, dark mode, ความเร็ว/ขนาด bundle และทุก route/query เดิม; แก้ metadata/OG และเอกสาร runtime ที่ยังพูดถึงหน้าเดิม; ตรวจ air fallback `/__air4thai` บน runtime หลัก; ทำ staging smoke และ rollback route ก่อนขอเปิดใช้จริง

T13 event feed จริงและ T14 การแจ้งเตือนภายนอก/แบบจำลองน้ำเดินทางยังเป็นโครงการแยกตาม Gate D ในแผนหลัก อย่านำ `/surveillance` fixture หรือ `apps/chao-phraya-lab` มาแสดงเป็นประกาศ/พยากรณ์จริง

## จุดที่ต้องระวังเมื่อทำต่อ

- `/api/hydro` ปัจจุบันบันทึก snapshot และ archive ในระหว่าง GET ด้วย; ประเมิน D1 writes/ค่าใช้จ่ายและความซ้ำซ้อนกับ scheduled collector ก่อนเปิดใช้ traffic จริง อาจย้าย snapshot ให้ collector เขียนและทำ GET อ่านอย่างเดียว โดยรักษา outage semantics ปัจจุบัน collector ตามรอบเก็บเฉพาะน้ำ; snapshot ฝน/อ่างเกิดจาก GET เท่านั้น จึงต้องออกแบบ cadence และแยก health ตาม source ก่อนย้าย
- Source health ตอนนี้ตรวจ **water collector** เท่านั้น ไม่ใช่ heartbeat ของ rain/dam; `/sources` ต้องไม่ทำให้เข้าใจว่าอีกสองแหล่งมี scheduled ingestion
- `lastKnownAt` เป็นเวลาเก็บ snapshot ไม่ใช่เวลาตรวจวัด; อย่าแปลงเป็นเวลาเดียวให้ทุกสถานี
- D1 revision journal ยังไม่ prune อัตโนมัติ; วาง retention/backup หลังวัดขนาดจริงก่อน production ยาวนาน
- UI ใหม่ยังใช้ `HydroApp` ไฟล์เดียวค่อนข้างใหญ่; แยก components ตามหน้าที่เมื่อเพิ่ม comparison/forecast แต่คง shared model และ content helpers
