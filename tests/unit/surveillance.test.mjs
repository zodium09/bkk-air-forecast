import assert from "node:assert/strict";
import test from "node:test";
import { buildSurveillanceSnapshot, evaluateRule, reconcileLifecycle, isRevisionAcknowledged, acknowledgementKey, compareSurveillanceEvents, surveillanceAreas } from "../../app/lib/surveillance.ts";
const NOW = "2026-09-09T03:00:00.000Z";
const rule = { ...buildSurveillanceSnapshot().events[0].rule, id: "test-rule" };
const input = { assetId:"a", metric:rule.metric, unit:rule.unit, datasetClass:"forecast", sourceProduct:rule.sourceProduct, runIssuedAt:"2026-09-09T02:00:00.000Z", validFrom:"2026-09-09T04:00:00.000Z", validTo:"2026-09-09T07:00:00.000Z", availableAt:"2026-09-09T02:30:00.000Z", value:35, coverage:.92 };
test("threshold boundary and matching contract pass", () => assert.equal(evaluateRule(rule,input,NOW).result,"met"));
for (const [label, change, reason] of [
 ["timestamp",{validTo:"invalid"},"invalid_timestamp"],
 ["window",{validTo:"2026-09-09T06:00:00.000Z"},"window_mismatch"],
 ["reversed window",{validFrom:"2026-09-09T08:00:00.000Z"},"window_mismatch"],
 ["NaN coverage",{coverage:NaN},"coverage_invalid"],
 ["coverage over one",{coverage:1.1},"coverage_invalid"],
 ["negative coverage",{coverage:-.1},"coverage_invalid"],
 ["low coverage",{coverage:.2},"coverage_below_minimum"],
 ["missing value",{value:null},"value_missing"],
 ["unit mismatch",{unit:"mm/day"},"metric_contract_mismatch"],
 ["wrong source",{sourceProduct:"other"},"source_product_mismatch"],
 ["future availability",{availableAt:"2026-09-10T03:00:00.000Z"},"input_not_available_at_evaluation_time"],
 ["old run",{runIssuedAt:"2026-09-01T01:00:00.000Z"},"forecast_run_stale"],
 ["missing run",{runIssuedAt:undefined},"forecast_run_missing"],
 ["future run",{runIssuedAt:"2026-09-10T01:00:00.000Z"},"forecast_run_in_future"],
 ["out-of-range lead",{validFrom:"2026-09-12T04:00:00.000Z",validTo:"2026-09-12T07:00:00.000Z"},"lead_range_mismatch"],
]) test(label+" cannot become a valid signal",()=>{ const result=evaluateRule(rule,{...input,...change},NOW); assert.equal(result.result,"unknown"); assert.ok(result.reasonCodes.includes(reason)); });
test("disabled and future rules are suppressed",()=>{assert.equal(evaluateRule({...rule,enabled:false},input,NOW).result,"suppressed");assert.equal(evaluateRule({...rule,effectiveFrom:"2027-01-01"},input,NOW).result,"suppressed");});
test("observation requires completed window and source freshness",()=>{const observed={...rule,datasetClass:"observation",leadRangeHours:null};const value={...input,datasetClass:"observation"};assert.ok(evaluateRule(observed,value,NOW).reasonCodes.includes("observation_not_complete"));assert.ok(evaluateRule(observed,{...value,validFrom:"2026-09-08T00:00:00Z",validTo:"2026-09-08T03:00:00Z"},NOW).reasonCodes.includes("validity_stale"));});
function sample(n,value=42){return {...input,assetId:"sample-"+n,value,availableAt:new Date(Date.parse("2026-09-09T02:30:00Z")+n*60000).toISOString()};}
test("unique samples open an event; reruns and late input do not count",()=>{
 let state=reconcileLifecycle(rule,sample(0),NOW);assert.equal(state.status,"pending");assert.equal(state.entryCount,1);
 state=reconcileLifecycle(rule,sample(0),NOW,state);assert.equal(state.entryCount,1);
 state=reconcileLifecycle(rule,sample(-1),NOW,state);assert.equal(state.reason,"out_of_order_input");
 state=reconcileLifecycle(rule,sample(1),NOW,state);assert.equal(state.status,"active");
});
test("hysteresis band holds active; unknown resets recovery; exit requires consecutive samples",()=>{
 let state=reconcileLifecycle(rule,sample(0),NOW);state=reconcileLifecycle(rule,sample(1),NOW,state);
 state=reconcileLifecycle(rule,sample(2,30),NOW,state);assert.equal(state.status,"active");assert.equal(state.recoveryCount,0);
 state=reconcileLifecycle(rule,sample(3,19),NOW,state);assert.equal(state.recoveryCount,1);
 state=reconcileLifecycle(rule,{...sample(4),value:null},NOW,state);assert.equal(state.status,"active");assert.equal(state.recoveryCount,0);
 state=reconcileLifecycle(rule,sample(5,19),NOW,state);assert.equal(state.status,"active");
 state=reconcileLifecycle(rule,sample(6,19),NOW,state);assert.equal(state.status,"resolved");
 state=reconcileLifecycle(rule,sample(7,42),NOW,state);assert.equal(state.status,"resolved");assert.equal(state.reason,"cooldown");
});
test("exact exit threshold remains active and terminal states do not reopen",()=>{
 let state=reconcileLifecycle(rule,sample(0),NOW);state=reconcileLifecycle(rule,sample(1),NOW,state);
 state=reconcileLifecycle(rule,sample(2,20),NOW,state);assert.equal(state.recoveryCount,0);
 for(const status of ["cancelled","expired","withdrawn"])assert.equal(reconcileLifecycle(rule,sample(3),NOW,{...state,status}).status,status);
});
test("default fixtures are immutable and custom scenarios get distinct identities",()=>{const a=buildSurveillanceSnapshot();assert.deepEqual(a,buildSurveillanceSnapshot());const b=buildSurveillanceSnapshot(new Date("2026-09-10T03:00:00Z"));assert.notEqual(a.id,b.id);assert.notEqual(a.events[0].id,b.events[0].id);assert.equal(surveillanceAreas.length,6);});
test("PM2.5 filtering retains data quality and acknowledgements require current revision",()=>{const s=buildSurveillanceSnapshot();assert.ok(s.events.filter(e=>e.hazard==="pm25").some(e=>e.signalKind==="data_quality"));const old=s.events.find(e=>e.status==="resolved");assert.equal(isRevisionAcknowledged(old),false);assert.equal(isRevisionAcknowledged(old,[acknowledgementKey(old)]),true);assert.equal(isRevisionAcknowledged({...old,revision:5},[acknowledgementKey(old)]),false);});
test("ordering prioritizes active events and deterministically breaks ties",()=>{const events=buildSurveillanceSnapshot().events;const sorted=[...events].reverse().sort(compareSurveillanceEvents);assert.equal(sorted.at(-1).status,"resolved");assert.deepEqual(sorted,[...events].sort(compareSurveillanceEvents));});
