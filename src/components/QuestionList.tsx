"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { upload } from "@vercel/blob/client";
import { deleteQuestion, editQuestion, submitAnswerUrl, togglePinQuestion, updateAnswerPoster, getMuxUploadUrl, submitMuxAnswer, checkMuxAnswerStatus } from "@/app/politiker/dashboard/actions";
import { CopyLinkButton } from "./CopyLinkButton";
import { SuggestionList } from "./SuggestionList";
import { isBlobUrl } from "@/lib/answer-utils";

// ── Module-level store for submit steps ──────────────────────────────
// Lives outside React so it survives component remounts caused by
// server-action Router Cache invalidation moving questions between
// the "unanswered" → "answered" section (different tree positions).
type SubmitStep = "uploading" | "submitting" | "processing" | "done";
const _steps = new Map<string, SubmitStep>();
const _subs = new Set<() => void>();
function _notify() { _subs.forEach((fn) => fn()); }

const submitStepStore = {
  get: (id: string): SubmitStep | null => _steps.get(id) ?? null,
  set: (id: string, step: SubmitStep) => { _steps.set(id, step); _notify(); },
  clear: (id: string) => { _steps.delete(id); _notify(); },
  subscribe: (fn: () => void) => { _subs.add(fn); return () => { _subs.delete(fn); }; },
};

