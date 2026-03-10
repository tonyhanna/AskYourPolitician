"use client";

import { useState } from "react";
import { cancelUpvote } from "@/app/[partySlug]/[politicianSlug]/actions";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpToLine } from "@fortawesome/pro-duotone-svg-icons";

export function AwaitingAnswerButton({
  questionId,
  partySlug,
  politicianSlug,
}: {
  questionId: string;
  partySlug: string;
  politicianSlug: string;
}) {
  const [hovered, setHovered] = useState(false);
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full cursor-pointer transition disabled:opacity-50"
      style={{ backgroundColor: "#E8E7E5", color: hovered || cancelling ? "#FF4105" : "#7E7D7A" }}
    >
      <FontAwesomeIcon icon={faArrowUpToLine} className="text-xs" />
      {cancelling ? "Annullerer..." : hovered ? "Annullér" : "Afventer svar..."}
    </button>
  );
}
