"use client";

import { useState } from "react";
import { cancelUpvote } from "@/app/[partySlug]/[politicianSlug]/actions";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useSystemColors } from "./SystemColorProvider";

export function AwaitingAnswerButton({
  questionId,
  partySlug,
  politicianSlug,
}: {
  questionId: string;
  partySlug: string;
  politicianSlug: string;
}) {
  const { error: colorError } = useSystemColors();
  const [hovered, setHovered] = useState(false);
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

  const showCancel = hovered || cancelling;

  return (
    <button
      onClick={handleCancel}
      disabled={cancelling}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="inline-flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-full cursor-pointer transition disabled:opacity-50"
      style={{
        width: 110,
        backgroundColor: "#E8E7E5",
        color: showCancel ? colorError : "#7E7D7A",
      }}
    >
      {showCancel && <FontAwesomeIcon icon={faXmark} className="text-xs" />}
      {cancelling ? "Fjerner..." : showCancel ? "Fjern upvote" : "Afventer svar"}
    </button>
  );
}
