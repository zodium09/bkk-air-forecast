import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {tidePoints,tideTime,tideDateAfter,validTideDate,normalizeTideRain,tideWindows,tideDayExtremes,tideReference,tideStations,tideObservedEvidence} from "../../app/lib/tides.ts";
import {createTideOutlookResponse} from "../../app/api/tide-outlook/handler.ts";
import {tideRainUrl,fetchTideRain} from "../../app/lib/tide-outlook-provider.ts";

const table=JSON.parse(await readFile(new URL('../../app/data/tide-predictions-2026.json',import.meta.url),'utf8'));
const date='2026-10-04',now=Date.parse(`${date}T10:00:00+07:00`);
const rawRain=(values=Array(169).fill(1))=>({utc_offset_seconds:25200,hourly_units:{precipitation:'mm'},hourly:{time:Array.from({length:169},(_,i)=>new Date(Date.parse(tideTime(date,i))+7*3600000).toISOString().slice(0,16)),precipitation:values}});
const rain=normalizeTideRain(rawRain(),date),points=tidePoints(table,'phra-chul',date);

test('official MSL facts retain full annual hours, station provenance and negative values',()=>{
  assert.equal(table.year,2026);assert.equal(table.datum,'msl');assert.equal(table.cadenceMinutes,60);
  for(const s of tideStations){const record=table.stations[s.id];assert.equal(record.hourlyDecimetres.length,8760);assert.ok(record.hourlyDecimetres.every(Number.isInteger));assert.equal(record.sourceUrl,s.sourceUrl);assert.match(record.sha256,/^[a-f0-9]{64}$/);}
  // Verified against the original October page, row 4, hours 0–23.
  assert.deepEqual(points.slice(0,24).map(p=>p.metres),[-.4,-.8,-1.1,-1.3,-1.4,-1.4,-1.1,-.7,-.2,.3,.7,.9,1.1,1.1,1.1,1,1,.9,1,1,.9,.9,.7,.4]);
  assert.equal(points[24].at,'2026-10-04T17:00:00.000Z');assert.equal(points[24].metres,0);
});
test('annual predictions expire across year boundaries and invalid dates never roll over',()=>{
  assert.equal(validTideDate('2026-02-29'),false);assert.equal(validTideDate('2024-02-29'),true);assert.equal(validTideDate('2026-13-01'),false);
  assert.deepEqual(tidePoints(table,'phra-chul','2026-02-29'),[]);assert.deepEqual(tidePoints(table,'bad',date),[]);
  assert.ok(tidePoints(table,'phra-chul','2027-01-01').every(p=>p.metres===null));
  const edge=tidePoints(table,'phra-chul','2026-12-31',1);assert.notEqual(edge[23].metres,null);assert.equal(edge[24].metres,null);
  assert.equal(tideTime('',0),'');assert.equal(tideDateAfter('2026-12-31',1),'2027-01-01');
});
test('rain timestamps denote the preceding hour, including midnight endpoints',()=>{
  const values=Array(169).fill(0);values[0]=100;values[1]=2.5;values[24]=8;
  const hours=normalizeTideRain(rawRain(values),date);
  assert.equal(hours[0].mm,2.5);assert.equal(hours[0].start,tideTime(date,0));assert.equal(hours[0].end,tideTime(date,1));assert.equal(hours[23].mm,8);assert.equal(hours[24].mm,0);
});
test('missing, wrong-unit, negative, duplicate and offset-mismatched rain never become zero',()=>{
  for(const change of [{utc_offset_seconds:0},{hourly_units:{precipitation:'inch'}}])assert.ok(normalizeTideRain({...rawRain(),...change},date).every(h=>h.mm===null));
  const raw=rawRain();raw.hourly.precipitation[1]=null;raw.hourly.precipitation[2]=-1;raw.hourly.precipitation[3]=NaN;raw.hourly.time[5]=raw.hourly.time[4];
  const hours=normalizeTideRain(raw,date);for(const i of [0,1,2,3,4])assert.equal(hours[i].mm,null);
});
test('three-hour windows require complete matched bins and identify rain–tide overlap',()=>{
  const wetRain=rain.map(r=>({...r,mm:4})),windows=tideWindows(points,wetRain,date);
  assert.equal(windows.length,8);assert.equal(windows[4].kind,'combined');assert.equal(windows[4].rainMm,12);assert.equal(windows[4].tideMax,1.1);
  assert.equal(windows[1].kind,'rain');assert.equal(windows[1].nearPeak,false);
  const dry=tideWindows(points,rain.map(r=>({...r,mm:0})),date);assert.equal(dry[4].kind,'tide');assert.equal(dry[1].kind,'other');
  const missing=wetRain.map((r,i)=>({...r,mm:i===12?null:r.mm}));assert.equal(tideWindows(points,missing,date)[4].kind,'unknown');assert.equal(tideWindows(points,missing,date)[4].rainMm,null);
  const missingWater=points.map((p,i)=>({...p,metres:i===2?null:p.metres}));assert.ok(tideWindows(missingWater,wetRain,date).every(w=>w.kind==='unknown'));
  assert.deepEqual(tideWindows(points,rain,''),[]);
});
test('partial rain still reveals known overlap but cannot claim complete absence of a signal',()=>{
  const partial=rain.map((r,i)=>({...r,mm:i<12?null:4}));const windows=tideWindows(points,partial,date);
  assert.equal(windows[0].kind,'unknown');assert.equal(windows[4].kind,'combined');
  const extrema=tideDayExtremes(points,date);assert.equal(extrema.max,1.1);assert.equal(extrema.min,-1.4);assert.deepEqual(extrema.high,[12,13,14].map(h=>tideTime(date,h)));
});
test('automatic reference is local and upstream areas are not classified using coastal tides',()=>{
  assert.equal(tideReference({lat:13.55,lng:100.57},'metro').station.id,'phra-chul');
  assert.equal(tideReference({lat:13.7,lng:100.58},'bangkok').station.id,'bangkok-port');
  assert.equal(tideReference({lat:15.7,lng:100.1},'nakhon-sawan').nearby,false);
  assert.equal(tideReference(null,'samut-sakhon').station.id,'tha-chin');assert.equal(tideReference({lat:NaN,lng:100},'metro').nearby,false);
});
test('nearby observed flooding excludes old/future/far readings and keeps unknown and low water separate',()=>{
  const station=tideStations[0],base={...station,value:1,datum:'msl',bank:2,capacityPercent:85,status:'fresh',observedAt:new Date(now-10*60000).toISOString()};
  const water={stations:[{...base,id:'high'},{...base,id:'low',capacityPercent:5},{...base,id:'unknown',capacityPercent:null,bank:null},{...base,id:'stale',observedAt:new Date(now-61*60000).toISOString()},{...base,id:'future',observedAt:new Date(now+10*60000).toISOString()},{...base,id:'far',lat:15}]};
  const road={...base,level:'flood',sourceStatus:'น้ำท่วม'};
  const evidence=tideObservedEvidence(station,water,{stations:[road,{...road,observedAt:new Date(now-31*60000).toISOString()},{...road,level:'unknown'},{...road,lat:15}]},now);
  assert.equal(evidence.waterTotal,3);assert.equal(evidence.waterClassified,2);assert.deepEqual(evidence.high.map(s=>s.id),['high']);assert.equal(evidence.roadTotal,1);assert.equal(evidence.flood.length,1);
});
test('API accepts only supported stations and current Thai date without fetching invalid input',async()=>{
  let calls=0;const fetchImpl=async()=>{calls++;return Response.json(rawRain());};
  for(const query of ['station=bad','date=2026-10-03','date=2026-02-29']){const response=await createTideOutlookResponse(new Request(`https://local/api/tide-outlook?${query}`),{now,fetchImpl,cache:false});assert.equal(response.status,400);}
  assert.equal(calls,0);
  const response=await createTideOutlookResponse(new Request('https://local/api/tide-outlook?station=bangkok-port'),{now,fetchImpl,cache:false});const payload=await response.json();assert.equal(response.status,200);assert.equal(payload.station.id,'bangkok-port');assert.equal(payload.dates.length,7);assert.equal(payload.points.length,169);assert.equal(payload.rainStatus,'available');assert.equal(payload.rain.length,168);
});
test('rain failures keep tide facts and expired tables never trigger a forecast request',async()=>{
  const request=new Request('https://local/api/tide-outlook');let calls=0;
  const fetchImpl=async()=>{calls++;throw new Error('offline');};
  const response=await createTideOutlookResponse(request,{now,fetchImpl,cache:false});const data=await response.json();assert.equal(data.status,'available');assert.equal(data.rainStatus,'unavailable');assert.ok(data.rain.every(h=>h.mm===null));assert.notEqual(data.points[10].metres,null);
  const expired=await createTideOutlookResponse(request,{now:Date.parse('2027-01-01T10:00:00+07:00'),fetchImpl,cache:false});assert.equal((await expired.json()).status,'unavailable');assert.equal(calls,1);assert.equal(expired.headers.get('cache-control'),'no-store');
});
test('forecast URL uses the fixed public station and caches/deduplicates repeated requests',async()=>{
  const url=new URL(tideRainUrl(tideStations[0],date));assert.equal(url.origin,'https://api.open-meteo.com');assert.equal(url.searchParams.get('hourly'),'precipitation');assert.equal(url.searchParams.get('latitude'),String(tideStations[0].lat));assert.equal(url.searchParams.get('end_date'),'2026-10-11');
  let calls=0;const options={now,fetchImpl:async()=>{calls++;return Response.json(rawRain());}};
  const results=await Promise.all([fetchTideRain(tideStations[3],date,options),fetchTideRain(tideStations[3],date,options)]);assert.equal(calls,1);assert.equal(results[0],results[1]);await fetchTideRain(tideStations[3],date,options);assert.equal(calls,1);
});
