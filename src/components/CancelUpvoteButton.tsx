"use client";

import { useState } from "react";
import { cancelUpvote } from "@/app/[partySlug]/[politicianSlug]/actions";

export function CancelUpvoteButton({
  questionId,
  partySlug,
  politicianSlug,
}: {
  questionId: string;
  partySlug: string;
  politicianSlug: string;
}) {
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelUpvote(questionId, partySlug, politicianSlug);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
      setCancelling(false);
    }
  }

  return (
    <button
      onClick={handleCancel}
      disabled={cancelling}
      className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50 cursor-pointer"
    >
      {cancelling ? "Annullerer..." : "Annullér upvote"}
    </button>
  );
}
