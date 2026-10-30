import { describe, expect, it } from "vitest";
import {
  LISTING_IMAGE_HOST,
  LISTING_IMAGE_MAX_BYTES,
  isUploadPathnameForVenue,
  isVenueImageUrl,
  listingImageFileError,
  listingImagePathname,
} from "@/lib/listing-images";

const VENUE = "cmvenuea123";
const OTHER = "cmvenueb456";
const url = (path: string, host = LISTING_IMAGE_HOST) => `https://${host}${path}`;

describe("listingImageFileError", () => {
  it("accepts JPEG, PNG and WebP up to the limit", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(listingImageFileError({ type, size: LISTING_IMAGE_MAX_BYTES })).toBeNull();
    }
  });

  it("rejects other types, including SVG and GIF", () => {
    for (const type of ["image/svg+xml", "image/gif", "text/html", ""]) {
      expect(listingImageFileError({ type, size: 100 })).toMatch(/JPEG, PNG or WebP/);
    }
  });

  it("rejects files over the limit", () => {
    expect(listingImageFileError({ type: "image/png", size: LISTING_IMAGE_MAX_BYTES + 1 })).toMatch(/over 4 MB/);
  });
});

describe("isUploadPathnameForVenue", () => {
  it("allows exactly the names the form uses, in the venue's own folder", () => {
    expect(isUploadPathnameForVenue(listingImagePathname(VENUE, "image/jpeg"), VENUE)).toBe(true);
    expect(isUploadPathnameForVenue(`listings/${VENUE}/photo.webp`, VENUE)).toBe(true);
  });

  it("refuses another venue's folder, other names and other places", () => {
    expect(isUploadPathnameForVenue(listingImagePathname(OTHER, "image/png"), VENUE)).toBe(false);
    expect(isUploadPathnameForVenue(`listings/${VENUE}/page.html`, VENUE)).toBe(false);
    expect(isUploadPathnameForVenue(`listings/${VENUE}/photo.svg`, VENUE)).toBe(false);
    expect(isUploadPathnameForVenue(`listings/${VENUE}/../${OTHER}/photo.png`, VENUE)).toBe(false);
    expect(isUploadPathnameForVenue("photo.png", VENUE)).toBe(false);
  });
});

describe("isVenueImageUrl", () => {
  it("accepts a photo in the venue's folder in our store", () => {
    expect(isVenueImageUrl(url(`/listings/${VENUE}/photo-AbC123.jpg`), VENUE)).toBe(true);
  });

  it("refuses another venue's photo", () => {
    expect(isVenueImageUrl(url(`/listings/${OTHER}/photo-AbC123.jpg`), VENUE)).toBe(false);
    // ".." is resolved before checking, so it can't climb out of the folder.
    expect(isVenueImageUrl(url(`/listings/${VENUE}/../${OTHER}/photo.jpg`), VENUE)).toBe(false);
  });

  it("refuses other hosts, other stores and plain http", () => {
    expect(isVenueImageUrl(url(`/listings/${VENUE}/photo.jpg`, "evil.example.com"), VENUE)).toBe(false);
    expect(isVenueImageUrl(url(`/listings/${VENUE}/photo.jpg`, "other.public.blob.vercel-storage.com"), VENUE)).toBe(false);
    expect(isVenueImageUrl(`http://${LISTING_IMAGE_HOST}/listings/${VENUE}/photo.jpg`, VENUE)).toBe(false);
    expect(isVenueImageUrl(`https://${LISTING_IMAGE_HOST}:8443/listings/${VENUE}/photo.jpg`, VENUE)).toBe(false);
  });

  it("refuses query strings, fragments, subfolders and non-URLs", () => {
    expect(isVenueImageUrl(url(`/listings/${VENUE}/photo.jpg?x=1`), VENUE)).toBe(false);
    expect(isVenueImageUrl(url(`/listings/${VENUE}/photo.jpg#x`), VENUE)).toBe(false);
    expect(isVenueImageUrl(url(`/listings/${VENUE}/sub/photo.jpg`), VENUE)).toBe(false);
    expect(isVenueImageUrl(url(`/listings/${VENUE}/`), VENUE)).toBe(false);
    expect(isVenueImageUrl("not a url", VENUE)).toBe(false);
    expect(isVenueImageUrl("javascript:alert(1)", VENUE)).toBe(false);
  });
});
