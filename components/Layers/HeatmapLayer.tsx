"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { FeatureCollection, Point } from "geojson";
import L from "leaflet";
import "leaflet.heat";

interface HeatmapLayerProps {
  data: FeatureCollection;
}

// Severity weights for heatmap intensity
const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 1.0,
  high: 0.7,
  medium: 0.4,
  low: 0.2,
};

export function HeatmapLayer({ data }: HeatmapLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!data?.features?.length) return;

    const points: [number, number, number][] = data.features
      .filter((f) => f.geometry?.type === "Point")
      .map((f) => {
        const coords = (f.geometry as Point).coordinates;
        const severity = f.properties?.severity || "medium";
        const weight = SEVERITY_WEIGHT[severity] ?? 0.4;
        return [coords[1], coords[0], weight] as [number, number, number];
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const heat = (L as any).heatLayer(points, {
      radius: 25,
      blur: 20,
      maxZoom: 15,
      max: 1.0,
      gradient: {
        0.0: "#00ff00",
        0.3: "#ffff00",
        0.5: "#ffa500",
        0.7: "#ff4500",
        1.0: "#ff0000",
      },
    });

    heat.addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [data, map]);

  return null;
}
