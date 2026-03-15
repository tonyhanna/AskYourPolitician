"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVideo, faMicrophone, faEllipsis, faXmark, faCirclePlay, faChevronLeft, faChevronRight, faChevronDown, faArrowUp, faCheck, faArrowRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { faShare, faArrowUp as faArrowUpDuotone, faHourglass, faFilter } from "@fortawesome/pro-duotone-svg-icons";
import { UpvoteButton } from "./UpvoteButton";
import { CancelUpvoteButton } from "./CancelUpvoteButton";
import { CopyLinkButton } from "./CopyLinkButton";
import { isBlobUrl, getBlobMediaType } from "@/lib/answer-utils";
import { citizenLogout, directUpvote, cancelUpvote } from "@/app/[partySlug]/[politicianSlug]/actions";
import { UpvoteModal } from "./UpvoteModal";

type FeedQuestion = {
  id: string;
  text: string;
  upvoteCount: number;
  upvoteGoal: number;
  answerUrl: string | null;
  answerPhotoUrl: string | null;
  answerClipUrl: string | null;
  answerDuration: number | null;
  answerAspectRatio: number | null;
  goalReachedEmailSent: boolean;
  goalReachedAt: string | null;
  deadlineMissed: boolean;
  suggestedBy: string | null;
  tags: string[];
  isUpvoted: boolean;
  createdAt: string;
  pinned: boolean;
};

type SortOption = "newest" | "oldest" | "most_upvoted" | "least_upvoted";
type GroupOption = "all" | "own" | "citizen" | "upvoted";

