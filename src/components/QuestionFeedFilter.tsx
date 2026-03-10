"use client";

import { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo } from "@fortawesome/pro-duotone-svg-icons";
import { UpvoteButton } from "./UpvoteButton";
import { CancelUpvoteButton } from "./CancelUpvoteButton";
import { AwaitingAnswerButton } from "./AwaitingAnswerButton";
import { CopyLinkButton } from "./CopyLinkButton";
import { isBlobUrl, getBlobMediaType } from "@/lib/answer-utils";

type FeedQuestion = {
  id: string;
  text: string;
  upvoteCount: number;
  upvoteGoal: number;
  answerUrl: string | null;
  answerPhotoUrl: string | null;
  goalReachedEmailSent: boolean;
  suggestedBy: string | null;
  tags: string[];
  isUpvoted: boolean;
  createdAt: string;
  pinned: boolean;
};

type SortOption = "newest" | "oldest" | "most_upvoted" | "least_upvoted";
type GroupOption = "all" | "own" | "citizen" | "upvoted" | "answered";

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
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [sort, setSort] = useState<SortOption>("newest");
  const [group, setGroup] = useState<GroupOption>("all");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // Info button: shown when intro box is dismissed
  const [introDismissed, setIntroDismissed] = useState(false);
  useEffect(() => {
    setIntroDismissed(localStorage.getItem("intro-dismissed") === "1");
    const handler = () => setIntroDismissed(true);
    window.addEventListener("intro-dismissed", handler);
    return () => window.removeEventListener("intro-dismissed", handler);
  }, []);

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

  const { pinnedQuestions, regularQuestions } = useMemo(() => {
    let result = [...questions];

    // Group filter
    if (group === "own") {
      result = result.filter((q) => !q.suggestedBy);
    } else if (group === "citizen") {
      result = result.filter((q) => !!q.suggestedBy);
    } else if (group === "upvoted") {
      result = result.filter((q) => q.isUpvoted);
    } else if (group === "answered") {
      result = result.filter((q) => !!q.answerUrl);
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
    if (group === "all") {
      return {
        pinnedQuestions: result.filter((q) => q.pinned),
        regularQuestions: result.filter((q) => !q.pinned),
      };
    }

    return { pinnedQuestions: [], regularQuestions: result };
  }, [questions, group, selectedTags, sort]);

  return (
    <div>
      {/* Vis — always visible */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {([
          ["all", "Alle"],
          ["answered", "Besvarede"],
          ["own", "Mine"],
          ["citizen", "Jeres"],
          ...(hasSession ? [["upvoted", "Mine upvotede"] as [GroupOption, string]] : []),
        ] as [GroupOption, string][]).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setGroup(value)}
            className="text-sm px-3 py-1.5 rounded-full border border-transparent cursor-pointer transition-all duration-150"
            style={{
              fontFamily: "var(--font-dm-sans)", fontWeight: 500,
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
          style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500, color: partyColorDark || "#1E3A5F" }}
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
            style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500, color: "#FF4105" }}
          >
            Nulstil
          </button>
        )}
        {introDismissed && (
          <button
            onClick={() => {
              setIntroDismissed(false);
              window.dispatchEvent(new Event("show-intro"));
            }}
            className="ml-auto cursor-pointer hover:opacity-50 transition-opacity"
            aria-label="Vis information"
          >
            <FontAwesomeIcon
              icon={faCircleInfo}
              className="text-lg"
              style={{ color: partyColor || "#7E7D7A" }}
            />
          </button>
        )}
      </div>

      {/* Flere filtre — collapsible */}
      {moreOpen && (
        <div className="mb-4 space-y-4">
          {/* Sortering */}
          <div>
            <p className="text-sm mb-2" style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500, color: partyColorDark || "#1E3A5F" }}>Sortering</p>
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
                    fontFamily: "var(--font-dm-sans)", fontWeight: 500,
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
              <p className="text-sm mb-2" style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500, color: partyColorDark || "#1E3A5F" }}>Mærkesager</p>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className="text-sm px-3 py-1.5 rounded-full border border-transparent cursor-pointer transition-all duration-150"
                    style={{
                      fontFamily: "var(--font-dm-sans)", fontWeight: 500,
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

      {/* Pinned questions section */}
      {pinnedQuestions.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-500">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
            </svg>
            <span className="text-sm font-semibold text-amber-700">Pinned</span>
          </div>
          <div className="space-y-4">
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

      {/* Question list */}
      <div className="space-y-4">
        {regularQuestions.map((question) => (
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

      {pinnedQuestions.length === 0 && regularQuestions.length === 0 && questions.length > 0 && (
        <p className="text-gray-500 text-center py-8">
          Ingen spørgsmål matcher dine filtre.
        </p>
      )}
    </div>
  );
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
  return (
    <div
      className="p-4"
      style={{ backgroundColor: "#F6F6F5", fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}
    >
      {/* Question text + tag on same line */}
      <div className="mb-2">
        {question.tags.length > 0 && (
          <div className="float-right flex flex-wrap gap-1 pl-[10px] mt-[5px]">
            {question.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#E8E7E5", color: partyColorDark || "#1E3A5F" }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <a
          href={`${basePath}/q/${question.id}`}
          className="transition hover:opacity-70"
          style={{ fontSize: "20px", color: "#2E2E2E" }}
        >
          {question.text}
        </a>
      </div>
      <div className="flex items-center gap-2">
        <CopyLinkButton
          url={`${appUrl}${basePath}/q/${question.id}`}
          title={question.text}
          compact
          partyColor={partyColor}
        />
        <span className="text-xs" style={{ color: "#7E7D7A" }}>
          {question.suggestedBy ? question.suggestedBy : `${politicianName} — mig`}
        </span>
        {question.answerUrl ? (
          <>
            <span className="text-xs ml-auto" style={{ color: partyColor || "#3B82F6" }}>
              {question.upvoteCount} {question.upvoteCount === 1 ? "upvote" : "upvotes"}
            </span>
            <a
              href={`${basePath}/q/${question.id}`}
              className="text-xs px-3 py-1.5 rounded-full cursor-pointer"
              style={{ backgroundColor: "#E8E7E5", color: "#7E7D7A" }}
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
            <span className="text-xs ml-auto" style={{ color: partyColor || "#3B82F6" }}>
              {question.upvoteCount} {question.upvoteCount === 1 ? "upvote" : "upvotes"}
            </span>
            {question.goalReachedEmailSent && question.isUpvoted ? (
              <AwaitingAnswerButton
                questionId={question.id}
                partySlug={partySlug}
                politicianSlug={politicianSlug}
              />
            ) : question.goalReachedEmailSent ? (
              <span className="text-xs px-3 py-1.5 rounded-full" style={{ backgroundColor: "#E8E7E5", color: "#7E7D7A" }}>Afventer svar...</span>
            ) : question.isUpvoted ? (
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
      </div>
    </div>
  );
}
