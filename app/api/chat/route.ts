import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import trailsData from "@/data/geojson/trails.json";
import parksData from "@/data/geojson/parks.json";
import waterwaysData from "@/data/geojson/waterways.json";

const anthropic = new Anthropic();

function formatTrailsForAI(): string {
  return trailsData.features
    .map((f) => {
      const p = f.properties;
      return `[ID:${p.id}] ${p.letterCode}. ${p.name} (${p.lengthMiles}mi, ${p.surface}) - Watershed: ${p.watershed}, Riparian: ${p.riparianProximity}${p.habitatCorridor ? ", WILDLIFE CORRIDOR" : ""}`;
    })
    .join("\n");
}

function formatParksForAI(): string {
  return parksData.features
    .map((f) => {
      const p = f.properties;
      return `[ID:${p.id}] #${p.mapNumber || "?"} ${p.name} (${p.category}, ${p.ecologicalClass})${p.areaAcres ? ` - ${p.areaAcres} acres` : ""}`;
    })
    .join("\n");
}

function formatWaterwaysForAI(): string {
  return waterwaysData.features
    .map((f) => {
      const p = f.properties;
      return `[ID:${p.id}] ${p.name} (${p.type}${p.streamOrder ? `, order ${p.streamOrder}` : ""}) - Watershed: ${p.watershed}`;
    })
    .join("\n");
}

export async function POST(request: Request) {
  try {
    const { message, messages: conversationHistory, mapContext } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          error: "AI chat is not configured.",
          reply:
            "The GIS Field Coach is not configured yet. Please add your ANTHROPIC_API_KEY to .env.local to enable this feature.",
        },
        { status: 200 }
      );
    }

    const trailContext = formatTrailsForAI();
    const parkContext = formatParksForAI();
    const waterwayContext = formatWaterwaysForAI();

    const lessonContext = mapContext?.currentLesson
      ? `\nCurrent lesson: ${mapContext.currentLesson}`
      : "";
    const layerContext = mapContext?.visibleLayers
      ? `\nActive map layers: ${mapContext.visibleLayers.join(", ")}`
      : "";
    const featureContext = mapContext?.selectedFeature
      ? `\nSelected feature: ${mapContext.selectedFeature.name} (${mapContext.selectedFeature.type})`
      : "";

    const systemPrompt = `You are a GIS Field Coach -- a knowledgeable senior colleague helping an SSPR (South Suburban Parks and Recreation District) maintenance field worker learn GIS foundations through their daily job in the Denver, Colorado area.

Your user:
- Works for SSPR responding to citizen maintenance requests: graffiti removal, snow/ice clearing, parking lot repair, erosion fixes, trail surface issues, fallen trees, damaged signage, and safety hazards
- Uses a mobile device in the field
- Has no prior GIS training but knows the trail system intimately from daily work
- Wants to understand GIS concepts because they help them do their job better and see patterns in their maintenance data

You have expertise in:
- GIS fundamentals (coordinate systems, vector/raster data, spatial analysis, map projections, field data collection)
- Maintenance operations (work order management, resource allocation, seasonal patterns, priority triage)
- Practical field methods (GPS data collection, photo documentation, standardized reporting, route optimization)
- Environmental context (watershed hydrology, erosion mechanics, freeze-thaw cycles, vegetation management)

The user is working with these SSPR features:

TRAILS:
${trailContext}

PARKS & FACILITIES:
${parkContext}

WATERWAYS:
${waterwayContext}
${lessonContext}${layerContext}${featureContext}

KEY DISTRICT FACTS:
- South Platte Park: 880 acres, 300+ wildlife species, only unchannelized South Platte River section in metro Denver -- high maintenance demand due to natural processes
- Carson Nature Center: Education facility along the South Platte River
- Bear Creek corridor: Active trail study by SSPR + Sheridan + Arapahoe County Open Spaces -- multi-jurisdictional coordination needed
- High Line Canal: Historic 71-mile irrigation canal, now a critical recreation corridor. Maintenance challenges include bank erosion and vegetation overgrowth
- Trail-waterway intersections are the highest-priority zones for post-storm inspection
- Colorado recommends 50-100ft riparian buffer zones along streams -- erosion within these buffers impacts water quality
- The district has 14 major trails covering 55+ miles across multiple watersheds

Communication style:
- Talk like a senior colleague, not a professor. Use plain language first, then introduce GIS terminology
- When they describe field situations ("the trail is washed out near the creek"), translate to GIS terms ("that's a linear erosion feature intersecting a polyline trail segment within a riparian buffer zone") and explain why the terminology matters
- Give practical advice that connects GIS concepts to their daily work
- When mentioning specific trails or parks, format as [[Display Name|feature-id]] so they become clickable links that highlight on the map
- After answering, suggest a practical "Field Tip" -- a GIS insight they can apply on their next work call
- Reference their maintenance data and patterns when possible
- Keep responses concise -- they're reading on a phone in the field, not at a desk
- Be encouraging: their daily work IS GIS data collection, even if they didn't know it`;

    // Build messages array: use full conversation history if available,
    // otherwise fall back to single message (backward compatible)
    const apiMessages: { role: "user" | "assistant"; content: string }[] =
      Array.isArray(conversationHistory) && conversationHistory.length > 0
        ? conversationHistory.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }))
        : [{ role: "user" as const, content: message }];

    const response = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      system: systemPrompt,
      messages: apiMessages,
    });

    const textContent = response.content.find(
      (block) => block.type === "text"
    );
    const reply = textContent
      ? textContent.text
      : "I apologize, but I was unable to generate a response.";

    // Parse feature references from [[Name|id]] format
    const featureReferences: {
      id: string;
      displayName: string;
      featureType: string;
    }[] = [];
    const regex = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;
    let match;
    const seen = new Set<string>();

    while ((match = regex.exec(reply)) !== null) {
      const id = match[2];
      if (!seen.has(id)) {
        seen.add(id);

        // Determine feature type from ID
        const isTrail = trailsData.features.some(
          (f) => f.properties.id === id
        );
        const isPark = parksData.features.some((f) => f.properties.id === id);
        const isWaterway = waterwaysData.features.some(
          (f) => f.properties.id === id
        );

        featureReferences.push({
          id,
          displayName: match[1],
          featureType: isTrail
            ? "trail"
            : isPark
            ? "park"
            : isWaterway
            ? "waterway"
            : "unknown",
        });
      }
    }

    return NextResponse.json({ reply, featureReferences });
  } catch (error) {
    console.error("Chat API error:", error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `API error: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
