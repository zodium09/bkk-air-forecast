"""Refresh public basin geography. Requires shapely in output/geography/python.

Uses DWR's 22-basin layer, not the legacy 25-basin layer. Weather samples and
public reference points are generated inside basin/province intersections.
No weather readings, user locations, or guessed river connections are stored.
"""
import json
import math
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding="utf8")
sys.path.insert(0, str(ROOT / "output/geography/python"))
from shapely.geometry import shape, mapping, Point
from shapely.ops import unary_union
from shapely import make_valid

CACHE = ROOT / "output/geography/chao-phraya"
CACHE.mkdir(parents=True, exist_ok=True)
BASINS = "https://gis.dwr.go.th/arcgis/rest/services/T22Basin/MapServer/0/query"
PROVINCES = "https://gisportal.dmr.go.th/arcgis/rest/services/Data_Production/WAB_VIEW/MapServer/8/query"
TAMBON = "https://gisportal.dmr.go.th/arcgis/rest/services/Data_Production/WAB_VIEW/MapServer/10/query"
METRO_CODES = {"10", "11", "12", "13", "73", "74"}
COMMON = dict(returnGeometry="true", outSR="4326", geometryPrecision="5", maxAllowableOffset="0.0005", f="geojson")

def load(name, base, **params):
    url = base + "?" + urllib.parse.urlencode({**COMMON, **params})
    path = CACHE / name
    if path.exists() and "--refresh" not in sys.argv:
        return json.loads(path.read_text(encoding="utf8")), url
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "BKK-Air-Forecast basin geography"}), timeout=55) as response:
        data = json.load(response)
    if data.get("error") or not data.get("features") or data.get("exceededTransferLimit"):
        raise RuntimeError(f"Incomplete source {name}: {data.get('error')}")
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf8")
    return data, url

def polygon(geometry):
    valid = make_valid(shape(geometry))
    if valid.geom_type == "GeometryCollection":
        valid = unary_union([g for g in valid.geoms if g.geom_type in ("Polygon", "MultiPolygon")])
    return valid

def write(name, value):
    (ROOT / "app/data" / name).write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf8")

def feature(geometry, properties):
    return dict(type="Feature", properties=properties, geometry=mapping(geometry))

def samples(geometry, count):
    west, south, east, north = geometry.bounds
    candidates = [geometry.representative_point()]
    for row in range(55):
        for col in range(55):
            point = Point(west + (col + .5) / 55 * (east - west), south + (row + .5) / 55 * (north - south))
            if geometry.contains(point):
                candidates.append(point)
    selected = [candidates.pop(0)]
    while candidates and len(selected) < count:
        point = max(candidates, key=lambda p: min((p.x - s.x) ** 2 * .94 + (p.y - s.y) ** 2 for s in selected))
        selected.append(point)
        candidates.remove(point)
    return [dict(label=f"จุดพยากรณ์ในลุ่มน้ำ {i + 1}", lat=round(p.y, 5), lng=round(p.x, 5)) for i, p in enumerate(selected)]

basins, basin_url = load("basins.json", BASINS, where="MB_CODE IN ('06','07','08','09','10','10-is','11','12')", outFields="MB_CODE,MBASIN_T,MBASIN_E,AREA_SQKM")
core = unary_union([polygon(f["geometry"]) for f in basins["features"] if f["properties"]["MB_CODE"] in ("10", "10-is")])
west, south, east, north = core.bounds
province_data, province_url = load("provinces.json", PROVINCES, where="1=1", outFields="PROV_CODE,PROV_NAM_T,PROV_NAM_E", geometry=f"{west},{south},{east},{north}", geometryType="esriGeometryEnvelope", inSR="4326", spatialRel="esriSpatialRelIntersects")
new_provinces = []
clipped_features = []
for raw in province_data["features"]:
    props = raw["properties"]
    code = str(props["PROV_CODE"])
    if code in METRO_CODES:
        continue
    clipped = polygon(raw["geometry"]).intersection(core)
    if clipped.is_empty or clipped.area < .00001:
        continue
    english = props["PROV_NAM_E"].strip().replace("Changwat ", "")
    name = props["PROV_NAM_T"].strip().removeprefix("จังหวัด")
    slug = english.lower().replace(" ", "-")
    w, s, e, n = clipped.bounds
    point = clipped.representative_point()
    count = max(6, min(18, math.ceil(clipped.area * 111 * 108 / 350)))
    new_provinces.append(dict(id=slug, code=code, nameTh=name, shortNameTh=name, nameEn=english, center=dict(lat=round(point.y, 5), lng=round(point.x, 5)), bounds=dict(minLat=s, maxLat=n, minLng=w, maxLng=e), scopeNote="เฉพาะส่วนในลุ่มน้ำเจ้าพระยา", points=samples(clipped, count)))
    clipped_features.append(feature(clipped, {**props, "scope": "basin-intersection"}))
