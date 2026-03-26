"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVideo, faMicrophone, faXmark, faChevronLeft, faChevronRight, faChevronDown, faPlay, faCopy } from "@fortawesome/free-solid-svg-icons";
import { faShare, faFilter, faUpRightAndDownLeftFromCenter } from "@fortawesome/pro-duotone-svg-icons";
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
  const systemColors = useSystemColors();
  const { pending: colorPending, error: colorError } = systemColors;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
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

    // Split pinned from regular — only show pinned if answer is ready
    const pinned = group === "all" ? result.filter((q) => q.pinned && q.muxAssetStatus === "ready") : [];
    const nonPinned = group === "all" ? result.filter((q) => !q.pinned) : result;

    // Split answered from unanswered — only show answers that are ready (Mux transcoding complete)
    const isAnswered = (q: FeedQuestion) => q.muxAssetStatus === "ready";
    const answered = nonPinned.filter(isAnswered);
    const unanswered = nonPinned.filter((q) => !isAnswered(q));

    return { pinnedQuestions: pinned, answeredQuestions: answered, filteredQuestions: unanswered };
  }, [questions, group, selectedTags, sort]);

  return (
    <div className="flex flex-col flex-1">
      {/* Filtre — toggle button or expanded filters */}
      {!filtersOpen ? (
        <div className="mb-[25px]">
          <button
            onClick={() => setFiltersOpen(true)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-transparent cursor-pointer transition-colors duration-150"
            style={{
              fontFamily: "var(--font-figtree)", fontWeight: 500,
              backgroundColor: "var(--system-bg1)",
              color: "var(--system-icon1)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--system-icon0)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--system-icon1)"; }}
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
              <button
                onClick={() => setFiltersOpen(false)}
                className="rounded-full flex items-center justify-center cursor-pointer transition-colors duration-150"
                style={{
                  width: 34,
                  height: 34,
                  backgroundColor: "var(--system-bg1)",
                  color: "var(--system-icon1)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--system-icon0)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--system-icon1)"; }}
                aria-label="Luk filtre"
              >
                <FontAwesomeIcon icon={faXmark} style={{ fontSize: 14 }} />
              </button>
              {([
                ["all", "Alle"],
                ["own", "Politiker"],
                ["citizen", "Borgere"],
                ...(hasSession && questions.some((q) => q.isUpvoted) ? [["upvoted", "Upvotede"] as [GroupOption, string]] : []),
              ] as [GroupOption, string][]).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setGroup(value)}
                  className="text-sm px-3 py-1.5 rounded-full border border-transparent cursor-pointer transition-all duration-150"
                  style={{
                    fontFamily: "var(--font-figtree)", fontWeight: 500,
                    backgroundColor: group === value ? "var(--system-bg0-contrast)" : "var(--system-bg1)",
                    color: group === value ? "var(--system-text0-contrast)" : "var(--system-text0)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--system-text2)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = group === value ? "var(--system-text0-contrast)" : "var(--system-text0)"; }}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-sm cursor-pointer"
                style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-text1)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--system-text0)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--system-text1)"; }}
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
                  style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: colorError }}
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
                <p className="text-sm mb-2" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-text1)" }}>Sortering</p>
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
                        backgroundColor: sort === value ? "var(--system-bg0-contrast)" : "var(--system-bg1)",
                        color: sort === value ? "var(--system-text0-contrast)" : "var(--system-text0)",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--system-text2)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = sort === value ? "var(--system-text0-contrast)" : "var(--system-text0)"; }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mærkesager */}
              {allTags.length > 0 && (
                <div>
                  <p className="text-sm mb-2" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-text1)" }}>Mærkesager</p>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className="text-sm px-3 py-1.5 rounded-full border border-transparent cursor-pointer transition-all duration-150"
                        style={{
                          fontFamily: "var(--font-figtree)", fontWeight: 500,
                          backgroundColor: selectedTags.has(tag) ? "var(--system-bg0-contrast)" : "var(--system-bg1)",
                          color: selectedTags.has(tag) ? "var(--system-text0-contrast)" : "var(--system-text0)",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--system-text2)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = selectedTags.has(tag) ? "var(--system-text0-contrast)" : "var(--system-text0)"; }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {moreOpen && <hr className="border-0 mt-2" style={{ borderTop: "1px solid var(--system-bg2)" }} />}
        </div>
      )}

      {questions.length === 0 && (
        <p className="max-w-2xl mx-auto text-gray-500 text-center py-8">
          Der er endnu ingen spørgsmål fra denne politiker.
        </p>
      )}

      {/* Pinned questions — full width */}
      {pinnedQuestions.length > 0 && (
        <div className="space-y-6">
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

      {/* Answered questions carousel */}
      {answeredQuestions.length > 0 && (
        <AnsweredQuestionsCarousel
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
          className="w-[90vw] self-center lg:self-auto lg:w-[337px] lg:mr-[9px]"
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
  isVisible = true,
}: {
  question: FeedQuestion;
  basePath: string;
  appUrl: string;
  partyColor?: string | null;
  partyColorDark?: string | null;
  partyColorLight?: string | null;
  playingId: string | null;
  setPlayingId: (id: string | null) => void;
  isVisible?: boolean;
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

  // Hover clip: play on hover, reset on leave (desktop only)
  useEffect(() => {
    const clip = clipRef.current;
    if (!clip || !muxClipUrl) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (isHovering && !isWatching) {
      clip.currentTime = 0;
      clip.style.opacity = "1";
      clip.play().catch(() => {});
    } else {
      clip.pause();
      clip.currentTime = 0;
      clip.style.opacity = "0";
    }
  }, [isHovering, isWatching, muxClipUrl]);

  // Mobile: autoplay clip when visible
  useEffect(() => {
    const card = cardRef.current;
    if (!card || !muxClipUrl) return;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const clip = clipRef.current;
        if (!clip) return;
        if (entry.isIntersecting && !isWatchingRef.current) {
          clip.currentTime = 0;
          clip.style.opacity = "1";
          clip.play().catch(() => {});
        } else if (!entry.isIntersecting && !isWatchingRef.current) {
          clip.pause();
          clip.style.opacity = "0";
        }
      },
      { threshold: 0.3 }
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
          style={{ zIndex: 5, bottom: 25, left: 20, right: 20, height: 4, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 9999, mixBlendMode: "difference", overflow: "hidden", opacity: 0, transition: "opacity 150ms ease" }}
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
        <div ref={bufferingRef} className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 4, opacity: 0, pointerEvents: "none", transition: "opacity 150ms", mixBlendMode: "difference" }}>
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

      {/* Audio element */}
      {hasAudioAnswer && muxPlaybackId && (
        <audio ref={audioRef} src={`https://stream.mux.com/${muxPlaybackId}.m3u8`} preload="none" onEnded={handleEnded} />
      )}

      {/* Bottom: highlighted text + share + tags */}
      <div
        className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-20"
        style={{ zIndex: 3, pointerEvents: "none", opacity: isWatching ? 0 : 1, transform: isWatching ? "translateY(-20px)" : "translateY(0)", transition: "opacity 300ms ease, transform 300ms ease" }}
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

/** Mobile carousel with touch swipe support and no hover states */
function MobileCarousel({
  questions,
  basePath,
  appUrl,
  partyColor,
  partyColorDark,
  partyColorLight,
  playingId,
  setPlayingId,
  currentIndex,
  setCurrentIndex,
}: {
  questions: FeedQuestion[];
  basePath: string;
  appUrl: string;
  partyColor?: string | null;
  partyColorDark?: string | null;
  partyColorLight?: string | null;
  playingId: string | null;
  setPlayingId: (id: string | null) => void;
  currentIndex: number;
  setCurrentIndex: (fn: (i: number) => number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const isSwiping = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    isSwiping.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping.current) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping.current) return;
    isSwiping.current = false;
    const threshold = 50;
    if (touchDeltaX.current < -threshold) {
      // Swiped left → next
      setCurrentIndex((i) => Math.min(questions.length - 1, i + 1));
    } else if (touchDeltaX.current > threshold) {
      // Swiped right → previous
      setCurrentIndex((i) => Math.max(0, i - 1));
    }
    touchDeltaX.current = 0;
  }, [questions.length, setCurrentIndex]);

  return (
    <div className="lg:hidden">
      <div
        className="overflow-hidden"
        style={{ borderRadius: 20 }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          ref={trackRef}
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
                partyColorLight={partyColorLight}
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
              backgroundColor: partyColor || "#00D564",
            }}
            aria-label="Forrige"
          >
            <FontAwesomeIcon
              icon={faChevronLeft}
              style={{ color: partyColorDark || "#0E412E", fontSize: 18 }}
            />
          </button>
          <button
            onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
            disabled={currentIndex === questions.length - 1}
            className="rounded-full flex items-center justify-center cursor-pointer disabled:opacity-30"
            style={{
              width: 40,
              height: 40,
              backgroundColor: partyColor || "#00D564",
            }}
            aria-label="Næste"
          >
            <FontAwesomeIcon
              icon={faChevronRight}
              style={{ color: partyColorDark || "#0E412E", fontSize: 18 }}
            />
          </button>
        </div>
      )}
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
                  partyColorLight={partyColorLight}
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

      {/* Mobile: single card carousel with swipe support */}
      <MobileCarousel
        questions={questions}
        basePath={basePath}
        appUrl={appUrl}
        partyColor={partyColor}
        partyColorDark={partyColorDark}
        partyColorLight={partyColorLight}
        playingId={playingId}
        setPlayingId={setPlayingId}
        currentIndex={currentIndex}
        setCurrentIndex={setCurrentIndex}
      />
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
