# T03 · ทะเบียนสถานีและขอบเขตลุ่มน้ำ

แก้ช่องว่าง adapter เดิมที่รับเฉพาะจังหวัดในเมนู โดยเพิ่ม `normalizeHydroWaterLevels` สำหรับผลิตภัณฑ์ลุ่มน้ำ ส่วน `normalizeWaterLevels` และ legacy `/water` รักษา province filtering เดิม รวมสถานี metro ที่อยู่นอก polygon ลุ่มน้ำตาม behavior เดิม ไม่ขยายเมนูจังหวัดโดยปริยาย

## สัญญาปัจจุบัน

`app/lib/hydro/station-registry.ts` กำหนด `canonicalBasinForStation` เป็นจุดเดียวสำหรับ assignment จากพิกัด ตรวจ polygon ปิง 06 วัง 07 ยม 08 น่าน 09 สะแกกรัง 11 ป่าสัก 12 ก่อนส่วนกลาง–ล่าง แล้วคืน null หากอยู่นอกขอบเขต ไม่ใช้จังหวัดหรือชื่อทางน้ำเดา basin จุดทับขอบมีลำดับแน่นอนตามรายการนี้ จึงเข้าลุ่มเดียว

ขอบเขตต้นน้ำใช้ DWR 22-basin polygons ที่บันทึกใน `app/data/chao-phraya-upstream-basins.json` และส่วนกลางใช้ `core` ใน `app/data/chao-phraya-geography.json` ตามผลิตภัณฑ์เดิมใน repo ไม่ใช้ bounding rectangle แทน polygon Adapter ลุ่มน้ำรับทุกสถานีที่พิกัดอยู่ใน 7 ลุ่ม รวม unknown province หรือ source basin code ที่ไม่ตรงกับ polygon โดยอาศัยพิกัดจริงและระบุ province unknown ตามหลักฐาน

`canonicalStation` คืน ID namespaced `thaiwater:waterlevel:<source-id>`, source ID/alias, ชื่อ หน่วยงาน พิกัด datum, basin mapping, source validity จาก normalized status และ observedAt; reachId เป็น null เพราะยังไม่มี connectivity ที่ตรวจแล้ว public URL/history ยังคงใช้ ThaiWater source ID เดิม ไม่ย้าย key ประวัติเดิมหรือสร้าง ID ใหม่มาทำให้ history ขาด

`canonicalWaterStations` เลือกหนึ่งสถานีต่อ ThaiWater ID โดยให้ค่าที่ใช้ได้และเวลาล่าสุดมาก่อน กรณีเวลาเท่ากันเลือกตัวแรกอย่างแน่นอน view model รวม feeds แล้ว dedupe ก่อนแบ่งลุ่ม จึงไม่แสดง ID เดียวซ้ำข้ามลุ่ม Collector ใช้ adapter/registry เดียวกันและเก็บ source ID, datum, observedAt เดิมลง archive การแก้ค่าที่ timestamp เดิมยังผ่าน revision policy T04

## หลักฐาน

`tests/unit/station-registry.test.mjs` ตรวจ fixture พิกัดในทั้ง 7 ลุ่ม, code 10/unknown province ที่อยู่ใน polygon, metro ที่อยู่นอก polygon, legacy behavior เดิม, ID ซ้ำ/อนาคต/คนละลุ่ม และ collector→SQLite history ที่คงค่า 0, ID, datum และเวลาตรวจวัด ชุดร่วมกับ water-levels/hydro/ingestion ผ่าน 23/23 ณ รอบตรวจนี้ TypeScript และ lint ไฟล์ที่แก้ผ่าน

## ข้อจำกัดที่ยังต้องทำ

- นี่เป็น registry ที่อนุมานจาก snapshot feed ไม่ใช่ master catalog ถาวร สถานีที่ feed เลิกส่งยังไม่มี metadata catalog แยกหรือ alias ที่ยืนยันข้ามหน่วยงาน
- ไม่มีการยืนยัน reach/upstream/downstream connectivity หรือการรวมหลาย agency IDs ให้เป็นสถานีกายภาพเดียวกัน; null หมายถึงยังไม่ทราบ ไม่คาดเวลาน้ำเดินทาง
- Fixture พิสูจน์ contract/geometry ไม่ได้แทนการสำรวจสถานีจริงล่าสุดทั้ง 7 ลุ่ม ต้องตรวจตัวอย่าง source จริงและนับ exclusions ด้วย feed ณ วันที่นำขึ้น production
- Source basin code ที่ขัดกับพิกัดยังไม่ได้เก็บ conflict journal; assignment มีความหมายเป็น polygon membership ตามไฟล์ขอบเขต ไม่ใช่การรับรอง hydrological connectivity
- ไม่ migrate D1, ไม่ deploy และไม่แก้ UI ในงานนี้ `/api/hydro` ผูก adapter ใหม่แล้ว ส่วน `/api/water-levels` ใช้ตัวเดิมต่อ
