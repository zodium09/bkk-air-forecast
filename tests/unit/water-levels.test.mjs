import assert from 'node:assert/strict';
import test from 'node:test';
import { formatWaterValue, normalizeWaterLevels, waterBankDifference, waterRisk, waterStationsForArea } from '../../app/lib/water-levels.ts';
import { createWaterLevelsResponse } from '../../app/api/water-levels/route.ts';
const now = Date.parse('2026-10-01T07:00:00Z');
const row = (changes={}) => ({ waterlevel_datetime:'2026-10-01 13:50',waterlevel_msl:'1.67',waterlevel_m:null,station:{id:852087,tele_station_name:{th:'อโศก'},tele_station_lat:13.743286,tele_station_long:100.56218,min_bank:2},river_name:'คลองแสนแสบ',geocode:{province_code:'10',amphoe_name:{th:'วัฒนา'}},agency:{agency_name:{th:'สถาบันสารสนเทศทรัพยากรน้ำ'}},...changes });
const feed = (rows) => ({waterlevel_data:{result:'OK',data:rows}});

test('published capacity bands retain their boundaries and real source percentages above 100',()=>{
 for(const [percent,id] of [[0,'critical-low'],[10,'critical-low'],[10.01,'low'],[30,'low'],[30.01,'normal'],[70,'normal'],[70.01,'high'],[100,'high'],[100.01,'overflow'],[126.23,'overflow']]){
  const station=normalizeWaterLevels(feed([row({storage_percent:String(percent),station:{...row().station,ground_level:-1.2}})]),now).stations[0];
  assert.equal(station.capacityPercent,percent);assert.equal(station.ground,-1.2);assert.equal(waterRisk(station).id,id);
 }
});
test('old or incompatible water data cannot create a current risk signal or invent a capacity percentage',()=>{
 for(const waterlevel_datetime of ['2026-10-01 10:00','2026-10-01 23:00','invalid']){
  const station=normalizeWaterLevels(feed([row({storage_percent:126,waterlevel_datetime})]),now).stations[0];
  assert.equal(waterRisk(station).priority,-1);assert.equal(waterRisk(station).id,'unknown');
 }
 const missing=normalizeWaterLevels(feed([row({storage_percent:''})]),now).stations[0];
 assert.equal(missing.capacityPercent,null);assert.equal(waterRisk(missing).id,'below-bank');assert.equal(waterRisk(missing).priority,-1);
 const gauge=normalizeWaterLevels(feed([row({waterlevel_msl:null,waterlevel_m:2,storage_percent:null})]),now).stations[0];
 assert.equal(gauge.ground,null);assert.equal(waterRisk(gauge).id,'unknown');
 const reached=normalizeWaterLevels(feed([row({waterlevel_msl:2,storage_percent:null})]),now).stations[0];
 assert.equal(waterRisk(reached).id,'overflow');assert.equal(reached.capacityPercent,null);
});

test('centimetre differences and negative readings are not rounded into a false zero',()=>{
 assert.equal(formatWaterValue(.04),'0.04');assert.equal(formatWaterValue(-2.96),'-2.96');
 assert.equal(formatWaterValue(0),'0.00');assert.equal(formatWaterValue(null),'—');assert.equal(formatWaterValue(.0001),'<0.001');
});

test('water readings retain Bangkok time, station identity, real zero and negative MSL values',()=>{
 const payload=normalizeWaterLevels(feed([row({waterlevel_msl:'0'}),row({station:{...row().station,id:10},waterlevel_msl:'-2.96'})]),now);
 assert.equal(payload.status,'live');
 assert.equal(payload.stations[0].observedAt,'2026-10-01T06:50:00.000Z');
 assert.equal(payload.stations[0].value,0);
 assert.equal(payload.stations[1].value,-2.96);
 assert.equal(payload.stations[0].kind,'canal');
 assert.equal(payload.stations[0].agency,'สถาบันสารสนเทศทรัพยากรน้ำ');
});
test('stale, expired, future and invalid readings never become a fresh flood or safe signal',()=>{
 const stale=normalizeWaterLevels(feed([row({waterlevel_datetime:'2026-10-01 10:00',waterlevel_msl:'3'})]),now).stations[0];
 assert.equal(stale.status,'stale');assert.equal(stale.value,3);assert.equal(waterBankDifference(stale),null);
 for(const changes of [{waterlevel_datetime:'2026-09-29 13:50'},{waterlevel_datetime:'2026-10-01 23:00'},{waterlevel_datetime:'2026-02-30 13:50'},{waterlevel_msl:''},{waterlevel_msl:'NaN'},{waterlevel_msl:null}]){
  const station=normalizeWaterLevels(feed([row(changes)]),now).stations[0];
  assert.equal(station.value,null);assert.equal(station.status,'unavailable');assert.equal(waterBankDifference(station),null);
 }
});
test('bank comparison uses matching MSL datum and future duplicates cannot displace valid readings',()=>{
 const payload=normalizeWaterLevels(feed([row({waterlevel_msl:'2.3'}),row({waterlevel_datetime:'2026-10-01 23:00',waterlevel_msl:'8'})]),now);
 assert.equal(payload.stations.length,1);assert.equal(payload.stations[0].value,2.3);
 assert.ok(Math.abs(waterBankDifference(payload.stations[0])-.3)<1e-10);
 const gauge=normalizeWaterLevels(feed([row({waterlevel_msl:null,waterlevel_m:'1.2'})]),now).stations[0];
 assert.equal(gauge.datum,'gauge');assert.equal(gauge.bank,null);assert.equal(waterBankDifference(gauge),null);
});
test('area selection filters actual provinces, ranks fresh nearby stations and excludes malformed coordinates',()=>{
 const stations=normalizeWaterLevels(feed([row(),row({station:{...row().station,id:2,tele_station_lat:13.8},geocode:{province_code:'12'},river_name:'แม่น้ำเจ้าพระยา'}),row({station:{...row().station,id:3,tele_station_lat:null}}),row({geocode:{province_code:'71'}})]),now).stations;
 assert.equal(stations.length,2);
 assert.deepEqual(waterStationsForArea(stations,'nonthaburi').map(s=>s.id),['2']);
 assert.equal(waterStationsForArea(stations,'metro',{lat:13.8,lng:100.56218})[0].id,'2');
 assert.equal(stations[1].kind,'river');
});
test('water API preserves measurements and returns explicit unavailability for bad or failed providers',async()=>{
 const response=await createWaterLevelsResponse({fetchImpl:async()=>Response.json(feed([row()])),now:()=>now});
 assert.equal((await response.json()).stations[0].value,1.67);
 assert.match(response.headers.get('Cache-Control'),/max-age=60/);
 for(const fetchImpl of [async()=>{throw new Error('timeout');},async()=>new Response('error',{status:500}),async()=>Response.json({waterlevel_data:{result:'ERROR',data:[row()]}})]){
  const result=await createWaterLevelsResponse({fetchImpl,now:()=>now});const payload=await result.json();
  assert.equal(payload.status,'unavailable');assert.deepEqual(payload.stations,[]);assert.equal(result.headers.get('Cache-Control'),'no-store');
 }
});
