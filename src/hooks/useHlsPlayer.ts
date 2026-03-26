"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";
import { getMuxStreamUrl } from "@/lib/mux";

/**
 * Reusable hook that attaches hls.js to a <video> element for Mux HLS playback.
 *
 * - In browsers with MSE support (Chrome, Firefox, Edge): uses hls.js
 * - In Safari (native HLS support): sets video.src directly
 * - Returns a ref to the Hls instance for manual control if needed
 *
 * Usage:
 *   const videoRef = useRef<HTMLVideoElement>(null);
 *   useHlsPlayer(videoRef, playbackId);
 */
export function useHlsPlayer(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  playbackId: string | null | undefined,
  opts?: { autoplay?: boolean }
) {
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackId) return;

    const streamUrl = getMuxStreamUrl(playbackId);

    if (Hls.isSupported()) {
      const hls = new Hls({
        // Start with a reasonable quality, let ABR adjust
        startLevel: -1,
        // Reduce buffer for faster start
        maxBufferLength: 15,
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;

      if (opts?.autoplay) {
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
      }

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = streamUrl;

      if (opts?.autoplay) {
        video.addEventListener("loadedmetadata", () => {
          video.play().catch(() => {});
        }, { once: true });
      }

      return () => {
        video.src = "";
      };
    }
  }, [playbackId, opts?.autoplay]);

  return hlsRef;
}
