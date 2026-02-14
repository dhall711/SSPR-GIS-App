"use client";

import { GeoJSON } from "react-leaflet";
import type { FeatureCollection } from "geojson";
import type { PathOptions } from "leaflet";

interface BoundaryLayerProps {
  data: FeatureCollection;
}

export function BoundaryLayer({ data }: BoundaryLayerProps) {
  const style = (): PathOptions => {
    return {
      color: "#2d6a4f",
      weight: 2.5,
      opacity: 0.6,
      fillColor: "#2d6a4f",
      fillOpacity: 0.04,
      dashArray: "10 6",
    };
  };

  return (
    <GeoJSON
      key="district-boundary"
      data={data}
      style={style}
    />
  );
}
