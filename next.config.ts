import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  // WSL/Docker: native file watcher fails on mounted fs; polling fixes hot reload
  watchOptions: { pollIntervalMs: 1000 },
};

export default nextConfig;
