# แผนฐานข้อมูลย้อนหลัง การเชื่อมต่อ และการทำงานทีละ session — BKK Air

ปรับขอบเขตล่าสุด9กันยายน2026: รวม [แผนระบบเฝ้าระวังอากาศ S15–S20](D:/MyWebApps/bkkair/docs/WEATHER_SURVEILLANCE_SYSTEM_PLAN_TH.md); แผนรวม20sessionsโดยมีงานขนานตาม dependency
ปรับแผนวันที่ 8 กันยายน 2026 • สถานะ: แผนพร้อมดำเนินงาน พร้อมหลักฐานทดสอบอ่านข้อมูลขนาดเล็ก

เอกสารนี้ขยาย [แผน Dashboard และรายงาน](D:/MyWebApps/bkkair/docs/WEATHER_ANALYTICS_REPORT_REDESIGN_PLAN_TH.md) ตามคำขอใหม่ ให้ข้อมูลย้อนหลังและการเก็บพยากรณ์แต่ละรอบเป็นงานหลักก่อนการวิเคราะห์ย้อนหลัง ทั้งสองเอกสารยังเป็นแผน ไม่มีการสร้างฐานข้อมูล production เปิด collector หรือ deploy ในรอบนี้

## 1. เป้าหมายและขอบเขต
ผู้ใช้ต้องอ่านได้ว่าเกิดอะไรขึ้นในอดีต พื้นที่/ฤดูกาลต่างกันอย่างไร และเมื่อสะสมพยากรณ์ที่ตรวจสอบที่มาได้แล้ว ระบบเคยพยากรณ์ได้ใกล้เคียงเพียงใด ขอบเขตแรกคือกรุงเทพฯ นนทบุรี ปทุมธานี สมุทรปราการ สมุทรสาคร และนครปฐม

เริ่ม pilot อากาศ 30 วัน 6 จุดตัวแทนจังหวัด ก่อนขยายจำนวนจุดตามความละเอียดจริงของกริดและงบประมาณ เป้าหมาย weather backfill แรกคือ 2021–2025 ซึ่งเป็นข้อเสนอช่วงดำเนินงาน ไม่ใช่การยืนยันว่าได้นำเข้าหรือผ่าน QC แล้ว ส่วน PM2.5 ใช้ปี/สถานีที่ตรวจพบจริง ไม่บังคับทุกแหล่งให้มีห้าปีเท่ากัน ค่าเฉลี่ยห้าปีต้องเรียกฐานเปรียบเทียบช่วงดังกล่าว ไม่เรียกค่าปกติภูมิอากาศ 30 ปี

