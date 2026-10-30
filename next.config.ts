import type { NextConfig } from "next";
import { LISTING_IMAGE_FOLDER, LISTING_IMAGE_HOST } from "./lib/listing-images";

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
    // hostname is set in lib/listing-images.ts, which the upload and save
    // checks use too.
    remotePatterns: [
      {
        protocol: "https",
        hostname: LISTING_IMAGE_HOST,
        pathname: `/${LISTING_IMAGE_FOLDER}/**`,
        search: "",
      },
    ],
    // How long a resized copy is kept before the optimizer makes it again.
    // A listing photo's URL never changes its content (each upload gets a
    // new random name, and overwriting is off), so the copies can be kept
    // for a month: browsing reuses them instead of re-resizing, which is
    // faster and uses less of the image optimization quota. A replaced
    // photo has a new URL, so it shows straight away regardless.
    minimumCacheTTL: 60 * 60 * 24 * 31,
  },
};

export default nextConfig;
