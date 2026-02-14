import { NextResponse } from "next/server";
import { upsertLessonProgress, fetchLessonProgress } from "@/lib/spatialService";

/**
 * GET /api/progress
 * Fetch all lesson progress records.
 */
export async function GET() {
  try {
    const rows = await fetchLessonProgress();
    return NextResponse.json({ progress: rows });
  } catch (error) {
    console.error("Progress GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/progress
 * Upsert lesson progress.
 * Body: { lessonId, status, startedAt?, completedAt?, quizScore?, quizTotal?, exerciseCompleted?, notes? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.lessonId) {
      return NextResponse.json({ error: "lessonId required" }, { status: 400 });
    }

    await upsertLessonProgress({
      lessonId: body.lessonId,
      status: body.status || "in_progress",
      startedAt: body.startedAt,
      completedAt: body.completedAt,
      quizScore: body.quizScore,
      quizTotal: body.quizTotal,
      exerciseCompleted: body.exerciseCompleted,
      notes: body.notes,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Progress POST error:", error);
    return NextResponse.json(
      { error: "Failed to update progress" },
      { status: 500 }
    );
  }
}
