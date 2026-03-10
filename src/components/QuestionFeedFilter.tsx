"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFire, faVideo, faMicrophone, faEllipsis, faCircleXmark } from "@fortawesome/free-solid-svg-icons";
import { faArrowRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { UpvoteButton } from "./UpvoteButton";
import { CancelUpvoteButton } from "./CancelUpvoteButton";
import { AwaitingAnswerButton } from "./AwaitingAnswerButton";
import { CopyLinkButton } from "./CopyLinkButton";
import { isBlobUrl, getBlobMediaType } from "@/lib/answer-utils";
import { citizenLogout } from "@/app/[partySlug]/[politicianSlug]/actions";

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
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sort, setSort] = useState<SortOption>("newest");
  const [group, setGroup] = useState<GroupOption>("all");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const isFiltered = sort !== "newest" || group !== "all" || selectedTags.size > 0;
  const hasMoreFilters = sort !== "newest" || selectedTags.size > 0;

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

  const { pinnedQuestions, answeredQuestions, upvoteQuestions } = useMemo(() => {
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

    // Split pinned from regular only when filter is "all"
    const pinned = group === "all" ? result.filter((q) => q.pinned) : [];
    const nonPinned = group === "all" ? result.filter((q) => !q.pinned) : result;

    // Split into answered (+ awaiting answer) and upvote questions
    const answered = nonPinned.filter((q) => !!q.answerUrl || q.goalReachedEmailSent);
    const upvote = nonPinned.filter((q) => !q.answerUrl && !q.goalReachedEmailSent);

    return { pinnedQuestions: pinned, answeredQuestions: answered, upvoteQuestions: upvote };
  }, [questions, group, selectedTags, sort]);

  return (
    <div>
      {/* Vis — always visible */}
      <div className="flex items-start gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {([
            ["all", "Alle"],
            ["own", "Politiker"],
            ["citizen", "Borger"],
            ...(hasSession && questions.some((q) => q.isUpvoted) ? [["upvoted", "Mine upvotede"] as [GroupOption, string]] : []),
          ] as [GroupOption, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setGroup(value)}
              className="text-sm px-3 py-1.5 rounded-full border border-transparent cursor-pointer transition-all duration-150"
              style={{
                fontFamily: "var(--font-funnel-sans)", fontWeight: 500,
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
            onClick={() => setMoreOpen(!moreOpen)}
            className="text-sm cursor-pointer flex items-center gap-1"
            style={{ fontFamily: "var(--font-funnel-sans)", fontWeight: 500, color: partyColorDark || "#1E3A5F" }}
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${moreOpen ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Flere filtre
          </button>
          {isFiltered && (
            <button
              onClick={reset}
              className="text-sm cursor-pointer"
              style={{ fontFamily: "var(--font-funnel-sans)", fontWeight: 500, color: "#FF4105" }}
            >
              Nulstil
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 py-1.5" style={{ marginTop: -1, marginRight: -10 }}>
          {menuOpen && hasSession && citizenEmail && (
            <div className="flex items-center gap-2" style={{ fontFamily: "var(--font-funnel-sans)", fontWeight: 500 }}>
              <span className="text-sm hidden md:inline" style={{ color: "#7E7D7A" }}>{citizenEmail}</span>
              <button
                onClick={() => citizenLogout(partySlug, politicianSlug)}
                className="cursor-pointer transition hover:opacity-50"
                aria-label="Log ud"
              >
                <FontAwesomeIcon
                  icon={faArrowRightFromBracket}
                  className="text-lg"
                  style={{ color: "#7E7D7A" }}
                />
              </button>
            </div>
          )}
          {hasSession && (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="cursor-pointer hover:opacity-50 transition-opacity"
              aria-label="Menu"
            >
              <FontAwesomeIcon
                icon={menuOpen ? faCircleXmark : faEllipsis}
                className="text-lg"
                style={{ color: partyColor || "#7E7D7A" }}
              />
            </button>
          )}
        </div>
      </div>

      {/* Flere filtre — collapsible */}
      {moreOpen && (
        <div className="mb-4 space-y-4">
          {/* Sortering */}
          <div>
            <p className="text-sm mb-2" style={{ fontFamily: "var(--font-funnel-sans)", fontWeight: 500, color: partyColorDark || "#1E3A5F" }}>Sortering</p>
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
                    fontFamily: "var(--font-funnel-sans)", fontWeight: 500,
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
              <p className="text-sm mb-2" style={{ fontFamily: "var(--font-funnel-sans)", fontWeight: 500, color: partyColorDark || "#1E3A5F" }}>Mærkesager</p>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className="text-sm px-3 py-1.5 rounded-full border border-transparent cursor-pointer transition-all duration-150"
                    style={{
                      fontFamily: "var(--font-funnel-sans)", fontWeight: 500,
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
        </div>
      )}

      {questions.length === 0 && (
        <p className="max-w-2xl mx-auto text-gray-500 text-center py-8">
          Der er endnu ingen spørgsmål fra denne politiker.
        </p>
      )}

      {/* Pinned questions section */}
      {pinnedQuestions.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-500">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
            </svg>
            <span className="text-sm font-semibold text-amber-700">Pinned</span>
          </div>
          <div className="columns-1 md:columns-2 gap-4 space-y-4">
            {pinnedQuestions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                basePath={basePath}
                appUrl={appUrl}
                hasSession={hasSession}
                partySlug={partySlug}
                politicianSlug={politicianSlug}
                politicianName={politicianName}
                partyColor={partyColor}
                partyColorDark={partyColorDark}
                isPinned
              />
            ))}
          </div>
          <hr className="border-gray-300 mt-6" />
        </div>
      )}

      {/* Desktop: 2-column layout — headings share a row so content always starts at the same y */}
      <div className="hidden md:grid md:grid-cols-2 gap-x-6 items-start">
        {/* Row 1: Headings */}
        <h2
          className="mb-3"
          style={{ fontFamily: "var(--font-funnel-sans)", fontWeight: 300, fontSize: "30px", color: "#7E7D7A" }}
        >
          Besvarede spørgsmål
        </h2>
        <h2
          className="mb-3"
          style={{ fontFamily: "var(--font-funnel-sans)", fontWeight: 300, fontSize: "30px", color: "#7E7D7A" }}
        >
          Spørgsmål til upvote
        </h2>

        {/* Row 2: Content */}
        <div>
          {answeredQuestions.length === 0 ? (
            <p className="text-sm" style={{ fontFamily: "var(--font-funnel-sans)", color: "#7E7D7A" }}>
              Ingen besvarede spørgsmål endnu
            </p>
          ) : (
            <div className="space-y-4">
              {answeredQuestions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  basePath={basePath}
                  appUrl={appUrl}
                  hasSession={hasSession}
                  partySlug={partySlug}
                  politicianSlug={politicianSlug}
                  politicianName={politicianName}
                  partyColor={partyColor}
                  partyColorDark={partyColorDark}
                  isAnsweredColumn
                />
              ))}
            </div>
          )}
        </div>
        <div>
          {upvoteQuestions.length === 0 ? (
            <p className="text-sm" style={{ fontFamily: "var(--font-funnel-sans)", color: "#7E7D7A" }}>
              Ingen spørgsmål til upvote
            </p>
          ) : (
            <div className="space-y-4">
              {upvoteQuestions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  basePath={basePath}
                  appUrl={appUrl}
                  hasSession={hasSession}
                  partySlug={partySlug}
                  politicianSlug={politicianSlug}
                  politicianName={politicianName}
                  partyColor={partyColor}
                  partyColorDark={partyColorDark}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile: Accordion layout */}
      <div className="md:hidden space-y-4">
        {/* Besvarede spørgsmål — open only if there are answered questions */}
        <details open={answeredQuestions.length > 0 ? true : undefined}>
          <summary
            className="cursor-pointer list-none flex items-center gap-2 mb-3"
            style={{ fontFamily: "var(--font-funnel-sans)", fontWeight: 300, fontSize: "30px", color: "#7E7D7A" }}
          >
            <svg className="w-3.5 h-3.5 transition-transform details-open-rotate" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Besvarede spørgsmål ({answeredQuestions.length})
          </summary>
          {answeredQuestions.length === 0 ? (
            <p className="text-sm py-8" style={{ fontFamily: "var(--font-funnel-sans)", color: "#7E7D7A" }}>
              Ingen besvarede spørgsmål endnu
            </p>
          ) : (
            <div className="space-y-4">
              {answeredQuestions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  basePath={basePath}
                  appUrl={appUrl}
                  hasSession={hasSession}
                  partySlug={partySlug}
                  politicianSlug={politicianSlug}
                  politicianName={politicianName}
                  partyColor={partyColor}
                  partyColorDark={partyColorDark}
                  isAnsweredColumn
                />
              ))}
            </div>
          )}
        </details>

        {/* Spørgsmål til upvote — open if no answered questions */}
        <details open={answeredQuestions.length === 0 ? true : undefined}>
          <summary
            className="cursor-pointer list-none flex items-center gap-2 mb-3"
            style={{ fontFamily: "var(--font-funnel-sans)", fontWeight: 300, fontSize: "30px", color: "#7E7D7A" }}
          >
            <svg className="w-3.5 h-3.5 transition-transform details-open-rotate" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Spørgsmål til upvote ({upvoteQuestions.length})
          </summary>
          {upvoteQuestions.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ fontFamily: "var(--font-funnel-sans)", color: "#7E7D7A" }}>
              Ingen spørgsmål til upvote
            </p>
          ) : (
            <div className="space-y-4">
              {upvoteQuestions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  basePath={basePath}
                  appUrl={appUrl}
                  hasSession={hasSession}
                  partySlug={partySlug}
                  politicianSlug={politicianSlug}
                  politicianName={politicianName}
                  partyColor={partyColor}
                  partyColorDark={partyColorDark}
                />
              ))}
            </div>
          )}
        </details>
      </div>

      {answeredQuestions.length === 0 && upvoteQuestions.length === 0 && pinnedQuestions.length === 0 && questions.length > 0 && (
        <p className="max-w-2xl mx-auto text-gray-500 text-center py-8">
          Ingen spørgsmål matcher dine filtre.
        </p>
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
  isAnsweredColumn,
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
  isAnsweredColumn?: boolean;
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
        fontFamily: "var(--font-funnel-sans)",
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
              fontFamily: "var(--font-funnel-sans)",
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
                <FontAwesomeIcon icon={faFire} className="text-[10px]" />
                {tag}
              </span>
            ))
          )}
          {question.answerUrl ? (
            <>
              {isAnsweredColumn ? (
                <span className="ml-auto" />
              ) : (
                <span
                  className="text-xs ml-auto transition-opacity duration-200 md:opacity-0 md:group-hover/card:opacity-100"
                  style={{ color: hasBackground ? "rgba(255,255,255,0.7)" : (partyColor || "#3B82F6") }}
                >
                  {question.upvoteCount} / {question.upvoteGoal}
                </span>
              )}
              {!isAnsweredColumn && (
                <a
                  href={`${basePath}/q/${question.id}`}
                  className="text-xs px-3 py-1.5 rounded-full cursor-pointer transition-colors duration-300"
                  style={{ backgroundColor: answerBtnBg, color: answerBtnColor }}
                >
                  {isBlobUrl(question.answerUrl) && getBlobMediaType(question.answerUrl) === "audio" ? "Lyt til svar" : "Se svar"}
                </a>
              )}
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
              {isAnsweredColumn ? (
                <span className="ml-auto" />
              ) : (
                <span className={`text-xs ml-auto ${question.goalReachedEmailSent ? "" : "transition-opacity duration-200 md:opacity-0 md:group-hover/card:opacity-100"}`} style={{ color: partyColor || "#3B82F6" }}>
                  {question.upvoteCount} / {question.upvoteGoal}
                </span>
              )}
              {question.goalReachedEmailSent && question.isUpvoted ? (
                <AwaitingAnswerButton
                  questionId={question.id}
                  partySlug={partySlug}
                  politicianSlug={politicianSlug}
                />
              ) : question.isUpvoted ? (
                <CancelUpvoteButton
                  questionId={question.id}
                  partySlug={partySlug}
                  politicianSlug={politicianSlug}
                />
              ) : !isAnsweredColumn && !question.goalReachedEmailSent ? (
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
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
