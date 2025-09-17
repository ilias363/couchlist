import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    reactCompiler: true,
  },
  images: {
    remotePatterns: [new URL("https://image.tmdb.org/**")],
  },
};

export default nextConfig;
