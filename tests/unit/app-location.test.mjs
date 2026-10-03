import assert from "node:assert/strict";
import test from "node:test";
import { createLocationSession, nearestLocationPlace } from "../../app/lib/app-location.ts";

test("concurrent pages share one browser request and receive the same coordinates",async()=>{
  const locate=createLocationSession(); let resolve, calls=0;
  const provider={getCurrentPosition(success){calls++;resolve=success;}};
  const one=locate(provider), two=locate(provider);
  assert.equal(calls,1); assert.equal(one,two);
  resolve({coords:{latitude:13.75,longitude:100.5}});
  assert.deepEqual(await one,{position:{lat:13.75,lng:100.5}});
  assert.equal(await one,await two);
  await locate(provider); assert.equal(calls,1);
});
test("a denial is remembered until an explicit retry",async()=>{
  const locate=createLocationSession(); let calls=0;
  const provider={getCurrentPosition(success,error){calls++;error({code:1});}};
  assert.deepEqual(await locate(provider),{error:"denied"});
  assert.deepEqual(await locate(provider),{error:"denied"}); assert.equal(calls,1);
  await locate(provider,true); assert.equal(calls,2);
});
test("missing geolocation and timed-out fixes produce usable error states",async()=>{
  assert.deepEqual(await createLocationSession()(undefined),{error:"unavailable"});
  assert.deepEqual(await createLocationSession()({getCurrentPosition(success,error){error({code:3});}}),{error:"timeout"});
});
test("browser location options permit a recent fix without continuous tracking",async()=>{
  let options;
  await createLocationSession()({getCurrentPosition(success,error,value){options=value;success({coords:{latitude:13.75,longitude:100.5}});}});
  assert.equal(options.maximumAge,300_000); assert.equal(options.timeout,10_000); assert.equal(options.enableHighAccuracy,false);
});
test("invalid fixes and browser security exceptions stay unavailable",async()=>{
  assert.deepEqual(await createLocationSession()({getCurrentPosition(){throw new Error("SecurityError");}}),{error:"unavailable"});
  assert.deepEqual(await createLocationSession()({getCurrentPosition(success){success({coords:{latitude:NaN,longitude:100.5}});}}),{error:"unavailable"});
});
test("automatic location snaps to a supported public reference and rejects distant regions",()=>{
  const points=[{id:"near",lat:13.751,lng:100.5},{id:"far",lat:14.5,lng:101}];
  const nearby=nearestLocationPlace(points,{lat:13.75,lng:100.5});
  assert.equal(nearby.place.id,"near"); assert.ok(nearby.km>0&&nearby.km<.2);
  assert.equal(nearestLocationPlace(points,{lat:18,lng:99}),null);
  assert.equal(nearestLocationPlace([],{lat:13.75,lng:100.5}),null);
});
