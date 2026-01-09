import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TODO: Fix Supabase type inference issues and remove this
  typescript: {
    ignoreBuildErrors: true,
  },
  // Allow hot reload from local network IP
  allowedDevOrigins: ["http://192.168.0.19:3001"],
};

export default nextConfig;
