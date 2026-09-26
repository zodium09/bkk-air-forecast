// Refresh the public geographic snapshot, never forecast values or user locations.
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { boundaryContains } from "../app/lib/map-surface.ts";
import { boundaryLabels } from "../app/lib/map-labels.ts";
import { provinces } from "../app/lib/provinces.ts";

const cacheRoot = new URL("../output/geography/", import.meta.url);
await mkdir(cacheRoot, { recursive: true });
const refresh = process.argv.includes("--refresh");
const bmaUrl = "https://bmagis.bangkok.go.th/arcgis/rest/services/Hosted/FGDS_BMA_SUBDISTRICT_POLYGON/FeatureServer/0/query";
const dmrUrl = "https://gisportal.dmr.go.th/arcgis/rest/services/Data_Production/WAB_VIEW/MapServer/10/query";
const overpassUrl = "https://overpass-api.de/api/interpreter";
const queryParameters = { returnGeometry: "true", outSR: "4326", geometryPrecision: "6", maxAllowableOffset: "0.00005", resultRecordCount: "2000", f: "geojson" };
const bmaQuery = new URL(bmaUrl);
bmaQuery.search = new URLSearchParams({ ...queryParameters, where: "1=1", outFields: "fid,scode,sub_code,scode_bma,sname,dname,pname,dcode" });
const dmrQuery = new URL(dmrUrl);
dmrQuery.search = new URLSearchParams({ ...queryParameters, where: "PROV_CODE IN ('11','12','13','73','74')", outFields: "OBJECTID,TAMBON_IDN,TAM_NAM_T,AMPHOE_IDN,AMPHOE_T,PROV_CODE,PROV_NAM_T" });

