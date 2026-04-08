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
    muxPlaybackId?: string | null;
    muxAssetStatus?: string | null;
    muxMediaType?: string | null;
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
  hasSession,
  politicianName,
  politicianFirstName,
  partyName,
}: QuestionDetailCardProps) {
  const hasAnswer = !!question.answerUrl || !!question.muxAssetStatus;
  const hasThumbnail = question.answerClipUrl || question.answerPhotoUrl || question.muxPlaybackId || question.muxAssetStatus === "preparing";

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
          className={`flex-1 min-w-0 flex flex-col pt-[20px] ${hasThumbnail && hasAnswer ? "lg:pt-[50px]" : ""} pl-[15px] ${hasThumbnail && hasAnswer ? "pr-[25px] lg:pr-[50px]" : "pr-[15px]"}`}
        >
          {/* Unanswered: text + upvote side by side */}
          {!hasAnswer ? (
            <div className="flex items-start gap-5">
              <div className="flex-1 min-w-0">
                <div>
                  <span
                    style={{
                      fontSize: "clamp(28px, 8vw, 40px)",
                      lineHeight: 1.3,
                      color: "var(--system-text0, #FF0000)",
                      fontFamily: "var(--font-figtree)",
                      fontWeight: 400,
                    }}
                  >
                    {question.text}
                  </span>
                </div>
                {question.suggestedByName && (
                  <div className="mt-2">
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 12,
                        lineHeight: 1.3,
                        color: "var(--system-text0, #FF0000)",
                        backgroundColor: "var(--system-bg1, #FF0000)",
                        padding: "2px 4px",
                        fontFamily: "var(--font-figtree)",
                        fontWeight: 400,
                      }}
                    >
                      {question.suggestedByName}
                    </span>
                  </div>
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
                    fontSize: "clamp(28px, 8vw, 40px)",
                    lineHeight: 1.3,
                    color: "var(--party-light, #FF0000)",
                    fontFamily: "var(--font-figtree)",
                    fontWeight: 400,
                    backgroundColor: "var(--party-dark, #FF0000)",
                    boxDecorationBreak: "clone",
                    WebkitBoxDecorationBreak: "clone",
                    padding: "2px 8px",
                  }}
                >
                  {question.text}
                </span>
              </div>
              {question.suggestedByName && (
                <div className="mt-2">
                    <span
                      style={{
                        fontSize: 12,
                        lineHeight: 1.3,
                        color: "var(--system-text0, #FF0000)",
                        backgroundColor: "var(--system-bg1, #FF0000)",
                        boxDecorationBreak: "clone",
                        WebkitBoxDecorationBreak: "clone" as const,
                        padding: "2px 8px",
                        fontFamily: "var(--font-figtree)",
                        fontWeight: 400,
                      }}
                    >
                      {question.suggestedByName}
                    </span>
                  </div>
              )}
            </>
          )}

          {/* Bottom row: share + tags */}
          <div className="flex items-center gap-2 py-[20px]">
            <button
              onClick={handleShare}
              className="group cursor-pointer rounded-full flex items-center justify-center flex-shrink-0 relative"
              style={{
                height: 24,
                width: 24,
                backgroundColor: "var(--party-primary, #FF0000)",
              }}
              aria-label="Del"
            >
              <span className="absolute inset-0 flex items-center justify-center" style={{ opacity: copied ? 0 : 1, transition: "opacity 300ms ease" }}>
                <FontAwesomeIcon icon={faShare} className="group-hover:opacity-50 transition-opacity" style={{ color: "var(--party-dark, #FF0000)", fontSize: "13.5px" }} />
              </span>
              <span className="absolute inset-0 flex items-center justify-center" style={{ opacity: copied ? 1 : 0, transition: "opacity 300ms ease" }}>
                <FontAwesomeIcon icon={faCopy} className="group-hover:opacity-50 transition-opacity" style={{ color: "var(--party-dark, #FF0000)", fontSize: "13.5px" }} />
              </span>
            </button>
            {question.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1"
                style={{ backgroundColor: "var(--party-dark, #FF0000)", color: "var(--party-light, #FF0000)", fontFamily: "var(--font-figtree)", fontWeight: 500 }}
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
            bufferingColor="var(--party-light, #FF0000)"
            className="w-full lg:w-[337px] lg:mr-[9px]"
          />
        )}
      </div>
    </div>

    {showUpvoteModal && (
      <UpvoteModal
        questionId={question.id}
        questionText={question.text}
        partySlug={partySlug}
        politicianSlug={politicianSlug}
        redirectPath={`${basePath}/q/${question.id}`}
        onClose={() => setShowUpvoteModal(false)}
      />
    )}
    </>
  );
}
