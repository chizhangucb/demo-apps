import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  agentRules: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The local dcf.py path spawns python/runner.py; keep it in the server bundle trace.
  outputFileTracingIncludes: { "/api/value": ["./python/**"], "/api/research": ["./python/**"] },
};

export default nextConfig;
