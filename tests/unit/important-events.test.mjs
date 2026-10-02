import assert from "node:assert/strict";
import test from "node:test";
import { buildImportantEvents, eventWatchReducer, initialEventWatch } from "../../app/lib/important-events.ts";
const now = Date.parse("2026-10-02T13:20:00Z");
const at = new Date(now).toISOString();
const position = { lat:13.7563, lng:100.5018 };
const input = () => ({ region:"metro", place:null, now, roads:null, water:null, air:null, rain:null, heat:null });
const road = (id="r", overrides={}) => ({ id, name:id, ...position, status:"fresh", value:12, observedAt:at, level:"flood", ...overrides });
const water = (id="w", overrides={}) => ({ id, name:id, ...position, provinceId:"bangkok", observedAt:at, value:2, datum:"msl", bank:3, capacityPercent:80, status:"fresh", ...overrides });
const air = (id="a", overrides={}) => ({ id, name:id, ...position, provinceId:"bangkok", observedAt:at, value:45, source:"AirBKK", sourceLevel:"orange", ...overrides });
const find = (result,id) => result.events.find(e=>e.id===id);

test("important events retain agency classes, distinguish high/low water and exclude expired/future measurements", () => {
  const result=buildImportantEvents({...input(), roads:{stations:[road(),road("old",{observedAt:new Date(now-31*60000).toISOString()}),road("future",{observedAt:new Date(now+10*60000).toISOString()})]}, water:{stations:[water(),water("overflow",{capacityPercent:110}),water("low",{capacityPercent:8}),water("stale",{observedAt:new Date(now-61*60000).toISOString()})]}, air:{stations:[air(),air("unknown",{value:200,sourceLevel:null}),air("old",{observedAt:new Date(now-91*60000).toISOString()})]}});
  assert.equal(find(result,"road-flood").count,1);
  assert.equal(find(result,"water-high").count,2);assert.equal(find(result,"water-high").alertCount,1);
  assert.equal(find(result,"water-low").count,1);
  assert.equal(find(result,"air-source-level").count,1);
  assert.equal(result.events[0].topic,"road");
  assert.deepEqual(result.coverage.find(c=>c.topic==="water"),{topic:"water",title:"คลองและแม่น้ำ",used:3,total:4,summary:"น้ำมาก/ถึงตลิ่ง 2 · น้ำน้อย 1 สถานี",href:"#water-levels"});
});
test("personal scope counts only real nearby points; province filtering never imports Bangkok road coverage into another province",()=>{
  const base={...input(),place:position,roads:{stations:[road(),road("far",{lat:14.1})]},water:{stations:[water(),water("far",{lat:14.1}),water("other-province",{provinceId:"nonthaburi"})]},air:{stations:[air(),air("far",{lat:14.1})]}};
  assert.equal(find(buildImportantEvents(base),"road-flood").count,1);
  assert.equal(find(buildImportantEvents(base),"water-high").count,2);
  const nn=buildImportantEvents({...base,region:"nonthaburi"});
  assert.equal(find(nn,"road-flood"),undefined);assert.equal(find(nn,"water-high").count,1);assert.equal(find(nn,"air-source-level"),undefined);
});
test("missing readings and unknown source classes remain unknown, while fresh normal readings can honestly report zero attention",()=>{
  const missing=buildImportantEvents(input());assert.equal(missing.events.length,0);assert.ok(missing.coverage.every(c=>c.used===0));
  const known=buildImportantEvents({...input(),roads:{stations:[road("zero",{value:0,level:"normal"})]},water:{stations:[water("unclassified",{capacityPercent:null})]},air:{stations:[air("high-number",{value:150,sourceLevel:null})]}});
  assert.equal(known.events.length,0);assert.equal(known.coverage[0].used,1);assert.match(known.coverage[0].summary,/^0 จุด/);assert.equal(known.coverage[1].used,0);assert.equal(known.coverage[2].used,0);
});
const heat = (overrides={}) => ({layer:"heat",status:"live",timestamp:at,model:"Open-Meteo",steps:[{date:"2026-10-02",cadence:"hour",startHour:20,endHour:21}],points:[{id:"h",label:"จุดแบบจำลอง",...position,values:[43]}],...overrides});
test("heat alerts use the actual current interval, never tomorrow or a daily maximum, and expire cached forecasts",()=>{
  const event=find(buildImportantEvents({...input(),heat:heat()}),"heat-current");assert.equal(event.kind,"พยากรณ์");assert.match(event.detail,/20:00–21:00/);
  const fine=heat({steps:[{date:"2026-10-02",cadence:"window",startHour:18,endHour:21},{date:"2026-10-02",cadence:"hour",startHour:20,endHour:21}],points:[{...position,label:"hour first",values:[50,30]}]});
  assert.equal(find(buildImportantEvents({...input(),heat:fine}),"heat-current"),undefined);
  assert.match(buildImportantEvents({...input(),heat:fine}).coverage.find(c=>c.topic==="heat").summary,/30.0°C · 20:00–21:00/);
  for(const data of [heat({steps:[{date:"2026-10-02",cadence:"day",window:null}]}),heat({steps:[{date:"2026-10-03",cadence:"hour",startHour:20,endHour:21}]}),heat({timestamp:new Date(now-181*60000).toISOString()}),heat({points:[{...position,method:"idw",values:[60]}]})]) assert.equal(find(buildImportantEvents({...input(),heat:data}),"heat-current"),undefined);
});
test("nearby rain requires a chosen point and an unexpired source analysis; false and unavailable are distinct",()=>{
  const rain={status:"live",found:true,message:"ข้อความต้นทาง",observedAt:at,checkedAt:at,validUntil:new Date(now+30*60000).toISOString()};
  assert.equal(find(buildImportantEvents({...input(),rain}),"nearby-rain"),undefined);
  assert.equal(find(buildImportantEvents({...input(),place:position,rain}),"nearby-rain").detail,"ข้อความต้นทาง");
  const clear=buildImportantEvents({...input(),place:position,rain:{...rain,found:false}});assert.equal(clear.coverage.find(c=>c.topic==="rain").used,1);
  const old=buildImportantEvents({...input(),place:position,rain,now:now+11*60000});assert.equal(old.coverage.find(c=>c.topic==="rain").used,0);assert.equal(find(old,"nearby-rain"),undefined);
});
const event=(id="water-high",priority=2,count=1)=>({id,priority,count});
test("event watch dismisses repeated snapshots, but alerts for growth, severity, new topics and recurrence after resolution",()=>{
  let state=eventWatchReducer(initialEventWatch,{type:"toggle",scope:"metro",events:[event()]});assert.deepEqual(state.pending,["water-high"]);
  state=eventWatchReducer(state,{type:"dismiss"});
  const same=eventWatchReducer(state,{type:"sync",scope:"metro",events:[{...event(),observedAt:at,detail:"new timestamp"}]});assert.equal(same,state);
  state=eventWatchReducer(state,{type:"sync",scope:"metro",events:[event("water-high",2,2)]});assert.deepEqual(state.pending,["water-high"]);
  state=eventWatchReducer(state,{type:"dismiss"});state=eventWatchReducer(state,{type:"sync",scope:"metro",events:[event("water-high",2,1)]});assert.deepEqual(state.pending,[]);
  state=eventWatchReducer(state,{type:"sync",scope:"metro",events:[event("water-high",3,1),event("nearby-rain")]});assert.deepEqual(state.pending,["water-high","nearby-rain"]);
  state=eventWatchReducer(state,{type:"dismiss"});state=eventWatchReducer(state,{type:"sync",scope:"metro",events:[]});
  state=eventWatchReducer(state,{type:"sync",scope:"metro",events:[event()]});assert.deepEqual(state.pending,["water-high"]);
});
test("watching follows a changed scope, removes resolved alerts and counts growth of the severe subgroup",()=>{
  let state=eventWatchReducer(initialEventWatch,{type:"toggle",scope:"a",events:[{...event("road",3,10),alertCount:1}]});state=eventWatchReducer(state,{type:"dismiss"});
  state=eventWatchReducer(state,{type:"sync",scope:"a",events:[{...event("road",3,10),alertCount:2}]});assert.deepEqual(state.pending,["road"]);
  state=eventWatchReducer(state,{type:"sync",scope:"b",events:[event("rain")]});assert.deepEqual(state.pending,["rain"]);
  state=eventWatchReducer(state,{type:"sync",scope:"b",events:[]});assert.deepEqual(state.pending,[]);
  state=eventWatchReducer(state,{type:"toggle",scope:"b",events:[event()]});assert.equal(state.enabled,false);assert.deepEqual(state.pending,[]);
});
