"use client";

import { useState } from "react";
import { approveSuggestion, rejectSuggestion, verifyQuestionLink } from "@/app/politiker/dashboard/actions";

type Suggestion = {
  id: string;
  citizenFirstName: string;
  text: string;
  createdAt: string;
};

export function SuggestionList({
  suggestions,
  availableTags,
}: {
  suggestions: Suggestion[];
  availableTags: { tagId: string; title: string }[];
}) {
  if (suggestions.length === 0) {
    return (
      <p className="text-sm text-gray-500">Ingen forslag fra borgere endnu.</p>
    );
  }

  return (
    <div className="space-y-4">
      {suggestions.map((s) => (
        <SuggestionItem key={s.id} suggestion={s} availableTags={availableTags} />
      ))}
    </div>
  );
}

function SuggestionItem({
  suggestion,
  availableTags,
}: {
  suggestion: Suggestion;
  availableTags: { tagId: string; title: string }[];
}) {
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [pending, setPending] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [editedText, setEditedText] = useState(suggestion.text);
  const [editReason, setEditReason] = useState("");
  const isEdited = editedText.trim() !== suggestion.text;
  const [rejectReason, setRejectReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [rejectLink, setRejectLink] = useState("");
  const [linkStatus, setLinkStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [linkQuestionText, setLinkQuestionText] = useState("");

  function toggleTag(tagId: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  async function handleApprove(formData: FormData) {
    setPending(true);
    formData.set("suggestionId", suggestion.id);
    formData.set("tags", Array.from(selectedTags).join(","));
    formData.set("editedText", editedText.trim());
    if (isEdited) {
      formData.set("editReason", editReason.trim());
    }
    try {
      await approveSuggestion(formData);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
      setPending(false);
    }
  }

  async function handleVerifyLink(url: string) {
    if (!url.trim()) {
      setLinkStatus("idle");
      setLinkQuestionText("");
      return;
    }
    setLinkStatus("checking");
    try {
      const result = await verifyQuestionLink(url);
      if (result.valid) {
        setLinkStatus("valid");
        setLinkQuestionText(result.questionText || "");
      } else {
        setLinkStatus("invalid");
        setLinkQuestionText("");
      }
    } catch {
      setLinkStatus("invalid");
      setLinkQuestionText("");
    }
  }

  async function handleReject() {
    setPending(true);
    try {
      await rejectSuggestion(
        suggestion.id,
        rejectReason === "custom" ? customReason : rejectReason,
        rejectReason !== "custom" ? rejectLink : undefined,
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: "var(--system-bg1, #FF0000)" }}>
      {mode === "approve" ? (
        <textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          rows={3}
          className="w-full font-medium text-gray-900 mb-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      ) : (
        <p className="font-medium text-gray-900 mb-1">{suggestion.text}</p>
      )}
      <p className="text-sm text-gray-500 mb-3">
        Foreslået af {suggestion.citizenFirstName} &middot;{" "}
        {new Date(suggestion.createdAt).toLocaleDateString("da-DK")}
      </p>

      {mode === "idle" && (
        <div className="flex gap-3">
          <button
            onClick={() => setMode("approve")}
            className="text-sm bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700 cursor-pointer"
          >
            Godkend
          </button>
          <button
            onClick={() => setMode("reject")}
            className="text-sm bg-red-600 text-white px-4 py-1.5 rounded-lg hover:bg-red-700 cursor-pointer"
          >
            Afvis
          </button>
        </div>
      )}

      {mode === "approve" && (
        <form action={handleApprove} className="space-y-3 mt-3 border-t border-gray-100 pt-3">
          {isEdited && (
            <div>
              <label htmlFor={`edit-reason-${suggestion.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                Grund til rettelse
              </label>
              <textarea
                id={`edit-reason-${suggestion.id}`}
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Forklar borgeren hvorfor du har rettet spørgsmålet..."
                rows={2}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          )}

          <div>
            <label htmlFor={`goal-${suggestion.id}`} className="block text-sm font-medium text-gray-700 mb-1">
              Upvote-mål
            </label>
            <input
              id={`goal-${suggestion.id}`}
              name="upvoteGoal"
              type="number"
              defaultValue={100}
              min={1}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {availableTags.length > 0 && (
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-2">
                Mærkesager (valgfrit)
              </p>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <button
                    key={tag.tagId}
                    type="button"
                    onClick={() => toggleTag(tag.tagId)}
                    className={`text-sm px-3 py-1.5 rounded-full border cursor-pointer transition ${
                      selectedTags.has(tag.tagId)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {tag.tagId}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setMode("idle")}
              className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5 cursor-pointer"
            >
              Annullér
            </button>
            <button
              type="submit"
              disabled={pending || (isEdited && !editReason.trim())}
              className="text-sm bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 cursor-pointer"
            >
              {pending ? "Godkender..." : "Godkend spørgsmål"}
            </button>
          </div>
        </form>
      )}

      {mode === "reject" && (
        <div className="space-y-3 mt-3 border-t border-gray-100 pt-3">
          <div>
            <label htmlFor={`reason-${suggestion.id}`} className="block text-sm font-medium text-gray-700 mb-1">
              Begrundelse
            </label>
            <select
              id={`reason-${suggestion.id}`}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="" disabled>Vælg grund</option>
              <option value="already_answered">Jeg har allerede svaret på det spørgsmål</option>
              <option value="duplicate">Dit spørgsmål ligner et eksisterende spørgsmål</option>
              <option value="custom">Anden grund</option>
            </select>
          </div>

          {(rejectReason === "already_answered" || rejectReason === "duplicate") && (
            <div>
              <label htmlFor={`link-${suggestion.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                Link til spørgsmål
              </label>
              <input
                id={`link-${suggestion.id}`}
                type="url"
                required
                value={rejectLink}
                onChange={(e) => {
                  setRejectLink(e.target.value);
                  setLinkStatus("idle");
                  setLinkQuestionText("");
                }}
                onBlur={(e) => handleVerifyLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleVerifyLink(rejectLink);
                  }
                }}
                placeholder="https://..."
                className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  linkStatus === "valid"
                    ? "border-green-400"
                    : linkStatus === "invalid"
                      ? "border-red-400"
                      : "border-gray-300"
                }`}
              />
              {linkStatus === "checking" && (
                <p className="text-sm text-gray-500 mt-1">Tjekker link...</p>
              )}
              {linkStatus === "valid" && (
                <p className="text-sm text-green-600 mt-1">
                  Spørgsmål fundet: &ldquo;{linkQuestionText}&rdquo;
                </p>
              )}
              {linkStatus === "invalid" && (
                <p className="text-sm text-red-600 mt-1">
                  Spørgsmålet blev ikke fundet. Tjek at linket er korrekt.
                </p>
              )}
            </div>
          )}

          {rejectReason === "custom" && (
            <div>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Skriv din begrundelse..."
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setMode("idle")}
              className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5 cursor-pointer"
            >
              Annullér
            </button>
            <button
              onClick={handleReject}
              disabled={
                pending ||
                !rejectReason ||
                (rejectReason === "custom" && !customReason.trim()) ||
                ((rejectReason === "already_answered" || rejectReason === "duplicate") && linkStatus !== "valid")
              }
              className="text-sm bg-red-600 text-white px-4 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 cursor-pointer"
            >
              {pending ? "Afviser..." : "Afvis spørgsmål"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
