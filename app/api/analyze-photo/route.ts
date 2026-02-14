import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

/**
 * POST /api/analyze-photo
 *
 * Sends a maintenance issue photo to Claude Vision for analysis.
 * Mirrors the wine label analysis pattern: photo in → structured data out.
 *
 * Body: { imageData: string (base64 data URL) }
 * Returns: { data: PhotoAnalysis } | { error: string }
 */

export interface PhotoAnalysis {
  category: string;
  severity: string;
  title: string;
  description: string;
  estimatedExtent: string;
  safetyRisk: string;
  likelyCause: string;
  recommendedAction: string;
  equipmentNeeded: string;
  estimatedEffort: string;
  environmentalContext: string;
  confidence: number;
}

export async function POST(request: Request) {
  try {
    const { imageData } = await request.json();

    if (!imageData) {
      return NextResponse.json(
        { error: "Image data is required" },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "AI photo analysis is not configured. Add ANTHROPIC_API_KEY." },
        { status: 200 }
      );
    }

    // Extract base64 data and media type from data URL
    const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { error: "Invalid image format. Expected base64 data URL." },
        { status: 400 }
      );
    }

    const mediaType = matches[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    const base64Data = matches[2];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: "text",
              text: `You are an expert trail maintenance field analyst for South Suburban Parks and Recreation (SSPR) near Denver, Colorado. Analyze this photo of a potential maintenance issue.

Return a JSON object with these fields:

{
  "category": "one of: graffiti, snow_ice, parking_lot, erosion, trail_surface, vegetation, signage, infrastructure, trash_dumping, safety",
  "severity": "one of: low, medium, high, critical",
  "title": "concise descriptive title for a maintenance report (5-10 words)",
  "description": "detailed description of the issue including size, extent, location context, and any relevant details visible in the photo (2-4 sentences)",
  "estimatedExtent": "estimated size/extent (e.g., '3ft x 2ft area', '15-foot stretch of trail', 'single bench')",
  "safetyRisk": "immediate safety concern level and explanation (e.g., 'Low - cosmetic only', 'High - trip hazard for pedestrians')",
  "likelyCause": "probable cause based on visual evidence (e.g., 'freeze-thaw cycle damage', 'stormwater runoff', 'vandalism')",
  "recommendedAction": "specific maintenance action needed (e.g., 'Pressure wash and apply anti-graffiti coating', 'Grade and compact trail surface, install water bar')",
  "equipmentNeeded": "tools/equipment for the repair (e.g., 'Pressure washer, paint', 'Shovel, compactor, gravel')",
  "estimatedEffort": "crew size and time estimate (e.g., '1 person, 2 hours', '2-person crew, half day')",
  "environmentalContext": "any environmental factors visible (e.g., 'Near waterway - erosion risk', 'Shaded area - ice prone in winter', 'High-traffic trailhead')",
  "confidence": 0.85
}

Guidelines:
- "confidence" is 0.0-1.0 indicating how certain you are about the classification (lower if image is blurry, ambiguous, or not clearly a maintenance issue)
- For severity: critical = immediate safety hazard or infrastructure failure; high = significant damage affecting usability; medium = moderate issue needing attention; low = minor cosmetic or early-stage
- Be specific to Colorado trail/park maintenance context (freeze-thaw, spring runoff, wildfire season, altitude)
- If the image doesn't appear to show a maintenance issue, set confidence below 0.3 and note this in the description

Only return valid JSON, no other text.`,
            },
          ],
        },
      ],
    });

    // Extract text response
    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    // Parse JSON response (handle markdown code blocks)
    try {
      let jsonText = textContent.text.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.slice(7);
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith("```")) {
        jsonText = jsonText.slice(0, -3);
      }
      jsonText = jsonText.trim();

      const data = JSON.parse(jsonText) as PhotoAnalysis;
      return NextResponse.json({ data });
    } catch {
      console.error("Failed to parse AI photo analysis:", textContent.text);
      return NextResponse.json(
        { error: "Failed to parse analysis", raw: textContent.text },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Photo analysis error:", error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `API error: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { error: "Photo analysis failed" },
      { status: 500 }
    );
  }
}
