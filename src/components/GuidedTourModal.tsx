"use client";

import { useEffect, useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { PlayableMediaCard } from "./PlayableMediaCard";

export function GuidedTourModal({
  muxPlaybackId,
  muxAssetStatus,
  muxMediaType,
  duration,
  aspectRatio,
  posterUrl,
}: {
  muxPlaybackId: string | null;
  muxAssetStatus: string | null;
  muxMediaType: string | null;
  duration: number | null;
  aspectRatio: number | null;
  posterUrl: string | null;
}) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  // Listen for open event from info button
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-guided-tour", handler);
    return () => window.removeEventListener("open-guided-tour", handler);
  }, []);

  // Listen for video ended → close modal
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener("guided-tour-ended", handler);
    return () => window.removeEventListener("guided-tour-ended", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  if (!open || !muxPlaybackId) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 100, backgroundColor: "rgba(0, 0, 0, 0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="relative w-full"
        style={{ maxWidth: 640 }}
      >
        <button
          type="button"
          onClick={close}
          className="absolute -top-10 right-0 cursor-pointer hover:opacity-70 transition-opacity"
          style={{ color: "#fff", fontSize: 24 }}
          aria-label="Luk"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
        <PlayableMediaCard
          question={{
            id: "guided-tour",
            answerPhotoUrl: posterUrl,
            answerDuration: duration,
            muxPlaybackId,
            muxAssetStatus,
            muxMediaType,
          }}
          autoPlay
          onEnded={close}
          className="rounded-2xl overflow-hidden"
        />
      </div>
    </div>
  );
}
