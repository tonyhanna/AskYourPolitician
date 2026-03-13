"use client";

import { useState, useEffect } from "react";
import { upload } from "@vercel/blob/client";
import { deleteQuestion, editQuestion, submitAnswerUrl, submitAnswerClipUrl, togglePinQuestion } from "@/app/politiker/dashboard/actions";
import { generateVideoClip } from "@/lib/clip-generator";
import { compressVideo } from "@/lib/video-compressor";
import { CopyLinkButton } from "./CopyLinkButton";
import { SuggestionList } from "./SuggestionList";
import { isBlobUrl, getBlobMediaType } from "@/lib/answer-utils";

/** Read duration + aspect ratio from a media file using a temporary element. */
function getMediaInfo(file: File): Promise<{ duration?: number; aspectRatio?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith("video/");
    const el = isVideo
      ? document.createElement("video")
      : document.createElement("audio");
    el.preload = "metadata";
    el.src = url;
    el.onloadedmetadata = () => {
      const d = el.duration;
      let ar: number | undefined;
      if (isVideo) {
        const v = el as HTMLVideoElement;
        if (v.videoWidth && v.videoHeight) {
          ar = v.videoWidth / v.videoHeight;
        }
      }
      URL.revokeObjectURL(url);
      resolve({
        duration: isFinite(d) && d > 0 ? d : undefined,
        aspectRatio: ar,
      });
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
  });
}

type Question = {
  id: string;
  text: string;
  upvoteGoal: number;
  upvoteCount: number;
  tags: string[];
  goalReached: boolean;
  goalReachedAt: string | null;
  deadlineMissed: boolean;
  answerUrl: string | null;
  answerPhotoUrl: string | null;
  suggestedBy: string | null;
  pinned: boolean;
};

type PendingSuggestion = {
  id: string;
  citizenFirstName: string;
  text: string;
  createdAt: string;
};

