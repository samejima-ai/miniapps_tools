import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // App Router は Next.js 15 で stable
  },
  // PWA 対応は L1 で next-pwa or serwist 導入を検討（MVP では manifest のみ）
};

export default nextConfig;
