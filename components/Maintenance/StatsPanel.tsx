"use client";

import { useMemo } from "react";
import {
  MaintenanceIssue,
  IssueCategory,
  IssueSeverity,
  ISSUE_CATEGORY_LABELS,
} from "@/lib/types";
import { SEVERITY_COLORS } from "@/lib/mapConfig";

interface StatsPanelProps {
  issues: MaintenanceIssue[];
  onClose: () => void;
}

function StatBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/60 w-28 truncate" title={label}>{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono text-white/50 w-8 text-right">{value}</span>
    </div>
  );
}

export function StatsPanel({ issues, onClose }: StatsPanelProps) {
  const stats = useMemo(() => {
    const byStatus: Record<string, number> = { reported: 0, assigned: 0, in_progress: 0, resolved: 0 };
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const last7Days: number[] = new Array(7).fill(0);
    const now = Date.now();

    issues.forEach((i) => {
      byStatus[i.status] = (byStatus[i.status] || 0) + 1;
      byCategory[i.category] = (byCategory[i.category] || 0) + 1;
      bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;

      const daysDiff = Math.floor((now - new Date(i.reportedAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 0 && daysDiff < 7) {
        last7Days[6 - daysDiff]++;
      }
    });

    const openCount = issues.filter((i) => i.status !== "resolved").length;
    const resolvedCount = byStatus.resolved || 0;
    const criticalOpen = issues.filter((i) => i.severity === "critical" && i.status !== "resolved").length;
    const avgResolutionHours = (() => {
      const resolved = issues.filter((i) => i.resolvedAt);
      if (resolved.length === 0) return null;
      const total = resolved.reduce((sum, i) => {
        return sum + (new Date(i.resolvedAt!).getTime() - new Date(i.reportedAt).getTime());
      }, 0);
      return Math.round(total / resolved.length / (1000 * 60 * 60));
    })();

    // Top categories sorted by count
    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return {
      total: issues.length,
      openCount,
      resolvedCount,
      criticalOpen,
      avgResolutionHours,
      byStatus,
      bySeverity,
      topCategories,
      last7Days,
    };
  }, [issues]);

  const SEVERITY_ORDER: IssueSeverity[] = ["critical", "high", "medium", "low"];
  const STATUS_COLORS: Record<string, string> = {
    reported: "#ef4444",
    assigned: "#facc15",
    in_progress: "#3b82f6",
    resolved: "#4ade80",
  };
  const STATUS_LABELS: Record<string, string> = {
    reported: "New",
    assigned: "Assigned",
    in_progress: "In Progress",
    resolved: "Resolved",
  };
  const CATEGORY_COLORS: Record<string, string> = {
    erosion: "#fb923c",
    graffiti: "#ef4444",
    snow_ice: "#93c5fd",
    parking_lot: "#a78bfa",
    trail_surface: "#f59e0b",
    vegetation: "#4ade80",
    signage: "#fbbf24",
    infrastructure: "#94a3b8",
    trash_dumping: "#d946ef",
    safety: "#f87171",
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-sidebar-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <h2 className="text-lg font-semibold text-white">Issue Analytics</h2>
          <p className="text-xs text-white/40">{stats.total} total issues tracked</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-center">
            <p className="text-2xl font-bold text-red-400">{stats.openCount}</p>
            <p className="text-[10px] text-red-400/60 uppercase tracking-wider">Open Issues</p>
          </div>
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2.5 text-center">
            <p className="text-2xl font-bold text-green-400">{stats.resolvedCount}</p>
            <p className="text-[10px] text-green-400/60 uppercase tracking-wider">Resolved</p>
          </div>
          <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 py-2.5 text-center">
            <p className="text-2xl font-bold text-orange-400">{stats.criticalOpen}</p>
            <p className="text-[10px] text-orange-400/60 uppercase tracking-wider">Critical Open</p>
          </div>
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2.5 text-center">
            <p className="text-2xl font-bold text-blue-400">
              {stats.avgResolutionHours !== null ? `${stats.avgResolutionHours}h` : "--"}
            </p>
            <p className="text-[10px] text-blue-400/60 uppercase tracking-wider">Avg Resolution</p>
          </div>
        </div>

        {/* 7-Day Trend */}
        <div>
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
            Reports (Last 7 Days)
          </h3>
          <div className="flex items-end gap-1 h-16">
            {stats.last7Days.map((count, i) => {
              const maxCount = Math.max(...stats.last7Days, 1);
              const height = (count / maxCount) * 100;
              const dayLabel = i === 6 ? "Today" : i === 5 ? "1d" : `${6 - i}d`;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <span className="text-[9px] text-white/30">{count || ""}</span>
                  <div
                    className="w-full rounded-sm bg-trail-gold/60 transition-all duration-300"
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                  <span className="text-[9px] text-white/20">{dayLabel}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Status */}
        <div>
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
            By Status
          </h3>
          <div className="space-y-1.5">
            {Object.entries(stats.byStatus).map(([status, count]) => (
              <StatBar
                key={status}
                label={STATUS_LABELS[status] || status}
                value={count}
                total={stats.total}
                color={STATUS_COLORS[status] || "#666"}
              />
            ))}
          </div>
        </div>

        {/* By Severity */}
        <div>
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
            By Severity
          </h3>
          <div className="space-y-1.5">
            {SEVERITY_ORDER.map((sev) => (
              <StatBar
                key={sev}
                label={sev.charAt(0).toUpperCase() + sev.slice(1)}
                value={stats.bySeverity[sev] || 0}
                total={stats.total}
                color={SEVERITY_COLORS[sev]}
              />
            ))}
          </div>
        </div>

        {/* By Category */}
        <div>
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
            By Category
          </h3>
          <div className="space-y-1.5">
            {stats.topCategories.map(([cat, count]) => (
              <StatBar
                key={cat}
                label={ISSUE_CATEGORY_LABELS[cat as IssueCategory] || cat}
                value={count}
                total={stats.total}
                color={CATEGORY_COLORS[cat] || "#666"}
              />
            ))}
          </div>
        </div>

        {/* Resolution Rate */}
        <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-white/50">Resolution Rate</span>
            <span className="text-sm font-bold text-white">
              {stats.total > 0 ? Math.round((stats.resolvedCount / stats.total) * 100) : 0}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${stats.total > 0 ? (stats.resolvedCount / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