export function QuestionList({
  questions,
  availableTags,
  basePath,
  pendingSuggestions = [],
}: {
  questions: Question[];
  availableTags: { tagId: string; title: string }[];
  basePath: string;
  pendingSuggestions?: PendingSuggestion[];
}) {
  const missed = questions.filter((q) => q.goalReached && !q.answerUrl && q.deadlineMissed);
  const forUpvoting = questions.filter((q) => !q.goalReached && !q.answerUrl);
  const unanswered = questions.filter((q) => q.goalReached && !q.answerUrl && !q.deadlineMissed);
  const answered = questions.filter((q) => !!q.answerUrl);

  return (
    <div className="space-y-6">
      {pendingSuggestions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700">
            Spørgsmål til godkendelse
            <span className="ml-2 text-sm bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium align-middle">
              {pendingSuggestions.length}
            </span>
          </h3>
          <SuggestionList suggestions={pendingSuggestions} availableTags={availableTags} />
        </div>
      )}
      {missed.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-red-700">Missede spørgsmål</h3>
          {missed.map((q) => (
            <QuestionItem key={q.id} question={q} availableTags={availableTags} basePath={basePath} />
          ))}
        </div>
      )}
      {unanswered.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-amber-800">Ubesvarede spørgsmål</h3>
          {unanswered.map((q) => (
            <QuestionItem key={q.id} question={q} availableTags={availableTags} basePath={basePath} />
          ))}
        </div>
      )}
      {forUpvoting.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700">Spørgsmål til upvoting</h3>
          {forUpvoting.map((q) => (
            <QuestionItem key={q.id} question={q} availableTags={availableTags} basePath={basePath} />
          ))}
        </div>
      )}
      {answered.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-green-800">Besvarede spørgsmål</h3>
          {answered.map((q) => (
            <QuestionItem key={q.id} question={q} availableTags={availableTags} basePath={basePath} />
          ))}
        </div>
      )}
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
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [editingAnswer, setEditingAnswer] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set(question.tags));
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null);
  const [pendingDuration, setPendingDuration] = useState<number | undefined>(undefined);
  const [pendingAspectRatio, setPendingAspectRatio] = useState<number | undefined>(undefined);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [pinning, setPinning] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState(0);
  const [clipGenerating, setClipGenerating] = useState(false);
  const [clipError, setClipError] = useState<string | null>(null);
  const hasUpvotes = question.upvoteCount > 0;

  // Countdown timer for unanswered goal-reached questions
  const [hoursLeft, setHoursLeft] = useState<number | null>(() => {
    if (!question.goalReachedAt || question.answerUrl || question.deadlineMissed) return null;
    const deadline = new Date(question.goalReachedAt).getTime() + 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((deadline - Date.now()) / (1000 * 60 * 60)));
  });

  useEffect(() => {
    if (!question.goalReachedAt || question.answerUrl || question.deadlineMissed) return;
    const interval = setInterval(() => {
      const deadline = new Date(question.goalReachedAt!).getTime() + 24 * 60 * 60 * 1000;
      setHoursLeft(Math.max(0, Math.ceil((deadline - Date.now()) / (1000 * 60 * 60))));
    }, 60_000);
    return () => clearInterval(interval);
  }, [question.goalReachedAt, question.answerUrl, question.deadlineMissed]);

  async function handleFileUpload(file: File) {
    if (file.size > 500 * 1024 * 1024) {
      setUploadError("Filen er for stor (maks 500 MB)");
      return;
    }
    if (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) {
      setUploadError("Kun video- og lydfiler er tilladt");
      return;
    }

    setUploadError(null);

    // Read duration + aspect ratio from the original file before compression
    let duration: number | undefined;
    let aspectRatio: number | undefined;
    try {
      const info = await getMediaInfo(file);
      duration = info.duration;
      aspectRatio = info.aspectRatio;
    } catch {
      // Non-fatal — proceed without metadata
    }

    // Enforce portrait video — reject landscape and square
    if (file.type.startsWith("video/") && aspectRatio && aspectRatio >= 1) {
      setUploadError("Videoen skal være i portrait-format (9:16). Landscape- og kvadratiske videoer er ikke tilladt.");
      return;
    }

    // Compress video files before uploading (skip for audio)
    let fileToUpload = file;
    if (file.type.startsWith("video/")) {
      setCompressing(true);
      setCompressProgress(0);
      try {
        fileToUpload = await compressVideo(file, undefined, (p) => setCompressProgress(p));
      } catch (e) {
        console.error("Video compression failed, uploading original:", e);
        // Fall back to original file if compression fails
      } finally {
        setCompressing(false);
        setCompressProgress(0);
      }
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const folder = file.type.startsWith("audio/") ? "answers/sound" : "answers/video";
      const blob = await upload(`${folder}/${fileToUpload.name}`, fileToUpload, {
        access: "public",
        handleUploadUrl: "/api/upload",
        onUploadProgress: ({ percentage }) => setUploadProgress(percentage),
      });
      if (file.type.startsWith("audio/")) {
        setPendingAudioUrl(blob.url);
        setPendingDuration(duration);
        setPendingAspectRatio(aspectRatio);
      } else {
        await submitAnswerUrl(question.id, blob.url, undefined, duration, aspectRatio);
        setEditingAnswer(false);
        // Generate clip in background (non-blocking)
        generateClipInBackground(question.id, blob.url);
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
      // Read photo aspect ratio
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); });
      if (img.naturalWidth && img.naturalHeight) {
        const ar = img.naturalWidth / img.naturalHeight;
        if (ar >= 1) {
          URL.revokeObjectURL(img.src);
          setUploadError("Billedet skal være i portrait-format (3:4). Landscape- og kvadratiske billeder er ikke tilladt.");
          setUploadingPhoto(false);
          return;
        }
        setPendingAspectRatio(ar);
      }
      URL.revokeObjectURL(img.src);

      const blob = await upload(`answers/photo/${file.name}`, file, {
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

  async function generateClipInBackground(questionId: string, videoUrl: string) {
    setClipGenerating(true);
    setClipError(null);
    try {
      const clipFile = await generateVideoClip(videoUrl);
      if (!clipFile) {
        setClipGenerating(false);
        return; // Browser doesn't support MediaRecorder — skip silently
      }
      const clipBlob = await upload(`answers/clips/${clipFile.name}`, clipFile, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      await submitAnswerClipUrl(questionId, clipBlob.url);
    } catch (e) {
      console.error("Clip generation failed:", e);
      setClipError(e instanceof Error ? e.message : "Klip-generering fejlede");
    } finally {
      setClipGenerating(false);
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
      await submitAnswerUrl(question.id, pendingAudioUrl, photoUrl ?? undefined, pendingDuration, pendingAspectRatio);
      setPendingAudioUrl(null);
      setPendingDuration(undefined);
      setPendingAspectRatio(undefined);
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
    <div className={`border rounded-lg p-4 ${question.deadlineMissed ? "border-red-300 bg-red-50" : question.pinned ? "border-amber-300 bg-amber-50" : "border-gray-200"}`}>
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
        <p className="text-xs mb-1">
          <span className="px-2 py-0.5 rounded-full" style={{ color: "#000000", backgroundColor: "#FFFFFF" }}>
            {question.suggestedBy}
          </span>
        </p>
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
                  {clipGenerating && (
                    <p className="text-xs text-amber-600 mt-1">Genererer forhåndsvisning...</p>
                  )}
                  {clipError && (
                    <p className="text-xs text-red-500 mt-1">Forhåndsvisning fejlede: {clipError}</p>
                  )}
                </div>
                <button
                  onClick={() => setEditingAnswer(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap cursor-pointer"
                >
                  Redigér svar
                </button>
              </div>
            </div>
          ) : (
            <div className={`${question.deadlineMissed ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"} rounded-lg p-3`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-sm font-medium ${question.deadlineMissed ? "text-red-800" : "text-amber-800"}`}>
                  {editingAnswer
                    ? "Opdatér dit svar"
                    : question.deadlineMissed
                    ? "Fristen er udløbet! Indsend dit svar hurtigst muligt"
                    : hoursLeft !== null && hoursLeft > 0
                    ? `Målet er nået! Indsend dit svar (${hoursLeft}t tilbage)`
                    : hoursLeft === 0
                    ? "Fristen er udløbet! Indsend dit svar hurtigst muligt"
                    : "Målet er nået! Indsend dit svar (helst inden 24 timer)"}
                </p>
                {editingAnswer && (
                  <button
                    onClick={() => setEditingAnswer(false)}
                    className="text-sm text-gray-600 hover:text-gray-800 cursor-pointer"
                  >
                    Annullér
                  </button>
                )}
              </div>
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
                        Tilføj et billede af dig selv
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
                    disabled={submittingAnswer || uploadingPhoto || !photoUrl}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 cursor-pointer"
                  >
                    {submittingAnswer ? "Sender..." : photoUrl ? "Indsend svar med billede" : "Upload et billede for at indsende"}
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
                      Upload video eller lydfil (maks 500 MB)
                    </span>
                  </label>
                  {compressing && (
                    <div className="mt-2">
                      <div className="w-full bg-amber-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all"
                          style={{ width: `${compressProgress * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-amber-600 mt-1">
                        Komprimerer video... {Math.round(compressProgress * 100)}%
                      </p>
                    </div>
                  )}
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
