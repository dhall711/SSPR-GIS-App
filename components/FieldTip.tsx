"use client";

import { useState, useEffect, useCallback } from "react";
import { FieldTip as FieldTipType } from "@/lib/types";

// Contextual GIS tips triggered by user actions
const FIELD_TIP_DATABASE: Record<string, { message: string; lessonId: number | null }> = {
  // Layer interactions
  "layer-toggle": {
    message: "You're doing spatial analysis right now -- comparing layers to find patterns. That's the core of GIS. Lesson 1 explains why this is so powerful.",
    lessonId: 1,
  },
  "all-layers-on": {
    message: "Seeing all layers at once reveals relationships invisible on any single map. Professional GIS analysts do exactly this when looking for patterns.",
    lessonId: 1,
  },

  // GPS / Location
  "gps-capture": {
    message: "You just used WGS84 coordinates from GPS satellites to mark your location. That's the same coordinate system used worldwide. Lesson 2 digs deeper.",
    lessonId: 2,
  },

  // Reporting
  "report-submitted": {
    message: "You just created a point feature with attributes -- GPS location, category, severity, description, photo. That's professional GIS data collection. Lesson 3 explains why this matters.",
    lessonId: 3,
  },
  "category-select": {
    message: "Choosing a standardized category is classification -- one of the most important GIS concepts. Consistent categories let you filter, count, and analyze patterns across all reports.",
    lessonId: 3,
  },

  // Category-specific tips
  "category-select:erosion": {
    message: "Erosion issues concentrate near waterways -- that's a spatial pattern. GIS buffer analysis (Lesson 8) reveals these clusters and helps predict where the next washout will happen.",
    lessonId: 8,
  },
  "category-select:graffiti": {
    message: "Graffiti often clusters near parking lots and underpasses -- access points. Spatial analysis can prove these patterns and justify security camera placement.",
    lessonId: 9,
  },
  "category-select:snow_ice": {
    message: "North-facing slopes and shaded areas hold ice longer -- that's aspect analysis, a GIS terrain concept. Lesson 6 explains how slope and aspect predict maintenance needs.",
    lessonId: 6,
  },
  "category-select:trail_surface": {
    message: "Trail surface damage often follows drainage patterns. If water channels down the trail instead of draining off, the trail grade needs correction. That's terrain analysis.",
    lessonId: 6,
  },

  // Work queue
  "view-issue": {
    message: "Each issue you view has spatial attributes -- coordinates, trail association, and proximity to features. Over time, these attributes reveal where your district needs the most attention.",
    lessonId: 3,
  },
  "sort-proximity": {
    message: "Sorting by proximity uses your GPS coordinates to find the nearest issues. This is a spatial query -- the same type of operation professional GIS systems run on databases.",
    lessonId: 2,
  },

  // Maintenance layer
  "maintenance-layer-on": {
    message: "You just added the maintenance layer to the map. The color coding shows severity -- that's thematic mapping. Overlay it with waterways to spot erosion patterns.",
    lessonId: 7,
  },
};

interface FieldTipProps {
  currentTip: FieldTipType | null;
  onDismiss: () => void;
}

export function FieldTipBanner({ currentTip, onDismiss }: FieldTipProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (currentTip) {
      setIsVisible(true);
      // Auto-dismiss after 12 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onDismiss, 300); // Wait for animation
      }, 12000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [currentTip, onDismiss]);

  if (!currentTip) return null;

  return (
    <div
      className={`fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 transition-all duration-300 ${
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0 pointer-events-none"
      }`}
    >
      <div className="rounded-xl bg-trail-green-dark/95 backdrop-blur-sm border border-eco-riparian/30 shadow-lg px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-eco-riparian/20">
              <svg className="h-4 w-4 text-eco-riparian" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-eco-riparian uppercase tracking-wider mb-0.5">
              Field Tip
              {currentTip.lessonId && (
                <span className="ml-1.5 text-eco-riparian/60">• Lesson {currentTip.lessonId}</span>
              )}
            </p>
            <p className="text-xs text-white/80 leading-relaxed">{currentTip.message}</p>
          </div>
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onDismiss, 300);
            }}
            className="flex-shrink-0 rounded-full p-1 text-white/40 hover:text-white/80 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook to manage field tip state and triggering
export function useFieldTips() {
  const [currentTip, setCurrentTip] = useState<FieldTipType | null>(null);
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set());
  const [tipCooldown, setTipCooldown] = useState(false);

  const triggerFieldTip = useCallback(
    (trigger: string, context?: string) => {
      if (tipCooldown) return; // Don't show tips too frequently

      // Try specific key first (e.g., "category-select:erosion"), then generic
      const specificKey = context ? `${trigger}:${context}` : trigger;
      const tipData = FIELD_TIP_DATABASE[specificKey] || FIELD_TIP_DATABASE[trigger];

      if (!tipData) return;
      if (dismissedTips.has(specificKey) || dismissedTips.has(trigger)) return;

      const tip: FieldTipType = {
        id: `${trigger}-${Date.now()}`,
        message: tipData.message,
        lessonId: tipData.lessonId,
        trigger: specificKey,
      };

      setCurrentTip(tip);
      setTipCooldown(true);

      // Cooldown: don't show another tip for 30 seconds
      setTimeout(() => setTipCooldown(false), 30000);
    },
    [tipCooldown, dismissedTips]
  );

  const dismissTip = useCallback(() => {
    if (currentTip) {
      setDismissedTips((prev) => new Set([...prev, currentTip.trigger]));
      setCurrentTip(null);
    }
  }, [currentTip]);

  return { currentTip, triggerFieldTip, dismissTip };
}
