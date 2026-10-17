# แผนส่งต่อ Sol: ยกเครื่องแอปติดตามฝนและน้ำทั้งลุ่มเจ้าพระยา

สถานะ: เริ่ม implementation แล้ว · 15 ตุลาคม 2569 · **ยังไม่เผยแพร่ระบบใหม่** ดู [ความคืบหน้าและงานต่อที่ตรวจรับได้](OVERHAUL_PROGRESS_2026_10_15_TH.md)

อ่านคู่กับ [รายงานวิเคราะห์และหลักฐาน](APP_OVERHAUL_AUDIT_2026_10_15_TH.md) ก่อนเริ่ม ส่วนนี้เป็นแผนต้นฉบับ; `PRODUCT.md` และ `DESIGN.md` อัปเดตทิศทางแล้ว แต่ยังต้องปิด release gates ที่ระบุท้ายเอกสาร

## 1. เป้าหมายที่ยืนยันแล้ว

สร้างเครื่องมือติดตาม **ฝน น้ำท่วมที่มีหลักฐาน และสถานการณ์ทั้งลุ่มเจ้าพระยา** รวมปิง วัง ยม น่าน ป่าสัก และสะแกกรัง ให้มีสองโหมด:

- **สรุปทั่วไป**: เข้าใจสิ่งที่ควรติดตามและข้อมูลที่ยังขาดได้เร็ว
- **ติดตามเชิงลึก**: ตรวจแผนที่ สถานี กราฟย้อนหลัง พยากรณ์ และหลักฐานต่อเนื่องในบริบทเดียวกัน

ให้ข้อมูลเดียวกันตอบทั้งสองโหมด เก็บฝุ่นและความร้อนไว้เป็นหัวข้อรอง เปลี่ยนทั้ง product/content/UX/UI/data โดยรักษากฎความถูกต้องที่พิสูจน์แล้ว

ชื่อทำงาน: **“เจ้าพระยา · ฝนและน้ำ”** ใช้เพื่อออกแบบ ไม่ถือเป็นการอนุมัติชื่อแบรนด์/โดเมนสุดท้าย ขอบเขตมาตรฐานลุ่มน้ำกับชื่อทางภูมิศาสตร์ที่คนทั่วไปใช้ต้องแยกไว้ในทะเบียน ไม่อ้างว่าทุกจังหวัดในเมนูเดิมเท่ากับทั้งระบบลุ่มน้ำ

## 2. วิธีเริ่มงาน

1. อ่าน audit นี้, `PRODUCT.md`, `DESIGN.md`, `docs/CHAO_PHRAYA_COVERAGE_TH.md`, `docs/WATER_DATA_SOURCES_TH.md`, `docs/TIDE_RAIN_ANALYSIS_TH.md` และคำสั่งใน `package.json` จริง
2. ตรวจสถานะ Git ใหม่ก่อนแก้ รอบวิเคราะห์พบ `apps/` เป็น untracked งานเดิมของผู้ใช้ ห้ามลบ ทับ หรือรวมเข้าการเปลี่ยนแปลงโดยไม่แยกขอบเขต
3. บันทึก baseline ของ route/API/data contracts และเปรียบเทียบ screenshot ก่อน/หลัง ใช้ branch `codex/…` หากสร้าง branch
4. ทำงานตาม ticket และ dependency ด้านล่าง ทีละส่วนที่ตรวจรับได้ ไม่รวมการเปลี่ยน providers, schema, navigation และ CSS ทั้งหมดไว้ในก้อนเดียว
5. ปรับเอกสารผลิตภัณฑ์ให้เป็นข้อกำหนดปัจจุบันใน T01 โดยระบุว่าคำตอบผู้ใช้ในแชตนี้ supersede แนวคิดเดิม “ก่อนออกจากบ้าน/ให้สี่หัวข้อเท่ากัน” แต่คงข้อกำหนดความถูกต้องของข้อมูล

ไม่ต้องเลือกผู้ให้บริการฐานข้อมูลใหม่จากความชอบก่อนตรวจ production ที่มีอยู่ และไม่เปิดบริการเสียเงิน/ส่งแจ้งเตือนภายนอกเพียงเพื่อให้ UI ใหม่ครบ

## 3. ขอบเขตรุ่นแรกและสิ่งที่เลื่อนไปก่อน

### รุ่นแรกต้องมี

