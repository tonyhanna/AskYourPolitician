"use client";

import { useRef, useState, useEffect } from "react";
import { createQuestion } from "@/app/politiker/dashboard/actions";

export function QuestionForm({
  politicianId,
  disabled,
  availableTags,
  defaultUpvoteGoal = 1000,
}: {
  politicianId?: string;
  disabled: boolean;
  availableTags: { tagId: string; title: string }[];
  defaultUpvoteGoal?: number;
}) {
  const canHover = useRef(false);
  useEffect(() => { canHover.current = window.matchMedia("(hover: hover)").matches; }, []);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);

  // Listen for nav button open/close
  useEffect(() => {
    const openHandler = (e: Event) => {
      if ((e as CustomEvent).detail?.tab === "questions") setOpen(true);
    };
    const closeHandler = () => setOpen(false);
    window.addEventListener("dashboard-create-open", openHandler);
    window.addEventListener("dashboard-create-close", closeHandler);
    return () => {
      window.removeEventListener("dashboard-create-open", openHandler);
      window.removeEventListener("dashboard-create-close", closeHandler);
    };
  }, []);

  const [charCount, setCharCount] = useState(0);
  const [pending, setPending] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  async function handleSubmit(formData: FormData) {
    formData.set("tags", Array.from(selectedTags).join(","));
    setPending(true);
    try {
      await createQuestion(formData);
      formRef.current?.reset();
      setCharCount(0);
      setSelectedTags(new Set());
      setOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
    } finally {
      setPending(false);
    }
  }

  function toggleTag(tagId: string) {
    setSelectedTags((prev) => {
      if (prev.has(tagId)) return new Set();
      return new Set([tagId]);
    });
  }

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [open]);

  if (!open) return null;

  return (
    <div className="rounded-lg" style={{ backgroundColor: "var(--system-bg2, #FF0000)" }}>
      <form ref={formRef} action={handleSubmit}>
        <div style={{ padding: "20px 20px 0" }}>
          <textarea
            ref={textareaRef}
            id="text"
            name="text"
            maxLength={300}
            required
            disabled={disabled}
            rows={3}
            className="w-full mb-1 rounded-lg px-3 py-2 resize-none disabled:opacity-50"
            style={{ fontSize: 22, lineHeight: 1.3, fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-form-text0, #FF0000)", backgroundColor: "var(--system-form-bg, #FF0000)", border: "none", outline: "none" }}
            placeholder="Skriv dit spørgsmål her..."
            onChange={(e) => setCharCount(e.target.value.length)}
          />
          <p className="text-xs text-right" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>{charCount}/300</p>
        </div>

        <div style={{ padding: "12px 20px 0" }}>
          <label htmlFor="upvoteGoal" className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
            Upvote-mål
          </label>
          <input
            id="upvoteGoal"
            name="upvoteGoal"
            type="number"
            min={1}
            defaultValue={defaultUpvoteGoal}
            disabled={disabled}
            className="w-full rounded-lg px-3 py-2 text-sm disabled:opacity-50"
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
                  disabled={disabled}
                  className="text-sm px-3 py-1.5 rounded-full border border-transparent cursor-pointer transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
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
            onClick={() => { setOpen(false); setCharCount(0); setSelectedTags(new Set()); formRef.current?.reset(); window.dispatchEvent(new CustomEvent("dashboard-create-close")); }}
            className="text-sm cursor-pointer px-3 py-1.5 hover:opacity-50 transition-opacity"
            style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
          >
            Annullér
          </button>
          <button
            type="submit"
            disabled={disabled || pending || charCount === 0}
            className="group text-sm px-4 py-1.5 rounded-full disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, backgroundColor: "var(--system-success, #FF0000)", color: "var(--system-success-contrast, #FF0000)" }}
          >
            <span className="group-hover:opacity-50 transition-opacity">{pending ? "Opretter..." : "Opret spørgsmål"}</span>
          </button>
        </div>

        {disabled && (
          <div style={{ padding: "0 20px 16px" }}>
            <p className="text-sm" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-pending-contrast, #FF0000)" }}>
              Udfyld dine indstillinger nedenfor først.
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
