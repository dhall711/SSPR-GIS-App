"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  MaintenanceIssue,
  IssueCategory,
  IssueSeverity,
  IssueStatus,
  ISSUE_CATEGORY_LABELS,
} from "@/lib/types";
import { SEVERITY_COLORS } from "@/lib/mapConfig";

interface WorkQueueProps {
  issues: MaintenanceIssue[];
  userLocation?: { lat: number; lng: number } | null;
  onIssueSelect?: (issue: MaintenanceIssue) => void;
  onFieldTip?: (trigger: string, context?: string) => void;
  initialStatus?: string;
  initialSeverity?: string;
  initialCategory?: string;
  filterLabel?: string;
  onClearFilter?: () => void;
}

type SortMode = "proximity" | "severity" | "date";
type FilterStatus = "all" | "open" | IssueStatus;

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function formatDistance(miles: number): string {
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
  return `${miles.toFixed(1)} mi`;
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

export function WorkQueue({
  issues,
  userLocation,
  onIssueSelect,
  onFieldTip,
  initialStatus,
  initialSeverity,
  initialCategory,
  filterLabel,
  onClearFilter,
}: WorkQueueProps) {
  const [sortMode, setSortMode] = useState<SortMode>(
    userLocation ? "proximity" : "severity"
  );
  const [filterStatus, setFilterStatus] = useState<FilterStatus>(
    (initialStatus as FilterStatus) || "all"
  );
  const [filterSeverity, setFilterSeverity] = useState<IssueSeverity | "all">(
    (initialSeverity as IssueSeverity) || "all"
  );
  const [filterCategory, setFilterCategory] = useState<IssueCategory | "all">(
    (initialCategory as IssueCategory) || "all"
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // When initial filters change from outside (drilldown from Stats), update state
  useEffect(() => {
    if (initialStatus) setFilterStatus(initialStatus as FilterStatus);
    if (initialSeverity) setFilterSeverity(initialSeverity as IssueSeverity);
    if (initialCategory) setFilterCategory(initialCategory as IssueCategory);
  }, [initialStatus, initialSeverity, initialCategory]);

  const issuesWithDistance = useMemo(() => {
    return issues.map((issue) => ({
      ...issue,
      distance: userLocation
        ? haversineDistance(
            userLocation.lat,
            userLocation.lng,
            issue.latitude,
            issue.longitude
          )
        : null,
    }));
  }, [issues, userLocation]);

  const filteredAndSorted = useMemo(() => {
    let filtered = issuesWithDistance;

    // Status filter
    if (filterStatus === "open") {
      // "Open" = everything except resolved
      filtered = filtered.filter((i) => i.status !== "resolved");
    } else if (filterStatus !== "all") {
      filtered = filtered.filter((i) => i.status === filterStatus);
    } else {
      // "all" default also hides resolved unless explicitly chosen
      filtered = filtered.filter((i) => i.status !== "resolved");
    }

    // Severity filter
    if (filterSeverity !== "all") {
      filtered = filtered.filter((i) => i.severity === filterSeverity);
    }

    // Category filter
    if (filterCategory !== "all") {
      filtered = filtered.filter((i) => i.category === filterCategory);
    }

    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortMode) {
        case "proximity":
          if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
          return 0;
        case "severity":
          return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        case "date":
          return new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime();
        default:
          return 0;
      }
    });
  }, [issuesWithDistance, sortMode, filterStatus, filterSeverity, filterCategory]);

  const handleIssueClick = useCallback(
    (issue: MaintenanceIssue) => {
      if (expandedId === issue.id) {
        setExpandedId(null);
      } else {
        setExpandedId(issue.id);
        onFieldTip?.("view-issue", issue.category);
      }
    },
    [expandedId, onFieldTip]
  );

  const statusCounts = useMemo(() => {
    const counts = { reported: 0, assigned: 0, in_progress: 0, resolved: 0 };
    issues.forEach((i) => {
      counts[i.status] = (counts[i.status] || 0) + 1;
    });
    return counts;
  }, [issues]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-lg font-semibold text-white">Work Queue</h2>
        <div className="flex gap-3 mt-1 text-xs text-white/50">
          <span className="text-red-400">{statusCounts.reported} new</span>
          <span className="text-yellow-400">{statusCounts.assigned} assigned</span>
          <span className="text-blue-400">{statusCounts.in_progress} active</span>
        </div>
      </div>

      {/* Active Filter Banner (from Stats drilldown) */}
      {filterLabel && (
        <div className="mx-4 mb-2 flex items-center justify-between rounded-lg bg-trail-gold/15 border border-trail-gold/30 px-3 py-2">
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 text-trail-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="text-xs font-medium text-trail-gold">{filterLabel}</span>
          </div>
          <button
            onClick={() => {
              setFilterStatus("all");
              setFilterSeverity("all");
              setFilterCategory("all");
              onClearFilter?.();
            }}
            className="text-xs text-trail-gold/70 hover:text-trail-gold transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Sort & Filter Controls */}
      <div className="px-4 pb-2 space-y-2">
        {/* Sort Mode */}
        <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
          {(
            [
              { value: "proximity", label: "Nearest" },
              { value: "severity", label: "Urgent" },
              { value: "date", label: "Recent" },
            ] as { value: SortMode; label: string }[]
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortMode(opt.value)}
              disabled={opt.value === "proximity" && !userLocation}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors min-h-[36px] ${
                sortMode === opt.value
                  ? "bg-trail-green text-white"
                  : "text-white/50 hover:text-white/80"
              } ${opt.value === "proximity" && !userLocation ? "opacity-30 cursor-not-allowed" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex gap-1 overflow-x-auto">
          {(
            [
              { value: "all", label: "Open" },
              { value: "reported", label: "New" },
              { value: "assigned", label: "Assigned" },
              { value: "in_progress", label: "Active" },
              { value: "resolved", label: "Done" },
            ] as { value: FilterStatus; label: string }[]
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setFilterStatus(opt.value);
                onClearFilter?.(); // clear drilldown label when manually changing filters
              }}
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors min-h-[32px] ${
                filterStatus === opt.value
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Category Filter */}
        <select
          value={filterCategory}
          onChange={(e) => {
            setFilterCategory(e.target.value as IssueCategory | "all");
            onClearFilter?.();
          }}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 focus:border-trail-gold/50 focus:outline-none min-h-[36px]"
        >
          <option value="all">All categories</option>
          {Object.entries(ISSUE_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Issue List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {filteredAndSorted.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-white/40">No matching issues</p>
          </div>
        ) : (
          filteredAndSorted.map((issue) => {
            const isExpanded = expandedId === issue.id;
            const distInfo = issue.distance !== null ? formatDistance(issue.distance) : null;

            return (
              <div
                key={issue.id}
                className="rounded-lg border border-white/10 bg-white/5 overflow-hidden transition-colors hover:border-white/20"
              >
                {/* Main Row */}
                <button
                  onClick={() => handleIssueClick(issue)}
                  className="w-full flex items-start gap-3 px-3 py-3 text-left min-h-[56px]"
                >
                  {/* Severity Dot */}
                  <div
                    className="mt-1 h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: SEVERITY_COLORS[issue.severity] }}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{issue.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-white/50">
                      <span>{ISSUE_CATEGORY_LABELS[issue.category]}</span>
                      <span>&middot;</span>
                      <span>{formatTimeAgo(issue.reportedAt)}</span>
                      {issue.status === "assigned" && (
                        <>
                          <span>&middot;</span>
                          <span className="text-yellow-400/70">Assigned</span>
                        </>
                      )}
                      {issue.status === "in_progress" && (
                        <>
                          <span>&middot;</span>
                          <span className="text-blue-400/70">In Progress</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Distance */}
                  {distInfo && (
                    <span className="text-xs text-white/40 flex-shrink-0 font-mono">{distInfo}</span>
                  )}
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-white/5 pt-2 space-y-2">
                    <p className="text-xs text-white/60 leading-relaxed">{issue.description}</p>
                    {issue.fieldNotes && (
                      <div className="rounded-md bg-trail-gold/10 px-2 py-1.5 border border-trail-gold/20">
                        <p className="text-[10px] font-medium text-trail-gold/80 uppercase tracking-wider mb-0.5">Field Notes</p>
                        <p className="text-xs text-white/60">{issue.fieldNotes}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono">
                      <span>{issue.latitude.toFixed(4)}, {issue.longitude.toFixed(4)}</span>
                      {issue.trailId && <span>&middot; Trail: {issue.trailId}</span>}
                      {issue.parkId && <span>&middot; Park: {issue.parkId}</span>}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onIssueSelect?.(issue);
                        }}
                        className="flex-1 rounded-md bg-trail-green px-3 py-2 text-xs font-medium text-white hover:bg-trail-green/80 transition-colors min-h-[44px]"
                      >
                        Show on Map
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Navigate to coordinates
                          window.open(
                            `https://maps.google.com/maps?q=${issue.latitude},${issue.longitude}`,
                            "_blank"
                          );
                        }}
                        className="rounded-md border border-white/10 px-3 py-2 text-xs font-medium text-white/70 hover:text-white hover:border-white/30 transition-colors min-h-[44px]"
                      >
                        Navigate
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
