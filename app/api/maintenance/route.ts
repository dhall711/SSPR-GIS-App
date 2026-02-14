import { NextResponse } from "next/server";
import {
  getAllIssues,
  getIssueById,
  createIssue,
  updateIssue,
  getIssueStats,
  type IssueFilters,
} from "@/lib/maintenanceService";
import type { IssueCategory, IssueSeverity, IssueStatus } from "@/lib/types";

/**
 * GET /api/maintenance
 *
 * Query params:
 *   - id: get a specific issue by ID
 *   - status: filter by status (comma-separated for multiple)
 *   - category: filter by category (comma-separated)
 *   - severity: filter by severity (comma-separated)
 *   - trailId: filter by trail
 *   - parkId: filter by park
 *   - assignedTo: filter by assignee
 *   - nearLat, nearLng, nearRadius: proximity filter (radius in miles)
 *   - stats: if "true", return aggregate statistics instead of issues
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Single issue by ID
    const id = searchParams.get("id");
    if (id) {
      const issue = getIssueById(id);
      if (!issue) {
        return NextResponse.json({ error: "Issue not found" }, { status: 404 });
      }
      return NextResponse.json({ issue });
    }

    // Stats endpoint
    if (searchParams.get("stats") === "true") {
      return NextResponse.json(getIssueStats());
    }

    // Build filters
    const filters: IssueFilters = {};

    const status = searchParams.get("status");
    if (status) {
      const statuses = status.split(",") as IssueStatus[];
      filters.status = statuses.length === 1 ? statuses[0] : statuses;
    }

    const category = searchParams.get("category");
    if (category) {
      const categories = category.split(",") as IssueCategory[];
      filters.category = categories.length === 1 ? categories[0] : categories;
    }

    const severity = searchParams.get("severity");
    if (severity) {
      const severities = severity.split(",") as IssueSeverity[];
      filters.severity = severities.length === 1 ? severities[0] : severities;
    }

    const trailId = searchParams.get("trailId");
    if (trailId) filters.trailId = trailId;

    const parkId = searchParams.get("parkId");
    if (parkId) filters.parkId = parkId;

    const assignedTo = searchParams.get("assignedTo");
    if (assignedTo) filters.assignedTo = assignedTo;

    const nearLat = searchParams.get("nearLat");
    const nearLng = searchParams.get("nearLng");
    const nearRadius = searchParams.get("nearRadius");
    if (nearLat && nearLng && nearRadius) {
      filters.nearLat = parseFloat(nearLat);
      filters.nearLng = parseFloat(nearLng);
      filters.nearRadiusMiles = parseFloat(nearRadius);
    }

    const issues = getAllIssues(filters);
    return NextResponse.json({ issues, count: issues.length });
  } catch (error) {
    console.error("Maintenance GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch issues" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/maintenance
 *
 * Create a new maintenance issue.
 * Body: { latitude, longitude, category, severity, title, description?, ... }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    const required = ["latitude", "longitude", "category", "severity", "title"];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const issue = createIssue({
      latitude: body.latitude,
      longitude: body.longitude,
      trailId: body.trailId || null,
      parkId: body.parkId || null,
      category: body.category,
      severity: body.severity,
      status: "reported",
      title: body.title,
      description: body.description || "",
      photoUrl: body.photoUrl || null,
      assignedTo: body.assignedTo || null,
      reporter: body.reporter || "field-worker",
      source: body.source || "field_entry",
      fieldNotes: body.fieldNotes || null,
    });

    return NextResponse.json({ issue }, { status: 201 });
  } catch (error) {
    console.error("Maintenance POST error:", error);
    return NextResponse.json(
      { error: "Failed to create issue" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/maintenance
 *
 * Update an existing issue. Body must include { id } plus fields to update.
 * Updatable fields: status, severity, assignedTo, fieldNotes, aiAnalysis
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.severity !== undefined) updates.severity = body.severity;
    if (body.assignedTo !== undefined) updates.assignedTo = body.assignedTo;
    if (body.fieldNotes !== undefined) updates.fieldNotes = body.fieldNotes;
    if (body.aiAnalysis !== undefined) updates.aiAnalysis = body.aiAnalysis;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No updatable fields provided" },
        { status: 400 }
      );
    }

    const issue = updateIssue(body.id, updates);
    if (!issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    return NextResponse.json({ issue });
  } catch (error) {
    console.error("Maintenance PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update issue" },
      { status: 500 }
    );
  }
}
