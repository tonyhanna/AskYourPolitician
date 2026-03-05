"use client";

import { useRef, useState } from "react";
import { createQuestion } from "@/app/politiker/dashboard/actions";

export function QuestionForm({
  politicianId,
  disabled,
  availableTags,
}: {
  politicianId?: string;
  disabled: boolean;
  availableTags: { tagId: string; title: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
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
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
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
          defaultValue={1000}
          disabled={disabled}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
        />
      </div>
      <button
        type="submit"
        disabled={disabled || pending}
        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {pending ? "Opretter..." : "Opret spørgsmål"}
      </button>
      {disabled && (
        <p className="text-sm text-amber-600">
          Udfyld dine indstillinger nedenfor først.
        </p>
      )}
    </form>
  );
}
