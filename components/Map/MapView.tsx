"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import {
  SSPR_CENTER,
  SSPR_DEFAULT_ZOOM,
  SSPR_MIN_ZOOM,
  SSPR_MAX_ZOOM,
  getBasemaps,
} from "@/lib/mapConfig";
import { BasemapId, LayerVisibility, OverlayLayerId } from "@/lib/types";
import { TrailLayer } from "@/components/Layers/TrailLayer";
import { ParkLayer } from "@/components/Layers/ParkLayer";
import { WaterwayLayer } from "@/components/Layers/WaterwayLayer";
import { BoundaryLayer } from "@/components/Layers/BoundaryLayer";
import { MaintenanceLayer } from "@/components/Layers/MaintenanceLayer";
import { HeatmapLayer } from "@/components/Layers/HeatmapLayer";
import { BufferLayer, BufferControl } from "@/components/Layers/BufferLayer";
import { RegionalParksLayer } from "@/components/Layers/RegionalParksLayer";
import { NHDHydrologyLayer } from "@/components/Layers/NHDHydrologyLayer";
import { PriorityZonesLayer, DEFAULT_PRIORITY_WEIGHTS } from "@/components/Layers/PriorityZonesLayer";
import type { PriorityWeights } from "@/components/Layers/PriorityZonesLayer";
import { BasemapSelector } from "./BasemapSelector";
import { LayerControl } from "./LayerControl";
import { PriorityControl } from "./PriorityControl";
import { CoordinateDisplay } from "./CoordinateDisplay";

import type { FeatureCollection } from "geojson";

// Local JSON as fast initial data (renders instantly while Supabase loads)
import _trailsData from "@/data/geojson/trails.json";
import _parksData from "@/data/geojson/parks.json";
import _waterwaysData from "@/data/geojson/waterways.json";
import _boundaryData from "@/data/geojson/district_boundary.json";
import _maintenanceData from "@/data/seed/maintenance-issues.json";

const localTrails = _trailsData as unknown as FeatureCollection;
const localParks = _parksData as unknown as FeatureCollection;
const localWaterways = _waterwaysData as unknown as FeatureCollection;
const localBoundary = _boundaryData as unknown as FeatureCollection;
const localMaintenance = _maintenanceData as unknown as FeatureCollection;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

interface MapViewProps {
  layerVisibility: LayerVisibility;
  onLayerToggle: (layerId: OverlayLayerId) => void;
  onFeatureSelect: (feature: { type: string; id: string; name: string } | null) => void;
  highlightFeatureId?: string | null;
  flyTo?: { lat: number; lng: number; zoom?: number } | null;
}

