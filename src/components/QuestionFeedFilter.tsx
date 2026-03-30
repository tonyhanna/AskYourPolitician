"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faCopy } from "@fortawesome/free-solid-svg-icons";
import { faShare, faFire } from "@fortawesome/pro-duotone-svg-icons";
import { PlayableMediaCard } from "./PlayableMediaCard";
import { AnsweredQuestionCard } from "./AnsweredQuestionCard";
import { useShareCopy } from "@/hooks/useShareCopy";
import { useResponsiveGrid } from "@/hooks/useResponsiveGrid";
import { UpvoteModal } from "./UpvoteModal";
import { CircularUpvoteButton } from "./CircularUpvoteButton";
import { QuestionDetailEllipsis } from "./QuestionDetailEllipsis";
import { useSystemColors } from "./SystemColorProvider";

export type FeedQuestion = {
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
  const canHover = useRef(false);
  useEffect(() => { canHover.current = window.matchMedia("(hover: hover)").matches; }, []);
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

  // Only show section nav when there are 2+ sections with content
  const visibleSectionCount = (pinnedQuestions.length > 0 ? 1 : 0) + (answeredQuestions.length > 0 ? 1 : 0) + (filteredQuestions.length > 0 ? 1 : 0);
  const showSectionNav = visibleSectionCount >= 2;

  return (
    <div className="flex flex-col flex-1">
      {/* Sticky section nav + filter + tags */}
      <div className="sticky top-[94px] z-40 mb-[25px]" style={{ position: "sticky" }}>
        {/* Blur background — only when filters are open, extends to topbar edge */}
        {filtersOpen && (
          <div style={{ position: "absolute", top: -24, left: -15, right: -15, bottom: 0, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", backgroundColor: "color-mix(in srgb, var(--system-bg0) 70%, transparent)", zIndex: -1 }} />
        )}
        <div className="flex items-start justify-between">
        {/* Section navigation — left side (hidden when only 1 section exists) */}
        {/* When no section nav and filters open, tags go inline on the left */}
        {!showSectionNav && filtersOpen && allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
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
                onPointerEnter={(e) => { if (!canHover.current) return; e.currentTarget.style.color = "var(--system-text2)"; }}
                onPointerLeave={(e) => { if (!canHover.current) return; e.currentTarget.style.color = selectedTags.has(tag) ? "var(--system-text0-contrast)" : "var(--system-text0)"; }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
        {showSectionNav && <div className="flex items-center gap-2">
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
              onPointerEnter={(e) => { if (!canHover.current) return; e.currentTarget.style.color = "var(--system-text2)"; }}
              onPointerLeave={(e) => { if (!canHover.current) return; e.currentTarget.style.color = activeSection === "pinned" ? "var(--system-text0-contrast)" : "var(--system-text0)"; }}
            >
              Udvalgt
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
              onPointerEnter={(e) => { if (!canHover.current) return; e.currentTarget.style.color = "var(--system-text2)"; }}
              onPointerLeave={(e) => { if (!canHover.current) return; e.currentTarget.style.color = activeSection === "answered" ? "var(--system-text0-contrast)" : "var(--system-text0)"; }}
            >
              Besvaret
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
              onPointerEnter={(e) => { if (!canHover.current) return; e.currentTarget.style.color = "var(--system-text2)"; }}
              onPointerLeave={(e) => { if (!canHover.current) return; e.currentTarget.style.color = activeSection === "unanswered" ? "var(--system-text0-contrast)" : "var(--system-text0)"; }}
            >
              Ubesvaret
            </button>
          )}
        </div>}

        {/* Filter button — right side */}
        <div className="flex items-center gap-2 ml-auto">
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
              onPointerEnter={(e) => { if (!canHover.current) return; const svg = e.currentTarget.querySelector("svg"); if (svg) svg.style.color = "var(--system-error)"; }}
              onPointerLeave={(e) => { if (!canHover.current) return; const svg = e.currentTarget.querySelector("svg"); if (svg) svg.style.color = "var(--system-pending)"; }}
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
              onPointerEnter={(e) => { if (!canHover.current) return; e.currentTarget.style.color = "var(--system-icon0)"; }}
              onPointerLeave={(e) => { if (!canHover.current) return; e.currentTarget.style.color = "var(--system-icon1)"; }}
              aria-label="Luk filtre"
            >
              <FontAwesomeIcon icon={faXmark} style={{ fontSize: 14 }} />
            </button>
          )}
        </div>
        </div>

        {/* Expanded tag filter — below nav (only when section nav is shown; otherwise tags are inline above) */}
        {filtersOpen && allTags.length > 0 && showSectionNav && (
          <div style={showSectionNav ? { paddingTop: 10 } : undefined}>
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
                onPointerEnter={(e) => { if (!canHover.current) return; e.currentTarget.style.color = "var(--system-text2)"; }}
                onPointerLeave={(e) => { if (!canHover.current) return; e.currentTarget.style.color = selectedTags.has(tag) ? "var(--system-text0-contrast)" : "var(--system-text0)"; }}
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
        <div id="section-answered" style={{ scrollMarginTop: 120 }}>
          <h1 style={{ fontSize: "clamp(33px, 5vw, 41px)", fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-text3)", marginBottom: 16 }}>Besvaret</h1>
        </div>
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
        <div id="section-unanswered" style={{ scrollMarginTop: 120 }}>
          <h1 style={{ fontSize: "clamp(33px, 5vw, 41px)", fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-text3)", marginBottom: 16 }}>Ubesvaret: Til upvote</h1>
        </div>
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

  const { copied, handleShare } = useShareCopy(
    `${appUrl}${basePath}/q/${question.id}`,
    question.text
  );

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

// AnsweredQuestionCard extracted to ./AnsweredQuestionCard.tsx
// CUTPOINT
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
  const canHover = useRef(false);
  useEffect(() => { canHover.current = window.matchMedia("(hover: hover)").matches; }, []);
  const visibleQuestions = questions.slice(0, visibleCount);
  const remaining = questions.length - visibleCount;
  const showLoadMore = remaining > 0;

  useEffect(() => { setVisibleCount(4); }, [questions]);

  const { gridRef, cols, isFullWidth, gridWidth, cardW, gapW } = useResponsiveGrid(visibleQuestions.length);

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
              onPointerEnter={(e) => { if (!canHover.current) return; e.currentTarget.style.color = "var(--system-text2)"; }}
              onPointerLeave={(e) => { if (!canHover.current) return; e.currentTarget.style.color = "var(--system-text0-contrast)"; }}
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
  const { gridRef, cols, isFullWidth, gridWidth, cardW, gapW } = useResponsiveGrid(questions.length);
  const canHover = useRef(false);
  useEffect(() => { canHover.current = window.matchMedia("(hover: hover)").matches; }, []);

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
  const { copied, handleShare } = useShareCopy(
    `${appUrl}${basePath}/q/${question.id}`,
    question.text
  );

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
