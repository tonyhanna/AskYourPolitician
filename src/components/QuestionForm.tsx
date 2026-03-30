"use client";

import { useRef, useState, useEffect } from "react";
import { createQuestion } from "@/app/politiker/dashboard/actions";

export function QuestionForm({
  politicianId,
  disabled,
  availableTags,
  defaultUpvoteGoal = 1000,
  partyColor,
  partyColorDark,
  partyColorLight,
}: {
  politicianId?: string;
  disabled: boolean;
  availableTags: { tagId: string; title: string }[];
  defaultUpvoteGoal?: number;
  partyColor?: string | null;
  partyColorDark?: string | null;
  partyColorLight?: string | null;
}) {
  const canHover = useRef(false);
  useEffect(() => { canHover.current = window.matchMedia("(hover: hover)").matches; }, []);
  const formRef = useRef<HTMLFormElement>(null);
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
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }

  if (!open) return null;

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="text" className="block text-sm font-medium text-gray-700 mb-1">
          Spørgsmål
        </label>
        <textarea
          id="text"
          name="text"
          maxLength={300}
          required
          disabled={disabled}
          rows={3}
          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          placeholder="Hvilket spørgsmål vil du gerne have borgerne til at stille dig?"
          onChange={(e) => setCharCount(e.target.value.length)}
        />
        <p className="text-xs text-gray-500 text-right">{charCount}/300</p>
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
                disabled={disabled}
                className={`text-sm px-3 py-1.5 rounded-full border cursor-pointer transition ${
                  selectedTags.has(tag.tagId)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {tag.tagId}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <label htmlFor="upvoteGoal" className="block text-sm font-medium text-gray-700 mb-1">
          Upvote mål
        </label>
        <input
          id="upvoteGoal"
          name="upvoteGoal"
          type="number"
          min={1}
          defaultValue={defaultUpvoteGoal}
          disabled={disabled}
          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={disabled || pending}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {pending ? "Opretter..." : "Opret spørgsmål"}
        </button>
      </div>
      {disabled && (
        <p className="text-sm text-amber-600">
          Udfyld dine indstillinger nedenfor først.
        </p>
      )}
    </form>
  );
}
