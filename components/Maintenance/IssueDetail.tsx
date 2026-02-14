"use client";

import { useState, useCallback } from "react";
import {
  MaintenanceIssue,
  IssueStatus,
  ISSUE_CATEGORY_LABELS,
} from "@/lib/types";
import { SEVERITY_COLORS } from "@/lib/mapConfig";

interface IssueDetailProps {
  issue: MaintenanceIssue;
  onClose: () => void;
  onShowOnMap: (issue: MaintenanceIssue) => void;
  onStatusUpdate: (issueId: string, status: IssueStatus, fieldNotes?: string) => void;
  onFieldTip?: (trigger: string, context?: string) => void;
}

const STATUS_FLOW: { from: IssueStatus; to: IssueStatus; label: string; color: string }[] = [
  { from: "reported", to: "assigned", label: "Accept & Assign to Me", color: "bg-yellow-500 hover:bg-yellow-600" },
  { from: "assigned", to: "in_progress", label: "Start Work", color: "bg-blue-500 hover:bg-blue-600" },
  { from: "in_progress", to: "resolved", label: "Mark Resolved", color: "bg-green-500 hover:bg-green-600" },
];

const STATUS_LABELS: Record<IssueStatus, { label: string; color: string }> = {
  reported: { label: "New", color: "text-red-400 bg-red-400/10 border-red-400/20" },
  assigned: { label: "Assigned", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  in_progress: { label: "In Progress", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  resolved: { label: "Resolved", color: "text-green-400 bg-green-400/10 border-green-400/20" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

export function IssueDetail({
  issue,
  onClose,
  onShowOnMap,
  onStatusUpdate,
  onFieldTip,
}: IssueDetailProps) {
  const [fieldNotes, setFieldNotes] = useState(issue.fieldNotes ?? "");
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const nextAction = STATUS_FLOW.find((s) => s.from === issue.status);
  const statusInfo = STATUS_LABELS[issue.status];

  const handleStatusAdvance = useCallback(async () => {
    if (!nextAction) return;
    setIsSaving(true);
    try {
      onStatusUpdate(issue.id, nextAction.to, fieldNotes || undefined);
      onFieldTip?.("status-update", `${issue.status} → ${nextAction.to}`);
    } finally {
      setIsSaving(false);
    }
  }, [nextAction, issue.id, issue.status, fieldNotes, onStatusUpdate, onFieldTip]);

  const handleSaveNotes = useCallback(() => {
    onStatusUpdate(issue.id, issue.status, fieldNotes);
    setShowNotesInput(false);
    onFieldTip?.("field-notes-saved");
  }, [issue.id, issue.status, fieldNotes, onStatusUpdate, onFieldTip]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-sidebar-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors min-h-[44px]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
        {/* Title & Category */}
        <div>
          <h2 className="text-lg font-semibold text-white leading-tight">{issue.title}</h2>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: SEVERITY_COLORS[issue.severity] }}
            />
            <span className="text-sm text-white/60">
              {issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)} severity
            </span>
            <span className="text-white/30">&middot;</span>
            <span className="text-sm text-white/60">{ISSUE_CATEGORY_LABELS[issue.category]}</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
            <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Reported</p>
            <p className="text-sm text-white/80 mt-0.5">{formatTimeAgo(issue.reportedAt)}</p>
            <p className="text-[10px] text-white/40 font-mono">{formatDate(issue.reportedAt)}</p>
          </div>
          <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
            <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Reporter</p>
            <p className="text-sm text-white/80 mt-0.5">{issue.reporter}</p>
            <p className="text-[10px] text-white/40">
              {issue.source === "citizen" ? "Citizen report" : issue.source === "field_entry" ? "Field entry" : issue.source === "simulated" ? "Simulated" : "AI suggested"}
            </p>
          </div>
        </div>

        {/* Location */}
        <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5">
          <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">Location</p>
          <p className="text-sm font-mono text-trail-gold">
            {issue.latitude.toFixed(6)}, {issue.longitude.toFixed(6)}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
            {issue.trailId && (
              <span>Trail: <span className="text-white/70">{issue.trailId}</span></span>
            )}
            {issue.parkId && (
              <span>Park: <span className="text-white/70">{issue.parkId}</span></span>
            )}
            {!issue.trailId && !issue.parkId && (
              <span className="text-white/40">No associated trail or park</span>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onShowOnMap(issue)}
              className="flex-1 rounded-md bg-trail-green px-3 py-2 text-xs font-medium text-white hover:bg-trail-green/80 transition-colors min-h-[40px]"
            >
              Show on Map
            </button>
            <button
              onClick={() =>
                window.open(
                  `https://maps.google.com/maps?q=${issue.latitude},${issue.longitude}`,
                  "_blank"
                )
              }
              className="rounded-md border border-white/10 px-3 py-2 text-xs font-medium text-white/70 hover:text-white hover:border-white/30 transition-colors min-h-[40px]"
            >
              Navigate
            </button>
          </div>
        </div>

        {/* Description */}
        <div>
          <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">Description</p>
          <p className="text-sm text-white/70 leading-relaxed">{issue.description || "No description provided."}</p>
        </div>

        {/* Assigned To */}
        {issue.assignedTo && (
          <div className="rounded-lg bg-yellow-400/5 border border-yellow-400/15 px-3 py-2.5">
            <p className="text-[10px] font-medium text-yellow-400/60 uppercase tracking-wider mb-0.5">Assigned To</p>
            <p className="text-sm text-white/80">{issue.assignedTo}</p>
          </div>
        )}

        {/* Field Notes */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Field Notes</p>
            {!showNotesInput && (
              <button
                onClick={() => setShowNotesInput(true)}
                className="text-xs text-trail-gold/60 hover:text-trail-gold transition-colors"
              >
                {issue.fieldNotes ? "Edit" : "+ Add notes"}
              </button>
            )}
          </div>
          {showNotesInput ? (
            <div className="space-y-2">
              <textarea
                value={fieldNotes}
                onChange={(e) => setFieldNotes(e.target.value)}
                placeholder="What do you see in the field? Materials needed, equipment required, safety concerns..."
                rows={4}
                className="w-full rounded-lg border border-trail-gold/30 bg-trail-gold/5 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-trail-gold/50 focus:outline-none resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNotes}
                  className="flex-1 rounded-md bg-trail-gold/20 px-3 py-2 text-xs font-medium text-trail-gold hover:bg-trail-gold/30 transition-colors min-h-[40px]"
                >
                  Save Notes
                </button>
                <button
                  onClick={() => {
                    setFieldNotes(issue.fieldNotes ?? "");
                    setShowNotesInput(false);
                  }}
                  className="rounded-md border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-white/70 transition-colors min-h-[40px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : issue.fieldNotes ? (
            <div className="rounded-md bg-trail-gold/10 px-3 py-2.5 border border-trail-gold/20">
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{issue.fieldNotes}</p>
            </div>
          ) : (
            <p className="text-sm text-white/30 italic">No field notes yet</p>
          )}
        </div>

        {/* AI Analysis */}
        {issue.aiAnalysis && (
          <div className="rounded-lg bg-blue-500/5 border border-blue-500/15 px-3 py-2.5">
            <p className="text-[10px] font-medium text-blue-400/60 uppercase tracking-wider mb-1">AI Analysis</p>
            <p className="text-sm text-white/70 leading-relaxed">{issue.aiAnalysis}</p>
          </div>
        )}

        {/* Photo */}
        {issue.photoUrl && (
          <div>
            <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">Photo</p>
            <div className="rounded-lg overflow-hidden border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={issue.photoUrl} alt={issue.title} className="w-full h-48 object-cover" />
            </div>
          </div>
        )}

        {/* Resolved Info */}
        {issue.resolvedAt && (
          <div className="rounded-lg bg-green-500/5 border border-green-500/15 px-3 py-2.5">
            <p className="text-[10px] font-medium text-green-400/60 uppercase tracking-wider mb-0.5">Resolved</p>
            <p className="text-sm text-white/70">{formatDate(issue.resolvedAt)}</p>
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      {nextAction && (
        <div className="px-4 py-3 border-t border-white/10 bg-sidebar-bg">
          <button
            onClick={handleStatusAdvance}
            disabled={isSaving}
            className={`w-full rounded-lg px-4 py-3 text-base font-semibold text-white transition-colors min-h-[48px] ${nextAction.color} ${
              isSaving ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {isSaving ? "Updating..." : nextAction.label}
          </button>
          {issue.status === "in_progress" && !fieldNotes.trim() && (
            <p className="text-[10px] text-trail-gold/60 text-center mt-1.5">
              Consider adding field notes before resolving
            </p>
          )}
        </div>
      )}
    </div>
  );
}