- ทะเบียนและ coverage ของทุกลุ่มน้ำเป้าหมาย พร้อมสรุปสถานะตามข้อมูลที่มีจริง
- ตัวเลือกพื้นที่แบบ basin → พื้นที่/ทางน้ำ → สถานี; ค้นชื่อและรหัสสถานีได้
- หน้า summary, deep workspace, station detail, source status ที่ใช้ shared data/context
- ฝนตรวจวัด/เรดาร์/พยากรณ์แยกกัน, ระดับน้ำและแนวโน้ม, อ่าง/ระบายตามความถี่ต้นทาง, tide ในบริบทปลายน้ำ
- current/history pipeline ที่เก็บต่อเนื่องและตรวจสอบได้; ข้อมูลเก่าหรือไม่ครอบคลุมไม่กลายเป็น “ปกติ”
- การติดตามสถานีด้วย public IDs ในเครื่อง, URL แชร์บริบท, ประกาศจริงถ้ามีแหล่งที่ตรวจแล้ว มิฉะนั้นลิงก์หน่วยงาน

### หลังรุ่นแรก

- push/LINE/email เมื่อผู้ใช้ขอและระบบ event ผ่านการทดสอบ; login ข้ามอุปกรณ์เมื่อมีความจำเป็น
- ขอบเขตพื้นที่ท่วม/ผลกระทบจากแหล่งที่ยืนยันได้ พร้อมอายุข้อมูลและสิทธิ์เผยแพร่
- แบบจำลอง routing/inundation ที่มีข้อมูลภูมิประเทศ หน้าตัด boundary conditions และ validation แยกโครงการ
- แอปทดลอง `apps/chao-phraya-lab` อยู่แยก: อ่านแนวคิดและใช้ประสบการณ์กราฟได้ แต่กราฟเลื่อนเวลาตามสมมติฐานไม่ใช่ flood forecast ห้ามยกขึ้นหน้าใช้งานจริงในฐานะพยากรณ์

## 4. โครงสร้างหน้าจอและ navigation

เมนูหลักที่เสนอ: **สถานการณ์ / แผนที่และกราฟ / สถานีที่ติดตาม / แหล่งข้อมูล**. การสลับ “สรุปทั่วไป / เชิงลึก” เป็น control เดียวกันทุกหน้า ไม่เพิ่มเป็นเมนูซ้ำกับรายการหัวข้อ

| Route เสนอ | หน้าที่และลำดับเนื้อหา |
|---|---|
| `/` | scope/time → สรุปที่มีหลักฐาน 1–3 เรื่อง → ข้อมูลขาดที่กระทบสรุป → แผนที่ภาพรวม → การเปลี่ยนแปลง/สถานีติดตาม → ประกาศ |
| `/explore` | scope/mode/layer/time → map+list → selected station/event → synchronized charts → table/source details |
| `/basins/[id]` | summary ของลุ่มน้ำ → สถานีและทางน้ำสำคัญ → ฝน/น้ำ/อ่าง → สิ่งที่ต้องติดตามต่อ → coverage |
| `/stations/[id]` | ตัวตน/ทางน้ำ/agency → ค่าล่าสุดพร้อมเวลา → แนวโน้ม/ตลิ่งที่เทียบได้ → history → upstream/downstream references → quality/source |
| `/watchlist` | สถานี/ลุ่มน้ำที่ผู้ใช้เลือก เรียงตามการเปลี่ยนแปลงและข้อมูลล่าช้า; ไม่ต้องมีบัญชีในรุ่นแรก |
| `/sources` | coverage matrix, ที่มา, เวลาอัปเดตล่าสุด, ความถี่, ข้อจำกัด, วิธีอ่าน, วิธีติดต่อ/แจ้งข้อมูลผิด |
| `/air`, `/heat` | คงเส้นทางในหมวด “สภาพอากาศอื่น” ใช้ shell ร่วม |
| `/rain`, `/water`, `*/advanced` | รักษาลิงก์เดิมและ query ที่จำเป็น; ทำ mapping ไป views ใหม่หลังตรวจ parity ห้าม redirect ทิ้งข้อมูลบริบท |
| `/surveillance` | แยก demo อย่างชัดหรือย้าย `/lab/surveillance` พร้อมคำอธิบายและ noindex; ไม่ให้เป็นทางเข้าระบบ event จริง |

โครงหน้าจอสรุปบนมือถือ:

```text
ชื่อผลิตภัณฑ์     [สรุป | เชิงลึก]
[ทั้งระบบลุ่มเจ้าพระยา ▾] [ค้นสถานี]
ข้อมูล ณ ...      ล่าสุดใช้ได้ n/N สถานี
ประเด็นสำคัญ 1 พร้อมเวลาและเปิดหลักฐาน
ประเด็นสำคัญ 2 หรือ “ข้อมูลยังไม่พอสรุป”
[เปิดแผนที่และกราฟ]
แผนที่ภาพรวม + legend ที่อ่านได้
สิ่งที่เปลี่ยน / สถานีที่ติดตาม / ประกาศ
```