async function load(name, url, options = {}) {
  const path = new URL(name, cacheRoot);
  if (!refresh) {
    try { return JSON.parse(await readFile(path, "utf8")); } catch { /* Read public sources when no local cache exists. */ }
  }
  const response = await fetch(url, { ...options, headers: { "User-Agent": "BKK-Air-Forecast/1.0 geographic snapshot", ...options.headers }, signal: AbortSignal.timeout(110_000) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status} ${(await response.text()).replace(/<[^>]+>/g, " ").slice(-1600)}`);
  const body = await response.text();
  const data = JSON.parse(body);
  if (data.error || data.remark) throw new Error(`${name}: ${JSON.stringify(data.error ?? data.remark)}`);
  await writeFile(path, body);
  console.log(`${name}: ${body.length} characters`);
  return data;
}

const [bma, dmr] = await Promise.all([load("bma-subdistricts.json", bmaQuery), load("metro-subdistricts.json", dmrQuery)]);
if (bma.type !== "FeatureCollection" || dmr.type !== "FeatureCollection" || !bma.features?.length || !dmr.features?.length || bma.exceededTransferLimit || dmr.exceededTransferLimit) throw new Error("Incomplete administrative features");
console.log(`Administrative features: BMA ${bma.features.length}, DMR ${dmr.features.length}`);
const roadQuery = '[out:json][timeout:90];(way["highway"~"^(primary|secondary|tertiary|unclassified|residential)$"]["name:th"](13.3,99.7,14.35,101.05);way["highway"~"^(primary|secondary|tertiary|unclassified|residential)$"]["name"](13.3,99.7,14.35,101.05););out geom;';
const osm = await load("roads.json", overpassUrl, { method: "POST", body: new URLSearchParams({ data: roadQuery }) });
const clean = (name) => String(name ?? "").trim().replace(/^(?:แขวง|ตำบล|เขต|อำเภอ|จังหวัด)\s*/, "");
const roadName = (tags) => {
  const name = String(tags["name:th"] ?? tags.name ?? "").trim();
  if (!/[ก-๙]/.test(name)) return null;
  return /^(?:ถนน|ซอย|ทาง|ตรอก)/.test(name) ? name : `ถนน${name}`;
};
const rank = { primary: 0, secondary: 1, tertiary: 2, unclassified: 3, residential: 4 };
const roads = osm.elements.filter((element) => element.type === "way" && element.geometry?.length && roadName(element.tags ?? {})).map((way) => ({ ...way, name: roadName(way.tags), rank: rank[way.tags.highway] ?? 4 }));
const places = [];
for (const [collection, source] of [[bma, "BMA"], [dmr, "DMR"]]) {
  for (const feature of collection.features) {
    const props = feature.properties;
    const province = provinces.find((province) => province.code === (source === "BMA" ? "10" : String(props.PROV_CODE)));
    if (!province) continue;
    const subdistrict = clean(source === "BMA" ? props.sname : props.TAM_NAM_T);
    const district = clean(source === "BMA" ? props.dname : props.AMPHOE_T);
    if (!subdistrict || !district) throw new Error("Unnamed administrative feature");
    const scope = { type: "FeatureCollection", features: [feature] };
    const center = boundaryLabels({ type: "FeatureCollection", features: [{ ...feature, properties: { NAME_T: subdistrict } }] })[0];
    if (!center) throw new Error(`No interior point: ${province.nameTh} ${district} ${subdistrict}`);
    const coordinates = feature.geometry.coordinates.flat(feature.geometry.type === "MultiPolygon" ? 2 : 1);
    const minLat = Math.min(...coordinates.map((coordinate) => coordinate[1]));
    const maxLat = Math.max(...coordinates.map((coordinate) => coordinate[1]));
    const minLng = Math.min(...coordinates.map((coordinate) => coordinate[0]));
    const maxLng = Math.max(...coordinates.map((coordinate) => coordinate[0]));
    let best = null;
    for (const way of roads) {
      for (const node of way.geometry) {
        if (node.lat < minLat || node.lat > maxLat || node.lon < minLng || node.lon > maxLng || !boundaryContains(scope, node.lat, node.lon)) continue;
        const distance = Math.hypot((node.lat - center.lat) * 111, (node.lon - center.lng) * 108);
        const score = distance + way.rank * 1.5;
        if (!best || score < best.score) best = { lat: node.lat, lng: node.lon, way, score };
      }
    }
    const isBangkok = province.id === "bangkok";
    const subdistrictType = isBangkok ? "แขวง" : "ตำบล";
    const districtType = isBangkok ? "เขต" : "อำเภอ";
    const code = source === "BMA" ? props.sub_code ?? props.scode_bma ?? props.scode ?? props.fid : props.TAMBON_IDN ?? props.OBJECTID;
    places.push({
      id: `${province.id}-${String(code)}`, provinceId: province.id,
      lat: best?.lat ?? center.lat, lng: best?.lng ?? center.lng,
      road: best?.way.name ?? null, subdistrict, district, province: province.nameTh,
      subdistrictType, districtType, areaSource: source,
      ...(best ? { osmWayId: best.way.id, roadClass: best.way.tags.highway } : {}),
      overview: false,
    });
  }
}
const districts = [...new Set(places.map((place) => `${place.provinceId}:${place.district}`))];
for (const district of districts) {
  const candidates = places.filter((place) => `${place.provinceId}:${place.district}` === district).sort((a, b) => (rank[a.roadClass] ?? 5) - (rank[b.roadClass] ?? 5) || a.id.localeCompare(b.id));
  candidates[0].overview = true;
}
places.sort((a, b) => a.provinceId.localeCompare(b.provinceId) || a.district.localeCompare(b.district, "th") || a.subdistrict.localeCompare(b.subdistrict, "th"));
if (new Set(places.map((place) => place.id)).size !== places.length) throw new Error("Duplicate geographic IDs");
if (provinces.some((province) => !places.some((place) => place.provinceId === province.id)) || !places.some((place) => place.road)) throw new Error("Incomplete geographic coverage");
const snapshot = {
  generatedAt: new Date().toISOString(), osmTimestamp: osm.osm3s?.timestamp_osm_base ?? null,
  attribution: "Road positions © OpenStreetMap contributors (ODbL 1.0); administrative names/boundaries: BMA GIS and DMR GIS",
  license: "https://opendatacommons.org/licenses/odbl/1-0/",
  sources: [{ name: "BMA khwaeng/khet", url: bmaQuery.href }, { name: "DMR tambon/amphoe", url: dmrQuery.href }, { name: "OpenStreetMap roads", url: overpassUrl, query: roadQuery }],
  places,
};
const output = new URL("../app/data/map-places.json", import.meta.url);
const temporary = new URL("../app/data/map-places.json.tmp", import.meta.url);
await writeFile(temporary, JSON.stringify(snapshot) + "\n");
await rename(temporary, output);
console.log(JSON.stringify({ places: places.length, roadPositions: places.filter(place => place.road).length, districts: districts.length, provinces: provinces.map(province => ({ name: province.nameTh, points: places.filter(place => place.provinceId === province.id).length })) }));
