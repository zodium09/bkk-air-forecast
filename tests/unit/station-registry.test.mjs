import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { normalizeWaterLevels, normalizeHydroWaterLevels } from '../../app/lib/water-levels.ts';
import { canonicalStation, canonicalBasinForStation, canonicalWaterStations } from '../../app/lib/hydro/station-registry.ts';
import { buildHydroBasins } from '../../app/lib/hydro/model.ts';
import { collectWaterObservations } from '../../app/lib/collect-water-observations.ts';
import { createD1HistoryStore } from '../../app/lib/water-history-store.ts';
import { createHydroResponse } from '../../app/lib/hydro/response.ts';

const now = Date.parse('2026-10-15T06:00:00Z');
const row = (id, lat = 13.7, lng = 100.5, changes = {}) => ({ basin: { basin_code: 10 }, station: { id, tele_station_name: { th: `สถานี ${id}` }, tele_station_lat: lat, tele_station_long: lng }, geocode: { province_code: 'unknown' }, waterlevel_msl: 0, waterlevel_datetime: '2026-10-15 12:55', ...changes });
const feed = rows => ({ waterlevel_data: { result: 'OK', data: rows } });
const seeds = [['06',18.79,98.99],['07',18.28,99.49],['08',17.01,99.82],['09',16.82,100.26],['11',15.38,99.85],['12',15,101],['chao-phraya',13.7,100.5]];

test('canonical coverage includes all seven basins without a known province and rejects out-of-polygon points', () => {
  const raw = feed([...seeds.map(([code,lat,lng]) => row(code,lat,lng)), row('outside',13.55,100.2)]);
  assert.equal(normalizeWaterLevels(raw,now).stations.length,0,'legacy province filter remains unchanged');
  const payload = normalizeHydroWaterLevels(raw,now);
  assert.equal(payload.stations.length,7);
  assert.deepEqual(payload.stations.map(point => canonicalBasinForStation(point)),seeds.map(seed => seed[0]));
  const identity = canonicalStation(payload.stations.at(-1));
  assert.equal(identity.canonicalId,'thaiwater:waterlevel:chao-phraya');
  assert.equal(identity.sourceStationId,'chao-phraya');
  assert.equal(identity.mapping,'polygon'); assert.equal(identity.reachId,null);
  assert.equal(payload.stations[0].province,'ต้นทางไม่ระบุจังหวัด');
  assert.equal(canonicalStation({...payload.stations[0],lat:13.55,lng:100.2}).mapping,'unknown');
});

test('legacy metro stations outside basin keep their old behavior while hydro rejects them', () => {
  const raw = feed([row('outside',13.55,100.2,{geocode:{province_code:74}})]);
  assert.equal(normalizeWaterLevels(raw,now).stations.length,1);
  assert.equal(normalizeHydroWaterLevels(raw,now).stations.length,0);
});

test('duplicates cannot count twice across basins; valid latest measurement wins', () => {
  const payload = normalizeHydroWaterLevels(feed([row(1),row(1,18.79,98.99,{waterlevel_msl:-1,waterlevel_datetime:'2026-10-15 12:59'}),row(1,13.7,100.5,{waterlevel_msl:100,waterlevel_datetime:'2026-10-15 14:00'})]),now);
  assert.equal(payload.stations.length,1); assert.equal(payload.stations[0].value,-1);
  assert.equal(canonicalWaterStations([...payload.stations,...payload.stations]).length,1);
  const basins=buildHydroBasins({water:payload,upstream:{basins:[{code:'07',water:payload.stations,rain:[],dams:[]}]},centralRain:[],sources:{water:'live',rain:'unavailable',dams:'unavailable'}},now);
  assert.equal(basins.reduce((sum,basin)=>sum+basin.water.length,0),1);
  assert.equal(basins.find(basin=>basin.id==='06').water[0].id,'1');
});

test('new central station uses the same source ID, datum and timestamp in current and durable history', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const db = {async exec(sql){sqlite.exec(sql);},prepare(sql){let values=[];const statement={bind(...args){values=args;return statement;},async all(){return{results:sqlite.prepare(sql).all(...values)};},run(){sqlite.prepare(sql).run(...values);}};return statement;},async batch(statements){for(const statement of statements)statement.run();}};
  try {
    for (const migration of ['0000_last_proemial_gods.sql','0001_productive_daredevil.sql']) sqlite.exec(await fs.readFile(`drizzle/${migration}`,'utf8'));
    const store=createD1HistoryStore(db),raw=feed([row(987)]);
    await collectWaterObservations(store,async()=>Response.json(raw),now);
    const response=await createHydroResponse({store,now,fetchImpl:async url=>String(url).includes('waterlevel')?Response.json(raw):new Response(null,{status:503})});
    const current=(await response.json()).water.stations[0];
    assert.equal(current.id,'987'); assert.equal(current.datum,'msl');
    assert.deepEqual((await store.read(current.id,current.datum,now-3600000,now)).map(point=>({...point})),[{observedAt:current.observedAt,value:0}]);
    assert.equal((await store.readRuns())[0].accepted,1);
  } finally {sqlite.close();}
});
