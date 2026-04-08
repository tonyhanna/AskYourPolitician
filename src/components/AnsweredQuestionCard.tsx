"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faCopy } from "@fortawesome/free-solid-svg-icons";
import { faShare, faMaximize } from "@fortawesome/pro-duotone-svg-icons";
import { getAnswerMediaInfo } from "@/lib/answer-utils";
import { getMuxThumbnailUrl, getMuxMp4Url } from "@/lib/mux";
import { useHlsPlayer } from "@/hooks/useHlsPlayer";
import { useShareCopy } from "@/hooks/useShareCopy";
import type { FeedQuestion } from "./QuestionFeedFilter";

export function AnsweredQuestionCard({
  question,
  basePath,
  appUrl,
  playingId,
  setPlayingId,
}: {
  question: FeedQuestion;
  basePath: string;
  appUrl: string;
  playingId: string | null;
  setPlayingId: (id: string | null) => void;
}) {
  const mediaInfo = getAnswerMediaInfo(question);
  const isReady = mediaInfo?.status === "ready";
  const muxPlaybackId = mediaInfo?.playbackId || null;
  const hasVideoAnswer = mediaInfo?.type === "video";
  const hasAudioAnswer = mediaInfo?.type === "audio";
  const hasPlayableMedia = isReady && (hasVideoAnswer || hasAudioAnswer);

  const hasCustomPoster = !!question.answerPhotoUrl;
  const muxClipUrl = muxPlaybackId && isReady && hasVideoAnswer && !hasCustomPoster ? getMuxMp4Url(muxPlaybackId) : null;
  const muxThumbnailUrl = muxPlaybackId && isReady ? getMuxThumbnailUrl(muxPlaybackId) : null;
  const photoUrl = question.answerPhotoUrl || muxThumbnailUrl;
  const canHover = useRef(false);
  useEffect(() => { canHover.current = window.matchMedia("(hover: hover)").matches; }, []);
  const cardRef = useRef<HTMLDivElement>(null);
  const fullVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const clipRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [isHovering, setIsHovering] = useState(false);
  const [isWatching, setIsWatching] = useState(false);

  // HLS player for Mux video
  const hlsInitialized = useRef(false);
  if (isWatching && isReady && hasVideoAnswer) hlsInitialized.current = true;
  const { play: hlsPlay } = useHlsPlayer(fullVideoRef, hlsInitialized.current && isReady && hasVideoAnswer ? muxPlaybackId : null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const isWatchingRef = useRef(false);
  const bufferingRef = useRef<HTMLDivElement>(null);
  useEffect(() => { isWatchingRef.current = isWatching; }, [isWatching]);
  useEffect(() => { setIsTouchDevice(window.matchMedia("(pointer: coarse)").matches); }, []);

  // Hover clip: play on hover, fade in once playing (desktop only)
  useEffect(() => {
    const clip = clipRef.current;
    if (!clip || !muxClipUrl) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (isHovering && !isWatching) {
      clip.currentTime = 0;
      const onPlaying = () => { clip.style.opacity = "1"; };
      clip.addEventListener("playing", onPlaying, { once: true });
      clip.play().catch(() => {});
      return () => clip.removeEventListener("playing", onPlaying);
    } else {
      clip.pause();
      clip.currentTime = 0;
      clip.style.opacity = "0";
    }
  }, [isHovering, isWatching, muxClipUrl]);

  // Mobile: autoplay clip when card is >50% visible via IntersectionObserver
  useEffect(() => {
    if (!muxClipUrl) return;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) return;
    const card = cardRef.current;
    const clip = clipRef.current;
    if (!card || !clip) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isWatchingRef.current) {
          clip.currentTime = 0;
          const onPlaying = () => { clip.style.opacity = "1"; };
          clip.addEventListener("playing", onPlaying, { once: true });
          clip.play().catch(() => {});
        } else if (!entry.isIntersecting) {
          clip.pause();
          clip.currentTime = 0;
          clip.style.opacity = "0";
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [muxClipUrl]);

  // Share/copy
  const { copied, handleShare } = useShareCopy(
    `${appUrl}${basePath}/q/${question.id}`,
    question.text
  );

  // Track saved playback position for resume
  const savedTimeRef = useRef(0);

  // Stop if another card started playing (save position for resume)
  useEffect(() => {
    if (playingId && playingId !== question.id && isWatching) {
      const vid = fullVideoRef.current;
      const aud = audioRef.current;
      if (vid && vid.currentTime > 0) savedTimeRef.current = vid.currentTime;
      if (aud && aud.currentTime > 0) savedTimeRef.current = aud.currentTime;
      vid?.pause();
      aud?.pause();
      setIsWatching(false);
      if (bufferingRef.current) bufferingRef.current.style.opacity = "0";
    }
  }, [playingId, question.id, isWatching]);

  // Mobile: pause playback when scrolled away, resume when visible
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (isWatchingRef.current) {
            fullVideoRef.current?.play().catch(() => {});
            audioRef.current?.play().catch(() => {});
          }
        } else {
          if (isWatchingRef.current) {
            fullVideoRef.current?.pause();
            audioRef.current?.pause();
          }
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  // Scroll card into view helper
  const scrollIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const headerH = 170;
      const cardTotalH = rect.bottom - rect.top;
      const availableH = window.innerHeight - headerH;
      if (cardTotalH > availableH) {
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
  }, []);

  // Click to play/pause full video
  const handleClick = useCallback(() => {
    if (!hasPlayableMedia) return;
    if (isWatching) {
      const vid = fullVideoRef.current;
      const aud = audioRef.current;
      if ((vid && vid.paused && vid.currentTime > 0) || (aud && aud.paused && aud.currentTime > 0)) {
        vid?.play().catch(() => {});
        aud?.play().catch(() => {});
        return;
      }
      if (vid && vid.currentTime > 0) savedTimeRef.current = vid.currentTime;
      if (aud && aud.currentTime > 0) savedTimeRef.current = aud.currentTime;
      vid?.pause();
      aud?.pause();
      setIsWatching(false);
      setPlayingId(null);
    } else if (hasVideoAnswer) {
      setIsWatching(true);
      if (fullVideoRef.current && savedTimeRef.current > 0) {
        fullVideoRef.current.currentTime = savedTimeRef.current;
      }
      hlsPlay();
      setPlayingId(question.id);
      scrollIntoView();
    } else if (hasAudioAnswer) {
      if (audioRef.current) {
        if (savedTimeRef.current > 0) audioRef.current.currentTime = savedTimeRef.current;
        audioRef.current.play().catch(() => {});
      }
      setIsWatching(true);
      setPlayingId(question.id);
      scrollIntoView();
    }
  }, [hasPlayableMedia, hasVideoAnswer, hasAudioAnswer, isWatching, question.id, setPlayingId, hlsPlay, scrollIntoView]);

  const handleEnded = useCallback(() => {
    savedTimeRef.current = 0;
    setIsWatching(false);
    setPlayingId(null);
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
        const fraction = Math.min(el.currentTime / total, 1);
        bar.style.transform = `scaleX(${fraction})`;
      }
    };
    el.addEventListener("timeupdate", onTimeUpdate);
    return () => el.removeEventListener("timeupdate", onTimeUpdate);
  }, [isWatching, hasVideoAnswer, question.answerDuration]);

  return (
    <div
      ref={cardRef}
      className={`relative ${hasPlayableMedia ? "cursor-pointer" : ""}`}
      style={{ aspectRatio: "3/4", borderRadius: 20, overflow: "hidden", scrollMarginTop: 170 }}
      onClick={hasPlayableMedia ? handleClick : undefined}
      onPointerEnter={() => { if (hasPlayableMedia && canHover.current) setIsHovering(true); }}
      onPointerLeave={() => { if (canHover.current) setIsHovering(false); }}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" loading="eager" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: "var(--party-primary, #FF0000)" }} />
      )}
      {muxClipUrl && (
        <video ref={clipRef} src={muxClipUrl} muted loop playsInline preload="none" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0 }} />
      )}

      {/* Dark hover overlay */}
      {hasPlayableMedia && !isWatching && (
        <div className="absolute inset-0 transition-opacity duration-200" style={{ zIndex: 1, opacity: isHovering ? 0.2 : 0, backgroundColor: "var(--system-overlay, #FF0000)", pointerEvents: "none", borderRadius: 20 }} />
      )}

      {/* Progress bar */}
      {isWatching && (
        <div ref={(el) => { if (el) setTimeout(() => { el.style.opacity = "1"; }, 300); }} className="absolute" style={{ zIndex: 5, bottom: 25, left: 20, right: 20, opacity: 0, transition: "opacity 150ms ease" }}>
          <div style={{ position: "relative", height: 4, borderRadius: 9999, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, backgroundColor: "var(--system-bg0-contrast, #FF0000)", opacity: 0.5 }} />
            <div ref={progressBarRef} style={{ position: "relative", height: "100%", width: "100%", backgroundColor: "var(--system-bg0, #FF0000)", transformOrigin: "left", transform: "scaleX(0)", willChange: "transform" }} />
          </div>
        </div>
      )}

      {/* Full video */}
      {hasVideoAnswer && (
        <video
          ref={fullVideoRef}
          playsInline preload="none"
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
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "4px solid var(--system-bg0-contrast)", opacity: 0.5 }} />
            <div className="animate-spin" style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "4px solid transparent", borderTopColor: "var(--system-bg0, #FF0000)" }} />
          </div>
        </div>
      )}

      {/* Audio element */}
      {hasAudioAnswer && muxPlaybackId && (
        <audio ref={audioRef} src={`https://stream.mux.com/${muxPlaybackId}.m3u8`} preload="none" onEnded={handleEnded} />
      )}

      {/* Bottom: highlighted text + share + tags */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-20" style={{ zIndex: 3, pointerEvents: "none", opacity: isWatching ? 0 : 1, transform: isWatching ? "translateY(-20px)" : "translateZ(0)", transition: "opacity 300ms ease, transform 300ms ease", backfaceVisibility: "hidden", willChange: "opacity, transform" }}>
        <span style={{ fontSize: "22px", lineHeight: 1.3, color: "var(--party-light, #FF0000)", fontFamily: "var(--font-figtree)", fontWeight: 400, backgroundColor: "var(--party-dark, #FF0000)", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", padding: "2px 8px" }}>
          {question.text}
        </span>

        {question.suggestedBy && (
          <div className="mt-1">
            <span style={{ fontSize: "12px", lineHeight: 1.3, color: "var(--system-text0, #FF0000)", backgroundColor: "var(--system-bg1, #FF0000)", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", padding: "2px 8px", fontFamily: "var(--font-figtree)", fontWeight: 400 }}>
              {question.suggestedBy}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 mt-3" style={{ pointerEvents: "auto" }}>
          {hasPlayableMedia && (
            <div className="flex items-center justify-center rounded-full flex-shrink-0 relative transition-opacity duration-300" style={{ width: 48, height: 48, opacity: isWatching ? 0 : 1, backfaceVisibility: "hidden", transform: "translateZ(0)" }}>
              <div className="absolute inset-0 rounded-full transition-opacity duration-200" style={{ backgroundColor: "var(--party-primary, #FF0000)", opacity: isHovering ? 1 : 0.75 }} />
              <FontAwesomeIcon icon={faPlay} className="relative" style={{ color: "var(--party-dark, #FF0000)", fontSize: 20, marginLeft: 2 }} />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {question.tags.map((tag) => (
              <span key={tag} className="text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1" style={{ backgroundColor: "var(--party-dark, #FF0000)", color: "var(--party-light, #FF0000)", fontFamily: "var(--font-figtree)", fontWeight: 500 }}>
                {tag}
              </span>
            ))}
            <button onClick={handleShare} className="group cursor-pointer rounded-full flex items-center justify-center flex-shrink-0 relative" style={{ height: 24, width: 24, backgroundColor: "var(--party-primary, #FF0000)" }} aria-label="Del">
              <span className="absolute inset-0 flex items-center justify-center" style={{ opacity: copied ? 0 : 1, transition: "opacity 300ms ease" }}>
                <FontAwesomeIcon icon={faShare} className="group-hover:opacity-50 transition-opacity" style={{ color: "var(--party-dark, #FF0000)", fontSize: "13.5px" }} />
              </span>
              <span className="absolute inset-0 flex items-center justify-center" style={{ opacity: copied ? 1 : 0, transition: "opacity 300ms ease" }}>
                <FontAwesomeIcon icon={faCopy} className="group-hover:opacity-50 transition-opacity" style={{ color: "var(--party-dark, #FF0000)", fontSize: "13.5px" }} />
              </span>
            </button>
            <a href={`${basePath}/q/${question.id}`} onClick={(e) => e.stopPropagation()} className="group rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 24, height: 24, backgroundColor: "var(--party-primary, #FF0000)" }} aria-label="Se detaljer">
              <FontAwesomeIcon icon={faMaximize} className="group-hover:opacity-50 transition-opacity" style={{ color: "var(--party-dark, #FF0000)", fontSize: "11px" }} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
