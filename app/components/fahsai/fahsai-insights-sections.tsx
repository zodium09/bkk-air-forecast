"use client";

import { useMemo } from "react";
import {
  getTmdRainCoverageLabel,
  toTmdRainAreaPercent,
  type AreaForecast,
  type TopicId,
} from "../../lib/fahsai-data.ts";
import {
  classifyDailyPointRisk,
  getScienceExplainer,
  type TopicConfig,
} from "./fahsai-helpers.ts";

export interface FahSaiInsightsSectionsProps {
  activeArea: AreaForecast;
  projectedAreas: AreaForecast[];
  topic: TopicId;
  activeTopicMeta: TopicConfig;
  dayIdx: number;
  onSelectArea: (id: string) => void;
  onSelectTopic: (topic: TopicId) => void;
  onSelectDay: (dayIdx: number) => void;
}

export function FahSaiInsightsSections({
  activeArea,
  projectedAreas,
  topic,
  activeTopicMeta,
  dayIdx,
  onSelectArea,
  onSelectTopic,
  onSelectDay,
}: FahSaiInsightsSectionsProps) {
  const science = useMemo(() => getScienceExplainer(topic), [topic]);

  // Top Suitable vs Top Risk areas across all 77 provinces for the selected forecast day & time
  const topSuitableAreas = useMemo(
    () =>
      [...projectedAreas]
        .sort((a, b) => b.current.suitabilityScore - a.current.suitabilityScore)
        .slice(0, 6),
    [projectedAreas]
  );

  const topRiskAreas = useMemo(
    () =>
      [...projectedAreas]
        .sort(
          (a, b) =>
            b.current.multiHazardTier * 100 +
            b.current.rainProb +
            b.current.pm25 -
            (a.current.multiHazardTier * 100 + a.current.rainProb + a.current.pm25)
        )
        .slice(0, 6),
    [projectedAreas]
  );

  return (
    <>
      {/* SECTION 5: ✨ พื้นที่เหมาะสมที่สุด vs ⚠️ พื้นที่เสี่ยงเฝ้าระวังทั่วไทย */}
      <section
        className="fs-risk-suitable-section"
        id="fs-risk-suitable"
        aria-label="เปรียบเทียบพื้นที่เหมาะสมที่สุดและพื้นที่เฝ้าระวังความเสี่ยงทั่วไทย"
      >
        <div className="fs-rs-grid">
          {/* LEFT: TOP SUITABLE & TOURISM DESTINATIONS TODAY */}
          <article className="fs-rs-card is-suitable">
            <div className="fs-rs-head">
              <div>
                <span className="fs-eyebrow">
                  ✨ BEST PLACES TODAY · พื้นที่เหมาะสม &amp; น่าไปที่สุดวันนี้
                </span>
                <h2>จัดอันดับจังหวัดฟ้าใส อากาศดี น่าท่องเที่ยวและทำกิจกรรมกลางแจ้ง</h2>
              </div>
              <button
                type="button"
                className="fs-rs-mode-btn"
                onClick={() => onSelectTopic("suitable")}
              >
                ดูบนแผนที่ →
              </button>
            </div>
            <div className="fs-rs-list">
              {topSuitableAreas.map((area, idx) => (
                <div
                  key={area.id}
                  className={`fs-rs-item ${area.id === activeArea.id ? "is-active" : ""}`}
                  onClick={() => onSelectArea(area.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onSelectArea(area.id);
                  }}
                >
                  <span className="fs-rs-rank is-good">#{idx + 1}</span>
                  <div className="fs-rs-info">
                    <div className="fs-rs-title-row">
                      <strong>{area.name}</strong>
                      <small>{area.regionName}</small>
                    </div>
                    <p>{area.bestActivity}</p>
                    <div className="fs-rs-tags">
                      {area.current.suitabilityTags.slice(0, 3).map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="fs-rs-score is-good">
                    <strong>{area.current.suitabilityScore}%</strong>
                    <small>เหมาะสม</small>
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* RIGHT: MULTI-HAZARD RISK WATCH AREAS TODAY */}
          <article className="fs-rs-card is-risk">
            <div className="fs-rs-head">
              <div>
                <span className="fs-eyebrow">
                  ⚠️ RISK SURVEILLANCE · พื้นที่เฝ้าระวังความเสี่ยงวันนี้
                </span>
                <h2>จุดเฝ้าระวังฝนตกหนัก คลื่นลมแรง น้ำทะเลหนุน ฝุ่น และความร้อน</h2>
              </div>
              <button
                type="button"
                className="fs-rs-mode-btn is-warn"
                onClick={() => onSelectTopic("risk")}
              >
                ดูแผนที่เสี่ยง →
              </button>
            </div>
            <div className="fs-rs-list">
              {topRiskAreas.map((area) => {
                const tier = area.current.multiHazardTier;
                const badgeCol =
                  tier >= 4 ? "#ef4444" : tier === 3 ? "#f59e0b" : "#0ea5e9";
                return (
                  <div
                    key={area.id}
                    className={`fs-rs-item ${area.id === activeArea.id ? "is-active" : ""}`}
                    onClick={() => onSelectArea(area.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onSelectArea(area.id);
                    }}
                  >
                    <span className="fs-rs-rank" style={{ background: badgeCol }}>
                      Lv.{tier}
                    </span>
                    <div className="fs-rs-info">
                      <div className="fs-rs-title-row">
                        <strong>{area.name}</strong>
                        <small>{area.regionName}</small>
                      </div>
                      <p>{area.current.primaryHazardLabel}</p>
                      <small className="fs-rs-submetrics">
                        🌧️ ฝน {area.current.rainProb}% · 😷 PM2.5 {area.current.pm25} · ☀️ ร้อนจริง{" "}
                        {area.current.feelsLikeC}°C
                        {area.isCoastal ? ` · 🌊 คลื่น ${area.current.waveHeightM}ม.` : ""}
                      </small>
                    </div>
                    <div className="fs-rs-score" style={{ color: badgeCol }}>
                      <strong>ระดับ {tier}/5</strong>
                      <small>เฝ้าระวัง</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      </section>

      {/* SECTION 6: 🏖️ LIFESTYLE & DAILY ACTIVITY PLANNER CARDS */}
      <section
        className="fs-lifestyle-section"
        aria-label="การ์ดวางแผนชีวิตประจำวันและกิจกรรมกลางแจ้งครบวงจร"
      >
        <div className="fs-section-head">
          <div>
            <span className="fs-eyebrow">
              🌱 SMART LIFESTYLE &amp; DAILY PLANNER · ตัวช่วยตัดสินใจในชีวิตประจำวันครบวงจร
            </span>
            <h2>คะแนนความเหมาะสมสำหรับกิจกรรมประจำวันใน จ.{activeArea.name}</h2>
          </div>
        </div>
        <div className="fs-lifestyle-grid">
          {[
            {
              icon: "👕",
              title: "ซักผ้า & ตากผ้ากลางแจ้ง",
              score: activeArea.current.lifestyle.laundryScore,
              desc: activeArea.current.lifestyle.laundryLabel,
              sub: `แดด/อุณหภูมิ ${activeArea.current.tempC}°C · ความชื้น ${activeArea.current.humidity}%`,
            },
            {
              icon: "🏃",
              title: "วิ่ง & ออกกำลังกายในสวน",
              score: activeArea.current.lifestyle.outdoorScore,
              desc: activeArea.current.lifestyle.outdoorLabel,
              sub: `PM2.5 ${activeArea.current.pm25} µg/m³ · RealFeel ${activeArea.current.feelsLikeC}°C`,
            },
            {
              icon: "⛺",
              title: "แคมป์ปิ้ง ดูดาว & ชมหมอก",
              score: activeArea.current.lifestyle.campingScore,
              desc: activeArea.current.lifestyle.campingLabel,
              sub: `ต่ำสุดเช้ามืด ${activeArea.current.minMorningC}°C · โอกาสหมอก ${activeArea.current.mistChancePct}%`,
            },
            {
              icon: "🚤",
              title: "เที่ยวทะเล ดำน้ำ & ล่องเรือ",
              score: activeArea.current.lifestyle.marineScore,
              desc: activeArea.current.lifestyle.marineLabel,
              sub: activeArea.isCoastal
                ? `คลื่นสูง ${activeArea.current.waveHeightM} ม. · น้ำขึ้นสูงสุด +${activeArea.current.highTideMsl} ม.`
                : `ลม ${activeArea.current.windKmh} กม./ชม. · แหล่งน้ำในแผ่นดิน`,
            },
            {
              icon: "🚗",
              title: "ล้างรถ & ขับรถเดินทางไกล",
              score: activeArea.current.lifestyle.carWashScore,
              desc: activeArea.current.lifestyle.carWashLabel,
              sub: `ฝน ${toTmdRainAreaPercent(activeArea.current.rainProb)}% ของพื้นที่ · ทัศนวิสัย ${activeArea.current.visibilityKm} กม.`,
            },
            {
              icon: "⚡",
              title: "โซลาร์เซลล์ & พลังงานแสงอาทิตย์",
              score: activeArea.current.lifestyle.solarScore,
              desc: activeArea.current.lifestyle.solarLabel,
              sub: `UV สูงสุด ${activeArea.current.uvIndex} · เมฆปกคลุม ${activeArea.current.cloudCoverPct}%`,
            },
          ].map((item) => {
            const toneColor =
              item.score >= 75 ? "#10b981" : item.score >= 55 ? "#f59e0b" : "#ef4444";
            return (
              <article key={item.title} className="fs-lifestyle-card">
                <div className="fs-lc-top">
                  <span className="fs-lc-icon">{item.icon}</span>
                  <div className="fs-lc-badge" style={{ background: toneColor }}>
                    {item.score}/100
                  </div>
                </div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
                <div className="fs-lc-bar">
                  <i style={{ width: `${item.score}%`, background: toneColor }} />
                </div>
                <small>{item.sub}</small>
              </article>
            );
          })}
        </div>
      </section>

      {/* SECTION 7: VISUAL SCIENCE EXPLAINER FOR CITIZENS */}
      <section className="fs-science-section" aria-label="คำอธิบายทางวิชาการแบบเข้าใจง่าย">
        <div className="fs-science-head">
          <span className="fs-eyebrow">
            🎓 ความรู้วิชาการฉบับประชาชน (Visual Science Explainer)
          </span>
          <h2>{science.title}</h2>
          <p>{science.subtitle}</p>
        </div>
        <div className="fs-science-grid">
          {science.cards.map((card, i) => (
            <article key={i} className="fs-science-card">
              <h3>{card.head}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* SECTION 8: CONSOLIDATED 7-DAY MULTI-PARAMETER MATRIX & REGIONAL SUMMARY */}
      <section className="fs-bottom-grid">
        <article className="fs-daily-card">
          <span className="fs-eyebrow">
            📅 ตารางสรุปพยากรณ์ครบวงจร 7 วันล่วงหน้า (คลิกเลือกวันเพื่อดูบนแผนที่)
          </span>
          <h3>
            ตารางเปรียบเทียบฝน–อุณหภูมิ–ฝุ่น–ความเสี่ยงรายวัน · จ.{activeArea.name} (
            {activeTopicMeta.label})
          </h3>

          <div
            className="fs-daily-list"
            role="group"
            aria-label="กราฟแท่งแยกสีความรุนแรงล่วงหน้า 7 วัน"
          >
            {activeArea.daily.map((d, idx) => {
              const dSev = classifyDailyPointRisk(activeArea, d, topic);
              const isDaySel = idx === dayIdx;
              const tmdPct = toTmdRainAreaPercent(d.rainProb);
              const tmdCov = getTmdRainCoverageLabel(tmdPct);
              return (
                <button
                  key={d.dayLabel}
                  type="button"
                  className={`fs-daily-row ${isDaySel ? "is-selected" : ""}`}
                  style={
                    isDaySel
                      ? { borderColor: dSev.color, background: `${dSev.color}12` }
                      : undefined
                  }
                  onClick={() => onSelectDay(idx)}
                >
                  <div className="fs-daily-day-col">
                    <span
                      className="fs-daily-sev-dot"
                      style={{ background: dSev.color }}
                    />
                    <strong>{d.dayLabel}</strong>
                  </div>
                  <span className="fs-daily-rain">
                    🌧️ {tmdPct}% ของพื้นที่ · {tmdCov} ({d.rainMm} มม.)
                  </span>
                  <span className="fs-daily-temp">
                    🍃 <b>{d.minTempC}°C</b> — ☀️ <b>{d.maxTempC}°C</b> · 😷 PM2.5{" "}
                    {d.pm25Avg} µg
                  </span>
                  <span
                    className="fs-daily-sev-badge"
                    style={{ background: `${dSev.color}1f`, color: dSev.color }}
                  >
                    ระดับ {dSev.tier}/5 · {dSev.shortTag}
                  </span>
                </button>
              );
            })}
          </div>
        </article>

        <article className="fs-sea-summary-card">
          <span className="fs-eyebrow">
            🌊 สรุปน้ำทะเล คลื่นลม &amp; ภูมิอากาศของพื้นที่
          </span>
          <h3>
            ข้อมูลสำคัญประจำวัน · จ.{activeArea.name} ({activeArea.regionName})
          </h3>
          <div className="fs-sea-bento">
            <div>
              <small>⬆️ น้ำทะเลขึ้นสูงสุด / ระดับพื้นที่</small>
              <strong>
                {activeArea.isCoastal || activeArea.current.highTideMsl > 0
                  ? `+${activeArea.current.highTideMsl} ม. รทก.`
                  : `สูง ${activeArea.elevationM} เมตร`}
              </strong>
              <span>{activeArea.current.highTideTime}</span>
            </div>
            <div>
              <small>⬇️ น้ำทะเลลงต่ำสุด / การระบายน้ำ</small>
              <strong>
                {activeArea.isCoastal || activeArea.current.highTideMsl > 0
                  ? `${activeArea.current.lowTideMsl} ม. รทก.`
                  : `ความกดอากาศ ${activeArea.current.pressureHpa} hPa`}
              </strong>
              <span>{activeArea.current.lowTideTime}</span>
            </div>
            <div>
              <small>⛵ คลื่นลม &amp; ความปลอดภัยทางน้ำ</small>
              <strong>
                {activeArea.isCoastal
                  ? `คลื่น ${activeArea.current.waveHeightM} เมตร`
                  : `หมอกเช้า ${activeArea.current.mistChancePct}%`}
              </strong>
              <span>{activeArea.current.seaStateLabel}</span>
            </div>
            <div>
              <small>🍃 ทิศทางลม &amp; คุณภาพอากาศ</small>
              <strong>
                ลม {activeArea.current.windKmh} กม./ชม. · PM2.5{" "}
                {activeArea.current.pm25}
              </strong>
              <span>{activeArea.current.windDirLabel}</span>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}