โหมดเชิงลึก desktop ใช้ sidebar+map+detail และกราฟด้านล่าง; mobile ใช้แท็บแผนที่/รายการ/กราฟและ detail ที่ปิดกลับได้ โดยคง selection เดิม ไม่ทำให้ทุก panel เรียงเป็นหน้าที่ยาวหลายหมื่นพิกเซล

## 5. สัญญาร่วมที่ต้องออกแบบก่อนทำหน้า

### Context

`mode`, `basinId`, `reachId?`, `stationId?`, `layer`, `timeMode`, `selectedAt?`, `forecastRunId?`, `historyWindow`.

- `timeMode`: latest / history / forecast; “latest” หมายถึง latest available ต่อแหล่ง ไม่ใช่เวลาตรวจวัดพร้อมกันทั้งหมด
- browser back/forward, reload, share และสลับโหมดต้องคืน context ที่รองรับได้
- แหล่งที่เป็นรายวันไม่สร้างรายชั่วโมงขึ้นเอง; เปลี่ยนเวลา forecast ไม่เปลี่ยน observation time
- query ผิดรูปแบบมี fallback พร้อมข้อความ ไม่ค้าง loading และไม่เลือกจังหวัดผิดแบบเงียบ
- geolocation เป็นทางเลือกชัดเจน; ไม่บันทึกตำแหน่งจริงใน share URL/analytics

### Metric และข้อความ

ทุก metric มี `id, labelTh, unit, dataClass, aggregation, intervalDefinition, spatialSupport, sourceRef, precision, missingPolicy` และ formatter กลาง

ค่าแต่ละรายการต้องผูก `observedAt` หรือ `validFrom/validTo`, `issuedAt` ถ้ามี, `ingestedAt`, `sourceId`, `quality`, `coverage`, `datum` เมื่อเป็นระดับน้ำ

สถานะขั้นต่ำ: `loading`, `available`, `partial`, `stale`, `unavailable`, `not-covered`. การเข้า/ไม่เข้าเกณฑ์เป็นอีกแกนหนึ่ง ไม่ยุบกับความพร้อมข้อมูล

### โครงข้อมูลที่เสนอ

| Entity | ข้อมูลสำคัญ |
|---|---|
| Source | provider, product, endpoint policy, licence/attribution, cadence, freshness policy, parser version |
| Basin / Reach | stable ID, parent, polygon/version, verified connectivity, provenance, confidence ของ mapping |
| Station | canonical ID, source IDs, location, basin/reach IDs, agency, metrics, datum metadata, bank threshold/version |
| Observation | station+source+metric+observedAt+datum, value/unit, ingestion time, revision, QC reason, raw reference |
| Forecast run/value | source/model/run/issuedAt, target/grid location, valid interval, aggregation, value/quality |
| Reservoir report | reservoir/date/interval, storage/inflow/release, units, source revision |
| Bulletin | issuer, source URL, issued/valid/expired/withdrawn, geometry หรือพื้นที่ข้อความ, revision |
| App signal | rule/version, evidence IDs, scope, firstSeen/lastSeen, state, reason; ไม่ใช้ชื่อ official warning |
| Ingestion run | source, run ID, start/end, last success, lag, row counts/rejections, errors |

Canonical key ต้อง namespaced ตาม source และ metric ไม่สมมติว่า station ID จากต่าง agency ไม่ชนกัน. ตรวจ duplicate ต่าง source ก่อนรวม; รักษาการแก้ค่าจากต้นทางเป็น revision ไม่เขียนทับโดยไม่มีร่องรอย

## 6. ลำดับงานสำหรับ Sol

ขนาด S/M/L เป็นขนาดสัมพัทธ์ ไม่ใช่คำรับรองวันเสร็จ. Phase A ทำให้ข้อกำหนด/ฐานข้อมูลชัด, Phase B ส่ง vertical slice ที่ใช้งานจริง, Phase C ขยายครบพื้นที่และคุณภาพ, Phase D เพิ่ม event/notification ภายหลัง

