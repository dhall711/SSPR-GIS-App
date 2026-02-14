"use client";

import { useState, useCallback, useRef } from "react";
import {
  IssueCategory,
  IssueSeverity,
  ISSUE_CATEGORY_LABELS,
  MaintenanceIssue,
} from "@/lib/types";
import { SSPR_CENTER } from "@/lib/mapConfig";
import exifr from "exifr";

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

interface PhotoAnalysis {
  category: string;
  severity: string;
  title: string;
  description: string;
  estimatedExtent: string;
  safetyRisk: string;
  likelyCause: string;
  recommendedAction: string;
  equipmentNeeded: string;
  estimatedEffort: string;
  environmentalContext: string;
  confidence: number;
}

export function QuickReport({ onSubmit, onFieldTip }: QuickReportProps) {
  const [category, setCategory] = useState<IssueCategory | null>(null);
  const [severity, setSeverity] = useState<IssueSeverity>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "success" | "error" | "exif">("idle");
  const [gpsSource, setGpsSource] = useState<"device" | "exif" | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [photoTimestamp, setPhotoTimestamp] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI photo analysis state
  const [aiAnalysis, setAiAnalysis] = useState<PhotoAnalysis | null>(null);
  const [aiStatus, setAiStatus] = useState<"idle" | "analyzing" | "done" | "error">("idle");
  const [aiAccepted, setAiAccepted] = useState(false);
  const [showAiDetails, setShowAiDetails] = useState(false);

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
        setGpsSource("device");
        onFieldTip?.("gps-capture", `Coordinates: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
      },
      () => {
        setGpsStatus("error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, [onFieldTip]);

  const handlePhotoCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    setAiAnalysis(null);
    setAiStatus("idle");
    setAiAccepted(false);
    setShowAiDetails(false);

    // Read the image as data URL (used for preview AND AI analysis)
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    setPhotoPreview(dataUrl);

    // Extract EXIF metadata (GPS, timestamp) from the image
    try {
      const exif = await exifr.parse(file, {
        gps: true,
        pick: ["latitude", "longitude", "DateTimeOriginal", "CreateDate", "GPSAltitude"],
      });

      if (exif) {
        // Extract GPS coordinates from EXIF
        if (exif.latitude != null && exif.longitude != null) {
          const exifLat = exif.latitude as number;
          const exifLng = exif.longitude as number;
          // Only use EXIF coords if they seem reasonable (within Colorado-ish bounds)
          if (exifLat > 36 && exifLat < 42 && exifLng > -110 && exifLng < -100) {
            setCoords({ lat: exifLat, lng: exifLng });
            setGpsStatus("exif");
            setGpsSource("exif");
            setGpsAccuracy(null); // EXIF doesn't include accuracy
            onFieldTip?.(
              "exif-gps",
              `Photo GPS extracted: ${exifLat.toFixed(6)}, ${exifLng.toFixed(6)}. EXIF coordinates come from the device that took the photo — accuracy depends on that device's GPS.`
            );
          }
        }

        // Extract timestamp from EXIF
        const timestamp = exif.DateTimeOriginal || exif.CreateDate;
        if (timestamp) {
          const ts = timestamp instanceof Date ? timestamp : new Date(timestamp);
          if (!isNaN(ts.getTime())) {
            setPhotoTimestamp(ts.toISOString());
          }
        }
      }
    } catch {
      // EXIF extraction failed silently — photo is still usable
    }

    // Send to AI Vision for analysis (non-blocking — form is usable while this runs)
    setAiStatus("analyzing");
    try {
      const res = await fetch("/api/analyze-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: dataUrl }),
      });
      const result = await res.json();
      if (result.data && !result.error) {
        setAiAnalysis(result.data as PhotoAnalysis);
        setAiStatus("done");
        onFieldTip?.(
          "ai-photo-analysis",
          `AI identified this as "${result.data.category}" (${result.data.severity} severity) with ${Math.round((result.data.confidence || 0) * 100)}% confidence. Review the suggestion and accept or edit.`
        );
      } else {
        setAiStatus("error");
      }
    } catch {
      setAiStatus("error");
    }
  }, [onFieldTip]);

  const acceptAiSuggestions = useCallback(() => {
    if (!aiAnalysis) return;
    const validCategories: IssueCategory[] = [
      "graffiti", "snow_ice", "parking_lot", "erosion", "trail_surface",
      "vegetation", "signage", "infrastructure", "trash_dumping", "safety",
    ];
    if (validCategories.includes(aiAnalysis.category as IssueCategory)) {
      setCategory(aiAnalysis.category as IssueCategory);
    }
    const validSeverities: IssueSeverity[] = ["low", "medium", "high", "critical"];
    if (validSeverities.includes(aiAnalysis.severity as IssueSeverity)) {
      setSeverity(aiAnalysis.severity as IssueSeverity);
    }
    if (aiAnalysis.title) setTitle(aiAnalysis.title);
    if (aiAnalysis.description) setDescription(aiAnalysis.description);
    setAiAccepted(true);
  }, [aiAnalysis]);

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

    // Build field notes with photo timestamp + AI analysis details
    const notesParts: string[] = [];
    if (photoTimestamp) notesParts.push(`Photo taken: ${new Date(photoTimestamp).toLocaleString()}`);
    if (aiAnalysis && aiAccepted) {
      if (aiAnalysis.likelyCause) notesParts.push(`Likely cause: ${aiAnalysis.likelyCause}`);
      if (aiAnalysis.recommendedAction) notesParts.push(`Recommended: ${aiAnalysis.recommendedAction}`);
      if (aiAnalysis.equipmentNeeded) notesParts.push(`Equipment: ${aiAnalysis.equipmentNeeded}`);
      if (aiAnalysis.estimatedEffort) notesParts.push(`Effort: ${aiAnalysis.estimatedEffort}`);
      if (aiAnalysis.environmentalContext) notesParts.push(`Environment: ${aiAnalysis.environmentalContext}`);
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
      fieldNotes: notesParts.length > 0 ? notesParts.join(" | ") : null,
    };

    onSubmit(issue);
    onFieldTip?.("report-submitted", category);
    setIsUploading(false);
    setSubmitted(true);
  }, [category, severity, title, description, photoFile, photoTimestamp, aiAnalysis, aiAccepted, coords, onSubmit, onFieldTip]);

  const resetForm = useCallback(() => {
    setCategory(null);
    setSeverity("medium");
    setTitle("");
    setDescription("");
    setPhotoPreview(null);
    setPhotoFile(null);
    setCoords(null);
    setGpsStatus("idle");
    setGpsSource(null);
    setGpsAccuracy(null);
    setPhotoTimestamp(null);
    setSubmitted(false);
    setIsUploading(false);
    setAiAnalysis(null);
    setAiStatus("idle");
    setAiAccepted(false);
    setShowAiDetails(false);
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
        <p className="text-xs text-white/50">Snap a photo first — we&apos;ll extract the location for you</p>
      </div>

      <div className="flex-1 px-4 pb-4 space-y-4">
        {/* ===== 1. PHOTO CAPTURE (top of form) ===== */}
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1.5">
            Photo
            {!photoPreview && (
              <span className="ml-1 text-trail-gold/70">(recommended — auto-fills location)</span>
            )}
          </label>
          {photoPreview ? (
            <div className="relative rounded-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="Captured" className="w-full h-40 object-cover rounded-lg" />
              <button
                onClick={() => {
                  setPhotoPreview(null);
                  setPhotoFile(null);
                  setPhotoTimestamp(null);
                  setAiAnalysis(null);
                  setAiStatus("idle");
                  setAiAccepted(false);
                  setShowAiDetails(false);
                  // If GPS came from EXIF, clear it too
                  if (gpsSource === "exif") {
                    setCoords(null);
                    setGpsStatus("idle");
                    setGpsSource(null);
                    setGpsAccuracy(null);
                  }
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {/* EXIF metadata badges */}
              <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5">
                {gpsSource === "exif" && coords && (
                  <span className="flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-green-400 backdrop-blur-sm">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    GPS from photo
                  </span>
                )}
                {photoTimestamp && (
                  <span className="flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-blue-400 backdrop-blur-sm">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {new Date(photoTimestamp).toLocaleDateString()} {new Date(photoTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-trail-gold/30 bg-trail-gold/5 px-4 py-5 text-sm text-trail-gold/80 hover:border-trail-gold/50 hover:bg-trail-gold/10 transition-colors min-h-[80px]"
            >
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-medium">Take Photo or Choose from Gallery</span>
              <span className="text-[10px] text-white/40">GPS coordinates will be extracted automatically</span>
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

        {/* ===== 1b. AI PHOTO ANALYSIS ===== */}
        {aiStatus === "analyzing" && (
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-3">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs font-medium text-purple-300">AI analyzing photo...</span>
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="h-3 rounded bg-purple-500/10 animate-pulse" style={{ width: "80%" }} />
              <div className="h-3 rounded bg-purple-500/10 animate-pulse" style={{ width: "60%" }} />
              <div className="h-3 rounded bg-purple-500/10 animate-pulse" style={{ width: "70%" }} />
            </div>
          </div>
        )}

        {aiStatus === "done" && aiAnalysis && !aiAccepted && (
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-purple-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-xs font-semibold text-purple-300">AI Issue Analysis</span>
                  <span className="text-[10px] rounded-full bg-purple-500/20 px-1.5 py-0.5 text-purple-300/80">
                    {Math.round((aiAnalysis.confidence || 0) * 100)}% confident
                  </span>
                </div>
              </div>
            </div>
            <div className="px-3 py-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/40 w-16 flex-shrink-0">Category</span>
                <span className="text-xs font-medium text-white/80">
                  {ISSUE_CATEGORY_LABELS[aiAnalysis.category as IssueCategory] || aiAnalysis.category}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/40 w-16 flex-shrink-0">Severity</span>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  aiAnalysis.severity === "critical" ? "bg-red-500/20 text-red-400" :
                  aiAnalysis.severity === "high" ? "bg-orange-500/20 text-orange-400" :
                  aiAnalysis.severity === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                  "bg-green-500/20 text-green-400"
                }`}>
                  {aiAnalysis.severity}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[10px] text-white/40 w-16 flex-shrink-0 pt-0.5">Title</span>
                <span className="text-xs text-white/80">{aiAnalysis.title}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[10px] text-white/40 w-16 flex-shrink-0 pt-0.5">Details</span>
                <span className="text-xs text-white/60 leading-relaxed">{aiAnalysis.description}</span>
              </div>
              {aiAnalysis.safetyRisk && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-white/40 w-16 flex-shrink-0 pt-0.5">Safety</span>
                  <span className="text-xs text-white/60">{aiAnalysis.safetyRisk}</span>
                </div>
              )}
            </div>

            {/* Expandable details */}
            {showAiDetails && (
              <div className="px-3 pb-2.5 space-y-1.5 border-t border-purple-500/10 pt-2">
                {aiAnalysis.estimatedExtent && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-white/40 w-16 flex-shrink-0 pt-0.5">Extent</span>
                    <span className="text-xs text-white/60">{aiAnalysis.estimatedExtent}</span>
                  </div>
                )}
                {aiAnalysis.likelyCause && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-white/40 w-16 flex-shrink-0 pt-0.5">Cause</span>
                    <span className="text-xs text-white/60">{aiAnalysis.likelyCause}</span>
                  </div>
                )}
                {aiAnalysis.recommendedAction && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-white/40 w-16 flex-shrink-0 pt-0.5">Action</span>
                    <span className="text-xs text-white/60">{aiAnalysis.recommendedAction}</span>
                  </div>
                )}
                {aiAnalysis.equipmentNeeded && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-white/40 w-16 flex-shrink-0 pt-0.5">Equip.</span>
                    <span className="text-xs text-white/60">{aiAnalysis.equipmentNeeded}</span>
                  </div>
                )}
                {aiAnalysis.estimatedEffort && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-white/40 w-16 flex-shrink-0 pt-0.5">Effort</span>
                    <span className="text-xs text-white/60">{aiAnalysis.estimatedEffort}</span>
                  </div>
                )}
                {aiAnalysis.environmentalContext && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-white/40 w-16 flex-shrink-0 pt-0.5">Environ.</span>
                    <span className="text-xs text-white/60">{aiAnalysis.environmentalContext}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 px-3 pb-2.5">
              <button
                onClick={acceptAiSuggestions}
                className="flex-1 rounded-lg bg-purple-500/20 border border-purple-500/30 px-3 py-2 text-xs font-medium text-purple-300 hover:bg-purple-500/30 transition-colors min-h-[40px]"
              >
                Accept &amp; Fill Form
              </button>
              <button
                onClick={() => setShowAiDetails(!showAiDetails)}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-white/70 transition-colors min-h-[40px]"
              >
                {showAiDetails ? "Less" : "More"}
              </button>
              <button
                onClick={() => setAiStatus("idle")}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-white/70 transition-colors min-h-[40px]"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {aiAccepted && aiAnalysis && (
          <div className="flex items-center gap-2 rounded-lg bg-purple-500/10 border border-purple-500/20 px-3 py-2">
            <svg className="h-4 w-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs text-purple-300/80">AI suggestions applied — edit any field below to override</span>
          </div>
        )}

        {aiStatus === "error" && (
          <div className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
            <svg className="h-4 w-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-white/40">AI analysis unavailable — fill in the form manually</span>
          </div>
        )}

        {/* ===== 2. GPS LOCATION ===== */}
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1.5">Location</label>
          {(gpsStatus === "success" || gpsStatus === "exif") && coords ? (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
              gpsSource === "exif"
                ? "bg-blue-500/10 border border-blue-500/20"
                : "bg-green-500/10 border border-green-500/20"
            }`}>
              <svg className={`h-5 w-5 flex-shrink-0 ${gpsSource === "exif" ? "text-blue-400" : "text-green-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-mono truncate ${gpsSource === "exif" ? "text-blue-300" : "text-green-400"}`}>
                  {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                </p>
                <p className={`text-[10px] ${gpsSource === "exif" ? "text-blue-400/60" : "text-green-400/60"}`}>
                  {gpsSource === "exif"
                    ? "From photo EXIF metadata"
                    : gpsAccuracy
                      ? `±${gpsAccuracy}m accuracy (device GPS)`
                      : "Device GPS"}
                </p>
              </div>
              <button
                onClick={getLocation}
                title="Use device GPS instead"
                className={`text-xs min-h-[44px] min-w-[44px] flex items-center justify-center ${
                  gpsSource === "exif" ? "text-blue-400/60 hover:text-blue-400" : "text-green-400/60 hover:text-green-400"
                }`}
              >
                {gpsSource === "exif" ? "Use GPS" : "Refresh"}
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
                  {photoPreview ? "No GPS in photo — tap to use device GPS" : "Tap to capture GPS location"}
                </>
              )}
            </button>
          )}
        </div>

        {/* ===== 3. CATEGORY ===== */}
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

        {/* ===== 4. SEVERITY ===== */}
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

        {/* ===== 5. TITLE ===== */}
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

        {/* ===== 6. DESCRIPTION ===== */}
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

        {/* ===== 7. SUBMIT ===== */}
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
