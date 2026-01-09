import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TODO: Fix Supabase type inference issues and remove this
  typescript: {
    ignoreBuildErrors: true,
  },
  // Allow hot reload from local network IP
  allowedDevOrigins: ["http://192.168.1.33:3001", "http://192.168.1.33:3000"],
};

export default nextConfig;
