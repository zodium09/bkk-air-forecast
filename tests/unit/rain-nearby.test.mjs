import assert from "node:assert/strict";
import test from "node:test";
import { currentRadar,currentNearbyRain,normalizeNearbyRain,nearbyRainOutlook,rainDistanceKm } from "../../app/lib/rain-nearby.ts";
import { createNearbyRainResponse } from "../../app/api/rain-nearby/route.ts";
import { createTmdRadarResponse } from "../../app/api/tmd-radar/route.ts";
import { rainPlaceSteps } from "../../app/lib/rain-place-forecast.ts";

const now=Date.parse("2026-10-02T16:35:00Z");
const image=(mode,at)=>({id:at,mode,validAt:at,leadMinutes:15,label:"frame",imageUrl:"https://radargis.tmd.go.th/products/test.png",bounds:[[4,90],[23,111]],opacity:.8,unit:"mm/h"});
const radar={status:"live",observedAt:"2026-10-02T16:30:00Z",fetchedAt:new Date(now).toISOString(),ageMinutes:5,source:"TMD",sourcePage:"https://radargis.tmd.go.th/",disclaimer:"",observedFrames:[image("observed","2026-10-02T16:30:00Z")],nowcastFrames:[image("nowcast","2026-10-02T16:45:00Z"),image("nowcast","2026-10-02T17:00:00Z")]};
const json=value=>new Response(JSON.stringify(value),{headers:{"Content-Type":"application/json"}});

