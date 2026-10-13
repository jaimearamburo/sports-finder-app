import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow local server to accept requests for its internal resources (HMR,
  // RSC payloads) when opened from another device on the same network via
  // its LAN IP, so we can access the app from a phone/tablet/laptop for
  // local testing. Wildcarded across the whole subnet rather than listing
  // each device's IP individually, since DHCP can reassign those anyway.
  allowedDevOrigins: ["192.168.1.*"],
};

export default nextConfig;
