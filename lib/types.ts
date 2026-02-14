// ============================================================
// GIS Feature Types
// ============================================================

export interface Trail {
  id: string;
  name: string;
  letterCode: string;
  lengthMiles: number;
  surface: string;
  difficulty: string;
  gridStart: string;
  gridEnd: string;
  watershed: string;
  riparianProximity: string;
  habitatCorridor: boolean;
  description: string;
}

export interface Park {
  id: string;
  mapNumber: number;
  name: string;
  category: string;
  ecologicalClass: string;
  amenities: string[];
  gridRef: string;
  areaAcres: number | null;
  description: string;
}

export interface Waterway {
  id: string;
  name: string;
  type: string; // river, creek, canal, reservoir, lake, gulch
  streamOrder: number | null;
  watershed: string;
}

export interface Boundary {
  id: string;
  name: string;
  type: string; // district, municipal, county
}

// ============================================================
// Maintenance Issue Types (field worker categories)
// ============================================================

export type IssueCategory =
  | "graffiti"           // Tagging, vandalism on structures, benches, signs
  | "snow_ice"           // Snow accumulation, ice patches, freeze-thaw damage
  | "parking_lot"        // Potholes, drainage, striping, ADA compliance
  | "erosion"            // Trail washout, bank erosion, drainage failures, sediment
  | "trail_surface"      // Cracking, root heave, settling, ponding water
  | "vegetation"         // Overgrowth, fallen trees, dead limbs, sight-line blockage
  | "signage"            // Damaged, missing, vandalized, faded signs
  | "infrastructure"     // Benches, railings, bridges, fences, lighting
  | "trash_dumping"      // Illegal dumping, overflowing bins, litter
  | "safety";            // Broken glass, unstable ground, flooding, wildlife hazard

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = {
  graffiti: "Graffiti / Vandalism",
  snow_ice: "Snow / Ice",
  parking_lot: "Parking Lot",
  erosion: "Erosion / Washout",
  trail_surface: "Trail Surface",
  vegetation: "Vegetation",
  signage: "Signage",
  infrastructure: "Infrastructure",
  trash_dumping: "Trash / Dumping",
  safety: "Safety Hazard",
};

export const ISSUE_CATEGORY_ICONS: Record<IssueCategory, string> = {
  graffiti: "spray-can",
  snow_ice: "snowflake",
  parking_lot: "parking",
  erosion: "water",
  trail_surface: "road",
  vegetation: "tree",
  signage: "sign",
  infrastructure: "wrench",
  trash_dumping: "trash",
  safety: "alert-triangle",
};

export type IssueSeverity = "low" | "medium" | "high" | "critical";
export type IssueStatus = "reported" | "assigned" | "in_progress" | "resolved";
export type IssueSource = "citizen" | "field_entry" | "simulated" | "ai_suggested";

export interface MaintenanceIssue {
  id: string;
  latitude: number;
  longitude: number;
  trailId: string | null;
  parkId: string | null;
  category: IssueCategory;
  severity: IssueSeverity;
  status: IssueStatus;
  title: string;
  description: string;
  photoUrl: string | null;
  reportedAt: string;
  resolvedAt: string | null;
  assignedTo: string | null;
  reporter: string;
  source: IssueSource;
  fieldNotes: string | null;
  aiAnalysis: string | null;
}

// ============================================================
// Mobile App Navigation
// ============================================================

export type MobileTab = "map" | "report" | "tasks" | "stats" | "learn";

// ============================================================
// Field Tip Types
// ============================================================

export interface FieldTip {
  id: string;
  message: string;
  lessonId: number | null;
  trigger: string; // what action triggered this tip
}

// ============================================================
// Lesson Types
// ============================================================

export type LessonStatus = "not_started" | "in_progress" | "completed";

export interface VocabularyTerm {
  term: string;
  definition: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ExerciseStep {
  step: number;
  instruction: string;
  mapAction?: string; // Optional action to trigger on the map
}

export interface Lesson {
  id: number;
  title: string;
  subtitle: string;
  gisConcepts: string[];
  fieldConcepts: string[];       // renamed from ecologyConcepts
  conceptContent: string;
  fieldContent: string;          // renamed from ecologyContent ("Why It Matters" for your job)
  exerciseSteps: ExerciseStep[];
  vocabulary: VocabularyTerm[];
  quiz: QuizQuestion[];
  requiredLayers: string[];
}

export interface LessonProgress {
  lessonId: number;
  status: LessonStatus;
  startedAt: string | null;
  completedAt: string | null;
  quizScore: number | null;
  quizTotal: number | null;
  exerciseCompleted: boolean;
  notes: string;
}

// ============================================================
// Map Types
// ============================================================

export type BasemapId = "osm" | "arcgis-topo" | "esri-satellite" | "mapbox-outdoors" | "mapbox-satellite";

export interface BasemapOption {
  id: BasemapId;
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
}

export type OverlayLayerId =
  | "trails"
  | "parks"
  | "waterways"
  | "district-boundary"
  | "municipal-boundaries"
  | "maintenance-issues"
  | "riparian-buffers"
  | "heatmap";

export interface LayerVisibility {
  trails: boolean;
  parks: boolean;
  waterways: boolean;
  "district-boundary": boolean;
  "municipal-boundaries": boolean;
  "maintenance-issues": boolean;
  "riparian-buffers": boolean;
  heatmap: boolean;
}

// ============================================================
// Chat Types
// ============================================================

export interface FeatureReference {
  id: string;
  displayName: string;
  featureType: "trail" | "park" | "waterway" | "issue";
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  featureReferences?: FeatureReference[];
}

// ============================================================
// App State
// ============================================================

export interface MapContext {
  visibleLayers: string[];
  selectedFeature: { type: string; id: string; name: string } | null;
  currentLesson: number | null;
  zoomLevel: number;
  center: [number, number];
}
