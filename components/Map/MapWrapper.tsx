"use client";

import dynamic from "next/dynamic";
import { LayerVisibility, OverlayLayerId } from "@/lib/types";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-sidebar-bg">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-trail-green" />
        <p className="mt-4 text-sm text-gray-400">Loading map...</p>
      </div>
    </div>
  ),
});

interface MapWrapperProps {
  layerVisibility: LayerVisibility;
  onLayerToggle: (layerId: OverlayLayerId) => void;
  onFeatureSelect: (feature: { type: string; id: string; name: string } | null) => void;
  highlightFeatureId?: string | null;
  flyTo?: { lat: number; lng: number; zoom?: number } | null;
}

export function MapWrapper(props: MapWrapperProps) {
  return <MapView {...props} />;
}
