"use client";

import { useState, useEffect, useCallback } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import type { Feature, FeatureCollection } from "geojson";
import L from "leaflet";

interface BufferLayerProps {
  waterwayId: string | null;
  bufferMeters: number;
  onClose: () => void;
}

/**
 * Renders a riparian buffer polygon fetched from the PostGIS riparian_buffer RPC.
 * Shows a small control panel to select waterway and buffer distance.
 */
export function BufferLayer({ waterwayId, bufferMeters, onClose }: BufferLayerProps) {
  const [bufferGeoJSON, setBufferGeoJSON] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const map = useMap();

  useEffect(() => {
    if (!waterwayId) {
      setBufferGeoJSON(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/spatial?query=riparian-buffer&waterwayId=${encodeURIComponent(waterwayId)}&buffer=${bufferMeters}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch buffer");
        return res.json();
      })
      .then((data) => {
        // The RPC returns a raw GeoJSON geometry (polygon)
        // Wrap it into a FeatureCollection
        if (data && (data.type === "Polygon" || data.type === "MultiPolygon")) {
          const fc: FeatureCollection = {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { waterwayId, bufferMeters },
                geometry: data,
              },
            ],
          };
          setBufferGeoJSON(fc);
          // Fit map to buffer bounds
          try {
            const geoLayer = L.geoJSON(fc);
            const bounds = geoLayer.getBounds();
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
            }
          } catch {
            // bounds calculation failed, ignore
          }
        } else {
          setError("No buffer data returned");
        }
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [waterwayId, bufferMeters, map]);

  if (loading) return null;
  if (error) return null;
  if (!bufferGeoJSON) return null;

  return (
    <GeoJSON
      key={`buffer-${waterwayId}-${bufferMeters}`}
      data={bufferGeoJSON}
      style={() => ({
        color: "#2d6a4f",
        weight: 2,
        fillColor: "#52b788",
        fillOpacity: 0.2,
        opacity: 0.8,
        dashArray: "5 5",
      })}
      onEachFeature={(feature: Feature, layer: L.Layer) => {
        layer.bindPopup(`
          <div style="min-width: 180px;">
            <strong style="font-size: 13px; color: #2d6a4f;">Riparian Buffer</strong>
            <div style="font-size: 12px; color: #666; margin-top: 4px;">
              <div><strong>Waterway:</strong> ${waterwayId}</div>
              <div><strong>Buffer:</strong> ${bufferMeters}m each side</div>
              <div style="margin-top: 6px; font-size: 11px; color: #888;">
                Work within this zone may require erosion control measures,
                sediment barriers, and environmental review.
              </div>
            </div>
          </div>
        `);
      }}
    />
  );
}

/**
 * Floating control panel for buffer settings (rendered outside the map).
 */
interface BufferControlProps {
  isActive: boolean;
  waterwayId: string | null;
  bufferMeters: number;
  onWaterwayChange: (id: string | null) => void;
  onBufferChange: (meters: number) => void;
  onToggle: () => void;
}

const WATERWAYS = [
  { id: "south-platte-river", name: "South Platte River" },
  { id: "bear-creek-waterway", name: "Bear Creek" },
  { id: "big-dry-creek", name: "Big Dry Creek" },
  { id: "little-dry-creek", name: "Little Dry Creek" },
  { id: "dutch-creek", name: "Dutch Creek" },
  { id: "marcy-gulch", name: "Marcy Gulch" },
  { id: "highline-canal-waterway", name: "High Line Canal" },
];

const BUFFER_DISTANCES = [30, 50, 100, 150, 200, 300];

export function BufferControl({
  isActive,
  waterwayId,
  bufferMeters,
  onWaterwayChange,
  onBufferChange,
  onToggle,
}: BufferControlProps) {
  if (!isActive) return null;

  return (
    <div className="rounded-lg bg-white shadow-lg border border-gray-200 p-3 w-60">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Riparian Buffer
        </h4>
        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          &times;
        </button>
      </div>

      <label className="block text-xs text-gray-600 mb-1">Waterway</label>
      <select
        value={waterwayId || ""}
        onChange={(e) => onWaterwayChange(e.target.value || null)}
        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-green-500 focus:outline-none mb-2"
      >
        <option value="">Select a waterway...</option>
        {WATERWAYS.map((w) => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>

      <label className="block text-xs text-gray-600 mb-1">Buffer Distance</label>
      <div className="flex flex-wrap gap-1 mb-2">
        {BUFFER_DISTANCES.map((d) => (
          <button
            key={d}
            onClick={() => onBufferChange(d)}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              bufferMeters === d
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {d}m
          </button>
        ))}
      </div>

      {waterwayId && (
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Showing {bufferMeters}m setback zone. Work within this area may need environmental review.
        </p>
      )}
    </div>
  );
}
