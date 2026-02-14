import { NextResponse } from "next/server";
import {
  fetchTrailsGeoJSON,
  fetchParksGeoJSON,
  fetchWaterwaysGeoJSON,
  fetchBoundariesGeoJSON,
  fetchIssuesGeoJSON,
  findNearbyParks,
  findNearbyIssues,
  getRiparianBuffer,
  findIssuesNearTrail,
  findFeaturesInPolygon,
  getIssueStats,
} from "@/lib/spatialService";

/**
 * GET /api/spatial
 *
 * Query params:
 *   - layer: "trails" | "parks" | "waterways" | "boundaries" | "issues" -> GeoJSON
 *   - query: "nearby-parks" | "nearby-issues" | "riparian-buffer" | "issues-near-trail" | "features-in-polygon" | "issue-stats"
 *   - lat, lng, radius: for proximity queries (radius in meters)
 *   - waterwayId, buffer: for riparian buffer
 *   - trailId, buffer: for issues near trail
 *   - polygon: GeoJSON polygon string for features-in-polygon
 *   - status: optional filter for issues layer
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const layer = searchParams.get("layer");
    const query = searchParams.get("query");

    // GeoJSON layer fetchers
    if (layer) {
      switch (layer) {
        case "trails":
          return NextResponse.json(await fetchTrailsGeoJSON());
        case "parks":
          return NextResponse.json(await fetchParksGeoJSON());
        case "waterways":
          return NextResponse.json(await fetchWaterwaysGeoJSON());
        case "boundaries":
          return NextResponse.json(await fetchBoundariesGeoJSON());
        case "issues": {
          const status = searchParams.get("status") || undefined;
          return NextResponse.json(await fetchIssuesGeoJSON(status));
        }
        default:
          return NextResponse.json({ error: `Unknown layer: ${layer}` }, { status: 400 });
      }
    }

    // Spatial queries
    if (query) {
      switch (query) {
        case "nearby-parks": {
          const lat = parseFloat(searchParams.get("lat") || "");
          const lng = parseFloat(searchParams.get("lng") || "");
          const radius = parseFloat(searchParams.get("radius") || "1000");
          if (isNaN(lat) || isNaN(lng)) {
            return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
          }
          return NextResponse.json(await findNearbyParks(lat, lng, radius));
        }
        case "nearby-issues": {
          const lat = parseFloat(searchParams.get("lat") || "");
          const lng = parseFloat(searchParams.get("lng") || "");
          const radius = parseFloat(searchParams.get("radius") || "1000");
          if (isNaN(lat) || isNaN(lng)) {
            return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
          }
          return NextResponse.json(await findNearbyIssues(lat, lng, radius));
        }
        case "riparian-buffer": {
          const waterwayId = searchParams.get("waterwayId");
          const buffer = parseFloat(searchParams.get("buffer") || "30");
          if (!waterwayId) {
            return NextResponse.json({ error: "waterwayId required" }, { status: 400 });
          }
          return NextResponse.json(await getRiparianBuffer(waterwayId, buffer));
        }
        case "issues-near-trail": {
          const trailId = searchParams.get("trailId");
          const buffer = parseFloat(searchParams.get("buffer") || "100");
          if (!trailId) {
            return NextResponse.json({ error: "trailId required" }, { status: 400 });
          }
          return NextResponse.json(await findIssuesNearTrail(trailId, buffer));
        }
        case "features-in-polygon": {
          const polygon = searchParams.get("polygon");
          if (!polygon) {
            return NextResponse.json({ error: "polygon GeoJSON string required" }, { status: 400 });
          }
          return NextResponse.json(await findFeaturesInPolygon(polygon));
        }
        case "issue-stats":
          return NextResponse.json(await getIssueStats());
        default:
          return NextResponse.json({ error: `Unknown query: ${query}` }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: "Provide ?layer=<name> or ?query=<name>" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Spatial API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Spatial query failed" },
      { status: 500 }
    );
  }
}
