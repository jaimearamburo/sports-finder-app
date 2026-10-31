import type { NextConfig } from "next";
import { LISTING_IMAGE_FOLDER, LISTING_IMAGE_HOST } from "./lib/listing-images";

const nextConfig: NextConfig = {
  // Lets other devices on the LAN load dev-server resources (HMR, RSC payloads)
  // for testing on phones and tablets.
  allowedDevOrigins: ["192.168.1.*"],

  images: {
    // Only this store's listings/ folder may go through next/image: the
    // optimiser fetches any URL it's given, so a Blob-wide wildcard would let
    // anyone use our quota. The hostname comes from lib/listing-images.ts.
    remotePatterns: [
      {
        protocol: "https",
        hostname: LISTING_IMAGE_HOST,
        pathname: `/${LISTING_IMAGE_FOLDER}/**`,
        search: "",
      },
    ],
    // Resized copies are kept for a month: a photo URL never changes content
    // (random names, no overwrite), and a replaced photo gets a new URL.
    minimumCacheTTL: 60 * 60 * 24 * 31,
  },
};

export default nextConfig;
