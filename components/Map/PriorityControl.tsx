"use client";

import { useState, useCallback } from "react";
import type { PriorityWeights } from "@/components/Layers/PriorityZonesLayer";
import { DEFAULT_PRIORITY_WEIGHTS } from "@/components/Layers/PriorityZonesLayer";

interface PriorityControlProps {
  weights: PriorityWeights;
  onWeightsChange: (weights: PriorityWeights) => void;
  isVisible: boolean;
}

const WEIGHT_LABELS: { key: keyof PriorityWeights; label: string; description: string; color: string }[] = [
  { key: "issueDensity", label: "Issue Density", description: "More issues in area = higher priority", color: "#ef4444" },
  { key: "waterProximity", label: "Water Proximity", description: "Near waterways = erosion/flood risk", color: "#38bdf8" },
  { key: "severityFactor", label: "Severity", description: "Critical & high severity issues", color: "#f97316" },
  { key: "recurrence", label: "Recurrence", description: "Multiple issue types in same area", color: "#a78bfa" },
];

export function PriorityControl({ weights, onWeightsChange, isVisible }: PriorityControlProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSliderChange = useCallback(
    (key: keyof PriorityWeights, value: number) => {
      onWeightsChange({ ...weights, [key]: value });
    },
    [weights, onWeightsChange]
  );

  const handleReset = useCallback(() => {
    onWeightsChange(DEFAULT_PRIORITY_WEIGHTS);
  }, [onWeightsChange]);

  // Normalize weights to sum to 1
  const handleNormalize = useCallback(() => {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    if (total === 0) return;
    const normalized: PriorityWeights = {
      issueDensity: weights.issueDensity / total,
      waterProximity: weights.waterProximity / total,
      severityFactor: weights.severityFactor / total,
      recurrence: weights.recurrence / total,
    };
    onWeightsChange(normalized);
  }, [weights, onWeightsChange]);

  if (!isVisible) return null;

  return (
    <div className="rounded-lg bg-white shadow-lg border border-gray-200 overflow-hidden" style={{ width: 240 }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Priority Weights
        </div>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 pt-2">
            Adjust weights to change how priority zones are calculated. Higher weight = more influence.
          </p>

          {WEIGHT_LABELS.map(({ key, label, description, color }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-xs font-medium text-gray-600">{label}</label>
                <span className="text-xs font-mono text-gray-400">
                  {(weights[key] * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(weights[key] * 100)}
                onChange={(e) => handleSliderChange(key, Number(e.target.value) / 100)}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${color} ${weights[key] * 100}%, #e5e7eb ${weights[key] * 100}%)`,
                }}
              />
              <p className="text-[9px] text-gray-400">{description}</p>
            </div>
          ))}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleNormalize}
              className="flex-1 rounded bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Normalize to 100%
            </button>
            <button
              onClick={handleReset}
              className="flex-1 rounded bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Reset Defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
