export type SurveillanceHazard = "rain" | "heat" | "pm25";
export type SurveillanceSignalKind =
  | "official"
  | "app_forecast"
  | "app_observation"
  | "data_quality";
export type SurveillanceSeverity = "advisory" | "watch" | "warning" | "unknown";
export type SurveillanceStatus =
  | "pending"
  | "active"
  | "resolved"
  | "expired"
  | "withdrawn"
  | "cancelled";
export type EvaluationResult = "met" | "not_met" | "unknown" | "suppressed";

export type RuleVersion = {
  id: string;
  version: string;
  enabled: boolean;
  mode: "shadow" | "live";
  metric: string;
  unit: string;
  datasetClass: "forecast" | "observation";
  sourceProduct: string;
  areaPolicy: string;
  aggregation: string;
  windowMinutes: number;
  leadRangeHours: [number, number] | null;
  entryThreshold: number;
  exitThreshold: number;
  minimumCoverage: number;
  freshnessBudgetMinutes: number;
  persistenceSamples: number;
  recoverySamples: number;
  cooldownMinutes: number;
  effectiveFrom: string;
  definitionOwner: string;
  definitionSource: string;
};

export type EvaluationInput = {
  assetId: string;
  metric: string;
  unit: string;
  datasetClass: "forecast" | "observation";
  runIssuedAt?: string;
  sourceProduct: string;
  validFrom: string;
  validTo: string;
  availableAt: string;
  value: number | null;
  coverage: number;
};

export type RuleEvaluation = {
  id: string;
  ruleVersion: string;
  evaluatedAt: string;
  inputAssetId: string;
  validFrom: string;
  validTo: string;
  value: number | null;
  coverage: number;
  result: EvaluationResult;
  reasonCodes: string[];
};

export type SurveillanceEvidence = {
  label: string;
  value: string;
  source: string;
  validInterval: string;
  quality: "ผ่าน" | "บางส่วน" | "ไม่ผ่าน";
};

export type SurveillanceTimelineItem = {
  id: string;
  at: string;
  kind: "opened" | "updated" | "acknowledged" | "resolved" | "source";
  label: string;
  detail: string;
};

export type SurveillanceEvent = {
  id: string;
  identity: string;
  revision: number;
  hazard: SurveillanceHazard;
  signalKind: SurveillanceSignalKind;
  severity: SurveillanceSeverity;
  status: SurveillanceStatus;
  currentAssessment: EvaluationResult;
  title: string;
  summary: string;
  area: { id: string; name: string; lat: number; lng: number };
  startedAt: string;
  validFrom: string;
  validTo: string;
  updatedAt: string;
  leadHours: number | null;
  source: {
    label: string;
    issuer?: string;
    bulletinId?: string;
    url?: string;
  };
  acknowledgement: {
    state: "unacknowledged" | "acknowledged";
    actor?: string;
    at?: string;
    note?: string;
    eventRevision?: number;
  };
  rule: RuleVersion | null;
  evaluation: RuleEvaluation | null;
  evidence: SurveillanceEvidence[];
  timeline: SurveillanceTimelineItem[];
  synthetic: true;
};

export type SourceFreshness = {
  id: string;
  label: string;
  status: "fresh" | "delayed" | "unavailable";
  validAt: string | null;
  checkedAt: string;
  note: string;
};

export type SurveillanceSnapshot = {
  id: string;
  generatedAt: string;
  timezone: "Asia/Bangkok";
  mode: "shadow";
  disclaimer: string;
  events: SurveillanceEvent[];
  sources: SourceFreshness[];
};

function minutesBetween(later: string, earlier: string) {
  return (Date.parse(later) - Date.parse(earlier)) / 60_000;
}

