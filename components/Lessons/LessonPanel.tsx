"use client";

import { useState, useCallback, useEffect } from "react";
import { LESSONS } from "@/lib/lessons";
import { Lesson, LayerVisibility, OverlayLayerId, LessonProgress } from "@/lib/types";

interface LessonPanelProps {
  currentLesson: number | null;
  onLessonSelect: (lessonId: number | null) => void;
  onClose: () => void;
  layerVisibility: LayerVisibility;
  onLayerToggle: (layerId: OverlayLayerId) => void;
  onMapAction?: (action: string) => void;
  progress?: Record<number, LessonProgress>;
  onProgressUpdate?: (lessonId: number, update: Partial<LessonProgress>) => void;
}

type TabId = "lessons" | "concept" | "ecology" | "exercise" | "vocab" | "quiz";

export function LessonPanel({
  currentLesson,
  onLessonSelect,
  onClose,
  onMapAction,
  progress = {},
  onProgressUpdate,
}: LessonPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("lessons");
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);

  const lesson = currentLesson !== null ? LESSONS.find((l) => l.id === currentLesson) : null;

  const handleLessonClick = (lessonId: number) => {
    onLessonSelect(lessonId);
    setActiveTab("concept");
    setQuizAnswers({});
    setShowQuizResults(false);
    // Mark lesson as started if not already
    const p = progress[lessonId];
    if (!p || p.status === "not_started") {
      onProgressUpdate?.(lessonId, {
        status: "in_progress",
        startedAt: new Date().toISOString(),
      });
    }
  };

  const handleBack = () => {
    onLessonSelect(null);
    setActiveTab("lessons");
    setQuizAnswers({});
    setShowQuizResults(false);
  };

  const handleQuizAnswer = (questionId: string, answerIndex: number) => {
    setQuizAnswers((prev) => ({ ...prev, [questionId]: answerIndex }));
  };

  const handleSubmitQuiz = () => {
    setShowQuizResults(true);
    if (lesson) {
      const score = lesson.quiz.filter((q) => quizAnswers[q.id] === q.correctIndex).length;
      onProgressUpdate?.(lesson.id, {
        quizScore: score,
        quizTotal: lesson.quiz.length,
      });
      // If scored 100%, mark completed
      if (score === lesson.quiz.length) {
        onProgressUpdate?.(lesson.id, {
          status: "completed",
          completedAt: new Date().toISOString(),
          quizScore: score,
          quizTotal: lesson.quiz.length,
        });
      }
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-white">
            {lesson ? `Lesson ${lesson.id}` : "GIS Lessons"}
          </h2>
          <p className="text-xs text-white/50">
            {lesson ? lesson.title : "GIS Field Fundamentals"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {lesson && (
            <button
              onClick={handleBack}
              className="rounded-md p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Back to lesson list"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close panel"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {!lesson ? (
        <LessonList onSelect={handleLessonClick} progress={progress} />
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex border-b border-sidebar-border overflow-x-auto">
            {[
              { id: "concept" as TabId, label: "GIS" },
              { id: "ecology" as TabId, label: "Field" },
              { id: "exercise" as TabId, label: "Exercise" },
              { id: "vocab" as TabId, label: "Vocab" },
              { id: "quiz" as TabId, label: "Quiz" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-trail-gold border-b-2 border-trail-gold"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto lesson-scrollbar p-4">
            {activeTab === "concept" && <ConceptTab lesson={lesson} />}
            {activeTab === "ecology" && <EcologyTab lesson={lesson} />}
            {activeTab === "exercise" && (
              <ExerciseTab
                lesson={lesson}
                onMapAction={onMapAction}
                onExerciseComplete={() => {
                  onProgressUpdate?.(lesson.id, { exerciseCompleted: true });
                }}
              />
            )}
            {activeTab === "vocab" && <VocabTab lesson={lesson} />}
            {activeTab === "quiz" && (
              <QuizTab
                lesson={lesson}
                answers={quizAnswers}
                showResults={showQuizResults}
                onAnswer={handleQuizAnswer}
                onSubmit={handleSubmitQuiz}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function LessonList({ onSelect, progress }: { onSelect: (id: number) => void; progress: Record<number, LessonProgress> }) {
  const completedCount = Object.values(progress).filter((p) => p.status === "completed").length;
  const totalAvailable = LESSONS.length;

  return (
    <div className="flex-1 overflow-y-auto lesson-scrollbar p-4 space-y-2">
      <p className="text-xs text-white/40 mb-1">
        {totalAvailable} lessons teaching GIS through hands-on maintenance work.
      </p>
      {totalAvailable > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
            <span>{completedCount} / {totalAvailable} completed</span>
            <span>{Math.round((completedCount / totalAvailable) * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-trail-gold transition-all duration-500"
              style={{ width: `${(completedCount / totalAvailable) * 100}%` }}
            />
          </div>
        </div>
      )}
      {LESSONS.map((lesson) => {
        const p = progress[lesson.id];
        const status = p?.status || "not_started";
        return (
          <button
            key={lesson.id}
            onClick={() => onSelect(lesson.id)}
            className="w-full text-left rounded-lg bg-white/5 p-3 hover:bg-white/10 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                status === "completed"
                  ? "bg-green-500/20 text-green-400"
                  : status === "in_progress"
                  ? "bg-trail-gold/20 text-trail-gold"
                  : "bg-trail-green/20 text-trail-gold group-hover:bg-trail-green/30"
              }`}>
                {status === "completed" ? "\u2713" : lesson.id}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-white">{lesson.title}</h3>
                <p className="text-xs text-white/50 mt-0.5">{lesson.subtitle}</p>
                {p?.quizScore !== undefined && p?.quizScore !== null && (
                  <p className="text-[10px] text-white/30 mt-0.5">
                    Quiz: {p.quizScore}/{p.quizTotal}
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}

      {/* Placeholder for lessons 11-12 (not yet implemented) */}
      {[11, 12].map((id) => (
        <div
          key={id}
          className="w-full rounded-lg bg-white/[0.02] p-3 opacity-40 cursor-not-allowed"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/30">
              {id}
            </span>
            <div>
              <h3 className="text-sm font-medium text-white/40">Coming in Phase 4</h3>
              <p className="text-xs text-white/20 mt-0.5">Not yet available</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ConceptTab({ lesson }: { lesson: Lesson }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {lesson.gisConcepts.map((concept) => (
          <span
            key={concept}
            className="rounded-full bg-trail-green/20 px-2.5 py-0.5 text-xs font-medium text-trail-gold"
          >
            {concept}
          </span>
        ))}
      </div>
      <div className="prose-sm text-white/80 leading-relaxed text-sm space-y-3">
        {lesson.conceptContent.split("\n\n").map((paragraph, i) => (
          <p key={i} dangerouslySetInnerHTML={{
            __html: paragraph.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
          }} />
        ))}
      </div>
    </div>
  );
}

function EcologyTab({ lesson }: { lesson: Lesson }) {
  return (
    <div>
      <div className="mb-3 rounded-lg bg-eco-riparian/10 px-3 py-2 border border-eco-riparian/20">
        <p className="text-xs font-semibold text-eco-riparian uppercase tracking-wider">
          Why This Matters for Your Job
        </p>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {lesson.fieldConcepts.map((concept) => (
          <span
            key={concept}
            className="rounded-full bg-eco-riparian/15 px-2.5 py-0.5 text-xs font-medium text-eco-riparian"
          >
            {concept}
          </span>
        ))}
      </div>
      <div className="text-white/80 leading-relaxed text-sm space-y-3">
        {lesson.fieldContent.split("\n\n").map((paragraph, i) => (
          <p key={i} dangerouslySetInnerHTML={{
            __html: paragraph.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
          }} />
        ))}
      </div>
    </div>
  );
}

function ExerciseTab({ lesson, onMapAction, onExerciseComplete }: { lesson: Lesson; onMapAction?: (action: string) => void; onExerciseComplete?: () => void }) {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const handleStepAction = (step: number, action?: string) => {
    if (action && onMapAction) {
      onMapAction(action);
    }
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(step);
      // If all steps done, notify parent
      if (next.size === lesson.exerciseSteps.length) {
        onExerciseComplete?.();
      }
      return next;
    });
  };

  return (
    <div>
      <div className="mb-3 rounded-lg bg-trail-gold/10 px-3 py-2 border border-trail-gold/20">
        <p className="text-xs font-semibold text-trail-gold uppercase tracking-wider">
          Hands-On Map Exercise
        </p>
        <p className="text-xs text-white/40 mt-1">
          {completedSteps.size} / {lesson.exerciseSteps.length} steps completed
        </p>
      </div>
      <div className="space-y-3">
        {lesson.exerciseSteps.map((step) => {
          const isCompleted = completedSteps.has(step.step);
          return (
            <div key={step.step} className={`flex gap-3 ${isCompleted ? "opacity-60" : ""}`}>
              <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                isCompleted
                  ? "bg-green-500/30 text-green-300"
                  : "bg-trail-gold/20 text-trail-gold"
              }`}>
                {isCompleted ? "\u2713" : step.step}
              </span>
              <div className="flex-1">
                <p className="text-sm text-white/80 leading-relaxed">
                  {step.instruction}
                </p>
                {step.mapAction && !isCompleted && (
                  <button
                    onClick={() => handleStepAction(step.step, step.mapAction)}
                    className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-trail-gold/15 px-2.5 py-1 text-xs font-medium text-trail-gold hover:bg-trail-gold/25 transition-colors border border-trail-gold/20"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                    Apply to Map
                  </button>
                )}
                {!step.mapAction && !isCompleted && (
                  <button
                    onClick={() => handleStepAction(step.step)}
                    className="mt-1.5 text-xs text-white/30 hover:text-white/50 transition-colors"
                  >
                    Mark complete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VocabTab({ lesson }: { lesson: Lesson }) {
  return (
    <div className="space-y-3">
      {lesson.vocabulary.map((item) => (
        <div
          key={item.term}
          className="rounded-lg bg-white/5 p-3"
        >
          <dt className="text-sm font-semibold text-trail-gold">{item.term}</dt>
          <dd className="mt-1 text-xs text-white/70 leading-relaxed">
            {item.definition}
          </dd>
        </div>
      ))}
    </div>
  );
}

function QuizTab({
  lesson,
  answers,
  showResults,
  onAnswer,
  onSubmit,
}: {
  lesson: Lesson;
  answers: Record<string, number>;
  showResults: boolean;
  onAnswer: (questionId: string, answerIndex: number) => void;
  onSubmit: () => void;
}) {
  const allAnswered = lesson.quiz.every((q) => answers[q.id] !== undefined);
  const score = showResults
    ? lesson.quiz.filter((q) => answers[q.id] === q.correctIndex).length
    : 0;

  return (
    <div>
      <div className="mb-4 rounded-lg bg-white/5 px-3 py-2">
        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">
          Knowledge Check
        </p>
        {showResults && (
          <p className="text-sm font-bold mt-1" style={{ color: score === lesson.quiz.length ? "#4ade80" : score > 0 ? "#facc15" : "#ef4444" }}>
            {score} / {lesson.quiz.length} correct
          </p>
        )}
      </div>

      <div className="space-y-5">
        {lesson.quiz.map((q, qi) => {
          const answered = answers[q.id] !== undefined;
          const isCorrect = answers[q.id] === q.correctIndex;

          return (
            <div key={q.id}>
              <p className="text-sm font-medium text-white mb-2">
                {qi + 1}. {q.question}
              </p>
              <div className="space-y-1.5">
                {q.options.map((option, oi) => {
                  const isSelected = answers[q.id] === oi;
                  const isCorrectOption = oi === q.correctIndex;

                  let optionClass =
                    "w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ";
                  if (showResults) {
                    if (isCorrectOption) {
                      optionClass += "bg-green-500/20 text-green-300 border border-green-500/30";
                    } else if (isSelected && !isCorrectOption) {
                      optionClass += "bg-red-500/20 text-red-300 border border-red-500/30";
                    } else {
                      optionClass += "bg-white/5 text-white/40 border border-transparent";
                    }
                  } else {
                    optionClass += isSelected
                      ? "bg-trail-green/30 text-white border border-trail-green/50"
                      : "bg-white/5 text-white/70 hover:bg-white/10 border border-transparent";
                  }

                  return (
                    <button
                      key={oi}
                      onClick={() => !showResults && onAnswer(q.id, oi)}
                      disabled={showResults}
                      className={optionClass}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {showResults && (
                <p className="mt-2 text-xs text-white/50 italic leading-relaxed">
                  {q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!showResults && (
        <button
          onClick={onSubmit}
          disabled={!allAnswered}
          className="mt-4 w-full rounded-lg bg-trail-green py-2.5 text-sm font-medium text-white hover:bg-trail-green-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Check Answers
        </button>
      )}

      {showResults && (
        <ThinkPrompt lessonId={lesson.id} lessonTitle={lesson.title} score={score} total={lesson.quiz.length} />
      )}
    </div>
  );
}

function ThinkPrompt({ lessonId, lessonTitle, score, total }: { lessonId: number; lessonTitle: string; score: number; total: number }) {
  const [thinkQuestion, setThinkQuestion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);

  const fetchThinkPrompt = useCallback(async () => {
    setIsLoading(true);
    setHasRequested(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `I just completed the quiz for Lesson ${lessonId}: "${lessonTitle}" and scored ${score}/${total}. Generate a single "Field Insight" reflection question that connects the GIS concepts from this lesson to my daily maintenance work in the SSPR district. Make it practical and specific to situations I'd encounter on the trails. Keep it to 2-3 sentences max -- just the question, no preamble.`,
          mapContext: { currentLesson: lessonId },
        }),
      });
      const data = await response.json();
      setThinkQuestion(data.reply || "How might the concepts from this lesson change the way you observe the landscape next time you visit a local trail?");
    } catch {
      setThinkQuestion("How might the concepts from this lesson change the way you observe the landscape next time you visit a local trail?");
    } finally {
      setIsLoading(false);
    }
  }, [lessonId, lessonTitle, score, total]);

  return (
    <div className="mt-5 rounded-lg bg-eco-riparian/10 p-3 border border-eco-riparian/20">
      <div className="flex items-center gap-2 mb-2">
        <svg className="h-4 w-4 text-eco-riparian" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <h4 className="text-xs font-semibold text-eco-riparian uppercase tracking-wider">
          Field Insight
        </h4>
      </div>
      {!hasRequested ? (
        <button
          onClick={fetchThinkPrompt}
          className="w-full rounded-md bg-eco-riparian/15 py-2 text-xs font-medium text-eco-riparian hover:bg-eco-riparian/25 transition-colors border border-eco-riparian/20"
        >
          Generate a reflection question
        </button>
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-eco-riparian/60">
          <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-eco-riparian" />
          <span className="text-xs">Thinking...</span>
        </div>
      ) : (
        <p className="text-sm text-white/80 leading-relaxed italic">
          {thinkQuestion}
        </p>
      )}
    </div>
  );
}
