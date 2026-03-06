"use client";

import { useState, useMemo } from "react";
import { UpvoteButton } from "./UpvoteButton";
import { CancelUpvoteButton } from "./CancelUpvoteButton";
import { CopyLinkButton } from "./CopyLinkButton";
import { isBlobUrl, getBlobMediaType } from "@/lib/answer-utils";

type FeedQuestion = {
  id: string;
  text: string;
  upvoteCount: number;
  upvoteGoal: number;
  answerUrl: string | null;
  goalReachedEmailSent: boolean;
  suggestedBy: string | null;
  tags: string[];
  isUpvoted: boolean;
  createdAt: string;
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
}) {
  const [moreOpen, setMoreOpen] = useState(false);
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

  const filtered = useMemo(() => {
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

    return result;
  }, [questions, group, selectedTags, sort]);

  return (
    <div>
      {/* Vis — always visible */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {([
          ["all", "Alle"],
          ["answered", "Besvarede"],
          ["own", `${politicianFirstName}s egne`],
          ["citizen", "Borgeres spørgsmål"],
          ...(hasSession ? [["upvoted", "Mine upvotede"] as [GroupOption, string]] : []),
        ] as [GroupOption, string][]).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setGroup(value)}
            className={`text-sm px-3 py-1.5 rounded-full border cursor-pointer transition ${
              group === value
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer flex items-center gap-1"
        >
          <svg className={`w-3.5 h-3.5 transition-transform ${moreOpen ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Flere filtre
          {hasMoreFilters && (
            <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full ml-1">aktiv</span>
          )}
        </button>
        {isFiltered && (
          <button
            onClick={reset}
            className="text-sm text-red-500 hover:text-red-700 cursor-pointer"
          >
            Nulstil
          </button>
        )}
      </div>

      {/* Flere filtre — collapsible */}
      {moreOpen && (
        <div className="border border-gray-200 rounded-lg p-4 mb-4 space-y-4 bg-gray-50">
          {/* Sortering */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Sortering</p>
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
                  className={`text-sm px-3 py-1.5 rounded-full border cursor-pointer transition ${
                    sort === value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Mærkesager */}
          {allTags.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Mærkesager</p>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`text-sm px-3 py-1.5 rounded-full border cursor-pointer transition ${
                      selectedTags.has(tag)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Question list */}
      <div className="space-y-4">
        {filtered.map((question) => (
          <div
            key={question.id}
            className={`rounded-lg p-4 ${
              question.answerUrl
                ? "bg-gray-900 border border-gray-900"
                : "border border-green-300 bg-green-50"
            }`}
          >
            <a
              href={`${basePath}/q/${question.id}`}
              className={`block font-medium mb-2 transition ${
                question.answerUrl
                  ? "text-white hover:text-blue-300"
                  : "text-gray-900 hover:text-blue-600"
              }`}
            >
              {question.text}
            </a>
            {question.suggestedBy && (
              <p className={`text-xs mb-2 ${question.answerUrl ? "text-gray-400" : "text-gray-400"}`}>
                Foreslået af {question.suggestedBy}
              </p>
            )}
            {question.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {question.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      question.answerUrl
                        ? "bg-gray-700 text-gray-300"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <CopyLinkButton
                url={`${appUrl}${basePath}/q/${question.id}`}
                title={question.text}
                compact
              />
              <div className="flex items-center gap-3">
                {question.answerUrl ? (
                  isBlobUrl(question.answerUrl) ? (
                    <a
                      href={`${basePath}/q/${question.id}`}
                      className="text-sm text-blue-400 hover:text-blue-300 underline font-medium"
                    >
                      {getBlobMediaType(question.answerUrl) === "audio" ? "Lyt til svar" : "Se svar"}
                    </a>
                  ) : (
                    <a
                      href={question.answerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:text-blue-300 underline font-medium"
                    >
                      Se svar
                    </a>
                  )
                ) : (
                  <span className="text-sm text-gray-500">
                    {question.upvoteCount} {question.upvoteCount === 1 ? "upvote" : "upvotes"}
                  </span>
                )}
                {question.answerUrl ? (
                  question.isUpvoted ? (
                    <CancelUpvoteButton
                      questionId={question.id}
                      partySlug={partySlug}
                      politicianSlug={politicianSlug}
                    />
                  ) : null
                ) : question.goalReachedEmailSent ? (
                  <span className="text-sm text-amber-600 font-medium">Afventer svar...</span>
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
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && questions.length > 0 && (
        <p className="text-gray-500 text-center py-8">
          Ingen spørgsmål matcher dine filtre.
        </p>
      )}
    </div>
  );
}
