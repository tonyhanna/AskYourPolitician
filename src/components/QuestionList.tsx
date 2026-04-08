"use client";

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { deleteQuestion, editQuestion, submitAnswerUrl, togglePinQuestion, updateAnswerPoster, getMuxUploadUrl, submitMuxAnswer, checkMuxAnswerStatus } from "@/app/politiker/dashboard/actions";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUp, faXmark, faPlay } from "@fortawesome/free-solid-svg-icons";
import { faHourglass, faShare, faPen, faTrash, faAlarmExclamation } from "@fortawesome/pro-duotone-svg-icons";
import { faStarOfLife as faStarOfLifeSolid, faReply } from "@fortawesome/pro-solid-svg-icons";
import { faStarOfLifeRegular } from "@/lib/custom-icons";
import { faCopy } from "@fortawesome/free-solid-svg-icons";
import { useShareCopy } from "@/hooks/useShareCopy";
import { CopyLinkButton } from "./CopyLinkButton";
import { SuggestionList } from "./SuggestionList";
import { PlayableMediaCard } from "./PlayableMediaCard";
import { getMuxThumbnailUrl } from "@/lib/mux";
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
  answerDuration?: number | null;
  createdAt: string;
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
  const [playingId, setPlayingId] = useState<string | null>(null);
  const hasAnswer = (q: typeof questions[number]) => !!q.answerUrl || !!q.muxAssetStatus;
  const missed = questions.filter((q) => q.goalReached && !hasAnswer(q) && q.deadlineMissed);
  const forUpvoting = questions.filter((q) => !q.goalReached && !hasAnswer(q));
  const unanswered = questions.filter((q) => q.goalReached && !hasAnswer(q) && !q.deadlineMissed);
  const answered = questions.filter((q) => hasAnswer(q));

  // Sort pinned to top within each group
  const allUnanswered = [...missed, ...unanswered];
  const unansweredPinned = allUnanswered.filter((q) => q.pinned);
  const unansweredNotPinned = allUnanswered.filter((q) => !q.pinned);
  const forUpvotingPinned = forUpvoting.filter((q) => q.pinned);
  const forUpvotingNotPinned = forUpvoting.filter((q) => !q.pinned);
  const answeredPinned = answered.filter((q) => q.pinned);
  const answeredNotPinned = answered.filter((q) => !q.pinned);

  const hasCol1Content = pendingSuggestions.length > 0 || allUnanswered.length > 0 || forUpvoting.length > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Column 1: Suggestions + Unanswered */}
      <div className="space-y-6">
        {pendingSuggestions.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: "var(--system-text2, #FF0000)", fontFamily: "var(--font-figtree)" }}>
              Til godkendelse
              <span className="ml-2 text-xs font-medium align-middle inline-flex items-center justify-center rounded-full" style={{ width: 22, height: 22, backgroundColor: "var(--system-pending, #FF0000)", color: "var(--system-pending-contrast, #FF0000)", fontFamily: "var(--font-figtree)", fontWeight: 600, position: "relative", top: -1 }}>
                {pendingSuggestions.length}
              </span>
            </h3>
            <SuggestionList suggestions={pendingSuggestions} availableTags={availableTags} />
          </div>
        )}
        {allUnanswered.length > 0 ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: "var(--system-text2, #FF0000)", fontFamily: "var(--font-figtree)" }}>
              Ubesvaret
              <span className="ml-2 text-xs font-medium align-middle inline-flex items-center justify-center rounded-full" style={{ width: 22, height: 22, backgroundColor: "var(--system-error, #FF0000)", color: "var(--system-error-contrast, #FF0000)", fontFamily: "var(--font-figtree)", fontWeight: 600, position: "relative", top: -1 }}>
                {allUnanswered.length}
              </span>
            </h3>
            {unansweredPinned.map((q) => (
              <QuestionItem key={q.id} question={q} availableTags={availableTags} basePath={basePath} playingId={playingId} setPlayingId={setPlayingId} />
            ))}
            {unansweredPinned.length > 0 && unansweredNotPinned.length > 0 && (
              <hr style={{ borderTop: "1px solid var(--system-bg2, #FF0000)" }} />
            )}
            {unansweredNotPinned.map((q) => (
              <QuestionItem key={q.id} question={q} availableTags={availableTags} basePath={basePath} playingId={playingId} setPlayingId={setPlayingId} />
            ))}
          </div>
        ) : null}
        {forUpvoting.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: "var(--system-text2, #FF0000)", fontFamily: "var(--font-figtree)" }}>
              Til upvote
              <span className="ml-2 text-xs font-medium align-middle inline-flex items-center justify-center rounded-full" style={{ width: 22, height: 22, backgroundColor: "var(--system-success, #FF0000)", color: "var(--system-success-contrast, #FF0000)", fontFamily: "var(--font-figtree)", fontWeight: 600, position: "relative", top: -1 }}>
                {forUpvoting.length}
              </span>
            </h3>
            {forUpvotingPinned.map((q) => (
              <QuestionItem key={q.id} question={q} availableTags={availableTags} basePath={basePath} playingId={playingId} setPlayingId={setPlayingId} />
            ))}
            {forUpvotingPinned.length > 0 && forUpvotingNotPinned.length > 0 && (
              <hr style={{ borderTop: "1px solid var(--system-bg2, #FF0000)" }} />
            )}
            {forUpvotingNotPinned.map((q) => (
              <QuestionItem key={q.id} question={q} availableTags={availableTags} basePath={basePath} playingId={playingId} setPlayingId={setPlayingId} />
            ))}
          </div>
        )}
        {!hasCol1Content && (
          <div className="py-12 text-center" style={{ color: "var(--system-text2, #FF0000)" }}>
            <p className="text-sm" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500 }}>Ingen spørgsmål endnu</p>
          </div>
        )}
      </div>

      {/* Column 2: Answered */}
      <div className="space-y-4">
        {answered.length > 0 ? (
          <>
            <h3 className="text-lg font-semibold" style={{ color: "var(--system-text2, #FF0000)", fontFamily: "var(--font-figtree)" }}>Besvaret</h3>
            {answeredPinned.map((q) => (
              <QuestionItem key={q.id} question={q} availableTags={availableTags} basePath={basePath} playingId={playingId} setPlayingId={setPlayingId} />
            ))}
            {answeredPinned.length > 0 && answeredNotPinned.length > 0 && (
              <hr style={{ borderTop: "1px solid var(--system-bg2, #FF0000)" }} />
            )}
            {answeredNotPinned.map((q) => (
              <QuestionItem key={q.id} question={q} availableTags={availableTags} basePath={basePath} playingId={playingId} setPlayingId={setPlayingId} />
            ))}
          </>
        ) : (
          <div className="py-12 text-center" style={{ color: "var(--system-text2, #FF0000)" }}>
            <p className="text-sm" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500 }}>Ingen besvarede spørgsmål</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AlarmTooltipButton() {
  const [show, setShow] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const flippedRef = useRef(false);

  // Dismiss on outside tap (mobile)
  useEffect(() => {
    if (!show) return;
    const handler = (e: TouchEvent | MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShow(false);
    };
    document.addEventListener("touchstart", handler, { capture: true });
    document.addEventListener("mousedown", handler, { capture: true });
    return () => {
      document.removeEventListener("touchstart", handler, { capture: true });
      document.removeEventListener("mousedown", handler, { capture: true });
    };
  }, [show]);

  const handleShow = () => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      flippedRef.current = rect.top < 200;
    }
    setShow(true);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className="rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer"
        style={{ height: 40, width: 40, backgroundColor: "var(--system-bg0, #FF0000)" }}
        onMouseEnter={handleShow}
        onMouseLeave={() => setShow(false)}
        onClick={() => { if (show) setShow(false); else handleShow(); }}
      >
        <FontAwesomeIcon icon={faAlarmExclamation} style={{ color: "var(--system-error, #FF0000)", fontSize: 16 }} />
      </div>
      {show && (
        <div
          className={`absolute right-0 rounded-xl px-4 py-3 ${flippedRef.current ? "" : "bottom-full mb-2"}`}
          style={{
            ...(flippedRef.current ? { top: "100%", marginTop: 8 } : {}),
            backgroundColor: "color-mix(in srgb, var(--system-error, #FF0000) 75%, transparent)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            fontFamily: "var(--font-figtree)",
            fontWeight: 500,
            fontSize: 14,
            color: "var(--system-error-contrast, #FF0000)",
            whiteSpace: "nowrap",
            zIndex: 30,
            pointerEvents: "none",
          }}
        >
          24-timers deadline er overskredet
        </div>
      )}
    </div>
  );
}

