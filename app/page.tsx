export default function Home() {
  return (
    <main className="home-shell">
      <div className="home-glow home-glow-one" aria-hidden="true" />
      <div className="home-glow home-glow-two" aria-hidden="true" />

      <header className="home-header">
        <a className="home-brand" href="/" aria-label="BKK Air Forecast หน้าหลัก">
          <span className="home-brand-mark" aria-hidden="true">
            <i />
            <i />
          </span>
          <span>
            <b>BKK AIR FORECAST</b>
            <small>Bangkok environmental forecast</small>
          </span>
        </a>
        <div className="home-header-note">
          <span aria-hidden="true">●</span>
          พยากรณ์ล่วงหน้า 1–5 วัน
        </div>
      </header>

      <section className="home-intro" aria-labelledby="home-title">
        <p>BANGKOK ENVIRONMENTAL FORECAST</p>
        <h1 id="home-title">มองกรุงเทพฯ ล่วงหน้า<br />ก่อนออกจากบ้าน</h1>
        <div className="home-intro-bottom">
          <span>เลือกเรื่องที่ต้องการติดตาม</span>
          <p>รวมข้อมูลฝุ่น PM2.5 และฝนไว้ในจุดเดียว เพื่อช่วยวางแผนวันของคุณได้ง่ายขึ้น</p>
        </div>
      </section>

      <section className="home-topics" aria-label="เลือกหัวข้อพยากรณ์">
        <a className="home-topic home-topic-air" href="/air" aria-label="เปิดแผนที่พยากรณ์ฝุ่น PM2.5 กรุงเทพฯ" title="เปิดพยากรณ์ฝุ่น PM2.5">
          <span className="home-topic-number" aria-hidden="true">01</span>
          <span className="home-topic-copy">
            <span className="home-topic-kicker"><i aria-hidden="true" /> AIR QUALITY</span>
            <strong>พยากรณ์ฝุ่น<br />PM2.5 กรุงเทพฯ</strong>
            <small>ดูค่าฝุ่นรายพื้นที่ แนวโน้ม 5 วัน และพื้นที่ที่ควรเฝ้าระวัง</small>
            <span className="home-topic-action">เปิดแผนที่พยากรณ์ <b aria-hidden="true">↗</b></span>
          </span>
        </a>

        <a className="home-topic home-topic-rain" href="/rain" aria-label="เปิดแผนที่พยากรณ์ฝนกรุงเทพฯ" title="เปิดพยากรณ์ฝนกรุงเทพฯ">
          <span className="home-topic-number" aria-hidden="true">02</span>
          <span className="home-topic-copy">
            <span className="home-topic-kicker"><i aria-hidden="true" /> RAIN OUTLOOK</span>
            <strong>พยากรณ์ฝน<br />กรุงเทพฯ</strong>
            <small>เช็กโอกาสฝน ปริมาณฝน และช่วงเวลาที่ควรเตรียมพร้อม</small>
            <span className="home-topic-action">เปิดแผนที่พยากรณ์ <b aria-hidden="true">↗</b></span>
          </span>
        </a>
      </section>

      <footer className="home-footer">
        <span>ข้อมูลพยากรณ์เพื่อการวางแผนเบื้องต้น</span>
        <span>ไม่ใช้แทนประกาศเตือนภัยจากหน่วยงานทางการ</span>
      </footer>
    </main>
  );
}
