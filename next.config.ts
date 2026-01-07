import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TODO: Fix Supabase type inference issues and remove this
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