| Ticket | ขนาด | ขึ้นกับ | ผลลัพธ์ |
|---|---|---|---|
| T01 Product + content contracts | M | ไม่มี | product ปัจจุบัน, glossary, coverage inventory, decision log |
| T02 Runtime + data foundation | L | T01 | เลือก production path, durable schema, migration/rollback, source registry |
| T03 Full-basin registry | L | T01 | basin/reach/station catalog ครบเป้าหมายพร้อม gaps |
| T04 Collection + history | L | T02,T03 | collector, provenance/revision/QC, health/status API |
| T05 Shared shell/context/design | M | T01 | shell, tokens, URL state, primitive components |
| T06 Summary vertical slice | M | T04,T05 | homepage + basin summary + source evidence |
| T07 Deep workspace + stations | L | T04,T05 | map/list/chart, station detail, comparison, history |
| T08 Rain/reservoir/tide integration | L | T03,T04,T07 | contextual panels และ time semantics ร่วม |
| T09 Content consistency fixes | M | T01,T06,T08 | copy เดียวกันทุก surface; current/forecast/unknown ถูกต้อง |
| T10 Watchlist + share | M | T05,T07 | public ID preferences, deep links, restore context |
| T11 Production hardening | L | T06–T10 | accessibility/performance/failure/recovery/ops gates |
| T12 Route migration + cleanup | M | T11 | old links preserved, docs/CI/CSS สะอาด, rollout/rollback |
| T13 Real event feed | L | T04,T09,T11 | signal lifecycle จริง แยก bulletin/synthetic |
| T14 External notifications/model work | L+ | T13 และความต้องการที่ยืนยัน | โครงการแยกที่มี acceptance/validation ของตัวเอง |

### T01: ข้อกำหนดผลิตภัณฑ์และเนื้อหา

- แก้ `PRODUCT.md`, ทำ `docs/CONTENT_CONTRACT_TH.md`, `docs/COVERAGE_MATRIX_TH.md`, `docs/OVERHAUL_DECISIONS.md`
- inventory ทุก basin × metric × source: coverage, cadence, datum, historical depth, access/licence, priority, gap และ owner
- ค้นพบ source เพิ่มต้องทดสอบตัวอย่างจริงและความหมายก่อนผูก UI; ไม่ถือว่าหน้าเว็บเปิดได้เท่ากับ API พร้อมใช้
- เกณฑ์รับ: ทุกหัวข้อในรุ่นแรกมี definition และ missing-state; ระบุขอบเขตทั้งลุ่มน้ำต่างจากขอบเขตเดิมอย่างไร; P1 F01/F02/F09/F10 มีข้อกำหนดแก้ชัด

### T02: Runtime และ persistence

- จุดเริ่ม: `package.json`, `next.config.ts`, `vite.config.ts`, `vercel.json`, `worker/index.ts`, `db/schema.ts`, `app/lib/water-history-store.ts`
- ตรวจ deployment จริงแล้วเลือกทางหลัก บันทึกเหตุผล ความคงอยู่ของข้อมูล ค่าใช้จ่ายโดยประมาณจากปริมาณงาน และวิธีกู้คืน ไม่เปลี่ยนแพลตฟอร์มโดยไร้เหตุ
- schema ใหม่เพิ่ม source/metric/revision/quality; migrate ประวัติเดิมโดยไม่แต่ง metadata ที่ไม่มี ใช้ unknown/legacy source ตามหลักฐาน
- เกณฑ์รับ: restart/redeploy แล้ว history ไม่หาย; migration นับและตรวจ sample ก่อน/หลัง; rollback แบบ additive; backup/restore ผ่าน; ไม่ใช้ file journal เป็น production persistence โดยไม่พิสูจน์ความคงทน

### T03: ขอบเขตทั้งลุ่มน้ำและทะเบียนสถานี

- จุดเริ่ม: `app/lib/provinces.ts`, `geographic-coverage.ts`, `water-levels.ts`, `chao-phraya-upstream.ts`, ข้อมูล polygon ใน `app/data/`
- แยก station registry ออกจากรายชื่อจังหวัด; ใช้ canonical mapping ร่วม current/upstream/history
- ตรวจพื้นที่ปิง วัง ยม น่าน ป่าสัก สะแกกรัง และเจ้าพระยาหลัก; พื้นที่เสริมเดิมเช่นท่าจีน/มหานครต้องระบุความสัมพันธ์และขอบเขตแยก ไม่เหมารวมเป็นชื่อมาตรฐานลุ่มเดียวกัน
- ฝนในแผนที่ full-basin ใช้ sampling/grid ที่ออกแบบใหม่ ไม่ขยาย road reference ทุกจุดเป็น upstream requests โดยตรงโดยไม่ทำ capacity plan
- เกณฑ์รับ: สถานีทดสอบที่อยู่ในลุ่มน้ำแต่ไม่อยู่จังหวัดชุดเดิมปรากฏใน API/ค้นหา/history; ขอบเขตตัดพื้นที่ถูก; unknown mapping ไม่ถูกทิ้งเงียบ; basin counts ตรวจสอบกลับได้