## 2. ทะเบียนแหล่งข้อมูลที่เสนอ
| แหล่ง / product | ประเภทและช่วงที่เอกสารระบุ | วิธีเชื่อม / การใช้ในแผน | ข้อจำกัดและสถานะ |
|---|---|---|---|
| [Open-Meteo Historical Weather / ERA5](https://open-meteo.com/en/docs/historical-weather-api) | reanalysis, ERA5 ตั้งแต่1940, กริดประมาณ0.25° | GET archive API ระบุ models=era5; hourly temperature/RH/rain; ฐานแนวโน้มอากาศ | probe สำเร็จ7วัน; ข้อมูลแบบจำลอง มีความหน่วงการอัปเดต ไม่ใช่ตรวจวัดสถานี |
| [PCD PM2.5 กรุงเทพฯ–ปริมณฑล](https://data.go.th/dataset/air-quality-bangkok-metropolitan-region1) | ตรวจวัดรายวันรายสถานี; metadata ปี2554–2567 | CSV รายปี → unpivot → station registry → daily observations | ทดลองไฟล์2024สำเร็จ; ยังไม่ยืนยันความครบทุกปี/สถานี; catalog ระบุ Open Data Common ต้องเก็บข้อความสิทธิ์และ attribution ของ resource ที่ใช้ |
| [Open-Meteo Air Quality / CAMS Global](https://open-meteo.com/en/docs/air-quality-api) | modeled PM2.5 ย้อนหลังตั้งแต่สิงหาคม2022; native global0.4°/3h | GET air-quality API ระบุ domains=cams_global; ใช้แนวโน้มเชิงพื้นที่แบบจำลอง | probe สำเร็จ7วัน; API hourly ไม่ใช่ native hourly และไม่ใช่ข้อมูลสถานี |
| [Open-Meteo Previous Runs](https://open-meteo.com/en/docs/previous-runs-api) | พยากรณ์ระยะนำย้อนหลัง fixed lead; coverage ขึ้นกับรุ่น/ตัวแปร | previous_day1 ฯลฯ สำหรับ benchmark ที่นิยามชัด | probe GFS temperature lead1day สำเร็จ; ไม่ใช่หลักฐานผล bias correction ของแอพในอดีต |
| [Open-Meteo Single Runs](https://open-meteo.com/en/docs/single-runs-api) | พยากรณ์เลือก model run; archive coverage ต่างตามรุ่น | candidate สำหรับรอบเฉพาะ หลังตรวจ availability และ operational/hindcast | ยังไม่ probe; model initialization ไม่รับรองเวลาที่ผู้ใช้เข้าถึงจริง |
| [TMD Data Service](https://data-service.tmd.go.th/) / [เงื่อนไขบริการ](https://tmd.go.th/service/tmdData) | สถานีอากาศย้อนหลังตามคาบและสถานีที่มี | track ขอข้อมูล: สถานี วันที่ ตัวแปร QC และสิทธิ์เผยแพร่ | มีขั้นลงทะเบียน/คำขอและค่าบริการ; ยังไม่รับรอง public historical API ฟรี หรือ coverage ที่ต้องการ |
| [TMD WeatherToday V2 catalog](https://data.go.th/th/dataset/c1-1-3-4) | feed สรุปตรวจอากาศรายวัน | candidate เก็บใหม่ต่อเนื่องหลังตรวจคู่มือและ probe | ไม่ถือวันที่สร้าง catalog เป็นปีเริ่มข้อมูล; ยังไม่ยืนยัน date-range API |
| [Air4Thai](https://epo14.pcd.go.th/th/news/detail/192261) / [AirBKK](https://policy.bangkok.go.th/tracking/frontend/web/index.php?ID=4626&r=site%2Fprojectview) | แหล่งสถานีที่แอพใช้อยู่สำหรับข้อมูลล่าสุด | เก็บใหม่เมื่อยืนยันนิยาม averaging window และสิทธิ์; discovery archive แยก | หน้าเว็บดูย้อนหลังได้ไม่ได้แปลว่ามี bulk API; history contract ยังไม่ยืนยัน |
| [CAMS EAC4](https://ads.atmosphere.copernicus.eu/datasets/cams-global-reanalysis-eac4?tab=overview) | atmospheric reanalysis ตั้งแต่2003, global0.75°/3h | ทางเลือก PM ระยะยาวภายหลัง; ตรวจการเข้าถึงและ GRIB/NetCDF extraction | ยังไม่ probe; ความละเอียดหยาบและเป็นคนละ product กับ CAMS forecast ห้ามต่อ series เงียบ ๆ |
| ผลพยากรณ์ BKK Air ที่ capture ใหม่ | ผลที่แอพสร้างจริงตาม version/run ที่มี | เก็บ raw provider + normalized app output ตั้งแต่ S04 | อดีตก่อนเริ่มเก็บอาจกู้คืนไม่ได้; ไม่มี issuedAt ให้คง null |

[Historical Forecast API](https://open-meteo.com/en/docs/historical-forecast-api) เป็นอนุกรมต่อเนื่องที่ประกอบจากรอบพยากรณ์ล่าสุด ไม่ใช้แทน full issued run เพื่อสรุปว่าผู้ใช้เห็นพยากรณ์อะไรในวันนั้น การใช้ Open-Meteo ต้องตรวจ [เงื่อนไขแผนบริการ](https://open-meteo.com/en/pricing) ให้ตรงรูปแบบการใช้ รวม attribution และโควตาจริงก่อนขยายงาน ไม่ถือว่าฟรีทุกกรณี

## 3. หลักฐานทดลองเชื่อมต่อรอบวางแผน
ทดสอบแบบอ่านอย่างเดียววันที่8กันยายน2026 ไม่ได้นำข้อมูลทั้งหมดเข้าฐาน และจำนวนค่าที่ไม่ว่างไม่ใช่ผลรับรองความถูกต้องทางอุตุนิยมวิทยา

| Probe | ขอบเขตและผล | สิ่งที่ยังต้องตรวจ |
|---|---|---|
| ERA5 archive | พิกัดร้องขอ13.7563,100.5018; 1–7ก.ย.2025; HTTP200; temp/RH/rain อย่างละ168ค่า ไม่ว่าง168; timezone Asia/Bangkok; cellที่คืน13.75,100.5 | ช่วงอื่น wind และ coverage ทั้งพื้นที่; requested coordinate ไม่ใช่ returned grid coordinate |
| CAMS Global PM2.5 | พิกัดเดียวกันและ7วันเดียวกัน; HTTP200;168/168ค่า; returned13.800003,100.5 | native resolution, revision และสถานะ retrospective product |
| GFS Previous Runs | 1–2ก.ย.2025; temperature_2m_previous_day1; HTTP200;48/48ค่า | ตัวแปร/lead/model อื่นและ reference pairing |
| PCD CSV2024 | HTTP200 text/csv,554670bytes; Date+96stationcolumns;366วันที่จริง1ม.ค.–31ธ.ค.2024 | มีค่าว่างและแถวไม่มีวันที่; parserพบ4345recordsก่อนกรอง; ต้องตรวจหน่วย/QC/ทะเบียนสถานีและไฟล์ปีอื่น |

[ไฟล์ PCD2024 ที่ตรวจ](https://pcd.gdcatalog.go.th/dataset/78495048-ce78-4b53-b6b9-63610fc9e841/resource/0ffc0ce3-bad5-4daf-9223-8212b165ac15/download/pm2.52024.csv) มีสถานี96คอลัมน์ แม้ชื่อ catalog ระบุกรุงเทพฯ–ปริมณฑล จึงต้องจับคู่สถานีและจังหวัดจากทะเบียนที่เชื่อถือได้ก่อนกรองหกจังหวัด ห้ามถือทุกคอลัมน์เป็นสถานีในพื้นที่เป้าหมาย

ตัวอย่างคำขอที่ใช้เป็น fixture seed (ไม่ใช่การรับรองว่า schema จะไม่เปลี่ยน):

```text
https://archive-api.open-meteo.com/v1/archive?latitude=13.7563&longitude=100.5018&start_date=2025-09-01&end_date=2025-09-07&hourly=temperature_2m,relative_humidity_2m,rain&models=era5&timezone=Asia%2FBangkok
https://air-quality-api.open-meteo.com/v1/air-quality?latitude=13.7563&longitude=100.5018&start_date=2025-09-01&end_date=2025-09-07&hourly=pm2_5&domains=cams_global&timezone=Asia%2FBangkok
https://previous-runs-api.open-meteo.com/v1/forecast?latitude=13.7563&longitude=100.5018&start_date=2025-09-01&end_date=2025-09-02&hourly=temperature_2m_previous_day1&models=gfs_global&timezone=Asia%2FBangkok
```

## 4. สัญญาข้อมูล: ป้องกันการวิเคราะห์ผิดประเภท
ต้องมี datasetClass อย่างน้อย observation, reanalysis, forecast_archive, local_forecast_capture, derived และมี sourceProduct/modelVersion/appVersion/derivationVersion ตามความเกี่ยวข้อง ข้อมูล IDW หรือ aggregate ยังคงเป็น derived หลังบันทึก DB ไม่เปลี่ยนเป็นสถานีจริง

เก็บเวลาแยกกัน: issuedAt/modelRunAt (ถ้าต้นทางให้), validStart/validEnd, fetchedAt/capturedAt, ingestedAt และ firstAvailableAt เมื่อมีหลักฐาน สำหรับการถามว่า “ณ วันนั้นรู้ข้อมูลอะไรแล้ว” ต้องตรวจเวลา availability/capture ด้วย เวลา init ของโมเดลเพียงอย่างเดียวไม่พอ

ทุกค่าต้องผูก metric, unit, temporalAggregation, interval duration, location identity/version, requested coordinate, returned grid/station coordinate, provenance, QC/missing reason และ revision/source asset hash อย่าเก็บ provider เดียวระดับ response แล้วทำให้ TMD rain mm กับ Open-Meteo probability ถูกติดแหล่งเดียวกัน

กติกาคำนวณ:
- เก็บ UTC สำหรับเวลาอ้างอิง และระบุ timezone/ขอบวัน Asia/Bangkok เมื่อรวมรายวัน; daily station data เก็บวันที่ท้องถิ่นและช่วงอ้างอิงที่ผู้ให้ข้อมูลนิยาม
- ฝนเป็นผลรวมตาม interval ตรวจ convention preceding hour กับวันท้องถิ่น; ห้ามบวก daily กับ hourly ที่ครอบช่วงเดียวกัน
- PM daily ไม่สร้าง hourly เทียม; ค่าว่างไม่เป็น0; trace/เครื่องหมายผิดปกติต้องมี mapping ที่ตรวจสอบได้
- Heat Index คำนวณจาก temp/RH ณ เวลาเดียวกัน ด้วยสูตรและ version ที่ระบุ แล้วจึงหา daily max; apparent temperature ไม่ใช่ HI ของแอพโดยอัตโนมัติ
- แยก mean(point maxima) กับ max(spatial mean); ค่าเฉลี่ยสถานีไม่ใช่ area-weighted mean
- การเปลี่ยนสถานี พิกัด เครื่องมือ หรือ model product มี effective dates และ marker ใน series
- ไม่เติม confidence interval จาก heuristic; เทียบ reanalysis ให้เรียก reference แบบจำลอง ไม่เรียกตรวจวัดจริง

## 5. การเชื่อมต่อและจัดเก็บ
โครงที่เสนอ: Provider API/CSV → raw asset + checksum → validation/normalization → observations หรือ forecast values → daily aggregates/coverage → history API → shared selectors → dashboard/report snapshot

ฐานปัจจุบัน db/schema.ts ยังว่าง และ .openai/hosting.json ยังไม่มี D1/R2 binding ที่ใช้งานยืนยันได้ แม้ db/index.ts อ้าง Cloudflare env.DB และมี Drizzle SQLite อยู่แล้ว ต้องตรวจ runtime ที่ deploy จริงใน S01 เพราะโครงการยังมีไฟล์ Next/Vercel ด้วย

เริ่ม local SQLite และไฟล์ raw ใน pilot ถ้า runtime จริงเป็น Cloudflare ให้ประเมิน D1 สำหรับ metadata/daily aggregates และ R2 สำหรับ raw/bulk hourly/run archives ตามรูปแบบ query ถ้าเป็น runtime อื่นให้เลือก DB/object storage ที่ใช้ได้กับ runtime นั้นก่อนเขียน production adapter ไม่สมมติว่า cloudflare:workers ใช้ได้ทุกที่

แยก connection configuration ฝั่ง server: endpoint allowlist, timeout, retry policy, credentials ผ่าน secret bindings, source product และ rate budget; client เรียก API ของแอพ ไม่เรียกฐานข้อมูล/secret ตรง ๆ รายงานผลล้มเหลวแบบไม่มี token หรือ payload ส่วนตัว

### ตารางเชิงตรรกะสำหรับ S03
| กลุ่ม | ข้อมูลสำคัญและ identity |
|---|---|
| source_products | provider/product/class, units/schema version, attribution/access status, cadence และ availability ที่ยืนยัน |
| location_versions | station/grid id, lat/lon, province, effective period, registry provenance; requested points แยก mapping เข้ากริด |
| ingestion_batches / raw_assets | source/range/cursor/status, counts, checksum, storage key, fetchedAt, error summary, retry/revision |
| observations | source+locationVersion+metric+valid interval+revision; value/unit/QC/raw asset; current revision view แยกจากประวัติ |
| forecast_runs / forecast_values | stable run/capture id + location+metric+valid interval; issuedAt ที่มีหลักฐาน, lead, app/model version; reference raw |
| daily_stats / coverage | aggregation version, expected/valid/excluded count, scope, source revision, value และ completeness status |
| verification_pairs | forecast id/reference revision/lead/window/matching method; สร้างเมื่อ S11 จำเป็น ไม่ต้อง precompute ทุก combination |

ใช้ unique constraints และ transactional batch เพื่อ rerun ไม่ซ้ำ หาก issuedAt ไม่ทราบ ใช้ capture id ที่เสถียรและ checksum ไม่ใช้ nullable issuedAt เป็นตัวกันซ้ำหลัก เพราะ SQLite unique กับ null อาจไม่กันตามที่คาด เก็บ revision เก่าให้ replay รายงาน/การประเมินเดิมได้ ไม่ overwrite เงียบ ๆ

### ขนาดและต้นทุน
ตัวอย่างขอบเขต54จุด ×1826วัน (2021–2025) ×24ชั่วโมง ×4ตัวแปร = **9,465,984 scalar values** ยังไม่รวม revisions, forecast runs และ indexes; daily เท่ากับ98,604 location-days หรือ394,416ค่าเมื่อมี4ตัวแปร ทั้งนี้54จุดอาจตกกริดเดียวกันหลายจุด ต้อง deduplicate native cell ก่อน ไม่อ้างว่ามี54แหล่งอิสระ

วัด bytes/row, raw compression, API credits, write amplification และ query scan จาก S05 ก่อนขยาย [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) และ [pricing](https://developers.cloudflare.com/d1/platform/pricing/) มีข้อจำกัดขนาด/โควตาตาม plan จึงไม่ควรเท scalar archive ทั้งหมดลง D1 โดยยังไม่ประมาณต้นทุน [R2](https://developers.cloudflare.com/r2/) เป็นตัวเลือกเก็บไฟล์ bulk; รูปแบบ Parquet/JSON และ serving aggregates ต้องเลือกตาม query จริง ไม่เพิ่มระบบ ETL ขนาดใหญ่ตั้งแต่ pilot

## 6. Ingestion และความครบถ้วน
แบ่ง batch ตาม source/product/location หรือ native cell/เดือนตามข้อจำกัดต้นทาง อ่านย้อนหลัง30วันก่อน แล้วจึงขยายปีผ่าน checkpoint ห้ามมี request เดียวรอทั้งห้าปี ลำดับต่อ batch คือ fetch → save raw/checksum → validate → normalize → transaction → update coverage/cursor

CSV PCD: ตรวจ encoding/BOM → กรองแถววันที่จริง → parse d/M/yyyy ชัดเจน → ตรวจชื่อ station column → unpivot → blank เป็น null → join registry → validate duplicate/outlier/QC → commit แถวผิดรูปต้องมี reject log; สถานีที่ยังระบุไม่ได้อยู่ quarantine ไม่แสดงบนแผนที่ด้วยพิกัดเดา

retry เฉพาะ transient errors ด้วย exponential backoff+jitter และ Retry-After; จำกัด concurrency ตาม source budget; schema/unit เปลี่ยนให้หยุด batch และรายงาน ไม่ retry จนเขียนค่าผิด เงื่อนไข timeout/429/5xx และไฟล์เสียต้องมี fixture ทดสอบ

เก็บ ledger ของช่วง requested/received/valid/missing/rejected และ earliest/latest verified ต่อ metric/location/product “ข้อมูลครบ” ต้องเทียบ expected cadence ที่ต้นทางรองรับ ไม่หารด้วยจำนวนที่ได้รับเอง หากข้อมูลรายวันไม่มีจำนวนชั่วโมง QC ให้บอก coverage รายวันเท่านั้น

การแก้ข้อมูลย้อนหลังต้องสร้าง revision และ rebuild aggregate เฉพาะช่วงที่กระทบ source มี delay ให้ re-fetch หน้าต่างล่าสุดตามพฤติกรรมที่ตรวจพบ; การ backfill ปิดปีแล้วให้ตรวจ checksum/revision เป็นรอบตามความจำเป็น ไม่ดาวน์โหลดทุกปีทุกครั้ง

collector พยากรณ์เริ่มเก็บใน S04 แบบ manual validation ก่อน production scheduling ใน S14 ระยะรันต้องสัมพันธ์ provider update และ actual availability ไม่เรียกทุกนาทีเพื่อให้ดูสด ห้ามสร้างพยากรณ์ย้อนหลังปลอมด้วยการนำ reanalysis มาใส่ issuedAt ในอดีต

## 7. API และหน้าวิเคราะห์
เส้นทางที่เสนอ (ต้องตรวจ naming ร่วมกับโค้ดจริงใน S08): GET /api/history, /api/history/coverage, /api/forecast/runs และ /api/verification โดย history รับ product/class, locations, metrics, from/to, cadence; runs แยก issued/captured time กับ valid time; ส่ง units/aggregation/coverage/provenance/revision กลับเสมอ

จำกัด date range/จำนวน location/page size; ใช้ server aggregation กับช่วงยาวและคง extrema/ผลรวมที่ metric ต้องการ ไม่ส่งหลายล้านแถวเข้า browser cache key ต้องรวม source product, dataset class, range, metric/cadence, location version และ revision

UI เลือกประเภทข้อมูลก่อนช่วงเวลา: “ตรวจวัด”, “ย้อนหลังจากแบบจำลอง”, “พยากรณ์ที่จัดเก็บ” แล้วแสดงวันแรก/ล่าสุดและช่วงขาดจริง Run picker แยกจาก valid-date picker; current forecast ไม่มีประวัติรอบเก่าต้องบอกตรง ๆ ตารางและ CSV ต้องมีข้อมูลเดียวกับกราฟ

YoY ใช้เดือน/วันและ window ที่เทียบได้ ระบุ leap day และจำนวนปีที่มีข้อมูล; เมื่อ source/station เปลี่ยนแสดงเส้นแบ่งและห้ามต่อ trend เสมือนชุดเดิมโดยไม่มีคำอธิบาย rain chart ใช้ bars, probability0–100%; กราฟ PM/HI แยกหน่วยและความหมาย ไม่ใช้แกนคู่ที่ชวนอ่านว่าตัวเลขเทียบตรงกัน

## 8. การประเมินพยากรณ์
S11 ทำได้เมื่อมีคู่ที่เทียบกันได้ แยก temperature/rain accumulation/PM ตามหน่วยและช่วงเวลา เลือกวิธีจับคู่สถานีกับ grid พร้อมระยะห่างและข้อจำกัด เก็บจำนวนคู่ จำนวนที่ตัดออก ระยะนำ model/app version และ reference class

ใช้ MAE/bias/RMSE ตามความเหมาะสมของตัวแปร ส่วน probability ต้องมี event definition/threshold และ paired observations ก่อนคำนวณ Brier score; อย่าใช้ probability เทียบ mm ตรง ๆ “skill” ต้องเทียบ baseline ที่ระบุ เช่น persistence และแยก evaluation window จาก calibration/training เพื่อป้องกันข้อมูลรั่ว

ข้อมูล GFS Previous Runs ใช้ประเมิน product นั้น ไม่สรุปความแม่นยำ BKK Air ที่ผ่าน bias correction ในอดีต หากเก็บ local forecast ยังไม่พอ ให้แสดง coverage/จำนวนคู่และรอสะสม โดยไม่บล็อก dashboard กับรายงานย้อนหลังที่พร้อมแล้ว

## 9. ลำดับ session
หนึ่ง session คือหน่วยงานที่มีผลตรวจรับ ไม่ใช่ระยะเวลาตายตัว งานใหญ่แบ่งต่อ S07a/S07b ตาม source/year และ checkpoint ห้ามเปิด batch ไม่จำกัดเพื่อพยายามจบในครั้งเดียว ทุก session ยังไม่เริ่ม implementation; probe ในหัวข้อ3เป็นงานเตรียมที่ใช้ต่อได้

| Session | งานหลัก | ผลส่งมอบ / เกณฑ์ผ่าน |
|---|---|---|
| S01 | ยืนยันแหล่งข้อมูลและ runtime | registry มีสถานะ verified/probed/pending และตัดสิน local/Cloudflare ตามหลักฐาน |
| S02 | พิสูจน์การเชื่อมต่อและ field mapping | mapping พร้อมตัวอย่างสำเร็จ/ผิดพลาด; ยังไม่รับรอง coverage ทั้งประเทศ/ทุกปี |
| S03 | ออกแบบ schema และ storage | นำเข้าซ้ำไม่เพิ่มข้อมูลซ้ำ; เก็บ revision และกู้คืน batch ได้ |
| S04 | เริ่มคลังพยากรณ์แต่ละรอบ | สอง capture แยกชัดและ replay ได้; ไม่ใช้เวลารับข้อมูลแทนเวลาออกรอบ |
| S05 | นำร่องอากาศย้อนหลัง | ตรวจวันข้ามเดือน/ช่วงฝน/หน่วย/coverage; รายงาน bytes และเวลาที่ใช้จริง |
| S06 | นำร่อง PM2.5 สถานี | ทุกสถานีที่แสดงมีที่มา/ขอบเขตยืนยัน; daily ไม่ถูกแปลงเป็น observed hourly |
| S07 | นำเข้าย้อนหลังเป็นช่วง | มี checkpoint/coverage ledger; หยุดและ resume ได้ ไม่มีการอ้างปีที่ยังไม่ได้อ่าน |
| S08 | เชื่อม API และ selectors | API/table/KPI เห็นช่วงข้อมูลและตัวเลขตรงกัน; missing ไม่เป็นศูนย์ |
| S09 | แดชบอร์ดฝนและมุมมองย้อนหลัง | คลิก/คีย์บอร์ด/มือถือผ่าน; downsampling รักษาผลรวมฝนและช่วงขาด |
| S10 | PM2.5 ความร้อน และพื้นที่ | ไม่เฉลี่ยสถานีเท่ากับค่าเฉลี่ยพื้นที่โดยไร้นิยาม; HI aggregation ถูกต้อง |
| S11 | ประเมินพยากรณ์ | ไม่รั่วข้อมูลอนาคต; แยกเทียบสถานีกับ reanalysis; ตัวอย่างไม่พอแสดงว่าไม่พอ |
| S12 | รายงานสามประเภท | เปิดค้าง/refresh ไม่เปลี่ยนรายงานเดิม; metadata และ coverage อยู่ในเอกสาร |
| S13 | ตรวจระบบและต้นทุน | ผ่าน critical cases, มี recovery runbook และขอบเขตค่าใช้จ่ายที่วัดจาก pilot |
| S14 | นำขึ้นใช้และส่งมอบ | มีเจ้าของงาน/บันทึกการรัน/alert ที่ดำเนินการได้ และหยุด collector ได้ |

### รายละเอียดการทำงานและคำสั่งเริ่มครั้งถัดไป
**S01 — ยืนยันแหล่งข้อมูลและ runtime**

- ก่อนเริ่ม: ใช้หลักฐานในเอกสารนี้และตรวจสถานะ repository/runtime ปัจจุบัน
- ทำ: ตรวจ deployment จริง, สิทธิ์ใช้/เผยแพร่, ตัวแปรและช่วงเวลา; ทำ source registry และเลือกสถานี/จุดนำร่อง
- ส่งมอบและตรวจรับ: registry มีสถานะ verified/probed/pending และตัดสิน local/Cloudflare ตามหลักฐาน
- ขอบเขตหยุด: หาก runtime/สิทธิ์ยังไม่ชัด บันทึกหลักฐานที่ขาดและเดิน local pilot ของแหล่งสาธารณะที่ใช้ได้
- คำสั่งเริ่ม: “ทำ S01 ตามแผนข้อมูลย้อนหลัง ตรวจ handoff ล่าสุดก่อน จำกัดงานตาม session และบันทึกหลักฐานผลตรวจรับ”

**S02 — พิสูจน์การเชื่อมต่อและ field mapping**

- ก่อนเริ่ม: S01 ส่งมอบ contract/checkpoint ที่เกี่ยวข้องแล้ว; ไม่ถือเลข session เป็นเหตุให้รอแหล่งที่ไม่เกี่ยวข้อง
- ทำ: ต่อยอด probe ที่ทำแล้ว: ERA5/CAMS/GFS/PCD; เก็บ fixture ขนาดเล็ก ตรวจ timezone หน่วย missing และ station registry
- ส่งมอบและตรวจรับ: mapping พร้อมตัวอย่างสำเร็จ/ผิดพลาด; ยังไม่รับรอง coverage ทั้งประเทศ/ทุกปี
- ขอบเขตหยุด: หากไม่ผ่านเกณฑ์ ให้แก้ใน scope เดิมหรือส่งมอบสถานะ partial พร้อมวิธีกู้คืนก่อนเริ่มงานที่พึ่งพาผลนั้น
- คำสั่งเริ่ม: “ทำ S02 ตามแผนข้อมูลย้อนหลัง ตรวจ handoff ล่าสุดก่อน จำกัดงานตาม session และบันทึกหลักฐานผลตรวจรับ”

**S03 — ออกแบบ schema และ storage**

- ก่อนเริ่ม: S02 ส่งมอบ contract/checkpoint ที่เกี่ยวข้องแล้ว; ไม่ถือเลข session เป็นเหตุให้รอแหล่งที่ไม่เกี่ยวข้อง
- ทำ: migration ใน local SQLite; source/location versions, raw assets, observations, forecast runs, aggregates และ ingestion ledger
- ส่งมอบและตรวจรับ: นำเข้าซ้ำไม่เพิ่มข้อมูลซ้ำ; เก็บ revision และกู้คืน batch ได้
- ขอบเขตหยุด: หากไม่ผ่านเกณฑ์ ให้แก้ใน scope เดิมหรือส่งมอบสถานะ partial พร้อมวิธีกู้คืนก่อนเริ่มงานที่พึ่งพาผลนั้น
- คำสั่งเริ่ม: “ทำ S03 ตามแผนข้อมูลย้อนหลัง ตรวจ handoff ล่าสุดก่อน จำกัดงานตาม session และบันทึกหลักฐานผลตรวจรับ”

**S04 — เริ่มคลังพยากรณ์แต่ละรอบ**

- ก่อนเริ่ม: S03 ส่งมอบ contract/checkpoint ที่เกี่ยวข้องแล้ว; ไม่ถือเลข session เป็นเหตุให้รอแหล่งที่ไม่เกี่ยวข้อง
- ทำ: เก็บ raw provider และผลพยากรณ์จริงของแอพพร้อมเวอร์ชัน; ทดลอง collector ด้วยมือก่อนเปิด job ในช่วง rollout
- ส่งมอบและตรวจรับ: สอง capture แยกชัดและ replay ได้; ไม่ใช้เวลารับข้อมูลแทนเวลาออกรอบ
- ขอบเขตหยุด: หากไม่ผ่านเกณฑ์ ให้แก้ใน scope เดิมหรือส่งมอบสถานะ partial พร้อมวิธีกู้คืนก่อนเริ่มงานที่พึ่งพาผลนั้น
- คำสั่งเริ่ม: “ทำ S04 ตามแผนข้อมูลย้อนหลัง ตรวจ handoff ล่าสุดก่อน จำกัดงานตาม session และบันทึกหลักฐานผลตรวจรับ”

**S05 — นำร่องอากาศย้อนหลัง**

- ก่อนเริ่ม: S04 ส่งมอบ contract/checkpoint ที่เกี่ยวข้องแล้ว; ไม่ถือเลข session เป็นเหตุให้รอแหล่งที่ไม่เกี่ยวข้อง
- ทำ: ERA5 30 วันใน 6 จุดตัวแทนจังหวัด ตรวจ temp/RH/rain; คำนวณรายวันและ Heat Index จากค่ารายชั่วโมงพร้อมกัน
- ส่งมอบและตรวจรับ: ตรวจวันข้ามเดือน/ช่วงฝน/หน่วย/coverage; รายงาน bytes และเวลาที่ใช้จริง
- ขอบเขตหยุด: หากไม่ผ่านเกณฑ์ ให้แก้ใน scope เดิมหรือส่งมอบสถานะ partial พร้อมวิธีกู้คืนก่อนเริ่มงานที่พึ่งพาผลนั้น
- คำสั่งเริ่ม: “ทำ S05 ตามแผนข้อมูลย้อนหลัง ตรวจ handoff ล่าสุดก่อน จำกัดงานตาม session และบันทึกหลักฐานผลตรวจรับ”

**S06 — นำร่อง PM2.5 สถานี**

- ก่อนเริ่ม: S05 ส่งมอบ contract/checkpoint ที่เกี่ยวข้องแล้ว; ไม่ถือเลข session เป็นเหตุให้รอแหล่งที่ไม่เกี่ยวข้อง
- ทำ: PCD ปี 2024: กรองวันที่ unpivot จับคู่ทะเบียนสถานีและจังหวัด เก็บค่าว่างและ revision
- ส่งมอบและตรวจรับ: ทุกสถานีที่แสดงมีที่มา/ขอบเขตยืนยัน; daily ไม่ถูกแปลงเป็น observed hourly
- ขอบเขตหยุด: หากไม่ผ่านเกณฑ์ ให้แก้ใน scope เดิมหรือส่งมอบสถานะ partial พร้อมวิธีกู้คืนก่อนเริ่มงานที่พึ่งพาผลนั้น
- คำสั่งเริ่ม: “ทำ S06 ตามแผนข้อมูลย้อนหลัง ตรวจ handoff ล่าสุดก่อน จำกัดงานตาม session และบันทึกหลักฐานผลตรวจรับ”

**S07 — นำเข้าย้อนหลังเป็นช่วง**

- ก่อนเริ่ม: S05/S06 ผ่านแยกตาม source; แหล่งที่ติดสิทธิ์ไม่บล็อกแหล่งพร้อม
- ทำ: ขยาย ERA5 เป้าหมาย 2021–2025 หลัง pilot; PCD เฉพาะปี/สถานีที่ยืนยัน; CAMS เป็นชุดแบบจำลองแยก
- ส่งมอบและตรวจรับ: มี checkpoint/coverage ledger; หยุดและ resume ได้ ไม่มีการอ้างปีที่ยังไม่ได้อ่าน
- ขอบเขตหยุด: หยุดที่ batch boundary พร้อม cursor; ไม่ประกาศ completed ก่อน coverage ledger ผ่าน
- คำสั่งเริ่ม: “ทำ S07 ตามแผนข้อมูลย้อนหลัง ตรวจ handoff ล่าสุดก่อน จำกัดงานตาม session และบันทึกหลักฐานผลตรวจรับ”

**S08 — เชื่อม API และ selectors**

- ก่อนเริ่ม: S07 ส่งมอบ contract/checkpoint ที่เกี่ยวข้องแล้ว; ไม่ถือเลข session เป็นเหตุให้รอแหล่งที่ไม่เกี่ยวข้อง
- ทำ: history/runs/coverage APIs, bounded queries, pagination/cache; ส่ง provenance ให้ selectors เดียวกับ chart/report
- ส่งมอบและตรวจรับ: API/table/KPI เห็นช่วงข้อมูลและตัวเลขตรงกัน; missing ไม่เป็นศูนย์
- ขอบเขตหยุด: หากไม่ผ่านเกณฑ์ ให้แก้ใน scope เดิมหรือส่งมอบสถานะ partial พร้อมวิธีกู้คืนก่อนเริ่มงานที่พึ่งพาผลนั้น
- คำสั่งเริ่ม: “ทำ S08 ตามแผนข้อมูลย้อนหลัง ตรวจ handoff ล่าสุดก่อน จำกัดงานตาม session และบันทึกหลักฐานผลตรวจรับ”

**S09 — แดชบอร์ดฝนและมุมมองย้อนหลัง**

- ก่อนเริ่ม: S08 ผ่าน; ใช้ข้อมูลปัจจุบันทำ UI ได้แม้ backfill ทุกปียังไม่จบ
- ทำ: กราฟแท่งฝน เส้นโอกาสฝน0–100 แยก dataset class; date range และ coverage; เปรียบเทียบช่วงที่นิยามตรงกัน
- ส่งมอบและตรวจรับ: คลิก/คีย์บอร์ด/มือถือผ่าน; downsampling รักษาผลรวมฝนและช่วงขาด
- ขอบเขตหยุด: หากไม่ผ่านเกณฑ์ ให้แก้ใน scope เดิมหรือส่งมอบสถานะ partial พร้อมวิธีกู้คืนก่อนเริ่มงานที่พึ่งพาผลนั้น
- คำสั่งเริ่ม: “ทำ S09 ตามแผนข้อมูลย้อนหลัง ตรวจ handoff ล่าสุดก่อน จำกัดงานตาม session และบันทึกหลักฐานผลตรวจรับ”

**S10 — PM2.5 ความร้อน และพื้นที่**

- ก่อนเริ่ม: S09 ส่งมอบ contract/checkpoint ที่เกี่ยวข้องแล้ว; ไม่ถือเลข session เป็นเหตุให้รอแหล่งที่ไม่เกี่ยวข้อง
- ทำ: small multiples, timeline สถานี/กริด, แสดงที่มาทุก series; เปิด YoY/seasonal เฉพาะ coverage เพียงพอ
- ส่งมอบและตรวจรับ: ไม่เฉลี่ยสถานีเท่ากับค่าเฉลี่ยพื้นที่โดยไร้นิยาม; HI aggregation ถูกต้อง
- ขอบเขตหยุด: หากไม่ผ่านเกณฑ์ ให้แก้ใน scope เดิมหรือส่งมอบสถานะ partial พร้อมวิธีกู้คืนก่อนเริ่มงานที่พึ่งพาผลนั้น
- คำสั่งเริ่ม: “ทำ S10 ตามแผนข้อมูลย้อนหลัง ตรวจ handoff ล่าสุดก่อน จำกัดงานตาม session และบันทึกหลักฐานผลตรวจรับ”

**S11 — ประเมินพยากรณ์**

- ก่อนเริ่ม: S04 และ S08 พร้อม และมีคู่ forecast/reference พอสำหรับขอบเขตที่เลือก
- ทำ: จับคู่ issued forecast กับ reference ตาม valid interval/lead; MAE/bias/RMSE สำหรับตัวแปรที่เหมาะ; baseline และ exclusions
- ส่งมอบและตรวจรับ: ไม่รั่วข้อมูลอนาคต; แยกเทียบสถานีกับ reanalysis; ตัวอย่างไม่พอแสดงว่าไม่พอ
- ขอบเขตหยุด: หากคู่ไม่พอ ส่งมอบ pairing/coverage ที่ตรวจได้และปิดการแสดงคะแนนสรุป; ไปทำรายงานประเภทที่พร้อมต่อได้
- คำสั่งเริ่ม: “ทำ S11 ตามแผนข้อมูลย้อนหลัง ตรวจ handoff ล่าสุดก่อน จำกัดงานตาม session และบันทึกหลักฐานผลตรวจรับ”

**S12 — รายงานสามประเภท**

- ก่อนเริ่ม: S11 ส่งมอบ contract/checkpoint ที่เกี่ยวข้องแล้ว; ไม่ถือเลข session เป็นเหตุให้รอแหล่งที่ไม่เกี่ยวข้อง
- ทำ: สรุปพยากรณ์/ย้อนหลัง/ประเมินพยากรณ์; snapshot เดียวสำหรับ narrative chart CSV และ print
- ส่งมอบและตรวจรับ: เปิดค้าง/refresh ไม่เปลี่ยนรายงานเดิม; metadata และ coverage อยู่ในเอกสาร
- ขอบเขตหยุด: หากไม่ผ่านเกณฑ์ ให้แก้ใน scope เดิมหรือส่งมอบสถานะ partial พร้อมวิธีกู้คืนก่อนเริ่มงานที่พึ่งพาผลนั้น
- คำสั่งเริ่ม: “ทำ S12 ตามแผนข้อมูลย้อนหลัง ตรวจ handoff ล่าสุดก่อน จำกัดงานตาม session และบันทึกหลักฐานผลตรวจรับ”

**S13 — ตรวจระบบและต้นทุน**

- ก่อนเริ่ม: S12 ส่งมอบ contract/checkpoint ที่เกี่ยวข้องแล้ว; ไม่ถือเลข session เป็นเหตุให้รอแหล่งที่ไม่เกี่ยวข้อง
- ทำ: integration/accessibility/print; จำลอง429 timeout schema change partial batch; ตรวจ query budget และ restore
- ส่งมอบและตรวจรับ: ผ่าน critical cases, มี recovery runbook และขอบเขตค่าใช้จ่ายที่วัดจาก pilot
- ขอบเขตหยุด: หากไม่ผ่านเกณฑ์ ให้แก้ใน scope เดิมหรือส่งมอบสถานะ partial พร้อมวิธีกู้คืนก่อนเริ่มงานที่พึ่งพาผลนั้น
- คำสั่งเริ่ม: “ทำ S13 ตามแผนข้อมูลย้อนหลัง ตรวจ handoff ล่าสุดก่อน จำกัดงานตาม session และบันทึกหลักฐานผลตรวจรับ”

**S14 — นำขึ้นใช้และส่งมอบ**

- ก่อนเริ่ม: S13 ส่งมอบ contract/checkpoint ที่เกี่ยวข้องแล้ว; ไม่ถือเลข session เป็นเหตุให้รอแหล่งที่ไม่เกี่ยวข้อง
- ทำ: rollout ตาม runtime ที่ยืนยัน; ตั้ง collector/backfill cadence, freshness checks และ rollback; ตรวจหลังเปิดใช้
- ส่งมอบและตรวจรับ: มีเจ้าของงาน/บันทึกการรัน/alert ที่ดำเนินการได้ และหยุด collector ได้
- ขอบเขตหยุด: หากไม่ผ่านเกณฑ์ ให้แก้ใน scope เดิมหรือส่งมอบสถานะ partial พร้อมวิธีกู้คืนก่อนเริ่มงานที่พึ่งพาผลนั้น
- คำสั่งเริ่ม: “ทำ S14 ตามแผนข้อมูลย้อนหลัง ตรวจ handoff ล่าสุดก่อน จำกัดงานตาม session และบันทึกหลักฐานผลตรวจรับ”

### งานที่ขนานได้และจุดรวม
หลัง S03 เจ้าของงานดูแล schema/contracts; agent ข้อมูลทำ S05/S06 คนละ adapter/fixture; agent UI ทำ S09 ด้วย contract/fixtures ที่คงที่; S04 ต้องเดินต้นโครงการเพื่อสะสมข้อมูล โดยกำหนดเจ้าของ shared files คนเดียว เมื่อรวมผลต้องตรวจ source semantics ไม่สร้าง selector คนละนิยาม

เส้นทางข้อมูล: S01→S02→S03→S05/S06→S07→S08; S08 เริ่มจาก pilot ได้ก่อน S07 ครบทุกปี
เส้นทางพยากรณ์: S03→S04→สะสมข้อมูล→S11
เส้นทางหน้าจอ: S08→S09→S10→S12→S13→S14; S11 เติมรายงานประเมินเมื่อหลักฐานพร้อม

## 10. บันทึกส่งต่องานทุก session
สร้าง docs/sessions/Sxx.md เมื่อเริ่มทำ session จริง ไม่สร้างไฟล์ว่างให้ดูเหมือนทำเสร็จ บันทึก:
- เป้าหมายและ scope source/product/metric/location/date; สถานะ not_started/in_progress/partial/complete และเหตุผล
- ไฟล์ที่เปลี่ยน schema/migration/contract version; runtime และ config names โดยไม่มี secret
- probe/test/คำสั่งที่ใช้จริง พร้อมผล counts/coverage/QC และสิ่งที่ยังไม่ได้ทดสอบ
- batch IDs/cursor, ช่วงที่เสร็จ/ค้าง, rejected rows, data revisions และ cost measurement
- คำสั่ง rerun/resume/rollback ที่ทดลองแล้ว; ไม่เขียนว่า restore สำเร็จถ้ายังไม่ทดสอบ
- ข้อจำกัด/ข้อมูลที่รอจากภายนอก และงานครั้งถัดไปที่มีขอบเขตชัด

Session ถัดไปอ่าน handoff และ git diff ก่อน ไม่เริ่ม backfill ใหม่ทั้งหมดโดยไม่ดู ledger เวลา session หมดไม่เท่ากับงาน complete

## 11. เกณฑ์รับงานเพิ่มเติมจากแผนกราฟเดิม
1. แหล่งที่มีเพียง metadata ไม่ถูกแสดงว่า backfill สำเร็จ
2. นำเข้า batch เดิมซ้ำได้โดยจำนวน logical records ไม่เพิ่ม; revision ใหม่ยังสืบย้อนของเก่าได้
3. source/model/station/aggregation เปลี่ยนต้องไม่รวม series เงียบ ๆ
4. ค่า missing กับ0แยกกันทุกชั้น; coverage ใช้ expected cadence ที่มีหลักฐาน
5. เวลา ICT/UTC และฝนข้ามวันผ่าน fixture; daily observations ไม่ถูกขยายเป็น hourly
6. ค่าพยากรณ์ archived ทุกค่าระบุ run หรือ capture identity ที่ตรวจสอบได้
7. สร้าง history chart/KPI/report จาก revision เดียวกันและบอกช่วงข้อมูลที่ไม่ครบ
8. การประเมินไม่ใช้อนาคตในการปรับโมเดล และเปิดเผย reference/lead/n/exclusions/baseline
9. ingestion หยุดกลางทางแล้ว resume ได้;429และschema changeไม่ทำให้เกิด silent corruption
10. production connection/credentials/runtime ผ่านจริงก่อน rollout; query budget และ restore ผ่านตามขอบเขต pilot

## 12. เริ่มครั้งถัดไป
เริ่ม S01 โดยยืนยัน deployment runtime กับทะเบียนสถานี PCD และสิทธิ์แหล่งข้อมูลที่เลือก ใช้ผล probe ที่มีแล้วเป็นจุดเริ่ม จากนั้น S02 ทำ fixture และ mapping ที่ขาด ไม่จำเป็นต้องค้นแหล่งข้อมูลใหม่ทั้งหมดอีกครั้ง การส่งคำขอข้อมูลภายนอก การซื้อบริการ และการเปิดงานเก็บข้อมูลจริงเป็นการดำเนินงานภายหลังตามขอบเขตที่ได้รับมอบหมาย ไม่ได้เกิดขึ้นในรอบวางแผนนี้



## ส่วนขยายวันที่9กันยายน2026: ระบบเฝ้าระวังอากาศ
เพิ่ม [แผนระบบเฝ้าระวังอากาศ S15–S20](D:/MyWebApps/bkkair/docs/WEATHER_SURVEILLANCE_SYSTEM_PLAN_TH.md) เป็นขอบเขตต่อเนื่อง ครอบคลุมประกาศทางการ กฎเฝ้าระวังฝน/ความร้อน/PM2.5 สถานะข้อมูล วงจรเหตุการณ์ ศูนย์ติดตาม และการแจ้งเตือนที่ตรวจสอบย้อนหลังได้

| Session เพิ่ม | ผลส่งมอบหลัก |
|---|---|
| S15 | ทะเบียนกฎ เกณฑ์อ้างอิง แหล่งประกาศ freshness และ data eligibility |
| S16 | ฐานเหตุการณ์ evidence/revision/audit และ API contracts |
| S17 | ประเมินกฎ quality gate และ replay โดยไม่ส่งแจ้งเตือนจริง |
| S18 | ศูนย์เฝ้าระวัง map/list/detail/timeline/รับทราบ และรายงาน |
| S19 | Shadow mode ตรวจคุณภาพสัญญาณและความพร้อมส่งแจ้งเตือน |
| S20 | เชื่อมช่องทางที่เลือก ทดสอบครบระบบ และเปิดเป็นขั้นพร้อม rollback |

S01–S02 เพิ่ม discovery แหล่งประกาศและนิยามช่วงเฉลี่ย; S03 เตรียม identities/provenance; S04 เก็บพยากรณ์จริง; S08 ส่ง coverage/quality ให้ evaluator; S12 เพิ่มรายงานเฝ้าระวังเมื่อ S18 พร้อม S14 เปิดได้เฉพาะขอบเขตเดิม ส่วนแจ้งเตือนเฝ้าระวังภายนอกรอ S19–S20 ผ่าน

S15 เริ่มหลัง S02 ได้ ไม่ต้องรอ14sessionsจบทั้งหมด และไม่ต้องรอ backfill ห้าปีเพื่อเริ่มกฎที่ข้อมูลพร้อม งานเฝ้าระวังเพิ่มนี้ยังเป็นแผน ไม่ได้ตั้ง scheduler หรือส่งข้อความจริง รายงานอัตโนมัติ/บัญชีทั่วไปที่เคยไม่รวมยังไม่ขยายทั้งระบบ แต่สิทธิ์รับทราบ/แก้กฎและ preferences ที่จำเป็นต่อเฝ้าระวังรวมอยู่ใน S16/S20
