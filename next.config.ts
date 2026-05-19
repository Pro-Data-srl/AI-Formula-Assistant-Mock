import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to the project. Without this, Turbopack walks
  // up the directory tree to infer a root and ends up watching the whole
  // `C:\Users\<user>\Documents` folder, which on German Windows installs contains
  // the legacy "Eigene Bilder" junction (My Pictures) that is not user-readable
  // and produces NotFound / PermissionDenied watcher errors.
  // `process.cwd()` is used instead of `__dirname` because next.config.ts is
  // loaded as an ES module where `__dirname` is not defined.
  turbopack: {
    root: process.cwd(),
  },
  // WSL/Docker: native file watcher fails on mounted fs; polling fixes hot reload
  watchOptions: { pollIntervalMs: 1000 },
};

export default nextConfig;
