"use client";

import { GeoJSON } from "react-leaflet";
import type { Feature, FeatureCollection } from "geojson";
import type { PathOptions, LeafletEvent } from "leaflet";

interface WaterwayLayerProps {
  data: FeatureCollection;
  onFeatureClick: (type: string, id: string, name: string) => void;
}

export function WaterwayLayer({ data, onFeatureClick }: WaterwayLayerProps) {
  const style = (feature?: Feature): PathOptions => {
    const streamOrder = feature?.properties?.streamOrder || 1;
    const type = feature?.properties?.type || "creek";

    // Width based on stream order (larger = wider)
    const weight = type === "river" ? 4 : type === "canal" ? 2.5 : Math.max(1.5, streamOrder * 0.8);

    return {
      color: type === "canal" ? "#0077b6" : "#219ebc",
      weight,
      opacity: 0.7,
      dashArray: type === "canal" ? "8 4" : undefined,
    };
  };

  const onEachFeature = (feature: Feature, layer: L.Layer) => {
    const props = feature.properties;
    if (!props) return;

    layer.on({
      click: () => {
        onFeatureClick("waterway", props.id, props.name);
      },
      mouseover: (e: LeafletEvent) => {
        const target = e.target as L.Path;
        target.setStyle({ weight: 5, opacity: 1 });
      },
      mouseout: (e: LeafletEvent) => {
        const target = e.target as L.Path;
        const streamOrder = props.streamOrder || 1;
        const type = props.type || "creek";
        const weight = type === "river" ? 4 : type === "canal" ? 2.5 : Math.max(1.5, streamOrder * 0.8);
        target.setStyle({ weight, opacity: 0.7 });
      },
    });

    const typeLabel =
      props.type === "river" ? "River" :
      props.type === "creek" ? "Creek" :
      props.type === "canal" ? "Canal" :
      props.type === "gulch" ? "Gulch" :
      props.type === "reservoir" ? "Reservoir" :
      "Waterway";

    layer.bindPopup(`
      <div style="min-width: 180px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #219ebc;"></span>
          <strong style="font-size: 14px;">${props.name}</strong>
        </div>
        <div style="font-size: 12px; color: #666;">
          <div><strong>Type:</strong> ${typeLabel}</div>
          ${props.streamOrder ? `<div><strong>Stream Order:</strong> ${props.streamOrder}</div>` : ""}
          <div><strong>Watershed:</strong> ${props.watershed}</div>
        </div>
      </div>
    `);
  };

  return (
    <GeoJSON
      key="waterways"
      data={data}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}
