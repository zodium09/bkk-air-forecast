import type { WaterHistoryPoint } from "./water-history-store.ts";

export function waterHistorySummary(points: WaterHistoryPoint[], now = Date.now()) {
  const last = points.at(-1), previous = points.at(-2);
  if (!last || !previous || now - Date.parse(last.observedAt) > 3600000 || Date.parse(last.observedAt) > now + 300000) return null;
  const minutes = (Date.parse(last.observedAt)-Date.parse(previous.observedAt))/60000;
  return minutes > 0 && minutes <= 120 ? { changeCm: (last.value-previous.value)*100, minutes } : null;
}
export function waterHistoryGeometry(points: WaterHistoryPoint[]) {
  if (!points.length) return { min: 0, max: 1, paths: [] as string[], dots: [] as {x:number; y:number}[] };
  const values = points.map(p=>p.value), padding = Math.max(.03,(Math.max(...values)-Math.min(...values))*.2);
  const min = Math.min(...values)-padding, max = Math.max(...values)+padding;
  const start = Date.parse(points[0].observedAt), end = Date.parse(points.at(-1)!.observedAt);
  const dots = points.map(point=>({x: end === start ? 300 : 48+(Date.parse(point.observedAt)-start)/(end-start)*520,y:24+(max-point.value)/(max-min)*140}));
  const paths: string[] = [];
  points.forEach((point,index)=>{
    const gap = index > 0 && Date.parse(point.observedAt)-Date.parse(points[index-1].observedAt) > 3600000;
    if (!index || gap) paths.push(`M${dots[index].x},${dots[index].y}`); else paths[paths.length-1] += ` L${dots[index].x},${dots[index].y}`;
  });
  return { min, max, paths, dots };
}