export function evaluateRule(
  rule: RuleVersion,
  input: EvaluationInput,
  evaluatedAt: string,
): RuleEvaluation {
  const reasons: string[] = [];
  if (!rule.enabled) reasons.push("rule_disabled");
  const timestamps = [evaluatedAt, input.validFrom, input.validTo, input.availableAt, rule.effectiveFrom];
  if (timestamps.some((value) => !Number.isFinite(Date.parse(value)))) reasons.push("invalid_timestamp");
  if (Date.parse(rule.effectiveFrom) > Date.parse(evaluatedAt)) reasons.push("rule_not_effective");
  if (input.metric !== rule.metric || input.unit !== rule.unit || input.datasetClass !== rule.datasetClass) reasons.push("metric_contract_mismatch");
  if (minutesBetween(input.validTo, input.validFrom) !== rule.windowMinutes) reasons.push("window_mismatch");
  if (input.sourceProduct !== rule.sourceProduct) reasons.push("source_product_mismatch");
  if (Date.parse(input.availableAt) > Date.parse(evaluatedAt)) reasons.push("input_not_available_at_evaluation_time");
  if (input.value === null || !Number.isFinite(input.value)) reasons.push("value_missing");
  if (!Number.isFinite(input.coverage) || input.coverage < 0 || input.coverage > 1) reasons.push("coverage_invalid");
  else if (input.coverage < rule.minimumCoverage) reasons.push("coverage_below_minimum");
  if (rule.datasetClass === "forecast") {
    const run = Date.parse(input.runIssuedAt ?? "");
    if (!Number.isFinite(run)) reasons.push("forecast_run_missing");
    else {
      if (run > Date.parse(input.availableAt) || run > Date.parse(evaluatedAt)) reasons.push("forecast_run_in_future");
      if (minutesBetween(evaluatedAt, input.runIssuedAt!) > rule.freshnessBudgetMinutes) reasons.push("forecast_run_stale");
      const leadStart = minutesBetween(input.validFrom, input.runIssuedAt!) / 60;
      const leadEnd = minutesBetween(input.validTo, input.runIssuedAt!) / 60;
      if (rule.leadRangeHours && (leadStart < rule.leadRangeHours[0] || leadEnd > rule.leadRangeHours[1])) reasons.push("lead_range_mismatch");
    }
  } else {
    if (Date.parse(input.validTo) > Date.parse(input.availableAt)) reasons.push("observation_not_complete");
    if (minutesBetween(evaluatedAt, input.validTo) > rule.freshnessBudgetMinutes) reasons.push("validity_stale");
  }

  let result: EvaluationResult;
  if (!rule.enabled || reasons.includes("rule_not_effective")) result = "suppressed";
  else if (reasons.length) result = "unknown";
  else result = input.value! >= rule.entryThreshold ? "met" : "not_met";

  return {
    id: `${rule.id}@${rule.version}:${input.assetId}:${evaluatedAt}`,
    ruleVersion: `${rule.id}@${rule.version}`,
    evaluatedAt,
    inputAssetId: input.assetId,
    validFrom: input.validFrom,
    validTo: input.validTo,
    value: input.value,
    coverage: input.coverage,
    result,
    reasonCodes: reasons.length ? reasons : [result === "met" ? "entry_threshold_met" : "entry_threshold_not_met"],
  };
}

export type LifecycleState = {
  status: SurveillanceStatus;
  entryCount: number;
  recoveryCount: number;
  seenInputs: string[];
  lastAvailableAt?: string;
  resolvedAt?: string;
  reason: string;
};

/** Pure replay reducer. Persist this state transactionally before scheduling live evaluations. */
export function reconcileLifecycle(rule: RuleVersion, input: EvaluationInput, evaluatedAt: string, previous?: LifecycleState): LifecycleState {
  const state: LifecycleState = previous ?? { status: "pending", entryCount: 0, recoveryCount: 0, seenInputs: [], reason: "awaiting_samples" };
  const evaluation = evaluateRule(rule, input, evaluatedAt);
  if (state.seenInputs.includes(input.assetId)) return { ...state, reason: "duplicate_input" };
  if (!Number.isFinite(Date.parse(input.availableAt)) || !Number.isFinite(Date.parse(evaluatedAt)) || Date.parse(input.availableAt) > Date.parse(evaluatedAt)) return { ...state, reason: "input_not_available" };
  if (state.lastAvailableAt && Date.parse(input.availableAt) <= Date.parse(state.lastAvailableAt)) return { ...state, reason: "out_of_order_input" };
  const next = { ...state, seenInputs: [...state.seenInputs, input.assetId], lastAvailableAt: input.availableAt };
  if (["cancelled", "withdrawn", "expired"].includes(state.status)) return { ...next, reason: "terminal_state" };
  if (evaluation.result === "unknown" || evaluation.result === "suppressed") return { ...next, entryCount: 0, recoveryCount: 0, reason: evaluation.result };
  if (state.status === "active") {
    const recoveryCount = input.value! < rule.exitThreshold ? state.recoveryCount + 1 : 0;
    return recoveryCount >= rule.recoverySamples
      ? { ...next, status: "resolved", entryCount: 0, recoveryCount, resolvedAt: evaluatedAt, reason: "exit_persistence_met" }
      : { ...next, recoveryCount, reason: recoveryCount ? "recovery_pending" : "active_hold" };
  }
  if (state.resolvedAt && minutesBetween(evaluatedAt, state.resolvedAt) < rule.cooldownMinutes) return { ...next, entryCount: 0, reason: "cooldown" };
  const entryCount = evaluation.result === "met" ? state.entryCount + 1 : 0;
  return { ...next, entryCount, recoveryCount: 0, status: entryCount >= rule.persistenceSamples ? "active" : state.status, reason: entryCount >= rule.persistenceSamples ? "entry_persistence_met" : "awaiting_samples" };
}

