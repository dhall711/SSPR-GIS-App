"use client";

import { useState, useRef, useEffect } from "react";
import { BasemapOption, BasemapId } from "@/lib/types";

interface BasemapSelectorProps {
  basemaps: BasemapOption[];
  activeId: BasemapId;
  onChange: (id: BasemapId) => void;
}

export function BasemapSelector({ basemaps, activeId, onChange }: BasemapSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const active = basemaps.find((b) => b.id === activeId);

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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        {active?.name || "Basemap"}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 rounded-lg bg-white shadow-lg border border-gray-200 overflow-hidden">
          {basemaps.map((basemap) => (
            <button
              key={basemap.id}
              onClick={() => {
                onChange(basemap.id);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                basemap.id === activeId
                  ? "bg-trail-green text-white font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {basemap.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
