"use client";

interface CoordinateDisplayProps {
  coords: { lat: number; lng: number } | null;
}

export function CoordinateDisplay({ coords }: CoordinateDisplayProps) {
  if (!coords) return null;

  return (
    <div className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-mono text-gray-600 shadow-md backdrop-blur">
      <span className="text-gray-400">Lat:</span>{" "}
      <span className="font-medium">{coords.lat.toFixed(6)}</span>
      <span className="mx-2 text-gray-300">|</span>
      <span className="text-gray-400">Lng:</span>{" "}
      <span className="font-medium">{coords.lng.toFixed(6)}</span>
    </div>
  );
}
