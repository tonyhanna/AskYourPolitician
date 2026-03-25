"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay } from "@fortawesome/free-solid-svg-icons";
import { isBlobUrl, getBlobMediaType } from "@/lib/answer-utils";

type PlayableMediaCardProps = {
  question: {
    id: string;
    answerUrl: string | null;
    answerClipUrl: string | null;
    answerPhotoUrl: string | null;
    answerDuration: number | null;
  };
  partyColor?: string | null;
  partyColorDark?: string | null;
  /** Color used for the buffering spinner */
  bufferingColor?: string | null;
  /** Multi-card coordination — only needed in feed views with multiple cards */
  playingId?: string | null;
  setPlayingId?: (id: string | null) => void;
  /** Extra className on the outer thumbnail wrapper */
  className?: string;
  /** Extra style on the outer thumbnail wrapper */
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
  // Media type detection
  const mediaType = question.answerUrl && isBlobUrl(question.answerUrl)
    ? getBlobMediaType(question.answerUrl)
    : null;
  const hasVideoAnswer = mediaType === "video";
  const hasAudioAnswer = mediaType === "audio";
  const hasPlayableMedia = hasVideoAnswer || hasAudioAnswer;

  const thumbnailClipUrl = question.answerClipUrl;
  const thumbnailPhotoUrl = question.answerPhotoUrl;

  // Refs
  const thumbnailWrapRef = useRef<HTMLDivElement>(null);
  const fullVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLVideoElement>(null);
  const bufferingRef = useRef<HTMLDivElement>(null);

  // State
  const [isWatching, setIsWatching] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const isWatchingRef = useRef(false);

  useEffect(() => { isWatchingRef.current = isWatching; }, [isWatching]);

  // Hover clip: play forward on hover, reset to start on leave (desktop only)
  useEffect(() => {
    const clip = clipRef.current;
    if (!clip || !thumbnailClipUrl) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    if (isHovering && !isWatching) {
      clip.currentTime = 0;
      clip.play().catch(() => {});
    } else {
      clip.pause();
      clip.currentTime = 0;
    }
  }, [isHovering, isWatching, thumbnailClipUrl]);

  // Mobile: autoplay clip when visible, pause/resume on scroll
  useEffect(() => {
    const wrap = thumbnailWrapRef.current;
    if (!wrap) return;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) return;

    let inViewport = false;
    let checkTimer: ReturnType<typeof setTimeout> | null = null;

    const doReload = (clip: HTMLVideoElement) => {
      clip.oncanplay = () => {
        clip.oncanplay = null;
        if (inViewport && !isWatchingRef.current) {
          clip.currentTime = 0;
          clip.play().catch(() => {});
        }
      };
      clip.load();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewport = entry.isIntersecting;
        const clip = clipRef.current;
        if (checkTimer) { clearTimeout(checkTimer); checkTimer = null; }

        if (entry.isIntersecting) {
          if (isWatchingRef.current) {
            fullVideoRef.current?.play().catch(() => {});
            audioRef.current?.play().catch(() => {});
          } else if (clip && thumbnailClipUrl) {
            clip.currentTime = 0;
            const p = clip.play();
            if (p) {
              p.catch(() => doReload(clip));
            }
            checkTimer = setTimeout(() => {
              if (clip.currentTime < 0.05 && !clip.paused && !clip.ended && inViewport && !isWatchingRef.current) {
                doReload(clip);
              }
            }, 400);
          }
        } else {
          if (clip && thumbnailClipUrl && !isWatchingRef.current) {
            clip.oncanplay = null;
            clip.pause();
          }
          if (isWatchingRef.current) {
            fullVideoRef.current?.pause();
            audioRef.current?.pause();
          }
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(wrap);
    return () => { observer.disconnect(); if (checkTimer) clearTimeout(checkTimer); };
  }, [thumbnailClipUrl]);

  // Stop if another card started playing (multi-card coordination)
  useEffect(() => {
    if (!setPlayingId) return;
    if (playingId && playingId !== question.id && isWatching) {
      fullVideoRef.current?.pause();
      audioRef.current?.pause();
      setIsWatching(false);
      if (bufferingRef.current) bufferingRef.current.style.opacity = "0";
    }
  }, [playingId, question.id, isWatching, setPlayingId]);

  // Scroll into view helper (only used with multi-card coordination)
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
      vid?.pause();
      aud?.pause();
      setIsWatching(false);
      setPlayingId?.(null);
    } else if (hasVideoAnswer) {
      if (clipRef.current) { clipRef.current.pause(); clipRef.current.currentTime = 0; }
      if (fullVideoRef.current) {
        fullVideoRef.current.currentTime = 0;
        fullVideoRef.current.play().catch(() => {});
      }
      setIsWatching(true);
      setPlayingId?.(question.id);
      scrollIntoView();
    } else if (hasAudioAnswer) {
      if (clipRef.current) { clipRef.current.pause(); clipRef.current.currentTime = 0; }
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      setIsWatching(true);
      setPlayingId?.(question.id);
      scrollIntoView();
    }
  }, [hasPlayableMedia, hasVideoAnswer, hasAudioAnswer, isWatching, question.id, setPlayingId, scrollIntoView]);

  const handleEnded = useCallback(() => {
    setIsWatching(false);
    setPlayingId?.(null);
  }, [setPlayingId]);

  const handleWaiting = useCallback(() => {
    if (bufferingRef.current) bufferingRef.current.style.opacity = "1";
  }, []);

  const handlePlaying = useCallback(() => {
    if (bufferingRef.current) bufferingRef.current.style.opacity = "0";
  }, []);

  // Progress bar — timeupdate events + CSS transition for smooth visual
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
        const fraction = Math.min(el.currentTime / total, 1);
        bar.style.transform = `scaleX(${fraction})`;
      }
    };
    el.addEventListener("timeupdate", onTimeUpdate);
    return () => el.removeEventListener("timeupdate", onTimeUpdate);
  }, [isWatching, hasVideoAnswer, question.answerDuration]);

  if (!thumbnailClipUrl && !thumbnailPhotoUrl) return null;

  return (
    <div
      ref={thumbnailWrapRef}
      className={`flex-shrink-0 relative ${hasPlayableMedia ? "cursor-pointer" : ""} ${className}`}
      style={{ borderRadius: 20, overflow: "hidden", aspectRatio: "3/4", scrollMarginTop: 170, ...style }}
      onClick={hasPlayableMedia ? handleThumbnailClick : undefined}
      onMouseEnter={() => { if (hasPlayableMedia && !window.matchMedia("(pointer: coarse)").matches) setIsHovering(true); }}
      onMouseLeave={() => { if (!window.matchMedia("(pointer: coarse)").matches) setIsHovering(false); }}
    >
      {/* Dark overlay + play icon */}
      {hasPlayableMedia && (
        <>
          <div
            className="absolute inset-0 transition-opacity duration-200"
            style={{
              zIndex: 1,
              opacity: !isWatching && isHovering ? 0.2 : 0,
              backgroundColor: partyColorDark || "#1E3A5F",
              pointerEvents: "none",
              borderRadius: 20,
            }}
          />
          <div
            className="absolute bottom-3 left-3 flex items-center justify-center rounded-full"
            style={{
              zIndex: 2,
              pointerEvents: "none",
              width: 48,
              height: 48,
              opacity: isWatching ? 0 : 1,
              transform: isWatching ? "translateY(-20px)" : "translateY(0)",
              transition: "opacity 300ms ease, transform 300ms ease",
            }}
          >
            <div className="absolute inset-0 rounded-full transition-opacity duration-200" style={{ backgroundColor: partyColor || "#00D564", opacity: isHovering ? 1 : 0.75 }} />
            <FontAwesomeIcon
              icon={faPlay}
              className="relative"
              style={{ color: partyColorDark || "#0E412E", fontSize: 20, marginLeft: 2 }}
            />
          </div>
        </>
      )}

      {/* Progress bar — delayed fade-in to wait for play icon to fade out */}
      {isWatching && (
        <div
          ref={(el) => { if (el) setTimeout(() => { el.style.opacity = "1"; }, 300); }}
          className="absolute"
          style={{ zIndex: 5, bottom: 35, left: 30, right: 30, height: 4, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 9999, mixBlendMode: "difference", overflow: "hidden", opacity: 0, transition: "opacity 150ms ease" }}
        >
          <div
            ref={progressBarRef}
            style={{
              height: "100%",
              width: "100%",
              backgroundColor: "#ffffff",
              transformOrigin: "left",
              transform: "scaleX(0)",
              willChange: "transform",
            }}
          />
        </div>
      )}

      {/* Full video for on-thumbnail playback */}
      {hasVideoAnswer && (
        <video
          ref={fullVideoRef}
          src={question.answerUrl!}
          playsInline
          preload="none"
          onEnded={handleEnded}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
          style={{ zIndex: isWatching ? 3 : 0, opacity: isWatching ? 1 : 0 }}
        />
      )}

      {/* Buffering spinner */}
      {isWatching && (
        <div
          ref={bufferingRef}
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 4, opacity: 0, pointerEvents: "none", transition: "opacity 150ms", mixBlendMode: "difference" }}
        >
          <div
            className="animate-spin"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "4px solid rgba(255,255,255,0.25)",
              borderTopColor: "#ffffff",
            }}
          />
        </div>
      )}

      {/* Hidden audio element */}
      {hasAudioAnswer && (
        <audio
          ref={audioRef}
          src={question.answerUrl!}
          preload="none"
          onEnded={handleEnded}
        />
      )}

      {/* Static poster image */}
      {thumbnailPhotoUrl && (
        <img
          src={thumbnailPhotoUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {/* Clip video layered on top of the poster */}
      {thumbnailClipUrl && (
        <video
          ref={clipRef}
          src={thumbnailClipUrl}
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </div>
  );
}
