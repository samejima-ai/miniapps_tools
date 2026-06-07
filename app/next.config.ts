import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // 開発時は SW を無効化 (HMR との干渉回避)
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // CaaF gen-2: 汎用 Core を workspace パッケージとして取り込む（TS ソースを直接トランスパイル）。
  transpilePackages: ["@caaf/core"],
  experimental: {
    // App Router は Next.js 15 で stable
  },
  webpack: (config) => {
    // @caaf/core は NodeNext 形式（相対 import に .js 拡張子）。webpack で .js → .ts/.tsx に
    // 解決できるよう extensionAlias を付与する（M-B で @caaf/core を bundle する際に必要）。
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return config;
  },
};

export default withSerwist(nextConfig);
