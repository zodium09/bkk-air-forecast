"use client";
import { useMemo } from "react";
import RiskAreaSummary from "./risk-area-summary";
import { buildImportantEvents } from "../../lib/important-events";
import type { RoadFloodPayload } from "../../lib/road-floods";
import type { WaterPayload } from "../../lib/water-levels";
import type { AirObservationPayload } from "../../lib/air-observations";
import type { RegionId } from "../../lib/provinces";
import { MapIcon } from "./map-ui";

export default function ObservationAreaMap({ topic, region, position, roads=null, water=null, air=null, now, loading }: {
  topic:"road"|"water"|"air"; region:RegionId; position:{lat:number;lng:number}|null;
  roads?:RoadFloodPayload|null; water?:WaterPayload|null; air?:AirObservationPayload|null; now:number; loading:boolean;
}) {
  const lat=position?.lat,lng=position?.lng;
  const points=useMemo(()=>buildImportantEvents({region,place:lat===undefined||lng===undefined?null:{lat,lng},roads,water,air,rain:null,heat:null,now}).points.filter(p=>p.topic===topic),[region,lat,lng,roads,water,air,now,topic]);
  const title=topic==="road"?"น้ำบนถนน":topic==="water"?"ระดับน้ำในคลองและแม่น้ำ":"ฝุ่นตรวจวัด";
  const note=topic==="water"?"สีใช้สถานะรายสถานี น้ำมากกับน้ำน้อยระบุแยกกัน ไม่ใช่ความลึกน้ำท่วม":topic==="road"?"สีใช้สถานะจุดวัดของ กทม. ไม่ยืนยันสภาพถนนตลอดสาย":"สีใช้ระดับที่หน่วยงานส่ง ไม่ใช้ค่าที่ไม่ทราบช่วงเฉลี่ยแทนเกณฑ์รายวัน";
  return <details className="ra-observation"><summary><MapIcon name="map" size={18}/>ดูแผนที่พื้นที่และระดับติดตาม · {title}<MapIcon name="chevron" size={16}/></summary><RiskAreaSummary defaultMapOpen title={`${title}ตามพื้นที่`} region={region} topics={[{id:topic,title,points,note:note+(position?" · แสดงจุดภายใน 8 กม. รอบพื้นที่ที่เลือก":""),loading}]}/></details>;
}
