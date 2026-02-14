"use client";

import { Circle, Popup } from "react-leaflet";
import { useMemo } from "react";
import type { FeatureCollection, Feature, Point } from "geojson";

interface PriorityZonesLayerProps {
  issueData: FeatureCollection;
  waterwayData: FeatureCollection;
  trailData: FeatureCollection;
  weights: PriorityWeights;
}

export interface PriorityWeights {
  issueDensity: number;      // 0-1, weight for issue clustering
  waterProximity: number;    // 0-1, weight for waterway proximity (erosion risk)
  severityFactor: number;    // 0-1, weight for high-severity issues
  recurrence: number;        // 0-1, weight for repeat issues in same area
}

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  issueDensity: 0.35,
  waterProximity: 0.25,
  severityFactor: 0.25,
  recurrence: 0.15,
};

interface PriorityZone {
  lat: number;
  lng: number;
  score: number;     // 0-1 normalized
  issueCount: number;
  criticalCount: number;
  nearWater: boolean;
  categories: string[];
  label: string;
}

// Haversine distance in meters
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Check if a point is within `meters` of any waterway segment
function nearWaterway(lat: number, lng: number, waterways: FeatureCollection, meters: number): boolean {
  for (const feat of waterways.features) {
    if (feat.geometry.type === "LineString") {
      for (const coord of feat.geometry.coordinates) {
        if (distanceMeters(lat, lng, coord[1] as number, coord[0] as number) < meters) return true;
      }
    } else if (feat.geometry.type === "MultiLineString") {
      for (const line of feat.geometry.coordinates) {
        for (const coord of line) {
          if (distanceMeters(lat, lng, coord[1] as number, coord[0] as number) < meters) return true;
        }
      }
    }
  }
  return false;
}

const SEVERITY_SCORES: Record<string, number> = {
  critical: 1.0,
  high: 0.75,
  medium: 0.4,
  low: 0.15,
};

export function computePriorityZones(
  issueData: FeatureCollection,
  waterwayData: FeatureCollection,
  _trailData: FeatureCollection,
  weights: PriorityWeights,
  gridSizeMeters: number = 200,
): PriorityZone[] {
  // Extract issue points
  const issues = issueData.features
    .filter((f): f is Feature<Point> => f.geometry?.type === "Point")
    .map((f) => ({
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      severity: (f.properties?.severity as string) || "medium",
      category: (f.properties?.category as string) || "unknown",
      status: (f.properties?.status as string) || "reported",
    }));

  if (issues.length === 0) return [];

  // Create grid cells around issue clusters
  const cellMap = new Map<string, { lat: number; lng: number; issues: typeof issues }>();
  const gridDeg = gridSizeMeters / 111320; // approximate degrees

  for (const issue of issues) {
    const cellLat = Math.round(issue.lat / gridDeg) * gridDeg;
    const cellLng = Math.round(issue.lng / gridDeg) * gridDeg;
    const key = `${cellLat.toFixed(5)},${cellLng.toFixed(5)}`;
    if (!cellMap.has(key)) {
      cellMap.set(key, { lat: cellLat, lng: cellLng, issues: [] });
    }
    cellMap.get(key)!.issues.push(issue);
  }

  // Score each cell
  const zones: PriorityZone[] = [];
  let maxRawScore = 0;

  for (const [, cell] of cellMap) {
    if (cell.issues.length === 0) continue;

    // 1. Issue density score (more issues in cell = higher)
    const densityScore = Math.min(cell.issues.length / 8, 1); // cap at 8 issues per cell

    // 2. Waterway proximity
    const isNearWater = nearWaterway(cell.lat, cell.lng, waterwayData, 150);
    const waterScore = isNearWater ? 1.0 : 0.0;

    // 3. Severity factor (weighted average of issue severities)
    const avgSeverity =
      cell.issues.reduce((sum, i) => sum + (SEVERITY_SCORES[i.severity] || 0.4), 0) /
      cell.issues.length;

    // 4. Recurrence: count of distinct categories (multi-problem area = higher priority)
    const uniqueCategories = new Set(cell.issues.map((i) => i.category));
    const recurrenceScore = Math.min(uniqueCategories.size / 4, 1);

    const rawScore =
      densityScore * weights.issueDensity +
      waterScore * weights.waterProximity +
      avgSeverity * weights.severityFactor +
      recurrenceScore * weights.recurrence;

    maxRawScore = Math.max(maxRawScore, rawScore);

    const criticalCount = cell.issues.filter(
      (i) => i.severity === "critical" || i.severity === "high"
    ).length;

    zones.push({
      lat: cell.lat,
      lng: cell.lng,
      score: rawScore,
      issueCount: cell.issues.length,
      criticalCount,
      nearWater: isNearWater,
      categories: [...uniqueCategories],
      label: "",
    });
  }

  // Normalize scores and assign labels
  return zones
    .map((z) => ({
      ...z,
      score: maxRawScore > 0 ? z.score / maxRawScore : 0,
      label:
        z.score / (maxRawScore || 1) > 0.7
          ? "Critical Priority"
          : z.score / (maxRawScore || 1) > 0.4
            ? "High Priority"
            : z.score / (maxRawScore || 1) > 0.2
              ? "Moderate Priority"
              : "Low Priority",
    }))
    .filter((z) => z.score > 0.1) // hide very low priority
    .sort((a, b) => b.score - a.score);
}

function scoreColor(score: number): string {
  if (score > 0.7) return "#ef4444";  // red
  if (score > 0.4) return "#f97316";  // orange
  if (score > 0.2) return "#eab308";  // yellow
  return "#22c55e";                    // green
}

export function PriorityZonesLayer({
  issueData,
  waterwayData,
  trailData,
  weights,
}: PriorityZonesLayerProps) {
  const zones = useMemo(
    () => computePriorityZones(issueData, waterwayData, trailData, weights),
    [issueData, waterwayData, trailData, weights]
  );

  if (zones.length === 0) return null;

  return (
    <>
      {zones.map((zone, i) => (
        <Circle
          key={`priority-${i}`}
          center={[zone.lat, zone.lng]}
          radius={Math.max(80, zone.score * 250)}
          pathOptions={{
            color: scoreColor(zone.score),
            fillColor: scoreColor(zone.score),
            fillOpacity: 0.15 + zone.score * 0.2,
            weight: 2,
            opacity: 0.6,
          }}
        >
          <Popup>
            <div style={{ minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: scoreColor(zone.score),
                  }}
                />
                <strong style={{ fontSize: 14 }}>{zone.label}</strong>
              </div>
              <div style={{ fontSize: 12, color: "#666" }}>
                <div><strong>Score:</strong> {(zone.score * 100).toFixed(0)}%</div>
                <div><strong>Issues:</strong> {zone.issueCount} ({zone.criticalCount} critical/high)</div>
                <div><strong>Near Water:</strong> {zone.nearWater ? "Yes (erosion risk)" : "No"}</div>
                <div><strong>Categories:</strong> {zone.categories.join(", ")}</div>
                <div style={{ marginTop: 6, fontSize: 11, color: "#999" }}>
                  Weighted overlay: density {(weights.issueDensity * 100).toFixed(0)}% +
                  water {(weights.waterProximity * 100).toFixed(0)}% +
                  severity {(weights.severityFactor * 100).toFixed(0)}% +
                  recurrence {(weights.recurrence * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </Popup>
        </Circle>
      ))}
    </>
  );
}
