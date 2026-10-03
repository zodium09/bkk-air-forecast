import test from "node:test";
import assert from "node:assert/strict";
import { forecastRiskAreas, groupRiskAreas } from "../../app/lib/risk-area-data.ts";
import { buildImportantEvents } from "../../app/lib/important-events.ts";
const now=Date.parse("2026-10-03T05:00:00Z"), at=new Date(now).toISOString();
const coord={lat:13.7563,lng:100.5018};
const point=(id,first,second,extra={})=>({id,label:id,...coord,values:[first],secondary:[second],...extra});
const data=(layer,points,step={date:"2026-10-03",key:"2026-10-03:day",label:"ทั้งวัน",window:null,cadence:"day"})=>({layer,status:"live",timestamp:at,model:"source model",steps:[step],points});
const input=()=>({region:"metro",place:null,now,roads:null,water:null,air:null,rain:null,heat:null});

test("rain risk never applies daily accumulation thresholds to hourly rain; real zero and missing classification stay distinct",()=>{
  const points=[point("heavy",20,100),point("zero",0,0),point("missing",null,100)];
  const daily=forecastRiskAreas(data("rain",points),0,"metro","secondary");
  assert.deepEqual(daily.points.map(p=>p.rank),[3,0,3]);
  const hour={date:"2026-10-03",key:"2026-10-03:h12",label:"12:00–13:00",window:12,cadence:"hour",startHour:12,endHour:13};
  const hourly=forecastRiskAreas(data("rain",points,hour),0,"metro","secondary");
  assert.deepEqual(hourly.points.map(p=>p.rank),[0,0,-1]);
  assert.equal(hourly.points[0].value,100);
  assert.match(hourly.points[0].detail,/สีแสดงระดับโอกาสฝน/);
  assert.match(hourly.note,/ไม่ใช้เกณฑ์สะสมทั้งวัน/);
  assert.equal(hourly.points[1].value,0);
  assert.equal(forecastRiskAreas(data("rain",[point("p",80,1)],hour),0,"metro").points[0].rank,2);
});

test("forecast areas use the selected date, actual coordinates and heat index when temperature is selected",()=>{
  const next={date:"2026-10-04",key:"2026-10-04:h12",label:"12:00",window:12,cadence:"hour",startHour:12,endHour:13};
  const heat=forecastRiskAreas(data("heat",[point("h",53,36)],next),0,"metro","secondary").points[0];
  assert.equal(heat.value,53); assert.equal(heat.rank,3);assert.match(heat.detail,/36°C/);assert.match(heat.period,/2026-10-04/);
  assert.equal(new URL(heat.href,"https://app.test").searchParams.get("time"),next.key);
  const rows=forecastRiskAreas(data("air",[point("a",37.5,0),point("b",37.6,0),point("bad",80,0,{lat:NaN})]),0,"metro").points;
  assert.deepEqual(rows.map(p=>p.rank),[1,2]);
  assert.equal(forecastRiskAreas(data("heat",[point("h",53,36)]),99,"metro").points.length,0);
  assert.equal(forecastRiskAreas(null,0,"metro","primary","heat").id,"heat");
  assert.equal(forecastRiskAreas(null,0,"metro","primary","air").id,"air");
});

test("current event map shares measured source classes, unknown averaging and freshness with the important-event summary",()=>{
  const result=buildImportantEvents({...input(),
    roads:{stations:[{id:"r",name:"ถนน",...coord,value:0,level:"normal",status:"fresh",observedAt:at}]},
    water:{stations:[{id:"w",name:"น้ำ",...coord,provinceId:"bangkok",province:"กรุงเทพมหานคร",district:"พระนคร",value:2,datum:"msl",capacityPercent:110,status:"fresh",observedAt:at},{id:"low",name:"น้ำต่ำ",...coord,provinceId:"bangkok",value:0,capacityPercent:5,datum:"gauge",status:"fresh",observedAt:at}]},
    air:{stations:[{id:"a",name:"ไม่ทราบช่วงเฉลี่ย",area:"เขตหนึ่ง",...coord,provinceId:"bangkok",value:150,sourceLevel:null,source:"AirBKK",observedAt:at},{id:"old",name:"เก่า",...coord,provinceId:"bangkok",value:150,sourceLevel:"red",source:"AirBKK",observedAt:new Date(now-91*60000).toISOString()}]},
  });
  assert.equal(result.points.find(p=>p.id==="road:r").value,0);
  assert.equal(result.points.find(p=>p.id==="road:r").rank,0);
  assert.equal(result.points.find(p=>p.id==="water:w").eventId,"water-high");
  assert.equal(result.points.find(p=>p.id==="water:low").eventId,"water-low");
  assert.match(result.points.find(p=>p.id==="water:low").status,/น้ำน้อยวิกฤติ/);
  assert.equal(result.points.find(p=>p.id==="air:a").rank,-1);
  assert.equal(result.points.find(p=>p.id==="air:a").value,150);
  assert.equal(result.points.find(p=>p.id==="air:old").rank,-1);
  assert.equal(result.points.find(p=>p.id==="air:old").value,null);
  const rain={status:"live",found:true,message:"สัญญาณฝน",observedAt:at,checkedAt:at,validUntil:new Date(now+30*60000).toISOString()};
  const nearby=buildImportantEvents({...input(),place:coord,rain}).points.find(p=>p.topic==="rain");
  assert.equal(nearby.rank,1);assert.equal(nearby.value,null);assert.equal(nearby.eventId,"nearby-rain");
});

test("area grouping counts actual records and retains unknown points without inventing district-wide severity",()=>{
  const topic=forecastRiskAreas(data("air",[point("low",0,0,{area:"อำเภอหนึ่ง"}),point("high",80,0,{area:"อำเภอหนึ่ง"}),point("missing",null,0,{area:"อำเภอสอง"})]),0,"metro");
  const groups=groupRiskAreas(topic.points);
  assert.equal(groups[0].name,"อำเภอหนึ่ง");assert.equal(groups[0].attention,1);assert.equal(groups[0].points.length,2);
  assert.equal(groups[1].rank,-1);assert.equal(groups[1].attention,0);
  assert.equal(topic.points.some(p=>"polygon" in p),false);
});
