import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Heavy SDK + native Codex runtime: load from node_modules at runtime, only on the live path.
  serverExternalPackages: ["@openai/codex-security", "@openai/codex-sdk", "@openai/codex"],
  // Ship the canned sample with the serverless functions so it can be verified/scanned on Vercel.
  outputFileTracingIncludes: {
    "/api/scan": ["./samples/**/*"],
    "/api/patch": ["./samples/**/*"],
  },
  // On Vercel the ~370 MB native Codex binary would blow the function size cap, and the
  // runtime has no Python/git anyway — the scripted path serves there; live runs locally.
  ...(process.env.VERCEL
    ? {
        outputFileTracingExcludes: {
          "*": ["node_modules/@openai/codex-{linux,darwin,win32}-*/**"],
        },
      }
    : {}),
};

export default nextConfig;
