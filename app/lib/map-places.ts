import { regionContains, isCombinedRegion, type ProvinceId, type RegionId } from "./provinces.ts";

/** A public geographic reference; it is not an observation station. */
export type MapPlace = {
  id: string;
  provinceId: ProvinceId;
  lat: number;
  lng: number;
  road: string | null;
  subdistrict: string;
  district: string;
  province: string;
  subdistrictType: "แขวง" | "ตำบล";
  districtType: "เขต" | "อำเภอ";
  areaSource: "BMA" | "DMR";
  osmWayId?: number;
  roadClass?: string;
  overview: boolean;
};

export type MapPlaceCatalog = {
  generatedAt: string;
  osmTimestamp: string | null;
  attribution: string;
  license: string;
  sources: { name: string; url: string; query?: string }[];
  places: MapPlace[];
};

export function placeLabel(place: MapPlace) {
  const locality = `${place.subdistrictType}${place.subdistrict}`;
  return place.road ? `${place.road} · ${locality}` : locality;
}

export function placeArea(place: MapPlace) {
  return `${place.districtType}${place.district} · ${place.province}`;
}

export function placeAddress(place: MapPlace) {
  return `${placeLabel(place)} · ${placeArea(place)}`;
}

export function regionPlaces(places: MapPlace[], region: RegionId) {
  return places.filter(place => regionContains(region, place.lat, place.lng, place.provinceId));
}

/** Keep an overview legible, then reveal all road/locality references on zoom. */
export function placeVisible(place: MapPlace, zoom: number, selected: boolean, region: RegionId = "metro") {
  return selected || place.overview || zoom >= 10 || (!isCombinedRegion(region) && region !== "bangkok");
}
