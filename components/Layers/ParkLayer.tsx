"use client";

import { useMemo } from "react";
import { GeoJSON } from "react-leaflet";
import type { Feature, FeatureCollection, Point } from "geojson";
import L from "leaflet";
import { PARK_CATEGORY_STYLES } from "@/lib/mapConfig";

interface ParkLayerProps {
  data: FeatureCollection;
  issueData?: FeatureCollection;
  onFeatureClick: (type: string, id: string, name: string) => void;
  highlightId?: string | null;
}

export function ParkLayer({ data, issueData, onFeatureClick, highlightId }: ParkLayerProps) {
  // Count issues per park
  const issuesByPark = useMemo(() => {
    if (!issueData) return new Map<string, { total: number; open: number }>();
    const map = new Map<string, { total: number; open: number }>();
    for (const f of issueData.features) {
      const parkId = f.properties?.park_id || f.properties?.parkId;
      if (!parkId) continue;
      const entry = map.get(parkId) || { total: 0, open: 0 };
      entry.total++;
      if (f.properties?.status !== "resolved") entry.open++;
      map.set(parkId, entry);
    }
    return map;
  }, [issueData]);

  const pointToLayer = (feature: Feature<Point>, latlng: L.LatLng): L.Layer => {
    const props = feature.properties || {};
    const category = props.category || "default";
    const style = PARK_CATEGORY_STYLES[category] || PARK_CATEGORY_STYLES.default;
    const isHighlighted = props.id === highlightId;

    return L.circleMarker(latlng, {
      radius: isHighlighted ? 10 : 7,
      fillColor: style.color,
      color: isHighlighted ? "#ffffff" : "#333",
      weight: isHighlighted ? 3 : 1.5,
      opacity: 1,
      fillOpacity: 0.85,
    });
  };

  const onEachFeature = (feature: Feature, layer: L.Layer) => {
    const props = feature.properties;
    if (!props) return;

    const category = props.category || "default";
    const style = PARK_CATEGORY_STYLES[category] || PARK_CATEGORY_STYLES.default;

    layer.on({
      click: () => {
        onFeatureClick("park", props.id, props.name);
      },
    });

    const ecoLabel =
      props.ecologicalClass === "riparian"
        ? "Riparian Ecosystem"
        : props.ecologicalClass === "wetland"
        ? "Wetland Habitat"
        : props.ecologicalClass === "natural_area"
        ? "Natural Area"
        : props.ecologicalClass === "upland"
        ? "Upland Habitat"
        : props.ecologicalClass === "urban_green"
        ? "Urban Green Space"
        : props.ecologicalClass === "built"
        ? "Built Facility"
        : "Unknown";

    const parkIssues = issuesByPark.get(props.id);
    const issueHtml = parkIssues
      ? `<div style="margin-top: 8px; padding: 5px 8px; background: #fef3c7; border-radius: 4px; border: 1px solid #fcd34d;">
           <strong style="font-size: 11px; color: #92400e;">Issues:</strong>
           <span style="font-size: 11px; color: #78350f; margin-left: 4px;">${parkIssues.open} open / ${parkIssues.total} total</span>
         </div>`
      : "";

    layer.bindPopup(`
      <div style="min-width: 200px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${style.color};" ></span>
          <strong style="font-size: 14px;">${props.name}</strong>
        </div>
        <div style="font-size: 12px; color: #666;">
          <div><strong>Type:</strong> ${style.label}</div>
          <div><strong>Ecology:</strong> ${ecoLabel}</div>
          ${(props.mapNumber || props.map_number) ? `<div><strong>Map #:</strong> ${props.mapNumber || props.map_number}</div>` : ""}
          ${(props.gridRef || props.grid_ref) ? `<div><strong>Grid:</strong> ${props.gridRef || props.grid_ref}</div>` : ""}
          ${(props.areaAcres || props.area_acres) ? `<div><strong>Area:</strong> ${props.areaAcres || props.area_acres} acres</div>` : ""}
        </div>
        ${issueHtml}
        <p style="font-size: 11px; color: #888; margin-top: 8px; line-height: 1.4;">${props.description}</p>
      </div>
    `);
  };

  return (
    <GeoJSON
      key="parks"
      data={data}
      pointToLayer={pointToLayer}
      onEachFeature={onEachFeature}
    />
  );
}