new_provinces.sort(key=lambda p: p["center"]["lat"], reverse=True)
stamp = datetime.now(timezone.utc).isoformat()
metro = []
for name in ("bangkok-districts.json", "metro-provinces.json"):
    metro.extend(polygon(f["geometry"]) for f in json.loads((ROOT / "app/data" / name).read_text(encoding="utf8"))["features"])
coverage = unary_union([core, *metro]).simplify(.0005, preserve_topology=True)
w, s, e, n = coverage.bounds
write("chao-phraya-geography.json", dict(generatedAt=stamp, source="DWR T22Basin + DMR provincial boundaries + BMA districts", sourceUrls=[basin_url, province_url], simplificationDegrees=.0005, bounds=dict(minLat=s, maxLat=n, minLng=w, maxLng=e), coverage=dict(type="FeatureCollection", features=[feature(coverage, dict(NAME_T="เจ้าพระยาและกรุงเทพฯ–ปริมณฑล", scope="combined"))]), core=dict(type="FeatureCollection", features=[feature(core, dict(MB_CODE="10", NAME_T="ลุ่มน้ำเจ้าพระยา", scope="basin"))]), provinces=new_provinces, clipped=dict(type="FeatureCollection", features=clipped_features)))
write("chao-phraya-upstream-basins.json", dict(generatedAt=stamp, sourceUrl=basin_url, type="FeatureCollection", features=[f for f in basins["features"] if f["properties"]["MB_CODE"] not in ("10", "10-is")]))

codes = ",".join("'" + p["code"] + "'" for p in new_provinces)
tambons, tambon_url = load("tambons.json", TAMBON, where=f"PROV_CODE IN ({codes})", outFields="OBJECTID,TAMBON_IDN,TAM_NAM_T,AMPHOE_IDN,AMPHOE_T,PROV_CODE,PROV_NAM_T", resultRecordCount="2000")
province_by_code = {p["code"]: p for p in new_provinces}
references = []
for raw in tambons["features"]:
    props = raw["properties"]
    province = province_by_code.get(str(props["PROV_CODE"]))
    clipped = polygon(raw["geometry"]).intersection(core)
    if not province or clipped.is_empty or clipped.area < .00001:
        continue
    point = clipped.representative_point()
    references.append(dict(id=province["id"] + "-" + str(props["TAMBON_IDN"]), provinceId=province["id"], lat=round(point.y, 5), lng=round(point.x, 5), road=None, subdistrict=props["TAM_NAM_T"].strip().removeprefix("ตำบล"), district=props["AMPHOE_T"].strip().removeprefix("อำเภอ"), province=province["nameTh"], subdistrictType="ตำบล", districtType="อำเภอ", areaSource="DMR", overview=False))
seen_districts = set()
for point in references:
    key = (point["provinceId"], point["district"])
    point["overview"] = key not in seen_districts
    seen_districts.add(key)
write("chao-phraya-places.json", dict(generatedAt=stamp, sourceUrl=tambon_url, places=references))
print(json.dumps(dict(provinces=[{k: p[k] for k in ("id", "code", "nameTh")} for p in new_provinces], weatherSamples=sum(len(p["points"]) for p in new_provinces), places=len(references), districts=len(seen_districts), coreBounds=core.bounds), ensure_ascii=False, indent=2))
