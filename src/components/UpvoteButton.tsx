"use client";

import Link from "next/link";
import { useState } from "react";
import { directUpvote } from "@/app/[partySlug]/[politicianSlug]/actions";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUp } from "@fortawesome/free-solid-svg-icons";

export function UpvoteButton({
  questionId,
  basePath,
  isUpvoted,
  hasSession,
  partySlug,
  politicianSlug,
  partyColor,
  partyColorDark,
}: {
  questionId: string;
  basePath: string;
  isUpvoted: boolean;
  hasSession: boolean;
  partySlug: string;
  politicianSlug: string;
  partyColor?: string | null;
  partyColorDark?: string | null;
}) {
  const [pending, setPending] = useState(false);

  const pillClass = "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full cursor-pointer transition hover:opacity-70";
  const pillStyle = { backgroundColor: partyColor || "#3B82F6", color: "#ffffff" };

  if (isUpvoted) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
        style={pillStyle}
      >
        <FontAwesomeIcon icon={faArrowUp} className="text-xs" />
        Upvoted
      </span>
    );
  }

  if (hasSession) {
    return (
      <button
        onClick={async () => {
          setPending(true);
          try {
            await directUpvote(questionId, partySlug, politicianSlug);
          } catch (e) {
            alert(e instanceof Error ? e.message : "Der opstod en fejl");
          } finally {
            setPending(false);
          }
        }}
        disabled={pending}
        className={`${pillClass} disabled:opacity-50`}
        style={pillStyle}
      >
        <FontAwesomeIcon icon={faArrowUp} className="text-xs" />
        {pending ? "Upvoter..." : "Upvote"}
      </button>
    );
  }

  return (
    <Link
      href={`${basePath}/upvote/${questionId}`}
      className={pillClass}
      style={pillStyle}
    >
      <FontAwesomeIcon icon={faArrowUp} className="text-xs" />
      Upvote
    </Link>
  );
}