function MiniVideoThumb({ photoUrl, muxPlaybackId, onClick }: { photoUrl: string | null; muxPlaybackId: string; onClick: () => void }) {
  const [hovering, setHovering] = useState(false);
  const canHover = useRef(false);
  useEffect(() => { canHover.current = window.matchMedia("(hover: hover)").matches; }, []);

  return (
    <div
      className="flex-shrink-0 pt-1 relative cursor-pointer"
      style={{ width: 60 }}
      onClick={onClick}
      onPointerEnter={() => { if (canHover.current) setHovering(true); }}
      onPointerLeave={() => { if (canHover.current) setHovering(false); }}
    >
      <div style={{ aspectRatio: "3/4", borderRadius: 12, overflow: "hidden", position: "relative" }}>
        <img
          src={photoUrl || getMuxThumbnailUrl(muxPlaybackId, { width: 200 })}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark hover overlay */}
        <div
          className="absolute inset-0 transition-opacity duration-200"
          style={{ zIndex: 1, opacity: hovering ? 0.2 : 0, backgroundColor: "var(--system-overlay, #FF0000)", pointerEvents: "none" }}
        />
        {/* Centered play button */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 2, pointerEvents: "none" }}>
          <div className="absolute inset-0 rounded-full transition-opacity duration-200" style={{ width: 40, height: 40, margin: "auto", backgroundColor: "var(--party-primary, #FF0000)", opacity: hovering ? 1 : 0.75 }} />
          <FontAwesomeIcon icon={faPlay} className="relative" style={{ color: "var(--party-dark, #FF0000)", fontSize: 14, marginLeft: 1 }} />
        </div>
      </div>
    </div>
  );
}

