"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faThumbsUp, faThumbsDown } from "@fortawesome/pro-duotone-svg-icons";
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
      <p className="text-sm" style={{ color: "var(--system-text2, #FF0000)", fontFamily: "var(--font-figtree)" }}>Ingen forslag fra borgere endnu.</p>
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
      if (prev.has(tagId)) return new Set();
      return new Set([tagId]);
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
    <div className="rounded-lg" style={{ backgroundColor: mode !== "idle" ? "var(--system-bg2, #FF0000)" : "var(--system-bg1, #FF0000)" }}>
      <div style={{ padding: "20px 20px 16px" }}>
        {mode === "approve" ? (
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={3}
            className="w-full mb-1 rounded-lg px-3 py-2 resize-none"
            style={{ fontSize: 22, lineHeight: 1.3, fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-form-text0, #FF0000)", backgroundColor: "var(--system-form-bg, #FF0000)", border: "none", outline: "none" }}
          />
        ) : (
          <p style={{ fontSize: 22, lineHeight: 1.3, fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-text0, #FF0000)", marginBottom: 4 }}>{suggestion.text}</p>
        )}
        <span style={{
          display: "inline-block", fontSize: 12, lineHeight: 1.3,
          backgroundColor: "var(--system-bg0, #FF0000)",
          padding: "2px 4px",
          fontFamily: "var(--font-figtree)", fontWeight: 400,
        }}>
          <span style={{ color: "var(--system-text0, #FF0000)" }}>{suggestion.citizenFirstName}</span>
          <span style={{ color: "var(--system-text2, #FF0000)" }}> — {new Date(suggestion.createdAt).toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
        </span>
      </div>

      {mode === "idle" && (
        <div style={{ borderTop: "1px solid var(--system-bg2, #FF0000)", padding: "12px 10px" }}>
          <div className="flex items-center" style={{ gap: 5 }}>
            <button
              onClick={() => setMode("approve")}
              className="group cursor-pointer rounded-full flex items-center justify-center flex-shrink-0"
              style={{ height: 40, width: 40, backgroundColor: "var(--system-bg0, #FF0000)" }}
              aria-label="Godkend"
            >
              <FontAwesomeIcon icon={faThumbsUp} swapOpacity className="group-hover:opacity-50 transition-opacity" style={{ color: "var(--system-success, #FF0000)", fontSize: 16, transform: "scaleX(-1)" }} />
            </button>
            <button
              onClick={() => setMode("reject")}
              className="group cursor-pointer rounded-full flex items-center justify-center flex-shrink-0"
              style={{ height: 40, width: 40, backgroundColor: "var(--system-bg0, #FF0000)" }}
              aria-label="Afvis"
            >
              <FontAwesomeIcon icon={faThumbsDown} swapOpacity className="group-hover:opacity-50 transition-opacity" style={{ color: "var(--system-error, #FF0000)", fontSize: 16 }} />
            </button>
          </div>
        </div>
      )}

      {mode === "approve" && (
        <form action={handleApprove} style={{ borderTop: "1px solid var(--system-bg2, #FF0000)" }}>
          {isEdited && (
            <div style={{ padding: "12px 20px 0" }}>
              <label htmlFor={`edit-reason-${suggestion.id}`} className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
                Grund til rettelse
              </label>
              <textarea
                id={`edit-reason-${suggestion.id}`}
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Forklar borgeren hvorfor du har rettet spørgsmålet..."
                rows={2}
                required
                className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                style={{ fontFamily: "var(--font-figtree)", backgroundColor: "var(--system-form-bg, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none" }}
              />
            </div>
          )}

          <div style={{ padding: "12px 20px 0" }}>
            <label htmlFor={`goal-${suggestion.id}`} className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
              Upvote-mål
            </label>
            <input
              id={`goal-${suggestion.id}`}
              name="upvoteGoal"
              type="number"
              defaultValue={100}
              min={1}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ fontFamily: "var(--font-figtree)", backgroundColor: "var(--system-form-bg, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none" }}
            />
          </div>

          {availableTags.length > 0 && (
            <div style={{ padding: "12px 20px 0" }}>
              <p className="block text-sm font-medium mb-2" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
                Mærkesager (valgfrit)
              </p>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <button
                    key={tag.tagId}
                    type="button"
                    onClick={() => toggleTag(tag.tagId)}
                    className="text-sm px-3 py-1.5 rounded-full border border-transparent cursor-pointer transition-all duration-150"
                    style={{
                      fontFamily: "var(--font-figtree)", fontWeight: 500,
                      backgroundColor: selectedTags.has(tag.tagId) ? "var(--system-bg0-contrast, #FF0000)" : "var(--system-bg0, #FF0000)",
                      transition: "background-color 200ms ease",
                      color: selectedTags.has(tag.tagId) ? "var(--system-text0-contrast, #FF0000)" : "var(--system-text0, #FF0000)",
                    }}
                  >
                    {tag.tagId}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end" style={{ padding: "12px 20px 16px" }}>
            <button
              type="button"
              onClick={() => { setEditedText(suggestion.text); setEditReason(""); setSelectedTags(new Set()); setMode("idle"); }}
              className="text-sm cursor-pointer px-3 py-1.5 hover:opacity-50 transition-opacity"
              style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
            >
              Annullér
            </button>
            <button
              type="submit"
              disabled={pending || (isEdited && !editReason.trim())}
              className="group text-sm px-4 py-1.5 rounded-full disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, backgroundColor: "var(--system-success, #FF0000)", color: "var(--system-success-contrast, #FF0000)" }}
            >
              <span className="group-hover:opacity-50 transition-opacity">{pending ? "Godkender..." : "Godkend spørgsmål"}</span>
            </button>
          </div>
        </form>
      )}

      {mode === "reject" && (
        <div style={{ borderTop: "1px solid var(--system-bg2, #FF0000)" }}>
          <div style={{ padding: "12px 20px 0" }}>
            <label htmlFor={`reason-${suggestion.id}`} className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
              Begrundelse
            </label>
            <select
              id={`reason-${suggestion.id}`}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full rounded-lg py-2 text-sm"
              style={{ fontFamily: "var(--font-figtree)", backgroundColor: "var(--system-form-bg, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none", paddingLeft: 12, paddingRight: 36, appearance: "none", WebkitAppearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
            >
              <option value="" disabled>Vælg grund</option>
              <option value="already_answered">Jeg har allerede svaret på det spørgsmål</option>
              <option value="duplicate">Dit spørgsmål ligner et eksisterende spørgsmål</option>
              <option value="custom">Anden grund</option>
            </select>
          </div>

          {(rejectReason === "already_answered" || rejectReason === "duplicate") && (
            <div style={{ padding: "12px 20px 0" }}>
              <label htmlFor={`link-${suggestion.id}`} className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
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
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ fontFamily: "var(--font-figtree)", backgroundColor: "var(--system-form-bg, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none" }}
              />
              {linkStatus === "checking" && (
                <p className="text-sm mt-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>Tjekker link...</p>
              )}
              {linkStatus === "valid" && (
                <p className="text-sm mt-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-success, #FF0000)" }}>
                  Spørgsmål fundet: &ldquo;{linkQuestionText}&rdquo;
                </p>
              )}
              {linkStatus === "invalid" && (
                <p className="text-sm mt-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-error, #FF0000)" }}>
                  Spørgsmålet blev ikke fundet. Tjek at linket er korrekt.
                </p>
              )}
            </div>
          )}

          {rejectReason === "custom" && (
            <div style={{ padding: "12px 20px 0" }}>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Skriv din begrundelse..."
                rows={2}
                className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                style={{ fontFamily: "var(--font-figtree)", backgroundColor: "var(--system-form-bg, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none" }}
              />
            </div>
          )}

          <div className="flex gap-2 justify-end" style={{ padding: "12px 20px 16px" }}>
            <button
              type="button"
              onClick={() => { setRejectReason(""); setCustomReason(""); setRejectLink(""); setLinkStatus("idle"); setLinkQuestionText(""); setMode("idle"); }}
              className="text-sm cursor-pointer px-3 py-1.5 hover:opacity-50 transition-opacity"
              style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
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
              className="group text-sm px-4 py-1.5 rounded-full disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, backgroundColor: "var(--system-error, #FF0000)", color: "var(--system-error-contrast, #FF0000)" }}
            >
              <span className="group-hover:opacity-50 transition-opacity">{pending ? "Afviser..." : "Afvis spørgsmål"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
