/**
 * Spatial Service -- wraps Supabase PostGIS RPC functions
 *
 * Each function calls a corresponding database function that returns
 * GeoJSON or row data using PostGIS spatial queries.
 */

import { supabase } from "./supabase";
import type { FeatureCollection } from "geojson";
import type { MaintenanceIssue } from "./types";

// ============================================================
// GeoJSON layer fetchers (calls *_geojson() RPCs)
// ============================================================

export async function fetchTrailsGeoJSON(): Promise<FeatureCollection> {
  const { data, error } = await supabase.rpc("trails_geojson");
  if (error) throw new Error(`trails_geojson: ${error.message}`);
  return data as FeatureCollection;
}

export async function fetchParksGeoJSON(): Promise<FeatureCollection> {
  const { data, error } = await supabase.rpc("parks_geojson");
  if (error) throw new Error(`parks_geojson: ${error.message}`);
  return data as FeatureCollection;
}

export async function fetchWaterwaysGeoJSON(): Promise<FeatureCollection> {
  const { data, error } = await supabase.rpc("waterways_geojson");
  if (error) throw new Error(`waterways_geojson: ${error.message}`);
  return data as FeatureCollection;
}

export async function fetchIssuesGeoJSON(statusFilter?: string): Promise<FeatureCollection> {
  const { data, error } = await supabase.rpc("issues_geojson", {
    filter_status: statusFilter ?? null,
  });
  if (error) throw new Error(`issues_geojson: ${error.message}`);
  return data as FeatureCollection;
}

// ============================================================
// Spatial queries
// ============================================================

/** Find parks within radius (meters) of a point */
export async function findNearbyParks(lat: number, lng: number, radiusMeters: number) {
  const { data, error } = await supabase.rpc("nearby_parks", {
    lat,
    lng,
    radius_meters: radiusMeters,
  });
  if (error) throw new Error(`nearby_parks: ${error.message}`);
  return data;
}

/** Find maintenance issues within radius (meters) of a point, ordered by distance */
export async function findNearbyIssues(lat: number, lng: number, radiusMeters: number) {
  const { data, error } = await supabase.rpc("nearby_issues", {
    lat,
    lng,
    radius_meters: radiusMeters,
  });
  if (error) throw new Error(`nearby_issues: ${error.message}`);
  return data;
}

/** Create a riparian buffer around a waterway (returns GeoJSON polygon) */
export async function getRiparianBuffer(waterwayId: string, bufferMeters: number) {
  const { data, error } = await supabase.rpc("riparian_buffer", {
    target_waterway_id: waterwayId,
    buffer_meters: bufferMeters,
  });
  if (error) throw new Error(`riparian_buffer: ${error.message}`);
  return data; // GeoJSON polygon
}

/** Find maintenance issues near a trail */
export async function findIssuesNearTrail(trailId: string, bufferMeters: number) {
  const { data, error } = await supabase.rpc("issues_near_trail", {
    target_trail_id: trailId,
    buffer_meters: bufferMeters,
  });
  if (error) throw new Error(`issues_near_trail: ${error.message}`);
  return data;
}

/** Find all features (parks, trail count, issue count) within a drawn polygon */
export async function findFeaturesInPolygon(geojsonPolygon: string) {
  const { data, error } = await supabase.rpc("features_in_polygon", {
    geojson_polygon: geojsonPolygon,
  });
  if (error) throw new Error(`features_in_polygon: ${error.message}`);
  return data;
}

/** Get aggregate issue statistics */
export async function getIssueStats() {
  const { data, error } = await supabase.rpc("issue_stats");
  if (error) throw new Error(`issue_stats: ${error.message}`);
  return data;
}

// ============================================================
// Boundary data (not an RPC, just a query)
// ============================================================

export async function fetchBoundariesGeoJSON(): Promise<FeatureCollection> {
  const { data, error } = await supabase
    .from("boundaries")
    .select("id, name, type, geometry");
  if (error) throw new Error(`boundaries: ${error.message}`);

  // Convert to GeoJSON FeatureCollection
  return {
    type: "FeatureCollection",
    features: (data || []).map((row: Record<string, unknown>) => ({
      type: "Feature" as const,
      id: row.id as string,
      geometry: typeof row.geometry === "string"
        ? JSON.parse(row.geometry)
        : row.geometry,
      properties: {
        id: row.id,
        name: row.name,
        type: row.type,
      },
    })),
  };
}

// ============================================================
// Maintenance issue CRUD via Supabase
// ============================================================

/** Fetch all maintenance issues as typed objects */
export async function fetchMaintenanceIssues(): Promise<MaintenanceIssue[]> {
  const { data, error } = await supabase
    .from("maintenance_issues")
    .select("*")
    .order("reported_at", { ascending: false });
  if (error) throw new Error(`fetch issues: ${error.message}`);

  return (data || []).map(dbRowToIssue);
}

