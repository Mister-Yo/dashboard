import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@dashboard/shared"],
  // Static export so we can deploy via Nginx without running a Next server.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
