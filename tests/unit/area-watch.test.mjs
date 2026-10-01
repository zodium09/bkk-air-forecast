import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeWeather } from '../../app/lib/map-intelligence.ts';
import { timelineIndices, nextTimelineIndex, indexForDate } from '../../app/lib/dashboard-controls.ts';
import { buildAreaWatch, watchStepIndex } from '../../app/lib/area-watch.ts';
import { createRainForecastResponse } from '../../app/api/rain-forecast/route.ts';
import { createHeatForecastResponse } from '../../app/api/heat-forecast/route.ts';
const date='2026-09-26';
const payload={layer:'rain',status:'live',fetchedAt:date,model:'Test provider',sources:[],disclaimer:'',dataQuality:{},days:[{dateKey:date}],windows:[{dayIndex:0,windowIndex:2,start:'06:00',end:'09:00'}],points:[{id:'nonthaburi-1',label:'นนทบุรี · ตอนกลาง',lat:13.9,lng:100.4,daily:[{pointProbabilityMax:90,rainMm:80,maxHeatIndexC:40,maxTemperatureC:32}],windows:[{dayIndex:0,windowIndex:2,pointProbabilityPeak:90,rainMm:12,maxHeatIndexC:40,maxTemperatureC:32}],hourly:[{time:`${date}T06:00`,probability:0,rainMm:0,heatIndexC:35,temperatureC:29},{time:`${date}T07:00`,probability:null,rainMm:2,heatIndexC:null,temperatureC:30},{time:`${date}T08:00`,probability:90,rainMm:10,heatIndexC:44,temperatureC:34}]}]};
test('hourly normalization preserves actual zeros and missing values, separate from daily and three-hour aggregates',()=>{
 const data=normalizeWeather(payload,'rain');
 const hours=data.steps.flatMap((s,i)=>s.cadence==='hour'?[i]:[]);
 assert.deepEqual(hours.map(i=>data.points[0].values[i]),[0,null,90]);
 assert.deepEqual(hours.map(i=>data.points[0].secondary[i]),[0,2,10]);
 assert.equal(data.steps[hours[0]].key,`${date}:h06`);
 assert.deepEqual(timelineIndices(data.steps,hours[0]),hours);
 assert.equal(nextTimelineIndex(data.steps,hours[2]),hours[0]);
 assert.equal(indexForDate(data.steps,hours[0],date),hours[0]);
 const heat=normalizeWeather(payload,'heat');
 assert.deepEqual(hours.map(i=>heat.points[0].values[i]),[35,null,44]);
 assert.deepEqual(hours.map(i=>heat.points[0].secondary[i]),[29,30,34]);
});
test('daily-only TMD products never expose supporting hourly weather as hourly TMD rainfall',()=>{
 const data=normalizeWeather({...payload,dataQuality:{tmdProduct:'daily-7d',tmdStatus:'live'}},'rain');
 assert.equal(data.steps.length,1); assert.equal(data.points[0].secondary[0],80);
 const coarse=normalizeWeather({...payload,dataQuality:{tmdProduct:'hourly-48h',tmdStatus:'live',tmdCadenceHours:3}},'rain');
 assert.equal(coarse.steps.length,2); assert.ok(coarse.steps.every(s=>s.cadence!=='hour'));
});
test('area watch matches selected date and real time cadence without inventing incidents',()=>{
 const data=normalizeWeather(payload,'rain');
 assert.equal(buildAreaWatch(data,date,6).length,0);
 const watches=buildAreaWatch(data,date,8);
 assert.equal(watches.length,1); assert.equal(watches[0].area,'นนทบุรี');
 assert.equal(watches[0].title,'โอกาสฝนสูง'); assert.equal(watches[0].severity,1);
 assert.equal(watches[0].value,90); assert.equal(watches[0].step.startHour,8);
 assert.equal(buildAreaWatch(data,'2026-09-27',8).length,0);
 assert.equal(watchStepIndex(data,'2026-09-27',8),-1);
 assert.equal(buildAreaWatch({...data,status:'unavailable'},date).length,0);
});
test('daily rainfall thresholds never classify hourly probability as heavy rainfall',()=>{
 const data=normalizeWeather(payload,'rain');
 assert.equal(buildAreaWatch(data,date)[0].title,'พยากรณ์ฝนสะสมสูง');
 assert.equal(buildAreaWatch(data,date)[0].unit,'mm / วัน');
 assert.equal(buildAreaWatch(data,date,8)[0].title,'โอกาสฝนสูง');
});
test('rain-amount overview does not surface probability-only signals and retains actual heavy daily totals',()=>{
 const data=normalizeWeather(payload,'rain');
 assert.equal(buildAreaWatch(data,date,undefined,undefined,'secondary')[0].value,80);
 assert.equal(buildAreaWatch(data,date,8,undefined,'secondary').length,0);
 const lowAmount={...data,points:data.points.map(p=>({...p,secondary:p.secondary.map(()=>0)}))};
 assert.equal(buildAreaWatch(lowAmount,date,undefined,undefined,'secondary').length,0);
 assert.equal(buildAreaWatch(lowAmount,date)[0].unit,'%');
});
test('watch thresholds exclude missing data and rank severe named locations first',()=>{
 const data={...normalizeWeather(payload,'heat'),layer:'air',steps:[{key:date,date,window:null,day:0,label:'เฉลี่ยรายวัน'}],points:[{id:'bangkok-1',label:'กรุงเทพฯ · ตอนเหนือ',values:[37.5],secondary:[]},{id:'bangkok-2',label:'กรุงเทพฯ · ตอนใต้',values:[76],secondary:[]},{id:'nonthaburi-2',label:'นนทบุรี · ตอนเหนือ',values:[50],secondary:[]},{id:'missing',label:'Missing',values:[NaN],secondary:[]}]};
 const watches=buildAreaWatch(data,date); assert.deepEqual(watches.map(w=>w.point.id),['bangkok-2','nonthaburi-2']);
 assert.equal(watches[0].severity,3);
 const heat=normalizeWeather(payload,'heat'); assert.equal(buildAreaWatch(heat,date,8)[0].severity,2);
});
test('API retains provider hourly values end-to-end without substituting daily peaks',async()=>{
 const dates=Array.from({length:7},(_,i)=>new Date(Date.UTC(2026,8,26+i)).toISOString().slice(0,10));
 const times=dates.flatMap(d=>Array.from({length:24},(_,h)=>`${d}T${String(h).padStart(2,'0')}:00`));
 const raw=Array.from({length:9},()=>({latitude:13.7,longitude:100.5,hourly:{time:times,precipitation_probability:times.map((_,i)=>i%24),precipitation:times.map((_,i)=>i%24===7?2:0),temperature_2m:times.map((_,i)=>i%24===7?35:29),relative_humidity_2m:times.map(()=>60)},daily:{time:dates,precipitation_sum:dates.map(()=>2),precipitation_probability_max:dates.map(()=>99),precipitation_hours:dates.map(()=>1),weather_code:dates.map(()=>61)}}));
 const fetchImpl=async()=>new Response(JSON.stringify(raw),{headers:{'content-type':'application/json'}});
 const rain=await (await createRainForecastResponse({fetchImpl,forecastSource:'open-meteo'})).json();
 assert.equal(rain.points[0].hourly.length,168);
 assert.equal(rain.points[0].hourly[7].probability,7); assert.equal(rain.points[0].hourly[7].rainMm,2);
 const data=normalizeWeather(rain,'rain'); const i=watchStepIndex(data,date,7); assert.equal(data.points[0].values[i],7);
 const heat=await (await createHeatForecastResponse({fetchImpl,forecastSource:'open-meteo'})).json();
 assert.equal(heat.points[0].hourly.length,168); assert.equal(heat.points[0].hourly[7].temperatureC,35);
 assert.ok(heat.points[0].hourly[7].heatIndexC>40);
});