### T04: Collector และประวัติ

- จุดเริ่ม: `collect-water-observations.ts`, `water-history-store.ts`, `/api/water-levels`, `/api/water-history`, worker scheduled, `scripts/collect-observations.mjs`
- แยก fetching/normalization/QC/storage; บันทึก raw reference และ revisions; bounded retry, timeout, idempotency และ scheduler ที่ไม่ขึ้นกับ page views
- ออกแบบ latest snapshot กับ history read APIs; แยก readiness ของแต่ละ source/basin; cache key ไม่รวมค่า refresh สุ่ม
- แก้ F18: ฝนต้นน้ำ raw payload ราว 5.9 MB cache ใน Next dev รอบตรวจไม่สำเร็จ ต้องตรวจ strategy กับ runtime จริง ทดสอบ hit/expiry/partial snapshot; ไม่ใช้การตั้ง revalidate เป็นหลักฐานว่า cache สำเร็จ
- รองรับ backfill เฉพาะประวัติจริงที่ยืนยัน source/time/สิทธิ์ ไม่มีการ interpolate เพื่อให้ได้ trend
- เกณฑ์รับ: feed ล้มยังอ่าน last-known พร้อมเวลาจริง; repeated fetch ไม่เพิ่ม sample ปลอม; source แก้ timestamp เดิมเก็บ revision; future/invalid/mismatched datum ไม่สร้าง signal; ปิดทุกหน้าแล้วยังมี collector heartbeat และค่าใหม่เมื่อ source เปลี่ยน

### T05: Shell, context และ design system

- สร้าง module ใหม่ขอบเขตชัด เช่น `app/components/hydro/`, `app/lib/hydro/` หรือชื่อที่สอดคล้อง repo ไม่แก้ CSS เก่าด้วย override ต่อท้ายเป็นชั้นใหม่
- primitives: ScopePicker, ModeSwitch, DataStatus, MetricReading, SourceStamp, EvidenceLink, EmptyState, ChartFrame, StationRow, ContextTimeBar
- tokens มี surface/text/action/status/focus ไม่ใช้ topic color เป็น risk โดยปริยาย; body ไทย 16 px เป็น baseline
- เกณฑ์รับ: desktop/mobile และ light/dark ใช้ shell เดียว; focus/keyboard/reduced motion; context encode/decode/reload/back-forward ผ่าน; สลับโหมดไม่เปลี่ยนค่า

### T06: หน้า summary

- แทนหน้า `environment-overview.tsx` ผ่าน view ใหม่ที่เปิดเทียบของเดิมได้ระหว่างพัฒนา
- สรุปแบบ deterministic จากข้อมูล: สิ่งที่เปลี่ยน/จุดเข้าเกณฑ์/ข้อมูลที่ขาด; ไม่สร้างข้อความว่าน้ำจะมาถึงเมื่อไรจากการเรียงสถานี
- ใช้ต้นแบบลุ่มน้ำหนึ่งส่วนที่มีข้อมูลจริงทดสอบ vertical slice ก่อน แล้วขยายผ่าน registry เดียวกันทุก basin ภายในรุ่นแรก ไม่ถือว่าจบงานเมื่อมีเพียง pilot
- เกณฑ์รับ: summary/เวลา/พื้นที่อยู่จอแรก 390×844; ไม่มี air/heat requests ที่จำเป็นต่อการแสดงน้ำ; ทุก claim เปิดหลักฐานตรงรายการ; data unavailable ไม่แสดง safe/zero

### T07: Workspace และ station detail

- ใช้ความสามารถเดิมจาก `risk-area-summary`, map components, `water-overview`, `water-history-chart` ผ่าน adapter ไม่คัดลอก business rules
- เลือกจุด map, แถวรายการ หรือผลค้นหาแล้วใช้ station ID เดียวกัน; detail อยู่ใกล้งานหลัก ไม่กระโดดข้าม tide panel ยาว
- สถานีมี graph+table, ค่าล่าสุด/delta เฉพาะช่วงที่เทียบได้, bank/datum labels, quality และ agency
- comparison 2–4 สถานี: shared time cursor แต่ไม่ปะปน datum และไม่จัดอันดับความเสี่ยงจากระดับ รทก. สูงสุด
- เกณฑ์รับ: map/list/detail ให้ค่าและเวลาตรงกัน; มือถือไม่มี horizontal page overflow; map load fail ยังใช้ list/chart ได้; เลือกสถานีเก่ามีสถานะและกราฟตามข้อมูลจริง; กลับจาก detail คง filter/scroll/selection

