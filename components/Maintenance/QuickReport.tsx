"use client";

import { useState, useCallback, useRef } from "react";
import {
  IssueCategory,
  IssueSeverity,
  ISSUE_CATEGORY_LABELS,
  MaintenanceIssue,
} from "@/lib/types";
import { SSPR_CENTER } from "@/lib/mapConfig";

interface QuickReportProps {
  onSubmit: (issue: Omit<MaintenanceIssue, "id" | "reportedAt" | "resolvedAt" | "aiAnalysis">) => void;
  onFieldTip?: (trigger: string, context?: string) => void;
}

const SEVERITY_OPTIONS: { value: IssueSeverity; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "#4ade80" },
  { value: "medium", label: "Medium", color: "#facc15" },
  { value: "high", label: "High", color: "#fb923c" },
  { value: "critical", label: "Critical", color: "#ef4444" },
];

const CATEGORY_OPTIONS: { value: IssueCategory; label: string }[] = (
  Object.entries(ISSUE_CATEGORY_LABELS) as [IssueCategory, string][]
).map(([value, label]) => ({ value, label }));

export function QuickReport({ onSubmit, onFieldTip }: QuickReportProps) {
  const [category, setCategory] = useState<IssueCategory | null>(null);
  const [severity, setSeverity] = useState<IssueSeverity>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus("error");
      return;
    }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGpsAccuracy(Math.round(position.coords.accuracy));
        setGpsStatus("success");
        onFieldTip?.("gps-capture", `Coordinates: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
      },
      () => {
        setGpsStatus("error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, [onFieldTip]);

  const handlePhotoCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!category || !title.trim()) return;

    setIsUploading(true);

    // Upload photo to Supabase Storage if one was captured
    let photoUrl: string | null = null;
    if (photoFile) {
      try {
        const formData = new FormData();
        formData.append("file", photoFile);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) {
          photoUrl = data.url;
        }
      } catch {
        // Photo upload failed -- submit without photo rather than blocking
        console.warn("Photo upload failed, submitting without photo");
      }
    }

    const issue: Omit<MaintenanceIssue, "id" | "reportedAt" | "resolvedAt" | "aiAnalysis"> = {
      latitude: coords?.lat ?? SSPR_CENTER[0],
      longitude: coords?.lng ?? SSPR_CENTER[1],
      trailId: null,
      parkId: null,
      category,
      severity,
      status: "reported",
      title: title.trim(),
      description: description.trim(),
      photoUrl,
      assignedTo: null,
      reporter: "field-worker",
      source: "field_entry",
      fieldNotes: null,
    };

    onSubmit(issue);
    onFieldTip?.("report-submitted", category);
    setIsUploading(false);
    setSubmitted(true);
  }, [category, severity, title, description, photoFile, coords, onSubmit, onFieldTip]);

  const resetForm = useCallback(() => {
    setCategory(null);
    setSeverity("medium");
    setTitle("");
    setDescription("");
    setPhotoPreview(null);
    setPhotoFile(null);
    setCoords(null);
    setGpsStatus("idle");
    setGpsAccuracy(null);
    setSubmitted(false);
    setIsUploading(false);
  }, []);

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
          <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">Report Submitted</h3>
        <p className="text-sm text-white/60 mb-6">
          Your maintenance report has been logged{coords ? ` at ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : ""}.
        </p>
        <button
          onClick={resetForm}
          className="rounded-lg bg-trail-green px-6 py-3 text-sm font-medium text-white hover:bg-trail-green/80 transition-colors min-h-[44px]"
        >
          File Another Report
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-lg font-semibold text-white">Quick Report</h2>
        <p className="text-xs text-white/50">Log a maintenance issue from the field</p>
      </div>

      <div className="flex-1 px-4 pb-4 space-y-4">
        {/* GPS Location */}
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1.5">Location</label>
          {gpsStatus === "success" && coords ? (
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2">
              <svg className="h-5 w-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-green-400 truncate">
                  {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                </p>
                {gpsAccuracy && (
                  <p className="text-[10px] text-green-400/60">±{gpsAccuracy}m accuracy</p>
                )}
              </div>
              <button onClick={getLocation} className="text-xs text-green-400/60 hover:text-green-400 min-h-[44px] min-w-[44px] flex items-center justify-center">
                Refresh
              </button>
            </div>
          ) : (
            <button
              onClick={getLocation}
              disabled={gpsStatus === "loading"}
              className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/20 px-4 py-3 text-sm text-white/60 hover:border-trail-gold/40 hover:text-trail-gold transition-colors min-h-[44px]"
            >
              {gpsStatus === "loading" ? (
                <>
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Getting location...
                </>
              ) : gpsStatus === "error" ? (
                <>
                  <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Location unavailable — tap to retry
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Tap to capture GPS location
                </>
              )}
            </button>
          )}
        </div>

        {/* Category Picker */}
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1.5">Category</label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setCategory(opt.value);
                  onFieldTip?.("category-select", opt.value);
                }}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors min-h-[44px] ${
                  category === opt.value
                    ? "border-trail-gold bg-trail-gold/15 text-trail-gold"
                    : "border-white/10 text-white/70 hover:border-white/30 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Severity */}
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1.5">Severity</label>
          <div className="flex gap-2">
            {SEVERITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSeverity(opt.value)}
                className={`flex-1 rounded-lg border px-2 py-2.5 text-center text-sm font-medium transition-colors min-h-[44px] ${
                  severity === opt.value
                    ? "border-current"
                    : "border-white/10 text-white/50 hover:border-white/30"
                }`}
                style={severity === opt.value ? { color: opt.color, borderColor: opt.color, backgroundColor: `${opt.color}15` } : {}}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1.5">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief description of the issue"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-trail-gold/50 focus:outline-none min-h-[44px]"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1.5">Details (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Size, extent, specific location details, safety concerns..."
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-trail-gold/50 focus:outline-none resize-none"
          />
        </div>

        {/* Photo */}
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1.5">Photo (optional)</label>
          {photoPreview ? (
            <div className="relative rounded-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="Captured" className="w-full h-32 object-cover rounded-lg" />
              <button
                onClick={() => {
                  setPhotoPreview(null);
                  setPhotoFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/20 px-4 py-3 text-sm text-white/60 hover:border-trail-gold/40 hover:text-trail-gold transition-colors min-h-[44px]"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Take Photo
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            className="hidden"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!category || !title.trim() || isUploading}
          className={`w-full rounded-lg px-4 py-3 text-base font-semibold transition-colors min-h-[48px] ${
            category && title.trim() && !isUploading
              ? "bg-trail-green text-white hover:bg-trail-green/80"
              : "bg-white/5 text-white/30 cursor-not-allowed"
          }`}
        >
          {isUploading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {photoFile ? "Uploading photo..." : "Submitting..."}
            </span>
          ) : (
            "Submit Report"
          )}
        </button>
      </div>
    </div>
  );
}