// Track whether a custom poster was used per question (survives remounts).
const _customPosterUsed = new Map<string, boolean>();
// Track poster-only updates (no new video) for correct progress labels.
const _posterOnlyUpdate = new Map<string, boolean>();
// Track whether the current submit is an audio answer (survives remounts).
const _isAudioSubmit = new Map<string, boolean>();

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
  answerClipUrl: string | null;
  suggestedBy: string | null;
  pinned: boolean;
  muxAssetId?: string | null;
  muxPlaybackId?: string | null;
  muxAssetStatus?: string | null;
  muxMediaType?: string | null;
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
  const hasAnswer = (q: typeof questions[number]) => !!q.answerUrl || !!q.muxAssetStatus;
  const missed = questions.filter((q) => q.goalReached && !hasAnswer(q) && q.deadlineMissed);
  const forUpvoting = questions.filter((q) => !q.goalReached && !hasAnswer(q));
  const unanswered = questions.filter((q) => q.goalReached && !hasAnswer(q) && !q.deadlineMissed);
  const answered = questions.filter((q) => hasAnswer(q));

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
  const [editingAnswer, setEditingAnswer] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set(question.tags));
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingDuration, setPendingDuration] = useState<number | undefined>(undefined);
  const [pendingAspectRatio, setPendingAspectRatio] = useState<number | undefined>(undefined);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [pinning, setPinning] = useState(false);

  const [clipError, setClipError] = useState<string | null>(null);
  // Operation counter — incremented on every new submit attempt.
  // Stale operations (from cancelled/restarted flows) compare their captured
  // opId against the current ref and bail out if they no longer match.
  const submitOpRef = useRef(0);
  // Submit step lives in a module-level store so it survives component
  // remounts caused by the question moving between dashboard sections.
  const submitStep = useSyncExternalStore(
    submitStepStore.subscribe,
    () => submitStepStore.get(question.id),
    () => null, // server snapshot — no active submissions during SSR
  );
  const [pendingPosterFile, setPendingPosterFile] = useState<File | null>(null);
  const [posterPreviewUrl, setPosterPreviewUrl] = useState<string | null>(null);
  const [showPosterUpload, setShowPosterUpload] = useState(false);
  const [removePoster, setRemovePoster] = useState(false);
  // Detect if current answer has a custom poster (vs auto-generated)
  const hasExistingCustomPoster = !!question.answerPhotoUrl && (!!question.answerUrl || !!question.muxAssetStatus);
  const isCurrentAnswerAudio = question.muxMediaType === "audio";
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

  async function handleFileSelect(file: File) {
    if (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) {
      setUploadError("Kun video- og lydfiler er tilladt");
      return;
    }

    setUploadError(null);

    // Read duration + aspect ratio from the original file
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

    // Just store the file — compression + upload happen when user clicks submit
    setPendingFile(file);
    setPendingDuration(duration);
    setPendingAspectRatio(aspectRatio);
  }

  /** Validate and store audio selfie file locally — actual upload deferred to submit flow. */
  async function handlePhotoSelect(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Billedet er for stort (maks 10 MB)");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setUploadError("Kun billedfiler er tilladt");
      return;
    }
    setUploadError(null);
    // Read photo aspect ratio
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); });
    if (img.naturalWidth && img.naturalHeight) {
      const ar = img.naturalWidth / img.naturalHeight;
      if (ar >= 1) {
        URL.revokeObjectURL(img.src);
        setUploadError("Billedet skal være i portrait-format (3:4). Landscape- og kvadratiske billeder er ikke tilladt.");
        return;
      }
      setPendingAspectRatio(ar);
    }
    URL.revokeObjectURL(img.src);
    // Compress non-JPEG to JPEG at 85% quality
    const { compressImageToJpeg } = await import("@/lib/image-utils");
    const compressed = await compressImageToJpeg(file, 0.85);
    // Revoke previous preview URL if replacing
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPendingPhotoFile(compressed);
    setPhotoPreviewUrl(URL.createObjectURL(compressed));
  }

  function clearPendingPhoto() {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPendingPhotoFile(null);
    setPhotoPreviewUrl(null);
  }

  /** Validate and store poster file locally — actual upload deferred to submit flow. */
  async function handlePosterSelect(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Billedet er for stort (maks 10 MB)");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setUploadError("Kun billedfiler er tilladt");
      return;
    }
    setUploadError(null);
    // Validate portrait aspect ratio
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); });
    if (img.naturalWidth && img.naturalHeight) {
      const ar = img.naturalWidth / img.naturalHeight;
      if (ar >= 1) {
        URL.revokeObjectURL(img.src);
        setUploadError("Billedet skal være i portrait-format (3:4). Landscape- og kvadratiske billeder er ikke tilladt.");
        return;
      }
    }
    URL.revokeObjectURL(img.src);
    // Compress non-JPEG to JPEG at 85% quality
    const { compressImageToJpeg } = await import("@/lib/image-utils");
    const compressed = await compressImageToJpeg(file, 0.85);
    // Revoke previous preview URL if replacing
    if (posterPreviewUrl) URL.revokeObjectURL(posterPreviewUrl);
    setPendingPosterFile(compressed);
    setPosterPreviewUrl(URL.createObjectURL(compressed));
  }

  function clearPendingPoster() {
    if (posterPreviewUrl) URL.revokeObjectURL(posterPreviewUrl);
    setPendingPosterFile(null);
    setPosterPreviewUrl(null);
    setShowPosterUpload(false);
  }

  async function handleSubmitAudioAnswer() {
    if (!pendingFile) return;
    if (editingAnswer) {
      const confirmed = confirm(
        `Er du sikker på at du vil sende dette opdateret svar ud til ${question.upvoteCount} ${question.upvoteCount === 1 ? "borger" : "borgere"}?`
      );
      if (!confirmed) return;
    }
    const file = pendingFile;
    const photoFile = pendingPhotoFile || pendingPosterFile;
    const questionId = question.id;
    _isAudioSubmit.set(questionId, true);
    try {
      // Step 1: Upload to Mux + poster to Blob in parallel
      submitStepStore.set(questionId, "uploading");
      setUploadProgress(0);
      const keepExistingAudioPoster = editingAnswer && !photoFile && !removePoster && hasExistingCustomPoster;

      const [muxUpload, photoBlobUrl] = await Promise.all([
        getMuxUploadUrl(questionId),
        photoFile
          ? upload(`answers/posters/${photoFile.name}`, photoFile, {
              access: "public",
              handleUploadUrl: "/api/upload",
            }).then((b) => b.url)
          : Promise.resolve(keepExistingAudioPoster ? question.answerPhotoUrl : null),
      ]);

      // PUT raw audio file directly to Mux
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", muxUpload.uploadUrl);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      // Step 2: Submit answer metadata
      submitStepStore.set(questionId, "submitting");
      await submitMuxAnswer(questionId, "audio", photoBlobUrl ?? undefined, pendingDuration, pendingAspectRatio);
      setPendingFile(null);
      setPendingDuration(undefined);
      setPendingAspectRatio(undefined);
      clearPendingPhoto();
      setEditingAnswer(false);
      submitStepStore.set(questionId, "processing");
      pollMuxStatus(questionId, () => { _isAudioSubmit.delete(questionId); });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
      submitStepStore.clear(questionId);
      _isAudioSubmit.delete(questionId);
    }
  }

  /** Handle poster-only changes (no new video) — scenarie A + B */
  async function handlePosterOnlyUpdate() {
    const questionId = question.id;

    submitOpRef.current++;
    const opId = submitOpRef.current;

    _posterOnlyUpdate.set(questionId, true);

    try {
      if (pendingPosterFile) {
        // Scenarie A: Upload new poster, keep video
        submitStepStore.set(questionId, "uploading");
        const posterBlob = await upload(`answers/posters/${pendingPosterFile.name}`, pendingPosterFile, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });

        if (opId !== submitOpRef.current) return;

        submitStepStore.set(questionId, "submitting");
        await updateAnswerPoster(questionId, posterBlob.url);
      } else if (removePoster) {
        // Scenarie B: Remove poster — for Mux answers, just clear poster (Mux auto-generates thumbnails).
        // For legacy blob answers, regenerate clip.
        submitStepStore.set(questionId, "submitting");
        await updateAnswerPoster(questionId, null);
      }

      clearPendingPoster();
      setRemovePoster(false);
      setEditingAnswer(false);
      submitStepStore.set(questionId, "done");
      setTimeout(() => { submitStepStore.clear(questionId); _posterOnlyUpdate.delete(questionId); }, 3000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
      submitStepStore.clear(questionId);
      _posterOnlyUpdate.delete(questionId);
    }
  }

  async function handleSubmitVideoAnswer() {
    if (!pendingFile) return;
    if (editingAnswer) {
      const confirmed = confirm(
        `Er du sikker på at du vil sende dette opdateret svar ud til ${question.upvoteCount} ${question.upvoteCount === 1 ? "borger" : "borgere"}?`
      );
      if (!confirmed) return;
    }
    const file = pendingFile;
    const questionId = question.id;
    const posterFile = pendingPosterFile;
    const duration = pendingDuration;
    const aspectRatio = pendingAspectRatio;
    const keepExistingPoster = editingAnswer && !posterFile && !removePoster && hasExistingCustomPoster;

    submitOpRef.current++;
    const opId = submitOpRef.current;

    try {
      // Step 1: Upload to Mux (no compression needed — Mux handles transcoding)
      submitStepStore.set(questionId, "uploading");
      setUploadProgress(0);

      // Get Mux direct upload URL + upload poster to Blob in parallel
      const [muxUpload, posterBlobUrl] = await Promise.all([
        getMuxUploadUrl(questionId),
        posterFile
          ? upload(`answers/posters/${posterFile.name}`, posterFile, {
              access: "public",
              handleUploadUrl: "/api/upload",
            }).then((b) => b.url)
          : Promise.resolve(null),
      ]);

      // PUT raw file directly to Mux's upload URL with progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", muxUpload.uploadUrl);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && opId === submitOpRef.current) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      if (opId !== submitOpRef.current) return;

      // Step 2: Submit answer metadata — Mux webhook will update status to "ready"
      submitStepStore.set(questionId, "submitting");
      const finalPosterUrl = posterBlobUrl ?? (keepExistingPoster ? question.answerPhotoUrl : null);
      await submitMuxAnswer(questionId, "video", finalPosterUrl ?? undefined, duration, aspectRatio);

      setPendingFile(null);
      setPendingDuration(undefined);
      setPendingAspectRatio(undefined);
      clearPendingPoster();
      setRemovePoster(false);
      setEditingAnswer(false);

      submitStepStore.set(questionId, "processing");
      pollMuxStatus(questionId, () => { _customPosterUsed.delete(questionId); });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
      submitStepStore.clear(questionId);
    }
  }

  /** Poll Mux processing status every 5s until ready, then refresh the page */
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function pollMuxStatus(questionId: string, onDone?: () => void) {
    // Don't start duplicate polling
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    async function check() {
      try {
        const status = await checkMuxAnswerStatus(questionId);
        if (status === "ready") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          submitStepStore.clear(questionId);
          onDone?.();
          // Use cache-busting reload to ensure fresh server data
          window.location.href = window.location.pathname + "?t=" + Date.now();
        } else if (status === "errored") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          submitStepStore.clear(questionId);
          onDone?.();
          alert("Der opstod en fejl under behandling af din video/lyd. Prøv venligst igen.");
        }
      } catch {
        // Network error — keep polling
      }
    }

    // Immediate first check, then every 5 seconds
    check();
    pollIntervalRef.current = setInterval(check, 5000);
  }

  // Auto-start polling whenever muxAssetStatus is "preparing" (covers both
  // initial submit flow and page refresh / revalidation scenarios)
  useEffect(() => {
    if (question.muxAssetStatus === "preparing") {
      pollMuxStatus(question.id);
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [question.muxAssetStatus]);

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
        {(question.answerUrl || question.muxAssetStatus === "ready") && (
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
        )}
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
          {submitStep && submitStep !== "done" ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="space-y-3">
                  {/* Steps shown as a checklist */}
                  {(() => {
                    const posterOnly = !!_posterOnlyUpdate.get(question.id);
                    if (posterOnly) {
                      return (["uploading", "submitting"] as const);
                    }
                    return (["uploading", "submitting", "processing"] as const);
                  })().map((step, _i, stepOrder) => {
                    const currentIdx = (stepOrder as readonly string[]).indexOf(submitStep);
                    const stepIdx = _i;
                    if (stepIdx > currentIdx) return null;
                    const isActive = step === submitStep;
                    const isPosterOnly = !!_posterOnlyUpdate.get(question.id);
                    const isAudio = !!_isAudioSubmit.get(question.id);
                    const uploadLabel = isPosterOnly
                      ? "Uploader poster-billede..."
                      : isAudio
                        ? `Uploader lyd... ${Math.round(uploadProgress)}%`
                        : `Uploader video... ${Math.round(uploadProgress)}%`;
                    const uploadDoneLabel = isPosterOnly
                      ? "Poster-billede uploadet"
                      : isAudio ? "Lyd uploadet" : "Video uploadet";
                    const labels: Record<string, [string, string]> = {
                      uploading: [uploadLabel, uploadDoneLabel],
                      submitting: [isPosterOnly ? "Opdaterer poster..." : "Indsender svar...", isPosterOnly ? "Poster opdateret" : "Svar indsendt"],
                      processing: [isAudio ? "Behandler lyd..." : "Behandler video...", isAudio ? "Lyd klar" : "Video klar"],
                    };
                    const [activeLabel, doneLabel] = labels[step];
                    return (
                      <div key={step} className="flex items-center gap-2">
                        {isActive ? (
                          <svg className="w-4 h-4 text-amber-600 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                        ) : (
                          <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        )}
                        <span className={`text-sm flex-1 ${isActive ? "text-amber-800 font-medium" : "text-green-800"}`}>
                          {isActive ? activeLabel : doneLabel}
                        </span>
                      </div>
                    );
                  })}
                  {/* Progress bar */}
                  <div className="w-full bg-amber-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-amber-500 h-2 rounded-full transition-all" style={{
                      width: submitStep === "uploading" ? `${Math.round(uploadProgress)}%`
                        : submitStep === "processing" ? "100%"
                        : "100%",
                    }} />
                  </div>
                  {submitStep === "processing" ? (
                    <div className="bg-amber-100 border border-amber-300 rounded-md px-3 py-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 110 18 9 9 0 010-18z" /></svg>
                      <p className="text-sm text-amber-800 font-medium">Din {_isAudioSubmit.get(question.id) ? "lyd" : "video"} behandles — du kan lukke browseren. Svaret offentliggøres automatisk.</p>
                    </div>
                  ) : (
                    <div className="bg-amber-100 border border-amber-300 rounded-md px-3 py-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 110 18 9 9 0 010-18z" /></svg>
                      <p className="text-sm text-amber-800 font-medium">Luk ikke browseren.</p>
                    </div>
                  )}
                </div>
              </div>
          ) : ((question.answerUrl || question.muxAssetStatus) && !editingAnswer) || submitStep === "done" ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-green-800 font-medium mb-1">Svar indsendt</p>
                  {question.muxAssetStatus ? (
                    <p className="text-sm text-green-700">
                      {question.muxMediaType === "audio" ? "Lydfil" : "Video"} {question.muxAssetStatus === "ready" ? "klar" : "behandles..."}
                      {question.answerPhotoUrl && " (med poster)"}
                    </p>
                  ) : question.answerUrl ? (
                    <a
                      href={question.answerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
                    >
                      {question.answerUrl}
                    </a>
                  ) : (
                    <p className="text-sm text-green-700">Video uploadet</p>
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
              {/* Edit mode: show current answer overview with granular edit options */}
              {editingAnswer && (question.answerUrl || question.muxAssetStatus) && !pendingFile ? (
                <div className="space-y-3">
                  {/* Current video */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-700">
                        {question.muxMediaType === "audio"
                          ? "Nuværende svar: Lydfil"
                          : "Nuværende svar: Video"}
                      </p>
                      <label className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                        <input
                          type="file"
                          accept="video/*,audio/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileSelect(file);
                          }}
                        />
                        Erstat
                      </label>
                    </div>
                  </div>
                  {/* Poster section */}
                  {posterPreviewUrl ? (
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      <img src={posterPreviewUrl} alt="Poster preview" className="w-12 h-12 rounded-lg object-cover" />
                      <span className="text-xs text-gray-600 flex-1">Nyt poster-billede valgt</span>
                      <button type="button" onClick={() => clearPendingPoster()} className="text-xs text-red-600 hover:text-red-800 cursor-pointer">Fjern</button>
                    </div>
                  ) : removePoster ? (
                    <div className="flex items-center justify-between bg-red-50 rounded-lg p-3">
                      <p className="text-sm text-red-700">Poster fjernes — auto-genereret clip bruges i stedet</p>
                      <button type="button" onClick={() => setRemovePoster(false)} className="text-xs text-gray-600 hover:text-gray-800 cursor-pointer">Fortryd</button>
                    </div>
                  ) : showPosterUpload ? (
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">Vælg eget poster-billede (portrait-format)</p>
                        <button type="button" onClick={() => setShowPosterUpload(false)} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Luk</button>
                      </div>
                      <label className="block w-full border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-gray-400 transition">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePosterSelect(file); }} />
                        <span className="text-sm text-gray-600">Vælg billede</span>
                      </label>
                    </div>
                  ) : hasExistingCustomPoster ? (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img src={question.answerPhotoUrl!} alt="Current poster" className="w-12 h-12 rounded-lg object-cover" />
                          <span className="text-xs text-gray-600">Eget poster-billede</span>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setShowPosterUpload(true)} className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">Ændre</button>
                          {!isCurrentAnswerAudio && (
                            <button type="button" onClick={() => setRemovePoster(true)} className="text-xs text-red-600 hover:text-red-800 cursor-pointer">Fjern</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowPosterUpload(true)} className="text-xs text-gray-500 hover:text-gray-700 underline cursor-pointer">
                      {question.answerPhotoUrl ? "Erstat poster-billede" : "Tilføj eget poster-billede"}
                    </button>
                  )}
                  {/* Submit button — only if something changed */}
                  {(pendingPosterFile || removePoster) && (
                    <button
                      onClick={handlePosterOnlyUpdate}
                      className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium cursor-pointer"
                    >
                      {pendingPosterFile ? "Gem poster-ændring" : "Fjern poster"}
                    </button>
                  )}
                </div>
              ) : pendingFile && pendingFile.type.startsWith("video/") ? (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-green-800 font-medium">Video klar til indsendelse</p>
                      <button
                        type="button"
                        onClick={() => { clearPendingPoster(); setRemovePoster(false); setPendingFile(null); setPendingDuration(undefined); setPendingAspectRatio(undefined); }}
                        className="text-xs text-red-600 hover:text-red-800 cursor-pointer"
                      >
                        Fjern
                      </button>
                    </div>
                  </div>
                  {/* Collapsible poster upload */}
                  {posterPreviewUrl ? (
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      <img src={posterPreviewUrl} alt="Poster preview" className="w-12 h-12 rounded-lg object-cover" />
                      <span className="text-xs text-gray-600 flex-1">Eget poster-billede valgt</span>
                      <button type="button" onClick={() => clearPendingPoster()} className="text-xs text-red-600 hover:text-red-800 cursor-pointer">Fjern</button>
                    </div>
                  ) : showPosterUpload ? (
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">Vælg eget poster-billede (portrait-format)</p>
                        <button type="button" onClick={() => setShowPosterUpload(false)} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Luk</button>
                      </div>
                      <label className="block w-full border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-gray-400 transition">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePosterSelect(file); }} />
                        <span className="text-sm text-gray-600">Vælg billede</span>
                      </label>
                    </div>
                  ) : editingAnswer && hasExistingCustomPoster && !removePoster ? (
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      <img src={question.answerPhotoUrl!} alt="Current poster" className="w-10 h-10 rounded-lg object-cover" />
                      <span className="text-xs text-gray-600 flex-1">Beholder eksisterende poster</span>
                      <button type="button" onClick={() => setShowPosterUpload(true)} className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">Ændre</button>
                      <button type="button" onClick={() => setRemovePoster(true)} className="text-xs text-red-600 hover:text-red-800 cursor-pointer">Fjern</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowPosterUpload(true)} className="text-xs text-gray-500 hover:text-gray-700 underline cursor-pointer">
                      Tilføj eget poster-billede (valgfrit)
                    </button>
                  )}
                  <button
                    onClick={handleSubmitVideoAnswer}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 cursor-pointer"
                  >
                    {editingAnswer
                      ? (pendingPosterFile ? "Erstat video (med ny poster)" : (hasExistingCustomPoster && !removePoster) ? "Erstat video (behold poster)" : "Erstat video")
                      : (pendingPosterFile ? "Indsend video med poster" : "Indsend video")}
                  </button>
                </div>
              ) : pendingFile && pendingFile.type.startsWith("audio/") ? (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-green-800 font-medium">Lydfil klar til indsendelse</p>
                      <button
                        type="button"
                        onClick={() => { setPendingFile(null); setPendingDuration(undefined); setPendingAspectRatio(undefined); clearPendingPhoto(); }}
                        className="text-xs text-red-600 hover:text-red-800 cursor-pointer"
                      >
                        Fjern
                      </button>
                    </div>
                  </div>
                  <div>
                    {(photoPreviewUrl || posterPreviewUrl) ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <img src={(photoPreviewUrl || posterPreviewUrl)!} alt="Preview" className="w-12 h-12 rounded-lg object-cover" />
                          <span className="text-xs text-green-800 flex-1">Nyt poster-billede valgt</span>
                          <button
                            type="button"
                            onClick={() => { clearPendingPhoto(); clearPendingPoster(); }}
                            className="text-xs text-red-600 hover:text-red-800 cursor-pointer"
                          >
                            Fjern
                          </button>
                        </div>
                      </div>
                    ) : editingAnswer && hasExistingCustomPoster ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <img src={question.answerPhotoUrl!} alt="Current poster" className="w-12 h-12 rounded-lg object-cover" />
                          <span className="text-xs text-green-800 flex-1">Beholder eksisterende poster</span>
                          <label className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                            Ændre
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoSelect(f); }} />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <label className="block w-full border-2 border-dashed border-amber-300 rounded-lg p-4 text-center cursor-pointer hover:border-amber-400 transition">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoSelect(file);
                          }}
                        />
                        <span className="text-sm text-amber-700">
                          Tilføj eget poster-billede (portrait-format)
                        </span>
                      </label>
                    )}
                  </div>
                  <button
                    onClick={handleSubmitAudioAnswer}
                    disabled={!pendingPhotoFile && !(editingAnswer && hasExistingCustomPoster)}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 cursor-pointer"
                  >
                    {pendingPhotoFile
                      ? (editingAnswer ? "Erstat med lyd (ny poster)" : "Indsend lyd med poster")
                      : editingAnswer && hasExistingCustomPoster
                        ? "Erstat med lyd (behold poster)"
                        : "Tilføj en poster for at indsende"}
                  </button>
                </div>
              ) : (
                <label className="block w-full border-2 border-dashed border-amber-300 rounded-lg p-4 text-center cursor-pointer hover:border-amber-400 transition">
                  <input
                    type="file"
                    accept="video/*,audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />
                  <span className="text-sm text-amber-700">
                    Upload video eller lydfil
                  </span>
                </label>
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

// ── Inline poster upload with drop zone, compression, and progress ──

function PosterUploadInline({ questionId }: { questionId: string }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      alert("Kun billedfiler er tilladt");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      // Compress non-JPEG to JPEG at 85% quality
      const { compressImageToJpeg } = await import("@/lib/image-utils");
      const compressed = await compressImageToJpeg(file, 0.85);
      setProgress(20);

      const blob = await upload(`answers/posters/${compressed.name}`, compressed, {
        access: "public",
        handleUploadUrl: "/api/upload",
        onUploadProgress: ({ percentage }) => setProgress(20 + percentage * 0.7),
      });
      setProgress(95);
      await updateAnswerPoster(questionId, blob.url);
      setProgress(100);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Der opstod en fejl");
    } finally {
      setUploading(false);
    }
  }

  if (uploading) {
    return (
      <div className="mt-2">
        <div className="flex items-center gap-2 text-xs text-amber-700">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Uploader poster... {Math.round(progress)}%
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1 overflow-hidden">
          <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  return (
    <label
      className={`mt-2 flex items-center justify-center border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors ${
        isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <span className="text-xs text-gray-500">Tilføj poster-billede (træk eller klik)</span>
    </label>
  );
}
