"use client";

import { useMemo } from "react";
import { GeoJSON } from "react-leaflet";
import type { Feature, FeatureCollection, Point } from "geojson";
import L from "leaflet";
import { SEVERITY_COLORS } from "@/lib/mapConfig";
import { ISSUE_CATEGORY_LABELS, IssueCategory } from "@/lib/types";
import * as turf from "@turf/turf";

interface MaintenanceLayerProps {
  data: FeatureCollection;
  waterwayData?: FeatureCollection;
  onFeatureClick?: (type: string, id: string, name: string) => void;
  highlightId?: string | null;
}

export function MaintenanceLayer({ data, waterwayData, onFeatureClick, highlightId }: MaintenanceLayerProps) {
  // Pre-compute nearest waterway distance for each issue
  const nearestWaterwayMap = useMemo(() => {
    if (!waterwayData || waterwayData.features.length === 0) return new Map<string, { name: string; distFt: number }>();
    const map = new Map<string, { name: string; distFt: number }>();
    for (const issueFeat of data.features) {
      if (!issueFeat.geometry || issueFeat.geometry.type !== "Point") continue;
      const issueId = issueFeat.properties?.id;
      if (!issueId) continue;
      const pt = turf.point((issueFeat.geometry as Point).coordinates);
      let minDist = Infinity;
      let closestName = "";
      for (const wwFeat of waterwayData.features) {
        try {
          if (!wwFeat.geometry) continue;
          let dist: number;
          if (wwFeat.geometry.type === "LineString") {
            dist = turf.pointToLineDistance(pt, wwFeat as Feature<import("geojson").LineString>, { units: "feet" });
          } else if (wwFeat.geometry.type === "MultiLineString") {
            // For MultiLineString, check each line segment and take the minimum
            const coords = (wwFeat.geometry as import("geojson").MultiLineString).coordinates;
            dist = Math.min(...coords.map((line) => {
              const ls = turf.lineString(line);
              return turf.pointToLineDistance(pt, ls, { units: "feet" });
            }));
          } else {
            continue;
          }
          if (dist < minDist) {
            minDist = dist;
            closestName = wwFeat.properties?.name || "Unnamed waterway";
          }
        } catch {
          // skip invalid geometries
        }
      }
      if (minDist < Infinity) {
        map.set(issueId, { name: closestName, distFt: Math.round(minDist) });
      }
    }
    return map;
  }, [data, waterwayData]);

  const pointToLayer = (feature: Feature<Point>, latlng: L.LatLng): L.Layer => {
    const props = feature.properties || {};
    const severity = props.severity || "medium";
    const isHighlighted = props.id === highlightId;
    const isResolved = props.status === "resolved";

    return L.circleMarker(latlng, {
      radius: isHighlighted ? 12 : severity === "critical" ? 10 : severity === "high" ? 8 : 6,
      fillColor: isResolved ? "#6b7280" : (SEVERITY_COLORS[severity] || "#facc15"),
      color: isHighlighted ? "#ffffff" : isResolved ? "#4b5563" : "#333",
      weight: isHighlighted ? 3 : severity === "critical" ? 2.5 : 1.5,
      opacity: isResolved ? 0.5 : 1,
      fillOpacity: isResolved ? 0.3 : 0.85,
    });
  };

  const onEachFeature = (feature: Feature, layer: L.Layer) => {
    const props = feature.properties;
    if (!props) return;

    const severity = props.severity || "medium";
    const categoryLabel = ISSUE_CATEGORY_LABELS[props.category as IssueCategory] || props.category;
    const severityColor = SEVERITY_COLORS[severity] || "#facc15";
    const statusLabel =
      props.status === "reported" ? "New" :
      props.status === "assigned" ? "Assigned" :
      props.status === "in_progress" ? "In Progress" :
      props.status === "resolved" ? "Resolved" : props.status;

    layer.on({
      click: () => {
        onFeatureClick?.("issue", props.id, props.title);
      },
    });

    const nearestWw = nearestWaterwayMap.get(props.id);
    const waterwayHtml = nearestWw
      ? `<div style="margin-top: 6px; padding: 5px 8px; background: #e0f2fe; border-radius: 4px; border: 1px solid #7dd3fc;">
           <span style="font-size: 10px; font-weight: 600; color: #0369a1;">NEAREST WATERWAY</span>
           <span style="font-size: 11px; color: #0c4a6e; margin-left: 6px;">${nearestWw.name} &mdash; ${nearestWw.distFt.toLocaleString()} ft</span>
         </div>`
      : "";

    layer.bindPopup(`
      <div style="min-width: 220px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${severityColor}; border: 1px solid rgba(0,0,0,0.2);" ></span>
          <strong style="font-size: 14px;">${props.title}</strong>
        </div>
        <div style="font-size: 12px; color: #666; line-height: 1.6;">
          <div><strong>Category:</strong> ${categoryLabel}</div>
          <div><strong>Severity:</strong> <span style="color: ${severityColor}; font-weight: 600;">${severity.charAt(0).toUpperCase() + severity.slice(1)}</span></div>
          <div><strong>Status:</strong> ${statusLabel}</div>
          <div><strong>Reported:</strong> ${new Date(props.reportedAt).toLocaleDateString()}</div>
          ${props.assignedTo ? `<div><strong>Assigned:</strong> ${props.assignedTo}</div>` : ""}
          ${props.reporter ? `<div><strong>Reporter:</strong> ${props.reporter}</div>` : ""}
        </div>
        ${props.description ? `<p style="font-size: 11px; color: #888; margin-top: 8px; line-height: 1.4;">${props.description}</p>` : ""}
        ${waterwayHtml}
        ${props.fieldNotes ? `
          <div style="margin-top: 8px; padding: 6px 8px; background: #fef3c7; border-radius: 4px; border: 1px solid #fcd34d;">
            <p style="font-size: 10px; font-weight: 600; color: #92400e; margin-bottom: 2px;">FIELD NOTES</p>
            <p style="font-size: 11px; color: #78350f; line-height: 1.4;">${props.fieldNotes}</p>
          </div>
        ` : ""}
      </div>
    `);
  };

  return (
    <GeoJSON
      key={`maintenance-${data.features.length}-${highlightId || 'none'}`}
      data={data}
      pointToLayer={pointToLayer}
      onEachFeature={onEachFeature}
    />
  );
}
