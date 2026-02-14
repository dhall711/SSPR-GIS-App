/**
 * Maintenance Issue Service
 *
 * Currently operates on in-memory data loaded from seed JSON.
 * When Supabase is configured, swap the implementation to use
 * the supabase client with PostGIS spatial queries.
 */

import { MaintenanceIssue, IssueCategory, IssueSeverity, IssueStatus } from "./types";
import _seedData from "@/data/seed/maintenance-issues.json";

interface GeoJSONFeature {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: [number, number] };
}

// In-memory store (singleton for the server process)
let issueStore: MaintenanceIssue[] | null = null;

function getStore(): MaintenanceIssue[] {
  if (!issueStore) {
    const data = _seedData as unknown as { features: GeoJSONFeature[] };
    issueStore = data.features.map((f) => ({
      ...(f.properties as unknown as MaintenanceIssue),
      latitude: f.geometry.coordinates[1],
      longitude: f.geometry.coordinates[0],
    }));
  }
  return issueStore;
}

// ============================================================
// Query helpers
// ============================================================

export interface IssueFilters {
  status?: IssueStatus | IssueStatus[];
  category?: IssueCategory | IssueCategory[];
  severity?: IssueSeverity | IssueSeverity[];
  trailId?: string;
  parkId?: string;
  assignedTo?: string;
  nearLat?: number;
  nearLng?: number;
  nearRadiusMiles?: number;
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function matchesFilter<T>(value: T, filter: T | T[] | undefined): boolean {
  if (filter === undefined) return true;
  if (Array.isArray(filter)) return filter.includes(value);
  return value === filter;
}

// ============================================================
// CRUD operations
// ============================================================

export function getAllIssues(filters?: IssueFilters): MaintenanceIssue[] {
  let results = getStore();

  if (filters) {
    results = results.filter((issue) => {
      if (!matchesFilter(issue.status, filters.status)) return false;
      if (!matchesFilter(issue.category, filters.category)) return false;
      if (!matchesFilter(issue.severity, filters.severity)) return false;
      if (filters.trailId && issue.trailId !== filters.trailId) return false;
      if (filters.parkId && issue.parkId !== filters.parkId) return false;
      if (filters.assignedTo && issue.assignedTo !== filters.assignedTo) return false;
      if (
        filters.nearLat !== undefined &&
        filters.nearLng !== undefined &&
        filters.nearRadiusMiles !== undefined
      ) {
        const dist = haversineDistance(
          filters.nearLat,
          filters.nearLng,
          issue.latitude,
          issue.longitude
        );
        if (dist > filters.nearRadiusMiles) return false;
      }
      return true;
    });
  }

  return results;
}

export function getIssueById(id: string): MaintenanceIssue | null {
  return getStore().find((i) => i.id === id) ?? null;
}

export function createIssue(
  input: Omit<MaintenanceIssue, "id" | "reportedAt" | "resolvedAt" | "aiAnalysis">
): MaintenanceIssue {
  const store = getStore();
  const issue: MaintenanceIssue = {
    ...input,
    id: `mi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    reportedAt: new Date().toISOString(),
    resolvedAt: null,
    aiAnalysis: null,
  };
  store.unshift(issue);
  return issue;
}

export function updateIssue(
  id: string,
  updates: Partial<Pick<MaintenanceIssue, "status" | "severity" | "assignedTo" | "fieldNotes" | "aiAnalysis">>
): MaintenanceIssue | null {
  const store = getStore();
  const idx = store.findIndex((i) => i.id === id);
  if (idx === -1) return null;

  const updated = { ...store[idx], ...updates };

  // Auto-set resolvedAt when status changes to resolved
  if (updates.status === "resolved" && !store[idx].resolvedAt) {
    updated.resolvedAt = new Date().toISOString();
  }

  store[idx] = updated;
  return updated;
}

export function getIssueStats() {
  const store = getStore();
  const byStatus: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  store.forEach((issue) => {
    byStatus[issue.status] = (byStatus[issue.status] || 0) + 1;
    byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
    bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
  });

  return {
    total: store.length,
    byStatus,
    byCategory,
    bySeverity,
  };
}

/**
 * Convert issues back to GeoJSON for map display.
 */
export function issuesToGeoJSON(issues: MaintenanceIssue[]) {
  return {
    type: "FeatureCollection" as const,
    features: issues.map((issue) => ({
      type: "Feature" as const,
      properties: { ...issue },
      geometry: {
        type: "Point" as const,
        coordinates: [issue.longitude, issue.latitude] as [number, number],
      },
    })),
  };
}
