export type BasemapKind = "street" | "satellite";
export type BasemapTheme = "light" | "dark";

type BasemapConfig = {
  url: string;
  attribution: string;
  maxZoom: number;
};

const OPENSTREETMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function getCurrentBasemapTheme(): BasemapTheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function getBasemapConfig(kind: BasemapKind, theme: BasemapTheme): BasemapConfig {
  if (kind === "satellite") {
    return {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "&copy; Esri, Earthstar Geographics",
      maxZoom: 19,
    };
  }

  if (theme === "dark") {
    return {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      attribution: `Tiles &copy; Esri, HERE, Garmin, ${OPENSTREETMAP_ATTRIBUTION}, and the GIS user community`,
      maxZoom: 16,
    };
  }

  return {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: OPENSTREETMAP_ATTRIBUTION,
    maxZoom: 19,
  };
}
