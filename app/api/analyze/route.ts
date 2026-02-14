import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { MaintenanceIssue } from "@/lib/types";

const anthropic = new Anthropic();

/**
 * POST /api/analyze
 *
 * Sends a cluster of maintenance issues to Claude for pattern analysis.
 * Body: { issues: MaintenanceIssue[], question?: string }
 *
 * Returns: { analysis: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const issues: MaintenanceIssue[] = body.issues || [];
    const question = body.question || "Analyze the spatial and temporal patterns in these maintenance issues. What are the likely root causes, and what preventive actions would you recommend?";

    if (issues.length === 0) {
      return NextResponse.json(
        { error: "At least one issue is required" },
        { status: 400 }
      );
    }

    // Format issues for AI context
    const issuesSummary = issues.map((i, idx) => {
      return `${idx + 1}. [${i.severity.toUpperCase()}] "${i.title}" (${i.category}) at ${i.latitude.toFixed(4)}, ${i.longitude.toFixed(4)}${i.trailId ? ` on trail: ${i.trailId}` : ""}${i.parkId ? ` at park: ${i.parkId}` : ""} - Reported: ${new Date(i.reportedAt).toLocaleDateString()} - Status: ${i.status}${i.fieldNotes ? ` - Notes: ${i.fieldNotes}` : ""}`;
    }).join("\n");

    // Category/severity breakdown
    const catCounts: Record<string, number> = {};
    const sevCounts: Record<string, number> = {};
    issues.forEach((i) => {
      catCounts[i.category] = (catCounts[i.category] || 0) + 1;
      sevCounts[i.severity] = (sevCounts[i.severity] || 0) + 1;
    });

    const catBreakdown = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => `${cat}: ${count}`)
      .join(", ");

    const sevBreakdown = Object.entries(sevCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([sev, count]) => `${sev}: ${count}`)
      .join(", ");

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        analysis: `Analysis of ${issues.length} issues: ${catBreakdown}. Configure ANTHROPIC_API_KEY for AI-powered analysis.`,
      });
    }

    const systemPrompt = `You are a GIS-trained maintenance analyst for the South Suburban Parks and Recreation (SSPR) district near Denver, Colorado. You analyze spatial patterns in maintenance issue data to identify root causes, predict future problems, and recommend preventive actions.

Your analysis should:
1. Identify spatial clusters and explain WHY issues concentrate in certain areas (proximity to waterways, terrain, high-traffic zones, etc.)
2. Look for temporal patterns (seasonal trends, recurring problems)
3. Connect categories to geography (erosion near creeks, graffiti near parking lots, etc.)
4. Recommend specific, actionable preventive measures
5. Use GIS terminology naturally to help the field worker learn

Keep your analysis concise but insightful -- 3-5 paragraphs max. Be specific to the SSPR district context.`;

    const userMessage = `Here are ${issues.length} maintenance issues to analyze:

BREAKDOWN:
- Categories: ${catBreakdown}
- Severity: ${sevBreakdown}

ISSUES:
${issuesSummary}

QUESTION: ${question}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const analysis = response.content[0].type === "text"
      ? response.content[0].text
      : "Unable to generate analysis.";

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Analyze API error:", error);
    return NextResponse.json(
      { error: "Analysis failed" },
      { status: 500 }
    );
  }
}
