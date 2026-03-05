"use client";

import Link from "next/link";
import { useState } from "react";
import { directUpvote } from "@/app/[partySlug]/[politicianSlug]/actions";

export function UpvoteButton({
  questionId,
  basePath,
  isUpvoted,
  hasSession,
  partySlug,
  politicianSlug,
}: {
  questionId: string;
  basePath: string;
  isUpvoted: boolean;
  hasSession: boolean;
  partySlug: string;
  politicianSlug: string;
}) {
  const [pending, setPending] = useState(false);

  if (isUpvoted) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-green-700 font-medium">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
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
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
        {pending ? "Upvoter..." : "Upvote"}
      </button>
    );
  }

  return (
    <Link
      href={`${basePath}/upvote/${questionId}`}
      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
      Upvote
    </Link>
  );
}