function QuestionItem({
  question,
  availableTags,
  basePath,
  playingId,
  setPlayingId,
}: {
  question: Question;
  availableTags: { tagId: string; title: string }[];
  basePath: string;
  playingId: string | null;
  setPlayingId: (id: string | null) => void;
}) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const { copied, handleShare } = useShareCopy(`${basePath}/q/${question.id}`, question.text);
  const [pinHover, setPinHover] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const editTextRef = useRef<HTMLTextAreaElement>(null);
  const [saving, setSaving] = useState(false);
  const [editingAnswer, setEditingAnswer] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
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
  const calcTimeLeft = useCallback(() => {
    if (!question.goalReachedAt || question.answerUrl || question.deadlineMissed) return null;
    const deadline = new Date(question.goalReachedAt).getTime() + 24 * 60 * 60 * 1000;
    const ms = Math.max(0, deadline - Date.now());
    const h = Math.floor(ms / (1000 * 60 * 60));
    const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return { hours: h, minutes: m, total: ms };
  }, [question.goalReachedAt, question.answerUrl, question.deadlineMissed]);

  const [timeLeft, setTimeLeft] = useState(calcTimeLeft);
  const hoursLeft = timeLeft ? timeLeft.hours : null;

  useEffect(() => {
    if (!question.goalReachedAt || question.answerUrl || question.deadlineMissed) return;
    const interval = setInterval(() => setTimeLeft(calcTimeLeft()), 60_000);
    return () => clearInterval(interval);
  }, [calcTimeLeft, question.goalReachedAt, question.answerUrl, question.deadlineMissed]);

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
      // Polling is handled automatically by useEffect when muxAssetStatus="preparing"
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
      // Polling is handled automatically by useEffect when muxAssetStatus="preparing"
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
      submitStepStore.clear(questionId);
    }
  }

  /** Poll Mux processing status until ready, then refresh server data.
   *  Self-contained useEffect — survives router.refresh() remounts cleanly.
   *  Each QuestionItem with muxAssetStatus="preparing" runs its own independent poll. */
  const router = useRouter();

  useEffect(() => {
    if (question.muxAssetStatus !== "preparing") return;

    let active = true;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    async function check() {
      if (!active) return;
      try {
        const status = await checkMuxAnswerStatus(question.id);
        if (!active) return;
        if (status === "ready") {
          submitStepStore.clear(question.id);
          _isAudioSubmit.delete(question.id);
          _customPosterUsed.delete(question.id);
          router.refresh();
          return;
        } else if (status === "errored") {
          submitStepStore.clear(question.id);
          alert("Der opstod en fejl under behandling af din video/lyd. Prøv venligst igen.");
          return;
        }
      } catch {
        // Network error — keep polling
      }
      if (active) {
        timeout = setTimeout(check, 5000);
      }
    }

    // Immediate first check
    check();

    // Re-check immediately when tab becomes visible (iOS throttles timers)
    function handleVisibility() {
      if (document.visibilityState === "visible" && active) {
        if (timeout) { clearTimeout(timeout); timeout = null; }
        check();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      if (timeout) clearTimeout(timeout);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [question.muxAssetStatus, question.id, router]);

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
      if (prev.has(tagId)) return new Set();
      return new Set([tagId]);
    });
  }

  async function handleSave(formData: FormData) {
    setSaving(true);
    try {
      formData.set("questionId", question.id);
      formData.set("text", editTextRef.current?.value ?? question.text);
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
      <div className="rounded-lg" style={{ backgroundColor: "var(--system-bg2, #FF0000)" }}>
        <div style={{ padding: "20px 20px 16px" }}>
          <textarea
            ref={editTextRef}
            defaultValue={question.text}
            maxLength={300}
            required
            rows={3}
            className="w-full mb-1 rounded-lg px-3 py-2 resize-none"
            style={{ fontSize: 22, lineHeight: 1.3, fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-form-text0, #FF0000)", backgroundColor: "var(--system-form-bg, #FF0000)", border: "none", outline: "none" }}
          />
          {question.suggestedBy && (
            <div style={{ marginTop: 4 }}>
              <span style={{
                display: "inline-block", fontSize: 12, lineHeight: 1.3,
                backgroundColor: "var(--system-bg0, #FF0000)",
                padding: "2px 4px",
                fontFamily: "var(--font-figtree)", fontWeight: 400,
              }}>
                <span style={{ color: "var(--system-text0, #FF0000)" }}>{question.suggestedBy}</span>
                <span style={{ color: "var(--system-text2, #FF0000)" }}> — {new Date(question.createdAt).toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
              </span>
            </div>
          )}
        </div>
        <form action={handleSave} style={{ borderTop: "1px solid var(--system-bg2, #FF0000)" }}>
          <div style={{ padding: "12px 20px 0" }}>
            <label htmlFor={`goal-${question.id}`} className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
              Upvote-mål
            </label>
            <input
              id={`goal-${question.id}`}
              name="upvoteGoal"
              type="number"
              defaultValue={question.upvoteGoal}
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
              onClick={() => { setSelectedTags(new Set(question.tags)); setEditing(false); }}
              className="text-sm cursor-pointer px-3 py-1.5 hover:opacity-50 transition-opacity"
              style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
            >
              Annullér
            </button>
            <button
              type="submit"
              disabled={saving}
              className="group text-sm px-4 py-1.5 rounded-full disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, backgroundColor: "var(--system-success, #FF0000)", color: "var(--system-success-contrast, #FF0000)" }}
            >
              <span className="group-hover:opacity-50 transition-opacity">{saving ? "Gemmer..." : "Gem ændringer"}</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg"
      style={{
        backgroundColor: "var(--system-bg1, #FF0000)",
      }}
    >
      {/* Top section — matches citizen page card layout */}
      <div className="flex items-stretch" style={{ padding: "16px 20px", gap: (question.answerUrl || question.muxAssetStatus) && question.muxPlaybackId ? 40 : 20 }}>
        {/* Text + suggestedBy + share + tags */}
        <div className="flex-1 min-w-0 flex flex-col">
          <a
            href={`${basePath}/q/${question.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none", ...((question.answerUrl || question.muxAssetStatus) ? { marginTop: 4, display: "block" } : {}) }}
          >
            <span style={{
              fontSize: 22,
              lineHeight: 1.3,
              color: (question.answerUrl || question.muxAssetStatus) ? "var(--party-light, #FF0000)" : "var(--system-text0, #FF0000)",
              fontFamily: "var(--font-figtree)",
              fontWeight: 500,
              ...((question.answerUrl || question.muxAssetStatus) ? {
                backgroundColor: "var(--party-dark, #FF0000)",
                boxDecorationBreak: "clone" as const,
                WebkitBoxDecorationBreak: "clone" as const,
                padding: "2px 8px",
              } : {}),
            }}>
              {question.text}
            </span>
          </a>
          {question.suggestedBy && (
            <div style={{ marginTop: 4 }}>
              <span style={{
                display: "inline-block", fontSize: 12, lineHeight: 1.3,
                backgroundColor: "var(--system-bg0, #FF0000)",
                padding: (question.answerUrl || question.muxAssetStatus) ? "2px 8px" : "2px 4px",
                fontFamily: "var(--font-figtree)", fontWeight: 400,
              }}>
                <span style={{ color: "var(--system-text0, #FF0000)" }}>{question.suggestedBy}</span>
                <span style={{ color: "var(--system-text2, #FF0000)" }}> — {new Date(question.createdAt).toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
              </span>
            </div>
          )}
          {/* Share + tags row */}
          <div className="flex items-center gap-2 mt-auto" style={{ paddingTop: 20 }}>
            <button
              onClick={handleShare}
              className="group cursor-pointer rounded-full flex items-center justify-center flex-shrink-0 relative"
              style={{ height: 24, width: 24, backgroundColor: "var(--party-primary, #FF0000)" }}
              aria-label="Del"
            >
              <span className="absolute inset-0 flex items-center justify-center" style={{ opacity: copied ? 0 : 1, transition: "opacity 300ms ease" }}>
                <FontAwesomeIcon icon={faShare} className="group-hover:opacity-50 transition-opacity" style={{ color: "var(--party-dark, #FF0000)", fontSize: "13.5px" }} />
              </span>
              <span className="absolute inset-0 flex items-center justify-center" style={{ opacity: copied ? 1 : 0, transition: "opacity 300ms ease" }}>
                <FontAwesomeIcon icon={faCopy} className="group-hover:opacity-50 transition-opacity" style={{ color: "var(--party-dark, #FF0000)", fontSize: "13.5px" }} />
              </span>
            </button>
            {question.tags.map((tag) => (
              <span key={tag} className="text-xs px-2.5 py-1 rounded-full"
                style={{ backgroundColor: "var(--party-dark, #FF0000)", color: "var(--party-light, #FF0000)", fontFamily: "var(--font-figtree)", fontWeight: 500 }}>
                {tag}
              </span>
            ))}
          </div>
          {/* Mobile: expanded player below share row (only rendered on mobile) */}
          {playingId === question.id && question.muxPlaybackId && isMobile && (
            <div style={{ paddingTop: 16 }}>
              <PlayableMediaCard
                question={{
                  id: question.id,
                  answerPhotoUrl: question.answerPhotoUrl,
                  answerDuration: question.answerDuration ?? null,
                  muxPlaybackId: question.muxPlaybackId,
                  muxAssetStatus: question.muxAssetStatus ?? null,
                  muxMediaType: question.muxMediaType ?? null,
                }}
                bufferingColor="var(--party-light, #FF0000)"
                playingId={playingId}
                setPlayingId={setPlayingId}
                className="w-full"
                autoPlay
              />
            </div>
          )}
        </div>
        {/* Right side: mini thumbnail / expanded player for answered, upvote icon for unanswered */}
        {(question.answerUrl || question.muxAssetStatus) && question.muxPlaybackId ? (
          playingId === question.id && !isMobile ? (
            /* Desktop: expanded player in right column */
            <div className="flex-shrink-0 pt-1">
              <PlayableMediaCard
                question={{
                  id: question.id,
                  answerPhotoUrl: question.answerPhotoUrl,
                  answerDuration: question.answerDuration ?? null,
                  muxPlaybackId: question.muxPlaybackId,
                  muxAssetStatus: question.muxAssetStatus ?? null,
                  muxMediaType: question.muxMediaType ?? null,
                }}
                bufferingColor="var(--party-light, #FF0000)"
                playingId={playingId}
                setPlayingId={setPlayingId}
                className="w-[337px]"
                autoPlay
              />
            </div>
          ) : (
            /* Mini thumbnail */
            <MiniVideoThumb
              photoUrl={question.answerPhotoUrl}
              muxPlaybackId={question.muxPlaybackId!}
              onClick={() => setPlayingId(question.id)}
            />
          )
        ) : (
          <div className="flex-shrink-0 pt-1">
            <div
              className="rounded-full flex items-center justify-center opacity-50"
              style={{
                width: 40, height: 40,
                backgroundColor: question.goalReached
                  ? "color-mix(in srgb, var(--system-pending, #FF0000) 50%, transparent)"
                  : "var(--party-primary, #FF0000)",
              }}
            >
              {question.goalReached ? (
                <FontAwesomeIcon icon={faHourglass} style={{ color: "var(--system-pending-contrast, #FF0000)", fontSize: 21 }} />
              ) : (
                <FontAwesomeIcon icon={faArrowUp} style={{ color: "var(--party-dark, #FF0000)", fontSize: 21 }} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dashboard controls — below separator */}
      <div style={{ borderTop: "1px solid var(--system-bg2, #FF0000)", padding: "12px 10px" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: 10 }}>
            <button
              onClick={async () => {
                setPinning(true);
                setPinHover(false);
                try { await togglePinQuestion(question.id); }
                catch (e) { alert(e instanceof Error ? e.message : "Der opstod en fejl"); }
                finally { setPinning(false); }
              }}
              disabled={pinning}
              onMouseEnter={() => setPinHover(true)}
              onMouseLeave={() => setPinHover(false)}
              className="cursor-pointer rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-50"
              style={{
                height: 40, width: 40,
                backgroundColor: "var(--system-bg0, #FF0000)",
              }}
              aria-label={question.pinned ? "Unpin" : "Pin"}
            >
              <FontAwesomeIcon
                icon={pinHover
                  ? (question.pinned ? faStarOfLifeRegular : faStarOfLifeSolid)
                  : (question.pinned ? faStarOfLifeSolid : faStarOfLifeRegular)}
                style={{
                  color: (pinHover ? !question.pinned : question.pinned)
                    ? "var(--system-icon0, #FF0000)"
                    : "var(--system-icon2, #FF0000)",
                  fontSize: 16,
                }}
              />
            </button>
            <span className="text-sm" style={{ color: "var(--system-text2, #FF0000)", fontFamily: "var(--font-figtree)" }}>
              {question.upvoteCount} / {question.upvoteGoal} {question.upvoteGoal === 1 ? "upvote" : "upvotes"}
            </span>
          </div>
          <div className="flex items-center" style={{ gap: 15 }}>
            {!hasUpvotes && (
              <div className="flex items-center" style={{ gap: 5 }}>
                <button
                  onClick={() => setEditing(true)}
                  className="group cursor-pointer rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ height: 40, width: 40, backgroundColor: "var(--system-bg0, #FF0000)" }}
                  aria-label="Redigér"
                >
                  <FontAwesomeIcon icon={faPen} className="group-hover:opacity-50 transition-opacity" style={{ color: "var(--system-success, #FF0000)", fontSize: 16 }} />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="group cursor-pointer rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                  style={{ height: 40, width: 40, backgroundColor: "var(--system-bg0, #FF0000)" }}
                  aria-label="Slet"
                >
                  <FontAwesomeIcon icon={faTrash} className="group-hover:opacity-50 transition-opacity" style={{ color: "var(--system-error, #FF0000)", fontSize: 16 }} />
                </button>
              </div>
            )}
            {question.deadlineMissed && (
              <AlarmTooltipButton />
            )}
            {question.goalReached && !question.answerUrl && !question.muxAssetStatus && (
              <span style={{ color: "var(--system-success, #FF0000)", fontFamily: "var(--font-figtree)", fontSize: 14, fontWeight: 500 }}>
                {timeLeft && timeLeft.total > 0
                  ? <>Svar inden for <strong>{timeLeft.hours}t {timeLeft.minutes}m</strong></>
                  : "Svartid overskredet"}
              </span>
            )}
            {question.goalReached && (
              <button
                onClick={() => setReplyOpen((v) => !v)}
                className="group cursor-pointer rounded-full flex items-center justify-center flex-shrink-0"
                style={{ height: 40, width: 40, backgroundColor: "var(--system-bg0, #FF0000)" }}
                aria-label="Besvar"
              >
                <FontAwesomeIcon
                  icon={replyOpen ? faXmark : ((question.answerUrl || question.muxAssetStatus) ? faPen : faReply)}
                  className="group-hover:opacity-50 transition-opacity"
                  style={{ color: replyOpen ? "var(--system-error, #FF0000)" : "var(--system-success, #FF0000)", fontSize: 16 }}
                />
              </button>
            )}
          </div>
        </div>
      </div>

      {question.goalReached && (replyOpen || submitStep) && (
        <div className="flex flex-col">
          {submitStep && submitStep !== "done" ? (
              <div className="rounded-lg" style={{ backgroundColor: "var(--system-bg0, #FF0000)", margin: "0 10px 10px", padding: 16 }}>
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
                          <svg className="w-4 h-4 shrink-0 animate-spin" style={{ color: "var(--system-text2, #FF0000)" }} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                        ) : (
                          <svg className="w-4 h-4 shrink-0" style={{ color: "var(--system-success, #FF0000)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        )}
                        <span className="text-sm flex-1 font-medium" style={{ fontFamily: "var(--font-figtree)", color: isActive ? "var(--system-text0, #FF0000)" : "var(--system-success, #FF0000)" }}>
                          {isActive ? activeLabel : doneLabel}
                        </span>
                      </div>
                    );
                  })}
                  {/* Progress bar */}
                  <div className="w-full rounded-full h-2 overflow-hidden" style={{ backgroundColor: "var(--system-bg2, #FF0000)" }}>
                    <div className="h-2 rounded-full transition-all" style={{
                      backgroundColor: "var(--system-success, #FF0000)",
                      width: submitStep === "uploading" ? `${Math.round(uploadProgress)}%`
                        : submitStep === "processing" ? "100%"
                        : "100%",
                    }} />
                  </div>
                  {submitStep === "processing" ? (
                    <div className="rounded-md px-3 py-2 flex items-center gap-2" style={{ backgroundColor: "var(--system-bg1, #FF0000)" }}>
                      <svg className="w-4 h-4 shrink-0" style={{ color: "var(--system-text2, #FF0000)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 110 18 9 9 0 010-18z" /></svg>
                      <p className="text-sm font-medium" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text0, #FF0000)" }}>Din {_isAudioSubmit.get(question.id) ? "lyd" : "video"} behandles — du kan lukke browseren. Svaret offentliggøres automatisk.</p>
                    </div>
                  ) : (
                    <div className="rounded-md px-3 py-2 flex items-center gap-2" style={{ backgroundColor: "var(--system-bg1, #FF0000)" }}>
                      <svg className="w-4 h-4 shrink-0" style={{ color: "var(--system-text2, #FF0000)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 110 18 9 9 0 010-18z" /></svg>
                      <p className="text-sm font-medium" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text0, #FF0000)" }}>Luk ikke browseren.</p>
                    </div>
                  )}
                </div>
              </div>
          ) : ((question.answerUrl || question.muxAssetStatus) && !editingAnswer) || submitStep === "done" ? (
            <div style={{ padding: "0 10px 10px" }}>
              <div className="rounded-lg p-3" style={{ backgroundColor: "var(--system-bg0, #FF0000)" }}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text0, #FF0000)" }}>Svar indsendt</p>
                    {question.muxAssetStatus ? (
                      <p className="text-sm" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
                        {question.muxMediaType === "audio" ? "Lydfil" : "Video"}{question.muxAssetStatus !== "ready" && " behandles..."}
                        {question.answerPhotoUrl && " (med poster)"}
                      </p>
                    ) : question.answerUrl ? (
                      <a
                        href={question.answerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm underline break-all hover:opacity-50 transition-opacity"
                        style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}
                      >
                        {question.answerUrl}
                      </a>
                    ) : (
                      <p className="text-sm" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>Video uploadet</p>
                    )}
                    {clipError && (
                      <p className="text-xs mt-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-error, #FF0000)" }}>{clipError}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setEditingAnswer(true)}
                    className="text-sm whitespace-nowrap hover:opacity-50 transition-opacity cursor-pointer"
                    style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-success, #FF0000)" }}
                  >
                    Redigér svar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: "0 10px 10px" }}>
              {editingAnswer && (
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
                    Opdatér dit svar
                  </p>
                  <button
                    onClick={() => setEditingAnswer(false)}
                    className="text-sm hover:opacity-50 transition-opacity cursor-pointer"
                    style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
                  >
                    Annullér
                  </button>
                </div>
              )}
              {/* Edit mode: show current answer overview with granular edit options */}
              {editingAnswer && (question.answerUrl || question.muxAssetStatus) && !pendingFile ? (
                <div className="space-y-3">
                  {/* Current video */}
                  <div className="rounded-lg p-3" style={{ backgroundColor: "var(--system-bg0, #FF0000)" }}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text0, #FF0000)" }}>
                        {question.muxMediaType === "audio"
                          ? "Nuværende svar: Lydfil"
                          : "Nuværende svar: Video"}
                      </p>
                      <label className="text-xs hover:opacity-50 transition-opacity cursor-pointer" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-success, #FF0000)" }}>
                        <input
                          type="file"
                          accept="video/*,audio/*,.m4a,.mp3,.wav,.ogg,.aac,.flac,.webm"
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
                    <div className="rounded-lg p-3" style={{ backgroundColor: "var(--system-bg0, #FF0000)" }}>
                      <div className="flex items-center gap-2">
                        <img src={posterPreviewUrl} alt="Poster preview" className="w-12 h-12 rounded-lg object-cover" />
                        <span className="text-sm font-medium flex-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text0, #FF0000)" }}>Nyt poster-billede valgt</span>
                        <button type="button" onClick={() => clearPendingPoster()} className="text-xs hover:opacity-50 transition-opacity cursor-pointer" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}>Fjern</button>
                      </div>
                    </div>
                  ) : removePoster ? (
                    <div className="flex items-center justify-between rounded-lg p-3" style={{ backgroundColor: "var(--system-bg0, #FF0000)" }}>
                      <p className="text-sm font-medium" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text0, #FF0000)" }}>Poster fjernes — auto-genereret clip bruges i stedet</p>
                      <button type="button" onClick={() => setRemovePoster(false)} className="text-xs hover:opacity-50 transition-opacity cursor-pointer" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-success, #FF0000)" }}>Fortryd</button>
                    </div>
                  ) : showPosterUpload ? (
                    <div className="rounded-lg p-3 space-y-2" style={{ backgroundColor: "var(--system-bg0, #FF0000)" }}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>Vælg eget poster-billede (portrait-format)</p>
                        <button type="button" onClick={() => setShowPosterUpload(false)} className="text-xs hover:opacity-50 transition-opacity cursor-pointer" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}>Luk</button>
                      </div>
                      <label
                        className="group block w-full border-dashed rounded-lg p-3 text-center cursor-pointer"
                        style={{ backgroundColor: "var(--system-bg0, #FF0000)", borderWidth: 2, animation: "pulse-border 2s ease-in-out infinite" }}
                      >
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePosterSelect(file); }} />
                        <span className="text-sm group-hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-success, #FF0000)" }}>Vælg billede</span>
                      </label>
                    </div>
                  ) : hasExistingCustomPoster ? (
                    <div className="rounded-lg p-3" style={{ backgroundColor: "var(--system-bg0, #FF0000)" }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img src={question.answerPhotoUrl!} alt="Current poster" className="w-12 h-12 rounded-lg object-cover" />
                          <span className="text-sm font-medium" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text0, #FF0000)" }}>Eget poster-billede</span>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setShowPosterUpload(true)} className="text-xs hover:opacity-50 transition-opacity cursor-pointer" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-success, #FF0000)" }}>Ændre</button>
                          {!isCurrentAnswerAudio && (
                            <button type="button" onClick={() => setRemovePoster(true)} className="text-xs hover:opacity-50 transition-opacity cursor-pointer" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}>Fjern</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowPosterUpload(true)} className="text-xs underline hover:opacity-50 transition-opacity cursor-pointer" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
                      {question.answerPhotoUrl ? "Erstat poster-billede" : "Tilføj eget poster-billede"}
                    </button>
                  )}
                  {/* Submit button — only if something changed */}
                  {(pendingPosterFile || removePoster) && (
                    <button
                      onClick={handlePosterOnlyUpdate}
                      className="group w-full text-sm px-4 py-2 rounded-full font-medium cursor-pointer"
                      style={{ fontFamily: "var(--font-figtree)", backgroundColor: "var(--system-success, #FF0000)", color: "var(--system-success-contrast, #FF0000)" }}
                    >
                      <span className="group-hover:opacity-50 transition-opacity">{pendingPosterFile ? "Gem poster-ændring" : "Fjern poster"}</span>
                    </button>
                  )}
                </div>
              ) : pendingFile && pendingFile.type.startsWith("video/") ? (
                <div className="space-y-3">
                  <div className="rounded-lg p-3" style={{ backgroundColor: "var(--system-bg0, #FF0000)" }}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text0, #FF0000)" }}>Video klar til indsendelse</p>
                      <button
                        type="button"
                        onClick={() => { clearPendingPoster(); setRemovePoster(false); setPendingFile(null); setPendingDuration(undefined); setPendingAspectRatio(undefined); }}
                        className="text-xs hover:opacity-50 transition-opacity cursor-pointer"
                        style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
                      >
                        Fjern
                      </button>
                    </div>
                  </div>
                  {/* Collapsible poster upload */}
                  {posterPreviewUrl ? (
                    <div className="rounded-lg p-3" style={{ backgroundColor: "var(--system-bg0, #FF0000)" }}>
                      <div className="flex items-center gap-2">
                        <img src={posterPreviewUrl} alt="Poster preview" className="w-12 h-12 rounded-lg object-cover" />
                        <span className="text-sm font-medium flex-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text0, #FF0000)" }}>Eget poster-billede valgt</span>
                        <button type="button" onClick={() => clearPendingPoster()} className="text-xs hover:opacity-50 transition-opacity cursor-pointer" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}>Fjern</button>
                      </div>
                    </div>
                  ) : showPosterUpload ? (
                    <div className="rounded-lg p-3 space-y-2" style={{ backgroundColor: "var(--system-bg0, #FF0000)" }}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>Vælg eget poster-billede (portrait-format)</p>
                        <button type="button" onClick={() => setShowPosterUpload(false)} className="text-xs hover:opacity-50 transition-opacity cursor-pointer" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}>Luk</button>
                      </div>
                      <label
                        className="group block w-full border-dashed rounded-lg p-3 text-center cursor-pointer"
                        style={{ backgroundColor: "var(--system-bg0, #FF0000)", borderWidth: 2, animation: "pulse-border 2s ease-in-out infinite" }}
                      >
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePosterSelect(file); }} />
                        <span className="text-sm group-hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-success, #FF0000)" }}>Vælg billede</span>
                      </label>
                    </div>
                  ) : editingAnswer && hasExistingCustomPoster && !removePoster ? (
                    <div className="rounded-lg p-3" style={{ backgroundColor: "var(--system-bg0, #FF0000)" }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img src={question.answerPhotoUrl!} alt="Current poster" className="w-12 h-12 rounded-lg object-cover" />
                          <span className="text-sm font-medium" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text0, #FF0000)" }}>Beholder eksisterende poster</span>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setShowPosterUpload(true)} className="text-xs hover:opacity-50 transition-opacity cursor-pointer" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-success, #FF0000)" }}>Ændre</button>
                          <button type="button" onClick={() => setRemovePoster(true)} className="text-xs hover:opacity-50 transition-opacity cursor-pointer" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}>Fjern</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowPosterUpload(true)} className="text-xs underline hover:opacity-50 transition-opacity cursor-pointer" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
                      Tilføj eget poster-billede (valgfrit)
                    </button>
                  )}
                  <button
                    onClick={handleSubmitVideoAnswer}
                    className="group w-full text-sm px-4 py-2 rounded-full font-medium disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                    style={{ fontFamily: "var(--font-figtree)", backgroundColor: "var(--system-success, #FF0000)", color: "var(--system-success-contrast, #FF0000)" }}
                  >
                    <span className="group-hover:opacity-50 transition-opacity">
                      {editingAnswer
                        ? (pendingPosterFile ? "Erstat video (med ny poster)" : (hasExistingCustomPoster && !removePoster) ? "Erstat video (behold poster)" : "Erstat video")
                        : (pendingPosterFile ? "Indsend video med poster" : "Indsend video")}
                    </span>
                  </button>
                </div>
              ) : pendingFile && pendingFile.type.startsWith("audio/") ? (
                <div className="space-y-3">
                  <div className="rounded-lg p-3" style={{ backgroundColor: "var(--system-bg0, #FF0000)" }}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text0, #FF0000)" }}>Lydfil klar til indsendelse</p>
                      <button
                        type="button"
                        onClick={() => { setPendingFile(null); setPendingDuration(undefined); setPendingAspectRatio(undefined); clearPendingPhoto(); }}
                        className="text-xs hover:opacity-50 transition-opacity cursor-pointer"
                        style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
                      >
                        Fjern
                      </button>
                    </div>
                  </div>
                  <div>
                    {(photoPreviewUrl || posterPreviewUrl) ? (
                      <div className="rounded-lg p-3" style={{ backgroundColor: "var(--system-bg0, #FF0000)" }}>
                        <div className="flex items-center gap-2">
                          <img src={(photoPreviewUrl || posterPreviewUrl)!} alt="Preview" className="w-12 h-12 rounded-lg object-cover" />
                          <span className="text-sm font-medium flex-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text0, #FF0000)" }}>Nyt poster-billede valgt</span>
                          <button
                            type="button"
                            onClick={() => { clearPendingPhoto(); clearPendingPoster(); }}
                            className="text-xs hover:opacity-50 transition-opacity cursor-pointer"
                            style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
                          >
                            Fjern
                          </button>
                        </div>
                      </div>
                    ) : editingAnswer && hasExistingCustomPoster ? (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <img src={question.answerPhotoUrl!} alt="Current poster" className="w-12 h-12 rounded-lg object-cover" />
                          <span className="text-sm font-medium flex-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text0, #FF0000)" }}>Beholder eksisterende poster</span>
                          <label className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                            Ændre
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoSelect(f); }} />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <label
                        className="group block w-full border-dashed rounded-lg p-4 text-center cursor-pointer"
                        style={{ backgroundColor: "var(--system-bg0, #FF0000)", borderWidth: 2, animation: "pulse-border 2s ease-in-out infinite" }}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoSelect(file);
                          }}
                        />
                        <span className="text-sm group-hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-success, #FF0000)" }}>
                          Tilføj eget poster-billede (portrait-format)
                        </span>
                      </label>
                    )}
                  </div>
                  <button
                    onClick={handleSubmitAudioAnswer}
                    disabled={!pendingPhotoFile && !(editingAnswer && hasExistingCustomPoster)}
                    className="group w-full text-sm px-4 py-2 rounded-full font-medium disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                    style={{ fontFamily: "var(--font-figtree)", backgroundColor: "var(--system-success, #FF0000)", color: "var(--system-success-contrast, #FF0000)" }}
                  >
                    <span className="group-hover:opacity-50 transition-opacity">
                      {pendingPhotoFile
                        ? (editingAnswer ? "Erstat med lyd (ny poster)" : "Indsend lyd med poster")
                        : editingAnswer && hasExistingCustomPoster
                          ? "Erstat med lyd (behold poster)"
                          : "Tilføj en poster for at indsende"}
                    </span>
                  </button>
                </div>
              ) : (
                <label
                  className="group block w-full border-dashed rounded-lg p-4 text-center cursor-pointer"
                  style={{ backgroundColor: "var(--system-bg0, #FF0000)", borderWidth: 2, animation: "pulse-border 2s ease-in-out infinite" }}
                >
                  <input
                    type="file"
                    accept="video/*,audio/*,.m4a,.mp3,.wav,.ogg,.aac,.flac,.webm"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />
                  <span className="text-sm group-hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-success, #FF0000)" }}>
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
