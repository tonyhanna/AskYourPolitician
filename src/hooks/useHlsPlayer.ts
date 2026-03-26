"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { getMuxStreamUrl } from "@/lib/mux";

/**
 * Reusable hook that attaches hls.js to a <video> element for Mux HLS playback.
 *
 * - In browsers with MSE support (Chrome, Firefox, Edge): uses hls.js
 * - In Safari (native HLS support): sets video.src directly
 * - Returns { hlsRef, isReady, play } for manual control
 *
 * `isReady` becomes true once HLS manifest is parsed / source is loaded.
 * Call `play()` to start playback (auto-waits for ready if not yet).
 */
export function useHlsPlayer(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  playbackId: string | null | undefined,
  opts?: { autoplay?: boolean }
) {
  const hlsRef = useRef<Hls | null>(null);
  const [isReady, setIsReady] = useState(false);
  const pendingPlayRef = useRef(false);

  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isReady) {
      video.play().catch(() => {});
    } else {
      // HLS not ready yet — queue the play for when it's ready
      pendingPlayRef.current = true;
    }
  }, [isReady, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackId) {
      setIsReady(false);
      return;
    }

    const streamUrl = getMuxStreamUrl(playbackId);

    if (Hls.isSupported()) {
      const hls = new Hls({
        startLevel: -1,
        maxBufferLength: 15,
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsReady(true);
        if (opts?.autoplay || pendingPlayRef.current) {
          pendingPlayRef.current = false;
          video.play().catch(() => {});
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
        setIsReady(false);
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = streamUrl;

      video.addEventListener("loadedmetadata", () => {
        setIsReady(true);
        if (opts?.autoplay || pendingPlayRef.current) {
          pendingPlayRef.current = false;
          video.play().catch(() => {});
        }
      }, { once: true });

      return () => {
        video.src = "";
        setIsReady(false);
      };
    }
  }, [playbackId, opts?.autoplay]);

  return { hlsRef, isReady, play };
}
