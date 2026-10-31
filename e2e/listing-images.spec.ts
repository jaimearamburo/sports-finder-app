import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { authFile, fixtureIds } from "./fixtures";
import { query } from "./db";
import { blobExists, putTestImage } from "./blob";
import { expectNoViolations, tamperNextAction } from "./helpers";
import { LISTING_IMAGE_HOST } from "../lib/listing-images";

// Listing photos: who may get an upload permission, that a save only
// accepts a photo from the listing's own venue, and the real flow - upload,
// replace, remove - including that replaced and removed files are deleted
// from the store (GitHub #91); and that a photo shows wherever the listing
// does, with the emoji kept for listings without one (#92). The upload tests write to the
// project's Blob store, under the test venue's own folder; teardown
// removes whatever is left there (e2e/blob.ts).

const ids = () => fixtureIds();
const ROUTE = "/api/dashboard/listing-images";

// A valid 1x1 PNG: enough for Blob, next/image and the browser.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

// The request the Blob client sends to ask for an upload permission.
function askForUpload(request: APIRequestContext, venueId: string, pathname = `listings/${venueId}/photo.png`) {
  return request.post(ROUTE, {
    data: { type: "blob.generate-client-token", payload: { pathname, clientPayload: JSON.stringify({ venueId }), multipart: false } },
  });
}

async function storedImage(listingId: string): Promise<string | null> {
  const [row] = await query<{ image_url: string | null }>("select image_url from listings where id = $1", [listingId]);
  return row.image_url;
}

async function chooseFile(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  // Wait for the page's scripts first: a file chosen before React has
  // attached its change handler is silently lost. The dev server is slow
  // enough to hide this; a production build isn't.
  await page.waitForLoadState("networkidle");
  await page.locator('input[type="file"]').setInputFiles(file);
}

test.describe("upload permission", () => {
  test.describe("venue owner", () => {
    test.use({ storageState: authFile("ownerA") });

    test("is given one for their own venue", async ({ request }) => {
      const response = await askForUpload(request, ids().venueA);
      expect(response.status()).toBe(200);
      expect((await response.json()).clientToken).toEqual(expect.any(String));
    });

    test("is refused for another owner's venue", async ({ request }) => {
      const response = await askForUpload(request, ids().venueB);
      expect(response.status()).toBe(403);
    });

    test("is refused for names outside their venue's folder", async ({ request }) => {
      const { venueA, venueB } = ids();
      for (const pathname of [
        `listings/${venueB}/photo.png`,
        `listings/${venueA}/page.html`,
        `listings/${venueA}/../${venueB}/photo.png`,
        "photo.png",
      ]) {
        const response = await askForUpload(request, venueA, pathname);
        expect(response.status(), pathname).toBe(403);
      }
    });

    test("is refused for a request that isn't JSON", async ({ request }) => {
      const response = await request.post(ROUTE, { form: { type: "blob.generate-client-token" } });
      expect(response.status()).toBe(415);
    });
  });

  test.describe("regular user", () => {
    test.use({ storageState: authFile("user") });

    test("is refused", async ({ request }) => {
      expect((await askForUpload(request, ids().venueA)).status()).toBe(403);
    });
  });

  test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("is refused", async ({ request }) => {
      expect((await askForUpload(request, ids().venueA)).status()).toBe(403);
    });
  });
});