export function acknowledgementKey(event: SurveillanceEvent) { return `${event.id}@${event.revision}`; }
export function isRevisionAcknowledged(event: SurveillanceEvent, sessionKeys: string[] = []) {
  return (event.acknowledgement.state === "acknowledged" && event.acknowledgement.eventRevision === event.revision) || sessionKeys.includes(acknowledgementKey(event));
}
export function compareSurveillanceEvents(a: SurveillanceEvent, b: SurveillanceEvent) {
  const rank = { warning: 3, watch: 2, advisory: 1, unknown: 0 };
  return Number(b.status === "active") - Number(a.status === "active") || rank[b.severity] - rank[a.severity] || Date.parse(a.validFrom) - Date.parse(b.validFrom) || a.id.localeCompare(b.id);
}

export function eventIdentity(ruleId: string, areaId: string, episode: string) {
  return `${ruleId}:${areaId}:${episode}`;
}

const area = {
  bangkok: { id: "bangkok", name: "กรุงเทพมหานคร", lat: 13.7563, lng: 100.5018 },
  nonthaburi: { id: "nonthaburi", name: "นนทบุรี", lat: 13.8621, lng: 100.5144 },
  pathumThani: { id: "pathum-thani", name: "ปทุมธานี", lat: 14.0208, lng: 100.525 },
  samutPrakan: { id: "samut-prakan", name: "สมุทรปราการ", lat: 13.5991, lng: 100.5998 },
  samutSakhon: { id: "samut-sakhon", name: "สมุทรสาคร", lat: 13.5475, lng: 100.2744 },
  nakhonPathom: { id: "nakhon-pathom", name: "นครปฐม", lat: 13.8199, lng: 100.0622 },
} as const;

export const surveillanceAreas = Object.values(area);
export const FIXTURE_TIME = "2026-09-09T03:00:00.000Z";

