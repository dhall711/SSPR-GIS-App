"use client";

import { useMemo } from "react";
import { GeoJSON } from "react-leaflet";
import type { Feature, FeatureCollection, Point } from "geojson";
import type { PathOptions, LeafletEvent } from "leaflet";
import { TRAIL_COLORS } from "@/lib/mapConfig";

interface TrailLayerProps {
  data: FeatureCollection;
  issueData?: FeatureCollection;
  onFeatureClick: (type: string, id: string, name: string) => void;
  highlightId?: string | null;
}

export function TrailLayer({ data, issueData, onFeatureClick, highlightId }: TrailLayerProps) {
  // Count issues per trail
  const issuesByTrail = useMemo(() => {
    if (!issueData) return new Map<string, { total: number; open: number; critical: number }>();
    const map = new Map<string, { total: number; open: number; critical: number }>();
    for (const f of issueData.features) {
      const trailId = f.properties?.trail_id || f.properties?.trailId;
      if (!trailId) continue;
      const entry = map.get(trailId) || { total: 0, open: 0, critical: 0 };
      entry.total++;
      if (f.properties?.status !== "resolved") entry.open++;
      if (f.properties?.severity === "critical") entry.critical++;
      map.set(trailId, entry);
    }
    return map;
  }, [issueData]);

  const style = (feature?: Feature): PathOptions => {
    const letterCode = feature?.properties?.letterCode || "";
    const id = feature?.properties?.id || "";
    const isHighlighted = id === highlightId;

    return {
      color: TRAIL_COLORS[letterCode] || "#666",
      weight: isHighlighted ? 6 : 3,
      opacity: isHighlighted ? 1 : 0.8,
      dashArray: undefined,
    };
  };

  const onEachFeature = (feature: Feature, layer: L.Layer) => {
    const props = feature.properties;
    if (!props) return;

    layer.on({
      click: () => {
        onFeatureClick("trail", props.id, props.name);
      },
      mouseover: (e: LeafletEvent) => {
        const target = e.target as L.Path;
        target.setStyle({ weight: 5, opacity: 1 });
      },
      mouseout: (e: LeafletEvent) => {
        const target = e.target as L.Path;
        const letterCode = props.letterCode || "";
        target.setStyle({
          weight: props.id === highlightId ? 6 : 3,
          opacity: props.id === highlightId ? 1 : 0.8,
        });
      },
    });

    // Add persistent trail name label
    layer.bindTooltip(props.name, {
      permanent: true,
      direction: "center",
      className: "trail-label",
    });

    const trailIssues = issuesByTrail.get(props.id);
    const issueHtml = trailIssues
      ? `<div style="margin-top: 8px; padding: 5px 8px; background: #fef3c7; border-radius: 4px; border: 1px solid #fcd34d;">
           <strong style="font-size: 11px; color: #92400e;">Maintenance Issues:</strong>
           <span style="font-size: 11px; color: #78350f; margin-left: 4px;">${trailIssues.open} open${trailIssues.critical > 0 ? ` (${trailIssues.critical} critical)` : ""} / ${trailIssues.total} total</span>
         </div>`
      : "";

    layer.bindPopup(`
      <div style="min-width: 200px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${TRAIL_COLORS[props.letterCode] || '#666'};" ></span>
          <strong style="font-size: 14px;">${props.name}</strong>
        </div>
        <div style="font-size: 12px; color: #666; space-y: 4px;">
          <div><strong>Length:</strong> ${props.lengthMiles || props.length_miles} miles</div>
          <div><strong>Surface:</strong> ${props.surface}</div>
          <div><strong>Watershed:</strong> ${props.watershed}</div>
          <div><strong>Riparian:</strong> ${props.riparianProximity || props.riparian_proximity}</div>
          ${(props.habitatCorridor || props.habitat_corridor) ? '<div style="margin-top: 4px; color: #2d6a4f; font-weight: 600;">Wildlife Corridor</div>' : ""}
        </div>
        ${issueHtml}
        <p style="font-size: 11px; color: #888; margin-top: 8px; line-height: 1.4;">${props.description}</p>
      </div>
    `);
  };

  return (
    <GeoJSON
      key="trails"
      data={data}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}
