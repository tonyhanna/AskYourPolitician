"use client";

import { useState } from "react";
import { cancelUpvote } from "@/app/[partySlug]/[politicianSlug]/actions";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useSystemColors } from "./SystemColorProvider";

export function CancelUpvoteButton({
  questionId,
  partySlug,
  politicianSlug,
}: {
  questionId: string;
  partySlug: string;
  politicianSlug: string;
}) {
  const { error: colorError } = useSystemColors();
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelUpvote(questionId, partySlug, politicianSlug);
      window.dispatchEvent(new CustomEvent("upvote-banner", { detail: { message: "Din upvote er fjernet" } }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
      setCancelling(false);
    }
  }

  return (
    <button
      onClick={handleCancel}
      disabled={cancelling}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full cursor-pointer transition hover:opacity-70 disabled:opacity-50"
      style={{ backgroundColor: "#E8E7E5", color: colorError }}
    >
      <FontAwesomeIcon icon={faXmark} className="text-xs" />
      {cancelling ? "Fjerner..." : "Fjern upvote"}
    </button>
  );
}
