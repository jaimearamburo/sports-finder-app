"use client";

import { useRef, useState, type DragEvent } from "react";
import Image from "next/image";
import { upload } from "@vercel/blob/client";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LISTING_IMAGE_TYPES,
  isListingImageType,
  listingImageFileError,
  listingImagePathname,
} from "@/lib/listing-images";

const ACCEPT = Object.keys(LISTING_IMAGE_TYPES).join(",");
// The photo is cropped to fill the browse card's image area, so the form
// shows it in a frame of a similar shape.
const FRAME_CLASS = "relative aspect-[16/9] w-full max-w-md overflow-hidden rounded-lg";

// The listing form's photo field. Choosing (or dropping) a file uploads it
// straight to Vercel Blob - see lib/listing-images.ts for how the upload
// is authorised - and hands its URL to the form, which stores it when the
// listing is saved. Replace and Remove only change the form; the old file
// is deleted by the server once the save goes through.
//
// Files are checked here first (type, size) so a wrong one fails at once
// with a clear message, but the upload permission enforces the same limits.
export function ListingImageField({
  venueId,
  value,
  onChange,
  onUploadingChange,
  error,
  describedBy,
}: {
  venueId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  // The form can't be saved mid-upload: it would save without the photo.
  onUploadingChange: (uploading: boolean) => void;
  // From the server's check on save (e.g. the file is gone).
  error?: string;
  describedBy?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // What a screen reader hears as an upload starts, ends or fails.
  const [status, setStatus] = useState("");

  const uploading = progress !== null;
  const shownError = localError ?? error;

  async function start(file: File) {
    const problem = listingImageFileError(file);
    if (problem || !isListingImageType(file.type)) {
      setLocalError(problem ?? "Choose a JPEG, PNG or WebP photo.");
      setStatus("");
      return;
    }
    setLocalError(null);
    setProgress(0);
    setStatus("Uploading photo.");
    onUploadingChange(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const blob = await upload(listingImagePathname(venueId, file.type), file, {
        access: "public",
        handleUploadUrl: "/api/dashboard/listing-images",
        clientPayload: JSON.stringify({ venueId }),
        contentType: file.type,
        abortSignal: controller.signal,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      onChange(blob.url);
      setStatus("Photo uploaded. Save the listing to keep it.");
    } catch {
      if (controller.signal.aborted) {
        setStatus("Upload cancelled.");
      } else {
        // The Blob client doesn't pass on the server's reason, so one
        // message covers a refused permission and a failed transfer.
        setLocalError("The photo couldn't be uploaded. Check your connection and try again.");
        setStatus("");
      }
    } finally {
      abortRef.current = null;
      setProgress(null);
      onUploadingChange(false);
    }
  }

  function choose() {
    inputRef.current?.click();
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (uploading) return;
    const file = e.dataTransfer.files[0];
    if (file) void start(file);
  }

  const dropHandlers = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      if (!uploading) setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: handleDrop,
  };

  return (
    // Named by the field's label (Field with labelFor={null}). The main
    // button carries the field's id, so an error on save moves focus to it.
    <div role="group" aria-labelledby="imageUrl-label" className="flex flex-col gap-3">
      {/* Not shown; the buttons open it. Reset after each pick so choosing
          the same file again still fires a change. */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void start(file);
        }}
      />

      {value && !uploading ? (
        <div className={cn(FRAME_CLASS, "border bg-muted")} {...dropHandlers}>
          <Image src={value} alt="Listing photo" fill sizes="(min-width: 640px) 28rem, 100vw" className="object-cover" />
          {dragging && <DropOverlay />}
        </div>
      ) : (
        <div
          {...dropHandlers}
          className={cn(
            FRAME_CLASS,
            "flex flex-col items-center justify-center gap-2 border-2 border-dashed px-4 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-input bg-muted/30",
            shownError && !dragging && "border-destructive/60"
          )}
        >
          {uploading ? (
            <div className="flex w-full max-w-56 flex-col items-center gap-2">
              <p className="text-sm font-medium tabular-nums">Uploading... {progress}%</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <ImagePlus aria-hidden className="size-7 text-muted-foreground" />
              {/* Dragging is a desktop thing; phones just get the button. */}
              <p className="hidden text-sm text-muted-foreground sm:block">Drag a photo here, or</p>
              <Button
                id="imageUrl"
                type="button"
                variant="outline"
                size="sm"
                onClick={choose}
                aria-describedby={describedBy}
                aria-invalid={!!shownError}
              >
                Choose photo
              </Button>
              <p className="text-xs text-muted-foreground">JPEG, PNG or WebP, up to 4 MB</p>
            </>
          )}
        </div>
      )}

      {value && !uploading && (
        <div className="flex flex-wrap gap-2">
          <Button id="imageUrl" type="button" variant="outline" size="sm" onClick={choose} aria-describedby={describedBy}>
            Replace photo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onChange(null);
              setLocalError(null);
              setStatus("Photo removed. Save the listing to apply it.");
            }}
          >
            Remove photo
          </Button>
        </div>
      )}

      {localError && (
        <p role="alert" className="text-sm text-destructive">
          {localError}
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {status}
      </p>
    </div>
  );
}

function DropOverlay() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-background/80 text-sm font-medium">
      Drop to replace the photo
    </div>
  );
}
