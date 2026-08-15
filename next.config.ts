import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
   allowedDevOrigins: [
    "192.168.1.10",
    "192.168.1.*",
  ],
};

export default nextConfig;
