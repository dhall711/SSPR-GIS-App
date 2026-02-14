"use client";

import { useMemo, useState } from "react";
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

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SEASON_NAMES = ["Winter", "Spring", "Summer", "Fall"];
const SEASON_COLORS = ["#93c5fd", "#4ade80", "#facc15", "#fb923c"];

function getSeason(month: number): number {
  if (month === 11 || month <= 1) return 0; // Winter: Dec, Jan, Feb
  if (month >= 2 && month <= 4) return 1;   // Spring: Mar, Apr, May
  if (month >= 5 && month <= 7) return 2;   // Summer: Jun, Jul, Aug
  return 3;                                   // Fall: Sep, Oct, Nov
}

// Seasonal category expectations for Colorado Front Range
const SEASONAL_INSIGHTS: Record<number, string> = {
  0: "Winter: Expect snow/ice, freeze-thaw trail damage, and reduced visibility signage issues.",
  1: "Spring: Peak erosion season as snowmelt combines with spring rain. Watch waterway crossings.",
  2: "Summer: Vegetation overgrowth, heavy trail use, graffiti, and trash peak. Heat stresses infrastructure.",
  3: "Fall: Falling leaves obscure trail hazards. Early freeze warnings. Pre-winter maintenance window.",
};

export function StatsPanel({ issues, onClose }: StatsPanelProps) {
  const [activeView, setActiveView] = useState<"overview" | "seasonal">("overview");

  const stats = useMemo(() => {
    const byStatus: Record<string, number> = { reported: 0, assigned: 0, in_progress: 0, resolved: 0 };
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const last7Days: number[] = new Array(7).fill(0);
    const now = Date.now();

    // Monthly data (last 12 months)
    const monthly: number[] = new Array(12).fill(0);
    const monthlyByCategory: Record<string, number[]> = {};
    const bySeason: number[] = [0, 0, 0, 0];
    const seasonalCategories: Record<number, Record<string, number>> = { 0: {}, 1: {}, 2: {}, 3: {} };

    issues.forEach((i) => {
      byStatus[i.status] = (byStatus[i.status] || 0) + 1;
      byCategory[i.category] = (byCategory[i.category] || 0) + 1;
      bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;

      const reportDate = new Date(i.reportedAt);
      const daysDiff = Math.floor((now - reportDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 0 && daysDiff < 7) {
        last7Days[6 - daysDiff]++;
      }

      // Monthly aggregation
      const monthIdx = reportDate.getMonth();
      monthly[monthIdx]++;

      // Monthly by category
      if (!monthlyByCategory[i.category]) {
        monthlyByCategory[i.category] = new Array(12).fill(0);
      }
      monthlyByCategory[i.category][monthIdx]++;

      // Seasonal aggregation
      const season = getSeason(monthIdx);
      bySeason[season]++;
      seasonalCategories[season][i.category] = (seasonalCategories[season][i.category] || 0) + 1;
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

    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    // Top category per season
    const seasonTopCategory = [0, 1, 2, 3].map((s) => {
      const cats = Object.entries(seasonalCategories[s]);
      if (cats.length === 0) return null;
      cats.sort((a, b) => b[1] - a[1]);
      return { category: cats[0][0] as IssueCategory, count: cats[0][1] };
    });

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
      monthly,
      monthlyByCategory,
      bySeason,
      seasonalCategories,
      seasonTopCategory,
    };
  }, [issues]);

  const currentSeason = getSeason(new Date().getMonth());

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

      {/* View Toggle */}
      <div className="px-4 pb-2">
        <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
          {([
            { value: "overview", label: "Overview" },
            { value: "seasonal", label: "Seasonal" },
          ] as { value: typeof activeView; label: string }[]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setActiveView(opt.value)}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                activeView === opt.value
                  ? "bg-trail-green text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">
        {activeView === "overview" ? (
          <>
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
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">By Status</h3>
              <div className="space-y-1.5">
                {Object.entries(stats.byStatus).map(([status, count]) => (
                  <StatBar key={status} label={STATUS_LABELS[status] || status} value={count} total={stats.total} color={STATUS_COLORS[status] || "#666"} />
                ))}
              </div>
            </div>

            {/* By Severity */}
            <div>
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">By Severity</h3>
              <div className="space-y-1.5">
                {SEVERITY_ORDER.map((sev) => (
                  <StatBar key={sev} label={sev.charAt(0).toUpperCase() + sev.slice(1)} value={stats.bySeverity[sev] || 0} total={stats.total} color={SEVERITY_COLORS[sev]} />
                ))}
              </div>
            </div>

            {/* By Category */}
            <div>
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">By Category</h3>
              <div className="space-y-1.5">
                {stats.topCategories.map(([cat, count]) => (
                  <StatBar key={cat} label={ISSUE_CATEGORY_LABELS[cat as IssueCategory] || cat} value={count} total={stats.total} color={CATEGORY_COLORS[cat] || "#666"} />
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
          </>
        ) : (
          <>
            {/* ===== SEASONAL VIEW ===== */}

            {/* Current Season Insight */}
            <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: `${SEASON_COLORS[currentSeason]}30`, backgroundColor: `${SEASON_COLORS[currentSeason]}08` }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SEASON_COLORS[currentSeason] }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: SEASON_COLORS[currentSeason] }}>
                  Current: {SEASON_NAMES[currentSeason]}
                </span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">{SEASONAL_INSIGHTS[currentSeason]}</p>
            </div>

            {/* Monthly Distribution Chart */}
            <div>
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                Issues by Month
              </h3>
              <div className="flex items-end gap-0.5 h-20">
                {stats.monthly.map((count, i) => {
                  const maxCount = Math.max(...stats.monthly, 1);
                  const height = (count / maxCount) * 100;
                  const season = getSeason(i);
                  const isCurrentMonth = i === new Date().getMonth();
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <span className="text-[8px] text-white/30">{count || ""}</span>
                      <div
                        className={`w-full rounded-sm transition-all duration-300 ${isCurrentMonth ? "ring-1 ring-white/40" : ""}`}
                        style={{
                          height: `${Math.max(height, 3)}%`,
                          backgroundColor: SEASON_COLORS[season],
                          opacity: count > 0 ? 0.7 : 0.15,
                        }}
                      />
                      <span className={`text-[8px] ${isCurrentMonth ? "text-white font-bold" : "text-white/25"}`}>
                        {MONTH_NAMES[i]}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Season legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {SEASON_NAMES.map((name, i) => (
                  <div key={name} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SEASON_COLORS[i] }} />
                    <span className="text-[9px] text-white/40">{name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Seasonal Breakdown */}
            <div>
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                Issues by Season
              </h3>
              <div className="space-y-2">
                {SEASON_NAMES.map((name, i) => {
                  const count = stats.bySeason[i];
                  const top = stats.seasonTopCategory[i];
                  const isCurrent = i === currentSeason;
                  return (
                    <div
                      key={name}
                      className={`rounded-lg border px-3 py-2 ${isCurrent ? "border-white/20 bg-white/5" : "border-white/5 bg-white/[0.02]"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: SEASON_COLORS[i] }} />
                          <span className={`text-sm font-medium ${isCurrent ? "text-white" : "text-white/60"}`}>
                            {name}
                            {isCurrent && <span className="ml-1.5 text-[9px] text-trail-gold">(now)</span>}
                          </span>
                        </div>
                        <span className="text-sm font-mono text-white/50">{count}</span>
                      </div>
                      {top && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[top.category] || "#666" }} />
                          <span className="text-[10px] text-white/40">
                            Top: {ISSUE_CATEGORY_LABELS[top.category]} ({top.count})
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Seasonal Category Heatmap */}
            <div>
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                Category × Season
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr>
                      <th className="text-left text-white/40 font-medium pb-1 pr-2">Category</th>
                      {SEASON_NAMES.map((s, i) => (
                        <th key={s} className="text-center font-medium pb-1 px-1" style={{ color: SEASON_COLORS[i] }}>
                          {s.slice(0, 3)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topCategories.slice(0, 6).map(([cat]) => {
                      const maxInRow = Math.max(
                        ...([0, 1, 2, 3].map((s) => stats.seasonalCategories[s][cat] || 0)),
                        1
                      );
                      return (
                        <tr key={cat}>
                          <td className="text-white/50 py-0.5 pr-2 truncate max-w-[80px]" title={ISSUE_CATEGORY_LABELS[cat as IssueCategory]}>
                            {ISSUE_CATEGORY_LABELS[cat as IssueCategory] || cat}
                          </td>
                          {[0, 1, 2, 3].map((s) => {
                            const val = stats.seasonalCategories[s][cat] || 0;
                            const intensity = val / maxInRow;
                            return (
                              <td key={s} className="text-center py-0.5 px-1">
                                <div
                                  className="mx-auto rounded-sm h-5 w-full flex items-center justify-center"
                                  style={{
                                    backgroundColor: val > 0 ? CATEGORY_COLORS[cat] || "#666" : "transparent",
                                    opacity: val > 0 ? 0.2 + intensity * 0.6 : 0.05,
                                  }}
                                >
                                  <span className={`text-[9px] font-mono ${val > 0 ? "text-white" : "text-white/20"}`}>
                                    {val || "-"}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Seasonal Planning Tip */}
            <div className="rounded-lg bg-eco-riparian/10 border border-eco-riparian/20 px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1">
                <svg className="h-3.5 w-3.5 text-eco-riparian" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="text-[10px] font-semibold text-eco-riparian uppercase tracking-wider">GIS Insight</span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">
                Seasonal trend analysis is a core GIS skill. By mapping issue categories against seasons,
                you can predict next month&apos;s workload and request resources <em>before</em> the surge hits.
                This data makes the case for proactive maintenance budgets.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
