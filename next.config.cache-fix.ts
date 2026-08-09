import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep your existing Next.js options here.
  experimental: {
    // Next.js 16.1+ enables Turbopack filesystem persistence for development
    // by default. Disable it while diagnosing concurrent write/compaction errors.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
