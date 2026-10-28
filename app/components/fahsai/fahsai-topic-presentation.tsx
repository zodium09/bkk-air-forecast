"use client";

import type { AreaForecast, TopicId } from "../../lib/fahsai-data";
import {
  classifyAreaRisk,
  getFriendlyAdvice,
  getNearbyAreas,
  getTopicRiskBands,
  getTopicScopeConfig,
  pinMetricLabel,
  TOPICS,
} from "./fahsai-helpers";

interface TopicPresentationProps {
  topic: TopicId;
  activeArea: AreaForecast;
  scopedAreas: AreaForecast[];
  allAreas: AreaForecast[];
  onSelectArea: (id: string) => void;
  onSelectTopic: (topic: TopicId) => void;
  nowClockText: string;
  radarAndSchedule: {
    dbz: number;
    rainRateMmHr: number;
    etaMin: number;
    moveDirText: string;
    slots: {
      windowText: string;
      tag: string;
      tier: 1 | 2 | 3 | 4 | 5;
      color: string;
      rainQty: string;
      windRadarQty: string;
      otherQty: string;
      adviceText: string;
    }[];
  };
}

export function FahSaiTopicPresentation({
  topic,
  activeArea,
  scopedAreas,
  allAreas,
  onSelectArea,
  onSelectTopic,
  nowClockText,
  radarAndSchedule,
}: TopicPresentationProps) {
  const c = activeArea.current;
  const topicMeta = TOPICS.find((t) => t.id === topic) ?? TOPICS[0];
  const scopeConfig = getTopicScopeConfig(topic);
  const advice = getFriendlyAdvice(activeArea, topic);
  const bands = getTopicRiskBands(topic);
  const activeTier = classifyAreaRisk(activeArea, topic);
  const activeTierColor = bands.find((b) => b.tier === activeTier)?.color ?? topicMeta.color;
  const nearbyNodes = getNearbyAreas(activeArea, allAreas, 3);

  return (
    <div className="fahsai-bespoke-card" data-topic-presentation={topic}>
      {/* HEADER: Topic Presentation Style + Active Province + Nearby Quick Switcher */}
      <div className="fahsai-bespoke-header">
        <div className="fahsai-bespoke-title-group">
          <div className="fahsai-bespoke-badges">
            <span
              className="fahsai-bespoke-style-pill"
              style={{ background: topicMeta.accentLight, color: topicMeta.color }}
            >
              {topicMeta.icon} รูปแบบเฉพาะเรื่อง: {scopeConfig.presentationStyle}
            </span>
            <span className="fahsai-bespoke-region-pill">
              📍 {activeArea.regionName} ·{" "}
              {activeArea.isCoastal
                ? activeArea.seaBasin === "andaman"
                  ? "ชายฝั่งอันดามัน"
                  : "ชายฝั่งอ่าวไทย"
                : activeArea.zoneType === "mountain"
                  ? `ภูเขา/ดอยสูง (${activeArea.elevationM} ม.)`
                  : "พื้นที่เมือง/ที่ราบ"}
            </span>
          </div>
          <h1>{activeArea.name}</h1>
          <p className="fahsai-bespoke-sub">{activeArea.subtitle}</p>
        </div>

        <div
          className="fahsai-bespoke-status-badge"
          style={{ background: activeTierColor, color: "#ffffff" }}
        >
          <small>สถานะเวลา {nowClockText} น.</small>
          <strong>
            ระดับ {activeTier}/5 · {advice.badge}
          </strong>
        </div>
      </div>

      {/* HERO METRIC BANNER TAILORED TO ACTIVE TOPIC */}
      <div className="fahsai-bespoke-hero" style={{ background: topicMeta.gradient }}>
        <div className="fahsai-bespoke-hero-main">
          {topic === "rain" && (
            <>
              <span className="fahsai-bespoke-kicker">🌧️ เรดาร์ตรวจฝน & โอกาสเกิดฝน</span>
              <div className="fahsai-bespoke-number">
                {c.rainProb}
                <small>%</small>
              </div>
              <p>
                ฝนสะสม 24 ชม. คาดการณ์ <b>{c.rain24hMm} มม.</b> · เรดาร์ <b>{radarAndSchedule.dbz} dBZ</b>
              </p>
            </>
          )}
          {topic === "sky" && (
            <>
              <span className="fahsai-bespoke-kicker">🌤️ ดัชนีความใสของท้องฟ้า & อุณหภูมิ</span>
              <div className="fahsai-bespoke-number">
                {100 - c.cloudCoverPct}
                <small>% ฟ้าโปร่ง</small>
              </div>
              <p>
                {c.skyStateLabel} · อุณหภูมิ <b>{c.tempC}°C</b> · ทัศนวิสัยไกล <b>{c.visibilityKm} กม.</b>
              </p>
            </>
          )}
          {topic === "tide" && (
            <>
              <span className="fahsai-bespoke-kicker">🌊 ระดับน้ำทะเลหนุน & จังหวะน้ำขึ้น–ลง</span>
              <div className="fahsai-bespoke-number">
                {c.tideMsl >= 0 ? `+${c.tideMsl}` : c.tideMsl}
                <small>ม. รทก.</small>
              </div>
              <p>
                {c.tideStatusLabel} · สูงสุดวันนี้ <b>+{c.highTideMsl} ม. ({c.highTideTime})</b>
              </p>
            </>
          )}
          {topic === "wave" && (
            <>
              <span className="fahsai-bespoke-kicker">⛵ ความสูงคลื่นมีนัยสำคัญ & ความปลอดภัยเดินเรือ</span>
              <div className="fahsai-bespoke-number">
                {c.waveHeightM}
                <small>เมตร</small>
              </div>
              <p>
                {c.seaStateLabel} · ลมชายฝั่ง <b>{c.windKmh} กม./ชม.</b> (กระโชก {c.windGustKmh} กม./ชม.)
              </p>
            </>
          )}
          {topic === "air" && (
            <>
              <span className="fahsai-bespoke-kicker">😷 ความเข้มข้นฝุ่นละอองขนาดเล็ก PM2.5</span>
              <div className="fahsai-bespoke-number">
                {c.pm25}
                <small>µg/m³</small>
              </div>
              <p>
                ดัชนี US AQI <b>{c.aqi}</b> · เกณฑ์ปลอดภัยมาตรฐานไทย ≤ 37.5 µg/m³
              </p>
            </>
          )}
          {topic === "heat" && (
            <>
              <span className="fahsai-bespoke-kicker">☀️ อุณหภูมิความรู้สึกร้อนจริง (RealFeel)</span>
              <div className="fahsai-bespoke-number">
                {c.feelsLikeC}
                <small>°C</small>
              </div>
              <p>
                วัดได้จริง <b>{c.tempC}°C</b> (ร้อนขึ้น +{ (c.feelsLikeC - c.tempC).toFixed(1) }°C จากความชื้น {c.humidity}%) · UV <b>{c.uvIndex}</b>
              </p>
            </>
          )}
          {topic === "winter" && (
            <>
              <span className="fahsai-bespoke-kicker">🍃 อุณหภูมิต่ำสุดเช้ามืด & โอกาสเกิดทะเลหมอก</span>
              <div className="fahsai-bespoke-number">
                {c.minMorningC}
                <small>°C</small>
              </div>
              <p>
                โอกาสเกิดทะเลหมอกเช้า <b>{c.mistChancePct}%</b> · {c.coolIndexLabel}
              </p>
            </>
          )}
          {topic === "tourism" && (
            <>
              <span className="fahsai-bespoke-kicker">🏖️ คะแนนความน่าท่องเที่ยววันนี้ (Smart Tourism Score)</span>
              <div className="fahsai-bespoke-number">
                {c.tourismScore}
                <small>/100</small>
              </div>
              <p>
                {c.tourismBadge} · แนะนำ: <b>{activeArea.bestActivity}</b>
              </p>
            </>
          )}
          {topic === "risk" && (
            <>
              <span className="fahsai-bespoke-kicker">⚠️ ระดับการเฝ้าระวังภัยธรรมชาติหลายมิติ</span>
              <div className="fahsai-bespoke-number">
                ระดับ {c.multiHazardTier}
                <small>/5</small>
              </div>
              <p>{c.primaryHazardLabel}</p>
            </>
          )}
          {topic === "suitable" && (
            <>
              <span className="fahsai-bespoke-kicker">✨ ดัชนีความเหมาะสมทำกิจกรรมกลางแจ้งรวม</span>
              <div className="fahsai-bespoke-number">
                {c.suitabilityScore}
                <small>%</small>
              </div>
              <p>{c.suitabilityTags.join(" · ")}</p>
            </>
          )}
        </div>

        {/* Plain-Language Action Box inside Hero */}
        <div className="fahsai-bespoke-hero-advice">
          <strong>💡 คำแนะนำสำหรับประชาชน:</strong>
          <p>{advice.action}</p>
        </div>
      </div>

      {/* ===================================================================
          BESPOKE PRESENTATION BODY — COMPLETELY DISTINCT LAYOUT PER TOPIC!
          =================================================================== */}

      {/* 1. RAIN: RADAR STORM TRACKER & 4-WINDOW SCHEDULE */}
      {topic === "rain" && (
        <div className="fahsai-bespoke-body">
          <div className="fahsai-bespoke-grid-3">
            <div className="fahsai-metric-tile">
              <small>📡 ความแรงเรดาร์ฝน</small>
              <strong>{radarAndSchedule.dbz} dBZ</strong>
              <span>อัตราฝน ~{radarAndSchedule.rainRateMmHr} มม./ชม.</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>⏱️ ระยะเวลาเคลื่อนตัว</small>
              <strong>~{radarAndSchedule.etaMin} นาที</strong>
              <span>ลม{c.windDirLabel} {c.windKmh} กม./ชม.</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>☔ ความจำเป็นพกร่ม</small>
              <strong>{c.rainProb >= 50 ? "จำเป็นต้องพกร่ม" : c.rainProb >= 30 ? "ควรพกร่มพับ" : "ไม่ต้องพกร่ม"}</strong>
              <span>สะสม 24 ชม. ~{c.rain24hMm} มม.</span>
            </div>
          </div>

          <div className="fahsai-subpanel">
            <h3>⏰ ตารางคาดการณ์ฝนรายช่วงเวลา (12 ชั่วโมงข้างหน้า)</h3>
            <div className="fahsai-slot-mini-grid">
              {radarAndSchedule.slots.map((s, idx) => (
                <div key={idx} className="fahsai-slot-mini-card" style={{ borderLeft: `4px solid ${s.color}` }}>
                  <div className="fahsai-slot-mini-head">
                    <strong>{s.windowText}</strong>
                    <span style={{ color: s.color }}>ระดับ {s.tier}/5</span>
                  </div>
                  <p>{s.rainQty}</p>
                  <small>{s.adviceText}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. SKY: SKY CLARITY & ATMOSPHERIC COMFORT STUDIO */}
      {topic === "sky" && (
        <div className="fahsai-bespoke-body">
          <div className="fahsai-bespoke-grid-4">
            <div className="fahsai-metric-tile">
              <small>☁️ ปริมาณเมฆปกคลุม</small>
              <strong>{c.cloudCoverPct}%</strong>
              <span>{c.skyStateLabel}</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>👁️ ทัศนวิสัยการมองเห็น</small>
              <strong>{c.visibilityKm} กม.</strong>
              <span>{c.visibilityKm >= 14 ? "มองเห็นไกลชัดเจนมาก" : "ทัศนวิสัยปานกลาง"}</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>💧 ความชื้นสัมพัทธ์</small>
              <strong>{c.humidity}%</strong>
              <span>{c.humidity <= 65 ? "โปร่งสบาย ไม่เหนียวตัว" : "อากาศค่อนข้างชื้น"}</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>🧭 ความกดอากาศ</small>
              <strong>{c.pressureHpa} hPa</strong>
              <span>{c.pressureHpa >= 1012 ? "มวลอากาศเสถียร ฟ้าโปร่ง" : "ร่องความกดอากาศต่ำ"}</span>
            </div>
          </div>

          <div className="fahsai-subpanel">
            <h3>📸 ช่วงเวลาแสงสวย (Golden Hour) & ความสบายกลางแจ้ง</h3>
            <div className="fahsai-bespoke-grid-2">
              <div className="fahsai-highlight-box">
                <strong>🌅 แสงเช้าแนะนำ: 06:00 – 07:30 น.</strong>
                <p>อุณหภูมิเช้า {c.minMorningC}°C ฟ้าโปร่ง {100 - c.cloudCoverPct}% เหมาะถ่ายภาพและเดินเล่นรับลม</p>
              </div>
              <div className="fahsai-highlight-box">
                <strong>🌇 แสงเย็นแนะนำ: 16:45 – 18:15 น.</strong>
                <p>ทัศนวิสัย {c.visibilityKm} กม. ลม{c.windDirLabel} {c.windKmh} กม./ชม. เหมาะชมพระอาทิตย์ตก</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. TIDE: TIDAL HARMONIC CLOCK & ESTUARY MONITOR (ONLY COASTAL/ESTUARY AREAS) */}
      {topic === "tide" && (
        <div className="fahsai-bespoke-body">
          <div className="fahsai-bespoke-grid-3">
            <div className="fahsai-metric-tile is-emphasis">
              <small>⬆️ น้ำทะเลขึ้นสูงสุดวันนี้</small>
              <strong>+{c.highTideMsl} ม. รทก.</strong>
              <span>เวลาประมาณ {c.highTideTime}</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>⬇️ น้ำทะเลลงต่ำสุดวันนี้</small>
              <strong>{c.lowTideMsl} ม. รทก.</strong>
              <span>เวลาประมาณ {c.lowTideTime}</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>🌊 สถานะปากแม่น้ำ/ชายฝั่ง</small>
              <strong>{c.tideTrend === "rising" ? "น้ำกำลังขึ้น ⬆️" : "น้ำกำลังลง ⬇️"}</strong>
              <span>{c.highTideMsl >= 1.42 ? "เฝ้าระวังน้ำหนุนสูงริมตลิ่ง" : "ระบายน้ำและเดินชายหาดปกติ"}</span>
            </div>
          </div>

          <div className="fahsai-subpanel">
            <h3>🌊 เปรียบเทียบระดับน้ำทะเลหนุนสูงสุดในพื้นที่ชายฝั่ง & ปากแม่น้ำ ({scopedAreas.length} จังหวัด)</h3>
            <div className="fahsai-ranked-bars">
              {scopedAreas.slice(0, 6).map((area) => {
                const pct = Math.min(100, Math.max(15, (area.current.highTideMsl / 2.2) * 100));
                const isSel = area.id === activeArea.id;
                const aTier = classifyAreaRisk(area, "tide");
                const aCol = bands.find((b) => b.tier === aTier)?.color ?? "#0284c7";
                return (
                  <button
                    key={area.id}
                    type="button"
                    className={`fahsai-ranked-bar-row ${isSel ? "is-selected" : ""}`}
                    onClick={() => onSelectArea(area.id)}
                  >
                    <span className="fahsai-rb-name">
                      {area.name} <small>({area.current.highTideTime})</small>
                    </span>
                    <div className="fahsai-rb-track">
                      <i
                        style={{
                          width: `${pct}%`,
                          background: aCol,
                        }}
                      />
                    </div>
                    <strong className="fahsai-rb-val" style={{ color: aCol }}>
                      +{area.current.highTideMsl} ม. (Lv.{aTier})
                    </strong>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. WAVE: MARINE NAVIGATION & BOAT SAFETY DECK (ONLY COASTAL & ISLAND PROVINCES) */}
      {topic === "wave" && (
        <div className="fahsai-bespoke-body">
          <div className="fahsai-bespoke-grid-3">
            <div className="fahsai-metric-tile is-emphasis">
              <small>🚩 สถานะธงความปลอดภัยทางทะเล</small>
              <strong>
                {c.waveHeightM >= 1.5
                  ? "🔴 งดเรือเล็กออกจากฝั่ง"
                  : c.waveHeightM >= 0.9
                    ? "🟡 เรือเล็กเดินเรือด้วยความระมัดระวัง"
                    : "🟢 ทะเลสงบ เดินเรือและดำน้ำปลอดภัย"}
              </strong>
              <span>{c.marineSafetyLabel}</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>🌊 ความสูงคลื่นมีนัยสำคัญ</small>
              <strong>{c.waveHeightM} เมตร</strong>
              <span>{c.seaStateLabel}</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>💨 ลมชายฝั่ง & ลมกระโชก</small>
              <strong>{c.windKmh} กม./ชม.</strong>
              <span>กระโชกสูงสุด {c.windGustKmh} กม./ชม. ({c.windDirLabel})</span>
            </div>
          </div>

          <div className="fahsai-subpanel">
            <h3>⛵ เปรียบเทียบน่านน้ำทะเลไทย: ฝั่งอ่าวไทย vs ฝั่งอันดามัน ({scopedAreas.length} จังหวัดชายฝั่ง)</h3>
            <div className="fahsai-bespoke-grid-2">
              <div className="fahsai-highlight-box">
                <strong>🌊 ฝั่งอ่าวไทย (ชลบุรี · ระยอง · ตราด · หัวหิน · สมุย · สงขลา)</strong>
                <p>
                  คลื่นเฉลี่ย{" "}
                  {(
                    scopedAreas
                      .filter((a) => a.seaBasin !== "andaman")
                      .reduce((s, a) => s + a.current.waveHeightM, 0) /
                    Math.max(1, scopedAreas.filter((a) => a.seaBasin !== "andaman").length)
                  ).toFixed(2)}{" "}
                  เมตร · เหมาะเดินเรือท่องเที่ยวเกาะล้าน เกาะเสม็ด เกาะกูด และหมู่เกาะสมุย
                </p>
              </div>
              <div className="fahsai-highlight-box">
                <strong>⛵ ฝั่งทะเลอันดามัน (ภูเก็ต · กระบี่ · พังงา · สิมิลัน)</strong>
                <p>
                  คลื่นเฉลี่ย{" "}
                  {(
                    scopedAreas
                      .filter((a) => a.seaBasin === "andaman")
                      .reduce((s, a) => s + a.current.waveHeightM, 0) /
                    Math.max(1, scopedAreas.filter((a) => a.seaBasin === "andaman").length)
                  ).toFixed(2)}{" "}
                  เมตร · ตรวจสอบตารางเรือสปีดโบ๊ทหมู่เกาะพีพีและสิมิลันก่อนออกเดินทาง
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. AIR: AQI HEALTH SHIELD & MIXING DOME */}
      {topic === "air" && (
        <div className="fahsai-bespoke-body">
          <div className="fahsai-bespoke-grid-3">
            <div className="fahsai-metric-tile is-emphasis">
              <small>😷 ค่าฝุ่นละออง PM2.5</small>
              <strong>{c.pm25} µg/m³</strong>
              <span>{c.pm25 <= 25 ? "🟢 อากาศสะอาดดีมาก" : c.pm25 <= 37.5 ? "🟡 ปานกลาง (ผ่านเกณฑ์ไทย)" : "🟠 เริ่มมีผลต่อสุขภาพ"}</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>🌬️ การระบายอากาศตามกระแสลม</small>
              <strong>ลม {c.windKmh} กม./ชม.</strong>
              <span>{c.windKmh >= 14 ? "ลมพัดระบายฝุ่นได้ดี ไม่สะสม" : "ลมค่อนข้างสงบ ระวังฝาชีครอบช่วงเช้า"}</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>🏃 คำแนะนำออกกำลังกายกลางแจ้ง</small>
              <strong>คะแนน {c.lifestyle.outdoorScore}/100</strong>
              <span>{c.lifestyle.outdoorLabel}</span>
            </div>
          </div>

          <div className="fahsai-subpanel">
            <h3>🛡️ คำแนะนำการป้องกันสุขภาพแยกตามกลุ่มประชาชน</h3>
            <div className="fahsai-bespoke-grid-3">
              <div className="fahsai-highlight-box">
                <strong>👨‍👩‍👧 ประชาชนทั่วไป</strong>
                <p>{c.pm25 > 37.5 ? "สวมหน้ากากอนามัยเมื่ออยู่ริมถนนหรือกลางแจ้งเป็นเวลานาน" : "ทำกิจกรรมกลางแจ้งและเปิดหน้าต่างระบายอากาศได้ตามปกติ"}</p>
              </div>
              <div className="fahsai-highlight-box">
                <strong>👶 กลุ่มเสี่ยง (เด็ก·ผู้สูงอายุ·ภูมิแพ้)</strong>
                <p>{c.pm25 > 25 ? "เตรียมหน้ากากป้องกันฝุ่นและลดเวลาอยู่ในที่โล่งแจ้งช่วงเช้ามืด" : "อากาศบริสุทธิ์ ปลอดภัยสำหรับทุกกลุ่มวัย"}</p>
              </div>
              <div className="fahsai-highlight-box">
                <strong>🚴 นักวิ่ง & ปั่นจักรยาน</strong>
                <p>{c.pm25 > 37.5 ? "แนะนำเปลี่ยนไปออกกำลังกายในร่มหรือฟิตเนสชั่วคราว" : "เหมาะวิ่งในสวนสาธารณะและปั่นจักรยานสูดอากาศสดชื่น"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. HEAT: THERMAL STRESS (REALFEEL) & UV SHIELD */}
      {topic === "heat" && (
        <div className="fahsai-bespoke-body">
          <div className="fahsai-bespoke-grid-3">
            <div className="fahsai-metric-tile is-emphasis">
              <small>🌡️ ส่วนต่างความรู้สึกร้อนจริง</small>
              <strong>+{(c.feelsLikeC - c.tempC).toFixed(1)}°C</strong>
              <span>วัดได้ {c.tempC}°C แต่รู้สึกร้อน {c.feelsLikeC}°C</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>☀️ ดัชนีรังสียูวี (UV Index)</small>
              <strong>ระดับ {c.uvIndex} / 12</strong>
              <span>{c.uvIndex >= 8 ? "UV สูงจัด ทาครีมกันแดด SPF 50+" : "UV ปานกลาง สวมหมวกกันแดด"}</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>🥤 ปริมาณการดื่มน้ำแนะนำ</small>
              <strong>{c.feelsLikeC >= 38 ? "2–3 แก้ว/ชม." : "1–2 แก้ว/ชม."}</strong>
              <span>เมื่อทำกิจกรรมหรือทำงานกลางแจ้ง</span>
            </div>
          </div>
        </div>
      )}

      {/* 7. WINTER: MORNING MIST HUNTER & SUMMIT LAPSE RATE (ONLY MOUNTAIN & COOL-BREEZE AREAS) */}
      {topic === "winter" && (
        <div className="fahsai-bespoke-body">
          <div className="fahsai-bespoke-grid-3">
            <div className="fahsai-metric-tile is-emphasis">
              <small>❄️ อุณหภูมิพื้นราบ/ตัวเมืองเช้ามืด</small>
              <strong>{c.minMorningC}°C</strong>
              <span>ช่วงเวลาเย็นที่สุด 05:30 – 07:00 น.</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>⛰️ อุณหภูมิคาดการณ์บนยอดดอย/จุดชมวิว (+1,000 ม.)</small>
              <strong>{(c.minMorningC - 6.5).toFixed(1)}°C</strong>
              <span>คำนวณตามอัตรา Lapse Rate (-6.5°C/กม.)</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>☁️ โอกาสเกิดทะเลหมอกยามเช้า</small>
              <strong>{c.mistChancePct}%</strong>
              <span>ความชื้น {c.humidity}% · ลม {c.windKmh} กม./ชม.</span>
            </div>
          </div>

          <div className="fahsai-subpanel">
            <h3>🏔️ จัดอันดับพื้นที่อากาศหนาวเย็น & ทะเลหมอกวันนี้ ({scopedAreas.length} จังหวัดขุนเขา/ลมหนาว)</h3>
            <div className="fahsai-ranked-bars">
              {scopedAreas.slice(0, 6).map((area) => {
                const isSel = area.id === activeArea.id;
                const aTier = classifyAreaRisk(area, "winter");
                const aCol = bands.find((b) => b.tier === aTier)?.color ?? "#0891b2";
                return (
                  <button
                    key={area.id}
                    type="button"
                    className={`fahsai-ranked-bar-row ${isSel ? "is-selected" : ""}`}
                    onClick={() => onSelectArea(area.id)}
                  >
                    <span className="fahsai-rb-name">
                      {area.name} <small>(หมอก {area.current.mistChancePct}%)</small>
                    </span>
                    <div className="fahsai-rb-track">
                      <i
                        style={{
                          width: `${Math.min(100, Math.max(20, (30 - area.current.minMorningC) * 5.5))}%`,
                          background: aCol,
                        }}
                      />
                    </div>
                    <strong className="fahsai-rb-val" style={{ color: aCol }}>
                      เช้า {area.current.minMorningC}°C (Lv.{aTier})
                    </strong>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 8. TOURISM: SMART TRAVEL CONCIERGE & LANDMARK GUIDE */}
      {topic === "tourism" && (
        <div className="fahsai-bespoke-body">
          <div className="fahsai-subpanel">
            <h3>🎒 แลนด์มาร์กห้ามพลาด & กิจกรรมแนะนำใน {activeArea.name}</h3>
            <p className="fahsai-best-activity-line">
              ✨ <strong>กิจกรรมที่เหมาะกับสภาพอากาศวันนี้ที่สุด:</strong> {activeArea.bestActivity}
            </p>
            <div className="fahsai-landmark-chip-row">
              {activeArea.tourismHighlights.map((hl) => (
                <span key={hl} className="fahsai-landmark-badge">
                  📍 {hl}
                </span>
              ))}
            </div>
          </div>

          <div className="fahsai-bespoke-grid-3">
            <div className="fahsai-highlight-box">
              <strong>🏖️ สายเที่ยวทะเล & หมู่เกาะ</strong>
              <p>ภูเก็ต · กระบี่ · พังงา · เกาะกูด · เกาะสมุย (เช็กคลื่นลมและน้ำใสเรียลไทม์)</p>
            </div>
            <div className="fahsai-highlight-box">
              <strong>⛰️ สายยอดดอย & แคมป์ปิ้งดูดาว</strong>
              <p>เชียงใหม่ · แม่ฮ่องสอน · เชียงราย · น่าน · เขาค้อ · ภูกระดึง · เขาใหญ่</p>
            </div>
            <div className="fahsai-highlight-box">
              <strong>🏛️ สายเมืองเก่า & วิถีริมน้ำ</strong>
              <p>พระนครศรีอยุธยา · กรุงเทพฯ · เกาะเกร็ด · สังขละบุรี · เมืองเก่าสงขลา</p>
            </div>
          </div>
        </div>
      )}

      {/* 9. RISK: MULTI-HAZARD EARLY WARNING MATRIX */}
      {topic === "risk" && (
        <div className="fahsai-bespoke-body">
          <div className="fahsai-bespoke-grid-4">
            <div className="fahsai-metric-tile">
              <small>🌧️ ความเสี่ยงฝนตกหนัก</small>
              <strong>โอกาส {c.rainProb}%</strong>
              <span>สะสม {c.rain24hMm} มม.</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>🌊 ความเสี่ยงน้ำหนุน/คลื่น</small>
              <strong>{activeArea.isCoastal ? `คลื่น ${c.waveHeightM}ม.` : `สูง ${activeArea.elevationM}ม.`}</strong>
              <span>{activeArea.isCoastal ? `น้ำขึ้น +${c.highTideMsl}ม.` : "ปลอดภัยจากน้ำทะเลหนุน"}</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>😷 ความเสี่ยงฝุ่น PM2.5</small>
              <strong>{c.pm25} µg/m³</strong>
              <span>US AQI {c.aqi}</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>🔥 ความเสี่ยงความร้อน/UV</small>
              <strong>{c.feelsLikeC}°C</strong>
              <span>UV Index {c.uvIndex}</span>
            </div>
          </div>

          <div className="fahsai-subpanel">
            <h3>⚠️ ลำดับจังหวัดเฝ้าระวังความเสี่ยงสูงสุดวันนี้ (Top Risk Watchlist)</h3>
            <div className="fahsai-ranked-bars">
              {scopedAreas.slice(0, 6).map((area) => {
                const isSel = area.id === activeArea.id;
                const t = area.current.multiHazardTier;
                const col = bands.find((b) => b.tier === t)?.color ?? "#ef4444";
                return (
                  <button
                    key={area.id}
                    type="button"
                    className={`fahsai-ranked-bar-row ${isSel ? "is-selected" : ""}`}
                    onClick={() => onSelectArea(area.id)}
                  >
                    <span className="fahsai-rb-name">
                      {area.name} <small>({area.current.primaryHazardLabel})</small>
                    </span>
                    <div className="fahsai-rb-track">
                      <i
                        style={{
                          width: `${t * 20}%`,
                          background: col,
                        }}
                      />
                    </div>
                    <strong className="fahsai-rb-val" style={{ color: col }}>
                      ระดับ {t}/5
                    </strong>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 10. SUITABLE: BEST PLACES LEADERBOARD & LIFESTYLE PLANNER */}
      {topic === "suitable" && (
        <div className="fahsai-bespoke-body">
          <div className="fahsai-bespoke-grid-3">
            <div className="fahsai-metric-tile">
              <small>👕 ซักตากผ้ากลางแจ้ง</small>
              <strong>{c.lifestyle.laundryScore}/100</strong>
              <span>{c.lifestyle.laundryLabel}</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>🏃 วิ่ง & ออกกำลังกายในสวน</small>
              <strong>{c.lifestyle.outdoorScore}/100</strong>
              <span>{c.lifestyle.outdoorLabel}</span>
            </div>
            <div className="fahsai-metric-tile">
              <small>⛺ แคมป์ปิ้ง & พักผ่อน</small>
              <strong>{c.lifestyle.campingScore}/100</strong>
              <span>{c.lifestyle.campingLabel}</span>
            </div>
          </div>

          <div className="fahsai-subpanel">
            <h3>✨ จัดอันดับจังหวัดที่ฟ้าใสและอากาศเหมาะสมที่สุดวันนี้ (Top Best Places)</h3>
            <div className="fahsai-ranked-bars">
              {scopedAreas.slice(0, 6).map((area, idx) => {
                const isSel = area.id === activeArea.id;
                const aTier = classifyAreaRisk(area, "suitable");
                const aCol = bands.find((b) => b.tier === aTier)?.color ?? "#10b981";
                return (
                  <button
                    key={area.id}
                    type="button"
                    className={`fahsai-ranked-bar-row ${isSel ? "is-selected" : ""}`}
                    onClick={() => onSelectArea(area.id)}
                  >
                    <span className="fahsai-rb-name">
                      #{idx + 1} {area.name} <small>({area.current.suitabilityTags.slice(0, 2).join(" ")})</small>
                    </span>
                    <div className="fahsai-rb-track">
                      <i
                        style={{
                          width: `${area.current.suitabilityScore}%`,
                          background: aCol,
                        }}
                      />
                    </div>
                    <strong className="fahsai-rb-val" style={{ color: aCol }}>
                      {area.current.suitabilityScore}% (Lv.{aTier})
                    </strong>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SEVERITY-COLORED PROVINCE COMPARISON CHART FOR RAIN, SKY, WAVE, AIR, HEAT, TOURISM */}
      {["rain", "sky", "wave", "air", "heat", "tourism"].includes(topic) && (
        <div className="fahsai-subpanel fahsai-severity-compare-panel">
          <h3>
            📊 กราฟแยกสีความรุนแรงเปรียบเทียบจังหวัด ({topicMeta.label})
          </h3>
          <div className="fahsai-ranked-bars">
            {scopedAreas.slice(0, 6).map((area) => {
              const isSel = area.id === activeArea.id;
              const aTier = classifyAreaRisk(area, topic);
              const aCol = bands.find((b) => b.tier === aTier)?.color ?? topicMeta.color;
              const pct =
                topic === "rain"
                  ? Math.max(12, area.current.rainProb)
                  : topic === "sky"
                    ? Math.max(15, 100 - area.current.cloudCoverPct)
                    : topic === "wave"
                      ? Math.min(100, Math.max(15, (area.current.waveHeightM / 2.2) * 100))
                      : topic === "air"
                        ? Math.min(100, Math.max(14, (area.current.pm25 / 70) * 100))
                        : topic === "heat"
                          ? Math.min(100, Math.max(20, ((area.current.feelsLikeC - 24) / 20) * 100))
                          : area.current.tourismScore;
              return (
                <button
                  key={area.id}
                  type="button"
                  className={`fahsai-ranked-bar-row ${isSel ? "is-selected" : ""}`}
                  onClick={() => onSelectArea(area.id)}
                >
                  <span className="fahsai-rb-name">
                    {area.name} <small>({area.regionName})</small>
                  </span>
                  <div className="fahsai-rb-track">
                    <i
                      style={{
                        width: `${pct}%`,
                        background: aCol,
                      }}
                    />
                  </div>
                  <strong className="fahsai-rb-val" style={{ color: aCol }}>
                    {pinMetricLabel(area, topic)} · Lv.{aTier}
                  </strong>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* NEARBY PROVINCES STRIP */}
      <div className="fahsai-nearby-strip">
        <span className="fahsai-nearby-label">🧭 จังหวัดใกล้เคียง {activeArea.name} (คลิกเพื่อดูและเปรียบเทียบข้อมูล):</span>
        <div className="fahsai-nearby-chips">
          {nearbyNodes
            .filter((n) => !n.isCenter)
            .map((node) => (
              <button
                key={node.area.id}
                type="button"
                className="fahsai-nearby-chip"
                onClick={() => onSelectArea(node.area.id)}
              >
                <strong>{node.area.name}</strong>
                <span>
                  ({node.compassLabel} ~{node.distanceKm} กม. · {pinMetricLabel(node.area, topic)})
                </span>
              </button>
            ))}
        </div>
      </div>

      {/* COMPACT 10-TOPIC QUICK SWITCHER BAR */}
      <div className="fs-ten-strip" role="group" aria-label="สรุปครบทุกเรื่องในพื้นที่นี้">
        <button type="button" onClick={() => onSelectTopic("rain")} className={topic === "rain" ? "is-selected" : ""}>
          <small>🌧️ ฝน</small>
          <b>{c.rainProb}%</b>
        </button>
        <button type="button" onClick={() => onSelectTopic("sky")} className={topic === "sky" ? "is-selected" : ""}>
          <small>🌤️ ฟ้า/อากาศ</small>
          <b>{c.tempC}°C</b>
        </button>
        <button type="button" onClick={() => onSelectTopic("tide")} className={topic === "tide" ? "is-selected" : ""}>
          <small>🌊 น้ำหนุน</small>
          <b>{activeArea.isCoastal || c.highTideMsl > 0 ? `+${c.highTideMsl}ม.` : "ดอน"}</b>
        </button>
        <button type="button" onClick={() => onSelectTopic("wave")} className={topic === "wave" ? "is-selected" : ""}>
          <small>⛵ คลื่นลม</small>
          <b>{activeArea.isCoastal ? `${c.waveHeightM}ม.` : `${c.windKmh}กม.`}</b>
        </button>
        <button type="button" onClick={() => onSelectTopic("air")} className={topic === "air" ? "is-selected" : ""}>
          <small>😷 PM2.5</small>
          <b>{c.pm25}</b>
        </button>
        <button type="button" onClick={() => onSelectTopic("heat")} className={topic === "heat" ? "is-selected" : ""}>
          <small>☀️ ร้อนจริง</small>
          <b>{c.feelsLikeC}°C</b>
        </button>
        <button type="button" onClick={() => onSelectTopic("winter")} className={topic === "winter" ? "is-selected" : ""}>
          <small>🍃 ลมหนาว</small>
          <b>{c.minMorningC}°C</b>
        </button>
        <button type="button" onClick={() => onSelectTopic("tourism")} className={topic === "tourism" ? "is-selected" : ""}>
          <small>🏖️ ท่องเที่ยว</small>
          <b>{c.tourismScore}/100</b>
        </button>
        <button type="button" onClick={() => onSelectTopic("risk")} className={topic === "risk" ? "is-selected" : ""}>
          <small>⚠️ ความเสี่ยง</small>
          <b>ระดับ {c.multiHazardTier}</b>
        </button>
        <button type="button" onClick={() => onSelectTopic("suitable")} className={topic === "suitable" ? "is-selected" : ""}>
          <small>✨ เหมาะสม</small>
          <b>{c.suitabilityScore}%</b>
        </button>
      </div>
    </div>
  );
}