test("local analysis preserves the source result, but old, future or missing nowcast never becomes a current clear-sky or rain claim",()=>{
  const positive=normalizeNearbyRain({found:true,message:"ต้นทางพบแนวโน้มฝน",place:"พื้นที่ต้นทาง"},radar,now);
  assert.equal(positive.found,true);assert.equal(positive.message,"ต้นทางพบแนวโน้มฝน");assert.equal(positive.radiusKm,8);
  assert.equal(normalizeNearbyRain({found:false,message:"ยังไม่พบฝน"},radar,now).found,false);
  assert.equal(normalizeNearbyRain({found:false,message:"ยังไม่พบฝน"},{...radar,observedAt:"2026-10-02T15:00:00Z"},now).found,null);
  assert.equal(normalizeNearbyRain({found:true,message:"ฝน"},{...radar,observedAt:"2026-10-02T17:30:00Z"},now).found,null);
  assert.equal(normalizeNearbyRain({found:false,message:"ไม่มีฝน"},{...radar,nowcastFrames:[]},now).reason,"missing-nowcast");
  assert.equal(currentNearbyRain(normalizeNearbyRain({found:false,message:"ไม่มีฝน"},{...radar,nowcastFrames:[]},now),now).reason,"missing-nowcast");
  assert.equal(normalizeNearbyRain({found:false},radar,now).found,null);
  assert.equal(normalizeNearbyRain({found:"false",message:"ฝน"},radar,now).found,null);
});
test("clock expiry removes an analysis without waiting for another fetch and removes overdue nowcast frames",()=>{
  const payload=normalizeNearbyRain({found:true,message:"ฝน"},radar,now);
  assert.equal(currentNearbyRain(payload,now+11*60000).found,null);
  assert.equal(currentRadar(radar,Date.parse("2026-10-02T16:46:00Z")).nowcastFrames.length,1);
  assert.equal(currentRadar(radar,now+31*60000).nowcastFrames.length,0);
  assert.equal(currentRadar(radar,now+91*60000),null);
});
function model(){
  const steps=rainPlaceSteps("2026-10-02");
  const points=[{id:"local",label:"local",lat:13.7563,lng:100.5018,method:"provider",values:steps.map(()=>0),secondary:steps.map(()=>0)},{id:"far",label:"far",lat:14.2,lng:100.9,method:"provider",values:steps.map(()=>90),secondary:steps.map(()=>10)}];
  return {layer:"rain",status:"live",timestamp:new Date(now).toISOString(),valueMethod:"provider",steps,points};
}
test("nearby provider trends keep exact hourly intervals across Bangkok midnight and preserve genuine zero",()=>{
  const data=model();
  for(const [key,amount] of [["2026-10-02:h23",1],["2026-10-03:h00",2],["2026-10-03:h01",3]])data.points[0].secondary[data.steps.findIndex(s=>s.key===key)]=amount;
  const rows=nearbyRainOutlook(data,{lat:13.7563,lng:100.5018},now);
  assert.equal(rows.length,1);assert.equal(rows[0].total,6);assert.equal(rows[0].trend,"increasing");
  assert.deepEqual(rows[0].hours.map(h=>h.label),["23:00","00:00","01:00"]);
  assert.equal(nearbyRainOutlook(model(),{lat:13.7563,lng:100.5018},now)[0].total,0);
});
test("missing hourly evidence is never replaced by a daily total, an interpolated point or a probability",()=>{
  const data=model(),index=data.steps.findIndex(s=>s.key==="2026-10-03:h00");data.points[0].secondary[index]=null;
  const result=nearbyRainOutlook(data,{lat:13.7563,lng:100.5018},now)[0];
  assert.equal(result.total,null);assert.equal(result.hours[1].amount,null);assert.equal(result.probability,0);
  assert.deepEqual(nearbyRainOutlook({...data,valueMethod:"idw"},{lat:13.7563,lng:100.5018},now),[]);
  assert.deepEqual(nearbyRainOutlook({...data,timestamp:"2026-10-02T10:00:00Z"},{lat:13.7563,lng:100.5018},now),[]);
  assert.deepEqual(nearbyRainOutlook(data,null,now),[]);
  assert.ok(rainDistanceKm({lat:13,lng:100},{lat:14,lng:100})>111);
});
const rawFrame=(group,at)=>({group,valid_dt_iso:at,product_kind:"rainrate",unit:"mm/h",url:"/products/test.png",bounds:[[4,90],[23,111]]});
const rawCatalog={overlays:[rawFrame("02 Rain Rate Overlay","2026-10-02T16:30:00"),rawFrame("05 Rain Rate Nowcast Overlay","2026-10-02T16:45:00"),rawFrame("05 Rain Rate Nowcast Overlay","2026-10-02T17:00:00")]};
test("nearby API uses only the fixed TMD origins, checks catalog freshness, bounds coordinates and does not cache private location results",async()=>{
  const requests=[];
  const fetchImpl=async url=>{requests.push(String(url));return json(String(url).includes("overlays")?rawCatalog:{found:false,message:"ยังไม่พบฝน",place:"พื้นที่ต้นทาง"});};
  const response=await createNearbyRainResponse(new Request("http://local/api/rain-nearby?lat=13.7563&lng=100.5018&radius_km=999&url=https://evil.test"),{fetchImpl,now:()=>now});
  assert.equal(response.headers.get("cache-control"),"no-store");assert.equal((await response.json()).found,false);
  assert.equal(requests.length,2);assert.ok(requests.every(url=>new URL(url).origin==="https://radargis.tmd.go.th"));
  assert.ok(requests.some(url=>url.includes("radius_km=8")));
  for(const query of ["lat=&lng=100.5","lat=NaN&lng=100.5","lat=0&lng=0","lat=91&lng=100.5"]){const bad=await createNearbyRainResponse(new Request(`http://local/api/rain-nearby?${query}`),{fetchImpl,now:()=>now});assert.equal(bad.status,400);}
  assert.equal(requests.length,2);
});
test("an upstream analysis failure leaves the local result unknown even while radar pictures are available",async()=>{
  const response=await createNearbyRainResponse(new Request("http://local/api/rain-nearby?lat=13.7563&lng=100.5018"),{fetchImpl:async url=>{if(String(url).includes("overlays"))return json(rawCatalog);throw new Error("down");},now:()=>now});
  const data=await response.json();assert.equal(data.found,null);assert.equal(data.reason,"upstream-error");
});
test("future and malformed observation frames cannot move the radar baseline or create a false live status",async()=>{
  const raw={overlays:[...rawCatalog.overlays,rawFrame("02 Rain Rate Overlay","2026-10-02T17:30:00"),rawFrame("02 Rain Rate Overlay","2026-02-30T16:30:00"),{...rawFrame("02 Rain Rate Overlay","2026-10-02T16:34:00"),unit:"wrong"}]};
  const result=await(await createTmdRadarResponse({fetchImpl:async()=>json(raw),now:()=>now})).json();
  assert.equal(Date.parse(result.observedAt),Date.parse(radar.observedAt));assert.equal(result.observedFrames.length,1);assert.equal(result.status,"live");
});
