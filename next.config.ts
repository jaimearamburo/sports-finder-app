import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow local server to accept requests for its internal resources (HMR,
  // RSC payloads) when opened from another device on the same network via
  // its LAN IP, so we can access the app from a phone/tablet/laptop for
  // local testing. Wildcarded across the whole subnet rather than listing
  // each device's IP individually, since DHCP can reassign those anyway.
  allowedDevOrigins: ["192.168.1.*"],

  images: {
    // Listing photos live in this project's public Vercel Blob store. Only
    // that store, and only its listings/ folder, may go through next/image:
    // the optimizer fetches and resizes whatever URL it's given, so a
    // wildcard like *.public.blob.vercel-storage.com would let anyone use
    // our optimizer (and its quota) on files in any Blob store. The
    // hostname isn't a secret - it's in every image URL - but it is tied
    // to the store: a new store means updating it here.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "gyxokpanddvb8lgw.public.blob.vercel-storage.com",
        pathname: "/listings/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;
