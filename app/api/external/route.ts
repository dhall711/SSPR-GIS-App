import { NextResponse } from "next/server";
import {
  fetchDenverParks,
  fetchArapahoeParks,
  fetchNHDFlowlines,
  fetchAllExternalData,
} from "@/lib/externalDataService";

/**
 * GET /api/external
 *
 * Query params:
 *   - source: "denver-parks" | "arapahoe-parks" | "nhd-flowlines" | "all"
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source");

    switch (source) {
      case "denver-parks":
        return NextResponse.json(await fetchDenverParks());
      case "arapahoe-parks":
        return NextResponse.json(await fetchArapahoeParks());
      case "nhd-flowlines":
        return NextResponse.json(await fetchNHDFlowlines());
      case "all": {
        const data = await fetchAllExternalData();
        return NextResponse.json(data);
      }
      default:
        return NextResponse.json(
          { error: "Provide ?source=denver-parks|arapahoe-parks|nhd-flowlines|all" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("External data API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "External data fetch failed" },
      { status: 500 }
    );
  }
}
