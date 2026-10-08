import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow local server ot accept requests for its internal resources (HMR,
  // RSC payloads) when opened from a phone/tablet on the same network via
  // its LAN IP, So we can access the app from the mobile for local testing
  allowedDevOrigins: ["192.168.1.154"],
};

export default nextConfig;
