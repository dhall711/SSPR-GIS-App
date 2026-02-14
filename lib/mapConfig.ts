import { BasemapOption, LayerVisibility } from "./types";

// SSPR District center coordinates (Highlands Ranch / Lone Tree area)
export const SSPR_CENTER: [number, number] = [39.555, -104.935];
export const SSPR_DEFAULT_ZOOM = 13;
export const SSPR_MIN_ZOOM = 10;
export const SSPR_MAX_ZOOM = 18;

// Basemap tile configurations
export function getBasemaps(): BasemapOption[] {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

  return [
    {
      id: "osm",
      name: "OpenStreetMap",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    },
    {
      id: "arcgis-topo",
      name: "Topographic",
      url: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`,
      attribution:
        "Tiles &copy; Esri &mdash; Sources: Esri, DeLorme, NAVTEQ, USGS, EPA",
      maxZoom: 18,
    },
    {
      id: "esri-satellite",
      name: "Satellite",
      url: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
      attribution:
        "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
      maxZoom: 18,
    },
    ...(mapboxToken
      ? [
          {
            id: "mapbox-outdoors" as const,
            name: "Outdoors",
            url: `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`,
            attribution:
              '&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 22,
          },
          {
            id: "mapbox-satellite" as const,
            name: "Satellite HD",
            url: `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`,
            attribution:
              '&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; Maxar',
            maxZoom: 22,
          },
        ]
      : []),
  ];
}

// Default layer visibility
export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  trails: true,
  parks: true,
  waterways: true,
  "district-boundary": true,
  "municipal-boundaries": false,
  "maintenance-issues": true,
  "riparian-buffers": false,
  heatmap: false,
};

// Trail colors by letter code
export const TRAIL_COLORS: Record<string, string> = {
  A: "#e63946", // Bear Creek - red
  B: "#457b9d", // Big Dry Creek North - steel blue
  C: "#1d3557", // Big Dry Creek South - navy
  D: "#f4a261", // Centennial Link - orange
  E: "#2a9d8f", // Columbine - teal
  F: "#264653", // Cook Creek - dark teal
  G: "#e9c46a", // Happy Canyon - gold
  H: "#219ebc", // High Line Canal - water blue
  I: "#8338ec", // Lee Gulch - purple
  J: "#06d6a0", // Little Dry Creek - mint
  K: "#ff006e", // Littleton Community - magenta
  L: "#3a86ff", // Mary Carter Greenway - bright blue
  M: "#fb5607", // Railroad Spur - dark orange
  N: "#52b788", // Willow Creek - eco green
};

// Park category icons and colors
export const PARK_CATEGORY_STYLES: Record<
  string,
  { color: string; label: string }
> = {
  nature_center: { color: "#2d6a4f", label: "Nature Center" },
  natural_area: { color: "#40916c", label: "Natural Area" },
  open_space: { color: "#52b788", label: "Open Space" },
  park: { color: "#95d5b2", label: "Park" },
  rec_center: { color: "#6b4226", label: "Recreation Center" },
  pool: { color: "#219ebc", label: "Pool" },
  tennis: { color: "#e9c46a", label: "Tennis" },
  golf: { color: "#b5e48c", label: "Golf Course" },
  trailhead: { color: "#e63946", label: "Trailhead" },
  garden: { color: "#d4a373", label: "Garden" },
  dog_park: { color: "#f4a261", label: "Dog Park" },
  fishing: { color: "#023e8a", label: "Fishing" },
  sports_complex: { color: "#6c757d", label: "Sports Complex" },
  school_park: { color: "#adb5bd", label: "School/Park" },
  default: { color: "#6c757d", label: "Facility" },
};

// Severity colors for maintenance issues
export const SEVERITY_COLORS: Record<string, string> = {
  low: "#4ade80",
  medium: "#facc15",
  high: "#fb923c",
  critical: "#ef4444",
};
