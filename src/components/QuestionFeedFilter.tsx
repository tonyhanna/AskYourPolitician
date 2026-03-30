"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVideo, faMicrophone, faXmark, faPlay, faCopy } from "@fortawesome/free-solid-svg-icons";
import { faShare, faFire, faUpRightAndDownLeftFromCenter } from "@fortawesome/pro-duotone-svg-icons";
import { PlayableMediaCard } from "./PlayableMediaCard";
import { getAnswerMediaInfo } from "@/lib/answer-utils";
import { getMuxThumbnailUrl, getMuxMp4Url } from "@/lib/mux";
import { useHlsPlayer } from "@/hooks/useHlsPlayer";
import { UpvoteModal } from "./UpvoteModal";
import { CircularUpvoteButton } from "./CircularUpvoteButton";
import { QuestionDetailEllipsis } from "./QuestionDetailEllipsis";
import { useSystemColors } from "./SystemColorProvider";

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
  muxPlaybackId?: string | null;
  muxAssetStatus?: string | null;
  muxMediaType?: string | null;
};


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
  const systemColors = useSystemColors();
  const { pending: colorPending, error: colorError } = systemColors;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<"pinned" | "answered" | "unanswered" | null>(null);
  const [isAtTop, setIsAtTop] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [upvoteModalQuestionId, setUpvoteModalQuestionId] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const isFiltered = selectedTags.size > 0;

  // Track which section is in view via scroll position
  useEffect(() => {
    function updateActiveSection() {
      const threshold = 250; // px from top of viewport — accounts for sticky nav + tags
      const sections: { id: string; key: "pinned" | "answered" | "unanswered" }[] = [
        { id: "section-pinned", key: "pinned" },
        { id: "section-answered", key: "answered" },
        { id: "section-unanswered", key: "unanswered" },
      ];

      // Find the last section whose top is above the threshold
      let active: "pinned" | "answered" | "unanswered" | null = null;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= threshold) {
            active = s.key;
          }
        }
      }

      // If nothing is active yet, select the first existing section
      if (!active) {
        for (const s of sections) {
          if (document.getElementById(s.id)) {
            active = s.key;
            break;
          }
        }
      }

      // If at bottom of page, select the last visible section
      const atBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 50);
      if (atBottom) {
        for (let i = sections.length - 1; i >= 0; i--) {
          if (document.getElementById(sections[i].id)) {
            active = sections[i].key;
            break;
          }
        }
      }

      setActiveSection(active);
      setIsAtTop(window.scrollY < 10);
    }

    updateActiveSection();
    const timer = setTimeout(updateActiveSection, 100);
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", updateActiveSection);
    };
  }, [selectedTags.size, questions.length]);

  function reset() {
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

    // Tag filter (OR logic)
    if (selectedTags.size > 0) {
      result = result.filter((q) =>
        q.tags.some((t) => selectedTags.has(t))
      );
    }

    // Sort by newest
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Split pinned from regular — only show pinned if answer is ready
    const pinned = result.filter((q) => q.pinned && q.muxAssetStatus === "ready");
    const nonPinned = result.filter((q) => !q.pinned);

    // Split answered from unanswered — only show answers that are ready (Mux transcoding complete)
    const isAnswered = (q: FeedQuestion) => q.muxAssetStatus === "ready";
    const answered = nonPinned.filter(isAnswered);
    const unanswered = nonPinned.filter((q) => !isAnswered(q));

    return { pinnedQuestions: pinned, answeredQuestions: answered, filteredQuestions: unanswered };
  }, [questions, selectedTags]);

  return (
    <div className="flex flex-col flex-1">
      {/* Sticky section nav + filter + tags */}
      <div className="sticky top-[94px] z-30 mb-[25px]" style={{ position: "sticky" }}>
        {/* Blur background — only when filters are open, extends to topbar edge */}
        {filtersOpen && (
          <div style={{ position: "absolute", top: -24, left: -15, right: -15, bottom: 0, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", backgroundColor: "color-mix(in srgb, var(--system-bg0) 70%, transparent)", zIndex: -1 }} />
        )}
        <div className="flex items-center justify-between">
        {/* Section navigation — left side */}
        <div className="flex items-center gap-2">
          {pinnedQuestions.length > 0 && (
            <button
              onClick={() => document.getElementById("section-pinned")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="text-sm px-3 py-1.5 rounded-full cursor-pointer transition-colors duration-150"
              style={{
                fontFamily: "var(--font-figtree)", fontWeight: 500,
                backdropFilter: (isAtTop || filtersOpen) ? "none" : "blur(12px)", WebkitBackdropFilter: (isAtTop || filtersOpen) ? "none" : "blur(12px)",
                backgroundColor: activeSection === "pinned" ? ((isAtTop || filtersOpen) ? "var(--system-bg0-contrast)" : "color-mix(in srgb, var(--system-bg0-contrast) 70%, transparent)") : ((isAtTop || filtersOpen) ? "var(--system-bg1)" : "color-mix(in srgb, var(--system-bg1) 70%, transparent)"),
                transition: "background-color 200ms ease, backdrop-filter 200ms ease",
                color: activeSection === "pinned" ? "var(--system-text0-contrast)" : "var(--system-text0)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--system-text2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = activeSection === "pinned" ? "var(--system-text0-contrast)" : "var(--system-text0)"; }}
            >
              Fokus
            </button>
          )}
          {answeredQuestions.length > 0 && (
            <button
              onClick={() => document.getElementById("section-answered")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="text-sm px-3 py-1.5 rounded-full cursor-pointer transition-colors duration-150"
              style={{
                fontFamily: "var(--font-figtree)", fontWeight: 500,
                backdropFilter: (isAtTop || filtersOpen) ? "none" : "blur(12px)", WebkitBackdropFilter: (isAtTop || filtersOpen) ? "none" : "blur(12px)",
                backgroundColor: activeSection === "answered" ? ((isAtTop || filtersOpen) ? "var(--system-bg0-contrast)" : "color-mix(in srgb, var(--system-bg0-contrast) 70%, transparent)") : ((isAtTop || filtersOpen) ? "var(--system-bg1)" : "color-mix(in srgb, var(--system-bg1) 70%, transparent)"),
                transition: "background-color 200ms ease, backdrop-filter 200ms ease",
                color: activeSection === "answered" ? "var(--system-text0-contrast)" : "var(--system-text0)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--system-text2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = activeSection === "answered" ? "var(--system-text0-contrast)" : "var(--system-text0)"; }}
            >
              Svar
            </button>
          )}
          {filteredQuestions.length > 0 && (
            <button
              onClick={() => document.getElementById("section-unanswered")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="text-sm px-3 py-1.5 rounded-full cursor-pointer transition-colors duration-150"
              style={{
                fontFamily: "var(--font-figtree)", fontWeight: 500,
                backdropFilter: (isAtTop || filtersOpen) ? "none" : "blur(12px)", WebkitBackdropFilter: (isAtTop || filtersOpen) ? "none" : "blur(12px)",
                backgroundColor: activeSection === "unanswered" ? ((isAtTop || filtersOpen) ? "var(--system-bg0-contrast)" : "color-mix(in srgb, var(--system-bg0-contrast) 70%, transparent)") : ((isAtTop || filtersOpen) ? "var(--system-bg1)" : "color-mix(in srgb, var(--system-bg1) 70%, transparent)"),
                transition: "background-color 200ms ease, backdrop-filter 200ms ease",
                color: activeSection === "unanswered" ? "var(--system-text0-contrast)" : "var(--system-text0)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--system-text2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = activeSection === "unanswered" ? "var(--system-text0-contrast)" : "var(--system-text0)"; }}
            >
              Upvote
            </button>
          )}
        </div>

        {/* Filter button — right side */}
        <div className="flex items-center gap-2">
          {filtersOpen && selectedTags.size > 0 && (
            <button
              onClick={reset}
              className="text-sm cursor-pointer"
              style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: colorError }}
            >
              Nulstil
            </button>
          )}
          {!filtersOpen ? (
            <button
              onClick={() => setFiltersOpen(true)}
              className="rounded-full flex items-center justify-center cursor-pointer transition-colors duration-150"
              style={{
                width: 34,
                height: 34,
                backdropFilter: (isAtTop || filtersOpen) ? "none" : "blur(12px)", WebkitBackdropFilter: (isAtTop || filtersOpen) ? "none" : "blur(12px)",
                backgroundColor: isFiltered ? ((isAtTop || filtersOpen) ? "var(--system-bg0-contrast)" : "color-mix(in srgb, var(--system-bg0-contrast) 70%, transparent)") : ((isAtTop || filtersOpen) ? "var(--system-bg1)" : "color-mix(in srgb, var(--system-bg1) 70%, transparent)"),
                transition: "background-color 200ms ease, backdrop-filter 200ms ease",
              }}
              aria-label="Filtre"
              onMouseEnter={(e) => { const svg = e.currentTarget.querySelector("svg"); if (svg) svg.style.color = "var(--system-error)"; }}
              onMouseLeave={(e) => { const svg = e.currentTarget.querySelector("svg"); if (svg) svg.style.color = "var(--system-pending)"; }}
            >
              <FontAwesomeIcon icon={faFire} swapOpacity style={{ color: "var(--system-pending)", transition: "color 150ms", fontSize: 15 }} />
            </button>
          ) : (
            <button
              onClick={() => setFiltersOpen(false)}
              className="rounded-full flex items-center justify-center cursor-pointer transition-colors duration-150"
              style={{
                width: 34,
                height: 34,
                backdropFilter: (isAtTop || filtersOpen) ? "none" : "blur(12px)", WebkitBackdropFilter: (isAtTop || filtersOpen) ? "none" : "blur(12px)",
                backgroundColor: isAtTop ? "var(--system-bg1)" : "color-mix(in srgb, var(--system-bg1) 70%, transparent)",
                transition: "background-color 200ms ease, backdrop-filter 200ms ease",
                color: "var(--system-icon1)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--system-icon0)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--system-icon1)"; }}
              aria-label="Luk filtre"
            >
              <FontAwesomeIcon icon={faXmark} style={{ fontSize: 14 }} />
            </button>
          )}
        </div>
        </div>

        {/* Expanded tag filter — same sticky container */}
        {filtersOpen && allTags.length > 0 && (
          <div style={{ paddingTop: 10 }}>
            <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className="text-sm px-3 py-1.5 rounded-full border border-transparent cursor-pointer transition-all duration-150"
                style={{
                  fontFamily: "var(--font-figtree)", fontWeight: 500,
                  backdropFilter: (isAtTop || filtersOpen) ? "none" : "blur(12px)", WebkitBackdropFilter: (isAtTop || filtersOpen) ? "none" : "blur(12px)",
                  backgroundColor: selectedTags.has(tag) ? ((isAtTop || filtersOpen) ? "var(--system-bg0-contrast)" : "color-mix(in srgb, var(--system-bg0-contrast) 70%, transparent)") : ((isAtTop || filtersOpen) ? "var(--system-bg1)" : "color-mix(in srgb, var(--system-bg1) 70%, transparent)"),
                  transition: "background-color 200ms ease, backdrop-filter 200ms ease",
                  color: selectedTags.has(tag) ? "var(--system-text0-contrast)" : "var(--system-text0)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--system-text2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = selectedTags.has(tag) ? "var(--system-text0-contrast)" : "var(--system-text0)"; }}
              >
                {tag}
              </button>
            ))}
            </div>
            <hr className="border-0 mt-4" style={{ borderTop: "1px solid var(--system-bg2)", opacity: isAtTop ? 1 : 0, transition: "opacity 300ms ease", position: "relative", zIndex: 1 }} />
          </div>
        )}
      </div>

      {questions.length === 0 && (
        <p className="max-w-2xl mx-auto text-gray-500 text-center py-8">
          Der er endnu ingen spørgsmål fra denne politiker.
        </p>
      )}

      {/* Pinned questions — full width, negative margin on mobile to match carousel */}
      {pinnedQuestions.length > 0 && (
        <div id="section-pinned" className="space-y-6" style={{ scrollMarginTop: 120 }}>
          {pinnedQuestions.map((question) => (
            <PinnedQuestionCard
              key={question.id}
              question={question}
              basePath={basePath}
              appUrl={appUrl}
              partyColor={partyColor}
              partyColorDark={partyColorDark}
              partyColorLight={partyColorLight}
              playingId={playingId}
              setPlayingId={setPlayingId}
            />
          ))}
        </div>
      )}

      {/* Separator between pinned and answered */}
      {pinnedQuestions.length > 0 && answeredQuestions.length > 0 && (
        <div
          className="my-6"
          style={{ height: 1, backgroundColor: "var(--system-bg2)" }}
        />
      )}

      {/* Answered questions grid */}
      {answeredQuestions.length > 0 && (
        <div id="section-answered" style={{ scrollMarginTop: 120 }} />
      )}
      {answeredQuestions.length > 0 && (
        <AnsweredQuestionsGrid
          questions={answeredQuestions}
          basePath={basePath}
          appUrl={appUrl}
          partyColor={partyColor}
          partyColorDark={partyColorDark}
          partyColorLight={partyColorLight}
          playingId={playingId}
          setPlayingId={setPlayingId}
        />
      )}

      {/* Separator between answered and regular questions */}
      {answeredQuestions.length > 0 && (
        <div
          className="my-6"
          style={{ height: 1, backgroundColor: "var(--system-bg2)" }}
        />
      )}

      {/* Unanswered questions */}
      {filteredQuestions.length > 0 && (
        <div id="section-unanswered" style={{ scrollMarginTop: 120 }} />
      )}
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
      ) : isFiltered && questions.length > 0 ? (
        <p className="max-w-2xl mx-auto text-gray-500 text-center py-8">
          Ingen spørgsmål matcher dine filtre.
        </p>
      ) : null}

      {/* Ellipsis menu — below question list, centered */}
      <QuestionDetailEllipsis
        hasSession={hasSession}
        citizenEmail={citizenEmail ?? null}
        partySlug={partySlug}
        politicianSlug={politicianSlug}
        partyColor={partyColor}
        partyColorDark={partyColorDark}
      />

      {/* Upvote login modal */}
      {upvoteModalQuestionId && (
        <UpvoteModal
          questionId={upvoteModalQuestionId}
          questionText={questions.find(q => q.id === upvoteModalQuestionId)?.text || ""}
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

function PinnedQuestionCard({
  question,
  basePath,
  appUrl,
  partyColor,
  partyColorDark,
  partyColorLight,
  playingId,
  setPlayingId,
}: {
  question: FeedQuestion;
  basePath: string;
  appUrl: string;
  partyColor?: string | null;
  partyColorDark?: string | null;
  partyColorLight?: string | null;
  playingId: string | null;
  setPlayingId: (id: string | null) => void;
}) {
  const thumbnailPhotoUrl = question.answerPhotoUrl;
  const hasMuxMedia = !!question.muxPlaybackId || !!question.muxAssetStatus;

  // Share/copy state — blink copy icon then return to share
  const [copied, setCopied] = useState(false);
  const copyAnimRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const handleShare = useCallback(() => {
    const url = `${appUrl}${basePath}/q/${question.id}`;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;

    if (isTouch && navigator.share) {
      navigator.share({ url, title: question.text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
      copyAnimRef.current.forEach(t => clearTimeout(t));
      copyAnimRef.current = [];
      setCopied(true);
      copyAnimRef.current.push(setTimeout(() => setCopied(false), 600));
    }
  }, [appUrl, basePath, question.id, question.text]);

  return (
    <div className="flex flex-col lg:flex-row lg:items-start">
      {/* Left: question text + meta */}
      <div className="flex-1 min-w-0 flex flex-col pt-[20px] lg:pt-[50px] pl-[15px] pr-[25px] lg:pr-[50px]">
        <a
          href={`${basePath}/q/${question.id}`}
          className="hover:opacity-80 transition-opacity"
        >
          <span
            style={{
              fontSize: "clamp(28px, 8vw, 40px)",
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

        {question.suggestedBy && (
          <div style={{ marginTop: 4 }}>
            <span
              style={{
                fontSize: 12,
                lineHeight: 1.3,
                color: "var(--system-text0)",
                backgroundColor: "var(--system-bg1)",
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

        {/* Bottom row: share + tags */}
        <div className="flex items-center gap-2 py-[20px]">
          <button
            onClick={handleShare}
            className="hover:opacity-70 cursor-pointer rounded-full flex items-center justify-center flex-shrink-0 relative"
            style={{
              height: 24,
              width: 24,
              backgroundColor: partyColor || "#3B82F6",
            }}
            aria-label="Del"
          >
            <span className="absolute inset-0 flex items-center justify-center" style={{ opacity: copied ? 0 : 1, transition: "opacity 300ms ease" }}>
              <FontAwesomeIcon icon={faShare} style={{ color: partyColorDark || "#1E3A5F", fontSize: "13.5px" }} />
            </span>
            <span className="absolute inset-0 flex items-center justify-center" style={{ opacity: copied ? 1 : 0, transition: "opacity 300ms ease" }}>
              <FontAwesomeIcon icon={faCopy} style={{ color: partyColorDark || "#1E3A5F", fontSize: "13.5px" }} />
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
      {(hasMuxMedia || thumbnailPhotoUrl) && (
        <PlayableMediaCard
          question={question}
          partyColor={partyColor}
          partyColorDark={partyColorDark}
          bufferingColor={partyColorLight}
          playingId={playingId}
          setPlayingId={setPlayingId}
          className="w-full lg:w-[337px] lg:mr-[9px]"
        />
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
  partyColorLight,
  playingId,
  setPlayingId,
}: {
  question: FeedQuestion;
  basePath: string;
  appUrl: string;
  partyColor?: string | null;
  partyColorDark?: string | null;
  partyColorLight?: string | null;
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
  // Only show clip when there's no custom poster
  const muxClipUrl = muxPlaybackId && isReady && hasVideoAnswer && !hasCustomPoster ? getMuxMp4Url(muxPlaybackId) : null;
  // Mux thumbnail as fallback behind clip (visible while clip loads)
  const muxThumbnailUrl = muxPlaybackId && isReady ? getMuxThumbnailUrl(muxPlaybackId) : null;
  const photoUrl = question.answerPhotoUrl || muxThumbnailUrl;
  const cardRef = useRef<HTMLDivElement>(null);
  const fullVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const clipRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [isHovering, setIsHovering] = useState(false);
  const [isWatching, setIsWatching] = useState(false);

  // HLS player for Mux video
  // Track whether HLS has been initialized (stays true after first play for resume)
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

  // Share/copy state — blink copy icon twice then return to share
  const [copied, setCopied] = useState(false);
  const copyAnimRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const handleShare = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${appUrl}${basePath}/q/${question.id}`;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (isTouch && navigator.share) {
      navigator.share({ url, title: question.text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
      copyAnimRef.current.forEach(t => clearTimeout(t));
      copyAnimRef.current = [];
      setCopied(true);
      copyAnimRef.current.push(setTimeout(() => setCopied(false), 600));
    }
  }, [appUrl, basePath, question.id, question.text]);

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

  // Click to play/pause full video
  const handleClick = useCallback(() => {
    if (!hasPlayableMedia) return;
    if (isWatching) {
      // Check if video/audio was paused (e.g. by scroll-away) → resume
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
      setPlayingId(null);
    } else if (hasVideoAnswer) {
      setIsWatching(true);
      if (fullVideoRef.current && savedTimeRef.current > 0) {
        fullVideoRef.current.currentTime = savedTimeRef.current;
      }
      hlsPlay();
      setPlayingId(question.id);
      // Scroll card into view accounting for sticky header + carousel arrows below
      requestAnimationFrame(() => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const headerH = 170;
        const arrowsH = 0;
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
      if (audioRef.current) {
        if (savedTimeRef.current > 0) {
          audioRef.current.currentTime = savedTimeRef.current;
        }
        audioRef.current.play().catch(() => {});
      }
      setIsWatching(true);
      setPlayingId(question.id);
      requestAnimationFrame(() => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const headerH = 170;
        const arrowsH = 0;
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
    savedTimeRef.current = 0;
    setIsWatching(false);
    setPlayingId(null);
  }, [setPlayingId]);

  // Progress bar — timeupdate (~4/sec) + CSS transition for smooth visual
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
      onMouseEnter={() => { if (hasPlayableMedia && !window.matchMedia("(pointer: coarse)").matches) setIsHovering(true); }}
      onMouseLeave={() => { if (!window.matchMedia("(pointer: coarse)").matches) setIsHovering(false); }}
    >
      {/* Static poster image — always visible behind the clip video so
          there's no white flash while the video loads on first visit */}
      {photoUrl ? (
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
      {/* Mux MP4 clip for hover preview — hidden by default, shown only during hover/autoplay */}
      {muxClipUrl && (
        <video
          ref={clipRef}
          src={muxClipUrl}
          muted
          loop
          playsInline
          preload="none"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0 }}
        />
      )}

      {/* Dark hover overlay */}
      {hasPlayableMedia && !isWatching && (
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
      )}

      {/* Progress bar — delayed fade-in to wait for bottom overlay to fade out */}
      {isWatching && (
        <div
          ref={(el) => { if (el) setTimeout(() => { el.style.opacity = "1"; }, 300); }}
          className="absolute"
          style={{ zIndex: 5, bottom: 25, left: 20, right: 20, opacity: 0, transition: "opacity 150ms ease" }}
        >
          {/* Track */}
          <div style={{ position: "relative", height: 4, borderRadius: 9999, overflow: "hidden" }}>
            {/* Static background */}
            <div style={{ position: "absolute", inset: 0, backgroundColor: "var(--system-bg0-contrast)", opacity: 0.5 }} />
            {/* Progress fill */}
            <div
              ref={progressBarRef}
              style={{ position: "relative", height: "100%", width: "100%", backgroundColor: "var(--system-bg0)", transformOrigin: "left", transform: "scaleX(0)", willChange: "transform" }}
            />
          </div>
        </div>
      )}

      {/* Full video for on-card playback */}
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

      {/* Buffering spinner — ref-controlled to avoid re-renders during playback */}
      {isWatching && (
        <div ref={bufferingRef} className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 4, opacity: 0, pointerEvents: "none", transition: "opacity 150ms" }}>
          <div style={{ position: "relative", width: 40, height: 40 }}>
            {/* Static ring (bg0-contrast at 50%) */}
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "4px solid var(--system-bg0-contrast)", opacity: 0.5 }} />
            {/* Spinning indicator (bg0) */}
            <div
              className="animate-spin"
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "4px solid transparent",
                borderTopColor: "var(--system-bg0)",
              }}
            />
          </div>
        </div>
      )}

      {/* Audio element */}
      {hasAudioAnswer && muxPlaybackId && (
        <audio ref={audioRef} src={`https://stream.mux.com/${muxPlaybackId}.m3u8`} preload="none" onEnded={handleEnded} />
      )}

      {/* Bottom: highlighted text + share + tags */}
      <div
        className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-20"
        style={{ zIndex: 3, pointerEvents: "none", opacity: isWatching ? 0 : 1, transform: isWatching ? "translateY(-20px)" : "translateZ(0)", transition: "opacity 300ms ease, transform 300ms ease", backfaceVisibility: "hidden", willChange: "opacity, transform" }}
      >
        <span
          style={{
            fontSize: "22px",
            lineHeight: 1.3,
            color: partyColorDark || "#0E412E",
            fontFamily: "var(--font-figtree)",
            fontWeight: 400,
            backgroundColor: partyColorLight || "#DBEAFE",
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
                color: "var(--system-text0)",
                backgroundColor: "var(--system-bg1)",
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

        {/* Play + tags + share + detail link row */}
        <div className="flex items-center gap-2 mt-3" style={{ pointerEvents: "auto" }}>
          {hasPlayableMedia && (
            <div
              className="flex items-center justify-center rounded-full flex-shrink-0 relative transition-opacity duration-300"
              style={{
                width: 48,
                height: 48,
                opacity: isWatching ? 0 : 1,
                backfaceVisibility: "hidden",
                transform: "translateZ(0)",
              }}
            >
              <div className="absolute inset-0 rounded-full transition-opacity duration-200" style={{ backgroundColor: partyColor || "#00D564", opacity: isHovering ? 1 : 0.75 }} />
              <FontAwesomeIcon
                icon={faPlay}
                className="relative"
                style={{ color: partyColorDark || "#0E412E", fontSize: 20, marginLeft: 2 }}
              />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
          {question.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1"
              style={{ backgroundColor: "#ECF5DC", color: "#0E412E", fontFamily: "var(--font-figtree)", fontWeight: 500 }}
            >
              {tag}
            </span>
          ))}
          <button
            onClick={handleShare}
            className="hover:opacity-70 cursor-pointer rounded-full flex items-center justify-center flex-shrink-0 relative"
            style={{
              height: 24,
              width: 24,
              backgroundColor: partyColor || "#3B82F6",
            }}
            aria-label="Del"
          >
            <span className="absolute inset-0 flex items-center justify-center" style={{ opacity: copied ? 0 : 1, transition: "opacity 300ms ease" }}>
              <FontAwesomeIcon icon={faShare} style={{ color: partyColorDark || "#1E3A5F", fontSize: "13.5px" }} />
            </span>
            <span className="absolute inset-0 flex items-center justify-center" style={{ opacity: copied ? 1 : 0, transition: "opacity 300ms ease" }}>
              <FontAwesomeIcon icon={faCopy} style={{ color: partyColorDark || "#1E3A5F", fontSize: "13.5px" }} />
            </span>
          </button>
          <a
            href={`${basePath}/q/${question.id}`}
            onClick={(e) => e.stopPropagation()}
            className="hover:opacity-70 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              width: 24,
              height: 24,
              backgroundColor: partyColor || "#3B82F6",
            }}
            aria-label="Se detaljer"
          >
            <FontAwesomeIcon
              icon={faUpRightAndDownLeftFromCenter}
              style={{ color: partyColorDark || "#1E3A5F", fontSize: "11px" }}
            />
          </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Responsive grid for answered questions with progressive loading */
function AnsweredQuestionsGrid({
  questions,
  basePath,
  appUrl,
  partyColor,
  partyColorDark,
  partyColorLight,
  playingId,
  setPlayingId,
}: {
  questions: FeedQuestion[];
  basePath: string;
  appUrl: string;
  partyColor?: string | null;
  partyColorDark?: string | null;
  partyColorLight?: string | null;
  playingId: string | null;
  setPlayingId: (id: string | null) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(4);
  const visibleQuestions = questions.slice(0, visibleCount);
  const remaining = questions.length - visibleCount;
  const showLoadMore = remaining > 0;

  // Reset progressive loading when questions change (e.g. tag filter)
  useEffect(() => { setVisibleCount(4); }, [questions]);

  // Responsive grid — same pattern as UnansweredQuestionsGrid
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
  const maxCols = availableWidth > 0 ? Math.min(4, Math.max(1, rawCols)) : 3;
  const cols = Math.min(maxCols, visibleQuestions.length || 1);
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
            gap: gapW,
          }}
        >
          {visibleQuestions.map((q) => (
            <AnsweredQuestionCard
              key={q.id}
              question={q}
              basePath={basePath}
              appUrl={appUrl}
              partyColor={partyColor}
              partyColorDark={partyColorDark}
              partyColorLight={partyColorLight}
              playingId={playingId}
              setPlayingId={setPlayingId}
            />
          ))}
        </div>
        {showLoadMore && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => setVisibleCount((c) => remaining <= 4 ? questions.length : c + 4)}
              className="text-sm px-3 py-1.5 rounded-full cursor-pointer transition-colors duration-150"
              style={{
                fontFamily: "var(--font-figtree)", fontWeight: 500,
                backgroundColor: "var(--system-bg0-contrast)",
                color: "var(--system-text0-contrast)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--system-text2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--system-text0-contrast)"; }}
            >
              Vis flere
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
  const systemColors = useSystemColors();
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
                      backgroundColor: "var(--system-bg2)",
                    }}
                  />
                )}
                <div className="relative h-full">
                  {/* Vertical separator line centered in the gap */}
                  {colIndex > 0 && (
                    <div
                      className="absolute top-0 bottom-0"
                      style={{
                        left: -(gapW / 2) - 0.5,
                        width: 1,
                        backgroundColor: "var(--system-bg2)",
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
  // Share/copy state — blink copy icon then return to share
  const [copied, setCopied] = useState(false);
  const copyAnimRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const handleShare = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${appUrl}${basePath}/q/${question.id}`;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (isTouch && navigator.share) {
      navigator.share({ url, title: question.text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
      copyAnimRef.current.forEach(t => clearTimeout(t));
      copyAnimRef.current = [];
      setCopied(true);
      copyAnimRef.current.push(setTimeout(() => setCopied(false), 600));
    }
  }, [appUrl, basePath, question.id, question.text]);

  return (
    <div
      className="flex items-stretch h-full"
      style={{ padding: "16px 20px", gap: 20 }}
    >
      {/* Text + suggestedBy + share + tags */}
      <div className="flex-1 min-w-0 flex flex-col">
        <a
          href={`${basePath}/q/${question.id}`}
          style={{
            fontSize: 22,
            lineHeight: 1.3,
            color: "var(--system-text0, #000000)",
            fontFamily: "var(--font-figtree)",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          {question.text}
        </a>

        {question.suggestedBy && (
          <div style={{ marginTop: 4 }}>
            <span
              style={{
                display: "inline-block",
                fontSize: 12,
                lineHeight: 1.3,
                color: "var(--system-text0)",
                backgroundColor: "var(--system-bg1)",
                padding: "2px 4px",
                borderRadius: 3,
                fontFamily: "var(--font-figtree)",
                fontWeight: 400,
              }}
            >
              {question.suggestedBy}
            </span>
          </div>
        )}
        {/* Share + tags row — pushed to bottom */}
        <div className="flex items-center gap-2 mt-auto" style={{ paddingTop: 20 }}>
          <button
            onClick={handleShare}
            className="hover:opacity-70 cursor-pointer rounded-full flex items-center justify-center flex-shrink-0 relative"
            style={{
              height: 24,
              width: 24,
              backgroundColor: partyColor || "#3B82F6",
            }}
            aria-label="Del"
          >
            <span className="absolute inset-0 flex items-center justify-center" style={{ opacity: copied ? 0 : 1, transition: "opacity 300ms ease" }}>
              <FontAwesomeIcon icon={faShare} style={{ color: partyColorDark || "#1E3A5F", fontSize: "13.5px" }} />
            </span>
            <span className="absolute inset-0 flex items-center justify-center" style={{ opacity: copied ? 1 : 0, transition: "opacity 300ms ease" }}>
              <FontAwesomeIcon icon={faCopy} style={{ color: partyColorDark || "#1E3A5F", fontSize: "13.5px" }} />
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
      <div className="flex-shrink-0 pt-1">
        <CircularUpvoteButton
          questionId={question.id}
          isUpvoted={question.isUpvoted}
          goalReached={question.goalReachedEmailSent}
          goalReachedAt={question.goalReachedAt}
          hasSession={hasSession}
          partySlug={partySlug}
          politicianSlug={politicianSlug}
          partyColor={partyColor}
          partyColorDark={partyColorDark}
          size={40}
          tooltipPosition="top"
          onLoginUpvote={() => onLoginUpvote?.(question.id)}
          politicianFirstName={politicianFirstName}
          upvoteCount={question.upvoteCount}
          upvoteGoal={question.upvoteGoal}
        />
      </div>
    </div>
  );
}
