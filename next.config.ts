import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle the WMI logo into the audit route's serverless function so the
  // generated .docx cover renders the logo in production (graceful text
  // fallback if absent).
  outputFileTracingIncludes: {
    "/api/audit/[clientId]": ["./src/lib/audit/assets/**"],
    "/api/feed-audit/[clientId]": ["./src/lib/audit/assets/**"],
  },
};

export default nextConfig;
