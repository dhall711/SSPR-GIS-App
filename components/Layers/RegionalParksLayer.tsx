"use client";

import { GeoJSON } from "react-leaflet";
import type { Feature, FeatureCollection } from "geojson";
import type { PathOptions, LeafletEvent } from "leaflet";

interface RegionalParksLayerProps {
  data: FeatureCollection;
  onFeatureClick: (type: string, id: string, name: string) => void;
}

export function RegionalParksLayer({ data, onFeatureClick }: RegionalParksLayerProps) {
  const style = (feature?: Feature): PathOptions => {
    const source = feature?.properties?.source;
    return {
      color: source === "denver-open-data" ? "#8b5cf6" : "#06b6d4",
      fillColor: source === "denver-open-data" ? "#8b5cf6" : "#06b6d4",
      fillOpacity: 0.12,
      weight: 1.5,
      opacity: 0.6,
    };
  };

  const onEachFeature = (feature: Feature, layer: L.Layer) => {
    const props = feature.properties;
    if (!props) return;

    layer.on({
      click: () => {
        onFeatureClick("regional-park", props.id, props.name);
      },
      mouseover: (e: LeafletEvent) => {
        const target = e.target as L.Path;
        target.setStyle({ fillOpacity: 0.3, weight: 2.5, opacity: 0.9 });
      },
      mouseout: (e: LeafletEvent) => {
        const target = e.target as L.Path;
        target.setStyle({ fillOpacity: 0.12, weight: 1.5, opacity: 0.6 });
      },
    });

    const sourceLabel = props.source === "denver-open-data"
      ? "Denver Open Data"
      : props.source === "arapahoe-county"
        ? "Arapahoe County"
        : "External";

    const acresLine = props.acres
      ? `<div><strong>Acres:</strong> ${Number(props.acres).toFixed(1)}</div>`
      : "";
    const addressLine = props.address
      ? `<div><strong>Address:</strong> ${props.address}</div>`
      : "";
    const maintLine = props.maintainedBy
      ? `<div><strong>Maintained By:</strong> ${props.maintainedBy}</div>`
      : "";
    const typeLine = props.type
      ? `<div><strong>Type:</strong> ${props.type}</div>`
      : "";

    layer.bindPopup(`
      <div style="min-width: 200px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${props.source === 'denver-open-data' ? '#8b5cf6' : '#06b6d4'};"></span>
          <strong style="font-size: 14px;">${props.name}</strong>
        </div>
        <div style="font-size: 12px; color: #666;">
          ${typeLine}
          ${acresLine}
          ${addressLine}
          ${maintLine}
          <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #eee;">
            <span style="font-size: 10px; color: #999;">Source: ${sourceLabel}</span>
          </div>
        </div>
      </div>
    `);
  };

  if (!data || data.features.length === 0) return null;

  return (
    <GeoJSON
      key={`regional-parks-${data.features.length}`}
      data={data}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}
