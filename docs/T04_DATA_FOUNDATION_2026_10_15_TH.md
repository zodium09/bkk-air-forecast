# T04 · ประวัติการแก้ค่าและ ingestion health

เพิ่ม revision สำหรับระดับน้ำ ThaiWater ใน D1 และ file store โดยคง API กราฟเดิมให้คืนค่าฉบับล่าสุดต่อ station/datum/observedAt ค่า 0 และค่าติดลบยังเป็นค่าจริง; null, เวลาผิดรูปแบบ, เก่ากว่า 24 ชั่วโมง หรืออนาคตเกิน 5 นาทีไม่ถูกบันทึกตามนโยบายเดิม ไม่เทียบข้าม datum

D1 ใช้ `water_observation_revisions` เป็น journal เพิ่มลำดับเมื่อค่าต่างจากฉบับล่าสุด รวมการแก้กลับไปค่าเดิม รอบซ้ำไม่เพิ่ม revision การแก้ journal และ current projection อยู่ใน D1 batch เดียวกัน สำหรับฐานข้อมูลเดิมที่มีแถวอยู่แล้ว ให้รัน `scripts/backfill-water-revisions.sql` แยกหลัง migration เพื่อยกค่าปัจจุบันเป็น revision 1 โดย `ingested_at=NULL` เพราะไม่มีหลักฐานเวลารับในอดีต ไม่แต่งเวลาขึ้นใหม่ ฐานใหม่ที่ยังไม่มีแถวไม่ต้อง backfill

File store เก็บทุกการแก้เป็นบรรทัดถัดไปใน daily append journal และเพิ่ม `ingestedAt` บรรทัดเก่ายังอยู่เดิม ลำดับบรรทัดเป็นลำดับ revision และการอ่านกราฟเลือกฉบับสุดท้าย นโยบายลบ daily journal หลัง 90 วันยังเป็นของเดิม; D1 revision journal ยังไม่ตั้ง automatic retention เพื่อรักษาหลักฐานการแก้ค่า ผู้ดูแลต้องประเมินพื้นที่เก็บก่อนเปิดระยะยาว File store ใช้สำหรับ local development เท่านั้น

## Migration / rollback

ก่อนใช้ production ให้ตรวจ D1 binding จริงและสำรองฐานข้อมูล ใช้ migration ที่ Drizzle journal บันทึกไว้คือ `0000_last_proemial_gods.sql` แล้ว `0001_productive_daredevil.sql` เฉพาะรายการที่ยังไม่เคยใช้ ทั้งสองไฟล์เป็น schema-only และไม่ต้อง replay; runtime ไม่สร้างตารางระหว่าง request อีกแล้ว ถ้าฐานเดิมมี `water_observations` ให้รัน backfill แยกครั้งเดียวหลัง schema พร้อมตรวจจำนวน observation ก่อน/หลังให้ตรงกัน, revision 1 ครบ และ `ingested_at` ของแถวเก่าเป็น NULL ไฟล์ backfill รันซ้ำได้เพราะ `INSERT OR IGNORE` ไม่มีการเปลี่ยน/ลบตารางเดิม Rollback application ได้โดยคงตารางใหม่ไว้ โค้ดรุ่นเดิมยังอ่าน current projection ได้; ห้าม rollback ด้วยการลบฐานข้อมูล

การอ่าน Sites แบบ read-only วันที่ 16 ต.ค. 2569 พบว่า Site ที่เผยแพร่อยู่ยังไม่มี D1 binding ใน database overview แม้ source manifest ระบุ `d1: DB`; คอนฟิก build ในเครื่องใช้ database ID ตัวอย่าง และ cron `*/5 * * * *` การประกาศใน source ยังไม่พิสูจน์ว่า production มี binding/scheduler หรือข้อมูลเก็บจริง อย่าใช้ผล SQLite ในเครื่องแทนหลักฐานโฮสต์ ก่อนปล่อยรุ่นนี้ต้องยืนยัน provisioning, migration, รอบเก็บอย่างน้อย 2 รอบ และข้อมูลยังอยู่หลัง restart/redeploy

## ตรวจการเก็บโดยไม่สั่งเก็บเพิ่ม

`GET /api/ingestion-health` อ่านเฉพาะ ingestion journal ไม่เรียก upstream, ไม่เขียน snapshot และไม่สั่ง collector แสดง 100 รอบล่าสุด เวลาเริ่ม/จบ จำนวนสถานี normalized ที่ผ่าน/ไม่ผ่านเงื่อนไขเก็บ เวลาตรวจวัดล่าสุดและ lag พร้อม last success ที่พบในหน้าต่าง 100 รอบ จำนวนเหล่านี้ไม่ใช่จำนวนแถว raw ต้นทางที่ parser ไม่รู้จัก รอบที่สำเร็จแต่ heartbeat เกิน 15 นาทีเป็น stale รอบล่าสุดล้มเป็น failed ยังไม่มีรอบเป็น unknown และ store อ่านไม่ได้เป็น unavailable/HTTP 503 ทุก response เป็น no-store

Collector เดิมทั้ง Worker scheduler และ local CLI เขียนผลรอบสำเร็จ/ล้มลง journal ข้อผิดพลาดสาธารณะใช้ข้อความสรุป ไม่เปิด URL หรือ stack ภายใน ยังต้องพิสูจน์ scheduler, D1 binding และ persistence จริงก่อน Gate D ไม่มี deployment ในงานนี้ ค่า available หมายถึงรอบเก็บสำเร็จตามความถี่ ไม่ใช่ทุกสถานีสดหรือสถานการณ์ปลอดภัย; อ่าน observationLagMs และข้อมูลสถานีประกอบ

## หลักฐานทดสอบ

`tests/unit/ingestion.test.mjs` ใช้ SQLite จริงตรวจ schema migration และ backfill แยกรันซ้ำ, legacy preservation, correction/revert/duplicate, file reopen, collector success/failure และ API health แบบ read-only ร่วมกับชุด `water-history.test.mjs` ซึ่งตรวจ datum/zero/retention/API เดิมและสร้างตารางผ่าน migration ก่อนใช้ D1 store
