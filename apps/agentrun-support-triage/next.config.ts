import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the AgentRun packages as plain Node modules on the server (they read
  // their own files and schemas at runtime).
  devIndicators: false,
  serverExternalPackages: ['@parcha/agentrun-dsl', '@parcha/agentrun-jev'],
};

export default nextConfig;
