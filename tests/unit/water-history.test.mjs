import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createFileHistoryStore, createD1HistoryStore } from '../../app/lib/water-history-store.ts';
import { waterHistoryGeometry, waterHistorySummary } from '../../app/lib/water-history.ts';
import { createWaterHistoryResponse } from '../../app/api/water-history/route.ts';
import { createWaterLevelsResponse } from '../../app/api/water-levels/route.ts';

const now=Date.parse('2026-10-01T15:00:00Z');
const station=(changes={})=>({id:'123',value:0,datum:'msl',observedAt:new Date(now).toISOString(),status:'fresh',...changes});
test('local archive survives a new store instance, deduplicates timestamps, retains negative/zero and separates datums',async()=>{
  const root=path.resolve('output/playwright'); await fs.mkdir(root,{recursive:true});
  const directory=await fs.mkdtemp(path.join(root,'history-test-'));
  try {
    const first=createFileHistoryStore(directory);
    await first.record([station(),station(),station({value:-.4,datum:'gauge'})],now);
    await first.record([station({value:-1.2,observedAt:new Date(now-300000).toISOString()}),station({value:null}),station({observedAt:new Date(now+3600000).toISOString()})],now);
    const reopened=createFileHistoryStore(directory);
    assert.deepEqual((await reopened.read('123','msl',now-3600000,now)).map(p=>p.value),[-1.2,0]);
    assert.deepEqual((await reopened.read('123','gauge',now-3600000,now)).map(p=>p.value),[-.4]);
    assert.equal((await fs.readFile(path.join(directory,'2026-10-01.ndjson'),'utf8')).trim().split('\n').length,3);
    await fs.writeFile(path.join(directory,'2026-01-01.ndjson'),'{}\n');
    await reopened.record([],now+86400000);
    assert.equal((await fs.readdir(directory)).includes('2026-01-01.ndjson'),false);
  } finally {assert.ok(path.resolve(directory).startsWith(root+path.sep));await fs.rm(directory,{recursive:true,force:true});}
});
test('D1 SQL archive upserts, sorts and prunes old samples using a real SQLite engine',async()=>{
  const sqlite=new DatabaseSync(':memory:');
  const prepare=(sql)=>{let values=[];const statement={bind(...v){values=v;return statement;},async all(){return{results:sqlite.prepare(sql).all(...values)};},run(){return sqlite.prepare(sql).run(...values);}};return statement;};
  const db={async exec(sql){sqlite.exec(sql);},prepare,async batch(statements){for(const statement of statements)statement.run();}};
  try{
    const store=createD1HistoryStore(db);
    await store.record([station(),station({value:-1,observedAt:new Date(now-300000).toISOString()})],now);
    await store.record([station({value:.05})],now);
    assert.deepEqual((await store.read('123','msl',now-3600000,now)).map(p=>p.value),[-1,.05]);
    await store.record([],now+91*86400000);
    assert.equal((await store.read('123','msl',now-3600000,now)).length,0);
  }finally{sqlite.close();}
});
test('water history API validates station ids, limits time windows and honestly reports a missing archive',async()=>{
  let calls=0;
  const store={kind:'local',async read(id,datum,from,to){calls++;assert.equal(id,'123');assert.equal(datum,'gauge');assert.equal(to-from,72*3600000);return[{observedAt:new Date(now).toISOString(),value:0}];}};
  const good=await createWaterHistoryResponse(new Request('https://local/api/water-history?station=123&datum=gauge&hours=72'),store,now);
  assert.equal((await good.json()).points[0].value,0);
  const invalid=await createWaterHistoryResponse(new Request('https://local/api/water-history?station=../../private'),store,now);
  assert.equal(invalid.status,400);assert.equal(calls,1);
  const missing=await createWaterHistoryResponse(new Request('https://local/api/water-history?station=123&hours=9999'),null,now);
  const payload=await missing.json();assert.equal(payload.hours,24);assert.equal(payload.storage,'unavailable');assert.deepEqual(payload.points,[]);
});
test('archive write failure never suppresses valid current water measurements',async()=>{
  const raw={waterlevel_data:{result:'OK',data:[{waterlevel_datetime:'2026-10-01 21:55',waterlevel_msl:0,station:{id:123,tele_station_name:{th:'สถานีทดสอบ'},tele_station_lat:13.75,tele_station_long:100.5},geocode:{province_code:'10'}}]}};
  const response=await createWaterLevelsResponse({now:()=>now,fetchImpl:async()=>Response.json(raw),store:{kind:'local',async record(){throw new Error('storage failure');}}});
  const payload=await response.json();assert.equal(payload.status,'live');assert.equal(payload.stations[0].value,0);assert.equal(payload.historyStorage,'unavailable');
});
test('history uses elapsed time on its axis, breaks long gaps and does not invent a trend from one or stale samples',()=>{
  const points=[{observedAt:new Date(now-3*3600000).toISOString(),value:0},{observedAt:new Date(now-2.9*3600000).toISOString(),value:.01},{observedAt:new Date(now-300000).toISOString(),value:.04},{observedAt:new Date(now).toISOString(),value:.06}];
  const geometry=waterHistoryGeometry(points);assert.equal(geometry.paths.length,2);
  assert.ok(geometry.dots[1].x-geometry.dots[0].x < geometry.dots[2].x-geometry.dots[1].x);
  assert.equal(waterHistorySummary(points.slice(-1),now),null);
  assert.equal(waterHistorySummary(points,now+2*3600000),null);
  const summary=waterHistorySummary(points,now);assert.equal(summary.minutes,5);assert.ok(Math.abs(summary.changeCm-2)<.00001);
});