/** Create a maintenance issue in Supabase */
export async function createMaintenanceIssue(
  issue: Omit<MaintenanceIssue, "id" | "reportedAt" | "resolvedAt" | "aiAnalysis">
): Promise<MaintenanceIssue> {
  const { data, error } = await supabase
    .from("maintenance_issues")
    .insert({
      location: `POINT(${issue.longitude} ${issue.latitude})`,
      trail_id: issue.trailId,
      park_id: issue.parkId,
      category: issue.category,
      severity: issue.severity,
      status: issue.status || "reported",
      title: issue.title,
      description: issue.description,
      photo_url: issue.photoUrl,
      assigned_to: issue.assignedTo,
      reporter: issue.reporter,
      source: issue.source,
      field_notes: issue.fieldNotes,
    })
    .select()
    .single();

  if (error) throw new Error(`create issue: ${error.message}`);
  return dbRowToIssue(data);
}

/** Update a maintenance issue in Supabase */
export async function updateMaintenanceIssue(
  id: string,
  updates: Partial<Pick<MaintenanceIssue, "status" | "severity" | "assignedTo" | "fieldNotes" | "aiAnalysis">>
): Promise<MaintenanceIssue> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.severity !== undefined) dbUpdates.severity = updates.severity;
  if (updates.assignedTo !== undefined) dbUpdates.assigned_to = updates.assignedTo;
  if (updates.fieldNotes !== undefined) dbUpdates.field_notes = updates.fieldNotes;
  if (updates.aiAnalysis !== undefined) dbUpdates.ai_analysis = updates.aiAnalysis;
  if (updates.status === "resolved") dbUpdates.resolved_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("maintenance_issues")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`update issue: ${error.message}`);
  return dbRowToIssue(data);
}

// ============================================================
// Lesson progress CRUD
// ============================================================

export interface LessonProgressRow {
  id: string;
  lesson_id: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  quiz_score: number | null;
  quiz_total: number | null;
  exercise_completed: boolean;
  notes: string | null;
}

export async function fetchLessonProgress(): Promise<LessonProgressRow[]> {
  const { data, error } = await supabase
    .from("lesson_progress")
    .select("*")
    .order("lesson_id");
  if (error) throw new Error(`fetch progress: ${error.message}`);
  return data || [];
}

export async function upsertLessonProgress(progress: {
  lessonId: number;
  status: string;
  startedAt?: string;
  completedAt?: string;
  quizScore?: number;
  quizTotal?: number;
  exerciseCompleted?: boolean;
  notes?: string;
}) {
  const { error } = await supabase
    .from("lesson_progress")
    .upsert(
      {
        lesson_id: progress.lessonId,
        status: progress.status,
        started_at: progress.startedAt ?? null,
        completed_at: progress.completedAt ?? null,
        quiz_score: progress.quizScore ?? null,
        quiz_total: progress.quizTotal ?? null,
        exercise_completed: progress.exerciseCompleted ?? false,
        notes: progress.notes ?? null,
      },
      { onConflict: "lesson_id" }
    );
  if (error) throw new Error(`upsert progress: ${error.message}`);
}

// ============================================================
// Helpers
// ============================================================

/** Convert a Supabase DB row (snake_case) into a MaintenanceIssue (camelCase) */
function dbRowToIssue(row: Record<string, unknown>): MaintenanceIssue {
  // Extract lat/lng from WKT point if needed
  let lat = 0, lng = 0;
  const loc = row.location as string | undefined;
  if (loc && typeof loc === "string") {
    // Format: "POINT(-104.988 39.595)" or "0101000020E6100000..."
    const match = loc.match(/POINT\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/);
    if (match) {
      lng = parseFloat(match[1]);
      lat = parseFloat(match[2]);
    }
  }

  return {
    id: row.id as string,
    latitude: lat,
    longitude: lng,
    trailId: (row.trail_id as string) ?? null,
    parkId: (row.park_id as string) ?? null,
    category: row.category as MaintenanceIssue["category"],
    severity: row.severity as MaintenanceIssue["severity"],
    status: row.status as MaintenanceIssue["status"],
    title: row.title as string,
    description: (row.description as string) ?? "",
    photoUrl: (row.photo_url as string) ?? null,
    reportedAt: row.reported_at as string,
    resolvedAt: (row.resolved_at as string) ?? null,
    assignedTo: (row.assigned_to as string) ?? null,
    reporter: (row.reporter as string) ?? "unknown",
    source: (row.source as MaintenanceIssue["source"]) ?? "citizen",
    fieldNotes: (row.field_notes as string) ?? null,
    aiAnalysis: (row.ai_analysis as string) ?? null,
  };
}
