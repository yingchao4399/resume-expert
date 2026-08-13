import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 blocks development assets requested from a hostname that was
  // not used to start the server. The app is intentionally local-only and is
  // documented for both loopback spellings.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