### T08: ฝน อ่าง และ tide

- จุดเริ่ม: `rain-radar`, `windy-radar`, `tide-outlook`, `upstream-watch`, `rain-places` และ provider adapters
- กราฟฝนตรวจวัดกับพยากรณ์แยก data class; probability max รายชั่วโมงไม่ใช้ถ้อยคำ whole-day probability
- อ่างแสดงวันที่ source, หน่วย volume/flow ชัด; ประวัติความจุไม่ใช้เป็นโอกาสท่วม; discharge endpoint ใหม่ต้องยืนยันนิยามก่อน
- tide เด่นเฉพาะบริบทปลายน้ำ; พื้นที่อื่นแสดงทางเข้า “บริบทปลายน้ำ”; เกณฑ์ 25 กม. เดิมเป็น selection heuristic ไม่ใช่ขอบเขตอิทธิพลทางชลศาสตร์
- เกณฑ์รับ: ฝน 1/3/24 ชม. รวมตรง interval; ทดสอบเที่ยงคืน; ข้อมูลขาดไม่เติม 0; tide ปีหมดอายุไม่ใช้ซ้ำ; source daily ไม่มี animation/live badge ที่ชวนเข้าใจว่า realtime

### T09: Semantic consistency

- แก้ F05/F06/F09/F10 และใช้ shared content helpers ทุกหน้า
- แยก high-water, bank-exceedance, observed flooding, low-water และ unknown; จำนวนบน tab/map/card/list ใช้ denominator และ filter contract เดียวกัน
- “สถานการณ์ล่าสุด” ต้องระบุเวลาหรือช่วงเวลา ไม่ใช้ fetchedAt แทน observedAt
- เกณฑ์รับ: fixture เดียวให้ข้อความ/หน่วย/สถานะตรงกันทุก surface; daily probability ใช้ max-hour wording; select future date ไม่มี current badge ที่ผิด; outside coverage แสดง not-covered

### T10: ติดตามและแชร์

- saved list เก็บ canonical station/basin IDs พร้อม version/migration ในเครื่อง; มีล้างรายการและข้อความอธิบาย
- URL ใช้ public identifiers เป็นหลัก; mapping query เดิม `province`, `time`, `lat/lng` ต้อง validate และแปลงอย่างโปร่งใส
- เกณฑ์รับ: refresh/switch mode/back-forward ไม่เสียบริบท; shared link เปิด clean browser ได้; bad/deleted ID มี recovery; ไม่ส่ง precise location ผ่าน analytics; ไม่เพิ่มบัญชีเพื่อทำงานง่ายนี้

### T11: ตรวจคุณภาพทั้ง flow

- ตรวจ acceptance matrix ด้านล่าง; ตรวจ production build ไม่ใช้ความเร็ว dev server ตัดสินจริง
- แยก backend health ออกจาก feed freshness; ตั้ง metrics ingestion lag/coverage/gaps และ runbook
- ตรวจ loading/error/partial/stale/not-covered/empty/zero ทุกหน้าหลัก; keyboard/zoom/reduced motion/focus; รายงาน screen reader และ contrast ที่วัดจริง
- เกณฑ์รับ: ไม่มี release-blocking semantic defect; tests เดิมผ่าน; performance targets มี baseline/result; ถ้าข้อมูล source ไม่พร้อมต้องยังเข้าใจสถานะและเปิดหลักฐานเดิมได้

### T12: ย้ายเส้นทางและเก็บงาน

- migration ledger ของทุก route/query เก่า; CSS cleanup หลังพิสูจน์ว่าไม่มีผู้ใช้ selector แล้ว
- แก้ lint ignores สำหรับ generated/output/vendor โดยไม่กลบ authored code errors; แอปทดลองมีขอบเขต lint/test ของตนเอง
- README อธิบาย runtime จริง, commands, deploy, scheduler, storage, backup; DESIGN/PRODUCT เป็นปัจจุบัน; metadata/OG/canonical ตรง scope
- แก้ F19: bridge `/__air4thai` ที่มีเฉพาะ Vite ต้องไม่ถูกเรียกแบบคาดหวังว่ามีใน Next; ทดสอบ fallback path ของ runtime หลักด้วย
- เกณฑ์รับ: links เก่าที่สำคัญเปิดได้และเก็บ context; CI ผ่านจาก checkout สะอาด; staging smoke test current→map→station→history→source ผ่าน; rollback route release ได้โดยไม่ทำลายข้อมูลที่เก็บเพิ่ม