function offset(now: Date, minutes: number) {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

function demoRule(overrides: Partial<RuleVersion> & Pick<RuleVersion, "id" | "metric" | "unit" | "datasetClass" | "sourceProduct" | "entryThreshold" | "exitThreshold">): RuleVersion {
  return {
    version: "demo-2026-09-09.1",
    enabled: true,
    mode: "shadow",
    areaPolicy: "พื้นที่จังหวัดจาก fixture ทดสอบ",
    aggregation: "synthetic acceptance fixture",
    windowMinutes: 180,
    leadRangeHours: overrides.datasetClass === "forecast" ? [0, 48] : null,
    minimumCoverage: 0.8,
    freshnessBudgetMinutes: overrides.datasetClass === "forecast" ? 360 : 120,
    persistenceSamples: 2,
    recoverySamples: 2,
    cooldownMinutes: 180,
    effectiveFrom: "2026-09-09T00:00:00+07:00",
    definitionOwner: "ทีมผลิตภัณฑ์ — fixture สำหรับทดสอบเท่านั้น",
    definitionSource: "Synthetic acceptance fixture S17 — ไม่ใช่เกณฑ์ปฏิบัติการ",
    ...overrides,
  };
}

export function buildSurveillanceSnapshot(now = new Date(FIXTURE_TIME)): SurveillanceSnapshot {
  const evaluatedAt = now.toISOString();
  const rainRule = demoRule({ id: "rain-forecast-3h-demo", metric: "rain_accumulation", unit: "mm/3h", datasetClass: "forecast", sourceProduct: "synthetic-weather-grid", entryThreshold: 35, exitThreshold: 20 });
  const heatRule = demoRule({ id: "heat-index-3h-demo", metric: "heat_index", unit: "°C", datasetClass: "forecast", sourceProduct: "synthetic-weather-grid", entryThreshold: 42, exitThreshold: 39 });
  const pmRule = demoRule({ id: "pm25-observed-demo", metric: "pm25", unit: "µg/m³", datasetClass: "observation", sourceProduct: "synthetic-station-network", entryThreshold: 37.5, exitThreshold: 30 });

  const contract = (rule: RuleVersion) => ({ metric: rule.metric, unit: rule.unit, datasetClass: rule.datasetClass, sourceProduct: rule.sourceProduct });
  const rainInput: EvaluationInput = { ...contract(rainRule), assetId: "fixture-rain-run-01", runIssuedAt: offset(now, -60), validFrom: offset(now, 180), validTo: offset(now, 360), availableAt: offset(now, -30), value: 42, coverage: 0.92 };
  const heatInput: EvaluationInput = { ...contract(heatRule), assetId: "fixture-heat-run-01", runIssuedAt: offset(now, -60), validFrom: offset(now, 60), validTo: offset(now, 240), availableAt: offset(now, -25), value: 43.4, coverage: 0.89 };
  const missingInput: EvaluationInput = { ...contract(pmRule), assetId: "fixture-station-gap-01", validFrom: offset(now, -310), validTo: offset(now, -130), availableAt: offset(now, -120), value: null, coverage: 0.42 };
  const resolvedInput: EvaluationInput = { ...contract(pmRule), assetId: "fixture-pm-resolved-01", validFrom: offset(now, -210), validTo: offset(now, -30), availableAt: offset(now, -25), value: 21, coverage: 0.95 };
  const rainEvaluation = evaluateRule(rainRule, rainInput, evaluatedAt);
  const heatEvaluation = evaluateRule(heatRule, heatInput, evaluatedAt);
  const missingEvaluation = evaluateRule(pmRule, missingInput, evaluatedAt);
  const resolvedEvaluation = evaluateRule(pmRule, resolvedInput, evaluatedAt);

  const events: SurveillanceEvent[] = [
    {
      id: "evt-rain-bangkok-demo",
      identity: eventIdentity(rainRule.id, area.bangkok.id, "demo-01"),
      revision: 2,
      hazard: "rain",
      signalKind: "app_forecast",
      severity: "watch",
      status: "active",
      currentAssessment: rainEvaluation.result,
      title: "ฝนสะสมในช่วง 3 ชั่วโมงเข้าเงื่อนไขสาธิต",
      summary: "แบบจำลอง fixture ประเมินว่าปริมาณฝนสะสมในกรุงเทพฯ ผ่านกฎ shadow สองช่วงข้อมูลต่อเนื่อง",
      area: area.bangkok,
      startedAt: offset(now, -48),
      validFrom: rainInput.validFrom,
      validTo: rainInput.validTo,
      updatedAt: offset(now, -12),
      leadHours: 3,
      source: { label: "Synthetic weather grid · run 01" },
      acknowledgement: { state: "unacknowledged" },
      rule: rainRule,
      evaluation: rainEvaluation,
      evidence: [{ label: "ฝนสะสม", value: "42 mm / 3 ชม.", source: "Synthetic weather grid", validInterval: `${rainInput.validFrom}/${rainInput.validTo}`, quality: "ผ่าน" }, { label: "Coverage", value: "92%", source: "Quality gate fixture", validInterval: `${offset(now, -30)}/${evaluatedAt}`, quality: "ผ่าน" }],
      timeline: [{ id: "rain-open", at: offset(now, -48), kind: "opened", label: "เปิดเหตุใน shadow mode", detail: "ผ่าน entry persistence จาก input ที่ไม่ซ้ำ 2 ช่วง" }, { id: "rain-update", at: offset(now, -12), kind: "updated", label: "ปรับช่วงคาดการณ์", detail: "เลื่อน valid interval ไปข้างหน้า 1 ชั่วโมงและเก็บ revision เดิม" }],
      synthetic: true,
    },
    {
      id: "evt-heat-samut-prakan-demo",
      identity: eventIdentity(heatRule.id, area.samutPrakan.id, "demo-01"),
      revision: 1,
      hazard: "heat",
      signalKind: "app_forecast",
      severity: "advisory",
      status: "active",
      currentAssessment: heatEvaluation.result,
      title: "Heat Index เข้าเงื่อนไขเฝ้าระวังสาธิต",
      summary: "ค่า Heat Index จาก fixture ผ่าน quality gate และกฎ persistence ของโหมด shadow",
      area: area.samutPrakan,
      startedAt: offset(now, -35),
      validFrom: heatInput.validFrom,
      validTo: heatInput.validTo,
      updatedAt: offset(now, -18),
      leadHours: 1,
      source: { label: "Synthetic weather grid · run 01" },
      acknowledgement: { state: "acknowledged", actor: "ผู้ทดสอบระบบ", at: offset(now, -15), note: "รับทราบ fixture สำหรับทดสอบ workflow", eventRevision: 1 },
      rule: heatRule,
      evaluation: heatEvaluation,
      evidence: [{ label: "Heat Index", value: "43.4 °C", source: "Synthetic weather grid", validInterval: `${heatInput.validFrom}/${heatInput.validTo}`, quality: "ผ่าน" }],
      timeline: [{ id: "heat-open", at: offset(now, -35), kind: "opened", label: "เปิดเหตุใน shadow mode", detail: "กฎสาธิตผ่าน entry threshold" }, { id: "heat-ack", at: offset(now, -15), kind: "acknowledged", label: "รับทราบ revision 1", detail: "การรับทราบไม่เปลี่ยนสถานะเหตุ" }],
      synthetic: true,
    },
    {
      id: "evt-data-nonthaburi-demo",
      identity: eventIdentity("station-freshness-demo", area.nonthaburi.id, "demo-01"),
      revision: 3,
      hazard: "pm25",
      signalKind: "data_quality",
      severity: "unknown",
      status: "active",
      currentAssessment: missingEvaluation.result,
      title: "ยังประเมิน PM2.5 ไม่ได้จาก coverage ต่ำ",
      summary: "สถานี fixture ส่งข้อมูลไม่ครบ ระบบคงเหตุเดิมและไม่ตีความข้อมูลที่หายเป็นศูนย์หรือสถานการณ์ปกติ",
      area: area.nonthaburi,
      startedAt: offset(now, -132),
      validFrom: missingInput.validFrom,
      validTo: missingInput.validTo,
      updatedAt: offset(now, -8),
      leadHours: null,
      source: { label: "Synthetic station network" },
      acknowledgement: { state: "unacknowledged" },
      rule: pmRule,
      evaluation: missingEvaluation,
      evidence: [{ label: "Coverage", value: "42%", source: "Quality gate fixture", validInterval: `${missingInput.validFrom}/${missingInput.validTo}`, quality: "ไม่ผ่าน" }, { label: "ค่าล่าสุด", value: "ไม่มีข้อมูล", source: "Synthetic station network", validInterval: `${missingInput.validFrom}/${missingInput.validTo}`, quality: "ไม่ผ่าน" }],
      timeline: [{ id: "data-open", at: offset(now, -132), kind: "source", label: "ตรวจพบช่องว่างข้อมูล", detail: "coverage ต่ำกว่าขั้นต่ำของ rule contract" }, { id: "data-keep", at: offset(now, -8), kind: "updated", label: "สถานะปัจจุบันยังไม่ทราบ", detail: "ไม่ resolve เหตุเพราะ provider หายไป" }],
      synthetic: true,
    },
    {
      id: "evt-official-pathum-demo",
      identity: eventIdentity("official-bulletin-contract-demo", area.pathumThani.id, "demo-01"),
      revision: 2,
      hazard: "rain",
      signalKind: "official",
      severity: "watch",
      status: "active",
      currentAssessment: "met",
      title: "ประกาศจำลองสำหรับทดสอบ revision contract",
      summary: "fixture นี้ใช้ทดสอบการแยกประกาศหน่วยงานออกจากกฎของแอพ ไม่ใช่ประกาศจริงและไม่มีการตีความ polygon เพิ่มเติม",
      area: area.pathumThani,
      startedAt: offset(now, -75),
      validFrom: offset(now, -60),
      validTo: offset(now, 300),
      updatedAt: offset(now, -20),
      leadHours: null,
      source: { label: "Official bulletin contract fixture", issuer: "ผู้ออกจำลอง — ไม่ใช่หน่วยงานจริง", bulletinId: "TEST-BULLETIN-002" },
      acknowledgement: { state: "unacknowledged" },
      rule: null,
      evaluation: null,
      evidence: [{ label: "ขอบเขตประกาศ", value: "ระดับจังหวัด (fixture)", source: "Official bulletin contract fixture", validInterval: `${offset(now, -60)}/${offset(now, 300)}`, quality: "บางส่วน" }, { label: "ต้นฉบับ", value: "ไม่มี — ข้อมูลสังเคราะห์", source: "Fixture", validInterval: `${offset(now, -75)}/${offset(now, -20)}`, quality: "ไม่ผ่าน" }],
      timeline: [{ id: "official-open", at: offset(now, -75), kind: "opened", label: "รับ fixture ฉบับที่ 1", detail: "scope ระดับจังหวัดและไม่สร้าง polygon เอง" }, { id: "official-revision", at: offset(now, -20), kind: "updated", label: "รับ fixture ฉบับแก้ไขที่ 2", detail: "เชื่อม revision เดิมและไม่สร้างเหตุซ้ำ" }],
      synthetic: true,
    },
    {
      id: "evt-pm25-nakhon-pathom-resolved-demo",
      identity: eventIdentity(pmRule.id, area.nakhonPathom.id, "demo-previous"),
      revision: 4,
      hazard: "pm25",
      signalKind: "app_observation",
      severity: "advisory",
      status: "resolved",
      currentAssessment: resolvedEvaluation.result,
      title: "PM2.5 fixture ผ่านช่วง recovery แล้ว",
      summary: "เหตุสาธิตคลี่คลายหลังค่าต่ำกว่า exit threshold ครบสองช่วงข้อมูล ไม่เกี่ยวกับการกดรับทราบ",
      area: area.nakhonPathom,
      startedAt: offset(now, -420),
      validFrom: resolvedInput.validFrom,
      validTo: resolvedInput.validTo,
      updatedAt: offset(now, -20),
      leadHours: null,
      source: { label: "Synthetic station network" },
      acknowledgement: { state: "acknowledged", actor: "ผู้ทดสอบระบบ", at: offset(now, -240), eventRevision: 2 },
      rule: pmRule,
      evaluation: resolvedEvaluation,
      evidence: [{ label: "PM2.5", value: "21 µg/m³", source: "Synthetic station network", validInterval: `${resolvedInput.validFrom}/${resolvedInput.validTo}`, quality: "ผ่าน" }],
      timeline: [{ id: "pm-open", at: offset(now, -420), kind: "opened", label: "เปิดเหตุสาธิต", detail: "ค่าผ่าน entry threshold" }, { id: "pm-ack", at: offset(now, -240), kind: "acknowledged", label: "รับทราบ revision 2", detail: "เหตุยัง active หลังรับทราบ" }, { id: "pm-resolve", at: offset(now, -20), kind: "resolved", label: "คลี่คลายหลัง recovery", detail: "ต่ำกว่า exit threshold ครบ 2 input ที่ไม่ซ้ำ" }],
      synthetic: true,
    },
  ];

  return {
    id: `synthetic-v2:${evaluatedAt}`,
    generatedAt: evaluatedAt,
    timezone: "Asia/Bangkok",
    mode: "shadow",
    disclaimer: "ข้อมูลทั้งหมดในหน้านี้เป็น synthetic fixtures สำหรับทดสอบ workflow ไม่ใช่สถานการณ์จริง ไม่มีการส่งแจ้งเตือนภายนอก",
    events: events.map((event) => ({ ...event, id: `${event.id}:${evaluatedAt}`, identity: `${event.identity}:${evaluatedAt}` })),
    sources: [
      { id: "synthetic-weather-grid", label: "Weather forecast fixture", status: "fresh", validAt: offset(now, -30), checkedAt: evaluatedAt, note: "ใช้ทดสอบฝนและ Heat Index เท่านั้น" },
      { id: "synthetic-station-network", label: "PM2.5 station fixture", status: "delayed", validAt: offset(now, -130), checkedAt: evaluatedAt, note: "จำลอง coverage ต่ำและข้อมูลล่าช้า" },
      { id: "official-warning-contract", label: "ประกาศทางการ", status: "unavailable", validAt: null, checkedAt: evaluatedAt, note: "ยังไม่ยืนยัน machine-readable API และสิทธิ์ cache" },
    ],
  };
}
