"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { MapWrapper } from "@/components/Map/MapWrapper";
import { ChatWidget } from "@/components/ChatWidget";
import { LessonPanel } from "@/components/Lessons/LessonPanel";
import { QuickReport } from "@/components/Maintenance/QuickReport";
import { WorkQueue } from "@/components/Maintenance/WorkQueue";
import { IssueDetail } from "@/components/Maintenance/IssueDetail";
import { StatsPanel, StatsFilter } from "@/components/Maintenance/StatsPanel";
import { MobileNav } from "@/components/MobileNav";
import { FieldTipBanner, useFieldTips } from "@/components/FieldTip";
import { DEFAULT_LAYER_VISIBILITY, SSPR_CENTER, SSPR_DEFAULT_ZOOM } from "@/lib/mapConfig";
import { LayerVisibility, OverlayLayerId, MobileTab, MaintenanceIssue, IssueStatus, LessonProgress } from "@/lib/types";

import _maintenanceData from "@/data/seed/maintenance-issues.json";

interface GeoJSONFeature {
  properties: Record<string, unknown>;
  geometry: { coordinates: [number, number] };
}

// Load seed maintenance issues
function loadMaintenanceIssues(): MaintenanceIssue[] {
  const data = _maintenanceData as unknown as { features: GeoJSONFeature[] };
  return data.features.map((f) => ({
    ...(f.properties as unknown as MaintenanceIssue),
    latitude: f.geometry.coordinates[1],
    longitude: f.geometry.coordinates[0],
  }));
}