export function QuestionFeedFilter({
  questions,
  allTags,
  politicianFirstName,
  politicianName,
  basePath,
  appUrl,
  hasSession,
  partySlug,
  politicianSlug,
  partyColor,
  partyColorDark,
  partyColorLight,
  citizenEmail,
}: {
  questions: FeedQuestion[];
  allTags: string[];
  politicianFirstName: string;
  politicianName: string;
  basePath: string;
  appUrl: string;
  hasSession: boolean;
  partySlug: string;
  politicianSlug: string;
  partyColor?: string | null;
  partyColorDark?: string | null;
  partyColorLight?: string | null;
  citizenEmail?: string | null;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [upvoteModalQuestionId, setUpvoteModalQuestionId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>("newest");
  const [group, setGroup] = useState<GroupOption>("all");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const isFiltered = sort !== "newest" || group !== "all" || selectedTags.size > 0;

  function reset() {
    setSort("newest");
    setGroup("all");
    setSelectedTags(new Set());
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  const { pinnedQuestions, answeredQuestions, filteredQuestions } = useMemo(() => {
    let result = [...questions];

    // Group filter
    if (group === "own") {
      result = result.filter((q) => !q.suggestedBy);
    } else if (group === "citizen") {
      result = result.filter((q) => !!q.suggestedBy);
    } else if (group === "upvoted") {
      result = result.filter((q) => q.isUpvoted);
    }

    // Tag filter (OR logic)
    if (selectedTags.size > 0) {
      result = result.filter((q) =>
        q.tags.some((t) => selectedTags.has(t))
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sort) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "most_upvoted":
          return b.upvoteCount - a.upvoteCount;
        case "least_upvoted":
          return a.upvoteCount - b.upvoteCount;
      }
    });

    // Split pinned from regular
    const pinned = group === "all" ? result.filter((q) => q.pinned) : [];
    const nonPinned = group === "all" ? result.filter((q) => !q.pinned) : result;

    // Split answered from unanswered
    const answered = nonPinned.filter((q) => q.answerUrl !== null);
    const unanswered = nonPinned.filter((q) => q.answerUrl === null);

    return { pinnedQuestions: pinned, answeredQuestions: answered, filteredQuestions: unanswered };
  }, [questions, group, selectedTags, sort]);

  return (
    <div>
      {/* Filtre — toggle button or expanded filters */}
      {!filtersOpen ? (
        <div className="mb-[25px]">
          <button
            onClick={() => setFiltersOpen(true)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-transparent cursor-pointer transition-all duration-150"
            style={{
              fontFamily: "var(--font-figtree)", fontWeight: 500,
              backgroundColor: partyColorLight || "#DBEAFE",
              color: partyColorDark || "#1E3A5F",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = partyColorDark || "#1E3A5F"; e.currentTarget.style.color = "#ffffff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = partyColorLight || "#DBEAFE"; e.currentTarget.style.color = partyColorDark || "#1E3A5F"; }}
          >
            <FontAwesomeIcon icon={faFilter} className="text-xs" />
            Filtre
          </button>
        </div>
      ) : (
        <div className="mb-[25px] space-y-4">
          {/* Vis */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {([
                ["all", "Alle"],
                ["own", "Politiker"],
                ["citizen", "Borgere"],
                ...(hasSession && questions.some((q) => q.isUpvoted) ? [["upvoted", "Mine upvotede"] as [GroupOption, string]] : []),
              ] as [GroupOption, string][]).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setGroup(value)}
                  className="text-sm px-3 py-1.5 rounded-full border border-transparent cursor-pointer transition-all duration-150"
                  style={{
                    fontFamily: "var(--font-figtree)", fontWeight: 500,
                    ...(group === value
                      ? { backgroundColor: partyColor || "#3B82F6", color: "#ffffff" }
                      : { backgroundColor: partyColorLight || "#DBEAFE", color: partyColorDark || "#1E3A5F" }),
                  }}
                  onMouseEnter={(e) => { if (group !== value) { e.currentTarget.style.backgroundColor = partyColorDark || "#1E3A5F"; e.currentTarget.style.color = "#ffffff"; } }}
                  onMouseLeave={(e) => { if (group !== value) { e.currentTarget.style.backgroundColor = partyColorLight || "#DBEAFE"; e.currentTarget.style.color = partyColorDark || "#1E3A5F"; } }}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-sm cursor-pointer"
                style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: partyColorDark || "#1E3A5F", opacity: 0.6 }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; }}
              >
                Flere filtre
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className="text-[10px]"
                  style={{ transition: "transform 200ms ease", transform: moreOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>
              {isFiltered && (
                <button
                  onClick={reset}
                  className="text-sm cursor-pointer"
                  style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "#FF4105" }}
                >
                  Nulstil
                </button>
              )}
            </div>
          </div>

          {moreOpen && (
            <>
              {/* Sortering */}
              <div>
                <p className="text-sm mb-2" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: partyColorDark || "#1E3A5F" }}>Sortering</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    ["newest", "Nyeste først"],
                    ["oldest", "Ældste først"],
                    ["most_upvoted", "Mest upvoted"],
                    ["least_upvoted", "Mindst upvoted"],
                  ] as [SortOption, string][]).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setSort(value)}
                      className="text-sm px-3 py-1.5 rounded-full border border-transparent cursor-pointer transition-all duration-150"
                      style={{
                        fontFamily: "var(--font-figtree)", fontWeight: 500,
                        ...(sort === value
                          ? { backgroundColor: partyColor || "#3B82F6", color: "#ffffff" }
                          : { backgroundColor: partyColorLight || "#DBEAFE", color: partyColorDark || "#1E3A5F" }),
                      }}
                      onMouseEnter={(e) => { if (sort !== value) { e.currentTarget.style.backgroundColor = partyColorDark || "#1E3A5F"; e.currentTarget.style.color = "#ffffff"; } }}
                      onMouseLeave={(e) => { if (sort !== value) { e.currentTarget.style.backgroundColor = partyColorLight || "#DBEAFE"; e.currentTarget.style.color = partyColorDark || "#1E3A5F"; } }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mærkesager */}
              {allTags.length > 0 && (
                <div>
                  <p className="text-sm mb-2" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: partyColorDark || "#1E3A5F" }}>Mærkesager</p>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className="text-sm px-3 py-1.5 rounded-full border border-transparent cursor-pointer transition-all duration-150"
                        style={{
                          fontFamily: "var(--font-figtree)", fontWeight: 500,
                          ...(selectedTags.has(tag)
                            ? { backgroundColor: partyColor || "#3B82F6", color: "#ffffff" }
                            : { backgroundColor: partyColorLight || "#DBEAFE", color: partyColorDark || "#1E3A5F" }),
                        }}
                        onMouseEnter={(e) => { if (!selectedTags.has(tag)) { e.currentTarget.style.backgroundColor = partyColorDark || "#1E3A5F"; e.currentTarget.style.color = "#ffffff"; } }}
                        onMouseLeave={(e) => { if (!selectedTags.has(tag)) { e.currentTarget.style.backgroundColor = partyColorLight || "#DBEAFE"; e.currentTarget.style.color = partyColorDark || "#1E3A5F"; } }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {questions.length === 0 && (
        <p className="max-w-2xl mx-auto text-gray-500 text-center py-8">
          Der er endnu ingen spørgsmål fra denne politiker.
        </p>
      )}

      {/* Pinned questions — max-width capped at 3 cards so thumbnail centers between card 3 & 4 */}
      {pinnedQuestions.length > 0 && (
        <div
          className="mx-auto w-full"
          style={{
            maxWidth: answeredQuestions.length >= 3 ? 3 * 337 + 2 * 16 : undefined,
          }}
        >
          <div className="space-y-6">
            {pinnedQuestions.map((question) => (
              <PinnedQuestionCard
                key={question.id}
                question={question}
                basePath={basePath}
                appUrl={appUrl}
                partyColor={partyColor}
                partyColorDark={partyColorDark}
                playingId={playingId}
                setPlayingId={setPlayingId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Separator between pinned and answered */}
      {pinnedQuestions.length > 0 && answeredQuestions.length > 0 && (
        <div
          className="my-6"
          style={{ height: 1, backgroundColor: `${partyColor || "#00D564"}40` }}
        />
      )}

      {/* Answered questions carousel */}
      {answeredQuestions.length > 0 && (
        <AnsweredQuestionsCarousel
          questions={answeredQuestions}
          basePath={basePath}
          appUrl={appUrl}
          partyColor={partyColor}
          partyColorDark={partyColorDark}
          playingId={playingId}
          setPlayingId={setPlayingId}
        />
      )}

      {/* Separator between answered and regular questions */}
      {answeredQuestions.length > 0 && (
        <div
          className="my-6"
          style={{ height: 1, backgroundColor: `${partyColor || "#00D564"}40` }}
        />
      )}

      {/* Unanswered questions */}
      {filteredQuestions.length > 0 ? (
        <UnansweredQuestionsGrid
          questions={filteredQuestions}
          appUrl={appUrl}
          basePath={basePath}
          hasSession={hasSession}
          partySlug={partySlug}
          politicianSlug={politicianSlug}
          politicianFirstName={politicianFirstName}
          partyColor={partyColor}
          partyColorDark={partyColorDark}
          onLoginUpvote={(qId) => setUpvoteModalQuestionId(qId)}
        />
      ) : pinnedQuestions.length === 0 && questions.length > 0 ? (
        <p className="max-w-2xl mx-auto text-gray-500 text-center py-8">
          Ingen spørgsmål matcher dine filtre.
        </p>
      ) : null}

      {/* Ellipsis menu — below question list, centered */}
      {!hasSession && <div style={{ height: 104 }} />}
      {hasSession && (
        <div className="relative flex justify-center" style={{ marginTop: 50, marginBottom: 30 }}>
          {/* Invisible backdrop to dismiss menu on outside click */}
          {menuOpen && (
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          )}
          {/* Menu popover — opens upward */}
          {menuOpen && citizenEmail && (
            <div
              className="absolute bottom-full mb-2 flex flex-col items-center gap-2 rounded-xl px-4 py-3 z-20"
              style={{
                backgroundColor: partyColor || "#7E7D7A",
                fontFamily: "var(--font-figtree)",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              <span className="text-sm" style={{ color: "#ffffff" }}>{citizenEmail}</span>
              <button
                onClick={async () => {
                  const scrollY = window.scrollY;
                  await citizenLogout(partySlug, politicianSlug);
                  requestAnimationFrame(() => window.scrollTo(0, scrollY));
                }}
                className="cursor-pointer transition hover:opacity-50 flex items-center gap-2 text-sm"
                style={{ color: "#ffffff" }}
              >
                <FontAwesomeIcon icon={faArrowRightFromBracket} />
                Log ud
              </button>
            </div>
          )}
          {/* Ellipsis / close button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="cursor-pointer hover:opacity-50 transition-opacity rounded-full flex items-center justify-center z-20"
            style={{
              width: 24,
              height: 24,
              backgroundColor: menuOpen
                ? (partyColor || "#7E7D7A")
                : `${partyColor || "#7E7D7A"}80`,
            }}
            aria-label="Menu"
          >
            {menuOpen ? (
              <FontAwesomeIcon
                icon={faXmark}
                style={{ color: partyColorDark || "#1E3A5F", fontSize: "13.5px" }}
              />
            ) : (
              <FontAwesomeIcon
                icon={faEllipsis}
                style={{ color: partyColorDark || "#1E3A5F", fontSize: "13.5px" }}
              />
            )}
          </button>
        </div>
      )}

      {/* Upvote login modal */}
      {upvoteModalQuestionId && (
        <UpvoteModal
          questionId={upvoteModalQuestionId}
          partySlug={partySlug}
          politicianSlug={politicianSlug}
          partyColor={partyColor}
          partyColorDark={partyColorDark}
          partyColorLight={partyColorLight}
          onClose={() => setUpvoteModalQuestionId(null)}
        />
      )}
    </div>
  );
}

/** Format seconds as ##:## (always 2-digit minutes and seconds) */
function formatDuration(seconds: number | null): string {
  if (seconds == null || !isFinite(seconds) || seconds <= 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function QuestionCard({
  question,
  basePath,
  appUrl,
  hasSession,
  partySlug,
  politicianSlug,
  politicianName,
  partyColor,
  partyColorDark,
  isPinned,
}: {
  question: FeedQuestion;
  basePath: string;
  appUrl: string;
  hasSession: boolean;
  partySlug: string;
  politicianSlug: string;
  politicianName: string;
  partyColor?: string | null;
  partyColorDark?: string | null;
  isPinned?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fullVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isHourglassHovering, setIsHourglassHovering] = useState(false);
  const answerAspectRatio = question.answerAspectRatio;

  // Determine card variant
  const mediaType = question.answerUrl && isBlobUrl(question.answerUrl)
    ? getBlobMediaType(question.answerUrl)
    : null;
  const hasClip = !!question.answerClipUrl;
  const hasAudioPhoto = mediaType === "audio" && !!question.answerPhotoUrl;
  const hasBackground = hasClip || hasAudioPhoto;
  const hasVideoAnswer = mediaType === "video" && !!question.answerUrl;
  const hasAudioAnswer = hasAudioPhoto; // audio + photo = clickable card

  // Click card to play full video or audio answer
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (!hasVideoAnswer && !hasAudioAnswer) return;
    // Don't trigger when clicking interactive elements
    const target = e.target as HTMLElement;
    if (target.closest("a, button")) return;

    if (isWatching) {
      // Stop watching
      fullVideoRef.current?.pause();
      audioRef.current?.pause();
      setIsWatching(false);
      setIsBuffering(false);
    } else if (hasVideoAnswer) {
      // Start watching video — pause clip, play full video directly in click handler
      // (must not use setTimeout — browser requires user gesture for unmuted play)
      videoRef.current?.pause();
      setIsBuffering(true); // Show spinner immediately while video loads
      if (fullVideoRef.current) {
        fullVideoRef.current.currentTime = 0;
        fullVideoRef.current.play().catch(() => {});
      }
      setIsWatching(true);
    } else if (hasAudioAnswer) {
      // Start listening — play audio, show photo at natural size
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      setIsWatching(true);
    }
  }, [hasVideoAnswer, hasAudioAnswer, isWatching]);

  // Full video ended
  const handleFullVideoEnded = useCallback(() => {
    setIsWatching(false);
    setIsBuffering(false);
  }, []);

  // Buffering: video stalled waiting for data
  const handleWaiting = useCallback(() => {
    setIsBuffering(true);
  }, []);

  // Buffering resolved: playback resumed
  const handlePlaying = useCallback(() => {
    setIsBuffering(false);
  }, []);

  // Audio ended
  const handleAudioEnded = useCallback(() => {
    setIsWatching(false);
  }, []);

  // Clip ended — just stop playing, stay on last frame (hover remains)
  const handleClipEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // Desktop: hover to reveal background + play clip (only when not watching full video)
  const handleMouseEnter = useCallback(() => {
    if (isWatching) return;
    if (hasBackground) setIsHovering(true);
    if (hasClip && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [hasClip, hasBackground, isWatching]);

  const handleMouseLeave = useCallback(() => {
    if (isWatching) return;
    setIsHovering(false);
    if (hasClip && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, [hasClip, isWatching]);

  // Mobile: IntersectionObserver for scroll-based clip play
  useEffect(() => {
    if (!hasClip || !cardRef.current || !videoRef.current) return;

    // Only use IntersectionObserver on touch devices
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) return;

    const video = videoRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Don't interfere with full video playback
        if (isWatching) return;
        if (entry.isIntersecting) {
          video.play().then(() => setIsPlaying(true)).catch(() => {});
        } else {
          video.pause();
          video.currentTime = 0;
          setIsPlaying(false);
        }
      },
      { threshold: 0.6 }
    );

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [hasClip, isWatching]);

  // Progress bar — smooth rAF loop while watching
  useEffect(() => {
    if (!isWatching) {
      // Reset bar when not watching
      if (progressBarRef.current) progressBarRef.current.style.width = "0%";
      return;
    }

    let rafId: number;
    const tick = () => {
      const el = hasVideoAnswer ? fullVideoRef.current : audioRef.current;
      if (el && progressBarRef.current) {
        const total = question.answerDuration ?? el.duration;
        if (total && isFinite(total) && total > 0) {
          const pct = Math.min((el.currentTime / total) * 100, 100);
          progressBarRef.current.style.width = `${pct}%`;
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isWatching, hasVideoAnswer, question.answerDuration]);

  // Text and overlay colors based on background — always white when background exists
  const textColor = hasBackground ? "#ffffff" : "#2E2E2E";
  const subtextColor = hasBackground ? "rgba(255,255,255,0.7)" : "#7E7D7A";
  const tagBg = hasBackground ? "rgba(255,255,255,0.2)" : "#E8E7E5";
  const tagColor = hasBackground ? "#ffffff" : (partyColorDark || "#1E3A5F");
  const answerBtnBg = hasBackground ? "rgba(255,255,255,0.2)" : "#E8E7E5";
  const answerBtnColor = hasBackground ? "#ffffff" : "#7E7D7A";

  return (
    <div
      ref={cardRef}
      className="p-4 break-inside-avoid group/card relative overflow-hidden"
      style={{
        backgroundColor: isWatching && hasVideoAnswer ? "#000000" : "#F6F6F5",
        fontFamily: "var(--font-figtree)",
        fontWeight: 500,
        cursor: hasVideoAnswer || hasAudioAnswer ? "pointer" : undefined,
        aspectRatio: isWatching && answerAspectRatio
          ? `${answerAspectRatio}`
          : undefined,
        transition: "background-color 300ms, aspect-ratio 300ms",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleCardClick}
    >
      {/* Story-style progress bar */}
      {isWatching && (
        <div
          className="absolute"
          style={{ zIndex: 5, top: 5, left: 5, right: 5, height: 4, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 9999 }}
        >
          <div
            ref={progressBarRef}
            style={{
              height: "100%",
              width: "0%",
              backgroundColor: "#ffffff",
              borderRadius: 9999,
            }}
          />
        </div>
      )}

      {/* Background: video clip */}
      {hasClip && (
        <>
          <video
            ref={videoRef}
            src={question.answerClipUrl!}
            muted
            playsInline
            preload="metadata"
            poster={question.answerPhotoUrl || undefined}
            onEnded={handleClipEnded}
            className="absolute inset-0 w-full h-full object-cover transition-all duration-300"
            style={{ zIndex: 0, filter: isHovering || isWatching ? "none" : "blur(8px)", transform: isHovering || isWatching ? "none" : "scale(1.1)" }}
          />
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{ backgroundColor: "rgba(0,0,0,0.55)", zIndex: 1, opacity: isWatching ? 0 : 1 }}
          />
        </>
      )}

      {/* Full video for on-card playback */}
      {hasVideoAnswer && (
        <video
          ref={fullVideoRef}
          src={question.answerUrl!}
          playsInline
          preload="none"
          onEnded={handleFullVideoEnded}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
          style={{ zIndex: isWatching ? 3 : 0, opacity: isWatching ? 1 : 0 }}
        />
      )}

      {/* Buffering spinner */}
      {isWatching && isBuffering && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 4 }}
        >
          <svg
            className="animate-spin h-10 w-10 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Background: audio answer photo */}
      {hasAudioPhoto && !hasClip && (
        <>
          <img
            src={question.answerPhotoUrl!}
            alt=""
            className={`absolute inset-0 w-full h-full transition-all duration-300 ${isWatching ? "object-contain" : "object-cover"}`}
            style={{ zIndex: 0, filter: isHovering || isWatching ? "none" : "blur(8px)", transform: isHovering || isWatching ? "none" : "scale(1.1)" }}
          />
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{ backgroundColor: "rgba(0,0,0,0.55)", zIndex: 1, opacity: isWatching ? 0 : 1 }}
          />
        </>
      )}

      {/* Hidden audio element for on-card playback */}
      {hasAudioAnswer && (
        <audio
          ref={audioRef}
          src={question.answerUrl!}
          preload="none"
          onEnded={handleAudioEnded}
        />
      )}

      {/* Content (above background) — fades out when watching full video */}
      <div
        className="relative transition-opacity duration-300"
        style={{ zIndex: isWatching ? 1 : 2, opacity: isWatching ? 0 : 1 }}
      >
        {/* Question text */}
        <div>
          <a
            href={`${basePath}/q/${question.id}`}
            className="transition hover:opacity-70"
            style={{
              fontSize: "30px",
              lineHeight: 1.15,
              color: textColor,
              fontFamily: "var(--font-figtree)",
              transition: "color 300ms",
            }}
          >
            {question.text}
          </a>
        </div>
        <span
          className="text-xs mt-1 block transition-colors duration-300"
          style={{ color: subtextColor }}
        >
          — {question.suggestedBy ? question.suggestedBy : politicianName}
        </span>
        <div className="flex items-center gap-2" style={{ marginTop: question.answerUrl ? 50 : 12 }}>
          <CopyLinkButton
            url={`${appUrl}${basePath}/q/${question.id}`}
            title={question.text}
            compact
            partyColor={partyColor}
          />
          {(hasVideoAnswer || hasAudioAnswer) && (
            <span
              className="inline-flex items-center gap-1 text-xs transition-colors duration-300"
              style={{ color: subtextColor, fontVariantNumeric: "tabular-nums", marginLeft: -10 }}
            >
              <FontAwesomeIcon
                icon={hasVideoAnswer ? faVideo : faMicrophone}
                className="text-[11px]"
              />
              {formatDuration(question.answerDuration)}
            </span>
          )}
          {question.tags.length > 0 && (
            question.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full transition-colors duration-300 inline-flex items-center gap-1"
                style={{ backgroundColor: tagBg, color: tagColor }}
              >
                {tag}
              </span>
            ))
          )}
          {question.answerUrl ? (
            <>
              <span
                className="text-xs ml-auto transition-opacity duration-200 md:opacity-0 md:group-hover/card:opacity-100"
                style={{ color: hasBackground ? "rgba(255,255,255,0.7)" : (partyColor || "#3B82F6") }}
              >
                {question.upvoteCount} / {question.upvoteGoal}
              </span>
              <a
                href={`${basePath}/q/${question.id}`}
                className="text-xs px-3 py-1.5 rounded-full cursor-pointer transition-colors duration-300"
                style={{ backgroundColor: answerBtnBg, color: answerBtnColor }}
              >
                {isBlobUrl(question.answerUrl) && getBlobMediaType(question.answerUrl) === "audio" ? "Lyt til svar" : "Se svar"}
              </a>
              {question.isUpvoted && (
                <CancelUpvoteButton
                  questionId={question.id}
                  partySlug={partySlug}
                  politicianSlug={politicianSlug}
                />
              )}
            </>
          ) : (
            <>
              {question.goalReachedEmailSent ? (
                <div
                  className="ml-auto flex items-center"
                  onMouseEnter={() => setIsHourglassHovering(true)}
                  onMouseLeave={() => setIsHourglassHovering(false)}
                >
                  {isHourglassHovering ? (
                    question.isUpvoted ? (
                      <CancelUpvoteButton
                        questionId={question.id}
                        partySlug={partySlug}
                        politicianSlug={politicianSlug}
                      />
                    ) : (
                      <UpvoteButton
                        questionId={question.id}
                        basePath={basePath}
                        isUpvoted={false}
                        hasSession={hasSession}
                        partySlug={partySlug}
                        politicianSlug={politicianSlug}
                        partyColor={partyColor}
                        partyColorDark={partyColorDark}
                      />
                    )
                  ) : (
                    <span
                      className="flex items-center justify-center rounded-full"
                      style={{
                        width: 28,
                        height: 28,
                        backgroundColor: `${partyColor || "#00D564"}40`,
                      }}
                    >
                      <FontAwesomeIcon
                        icon={faHourglass}
                        style={{ color: partyColorDark || "#0E412E", fontSize: 14 }}
                      />
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <span className="text-xs ml-auto transition-opacity duration-200 md:opacity-0 md:group-hover/card:opacity-100" style={{ color: partyColor || "#3B82F6" }}>
                    {question.upvoteCount} / {question.upvoteGoal}
                  </span>
                  {question.isUpvoted ? (
                    <CancelUpvoteButton
                      questionId={question.id}
                      partySlug={partySlug}
                      politicianSlug={politicianSlug}
                    />
                  ) : (
                    <UpvoteButton
                      questionId={question.id}
                      basePath={basePath}
                      isUpvoted={false}
                      hasSession={hasSession}
                      partySlug={partySlug}
                      politicianSlug={politicianSlug}
                      partyColor={partyColor}
                      partyColorDark={partyColorDark}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PinnedQuestionCard({
  question,
  basePath,
  appUrl,
  partyColor,
  partyColorDark,
  playingId,
  setPlayingId,
}: {
  question: FeedQuestion;
  basePath: string;
  appUrl: string;
  partyColor?: string | null;
  partyColorDark?: string | null;
  playingId: string | null;
  setPlayingId: (id: string | null) => void;
}) {
  const mediaType = question.answerUrl && isBlobUrl(question.answerUrl)
    ? getBlobMediaType(question.answerUrl)
    : null;
  const hasVideoAnswer = mediaType === "video";
  const hasAudioAnswer = mediaType === "audio";
  const hasPlayableMedia = hasVideoAnswer || hasAudioAnswer;

  // Thumbnail: clip video for video answers, photo for audio answers
  const thumbnailClipUrl = question.answerClipUrl;
  const thumbnailPhotoUrl = question.answerPhotoUrl;

  // Share/copy state
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleShare = useCallback(() => {
    const url = `${appUrl}${basePath}/q/${question.id}`;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;

    if (isTouch && navigator.share) {
      navigator.share({ url, title: question.text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }, [appUrl, basePath, question.id, question.text]);

  // Playback state
  const thumbnailWrapRef = useRef<HTMLDivElement>(null);
  const fullVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLVideoElement>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const isWatchingRef = useRef(false);
  const bufferingRef = useRef<HTMLDivElement>(null);
  useEffect(() => { isWatchingRef.current = isWatching; }, [isWatching]);

  // Hover clip: play forward on hover, reset to start on leave (desktop only)
  useEffect(() => {
    const clip = clipRef.current;
    if (!clip || !thumbnailClipUrl) return;
    // On touch devices, IntersectionObserver handles clip playback — skip hover logic entirely
    if (window.matchMedia("(pointer: coarse)").matches) return;

    if (isHovering && !isWatching) {
      clip.currentTime = 0;
      clip.play().catch(() => {});
    } else {
      clip.pause();
      clip.currentTime = 0;
    }
  }, [isHovering, isWatching, thumbnailClipUrl]);

  // Mobile: autoplay clip when visible, pause everything when scrolled away
  useEffect(() => {
    const wrap = thumbnailWrapRef.current;
    if (!wrap) return;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) return;

    let inViewport = false; // Track viewport state for async canplay callback

    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewport = entry.isIntersecting;
        const clip = clipRef.current;

        if (entry.isIntersecting) {
          if (!isWatchingRef.current && clip && thumbnailClipUrl) {
            // ALWAYS force-reload on mobile viewport entry.
            // iOS WebKit silently releases decoders for off-screen videos;
            // play() may resolve but produce no output. load() guarantees
            // a fresh decoder + data pipeline from cache.
            clip.oncanplay = () => {
              clip.oncanplay = null;
              if (inViewport && !isWatchingRef.current) {
                clip.currentTime = 0;
                clip.play().catch(() => {});
              }
            };
            clip.load();
          }
        } else {
          if (clip && thumbnailClipUrl && !isWatchingRef.current) {
            clip.oncanplay = null; // Cancel any pending play
            clip.pause();
          }
          // Pause full video/audio when scrolled out of view
          if (isWatchingRef.current) {
            fullVideoRef.current?.pause();
            audioRef.current?.pause();
          }
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [thumbnailClipUrl]);

  // Stop if another card started playing
  useEffect(() => {
    if (playingId && playingId !== question.id && isWatching) {
      fullVideoRef.current?.pause();
      audioRef.current?.pause();
      setIsWatching(false);
      if (bufferingRef.current) bufferingRef.current.style.opacity = "0";
    }
  }, [playingId, question.id, isWatching]);

  // Click thumbnail to play/pause
  const handleThumbnailClick = useCallback((e: React.MouseEvent) => {
    if (!hasPlayableMedia) return;
    e.preventDefault();

    if (isWatching) {
      fullVideoRef.current?.pause();
      audioRef.current?.pause();
      setIsWatching(false);
      setPlayingId(null);
    } else if (hasVideoAnswer) {
      // Stop clip to free mobile video decoder before starting full video
      if (clipRef.current) { clipRef.current.pause(); clipRef.current.currentTime = 0; }
      requestAnimationFrame(() => { if (bufferingRef.current) bufferingRef.current.style.opacity = "1"; });
      if (fullVideoRef.current) {
        fullVideoRef.current.currentTime = 0;
        fullVideoRef.current.play().catch(() => {});
      }
      setIsWatching(true);
      setPlayingId(question.id);
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
    } else if (hasAudioAnswer) {
      // Stop clip to free mobile video decoder before starting audio playback
      if (clipRef.current) { clipRef.current.pause(); clipRef.current.currentTime = 0; }
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      setIsWatching(true);
      setPlayingId(question.id);
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
    }
  }, [hasPlayableMedia, hasVideoAnswer, hasAudioAnswer, isWatching, question.id, setPlayingId]);

  const handleFullVideoEnded = useCallback(() => {
    setIsWatching(false);
    setPlayingId(null);
  }, [setPlayingId]);

  const handleWaiting = useCallback(() => {
    if (bufferingRef.current) bufferingRef.current.style.opacity = "1";
  }, []);

  const handlePlaying = useCallback(() => {
    if (bufferingRef.current) bufferingRef.current.style.opacity = "0";
  }, []);

  const handleAudioEnded = useCallback(() => {
    setIsWatching(false);
    setPlayingId(null);
  }, [setPlayingId]);

  // Progress bar — smooth rAF loop while watching
  useEffect(() => {
    if (!isWatching) {
      if (progressBarRef.current) progressBarRef.current.style.transform = "scaleX(0)";
      return;
    }

    let rafId: number;
    const tick = () => {
      const el = hasVideoAnswer ? fullVideoRef.current : audioRef.current;
      if (el && progressBarRef.current) {
        const total = question.answerDuration ?? el.duration;
        if (total && isFinite(total) && total > 0) {
          const fraction = Math.min(el.currentTime / total, 1);
          progressBarRef.current.style.transform = `scaleX(${fraction})`;
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isWatching, hasVideoAnswer, question.answerDuration]);

  return (
    <div className="flex flex-col lg:flex-row lg:items-start">
      {/* Left: question text + meta */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden pt-[20px] lg:pt-[50px]" style={{ paddingLeft: 15, paddingRight: 50 }}>
        <a
          href={`${basePath}/q/${question.id}`}
          className="hover:opacity-80 transition-opacity"
        >
          <span
            style={{
              fontSize: "40px",
              lineHeight: 1.3,
              color: "#0E412E",
              fontFamily: "var(--font-figtree)",
              fontWeight: 400,
              backgroundColor: "#ECF5DC",
              boxDecorationBreak: "clone",
              WebkitBoxDecorationBreak: "clone",
              padding: "2px 8px",
            }}
          >
            {question.text}
          </span>
        </a>

        {/* Bottom row: share + tags */}
        <div className="flex items-center gap-2 py-[20px]">
          <button
            onClick={handleShare}
            className={`${copied ? "" : "hover:opacity-70"} cursor-pointer rounded-full flex items-center gap-1 overflow-hidden`}
            style={{
              height: 24,
              width: copied ? 85 : 24,
              backgroundColor: partyColor || "#3B82F6",
              transition: "width 300ms ease",
            }}
            aria-label="Del"
          >
            <span
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 24, height: 24 }}
            >
              <FontAwesomeIcon
                icon={faShare}
                style={{ color: partyColorDark || "#1E3A5F", fontSize: "13.5px" }}
              />
            </span>
            <span
              style={{
                color: partyColorDark || "#1E3A5F",
                fontSize: "11px",
                fontFamily: "var(--font-figtree)",
                fontWeight: 500,
                whiteSpace: "nowrap",
                opacity: copied ? 1 : 0,
                transition: "opacity 200ms ease",
              }}
            >
              Kopieret
            </span>
          </button>
          {question.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1"
              style={{ backgroundColor: "#ECF5DC", color: "#0E412E", fontFamily: "var(--font-figtree)", fontWeight: 500 }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Right: video/photo thumbnail with playback */}
      {(thumbnailClipUrl || thumbnailPhotoUrl) && (
        <div
          ref={thumbnailWrapRef}
          className={`flex-shrink-0 relative w-[90vw] self-center lg:self-auto lg:w-[337px] ${hasPlayableMedia ? "cursor-pointer" : ""}`}
          style={{ borderRadius: 20, overflow: "hidden", aspectRatio: "3/4", scrollMarginTop: 170 }}
          onClick={hasPlayableMedia ? handleThumbnailClick : undefined}
          onMouseEnter={() => hasPlayableMedia && setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {/* Dark overlay + play icon on hover */}
          {hasPlayableMedia && !isWatching && (
            <>
              <div
                className="absolute inset-0 transition-opacity duration-200"
                style={{
                  zIndex: 1,
                  opacity: isHovering ? 0.2 : 0,
                  backgroundColor: partyColorDark || "#1E3A5F",
                  pointerEvents: "none",
                  borderRadius: 20,
                }}
              />
              <div
                className="absolute inset-0 flex items-center justify-center transition-opacity duration-200"
                style={{
                  zIndex: 2,
                  opacity: isHovering ? 1 : 0,
                  pointerEvents: "none",
                }}
              >
                <FontAwesomeIcon
                  icon={faCirclePlay}
                  style={{ color: "#ffffff", fontSize: 48 }}
                />
              </div>
            </>
          )}

          {/* Progress bar */}
          {isWatching && (
            <div
              className="absolute"
              style={{ zIndex: 5, bottom: 35, left: 30, right: 30, height: 4, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 9999, mixBlendMode: "difference", overflow: "hidden" }}
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
              preload="auto"
              onEnded={handleFullVideoEnded}
              onWaiting={handleWaiting}
              onPlaying={handlePlaying}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
              style={{ zIndex: isWatching ? 3 : 0, opacity: isWatching ? 1 : 0 }}
            />
          )}

          {/* Buffering spinner — ref-controlled to avoid re-renders during playback */}
          {isWatching && (
            <div
              ref={bufferingRef}
              className="absolute inset-0 flex items-center justify-center"
              style={{ zIndex: 4, opacity: 0, pointerEvents: "none", transition: "opacity 150ms" }}
            >
              <svg
                className="animate-spin h-10 w-10 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {/* Hidden audio element */}
          {hasAudioAnswer && (
            <audio
              ref={audioRef}
              src={question.answerUrl!}
              preload="none"
              onEnded={handleAudioEnded}
            />
          )}

          {/* Temporary version indicator — remove after mobile debugging */}
          <span style={{ position: "absolute", bottom: 4, right: 6, fontSize: 9, color: "rgba(255,255,255,0.5)", zIndex: 99, fontFamily: "monospace", pointerEvents: "none" }}>v5</span>

          {/* Thumbnail visual */}
          {thumbnailClipUrl ? (
            <video
              ref={clipRef}
              src={thumbnailClipUrl}
              muted
              playsInline
              preload="auto"
              poster={thumbnailPhotoUrl || undefined}
              className="w-full h-full object-cover"
              style={{ borderRadius: 20 }}
            />
          ) : (
            <img
              src={thumbnailPhotoUrl!}
              alt=""
              className="w-full h-full object-cover"
              style={{ borderRadius: 20 }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Card for the answered-questions carousel */
function AnsweredQuestionCard({
  question,
  basePath,
  appUrl,
  partyColor,
  partyColorDark,
  playingId,
  setPlayingId,
  isVisible = true,
}: {
  question: FeedQuestion;
  basePath: string;
  appUrl: string;
  partyColor?: string | null;
  partyColorDark?: string | null;
  playingId: string | null;
  setPlayingId: (id: string | null) => void;
  isVisible?: boolean;
}) {
  const mediaType = question.answerUrl && isBlobUrl(question.answerUrl)
    ? getBlobMediaType(question.answerUrl)
    : null;
  const hasVideoAnswer = mediaType === "video";
  const hasAudioAnswer = mediaType === "audio";
  const hasPlayableMedia = hasVideoAnswer || hasAudioAnswer;

  const clipUrl = question.answerClipUrl;
  const photoUrl = question.answerPhotoUrl;
  const cardRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLVideoElement>(null);
  const fullVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [isHovering, setIsHovering] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const isWatchingRef = useRef(false);
  const bufferingRef = useRef<HTMLDivElement>(null);
  useEffect(() => { isWatchingRef.current = isWatching; }, [isWatching]);

  // Share/copy state
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleShare = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${appUrl}${basePath}/q/${question.id}`;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (isTouch && navigator.share) {
      navigator.share({ url, title: question.text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }, [appUrl, basePath, question.id, question.text]);

  // Stop if another card started playing (full reset)
  useEffect(() => {
    if (playingId && playingId !== question.id && isWatching) {
      fullVideoRef.current?.pause();
      audioRef.current?.pause();
      setIsWatching(false);
      if (bufferingRef.current) bufferingRef.current.style.opacity = "0";
    }
  }, [playingId, question.id, isWatching]);

  // Pause/resume when scrolled out of / back into view in mobile carousel
  useEffect(() => {
    if (!isWatching || playingId !== question.id) return;
    if (!isVisible) {
      fullVideoRef.current?.pause();
      audioRef.current?.pause();
    } else {
      fullVideoRef.current?.play().catch(() => {});
      audioRef.current?.play().catch(() => {});
    }
  }, [isVisible, isWatching, playingId, question.id]);

  // Hover clip: play forward on hover, reset on leave (desktop only)
  useEffect(() => {
    const clip = clipRef.current;
    if (!clip || !clipUrl) return;
    // On touch devices, IntersectionObserver handles clip playback — skip hover logic entirely
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (isHovering && !isWatching) {
      clip.currentTime = 0;
      clip.play().catch(() => {});
    } else {
      clip.pause();
      clip.currentTime = 0;
    }
  }, [isHovering, isWatching, clipUrl]);

  // Mobile: autoplay clip when visible, pause everything when scrolled away
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) return;

    let inViewport = false;

    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewport = entry.isIntersecting;
        const clip = clipRef.current;

        if (entry.isIntersecting) {
          if (!isWatchingRef.current && clip && clipUrl) {
            // ALWAYS force-reload on mobile viewport entry.
            clip.oncanplay = () => {
              clip.oncanplay = null;
              if (inViewport && !isWatchingRef.current) {
                clip.currentTime = 0;
                clip.play().catch(() => {});
              }
            };
            clip.load();
          }
        } else {
          if (clip && clipUrl && !isWatchingRef.current) {
            clip.oncanplay = null;
            clip.pause();
          }
          // Pause full video/audio when scrolled out of view
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
  }, [clipUrl]);

  // Click to play/pause full video
  const handleClick = useCallback(() => {
    if (!hasPlayableMedia) return;
    if (isWatching) {
      fullVideoRef.current?.pause();
      audioRef.current?.pause();
      setIsWatching(false);
      setPlayingId(null);
    } else if (hasVideoAnswer) {
      // Stop clip to free mobile video decoder before starting full video
      if (clipRef.current) { clipRef.current.pause(); clipRef.current.currentTime = 0; }
      requestAnimationFrame(() => { if (bufferingRef.current) bufferingRef.current.style.opacity = "1"; });
      if (fullVideoRef.current) {
        fullVideoRef.current.currentTime = 0;
        fullVideoRef.current.play().catch(() => {});
      }
      setIsWatching(true);
      setPlayingId(question.id);
      // Scroll card into view accounting for sticky header + carousel arrows below
      requestAnimationFrame(() => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const headerH = 170;
        const arrowsH = 80;
        const cardTotalH = (rect.bottom - rect.top) + arrowsH;
        const availableH = window.innerHeight - headerH;
        if (cardTotalH > availableH) {
          // Card + arrows taller than viewport: prioritize showing bottom + arrows
          const d = rect.bottom + arrowsH - window.innerHeight;
          if (Math.abs(d) > 1) window.scrollBy({ top: d, behavior: "smooth" });
        } else {
          if (rect.top < headerH) {
            window.scrollBy({ top: rect.top - headerH, behavior: "smooth" });
          } else if (rect.bottom + arrowsH > window.innerHeight) {
            window.scrollBy({ top: rect.bottom + arrowsH - window.innerHeight, behavior: "smooth" });
          }
        }
      });
    } else if (hasAudioAnswer) {
      // Stop clip to free mobile video decoder before starting audio playback
      if (clipRef.current) { clipRef.current.pause(); clipRef.current.currentTime = 0; }
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      setIsWatching(true);
      setPlayingId(question.id);
      requestAnimationFrame(() => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const headerH = 170;
        const arrowsH = 80;
        const cardTotalH = (rect.bottom - rect.top) + arrowsH;
        const availableH = window.innerHeight - headerH;
        if (cardTotalH > availableH) {
          const d = rect.bottom + arrowsH - window.innerHeight;
          if (Math.abs(d) > 1) window.scrollBy({ top: d, behavior: "smooth" });
        } else {
          if (rect.top < headerH) {
            window.scrollBy({ top: rect.top - headerH, behavior: "smooth" });
          } else if (rect.bottom + arrowsH > window.innerHeight) {
            window.scrollBy({ top: rect.bottom + arrowsH - window.innerHeight, behavior: "smooth" });
          }
        }
      });
    }
  }, [hasPlayableMedia, hasVideoAnswer, hasAudioAnswer, isWatching, question.id, setPlayingId]);

  const handleEnded = useCallback(() => {
    setIsWatching(false);
    setPlayingId(null);
  }, [setPlayingId]);

  // Progress bar
  useEffect(() => {
    if (!isWatching) {
      if (progressBarRef.current) progressBarRef.current.style.transform = "scaleX(0)";
      return;
    }
    let rafId: number;
    const tick = () => {
      const el = hasVideoAnswer ? fullVideoRef.current : audioRef.current;
      if (el && progressBarRef.current) {
        const total = question.answerDuration ?? el.duration;
        if (total && isFinite(total) && total > 0) {
          const fraction = Math.min(el.currentTime / total, 1);
          progressBarRef.current.style.transform = `scaleX(${fraction})`;
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isWatching, hasVideoAnswer, question.answerDuration]);

  return (
    <div
      ref={cardRef}
      className={`relative ${hasPlayableMedia ? "cursor-pointer" : ""}`}
      style={{ aspectRatio: "3/4", borderRadius: 20, overflow: "hidden", scrollMarginTop: 170 }}
      onClick={hasPlayableMedia ? handleClick : undefined}
      onMouseEnter={() => hasPlayableMedia && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Thumbnail clip/photo */}
      {clipUrl ? (
        <video
          ref={clipRef}
          src={clipUrl}
          muted
          playsInline
          preload="auto"
          poster={photoUrl || undefined}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          loading="eager"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: partyColor || "#7E7D7A" }}
        />
      )}

      {/* Dark hover overlay + play icon (only when not watching) */}
      {hasPlayableMedia && !isWatching && (
        <>
          <div
            className="absolute inset-0 transition-opacity duration-200"
            style={{
              zIndex: 1,
              opacity: isHovering ? 0.2 : 0,
              backgroundColor: partyColorDark || "#1E3A5F",
              pointerEvents: "none",
              borderRadius: 20,
            }}
          />
          <div
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-200"
            style={{
              zIndex: 2,
              opacity: isHovering ? 1 : 0,
              pointerEvents: "none",
            }}
          >
            <FontAwesomeIcon
              icon={faCirclePlay}
              style={{ color: "#ffffff", fontSize: 48 }}
            />
          </div>
        </>
      )}

      {/* Progress bar */}
      {isWatching && (
        <div
          className="absolute"
          style={{ zIndex: 5, bottom: 25, left: 20, right: 20, height: 4, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 9999, mixBlendMode: "difference", overflow: "hidden" }}
        >
          <div
            ref={progressBarRef}
            style={{ height: "100%", width: "100%", backgroundColor: "#ffffff", transformOrigin: "left", transform: "scaleX(0)", willChange: "transform" }}
          />
        </div>
      )}

      {/* Full video for on-card playback */}
      {hasVideoAnswer && (
        <video
          ref={fullVideoRef}
          src={question.answerUrl!}
          playsInline
          preload="auto"
          onEnded={handleEnded}
          onWaiting={() => { if (bufferingRef.current) bufferingRef.current.style.opacity = "1"; }}
          onPlaying={() => { if (bufferingRef.current) bufferingRef.current.style.opacity = "0"; }}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
          style={{ zIndex: isWatching ? 3 : 0, opacity: isWatching ? 1 : 0 }}
        />
      )}

      {/* Buffering spinner — ref-controlled to avoid re-renders during playback */}
      {isWatching && (
        <div ref={bufferingRef} className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 4, opacity: 0, pointerEvents: "none", transition: "opacity 150ms" }}>
          <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Audio element */}
      {hasAudioAnswer && (
        <audio ref={audioRef} src={question.answerUrl!} preload="none" onEnded={handleEnded} />
      )}

      {/* Bottom: highlighted text + share + tags */}
      <div
        className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-20 transition-opacity duration-300"
        style={{ zIndex: 3, pointerEvents: "none", opacity: isWatching ? 0 : 1 }}
      >
        <span
          style={{
            fontSize: "22px",
            lineHeight: 1.3,
            color: partyColorDark || "#0E412E",
            fontFamily: "var(--font-figtree)",
            fontWeight: 400,
            backgroundColor: partyColor || "#00D564",
            boxDecorationBreak: "clone",
            WebkitBoxDecorationBreak: "clone",
            padding: "2px 8px",
          }}
        >
          {question.text}
        </span>

        {/* Suggested by label */}
        {question.suggestedBy && (
          <div className="mt-1">
            <span
              style={{
                fontSize: "12px",
                lineHeight: 1.3,
                color: "#000000",
                backgroundColor: "#FFFFFF",
                boxDecorationBreak: "clone",
                WebkitBoxDecorationBreak: "clone",
                padding: "2px 8px",
                fontFamily: "var(--font-figtree)",
                fontWeight: 400,
              }}
            >
              {question.suggestedBy}
            </span>
          </div>
        )}

        {/* Share + tags row */}
        <div className="flex items-center gap-2 mt-3" style={{ pointerEvents: "auto" }}>
          <button
            onClick={handleShare}
            className={`${copied ? "" : "hover:opacity-70"} cursor-pointer rounded-full flex items-center gap-1 overflow-hidden`}
            style={{
              height: 24,
              width: copied ? 85 : 24,
              backgroundColor: partyColor || "#3B82F6",
              transition: "width 300ms ease",
            }}
            aria-label="Del"
          >
            <span
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 24, height: 24 }}
            >
              <FontAwesomeIcon
                icon={faShare}
                style={{ color: partyColorDark || "#1E3A5F", fontSize: "13.5px" }}
              />
            </span>
            <span
              style={{
                color: partyColorDark || "#1E3A5F",
                fontSize: "11px",
                fontFamily: "var(--font-figtree)",
                fontWeight: 500,
                whiteSpace: "nowrap",
                opacity: copied ? 1 : 0,
                transition: "opacity 200ms ease",
              }}
            >
              Kopieret
            </span>
          </button>
          {question.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1"
              style={{ backgroundColor: "#ECF5DC", color: "#0E412E", fontFamily: "var(--font-figtree)", fontWeight: 500 }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Carousel for answered questions — grid on desktop, swipeable on mobile */
function AnsweredQuestionsCarousel({
  questions,
  basePath,
  appUrl,
  partyColor,
  partyColorDark,
  playingId,
  setPlayingId,
}: {
  questions: FeedQuestion[];
  basePath: string;
  appUrl: string;
  partyColor?: string | null;
  partyColorDark?: string | null;
  playingId: string | null;
  setPlayingId: (id: string | null) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hoverArrow, setHoverArrow] = useState<string | null>(null);

  // Desktop: measure available width to determine how many cards fit
  const desktopRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [desktopIndex, setDesktopIndex] = useState(0);

  useEffect(() => {
    const el = desktopRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setAvailableWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cardW = 337;
  const gapW = 16;
  const maxVisible = availableWidth > 0 ? Math.max(1, Math.floor((availableWidth + gapW) / (cardW + gapW))) : questions.length;
  const visibleCount = Math.min(maxVisible, questions.length);
  const needsDesktopArrows = questions.length > visibleCount;
  const desktopMaxIndex = questions.length - visibleCount;

  // Clamp desktopIndex when visible count changes
  useEffect(() => {
    if (desktopIndex > desktopMaxIndex) setDesktopIndex(Math.max(0, desktopMaxIndex));
  }, [desktopIndex, desktopMaxIndex]);

  return (
    <div>
      {/* Desktop: sliding carousel with arrows when not all cards fit */}
      <div className="hidden lg:block" ref={desktopRef}>
        <div
          className="overflow-hidden mx-auto"
          style={{ width: visibleCount * cardW + (visibleCount - 1) * gapW }}
        >
          <div
            className="flex gap-4 transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${desktopIndex * (cardW + gapW)}px)` }}
          >
            {questions.map((q, i) => (
              <div key={q.id} className="flex-shrink-0" style={{ width: cardW }}>
                <AnsweredQuestionCard
                  question={q}
                  basePath={basePath}
                  appUrl={appUrl}
                  partyColor={partyColor}
                  partyColorDark={partyColorDark}
                  playingId={playingId}
                  setPlayingId={setPlayingId}
                  isVisible={i >= desktopIndex && i < desktopIndex + visibleCount}
                />
              </div>
            ))}
          </div>
        </div>
        {needsDesktopArrows && (
          <div className="flex justify-center gap-3 mt-3">
            <button
              onClick={() => setDesktopIndex((i) => Math.max(0, i - 1))}
              disabled={desktopIndex === 0}
              className="rounded-full flex items-center justify-center cursor-pointer disabled:opacity-30"
              style={{
                width: 40,
                height: 40,
                backgroundColor: hoverArrow === "desktop-left" ? (partyColorDark || "#0E412E") : (partyColor || "#00D564"),
              }}
              onMouseEnter={() => setHoverArrow("desktop-left")}
              onMouseLeave={() => setHoverArrow(null)}
              aria-label="Forrige"
            >
              <FontAwesomeIcon
                icon={faChevronLeft}
                style={{
                  color: hoverArrow === "desktop-left" ? (partyColor || "#00D564") : (partyColorDark || "#0E412E"),
                  fontSize: 18,
                }}
              />
            </button>
            <button
              onClick={() => setDesktopIndex((i) => Math.min(desktopMaxIndex, i + 1))}
              disabled={desktopIndex === desktopMaxIndex}
              className="rounded-full flex items-center justify-center cursor-pointer disabled:opacity-30"
              style={{
                width: 40,
                height: 40,
                backgroundColor: hoverArrow === "desktop-right" ? (partyColorDark || "#0E412E") : (partyColor || "#00D564"),
              }}
              onMouseEnter={() => setHoverArrow("desktop-right")}
              onMouseLeave={() => setHoverArrow(null)}
              aria-label="Næste"
            >
              <FontAwesomeIcon
                icon={faChevronRight}
                style={{
                  color: hoverArrow === "desktop-right" ? (partyColor || "#00D564") : (partyColorDark || "#0E412E"),
                  fontSize: 18,
                }}
              />
            </button>
          </div>
        )}
      </div>

      {/* Mobile: single card carousel */}
      <div className="lg:hidden">
        <div className="overflow-hidden" style={{ borderRadius: 20 }}>
          <div
            className="flex transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {questions.map((q, i) => (
              <div key={q.id} className="w-full flex-shrink-0">
                <AnsweredQuestionCard
                  question={q}
                  basePath={basePath}
                  appUrl={appUrl}
                  partyColor={partyColor}
                  partyColorDark={partyColorDark}
                  playingId={playingId}
                  setPlayingId={setPlayingId}
                  isVisible={i === currentIndex}
                />
              </div>
            ))}
          </div>
        </div>
        {questions.length > 1 && (
          <div className="flex justify-center gap-3 mt-3">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="rounded-full flex items-center justify-center cursor-pointer disabled:opacity-30"
              style={{
                width: 40,
                height: 40,
                backgroundColor: hoverArrow === "mobile-left" ? (partyColorDark || "#0E412E") : (partyColor || "#00D564"),
              }}
              onMouseEnter={() => setHoverArrow("mobile-left")}
              onMouseLeave={() => setHoverArrow(null)}
              aria-label="Forrige"
            >
              <FontAwesomeIcon
                icon={faChevronLeft}
                style={{
                  color: hoverArrow === "mobile-left" ? (partyColor || "#00D564") : (partyColorDark || "#0E412E"),
                  fontSize: 18,
                }}
              />
            </button>
            <button
              onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              disabled={currentIndex === questions.length - 1}
              className="rounded-full flex items-center justify-center cursor-pointer disabled:opacity-30"
              style={{
                width: 40,
                height: 40,
                backgroundColor: hoverArrow === "mobile-right" ? (partyColorDark || "#0E412E") : (partyColor || "#00D564"),
              }}
              onMouseEnter={() => setHoverArrow("mobile-right")}
              onMouseLeave={() => setHoverArrow(null)}
              aria-label="Næste"
            >
              <FontAwesomeIcon
                icon={faChevronRight}
                style={{
                  color: hoverArrow === "mobile-right" ? (partyColor || "#00D564") : (partyColorDark || "#0E412E"),
                  fontSize: 18,
                }}
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Grid layout for unanswered questions — matches answered card columns */
function UnansweredQuestionsGrid({
  questions,
  appUrl,
  basePath,
  hasSession,
  partySlug,
  politicianSlug,
  politicianFirstName,
  partyColor,
  partyColorDark,
  onLoginUpvote,
}: {
  questions: FeedQuestion[];
  appUrl: string;
  basePath: string;
  hasSession: boolean;
  partySlug: string;
  politicianSlug: string;
  politicianFirstName: string;
  partyColor?: string | null;
  partyColorDark?: string | null;
  onLoginUpvote?: (questionId: string) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setAvailableWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cardW = 337;
  const gapW = 16;
  const rawCols = availableWidth > 0
    ? Math.max(1, Math.floor((availableWidth + gapW) / (cardW + gapW)))
    : 3;
  // Clamp between 2 and 4 (but allow 1 on very small screens)
  const maxCols = availableWidth > 0 ? Math.min(4, Math.max(1, rawCols)) : 3;
  // Don't use more columns than there are questions
  const cols = Math.min(maxCols, questions.length || 1);
  // Full-width only when the screen can only fit 1 column (mobile)
  const isFullWidth = maxCols <= 1;
  const gridWidth = cols * cardW + (cols - 1) * gapW;

  return (
    <div ref={gridRef}>
      <div
        className="mx-auto"
        style={isFullWidth ? { width: "100%" } : { width: gridWidth }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isFullWidth ? "1fr" : `repeat(${cols}, ${cardW}px)`,
            gap: `0 ${gapW}px`,
          }}
        >
          {questions.map((question, i) => {
            const colIndex = i % cols;
            const rowIndex = Math.floor(i / cols);
            return (
              <React.Fragment key={question.id}>
                {/* Horizontal separator between rows */}
                {rowIndex > 0 && colIndex === 0 && (
                  <div
                    className="my-6"
                    style={{
                      gridColumn: "1 / -1",
                      height: 1,
                      backgroundColor: `${partyColor || "#00D564"}40`,
                    }}
                  />
                )}
                <div className="relative">
                  {/* Vertical separator line centered in the gap */}
                  {colIndex > 0 && (
                    <div
                      className="absolute top-0 bottom-0"
                      style={{
                        left: -(gapW / 2) - 0.5,
                        width: 1,
                        backgroundColor: `${partyColor || "#00D564"}40`,
                      }}
                    />
                  )}
                  <UnansweredQuestionCard
                    question={question}
                    appUrl={appUrl}
                    basePath={basePath}
                    hasSession={hasSession}
                    partySlug={partySlug}
                    politicianSlug={politicianSlug}
                    politicianFirstName={politicianFirstName}
                    partyColor={partyColor}
                    partyColorDark={partyColorDark}
                    onLoginUpvote={onLoginUpvote}
                  />
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function UnansweredQuestionCard({
  question,
  appUrl,
  basePath,
  hasSession,
  partySlug,
  politicianSlug,
  politicianFirstName,
  partyColor,
  partyColorDark,
  onLoginUpvote,
}: {
  question: FeedQuestion;
  appUrl: string;
  basePath: string;
  hasSession: boolean;
  partySlug: string;
  politicianSlug: string;
  politicianFirstName: string;
  partyColor?: string | null;
  partyColorDark?: string | null;
  onLoginUpvote?: (questionId: string) => void;
}) {
  // Share/copy state
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleShare = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${appUrl}${basePath}/q/${question.id}`;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (isTouch && navigator.share) {
      navigator.share({ url, title: question.text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }, [appUrl, basePath, question.id, question.text]);

  // Upvote state: "idle" | "pending" | "upvoted" | "waiting" | "cancel-ready" | "cancelling"
  const [upvoteState, setUpvoteState] = useState<"idle" | "pending" | "upvoted" | "waiting" | "cancel-ready" | "cancelling">(
    question.goalReachedEmailSent && question.isUpvoted ? "waiting"
      : question.isUpvoted ? "cancel-ready"
      : "idle"
  );
  const [isHovering, setIsHovering] = useState(false);
  const [showUpvoteHint, setShowUpvoteHint] = useState(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync upvoteState when server props change (e.g. after logout revalidation)
  useEffect(() => {
    setUpvoteState(
      question.goalReachedEmailSent && question.isUpvoted ? "waiting"
        : question.isUpvoted ? "cancel-ready"
        : "idle"
    );
  }, [question.isUpvoted, question.goalReachedEmailSent]);

  // Looping animation: alternate between hourglass and upvote hint every 3s
  // Pauses on hover; resets to hourglass (false) on mouse leave
  useEffect(() => {
    if (!question.goalReachedEmailSent || question.isUpvoted || isHovering) {
      setShowUpvoteHint(false);
      return;
    }
    const interval = setInterval(() => {
      setShowUpvoteHint((prev) => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, [question.goalReachedEmailSent, question.isUpvoted, isHovering]);

  // Compute deadline hours remaining for tooltip
  const deadlineHoursLeft = useMemo(() => {
    if (!question.goalReachedAt) return null;
    const deadline = new Date(question.goalReachedAt).getTime() + 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((deadline - Date.now()) / (1000 * 60 * 60)));
  }, [question.goalReachedAt]);

  const handleUpvote = useCallback(async () => {
    if (upvoteState !== "idle") return;
    if (!hasSession) {
      onLoginUpvote?.(question.id);
      return;
    }
    setUpvoteState("pending");
    try {
      await directUpvote(question.id, partySlug, politicianSlug);
      setUpvoteState("upvoted");
      window.dispatchEvent(new CustomEvent("upvote-banner", { detail: { message: "Din upvote er registreret" } }));
      const reachedGoal = question.upvoteCount + 1 >= question.upvoteGoal;
      transitionTimerRef.current = setTimeout(() => {
        setIsHovering(false);
        setUpvoteState(reachedGoal ? "waiting" : "cancel-ready");
      }, 2000);
    } catch {
      setUpvoteState("idle");
    }
  }, [upvoteState, hasSession, basePath, question.id, partySlug, politicianSlug]);

  const handleCancelUpvote = useCallback(async () => {
    if (upvoteState !== "cancel-ready" && upvoteState !== "waiting") return;
    const prevState = upvoteState;
    setUpvoteState("cancelling");
    try {
      await cancelUpvote(question.id, partySlug, politicianSlug);
      setUpvoteState("idle");
      window.dispatchEvent(new CustomEvent("upvote-banner", { detail: { message: "Din upvote er fjernet" } }));
    } catch {
      setUpvoteState(prevState);
    }
  }, [upvoteState, question.id, partySlug, politicianSlug]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  // Upvote button rendering
  const renderUpvoteButton = () => {
    if (upvoteState === "cancel-ready" || upvoteState === "cancelling") {
      return (
        <button
          onClick={handleCancelUpvote}
          disabled={upvoteState === "cancelling"}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          className="cursor-pointer rounded-full flex items-center justify-center disabled:opacity-50"
          style={{
            width: 40,
            height: 40,
            backgroundColor: isHovering ? "#000000" : "#FF410580",
          }}
          aria-label="Fjern upvote"
        >
          <FontAwesomeIcon
            icon={faXmark}
            style={{ color: isHovering ? "#FF4105" : "#000000", fontSize: 21 }}
          />
        </button>
      );
    }

    if (upvoteState === "waiting") {
      return (
        <div className="relative">
          {isHovering && (
            <div
              className="absolute bottom-full mb-2 rounded-xl px-4 py-3 uq-tooltip"
              style={{
                backgroundColor: partyColor || "#7E7D7A",
                fontFamily: "var(--font-figtree)",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              <span className="text-sm" style={{ color: "#ffffff" }}>
                {deadlineHoursLeft !== null && deadlineHoursLeft > 0
                  ? `${politicianFirstName} svarer inden for ${deadlineHoursLeft} timer`
                  : deadlineHoursLeft === 0
                  ? "Fristen er udløbet"
                  : `Afventer svar fra ${politicianFirstName}`}
              </span>
            </div>
          )}
          <button
            onClick={handleCancelUpvote}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            className="cursor-pointer rounded-full flex items-center justify-center"
            style={{
              width: 40,
              height: 40,
              backgroundColor: isHovering ? "#FF410580" : `${partyColor || "#00D564"}40`,
            }}
            aria-label="Afventer svar"
          >
            <FontAwesomeIcon
              icon={isHovering ? faXmark : faHourglass}
              style={{ color: isHovering ? "#000000" : (partyColorDark || "#0E412E"), fontSize: 21 }}
            />
          </button>
        </div>
      );
    }

    // Goal reached but user hasn't upvoted — show hourglass with tooltip + upvote on hover
    if (question.goalReachedEmailSent && (upvoteState === "idle" || upvoteState === "pending")) {
      return (
        <div className="relative">
          {isHovering && (
            <div
              className="absolute bottom-full mb-2 rounded-xl px-4 py-3 uq-tooltip"
              style={{
                backgroundColor: partyColor || "#7E7D7A",
                fontFamily: "var(--font-figtree)",
                fontWeight: 500,
                width: 260,
                whiteSpace: "normal",
              }}
            >
              <span className="text-sm block" style={{ color: "#ffffff" }}>
                {deadlineHoursLeft !== null && deadlineHoursLeft > 0
                  ? `${politicianFirstName} svarer inden for ${deadlineHoursLeft} timer`
                  : deadlineHoursLeft === 0
                  ? "Fristen er udløbet"
                  : `Afventer svar fra ${politicianFirstName}`}
              </span>
              <span className="text-xs block mt-1" style={{ color: partyColorDark || "#0E412E" }}>
                Dette spørgsmål har nået sit upvote-mål. Sæt din egen upvote for at blive notificeret, når {politicianFirstName} svarer.
              </span>
            </div>
          )}
          <button
            onClick={handleUpvote}
            disabled={upvoteState === "pending"}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            className="cursor-pointer rounded-full flex items-center justify-center disabled:opacity-50"
            style={{
              width: 40,
              height: 40,
              backgroundColor: isHovering
                ? (partyColor || "#00D564")
                : showUpvoteHint
                  ? (partyColor || "#00D564")
                  : `${partyColor || "#00D564"}40`,
              transition: isHovering ? "none" : "background-color 150ms ease",
            }}
            aria-label="Upvote"
          >
            <span className="relative" style={{ width: 21, height: 21 }}>
              <span
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  opacity: (isHovering || showUpvoteHint) ? 1 : 0,
                  transition: isHovering ? "none" : "opacity 150ms ease",
                }}
              >
                <FontAwesomeIcon
                  icon={faArrowUpDuotone}
                  style={{ color: partyColorDark || "#0E412E", fontSize: 21 }}
                />
              </span>
              <span
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  opacity: (isHovering || showUpvoteHint) ? 0 : 1,
                  transition: isHovering ? "none" : "opacity 150ms ease",
                }}
              >
                <FontAwesomeIcon
                  icon={faHourglass}
                  style={{ color: partyColorDark || "#0E412E", fontSize: 21 }}
                />
              </span>
            </span>
          </button>
        </div>
      );
    }

    if (upvoteState === "upvoted") {
      return (
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            backgroundColor: partyColor || "#00D564",
          }}
        >
          <FontAwesomeIcon
            icon={faCheck}
            style={{ color: partyColorDark || "#0E412E", fontSize: 21 }}
          />
        </div>
      );
    }

    // idle or pending
    return (
      <button
        onClick={handleUpvote}
        disabled={upvoteState === "pending"}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className="cursor-pointer rounded-full flex items-center justify-center disabled:opacity-50"
        style={{
          width: 40,
          height: 40,
          backgroundColor: isHovering && upvoteState === "idle"
            ? (partyColorDark || "#0E412E")
            : (partyColor || "#00D564"),
        }}
        aria-label="Upvote"
      >
        {isHovering && upvoteState === "idle" ? (
          <span
            style={{
              color: "#FFFFFF",
              fontSize: 17.5,
              fontFamily: "var(--font-figtree)",
              fontWeight: 700,
            }}
          >
            +1
          </span>
        ) : (
          <FontAwesomeIcon
            icon={faArrowUpDuotone}
            style={{ color: partyColorDark || "#0E412E", fontSize: 21 }}
          />
        )}
      </button>
    );
  };

  return (
    <div
      className="flex items-start"
      style={{ padding: "16px 20px", gap: 20 }}
    >
      <style>{`
        .uq-tooltip { right: 0; }
        @media (min-width: 640px) { .uq-tooltip { right: auto; left: 50%; transform: translateX(-50%); } }
      `}</style>
      {/* Text + suggestedBy + share + tags */}
      <div className="flex-1 min-w-0">
        <a
          href={`${basePath}/q/${question.id}`}
          style={{
            fontSize: 22,
            lineHeight: 1.3,
            color: partyColorDark || "#0E412E",
            fontFamily: "var(--font-figtree)",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          {question.text}
        </a>

        {question.suggestedBy && (
          <div
            style={{
              fontSize: 14,
              color: "#7E7D7A",
              fontFamily: "var(--font-figtree)",
              fontWeight: 400,
              marginTop: 4,
            }}
          >
            {question.suggestedBy}
          </div>
        )}

        {/* Share + tags row */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleShare}
            className={`${copied ? "" : "hover:opacity-70"} cursor-pointer rounded-full flex items-center gap-1 overflow-hidden`}
            style={{
              height: 24,
              width: copied ? 85 : 24,
              backgroundColor: partyColor || "#3B82F6",
              transition: "width 300ms ease",
            }}
            aria-label="Del"
          >
            <span
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 24, height: 24 }}
            >
              <FontAwesomeIcon
                icon={faShare}
                style={{ color: partyColorDark || "#1E3A5F", fontSize: "13.5px" }}
              />
            </span>
            <span
              style={{
                color: partyColorDark || "#1E3A5F",
                fontSize: "11px",
                fontFamily: "var(--font-figtree)",
                fontWeight: 500,
                whiteSpace: "nowrap",
                opacity: copied ? 1 : 0,
                transition: "opacity 200ms ease",
              }}
            >
              Kopieret
            </span>
          </button>
          {question.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1"
              style={{ backgroundColor: "#ECF5DC", color: "#0E412E", fontFamily: "var(--font-figtree)", fontWeight: 500 }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Upvote button */}
      <div className="flex-shrink-0 mt-1">
        {renderUpvoteButton()}
      </div>
    </div>
  );
}
