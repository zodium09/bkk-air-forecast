import { createTmdRadarResponse } from "../tmd-radar/route.ts";
import { normalizeNearbyRain, type NearbyRainPayload } from "../../lib/rain-nearby.ts";
import { CHAO_PHRAYA_REGION_ID, regionContains } from "../../lib/provinces.ts";
import type { TmdRadarPayload } from "../../lib/tmd-radar-data.ts";

export async function createNearbyRainResponse(request: Request, options: { fetchImpl?: typeof fetch; now?: () => number; timeoutMs?: number } = {}) {
  const params=new URL(request.url).searchParams;
  const latText=params.get("lat"),lngText=params.get("lng");
  const lat=Number(latText),lng=Number(lngText);
  if (!latText?.trim() || !lngText?.trim() || !regionContains(CHAO_PHRAYA_REGION_ID,lat,lng)) return Response.json({error:"เลือกจุดในเจ้าพระยาหรือกรุงเทพฯ–ปริมณฑลเพื่อวิเคราะห์ฝน"},{status:400,headers:{"Cache-Control":"no-store"}});
  const fetchImpl=options.fetchImpl??fetch, now=(options.now??Date.now)();
  const sourceUrl=new URL("https://radargis.tmd.go.th/api/location_nowcast_alert");
  sourceUrl.search=new URLSearchParams({lat:String(lat),lon:String(lng),radius_km:"8"}).toString();
  const [catalog,analysis]=await Promise.allSettled([
    createTmdRadarResponse({fetchImpl,now:()=>now,timeoutMs:options.timeoutMs??10000}).then(response=>response.json() as Promise<TmdRadarPayload>),
    fetchImpl(sourceUrl.toString(),{headers:{Accept:"application/json"},signal:AbortSignal.timeout(options.timeoutMs??10000)}).then(response=>{if(!response.ok)throw new Error("upstream-error");return response.json();}),
  ]);
  const payload:NearbyRainPayload=normalizeNearbyRain(analysis.status === "fulfilled"?analysis.value:null,catalog.status === "fulfilled"?catalog.value:null,now);
  if(analysis.status === "rejected") { payload.reason="upstream-error";payload.found=null;payload.status="unavailable";payload.message="อ่านผลวิเคราะห์ฝนรอบพื้นที่ไม่ได้ในครั้งนี้"; }
  return Response.json(payload,{headers:{"Cache-Control":"no-store"}});
}
export async function GET(request: Request) { return createNearbyRainResponse(request); }
