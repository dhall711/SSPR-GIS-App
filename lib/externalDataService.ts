/**
 * External Data Service — fetches live GIS data from public REST APIs
 *
 * Sources:
 *  - Denver Open Data: Parks polygons
 *  - Arapahoe County Open Data Hub: Parks & public spaces
 *  - USGS National Hydrography Dataset (NHD): Streams/waterways
 *
 * All endpoints return GeoJSON FeatureCollections.
 */

import type { FeatureCollection, Feature, Polygon, MultiPolygon, LineString } from "geojson";

// ── Bounding box for SSPR area (used to spatially filter queries) ───────
// Roughly: Highlands Ranch / Littleton / Centennial / Lone Tree
const SSPR_BBOX = "-105.05,39.50,-104.85,39.65";

// ── Denver Open Data — Parks Polygons ───────────────────────────────────
// Service: ODC_PARK_PARKLAND_A on ArcGIS Online
// Layer 87 = PARK_PARKLAND_A (polygons)

const DENVER_PARKS_URL =
  "https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/ArcGIS/rest/services/ODC_PARK_PARKLAND_A/FeatureServer/87/query";

export async function fetchDenverParks(): Promise<FeatureCollection<Polygon | MultiPolygon>> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "FORMAL_NAME,PARK_TYPE,PARK_CLASS,GIS_ACRES,CROSS_STREETS,ADDRESS_LINE1,CITY",
    geometry: SSPR_BBOX,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    resultRecordCount: "500",
    f: "geojson",
  });

  const res = await fetch(`${DENVER_PARKS_URL}?${params}`, { next: { revalidate: 86400 } }); // cache 24h
  if (!res.ok) throw new Error(`Denver parks API: ${res.status}`);
  const data = await res.json() as FeatureCollection;

  // Normalize properties
  return {
    type: "FeatureCollection",
    features: data.features
      .filter((f: Feature) => f.geometry && f.properties)
      .map((f: Feature) => ({
        ...f,
        properties: {
          id: `denver-park-${f.properties!.OBJECTID || Math.random().toString(36).slice(2)}`,
          name: f.properties!.FORMAL_NAME || "Unnamed Park",
          type: f.properties!.PARK_TYPE || "park",
          parkClass: f.properties!.PARK_CLASS || "",
          acres: f.properties!.GIS_ACRES || null,
          address: f.properties!.ADDRESS_LINE1 || "",
          city: f.properties!.CITY || "Denver",
          source: "denver-open-data",
        },
      })),
  } as FeatureCollection<Polygon | MultiPolygon>;
}

// ── Arapahoe County Open Data — Parks & Public Spaces ───────────────────
// Service: OpenDataService on Arapahoe County ArcGIS Server
// Layer 5 = Parks and Public Spaces (polygons)

const ARAPAHOE_PARKS_URL =
  "https://gis.arapahoegov.com/arcgis/rest/services/OpenDataService/FeatureServer/5/query";

export async function fetchArapahoeParks(): Promise<FeatureCollection<Polygon | MultiPolygon>> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "NAME,PARK_ACRES,ADDRESS,ZIP_CODE,Maintained_By",
    geometry: SSPR_BBOX,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    resultRecordCount: "500",
    f: "geojson",
  });

  const res = await fetch(`${ARAPAHOE_PARKS_URL}?${params}`, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`Arapahoe parks API: ${res.status}`);
  const data = await res.json() as FeatureCollection;

  return {
    type: "FeatureCollection",
    features: data.features
      .filter((f: Feature) => f.geometry && f.properties)
      .map((f: Feature) => ({
        ...f,
        properties: {
          id: `arapahoe-park-${f.properties!.OBJECTID || Math.random().toString(36).slice(2)}`,
          name: f.properties!.NAME || "Unnamed Space",
          acres: f.properties!.PARK_ACRES || null,
          address: f.properties!.ADDRESS || "",
          maintainedBy: f.properties!.Maintained_By || "",
          source: "arapahoe-county",
        },
      })),
  } as FeatureCollection<Polygon | MultiPolygon>;
}

// ── USGS National Hydrography Dataset (NHD) — Streams ───────────────────
// Service: nhd MapServer on hydro.nationalmap.gov
// Layer 6 = NHDFlowline (lines — streams, rivers, canals)

const NHD_FLOWLINE_URL =
  "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/6/query";

// FCode meanings for common types
const FCODE_LABELS: Record<number, string> = {
  33400: "Connector",
  33600: "Canal/Ditch",
  33601: "Canal/Ditch (Aqueduct)",
  33603: "Canal/Ditch (Stormwater)",
  46000: "Stream/River",
  46003: "Stream/River (Intermittent)",
  46006: "Stream/River (Perennial)",
  46007: "Stream/River (Ephemeral)",
  55800: "Artificial Path",
  56600: "Coastline",
};

export async function fetchNHDFlowlines(): Promise<FeatureCollection<LineString>> {
  const params = new URLSearchParams({
    where: "FCode >= 33400 AND FCode <= 56600",
    outFields: "GNIS_Name,FCode,LengthKM,ReachCode,StreamOrde",
    geometry: SSPR_BBOX,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    resultRecordCount: "1000",
    f: "geojson",
  });

  const res = await fetch(`${NHD_FLOWLINE_URL}?${params}`, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`USGS NHD API: ${res.status}`);
  const data = await res.json() as FeatureCollection;

  return {
    type: "FeatureCollection",
    features: data.features
      .filter((f: Feature) => f.geometry)
      .map((f: Feature) => ({
        ...f,
        properties: {
          id: `nhd-${f.properties!.ReachCode || Math.random().toString(36).slice(2)}`,
          name: f.properties!.GNIS_Name || f.properties!.gnis_name || null,
          fcode: f.properties!.FCode || f.properties!.fcode,
          type: FCODE_LABELS[f.properties!.FCode || f.properties!.fcode] || "Waterway",
          lengthKm: f.properties!.LengthKM || f.properties!.lengthkm || null,
          streamOrder: f.properties!.StreamOrde || null,
          reachCode: f.properties!.ReachCode || f.properties!.reachcode || "",
          source: "usgs-nhd",
        },
      })),
  } as FeatureCollection<LineString>;
}

// ── Combined fetch for all external data ────────────────────────────────

export interface ExternalData {
  denverParks: FeatureCollection;
  arapahoeParks: FeatureCollection;
  nhdFlowlines: FeatureCollection;
}

export async function fetchAllExternalData(): Promise<ExternalData> {
  const [denverParks, arapahoeParks, nhdFlowlines] = await Promise.allSettled([
    fetchDenverParks(),
    fetchArapahoeParks(),
    fetchNHDFlowlines(),
  ]);

  const empty: FeatureCollection = { type: "FeatureCollection", features: [] };

  return {
    denverParks: denverParks.status === "fulfilled" ? denverParks.value : empty,
    arapahoeParks: arapahoeParks.status === "fulfilled" ? arapahoeParks.value : empty,
    nhdFlowlines: nhdFlowlines.status === "fulfilled" ? nhdFlowlines.value : empty,
  };
}
