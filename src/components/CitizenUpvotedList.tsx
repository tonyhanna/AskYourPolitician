"use client";

import { cancelUpvote } from "@/app/[partySlug]/[politicianSlug]/actions";
import { useState } from "react";

type UpvotedQuestion = {
  id: string;
  text: string;
  upvoteCount: number;
};

export function CitizenUpvotedList({
  questions,
  partySlug,
  politicianSlug,
}: {
  questions: UpvotedQuestion[];
  partySlug: string;
  politicianSlug: string;
}) {
  if (questions.length === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <h3 className="text-sm font-semibold text-blue-900 mb-3">
        Dine upvotede spørgsmål
      </h3>
      <div className="space-y-2">
        {questions.map((q) => (
          <UpvotedItem
            key={q.id}
            question={q}
            partySlug={partySlug}
            politicianSlug={politicianSlug}
          />
        ))}
      </div>
    </div>
  );
}

function UpvotedItem({
  question,
  partySlug,
  politicianSlug,
}: {
  question: UpvotedQuestion;
  partySlug: string;
  politicianSlug: string;
}) {
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelUpvote(question.id, partySlug, politicianSlug);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
      setCancelling(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-blue-900">{question.text}</span>
      <button
        onClick={handleCancel}
        disabled={cancelling}
        className="text-blue-600 hover:text-blue-800 whitespace-nowrap disabled:opacity-50 cursor-pointer"
      >
        {cancelling ? "Annullerer..." : "Annullér"}
      </button>
    </div>
  );
}
