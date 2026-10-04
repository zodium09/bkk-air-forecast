import { fetchWithTimeout } from "./fetch-with-timeout.ts";
import { normalizeTideRain, tideDateAfter, type TideRainHour, type TideStation } from "./tides.ts";

type RainSnapshot={rain:TideRainHour[];fetchedAt:string;status:"available"|"partial"|"unavailable"};
const cache=new Map<string,{expires:number;data:RainSnapshot}>();
const pending=new Map<string,Promise<RainSnapshot>>();
export function tideRainUrl(station:TideStation,date:string) {
  const url=new URL("https://api.open-meteo.com/v1/forecast");
  for(const [key,value] of Object.entries({latitude:String(station.lat),longitude:String(station.lng),hourly:"precipitation",timezone:"Asia/Bangkok",start_date:date,end_date:tideDateAfter(date,7)}))url.searchParams.set(key,value);
  return url.toString();
}
export async function fetchTideRain(station:TideStation,date:string,options:{fetchImpl?:typeof fetch;now?:number;cache?:boolean}={}) {
  const now=options.now??Date.now(),key=`${station.id}:${date}`,useCache=options.cache!==false;
  const saved=useCache?cache.get(key):null;
  if(saved&&saved.expires>now)return saved.data;
  if(useCache&&pending.has(key))return pending.get(key)!;
  const load=async()=>{
    let raw:unknown=null;
    try {const response=await fetchWithTimeout(options.fetchImpl??fetch,tideRainUrl(station,date),{},9000);if(response.ok)raw=await response.json();}catch{/* Keep actual tide predictions even when rain is unavailable. */}
    const rain=normalizeTideRain(raw,date),count=rain.filter(p=>p.mm!==null).length;
    const data:RainSnapshot={rain,fetchedAt:new Date(now).toISOString(),status:count===rain.length?"available":count?"partial":"unavailable"};
    if(useCache){cache.set(key,{expires:now+(data.status==="available"?1800000:600000),data});for(const old of cache.keys())if(!old.endsWith(`:${date}`))cache.delete(old);}
    return data;
  };
  const promise=load();if(useCache)pending.set(key,promise);
  try{return await promise;}finally{if(useCache)pending.delete(key);}
}
