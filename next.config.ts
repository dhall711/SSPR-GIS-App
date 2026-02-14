import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Suppress Leaflet SSR warnings
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

export default nextConfig;
