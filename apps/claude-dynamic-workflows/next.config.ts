import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // The workflow scripts under data/tasks/ are read as text at request time by /api/run.
  outputFileTracingIncludes: {
    "/api/run": ["./data/tasks/**/*"],
    "/": ["./data/tasks/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
