import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const base = "/aj-build-drone.github.io";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? base : "",
  assetPrefix: isProd ? base + "/" : "",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
