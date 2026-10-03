import assert from "node:assert/strict";
import test from "node:test";
import { localAirReading, localWaterReading } from "../../app/lib/around-you.ts";
import { formatWaterValue } from "../../app/lib/water-levels.ts";

const now = Date.parse("2026-10-03T07:00:00Z");
const place = { lat:13.7563, lng:100.5018 };
const observedAt = new Date(now - 10 * 60_000).toISOString();
const station = (changes = {}) => ({ id:"water-1", name:"สถานีทดสอบ", waterway:"คลอง", kind:"canal", provinceId:"bangkok", province:"กรุงเทพมหานคร", district:"พระนคร", ...place, value:0.04, datum:"msl", bank:2, capacityPercent:null, ground:null, observedAt, ageMinutes:10, status:"fresh", agency:"ThaiWater", ...changes });
const payload = stations => ({ status:"live", fetchedAt:new Date(now).toISOString(), stations, source:"ThaiWater", sourcePage:"https://www.thaiwater.net/" });

test("local water summary selects a fresh station within 8 km and excludes expired and distant readings", () => {
  const data = payload([station({id:"stale",value:9,observedAt:new Date(now-61*60_000).toISOString()}),station({id:"far",lat:13.9,value:9}),station({id:"near",lng:100.51,value:0.04})]);
  const result = localWaterReading(data,"bangkok",place,now);
  assert.deepEqual(result.stations.map(item=>item.id),["near"]);
  assert.equal(result.value,0.04);
  assert.equal(formatWaterValue(result.value),"0.04");
  assert.equal(result.attention.length,0);
  const expired = localWaterReading(data,"bangkok",place,now+61*60_000);
  assert.equal(expired.value,null);
  assert.equal(expired.stations.length,0);
});

test("water overview counts stations without averaging incompatible datums or turning absence into zero", () => {
  const data = payload([station({id:"msl",value:-2.96}),station({id:"gauge",datum:"gauge",value:0})]);
  const whole = localWaterReading(data,"bangkok",null,now);
  assert.equal(whole.value,null);
  assert.equal(whole.stations.length,2);
  const local = localWaterReading(payload([station({datum:"gauge",value:0})]),"bangkok",place,now);
  assert.equal(local.value,0);
  assert.equal(local.station.datum,"gauge");
  assert.equal(localWaterReading(null,"bangkok",place,now).value,null);
});

const airStation = (changes={}) => ({id:"air-1",name:"สถานีฝุ่น",area:"พระนคร",provinceId:"bangkok",...place,value:0,observedAt,source:"AirBKK",sourceLevel:null,averagingHours:null,status:"fresh",...changes});
test("air summary retains real zero and station distance, but never substitutes old or remote readings", () => {
  const data = { stations:[airStation()], status:"live", fetchedAt:observedAt, upstream:{airbkk:true,air4thai:false} };
  assert.equal(localAirReading(data,"bangkok",place,now).value,0);
  assert.equal(localAirReading(data,"bangkok",place,now).distanceKm,0);
  assert.equal(localAirReading(data,"bangkok",place,now+91*60_000).value,null);
  assert.equal(localAirReading({...data,stations:[airStation({lat:13.4})]},"metro",place,now).value,null);
  assert.equal(localAirReading(null,"bangkok",place,now).value,null);
});