### T13–T14: เฝ้าติดตามจริงและฟีเจอร์ระยะถัดไป

- ใช้แนวคิด lifecycle จาก surveillance เดิมได้ แต่ห้ามสลับ flag ของ synthetic fixture แล้วถือว่า production-ready
- event ต้องมี evidence IDs, rules/version, entry/exit, persistence, dedupe, expiry/withdrawal; official bulletin แสดงผู้ประกาศจริง
- acknowledgment ที่แชร์ระหว่างคนต้องมี identity/authorization/persistence; ถ้าไม่ทำ workflow ทีม ให้เลี่ยงปุ่มที่สัญญาว่ารับทราบแทนทุกคน
- ทดลอง shadow กับข้อมูลจริงและวัด false/repeated alerts ก่อน external delivery; user opt-in/ช่องทาง/ข้อกำหนดส่งเป็นงานที่ต้องยืนยันก่อนเปิด
- แบบจำลองน้ำท่วมเป็นอีก validation track ต้องมีผู้เชี่ยวชาญข้อมูล/ชลศาสตร์ ตรวจ historical hindcast และ uncertainty; ไม่ใช่ dependency ที่ต้องเสร็จก่อนมี monitoring product ที่ดี

## 7. Acceptance matrix สำหรับ release

| Scenario | ต้องเห็น/เกิดขึ้น | วิธีพิสูจน์ |
|---|---|---|
| เปิดครั้งแรก ไม่อนุญาต location | เลือกลุ่มน้ำ/สถานีได้ ไม่มีหน้าตัน | browser clean context + denied location |
| เลือกปิง/วัง/ยม/น่าน/ป่าสัก/สะแกกรัง/เจ้าพระยา | scope และ coverage จริงตรงทุก panel | fixtures ตาม polygon + live sample ต่อ basin |
| สถานีเกินตลิ่ง | ชนิดหลักฐาน เวลา datum และเกณฑ์ชัด | semantic test + screenshot |
| น้ำมากแต่ยังไม่ถึงตลิ่ง | ไม่ถูกนับ/เรียกว่าถึงตลิ่งทั้งหมด | boundary fixtures |
| ไม่มี source coverage | not-covered ไม่ใช่ 0 หรือ safe | outside coverage fixture |
| source ล่ม/เก่า/เวลาอนาคต | คง last-known ที่ติดป้าย หรือ unknown; ไม่สร้างเหตุใหม่ | provider timeout/schema/time tests |
| เก็บรอบเดิม/แก้ค่ารอบเดิม | ไม่ duplicate; revision ตามจริง | storage integration test |
| ปิดหน้าและ redeploy | collector ยังเก็บ; history คงอยู่ | scheduler/store smoke + restore test |
| ดูวันพรุ่งนี้ | forecast เปลี่ยน แต่ observation timestamp ไม่เปลี่ยนตาม | browser interaction + unit time tests |
| ฝนใกล้เที่ยงคืน | ปริมาณมาจากชั่วโมงที่ถูกต้องและครบช่วง | existing boundary tests + adapter contract |
| เปลี่ยนโหมด/เปิดลิงก์แชร์ | basin/station/layer/time เดิมและค่าตรง | end-to-end test |
| แผนที่/tiles ไม่โหลด | list/graph/source ยังใช้งานได้ | block map dependency ใน test |
| 320/390/768/1280/1440 px | ไม่มี page overflow, controls/legend อ่านได้ | visual QA; 200% text zoom เพิ่มต่างหาก |
| keyboard/screen reader | flow ครบ, focus ไม่ติด/ถูกบัง, chart table ใช้ได้ | manual assistive-tech pass |
| tide เปลี่ยนปี | ไม่เอาตารางปีเก่ามาใช้เป็นปีใหม่ | expiry test |
| demo route | ระบุสาธิตชัด ไม่ปะปน feed จริง | route/content test |

## 8. ประตูส่งมอบ

**Gate A: นิยามพร้อม** — T01 พร้อม, ทะเบียนพื้นที่เริ่มต้นและความพร้อม source ตรวจแล้ว, runtime decision มีเหตุผลและผู้รับผิดชอบ. ไม่ต้องรอข้อมูลทุก source จึงเริ่ม UI แต่ทุกช่องว่างต้อง explicit

**Gate B: Vertical slice ใช้งานจริง** — summary → map/list → station → history → source ใช้ข้อมูลจริงผ่าน pipeline ใหม่หนึ่งเส้นทางครบ; สองโหมดค่าตรงกัน; outage test ผ่าน

