import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAirObservations, selectAirObservation, fetchAirObservations } from '../../app/lib/air-observations.ts';
import { normalizeRoadFloods, currentRoadFloods } from '../../app/lib/road-floods.ts';
import { observationTime, observationNumber } from '../../app/lib/observation-time.ts';
import { refreshDue } from '../../app/lib/refresh-policy.ts';
import { currentWaterStations } from '../../app/lib/water-levels.ts';

const now = Date.parse('2026-10-01T15:00:00Z');
const bkk = (changes = {}) => ({ MeasIndex:'56', District:'เขตดินแดง', Area:'สถานีทดสอบ',Lat:'13.77',Long:'100.55',DateTime:'2026-10-01 22:00:00','PM2.5':22.8,'PM2.5_aqi':'green',...changes });
const air = rows => ({ status:'Success',message:rows });
const road = (changes = {}) => ({ flood_id: 123,flood_code:'FL.CTC.01',flood_shortname:'รัชดา-ลาดพร้าว',road_name:'ถนนรัชดาภิเษก',districtName:'จตุจักร',latitude:13.8,longitude:100.55,site_timestamp:`/Date(${now-300000})/`,chkStatustxt:'ปกติ',sensor:'ปกติ',flood:0,...changes });

test('observation timestamps reject rollover dates, impossible hours and empty numeric readings', () => {
  assert.equal(observationTime('2026-10-01T22:00:00.067'),now);
  assert.equal(observationTime(`/Date(${now})/`),now);
  for(const value of ['2026-02-30 12:00','2026-10-01 24:00','invalid',null]) assert.equal(observationTime(value),null);
  for(const value of ['',null,false,'NaN',-1]) assert.equal(observationNumber(value,0,500),null);
  assert.equal(observationNumber('0',0,500),0);
});
test('current PM observations remain independent of CAMS, keep real zero and reject future duplicates', () => {
  const result=normalizeAirObservations(air([bkk({'PM2.5':0}),bkk({DateTime:'2026-10-02 23:00:00','PM2.5':99})]),null,now);
  assert.equal(result.status,'degraded'); assert.equal(result.stations.length,1);
  assert.equal(result.stations[0].value,0); assert.equal(result.stations[0].averagingHours,null);
  assert.equal(selectAirObservation(result.stations,'metro',null,now).value,0);
  assert.equal(selectAirObservation(result.stations,'metro',null,now+91*60000).value,null);
});
test('PM summaries preserve province coverage, station coordinates and averaging period separation', () => {
  const pcd={stations:[{stationID:'pcd1',nameTH:'สถานีปทุมธานี',areaTH:'ปทุมธานี',lat:14.02,long:100.52,AQILast:{date:'2026-10-01',time:'22:00',PM25:{value:70}}}]};
  const result=normalizeAirObservations(air([bkk(),bkk({MeasIndex:'57','PM2.5':10,Lat:13.75})]),pcd,now);
  const reading=selectAirObservation(result.stations,'metro',null,now);
  assert.deepEqual(reading.sources,['AirBKK']); assert.equal(reading.count,2); assert.equal(reading.value,16.4);
  assert.equal(selectAirObservation(result.stations,'pathum-thani',null,now).value,70);
  assert.equal(selectAirObservation(result.stations,'samut-sakhon',null,now).value,null);
  const near=selectAirObservation(result.stations,'bangkok',{lat:13.77,lng:100.55},now);
  assert.equal(near.station.id,'airbkk-56'); assert.equal(near.distanceKm,0);
  assert.equal(selectAirObservation(result.stations,'bangkok',{lat:13.4,lng:100.2},now).value,null);
});
test('air collection uses the public POST contract and exposes a secondary outage without requesting forecasts', async () => {
  const calls=[];
  const result=await fetchAirObservations({now,fetchImpl:async(url,init)=>{calls.push([String(url),init]);return String(url).includes('airbkk')?Response.json(air([bkk()])):new Response('',{status:503});}});
  assert.equal(calls.length,2); assert.equal(calls.find(c=>c[0].includes('airbkk'))[1].method,'POST');
  assert.equal(result.upstream.air4thai,false); assert.equal(result.stations[0].value,22.8);
});
test('road flood status follows the agency and never classifies failed, stale, future or empty sensors as normal', () => {
  const rows=[road(),road({flood_id:2,flood:7.2,chkStatustxt:'น้ำท่วมเล็กน้อย'}),road({flood_id:3,flood:20,chkStatustxt:'น้ำท่วม'}),road({flood_id:4,flood:0,chkStatustxt:'ขัดข้อง'}),road({flood_id:5,site_timestamp:`/Date(${now-31*60000})/`}),road({flood_id:6,site_timestamp:`/Date(${now+3600000})/`}),road({flood_id:7,flood:''})];
  const result=normalizeRoadFloods({dtTbl:rows},now);
  assert.equal(result.status,'degraded'); assert.equal(result.stations[0].value,0);
  assert.deepEqual(result.stations.map(s=>s.level),['normal','minor','flood','unknown','unknown','unknown','unknown']);
  assert.equal(result.stations[3].value,null); assert.equal(result.stations[4].status,'stale');
  assert.equal(currentRoadFloods(result.stations,now+31*60000)[0].level,'unknown');
  assert.equal(currentRoadFloods(result.stations,now+7*3600000)[0].value,null);
});
test('tunnel direction samples retain distinct ids even when they share a station code', () => {
  const result=normalizeRoadFloods({dtTbl:[road({flood_id:10,flood_code:'TN.HKG.01',tunnel_sub_name:'ขาเข้า'}),road({flood_id:11,flood_code:'TN.HKG.01',tunnel_sub_name:'ขาออก'})]},now);
  assert.equal(result.stations.length,2); assert.deepEqual(result.stations.map(s=>s.direction),['ขาเข้า','ขาออก']);
});
test('live refresh is due at its interval or Bangkok midnight, and water freshness expires without a new fetch', () => {
  assert.equal(refreshDue(now+299999,now,300000),false); assert.equal(refreshDue(now+300000,now,300000),true);
  assert.equal(refreshDue(Date.parse('2026-10-01T17:00:00Z'),Date.parse('2026-10-01T16:59:59Z'),300000),true);
  const station={id:'1',observedAt:new Date(now).toISOString(),value:0,status:'fresh'};
  assert.equal(currentWaterStations([station],now+61*60000)[0].status,'stale');
  assert.equal(currentWaterStations([station],now+25*3600000)[0].value,null);
});