test.describe("listing photo", () => {
  test.use({ storageState: authFile("ownerA") });

  test("a save can't point a listing at another venue's photo", async ({ page }) => {
    const { listingA, venueB } = ids();
    await page.goto(`/dashboard/listings/${listingA}`);
    const foreign = `https://${LISTING_IMAGE_HOST}/listings/${venueB}/photo-x.png`;
    await tamperNextAction(page, '"imageUrl":null', `"imageUrl":"${foreign}"`, () =>
      page.getByRole("button", { name: "Save changes" }).click()
    );
    await expect(page.locator("#imageUrl-error")).toContainText("couldn't be found");
    expect(await storedImage(listingA)).toBeNull();
  });

  test("rejects a file that isn't a photo before uploading", async ({ page }) => {
    await page.goto(`/dashboard/listings/${ids().listingA}`);
    await chooseFile(page, { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.getByRole("alert").filter({ hasText: "Choose a JPEG, PNG or WebP photo." })).toBeVisible();
  });

  test("upload, replace and remove, deleting the old file each time", async ({ page }) => {
    const { listingA, venueA } = ids();
    const editor = `/dashboard/listings/${listingA}`;
    const photo = page.getByRole("img", { name: "Listing photo" });
    const save = async () => {
      await page.getByRole("button", { name: "Save changes" }).click();
      await page.waitForURL(`**/dashboard/venues/${venueA}`);
    };

    await test.step("upload", async () => {
      await page.goto(editor);
      // Served by the image optimizer from the store - proves next.config
      // allows the uploaded file's address, not just that an <img> exists.
      const optimized = page.waitForResponse(
        (response) => response.url().includes("/_next/image") && response.url().includes(encodeURIComponent(`/listings/${venueA}/`))
      );
      await chooseFile(page, { name: "court.png", mimeType: "image/png", buffer: PNG });
      await expect(photo).toBeVisible();
      const response = await optimized;
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toMatch(/^image\//);
      await expectNoViolations(page);
      await save();
    });
    const first = await storedImage(listingA);
    expect(first).toContain(`/listings/${venueA}/photo`);
    expect(await blobExists(first!)).toBe(true);

    await test.step("replace", async () => {
      await page.goto(editor);
      await expect(photo).toBeVisible();
      await chooseFile(page, { name: "court2.png", mimeType: "image/png", buffer: PNG });
      await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();
      await save();
    });
    const second = await storedImage(listingA);
    expect(second).not.toBe(first);
    expect(await blobExists(second!)).toBe(true);
    expect(await blobExists(first!)).toBe(false);

    await test.step("remove", async () => {
      await page.goto(editor);
      await page.getByRole("button", { name: "Remove photo" }).click();
      await expect(page.getByRole("button", { name: "Choose photo" })).toBeVisible();
      await save();
    });
    expect(await storedImage(listingA)).toBeNull();
    expect(await blobExists(second!)).toBe(false);
  });
});

test.describe("photos across the app", () => {
  test.use({ storageState: authFile("ownerA") });

  test("a listing's photo shows on browse, its page and the dashboard; one without keeps its emoji", async ({ page }) => {
    const { listingA, listingB, venueA } = ids();
    const image = await putTestImage(venueA, PNG);
    await query("update listings set image_url = $1 where id = $2", [image, listingA]);
    const encodedFolder = encodeURIComponent(`/listings/${venueA}/`);

    try {
      await test.step("browse card", async () => {
        await page.goto("/");
        const cardA = page.locator(`a[href="/listings/${listingA}"]`);
        await cardA.scrollIntoViewIfNeeded();
        // Decorative on the card (empty alt): the card's text names it.
        await expect(cardA.locator("img")).toHaveAttribute("src", new RegExp(`/_next/image\\?url=.*${encodedFolder}`));
        await expect(cardA.locator("img")).toHaveAttribute("alt", "");
        await expect(page.locator(`a[href="/listings/${listingB}"] img`)).toHaveCount(0);
      });

      await test.step("listing page", async () => {
        const hero = page.waitForResponse((response) => response.url().includes("/_next/image") && response.url().includes(encodedFolder));
        await page.goto(`/listings/${listingA}`);
        await expect(page.getByRole("img", { name: "E2E Court A at E2E Venue A" })).toBeVisible();
        expect((await hero).status()).toBe(200);
      });

      await test.step("dashboard thumbnail", async () => {
        await page.goto(`/dashboard/venues/${venueA}`);
        await expect(page.locator("table img").first()).toHaveAttribute("src", new RegExp(encodedFolder));
      });
    } finally {
      // The file itself goes with the test venue's folder at teardown.
      await query("update listings set image_url = null where id = $1", [listingA]);
    }
  });
});
