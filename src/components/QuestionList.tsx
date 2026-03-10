"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { deleteQuestion, editQuestion, submitAnswerUrl, togglePinQuestion } from "@/app/politiker/dashboard/actions";
import { CopyLinkButton } from "./CopyLinkButton";
import { isBlobUrl, getBlobMediaType, getYouTubeVideoId, isFacebookUrl, isFacebookVideoUrl } from "@/lib/answer-utils";
import { AnswerPlayer } from "./AnswerPlayer";

type Question = {
  id: string;
  text: string;
  upvoteGoal: number;
  upvoteCount: number;
  tags: string[];
  goalReached: boolean;
  answerUrl: string | null;
  answerPhotoUrl: string | null;
  suggestedBy: string | null;
  pinned: boolean;
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
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [pinning, setPinning] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const hasUpvotes = question.upvoteCount > 0;

  async function handleFileUpload(file: File) {
    if (file.size > 250 * 1024 * 1024) {
      setUploadError("Filen er for stor (maks 250 MB)");
      return;
    }
    if (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) {
      setUploadError("Kun video- og lydfiler er tilladt");
      return;
    }
    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        onUploadProgress: ({ percentage }) => setUploadProgress(percentage),
      });
      if (file.type.startsWith("audio/")) {
        setPendingAudioUrl(blob.url);
      } else {
        await submitAnswerUrl(question.id, blob.url);
        setEditingAnswer(false);
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload fejlede");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function handlePhotoUpload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Billedet er for stort (maks 10 MB)");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setUploadError("Kun billedfiler er tilladt");
      return;
    }
    setUploadingPhoto(true);
    setUploadError(null);
    setPhotoProgress(0);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        onUploadProgress: ({ percentage }) => setPhotoProgress(percentage),
      });
      setPhotoUrl(blob.url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload fejlede");
    } finally {
      setUploadingPhoto(false);
      setPhotoProgress(0);
    }
  }

  async function handleSubmitAudioAnswer() {
    if (!pendingAudioUrl) return;
    if (editingAnswer) {
      const confirmed = confirm(
        `Er du sikker på at du vil sende dette opdateret svar ud til ${question.upvoteCount} ${question.upvoteCount === 1 ? "borger" : "borgere"}?`
      );
      if (!confirmed) return;
    }
    setSubmittingAnswer(true);
    try {
      await submitAnswerUrl(question.id, pendingAudioUrl, photoUrl ?? undefined);
      setPendingAudioUrl(null);
      setPhotoUrl(null);
      setEditingAnswer(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
    } finally {
      setSubmittingAnswer(false);
    }
  }

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
    <div className={`border rounded-lg p-4 ${question.pinned ? "border-amber-300 bg-amber-50" : "border-gray-200"}`}>
      <div className="flex items-start justify-between gap-2">
        <a
          href={`${basePath}/q/${question.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-gray-900 hover:text-blue-600 transition mb-1 block"
        >
          {question.text}
        </a>
        <button
          onClick={async () => {
            setPinning(true);
            try {
              await togglePinQuestion(question.id);
            } catch (e) {
              alert(e instanceof Error ? e.message : "Der opstod en fejl");
            } finally {
              setPinning(false);
            }
          }}
          disabled={pinning}
          className={`text-sm shrink-0 cursor-pointer disabled:opacity-50 ${
            question.pinned
              ? "text-amber-600 hover:text-amber-800"
              : "text-gray-400 hover:text-amber-600"
          }`}
        >
          {pinning ? "..." : question.pinned ? "Unpin" : "Pin"}
        </button>
      </div>
      {question.suggestedBy && (
        <p className="text-sm text-gray-500 mb-1">{question.suggestedBy}</p>
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
                  {isBlobUrl(question.answerUrl!) ? (
                    <p className="text-sm text-green-700">
                      {getBlobMediaType(question.answerUrl!) === "audio" ? "Lydfil" : "Video"} uploadet
                      {question.answerPhotoUrl && " (med billede)"}
                    </p>
                  ) : (
                    <a
                      href={question.answerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
                    >
                      {question.answerUrl}
                    </a>
                  )}
                </div>
                <button
                  onClick={() => {
                    const isLink = !isBlobUrl(question.answerUrl!);
                    setAnswerUrlInput(isLink ? question.answerUrl! : "");
                    setShowLinkInput(isLink);
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
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-amber-800 font-medium">
                  {editingAnswer ? "Opdatér dit svar" : "Målet er nået! Indsend dit svar (helst inden 24 timer)"}
                </p>
                {editingAnswer && (
                  <button
                    onClick={() => {
                      setEditingAnswer(false);
                      setAnswerUrlInput("");
                      setShowLinkInput(false);
                    }}
                    className="text-sm text-gray-600 hover:text-gray-800 cursor-pointer"
                  >
                    Annullér
                  </button>
                )}
              </div>
              {/* Render upload and link sections — order depends on whether editing a link answer */}
              {(() => {
                const linkFirst = editingAnswer && showLinkInput;

                const uploadSection = (
                  <div className={linkFirst ? "" : "mb-3"}>
                    {pendingAudioUrl ? (
                      <div className="space-y-3">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-sm text-green-800 font-medium">Lydfil klar til indsendelse</p>
                        </div>
                        <div>
                          <label className="block w-full border-2 border-dashed border-amber-300 rounded-lg p-4 text-center cursor-pointer hover:border-amber-400 transition">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handlePhotoUpload(file);
                              }}
                              disabled={uploadingPhoto || submittingAnswer}
                            />
                            <span className="text-sm text-amber-700">
                              Tilføj et billede af dig selv (valgfrit)
                            </span>
                          </label>
                          {uploadingPhoto && (
                            <div className="mt-2">
                              <div className="w-full bg-amber-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all"
                                  style={{ width: `${photoProgress}%` }}
                                />
                              </div>
                              <p className="text-xs text-amber-600 mt-1">
                                Uploader billede... {Math.round(photoProgress)}%
                              </p>
                            </div>
                          )}
                          {photoUrl && (
                            <div className="mt-2 flex items-center gap-2">
                              <img src={photoUrl} alt="Preview" className="w-16 h-16 rounded-lg object-cover" />
                              <button
                                type="button"
                                onClick={() => setPhotoUrl(null)}
                                className="text-xs text-red-600 hover:text-red-800 cursor-pointer"
                              >
                                Fjern billede
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={handleSubmitAudioAnswer}
                          disabled={submittingAnswer || uploadingPhoto}
                          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 cursor-pointer"
                        >
                          {submittingAnswer ? "Sender..." : `Indsend svar${photoUrl ? " med billede" : ""}`}
                        </button>
                      </div>
                    ) : (
                      <>
                        <label className="block w-full border-2 border-dashed border-amber-300 rounded-lg p-4 text-center cursor-pointer hover:border-amber-400 transition">
                          <input
                            type="file"
                            accept="video/*,audio/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file);
                            }}
                            disabled={uploading || submittingAnswer}
                          />
                          <span className="text-sm text-amber-700">
                            Upload video eller lydfil (maks 250 MB)
                          </span>
                        </label>
                        {uploading && (
                          <div className="mt-2">
                            <div className="w-full bg-amber-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                            <p className="text-xs text-amber-600 mt-1">
                              Uploader... {Math.round(uploadProgress)}%
                            </p>
                          </div>
                        )}
                      </>
                    )}
                    {uploadError && (
                      <p className="text-sm text-red-600 mt-2">{uploadError}</p>
                    )}
                  </div>
                );

                const linkSection = !showLinkInput ? (
                  <button
                    onClick={() => setShowLinkInput(true)}
                    className="text-sm text-amber-700 hover:text-amber-900 cursor-pointer underline"
                  >
                    Send svar fra YouTube eller Facebook
                  </button>
                ) : (
                  <div className={linkFirst ? "mb-3" : ""}>
                    <div className="flex flex-col sm:flex-row gap-2 mb-3">
                      <input
                        type="url"
                        placeholder="Link til video på YouTube eller Facebook..."
                        value={answerUrlInput}
                        onChange={(e) => setAnswerUrlInput(e.target.value)}
                        disabled={uploading}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <div className="flex gap-2">
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
                          disabled={submittingAnswer || uploading || !answerUrlInput || (isFacebookUrl(answerUrlInput) && !isFacebookVideoUrl(answerUrlInput)) || /linkedin\.com/i.test(answerUrlInput) || /\b(x\.com|twitter\.com)\b/i.test(answerUrlInput) || /instagram\.com/i.test(answerUrlInput)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
                        >
                          {submittingAnswer ? "Sender..." : editingAnswer ? "Opdatér svar" : "Indsend svar"}
                        </button>
                      </div>
                    </div>
                    {answerUrlInput && isFacebookUrl(answerUrlInput) && !isFacebookVideoUrl(answerUrlInput) && (
                      <p className="text-sm text-red-600 -mt-1 mb-2">
                        Kun Facebook video-links understøttes (f.eks. /watch, /videos/, /reel/ eller fb.watch)
                      </p>
                    )}
                    {answerUrlInput && /instagram\.com/i.test(answerUrlInput) && (
                      <p className="text-sm text-red-600 -mt-1 mb-2">
                        Instagram-links kan desværre ikke indlejres. Brug YouTube eller Facebook i stedet.
                      </p>
                    )}
                    {answerUrlInput && /\b(x\.com|twitter\.com)\b/i.test(answerUrlInput) && (
                      <p className="text-sm text-red-600 -mt-1 mb-2">
                        X/Twitter-links kan desværre ikke indlejres. Brug YouTube eller Facebook i stedet.
                      </p>
                    )}
                    {answerUrlInput && /linkedin\.com/i.test(answerUrlInput) && (
                      <p className="text-sm text-red-600 -mt-1 mb-2">
                        LinkedIn-links kan desværre ikke indlejres. Brug YouTube eller Facebook i stedet.
                      </p>
                    )}
                    {answerUrlInput && (getYouTubeVideoId(answerUrlInput) || isFacebookVideoUrl(answerUrlInput)) && (
                      <div className="mb-3 rounded-lg overflow-hidden border border-amber-200">
                        <p className="text-xs text-amber-700 font-medium px-3 py-1.5 bg-amber-100">
                          Preview
                        </p>
                        <AnswerPlayer answerUrl={answerUrlInput} />
                      </div>
                    )}
                  </div>
                );

                const separator = showLinkInput && (
                  <div className="flex items-center gap-2 my-3">
                    <div className="flex-1 border-t border-amber-300" />
                    <span className="text-xs text-amber-600">eller</span>
                    <div className="flex-1 border-t border-amber-300" />
                  </div>
                );

                return linkFirst ? (
                  <>{linkSection}{separator}{uploadSection}</>
                ) : (
                  <>{uploadSection}{separator}{linkSection}</>
                );
              })()}
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
