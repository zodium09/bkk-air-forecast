import tableData from "../../data/tide-predictions-2026.json" with { type:"json" };
import { bangkokDate } from "../../lib/map-intelligence.ts";
import { fetchTideRain } from "../../lib/tide-outlook-provider.ts";
import { tideStation,tidePoints,tideDateAfter,validTideDate,TIDE_SOURCE_PAGE,type TideTable,type TidePayload } from "../../lib/tides.ts";

export async function createTideOutlookResponse(request:Request,options:{now?:number;fetchImpl?:typeof fetch;table?:TideTable;cache?:boolean}={}) {
  const now=options.now??Date.now(),params=new URL(request.url).searchParams;
  const station=tideStation(params.get("station")??"phra-chul"),date=params.get("date")??bangkokDate(new Date(now));
  if(!station||!validTideDate(date)||date!==bangkokDate(new Date(now)))return Response.json({error:"เลือกสถานีที่รองรับและวันปัจจุบันตามเวลาไทย"},{status:400});
  const table=options.table??tableData as TideTable,points=tidePoints(table,station.id,date);
  const dates=Array.from({length:7},(_,i)=>tideDateAfter(date,i)).filter(d=>points.filter(p=>bangkokDate(new Date(p.at))===d&&p.metres!==null).length===24);
  const record=table.stations[station.id],status=dates.length?"available":"unavailable";
  const rain=status==="available"?await fetchTideRain(station,date,options):null;
  const payload:TidePayload={station,dates,points,rain:rain?.rain??[],rainStatus:rain?.status??"unavailable",rainFetchedAt:rain?.fetchedAt??null,fetchedAt:new Date(now).toISOString(),tableRetrievedAt:table.retrievedAt,tableYear:table.year,status,sourcePage:TIDE_SOURCE_PAGE,sourceUrl:record?.sourceUrl??station.sourceUrl,sourceHash:record?.sha256??""};
  return Response.json(payload,{headers:{"Cache-Control":status==="available"?"public, max-age=300":"no-store"}});
}
export async function GET(request:Request){return createTideOutlookResponse(request);}
