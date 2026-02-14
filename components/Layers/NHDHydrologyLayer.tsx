"use client";

import { GeoJSON } from "react-leaflet";
import type { Feature, FeatureCollection } from "geojson";
import type { PathOptions, LeafletEvent } from "leaflet";

interface NHDHydrologyLayerProps {
  data: FeatureCollection;
}

export function NHDHydrologyLayer({ data }: NHDHydrologyLayerProps) {
  const style = (feature?: Feature): PathOptions => {
    const fcode = feature?.properties?.fcode || 0;
    const streamOrder = feature?.properties?.streamOrder || 0;
    const named = !!feature?.properties?.name;

    // Color by feature type
    const isCanal = fcode >= 33400 && fcode <= 33699;
    const isIntermittent = fcode === 46003 || fcode === 46007;
    const color = isCanal ? "#0ea5e9" : isIntermittent ? "#7dd3fc" : "#38bdf8";

    // Width based on stream order or named-ness
    const weight = named ? 2.5 : streamOrder > 3 ? 2 : streamOrder > 1 ? 1.5 : 1;

    return {
      color,
      weight,
      opacity: isIntermittent ? 0.4 : 0.55,
      dashArray: isIntermittent ? "4 4" : isCanal ? "6 3" : undefined,
    };
  };

  const onEachFeature = (feature: Feature, layer: L.Layer) => {
    const props = feature.properties;
    if (!props) return;

    layer.on({
      mouseover: (e: LeafletEvent) => {
        const target = e.target as L.Path;
        target.setStyle({ weight: 4, opacity: 1 });
      },
      mouseout: (e: LeafletEvent) => {
        const target = e.target as L.Path;
        const named = !!props.name;
        const streamOrder = props.streamOrder || 0;
        const weight = named ? 2.5 : streamOrder > 3 ? 2 : streamOrder > 1 ? 1.5 : 1;
        const fcode = props.fcode || 0;
        const isIntermittent = fcode === 46003 || fcode === 46007;
        target.setStyle({ weight, opacity: isIntermittent ? 0.4 : 0.55 });
      },
    });

    const lengthLine = props.lengthKm
      ? `<div><strong>Length:</strong> ${Number(props.lengthKm).toFixed(2)} km</div>`
      : "";
    const orderLine = props.streamOrder
      ? `<div><strong>Stream Order:</strong> ${props.streamOrder}</div>`
      : "";

    layer.bindPopup(`
      <div style="min-width: 180px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #38bdf8;"></span>
          <strong style="font-size: 14px;">${props.name || "Unnamed Waterway"}</strong>
        </div>
        <div style="font-size: 12px; color: #666;">
          <div><strong>Type:</strong> ${props.type}</div>
          ${lengthLine}
          ${orderLine}
          <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #eee;">
            <span style="font-size: 10px; color: #999;">Source: USGS NHD</span>
          </div>
        </div>
      </div>
    `);
  };

  if (!data || data.features.length === 0) return null;

  return (
    <GeoJSON
      key={`nhd-hydrology-${data.features.length}`}
      data={data}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}