function MapEventHandler({
  onCoordinateUpdate,
}: {
  onCoordinateUpdate: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    mousemove: (e) => {
      onCoordinateUpdate(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Home button — resets the map to the default SSPR center + zoom. */
function HomeButton() {
  const map = useMap();
  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop: 80 }}>
      <div className="leaflet-control leaflet-bar">
        <a
          href="#"
          role="button"
          title="Reset to home view"
          aria-label="Reset to home view"
          onClick={(e) => {
            e.preventDefault();
            map.flyTo(SSPR_CENTER, SSPR_DEFAULT_ZOOM, { duration: 0.8 });
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            fontSize: 16,
            lineHeight: "30px",
            cursor: "pointer",
            color: "#333",
            backgroundColor: "white",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </a>
      </div>
    </div>
  );
}

/** Imperatively fly the map to a location when the `target` prop changes. */
function FlyToHandler({ target }: { target: { lat: number; lng: number; zoom?: number } | null }) {
  const map = useMap();
  const prevTarget = useRef<string | null>(null);

  useEffect(() => {
    if (!target) return;
    const key = `${target.lat},${target.lng},${target.zoom ?? 16}`;
    if (key === prevTarget.current) return;
    prevTarget.current = key;
    map.flyTo([target.lat, target.lng], target.zoom ?? 16, { duration: 1.2 });
  }, [target, map]);

  return null;
}

export default function MapView({
  layerVisibility,
  onLayerToggle,
  onFeatureSelect,
  highlightFeatureId,
  flyTo,
}: MapViewProps) {
  const basemaps = getBasemaps();
  const [activeBasemap, setActiveBasemap] = useState<BasemapId>("osm");
  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Live data from Supabase (starts with local JSON, upgrades when Supabase responds)
  const [trailsData, setTrailsData] = useState<FeatureCollection>(localTrails);
  const [parksData, setParksData] = useState<FeatureCollection>(localParks);
  const [waterwaysData, setWaterwaysData] = useState<FeatureCollection>(localWaterways);
  const [boundaryData, setBoundaryData] = useState<FeatureCollection>(localBoundary);
  const [maintenanceData, setMaintenanceData] = useState<FeatureCollection>(localMaintenance);
  const [dataSource, setDataSource] = useState<"local" | "supabase">("local");

  // External (Phase 4) data
  const emptyFC: FeatureCollection = { type: "FeatureCollection", features: [] };
  const [regionalParksData, setRegionalParksData] = useState<FeatureCollection>(emptyFC);
  const [nhdData, setNhdData] = useState<FeatureCollection>(emptyFC);
  const [priorityWeights, setPriorityWeights] = useState<PriorityWeights>(DEFAULT_PRIORITY_WEIGHTS);

  // Riparian buffer state
  const [bufferWaterwayId, setBufferWaterwayId] = useState<string | null>(null);
  const [bufferMeters, setBufferMeters] = useState(100);
  const showBufferControl = layerVisibility["riparian-buffers"];

  // Fetch live data from Supabase on mount
  useEffect(() => {
    if (!SUPABASE_URL) return; // no Supabase configured, stay with local data

    const fetchLayer = async (layer: string): Promise<FeatureCollection | null> => {
      try {
        const res = await fetch(`/api/spatial?layer=${layer}`);
        if (!res.ok) return null;
        const data = await res.json();
        // Validate it looks like a FeatureCollection
        if (data?.type === "FeatureCollection" && Array.isArray(data.features)) {
          return data as FeatureCollection;
        }
        return null;
      } catch {
        return null;
      }
    };

    Promise.all([
      fetchLayer("trails"),
      fetchLayer("parks"),
      fetchLayer("waterways"),
      fetchLayer("boundaries"),
      fetchLayer("issues"),
    ]).then(([trails, parks, waterways, boundaries, issues]) => {
      let anyLoaded = false;
      if (trails && trails.features.length > 0) { setTrailsData(trails); anyLoaded = true; }
      if (parks && parks.features.length > 0) { setParksData(parks); anyLoaded = true; }
      if (waterways && waterways.features.length > 0) { setWaterwaysData(waterways); anyLoaded = true; }
      if (boundaries && boundaries.features.length > 0) { setBoundaryData(boundaries); anyLoaded = true; }
      if (issues && issues.features.length > 0) { setMaintenanceData(issues); anyLoaded = true; }
      if (anyLoaded) setDataSource("supabase");
    });
  }, []);

  // Fetch external data when layers are enabled (lazy load)
  useEffect(() => {
    if (
      (layerVisibility["regional-parks"] && regionalParksData.features.length === 0) ||
      (layerVisibility["nhd-hydrology"] && nhdData.features.length === 0)
    ) {
      const fetchExternal = async () => {
        try {
          const res = await fetch("/api/external?source=all");
          if (!res.ok) return;
          const data = await res.json();
          if (data.denverParks?.features || data.arapahoeParks?.features) {
            const combined: FeatureCollection = {
              type: "FeatureCollection",
              features: [
                ...(data.denverParks?.features || []),
                ...(data.arapahoeParks?.features || []),
              ],
            };
            setRegionalParksData(combined);
          }
          if (data.nhdFlowlines?.features?.length > 0) {
            setNhdData(data.nhdFlowlines);
          }
        } catch {
          // External data is non-critical
        }
      };
      fetchExternal();
    }
  }, [layerVisibility, regionalParksData.features.length, nhdData.features.length]);

  const currentBasemap = basemaps.find((b) => b.id === activeBasemap) || basemaps[0];

  const handleCoordinateUpdate = useCallback((lat: number, lng: number) => {
    setMouseCoords({ lat, lng });
  }, []);

  const handleFeatureClick = useCallback(
    (type: string, id: string, name: string) => {
      onFeatureSelect({ type, id, name });
    },
    [onFeatureSelect]
  );

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={SSPR_CENTER}
        zoom={SSPR_DEFAULT_ZOOM}
        minZoom={SSPR_MIN_ZOOM}
        maxZoom={SSPR_MAX_ZOOM}
        zoomControl={false}
        className="h-full w-full"
      >
        <ZoomControl position="topright" />
        <HomeButton />

        {/* Active basemap tile layer */}
        <TileLayer
          key={currentBasemap.id}
          url={currentBasemap.url}
          attribution={currentBasemap.attribution}
          maxZoom={currentBasemap.maxZoom}
        />

        {/* Coordinate tracker */}
        <MapEventHandler onCoordinateUpdate={handleCoordinateUpdate} />

        {/* Fly-to handler */}
        <FlyToHandler target={flyTo ?? null} />

        {/* Overlay layers */}
        {layerVisibility["district-boundary"] && (
          <BoundaryLayer data={boundaryData} />
        )}
        {layerVisibility.waterways && (
          <WaterwayLayer
            data={waterwaysData}
            onFeatureClick={handleFeatureClick}
          />
        )}
        {layerVisibility.trails && (
          <TrailLayer
            data={trailsData}
            issueData={maintenanceData}
            onFeatureClick={handleFeatureClick}
            highlightId={highlightFeatureId}
          />
        )}
        {layerVisibility.parks && (
          <ParkLayer
            data={parksData}
            issueData={maintenanceData}
            onFeatureClick={handleFeatureClick}
            highlightId={highlightFeatureId}
          />
        )}
        {layerVisibility["maintenance-issues"] && (
          <MaintenanceLayer
            data={maintenanceData}
            waterwayData={waterwaysData}
            onFeatureClick={handleFeatureClick}
            highlightId={highlightFeatureId}
          />
        )}
        {layerVisibility.heatmap && (
          <HeatmapLayer data={maintenanceData} />
        )}
        {layerVisibility["riparian-buffers"] && bufferWaterwayId && (
          <BufferLayer
            waterwayId={bufferWaterwayId}
            bufferMeters={bufferMeters}
            onClose={() => setBufferWaterwayId(null)}
          />
        )}

        {/* Phase 4: External data layers */}
        {layerVisibility["regional-parks"] && regionalParksData.features.length > 0 && (
          <RegionalParksLayer
            data={regionalParksData}
            onFeatureClick={handleFeatureClick}
          />
        )}
        {layerVisibility["nhd-hydrology"] && nhdData.features.length > 0 && (
          <NHDHydrologyLayer data={nhdData} />
        )}
        {layerVisibility["priority-zones"] && (
          <PriorityZonesLayer
            issueData={maintenanceData}
            waterwayData={waterwaysData}
            trailData={trailsData}
            weights={priorityWeights}
          />
        )}
      </MapContainer>

      {/* Basemap selector (top-left) */}
      <div className="absolute top-3 left-3 z-[1000]">
        <BasemapSelector
          basemaps={basemaps}
          activeId={activeBasemap}
          onChange={setActiveBasemap}
        />
      </div>

      {/* Layer control (top-left, below basemap) */}
      <div className="absolute top-16 left-3 z-[1000]">
        <LayerControl
          visibility={layerVisibility}
          onToggle={onLayerToggle}
        />
      </div>

      {/* Buffer control (below layer control, when active) */}
      {showBufferControl && (
        <div className="absolute top-52 left-3 z-[1000]">
          <BufferControl
            isActive={showBufferControl}
            waterwayId={bufferWaterwayId}
            bufferMeters={bufferMeters}
            onWaterwayChange={setBufferWaterwayId}
            onBufferChange={setBufferMeters}
            onToggle={() => onLayerToggle("riparian-buffers")}
          />
        </div>
      )}

      {/* Priority weights control (when priority zones layer is active) */}
      <div className={`absolute ${showBufferControl ? "top-80" : "top-52"} left-3 z-[1000]`}>
        <PriorityControl
          weights={priorityWeights}
          onWeightsChange={setPriorityWeights}
          isVisible={layerVisibility["priority-zones"]}
        />
      </div>

      {/* Coordinate display (bottom-left) */}
      <div className="absolute bottom-6 left-3 z-[1000]">
        <CoordinateDisplay coords={mouseCoords} />
      </div>

      {/* Data source indicator */}
      <div className="absolute bottom-6 right-3 z-[1000]">
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
          dataSource === "supabase"
            ? "bg-green-500/20 text-green-400 border border-green-500/30"
            : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
        }`}>
          {dataSource === "supabase" ? "Live" : "Local"}
        </span>
      </div>
    </div>
  );
}
