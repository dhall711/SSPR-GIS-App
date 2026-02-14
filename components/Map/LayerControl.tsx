"use client";

import { useState, useRef, useEffect } from "react";
import { LayerVisibility, OverlayLayerId } from "@/lib/types";

interface LayerControlProps {
  visibility: LayerVisibility;
  onToggle: (layerId: OverlayLayerId) => void;
}

const LAYER_OPTIONS: { id: OverlayLayerId; label: string; color: string; available: boolean; phase?: string }[] = [
  { id: "district-boundary", label: "District Boundary", color: "#2d6a4f", available: true },
  { id: "trails", label: "Trails", color: "#e63946", available: true },
  { id: "parks", label: "Parks & Facilities", color: "#52b788", available: true },
  { id: "waterways", label: "Waterways", color: "#219ebc", available: true },
  { id: "municipal-boundaries", label: "Municipal Boundaries", color: "#6c757d", available: false, phase: "Phase 2" },
  { id: "maintenance-issues", label: "Maintenance Issues", color: "#fb923c", available: true },
  { id: "riparian-buffers", label: "Riparian Buffers", color: "#52b788", available: true },
  { id: "heatmap", label: "Disturbance Heatmap", color: "#ef4444", available: true },
];

export function LayerControl({ visibility, onToggle }: LayerControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-md hover:bg-gray-50 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        Layers
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 rounded-lg bg-white shadow-lg border border-gray-200 p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Overlay Layers
          </h3>
          <div className="space-y-1">
            {LAYER_OPTIONS.map((layer) => (
              <label
                key={layer.id}
                className={`flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors ${
                  layer.available
                    ? "cursor-pointer hover:bg-gray-50"
                    : "cursor-not-allowed opacity-40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={layer.available ? visibility[layer.id] : false}
                  onChange={() => layer.available && onToggle(layer.id)}
                  disabled={!layer.available}
                  className="h-4 w-4 rounded border-gray-300"
                  style={{ accentColor: layer.color }}
                />
                <span
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: layer.color }}
                />
                <span className="text-sm text-gray-700">
                  {layer.label}
                  {!layer.available && (
                    <span className="ml-1 text-[10px] text-gray-400">{layer.phase}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