export default function HomePage() {
  const [layerVisibility, setLayerVisibility] =
    useState<LayerVisibility>(DEFAULT_LAYER_VISIBILITY);
  const [selectedFeature, setSelectedFeature] = useState<{
    type: string;
    id: string;
    name: string;
  } | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [currentLesson, setCurrentLesson] = useState<number | null>(null);
  const [isLessonPanelOpen, setIsLessonPanelOpen] = useState(true);
  const [highlightFeatureId, setHighlightFeatureId] = useState<string | null>(
    null
  );

  // Mobile state
  const [mobileTab, setMobileTab] = useState<MobileTab>("map");
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Maintenance issues (in-memory, seeded from GeoJSON)
  const [issues, setIssues] = useState<MaintenanceIssue[]>(
    loadMaintenanceIssues
  );

  // Issue detail view
  const [selectedIssue, setSelectedIssue] = useState<MaintenanceIssue | null>(null);

  // Map fly-to target
  const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  // Desktop right panel tab
  const [desktopRightPanel, setDesktopRightPanel] = useState<"none" | "report" | "tasks" | "detail" | "stats">("none");

  // Drilldown filter (from Stats -> Tasks navigation)
  const [drilldownFilter, setDrilldownFilter] = useState<StatsFilter | null>(null);

  // Field tips
  const { currentTip, triggerFieldTip, dismissTip } = useFieldTips();

  // Lesson progress
  const [lessonProgress, setLessonProgress] = useState<Record<number, LessonProgress>>({});

  // Try to get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          // Silent fail -- location not required
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    }
  }, []);

  // Count open issues for badge
  const openIssueCount = useMemo(
    () => issues.filter((i) => i.status !== "resolved").length,
    [issues]
  );

  const handleLayerToggle = useCallback(
    (layerId: OverlayLayerId) => {
      setLayerVisibility((prev) => ({
        ...prev,
        [layerId]: !prev[layerId],
      }));
      triggerFieldTip("layer-toggle");
      if (layerId === "maintenance-issues") {
        triggerFieldTip("maintenance-layer-on");
      }
    },
    [triggerFieldTip]
  );

  const handleMapAction = useCallback(
    (action: string) => {
      switch (action) {
        case "all-layers-on":
          setLayerVisibility((prev) => ({
            ...prev,
            trails: true,
            parks: true,
            waterways: true,
            "district-boundary": true,
            "maintenance-issues": true,
          }));
          triggerFieldTip("all-layers-on");
          break;
        case "all-layers-off":
          setLayerVisibility((prev) => ({
            ...prev,
            trails: false,
            parks: false,
            waterways: false,
            "district-boundary": false,
            "maintenance-issues": false,
          }));
          break;
        case "toggle-trails":
          setLayerVisibility((prev) => ({ ...prev, trails: !prev.trails }));
          break;
        case "toggle-parks":
          setLayerVisibility((prev) => ({ ...prev, parks: !prev.parks }));
          break;
        case "toggle-waterways":
          setLayerVisibility((prev) => ({
            ...prev,
            waterways: !prev.waterways,
          }));
          break;
        case "waterways-only":
          setLayerVisibility((prev) => ({
            ...prev,
            trails: false,
            parks: false,
            waterways: true,
            "district-boundary": false,
            "maintenance-issues": false,
          }));
          break;
        case "trails-and-waterways":
          setLayerVisibility((prev) => ({
            ...prev,
            trails: true,
            parks: false,
            waterways: true,
            "district-boundary": false,
            "maintenance-issues": false,
          }));
          break;
        case "parks-only":
          setLayerVisibility((prev) => ({
            ...prev,
            trails: false,
            parks: true,
            waterways: false,
            "district-boundary": true,
            "maintenance-issues": false,
          }));
          break;
        case "trails-only":
          setLayerVisibility((prev) => ({
            ...prev,
            trails: true,
            parks: false,
            waterways: false,
            "district-boundary": false,
            "maintenance-issues": false,
          }));
          break;
        default:
          break;
      }
    },
    [triggerFieldTip]
  );

  const handleFeatureSelect = useCallback(
    (feature: { type: string; id: string; name: string } | null) => {
      setSelectedFeature(feature);
      // If an issue was clicked on the map, open its detail panel
      if (feature?.type === "issue") {
        const issue = issues.find((i) => i.id === feature.id);
        if (issue) {
          setSelectedIssue(issue);
          setDesktopRightPanel("detail");
          // On mobile, switch to tasks tab to show the detail
          setMobileTab("tasks");
        }
      }
    },
    [issues]
  );

  const handleFeatureHighlight = useCallback((featureId: string | null) => {
    setHighlightFeatureId(featureId);
  }, []);

  const handleReportSubmit = useCallback(
    (
      issue: Omit<
        MaintenanceIssue,
        "id" | "reportedAt" | "resolvedAt" | "aiAnalysis"
      >
    ) => {
      const newIssue: MaintenanceIssue = {
        ...issue,
        id: `mi-new-${Date.now()}`,
        reportedAt: new Date().toISOString(),
        resolvedAt: null,
        aiAnalysis: null,
      };
      setIssues((prev) => [newIssue, ...prev]);
      // Persist to API (fire-and-forget)
      fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(issue),
      }).catch(() => {});
    },
    []
  );

  const handleIssueSelect = useCallback(
    (issue: MaintenanceIssue) => {
      setSelectedFeature({
        type: "issue",
        id: issue.id,
        name: issue.title,
      });
      setSelectedIssue(issue);
      // Fly map to the issue location
      setFlyToTarget({ lat: issue.latitude, lng: issue.longitude, zoom: 16 });
      // Switch to map tab on mobile
      setMobileTab("map");
      // Make sure maintenance layer is visible
      setLayerVisibility((prev) => ({
        ...prev,
        "maintenance-issues": true,
      }));
      setHighlightFeatureId(issue.id);
      // On desktop, show detail panel
      setDesktopRightPanel("detail");
    },
    []
  );

  const handleShowOnMap = useCallback(
    (issue: MaintenanceIssue) => {
      setFlyToTarget({ lat: issue.latitude, lng: issue.longitude, zoom: 17 });
      setMobileTab("map");
      setLayerVisibility((prev) => ({
        ...prev,
        "maintenance-issues": true,
      }));
      setHighlightFeatureId(issue.id);
    },
    []
  );

  const handleIssueStatusUpdate = useCallback(
    (issueId: string, newStatus: IssueStatus, fieldNotes?: string) => {
      setIssues((prev) =>
        prev.map((i) => {
          if (i.id !== issueId) return i;
          return {
            ...i,
            status: newStatus,
            fieldNotes: fieldNotes !== undefined ? fieldNotes : i.fieldNotes,
            resolvedAt: newStatus === "resolved" ? new Date().toISOString() : i.resolvedAt,
            assignedTo:
              newStatus === "assigned" && !i.assignedTo
                ? "Field Worker"
                : i.assignedTo,
          };
        })
      );
      // Update the selected issue if it's the one being changed
      setSelectedIssue((prev) => {
        if (!prev || prev.id !== issueId) return prev;
        return {
          ...prev,
          status: newStatus,
          fieldNotes: fieldNotes !== undefined ? fieldNotes : prev.fieldNotes,
          resolvedAt: newStatus === "resolved" ? new Date().toISOString() : prev.resolvedAt,
          assignedTo:
            newStatus === "assigned" && !prev.assignedTo
              ? "Field Worker"
              : prev.assignedTo,
        };
      });
      // Persist to API (fire-and-forget)
      const updates: Record<string, unknown> = { id: issueId, status: newStatus };
      if (fieldNotes !== undefined) updates.fieldNotes = fieldNotes;
      if (newStatus === "assigned") updates.assignedTo = "Field Worker";
      fetch("/api/maintenance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }).catch(() => {});
    },
    []
  );

  const handleCloseIssueDetail = useCallback(() => {
    setSelectedIssue(null);
    setDesktopRightPanel("none");
  }, []);

  const handleLessonProgressUpdate = useCallback(
    (lessonId: number, update: Partial<LessonProgress>) => {
      setLessonProgress((prev) => {
        const existing = prev[lessonId] || {
          lessonId,
          status: "not_started" as const,
          startedAt: null,
          completedAt: null,
          quizScore: null,
          quizTotal: null,
          exerciseCompleted: false,
          notes: "",
        };
        return { ...prev, [lessonId]: { ...existing, ...update } };
      });
      // Persist to Supabase (fire-and-forget)
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, ...update }),
      }).catch(() => {});
    },
    []
  );

  // Handle drilldown from Stats to Tasks with pre-applied filter
  const handleStatsDrillDown = useCallback(
    (filter: StatsFilter) => {
      setDrilldownFilter(filter);
      setSelectedIssue(null);
      // Navigate to tasks view
      setDesktopRightPanel("tasks");
      setMobileTab("tasks");
    },
    []
  );

  const handleClearDrilldown = useCallback(() => {
    setDrilldownFilter(null);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ======= DESKTOP: Lesson Panel Sidebar ======= */}
      {isLessonPanelOpen && (
        <aside className="hidden md:flex md:w-80 md:flex-col md:flex-shrink-0 bg-sidebar-bg border-r border-sidebar-border overflow-hidden">
          <LessonPanel
            currentLesson={currentLesson}
            onLessonSelect={setCurrentLesson}
            onClose={() => setIsLessonPanelOpen(false)}
            layerVisibility={layerVisibility}
            onLayerToggle={handleLayerToggle}
            onMapAction={handleMapAction}
            progress={lessonProgress}
            onProgressUpdate={handleLessonProgressUpdate}
          />
        </aside>
      )}

      {/* ======= Main Content ======= */}
      <main className="relative flex-1 flex flex-col">
        {/* Header Bar */}
        <header className="flex items-center justify-between bg-trail-green-dark px-3 py-2 z-10 safe-area-top">
          <div className="flex items-center gap-3">
            {!isLessonPanelOpen && (
              <button
                onClick={() => setIsLessonPanelOpen(true)}
                className="hidden md:block p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Open lesson panel"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            )}
            <div>
              <h1 className="text-sm md:text-base font-semibold text-white tracking-wide">
                SSPR Trail Explorer
              </h1>
              <p className="text-[10px] md:text-xs text-white/60">
                Field Maintenance & GIS Learning
                {currentLesson !== null && (
                  <span className="ml-2 text-trail-gold">
                    Lesson {currentLesson}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedFeature && (
              <div className="hidden sm:flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                <span className="capitalize">{selectedFeature.type}:</span>
                <span className="font-medium text-white">
                  {selectedFeature.name}
                </span>
                <button
                  onClick={() => setSelectedFeature(null)}
                  className="ml-1 text-white/50 hover:text-white"
                >
                  &times;
                </button>
              </div>
            )}
            {/* Home Button -- resets to default map view */}
            <button
              onClick={() => {
                setMobileTab("map");
                setSelectedFeature(null);
                setSelectedIssue(null);
                setCurrentLesson(null);
                setDesktopRightPanel("none");
                setIsChatOpen(false);
                setDrilldownFilter(null);
                setFlyToTarget({
                  lat: SSPR_CENTER[0],
                  lng: SSPR_CENTER[1],
                  zoom: SSPR_DEFAULT_ZOOM,
                });
              }}
              className="flex items-center justify-center rounded-lg p-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors min-h-[36px] min-w-[36px]"
              aria-label="Home - return to default view"
              title="Home"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
            {/* Desktop Report Panel Toggle */}
            <button
              onClick={() => {
                setDesktopRightPanel((prev) =>
                  prev === "report" ? "none" : "report"
                );
                setIsChatOpen(false);
              }}
              className={`hidden md:flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors min-h-[36px] ${
                desktopRightPanel === "report"
                  ? "bg-trail-gold text-trail-green-dark"
                  : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Report</span>
            </button>
            {/* Desktop Tasks Panel Toggle */}
            <button
              onClick={() => {
                setDesktopRightPanel((prev) =>
                  prev === "tasks" ? "none" : "tasks"
                );
                setIsChatOpen(false);
              }}
              className={`hidden md:flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors min-h-[36px] ${
                desktopRightPanel === "tasks"
                  ? "bg-trail-gold text-trail-green-dark"
                  : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>Tasks</span>
              {openIssueCount > 0 && (
                <span className="ml-0.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                  {openIssueCount}
                </span>
              )}
            </button>
            {/* Desktop Stats Toggle */}
            <button
              onClick={() => {
                setDesktopRightPanel((prev) =>
                  prev === "stats" ? "none" : "stats"
                );
                setIsChatOpen(false);
              }}
              className={`hidden md:flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors min-h-[36px] ${
                desktopRightPanel === "stats"
                  ? "bg-trail-gold text-trail-green-dark"
                  : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Stats</span>
            </button>
            <button
              onClick={() => {
                setIsChatOpen(true);
                setDesktopRightPanel("none"); // close side panel when opening chat
              }}
              className="flex items-center gap-2 rounded-lg bg-trail-green px-3 py-1.5 text-sm font-medium text-white hover:bg-trail-green/80 transition-colors min-h-[36px]"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              <span className="hidden sm:inline">Field Coach</span>
            </button>
          </div>
        </header>

        {/* ======= Content Area (tab-based on mobile) ======= */}
        <div className="flex-1 relative overflow-hidden">
          {/* Map -- always rendered, hidden on mobile when other tabs are active */}
          <div
            className={`absolute inset-0 ${
              mobileTab === "map" ? "block" : "hidden md:block"
            }`}
          >
            <MapWrapper
              layerVisibility={layerVisibility}
              onLayerToggle={handleLayerToggle}
              onFeatureSelect={handleFeatureSelect}
              highlightFeatureId={highlightFeatureId}
              flyTo={flyToTarget}
            />
          </div>

          {/* Report Tab (mobile) */}
          {mobileTab === "report" && (
            <div className="md:hidden absolute inset-0 bg-sidebar-bg overflow-y-auto pb-20">
              <QuickReport
                onSubmit={handleReportSubmit}
                onFieldTip={triggerFieldTip}
              />
            </div>
          )}

          {/* Tasks Tab (mobile) */}
          {mobileTab === "tasks" && (
            <div className="md:hidden absolute inset-0 bg-sidebar-bg overflow-hidden pb-20">
              {selectedIssue ? (
                <IssueDetail
                  issue={selectedIssue}
                  onClose={() => setSelectedIssue(null)}
                  onShowOnMap={handleShowOnMap}
                  onStatusUpdate={handleIssueStatusUpdate}
                  onFieldTip={triggerFieldTip}
                />
              ) : (
                <WorkQueue
                  issues={issues}
                  userLocation={userLocation}
                  onIssueSelect={handleIssueSelect}
                  onFieldTip={triggerFieldTip}
                  initialStatus={drilldownFilter?.status}
                  initialSeverity={drilldownFilter?.severity}
                  initialCategory={drilldownFilter?.category}
                  initialMonths={drilldownFilter?.months}
                  filterLabel={drilldownFilter?.label}
                  onClearFilter={handleClearDrilldown}
                />
              )}
            </div>
          )}

          {/* Stats Tab (mobile) */}
          {mobileTab === "stats" && (
            <div className="md:hidden absolute inset-0 bg-sidebar-bg overflow-hidden pb-20">
              <StatsPanel
                issues={issues}
                onClose={() => setMobileTab("map")}
                onDrillDown={handleStatsDrillDown}
              />
            </div>
          )}

          {/* Learn Tab (mobile) */}
          {mobileTab === "learn" && (
            <div className="md:hidden absolute inset-0 bg-sidebar-bg overflow-y-auto pb-20">
              <LessonPanel
                currentLesson={currentLesson}
                onLessonSelect={setCurrentLesson}
                onClose={() => setMobileTab("map")}
                layerVisibility={layerVisibility}
                onLayerToggle={handleLayerToggle}
                onMapAction={handleMapAction}
                progress={lessonProgress}
                onProgressUpdate={handleLessonProgressUpdate}
              />
            </div>
          )}
        </div>
      </main>

      {/* ======= DESKTOP: Right Panel (Report / Tasks / Issue Detail / Stats) ======= */}
      {desktopRightPanel !== "none" && (
        <aside className="hidden md:flex md:w-96 md:flex-col md:flex-shrink-0 bg-sidebar-bg border-l border-sidebar-border overflow-hidden">
          {desktopRightPanel === "report" ? (
            <QuickReport
              onSubmit={handleReportSubmit}
              onFieldTip={triggerFieldTip}
            />
          ) : desktopRightPanel === "detail" && selectedIssue ? (
            <IssueDetail
              issue={selectedIssue}
              onClose={handleCloseIssueDetail}
              onShowOnMap={handleShowOnMap}
              onStatusUpdate={handleIssueStatusUpdate}
              onFieldTip={triggerFieldTip}
            />
          ) : desktopRightPanel === "stats" ? (
            <StatsPanel
              issues={issues}
              onClose={() => setDesktopRightPanel("none")}
              onDrillDown={handleStatsDrillDown}
            />
          ) : (
            <WorkQueue
              issues={issues}
              userLocation={userLocation}
              onIssueSelect={handleIssueSelect}
              onFieldTip={triggerFieldTip}
              initialStatus={drilldownFilter?.status}
              initialSeverity={drilldownFilter?.severity}
              initialCategory={drilldownFilter?.category}
              initialMonths={drilldownFilter?.months}
              filterLabel={drilldownFilter?.label}
              onClearFilter={handleClearDrilldown}
            />
          )}
        </aside>
      )}

      {/* ======= Chat Widget ======= */}
      <ChatWidget
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        selectedFeature={selectedFeature}
        currentLesson={currentLesson}
        visibleLayers={Object.entries(layerVisibility)
          .filter(([, v]) => v)
          .map(([k]) => k)}
        onFeatureHighlight={handleFeatureHighlight}
      />

      {/* ======= Field Tip Banner ======= */}
      <FieldTipBanner currentTip={currentTip} onDismiss={dismissTip} />

      {/* ======= Mobile Bottom Navigation ======= */}
      <MobileNav
        activeTab={mobileTab}
        onTabChange={setMobileTab}
        issueCount={openIssueCount}
      />
    </div>
  );
}
