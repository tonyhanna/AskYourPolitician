"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay } from "@fortawesome/free-solid-svg-icons";
import { getAnswerMediaInfo } from "@/lib/answer-utils";
import { getMuxThumbnailUrl, getMuxMp4Url } from "@/lib/mux";
import { useHlsPlayer } from "@/hooks/useHlsPlayer";

type PlayableMediaCardProps = {
  question: {
    id: string;
    answerPhotoUrl: string | null;
    answerDuration: number | null;
    muxPlaybackId?: string | null;
    muxAssetStatus?: string | null;
    muxMediaType?: string | null;
  };
  partyColor?: string | null;
  partyColorDark?: string | null;
  bufferingColor?: string | null;
  playingId?: string | null;
  setPlayingId?: (id: string | null) => void;
  className?: string;
  style?: React.CSSProperties;
};

export function PlayableMediaCard({
  question,
  partyColor,
  partyColorDark,
  bufferingColor,
  playingId,
  setPlayingId,
  className = "",
  style,
}: PlayableMediaCardProps) {
  const mediaInfo = getAnswerMediaInfo(question);
  const isReady = mediaInfo?.status === "ready";
  const isPreparing = mediaInfo?.status === "preparing";
  const hasVideoAnswer = mediaInfo?.type === "video";
  const hasAudioAnswer = mediaInfo?.type === "audio";
  const hasPlayableMedia = isReady && (hasVideoAnswer || hasAudioAnswer);

  const muxPlaybackId = mediaInfo?.playbackId || null;
  const muxThumbnailUrl = muxPlaybackId && isReady ? getMuxThumbnailUrl(muxPlaybackId) : null;
  const hasCustomPoster = !!question.answerPhotoUrl;
  // Only show clip when there's no custom poster — custom poster takes priority
  const muxClipUrl = muxPlaybackId && isReady && hasVideoAnswer && !hasCustomPoster ? getMuxMp4Url(muxPlaybackId) : null;

  // Poster: custom poster (Blob) takes priority, then Mux auto-thumbnail
  const thumbnailPhotoUrl = question.answerPhotoUrl || muxThumbnailUrl;

  // Refs
  const thumbnailWrapRef = useRef<HTMLDivElement>(null);
  const fullVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const clipRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const bufferingRef = useRef<HTMLDivElement>(null);

  // State
  const [isWatching, setIsWatching] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const isWatchingRef = useRef(false);

  useEffect(() => { isWatchingRef.current = isWatching; }, [isWatching]);

  // HLS player for Mux video
  // Track whether HLS has been initialized (stays true after first play for resume)
  const hlsInitialized = useRef(false);
  if (isWatching && isReady && hasVideoAnswer) hlsInitialized.current = true;
  const { play: hlsPlay } = useHlsPlayer(fullVideoRef, hlsInitialized.current && isReady && hasVideoAnswer ? muxPlaybackId : null);

  // Hover clip: play forward on hover, reset on leave (desktop only)
  useEffect(() => {
    const clip = clipRef.current;
    if (!clip || !muxClipUrl) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (isHovering && !isWatching) {
      clip.currentTime = 0;
      clip.play().catch(() => {});
    } else {
      clip.pause();
      clip.currentTime = 0;
    }
  }, [isHovering, isWatching, muxClipUrl]);

  // Mobile: autoplay clip when visible, pause on scroll away
  useEffect(() => {
    const wrap = thumbnailWrapRef.current;
    if (!wrap || !muxClipUrl) return;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const clip = clipRef.current;
        if (!clip) return;
        if (entry.isIntersecting && !isWatchingRef.current) {
          clip.currentTime = 0;
          clip.play().catch(() => {});
        } else if (!entry.isIntersecting && !isWatchingRef.current) {
          clip.pause();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [muxClipUrl]);

  // Track saved playback position for resume
  const savedTimeRef = useRef(0);

  // Stop if another card started playing (multi-card coordination)
  useEffect(() => {
    if (!setPlayingId) return;
    if (playingId && playingId !== question.id && isWatching) {
      // Save current position before pausing
      const vid = fullVideoRef.current;
      const aud = audioRef.current;
      if (vid && vid.currentTime > 0) savedTimeRef.current = vid.currentTime;
      if (aud && aud.currentTime > 0) savedTimeRef.current = aud.currentTime;
      vid?.pause();
      aud?.pause();
      setIsWatching(false);
      if (bufferingRef.current) bufferingRef.current.style.opacity = "0";
    }
  }, [playingId, question.id, isWatching, setPlayingId]);

  // Scroll into view helper
  const scrollIntoView = useCallback(() => {
    if (!setPlayingId) return;
    requestAnimationFrame(() => {
      if (!thumbnailWrapRef.current) return;
      const rect = thumbnailWrapRef.current.getBoundingClientRect();
      const headerH = 170;
      const cardH = rect.bottom - rect.top;
      const availableH = window.innerHeight - headerH;
      if (cardH > availableH) {
        const d = rect.bottom - window.innerHeight;
        if (Math.abs(d) > 1) window.scrollBy({ top: d, behavior: "smooth" });
      } else {
        if (rect.top < headerH) {
          window.scrollBy({ top: rect.top - headerH, behavior: "smooth" });
        } else if (rect.bottom > window.innerHeight) {
          window.scrollBy({ top: rect.bottom - window.innerHeight, behavior: "smooth" });
        }
      }
    });
  }, [setPlayingId]);

  // Click thumbnail to play/pause
  const handleThumbnailClick = useCallback((e: React.MouseEvent) => {
    if (!hasPlayableMedia) return;
    e.preventDefault();

    if (isWatching) {
      const vid = fullVideoRef.current;
      const aud = audioRef.current;
      if ((vid && vid.paused && vid.currentTime > 0) || (aud && aud.paused && aud.currentTime > 0)) {
        vid?.play().catch(() => {});
        aud?.play().catch(() => {});
        return;
      }
      // Save position before pausing
      if (vid && vid.currentTime > 0) savedTimeRef.current = vid.currentTime;
      if (aud && aud.currentTime > 0) savedTimeRef.current = aud.currentTime;
      vid?.pause();
      aud?.pause();
      setIsWatching(false);
      setPlayingId?.(null);
    } else if (hasVideoAnswer) {
      if (clipRef.current) { clipRef.current.pause(); clipRef.current.currentTime = 0; }
      setIsWatching(true);
      // Use hlsPlay() which auto-waits for HLS to be ready before playing
      if (fullVideoRef.current && savedTimeRef.current > 0) {
        fullVideoRef.current.currentTime = savedTimeRef.current;
      }
      hlsPlay();
      setPlayingId?.(question.id);
      scrollIntoView();
    } else if (hasAudioAnswer) {
      if (clipRef.current) { clipRef.current.pause(); clipRef.current.currentTime = 0; }
      if (audioRef.current) {
        if (savedTimeRef.current > 0) {
          audioRef.current.currentTime = savedTimeRef.current;
        }
        audioRef.current.play().catch(() => {});
      }
      setIsWatching(true);
      setPlayingId?.(question.id);
      scrollIntoView();
    }
  }, [hasPlayableMedia, hasVideoAnswer, hasAudioAnswer, isWatching, question.id, setPlayingId, scrollIntoView]);

  const handleEnded = useCallback(() => {
    savedTimeRef.current = 0;
    setIsWatching(false);
    setPlayingId?.(null);
  }, [setPlayingId]);

  // Progress bar
  useEffect(() => {
    if (!isWatching) {
      if (progressBarRef.current) {
        progressBarRef.current.style.transition = "none";
        progressBarRef.current.style.transform = "scaleX(0)";
      }
      return;
    }
    const el = hasVideoAnswer ? fullVideoRef.current : audioRef.current;
    const bar = progressBarRef.current;
    if (!el || !bar) return;
    bar.style.transition = "transform 300ms linear";
    const onTimeUpdate = () => {
      const total = question.answerDuration ?? el.duration;
      if (total && isFinite(total) && total > 0) {
        bar.style.transform = `scaleX(${Math.min(el.currentTime / total, 1)})`;
      }
    };
    el.addEventListener("timeupdate", onTimeUpdate);
    return () => el.removeEventListener("timeupdate", onTimeUpdate);
  }, [isWatching, hasVideoAnswer, question.answerDuration]);

  if (!thumbnailPhotoUrl && !muxClipUrl && !isPreparing) return null;

  return (
    <div
      ref={thumbnailWrapRef}
      className={`flex-shrink-0 relative ${hasPlayableMedia ? "cursor-pointer" : ""} ${className}`}
      style={{ borderRadius: 20, overflow: "hidden", aspectRatio: "3/4", scrollMarginTop: 170, ...style }}
      onClick={hasPlayableMedia ? handleThumbnailClick : undefined}
      onMouseEnter={() => { if (hasPlayableMedia && !window.matchMedia("(pointer: coarse)").matches) setIsHovering(true); }}
      onMouseLeave={() => { if (!window.matchMedia("(pointer: coarse)").matches) setIsHovering(false); }}
    >
      {/* Processing overlay */}
      {isPreparing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ zIndex: 10, backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="animate-spin" style={{ width: 40, height: 40, borderRadius: "50%", border: "4px solid rgba(255,255,255,0.25)", borderTopColor: "#ffffff" }} />
          <span className="text-white text-sm mt-3" style={{ fontFamily: "var(--font-figtree)" }}>Behandler video...</span>
        </div>
      )}

      {/* Dark overlay + play icon */}
      {hasPlayableMedia && (
        <>
          <div
            className="absolute inset-0 transition-opacity duration-200"
            style={{ zIndex: 1, opacity: !isWatching && isHovering ? 0.2 : 0, backgroundColor: partyColorDark || "#1E3A5F", pointerEvents: "none", borderRadius: 20 }}
          />
          <div
            className="absolute bottom-3 left-3 flex items-center justify-center rounded-full"
            style={{
              zIndex: 2, pointerEvents: "none", width: 48, height: 48,
              opacity: isWatching ? 0 : 1, transform: isWatching ? "translateY(-20px)" : "translateY(0)",
              transition: "opacity 300ms ease, transform 300ms ease",
            }}
          >
            <div className="absolute inset-0 rounded-full transition-opacity duration-200" style={{ backgroundColor: partyColor || "#00D564", opacity: isHovering ? 1 : 0.75 }} />
            <FontAwesomeIcon icon={faPlay} className="relative" style={{ color: partyColorDark || "#0E412E", fontSize: 20, marginLeft: 2 }} />
          </div>
        </>
      )}

      {/* Progress bar */}
      {isWatching && (
        <div
          ref={(el) => { if (el) setTimeout(() => { el.style.opacity = "1"; }, 300); }}
          className="absolute"
          style={{ zIndex: 5, bottom: 35, left: 30, right: 30, opacity: 0, transition: "opacity 150ms ease" }}
        >
          {/* Track */}
          <div style={{ position: "relative", height: 4, borderRadius: 9999, overflow: "hidden" }}>
            {/* Static background */}
            <div style={{ position: "absolute", inset: 0, backgroundColor: "var(--system-bg0-contrast)", opacity: 0.5 }} />
            {/* Progress fill */}
            <div ref={progressBarRef} style={{ position: "relative", height: "100%", width: "100%", backgroundColor: "var(--system-bg0)", transformOrigin: "left", transform: "scaleX(0)", willChange: "transform" }} />
          </div>
        </div>
      )}

      {/* Full video (HLS via useHlsPlayer) */}
      {hasVideoAnswer && (
        <video
          ref={fullVideoRef}
          playsInline
          preload="none"
          onEnded={handleEnded}
          onWaiting={() => { if (bufferingRef.current) bufferingRef.current.style.opacity = "1"; }}
          onPlaying={() => { if (bufferingRef.current) bufferingRef.current.style.opacity = "0"; }}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
          style={{ zIndex: isWatching ? 3 : 0, opacity: isWatching ? 1 : 0 }}
        />
      )}

      {/* Buffering spinner */}
      {isWatching && (
        <div ref={bufferingRef} className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 4, opacity: 0, pointerEvents: "none", transition: "opacity 150ms" }}>
          <div style={{ position: "relative", width: 40, height: 40 }}>
            {/* Static ring (bg0-contrast at 50%) */}
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "4px solid var(--system-bg0-contrast)", opacity: 0.5 }} />
            {/* Spinning indicator (bg0) */}
            <div className="animate-spin" style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "4px solid transparent", borderTopColor: "var(--system-bg0)" }} />
          </div>
        </div>
      )}

      {/* Audio element */}
      {hasAudioAnswer && muxPlaybackId && (
        <audio ref={audioRef} src={`https://stream.mux.com/${muxPlaybackId}.m3u8`} preload="none" onEnded={handleEnded} />
      )}

      {/* Static poster image */}
      {thumbnailPhotoUrl && (
        <img src={thumbnailPhotoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}

      {/* Mux MP4 clip for hover preview */}
      {muxClipUrl && (
        <video
          ref={clipRef}
          src={muxClipUrl}
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </div>
  );
}
