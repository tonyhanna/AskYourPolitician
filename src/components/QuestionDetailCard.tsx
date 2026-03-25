"use client";

import { useState, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy } from "@fortawesome/free-solid-svg-icons";
import { faShare } from "@fortawesome/pro-duotone-svg-icons";
import { PlayableMediaCard } from "./PlayableMediaCard";
import { UpvoteModal } from "./UpvoteModal";
import { CircularUpvoteButton } from "./CircularUpvoteButton";

type QuestionDetailCardProps = {
  question: {
    id: string;
    text: string;
    upvoteCount: number;
    answerUrl: string | null;
    answerPhotoUrl: string | null;
    answerClipUrl: string | null;
    answerDuration: number | null;
    answerAspectRatio: number | null;
    tags: string[];
    suggestedByName: string | null;
    isUpvoted: boolean;
    goalReached: boolean;
    goalReachedAt: string | null;
    deadlineMissed: boolean;
  };
  basePath: string;
  appUrl: string;
  partySlug: string;
  politicianSlug: string;
  partyColor?: string | null;
  partyColorDark?: string | null;
  partyColorLight?: string | null;
  hasSession: boolean;
  politicianName: string;
  politicianFirstName: string;
  partyName: string;
};

export function QuestionDetailCard({
  question,
  basePath,
  appUrl,
  partySlug,
  politicianSlug,
  partyColor,
  partyColorDark,
  partyColorLight,
  hasSession,
  politicianName,
  politicianFirstName,
  partyName,
}: QuestionDetailCardProps) {
  const hasAnswer = !!question.answerUrl;
  const hasThumbnail = question.answerClipUrl || question.answerPhotoUrl;

  // Upvote modal for non-logged-in users
  const [showUpvoteModal, setShowUpvoteModal] = useState(false);

  // Share/copy state — blink copy icon then return to share
  const [copied, setCopied] = useState(false);
  const copyAnimRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const pageUrl = `${appUrl}${basePath}/q/${question.id}`;

  const handleShare = useCallback(() => {
    const isTouch = window.matchMedia("(pointer: coarse)").matches;

    if (isTouch && navigator.share) {
      navigator.share({ url: pageUrl, title: question.text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(pageUrl).catch(() => {});
      copyAnimRef.current.forEach(t => clearTimeout(t));
      copyAnimRef.current = [];
      setCopied(true);
      copyAnimRef.current.push(setTimeout(() => setCopied(false), 600));
    }
  }, [pageUrl, question.text]);

  return (
    <>
    <div>
      {/* Main card */}
      <div className={`flex flex-col ${hasThumbnail && hasAnswer ? "lg:flex-row lg:items-start" : ""}`}>
        {/* Left: question text + meta */}
        <div
          className={`flex-1 min-w-0 flex flex-col overflow-hidden pt-[20px] ${hasThumbnail && hasAnswer ? "lg:pt-[50px]" : ""}`}
          style={{ paddingLeft: 15, paddingRight: hasThumbnail && hasAnswer ? 50 : 15 }}
        >
          {/* Unanswered: text + upvote side by side */}
          {!hasAnswer ? (
            <div className="flex items-start gap-5">
              <div className="flex-1 min-w-0">
                <div>
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
                </div>
                {question.suggestedByName && (
                  <p className="text-xs text-gray-400 mt-2 ml-2">{question.suggestedByName}</p>
                )}
              </div>
              <div className="shrink-0 pt-[8px]">
                <CircularUpvoteButton
                  key={`${question.id}-${question.isUpvoted}-${hasSession}`}
                  questionId={question.id}
                  isUpvoted={question.isUpvoted}
                  goalReached={question.goalReached}
                  goalReachedAt={question.goalReachedAt}
                  hasSession={hasSession}
                  partySlug={partySlug}
                  politicianSlug={politicianSlug}
                  partyColor={partyColor}
                  partyColorDark={partyColorDark}
                  size={80}
                  tooltipPosition="left"
                  onLoginUpvote={() => setShowUpvoteModal(true)}
                  politicianFirstName={politicianFirstName}
                  upvoteCount={question.upvoteCount}
                />
              </div>
            </div>
          ) : (
            <>
              <div>
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
              </div>
              {question.suggestedByName && (
                <p className="text-xs text-gray-400 mt-2 ml-2">{question.suggestedByName}</p>
              )}
            </>
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
        {hasThumbnail && hasAnswer && (
          <PlayableMediaCard
            question={question}
            partyColor={partyColor}
            partyColorDark={partyColorDark}
            bufferingColor={partyColorLight}
            className="w-[90vw] self-center lg:self-auto lg:w-[337px]"
          />
        )}
      </div>
    </div>

    {showUpvoteModal && (
      <UpvoteModal
        questionId={question.id}
        partySlug={partySlug}
        politicianSlug={politicianSlug}
        partyColor={partyColor}
        partyColorDark={partyColorDark}
        partyColorLight={partyColorLight}
        redirectPath={`${basePath}/q/${question.id}`}
        onClose={() => setShowUpvoteModal(false)}
      />
    )}
    </>
  );
}
