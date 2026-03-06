"use client";

import { useState } from "react";
import { deleteQuestion, editQuestion, submitAnswerUrl } from "@/app/politiker/dashboard/actions";
import { CopyLinkButton } from "./CopyLinkButton";

type Question = {
  id: string;
  text: string;
  upvoteGoal: number;
  upvoteCount: number;
  tags: string[];
  goalReached: boolean;
  answerUrl: string | null;
  suggestedBy: string | null;
};

export function QuestionList({
  questions,
  availableTags,
  basePath,
}: {
  questions: Question[];
  availableTags: { tagId: string; title: string }[];
  basePath: string;
}) {
  return (
    <div className="space-y-4">
      {questions.map((q) => (
        <QuestionItem key={q.id} question={q} availableTags={availableTags} basePath={basePath} />
      ))}
    </div>
  );
}

function QuestionItem({
  question,
  availableTags,
  basePath,
}: {
  question: Question;
  availableTags: { tagId: string; title: string }[];
  basePath: string;
}) {
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [answerUrlInput, setAnswerUrlInput] = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [editingAnswer, setEditingAnswer] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set(question.tags));
  const hasUpvotes = question.upvoteCount > 0;

  async function handleDelete() {
    if (!confirm("Er du sikker på at du vil slette dette spørgsmål?")) return;
    setDeleting(true);
    try {
      const result = await deleteQuestion(question.id);
      if (result.error) {
        alert(result.error);
        setDeleting(false);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
      setDeleting(false);
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

  async function handleSave(formData: FormData) {
    setSaving(true);
    try {
      formData.set("questionId", question.id);
      formData.set("tags", Array.from(selectedTags).join(","));
      const result = await editQuestion(formData);
      if (result.error) {
        alert(result.error);
      } else {
        setEditing(false);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="border border-blue-300 bg-blue-50 rounded-lg p-4">
        <form action={handleSave} className="space-y-3">
          <div>
            <label htmlFor={`text-${question.id}`} className="block text-sm font-medium text-gray-700 mb-1">
              Spørgsmål
            </label>
            <textarea
              id={`text-${question.id}`}
              name="text"
              defaultValue={question.text}
              maxLength={300}
              required
              rows={3}
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
          <div>
            <label htmlFor={`goal-${question.id}`} className="block text-sm font-medium text-gray-700 mb-1">
              Upvote-mål
            </label>
            <input
              id={`goal-${question.id}`}
              name="upvoteGoal"
              type="number"
              defaultValue={question.upvoteGoal}
              min={1}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5 cursor-pointer"
            >
              Annullér
            </button>
            <button
              type="submit"
              disabled={saving}
              className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Gemmer..." : "Gem"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <p className="font-medium text-gray-900 mb-1">{question.text}</p>
      {question.suggestedBy && (
        <p className="text-sm text-gray-500 mb-1">Foreslået af {question.suggestedBy}</p>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {question.tags.map((tag) => (
          <span
            key={tag}
            className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>

      {question.goalReached && (
        <div className="mt-2 mb-3">
          {question.answerUrl && !editingAnswer ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-green-800 font-medium mb-1">Svar indsendt</p>
                  <a
                    href={question.answerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
                  >
                    {question.answerUrl}
                  </a>
                </div>
                <button
                  onClick={() => {
                    setAnswerUrlInput(question.answerUrl!);
                    setEditingAnswer(true);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap cursor-pointer"
                >
                  Redigér svar
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800 font-medium mb-2">
                {editingAnswer ? "Opdatér dit svar" : "Målet er nået! Indsend dit svar (helst inden 24 timer)"}
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={answerUrlInput}
                  onChange={(e) => setAnswerUrlInput(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="flex gap-2">
                  {editingAnswer && (
                    <button
                      onClick={() => {
                        setEditingAnswer(false);
                        setAnswerUrlInput("");
                      }}
                      className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2 cursor-pointer"
                    >
                      Annullér
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (!answerUrlInput) return;
                      if (editingAnswer) {
                        const confirmed = confirm(
                          `Er du sikker på at du vil sende dette opdateret svar ud til ${question.upvoteCount} ${question.upvoteCount === 1 ? "borger" : "borgere"}?`
                        );
                        if (!confirmed) return;
                      }
                      setSubmittingAnswer(true);
                      try {
                        await submitAnswerUrl(question.id, answerUrlInput);
                        setEditingAnswer(false);
                      } catch (e) {
                        alert(e instanceof Error ? e.message : "Der opstod en fejl");
                      } finally {
                        setSubmittingAnswer(false);
                      }
                    }}
                    disabled={submittingAnswer || !answerUrlInput}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    {submittingAnswer ? "Sender..." : editingAnswer ? "Opdatér svar" : "Indsend svar"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            {question.upvoteCount} / {question.upvoteGoal} {question.upvoteGoal === 1 ? "upvote" : "upvotes"}
          </span>
          <CopyLinkButton
            url={`${basePath}/q/${question.id}`}
            title={question.text}
            compact
          />
        </div>
        {!hasUpvotes && (
          <div className="flex gap-3">
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              Redigér
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50 cursor-pointer"
            >
              {deleting ? "Sletter..." : "Slet"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
