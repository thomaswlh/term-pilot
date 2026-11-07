import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 rewrites AGENTS.md on dev unless this is off. The course file stays as written.
  agentRules: false,
};
export default nextConfig;