**Gate C: ครบ scope ผู้ใช้** — ทุกลุ่มน้ำเป้าหมายเข้า registry และทั้งสองโหมดได้ ไม่มีพื้นที่ที่ให้เพียงข้อความต้นน้ำแยกแบบเก่า; coverage ที่ขาดแสดงตรงจริง; T06–T10 ครบ

**Gate D: พร้อมเปิดใช้** — T11–T12 ผ่าน, ตรวจ production scheduler/storage, docs/rollback และรายการข้อจำกัดพร้อม. External notifications และ hydraulic forecast ไม่รวมใน gate นี้

หลักฐานที่ Sol ต้องส่งแต่ละรอบ: ticket IDs ที่เสร็จ, files/contract ที่เปลี่ยน, tests ที่รันและผล, screenshots desktop/mobile ของ flow สำคัญ, known gaps, migration/rollback เมื่อแตะข้อมูล และงานถัดไปตาม dependency

## 9. ข้อควรระวังเฉพาะ repository นี้

- ข้อกำหนดเดิมให้เนื้อหาอ่านต่อเนื่องและสีสดขึ้น ไม่ควรตีความว่าต้องซ่อนทุกอย่างใน accordion หลังยกเครื่อง: สรุปสั้น แต่หน้ารายลุ่มน้ำ/สถานียังคงเนื้อหาหลักให้อ่านต่อเนื่อง
- global `body` และ style จากหลายรุ่นมีผลต่อ scrolling; ตรวจ shell/height/overflow ก่อนเพิ่ม sticky UI
- ประวัติเดิม D1 เขียนทับค่าที่ key เดิม ส่วน file store ข้าม duplicate; ต้องกำหนด correction policy ให้เหมือนกันเมื่อ migrate
- root lint ปัจจุบันลาก generated files ใน output มาตรวจ; แก้ scope ก่อนใช้จำนวน lint errors เป็นตัวชี้คุณภาพ product
- ชุดทดสอบ 234 รายการผ่านในวันที่วิเคราะห์ แต่ไม่ใช่หลักฐานว่า deployment ใหม่ผ่านหรือพยากรณ์แม่นยำ
- ไม่เพิ่มการคำนวณเวลาน้ำถึงปลายทางจากระยะหรือ time-shift ของ lab; ถ้าไม่ทราบให้บอกว่ายังไม่มีแบบจำลองเวลามาถึง
- ไม่เปิดสิทธิ์ ส่งข้อความภายนอก หรือเผยแพร่ deployment เพียงเพราะเอกสารนี้เขียน workflow ไว้ ตรวจอำนาจอนุญาตของงานที่ผู้ใช้มอบหมายจริงก่อนขั้นนั้น

## 10. ข้อความเริ่มงานที่นำไปส่งให้ Sol ได้

> ทำการยกเครื่องแอปใน D:\MywebApps\bkkair ตาม docs/APP_OVERHAUL_AUDIT_2026_10_15_TH.md และ docs/SOL_OVERHAUL_HANDOFF_2026_10_15_TH.md เป้าหมายคือเครื่องมือติดตามฝน น้ำท่วมที่มีหลักฐาน และสถานการณ์ทั้งลุ่มเจ้าพระยา รวมปิง วัง ยม น่าน ป่าสัก และสะแกกรัง มีสองโหมด สรุปทั่วไปและติดตามเชิงลึก ใช้ข้อมูล/เกณฑ์/context เดียวกัน เริ่มจาก T01–T05 แล้วส่ง vertical slice T06–T07 ที่มี pipeline/history จริง จากนั้นขยายจนครบ scope และผ่าน T11–T12 รักษา null/zero/datum/time/provenance และ tests เดิม อย่าใช้ synthetic surveillance หรือการเลื่อนกราฟใน lab เป็นข้อมูลจริง ตรวจงาน untracked ใน apps/ และรักษาไว้ รายงานงานเป็น ticket พร้อมเกณฑ์ตรวจรับและหลักฐาน ไม่จบเพียง mockup หรือเปลี่ยนสีหน้าแรก หากเรื่องโฮสต์หรือสิทธิ์ source ยังไม่ชัด ให้ทำส่วนอิสระต่อพร้อมระบุ decision ที่ต้องการอย่างเจาะจง

ข้อความนี้เป็น artifact สำหรับส่งต่อ ยังไม่ได้ส่งไปยังแชตอื่นหรือเริ่ม implementation โดยอัตโนมัติ
