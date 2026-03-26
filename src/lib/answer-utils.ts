export function isBlobUrl(url: string): boolean {
  return url.includes(".public.blob.vercel-storage.com/");
}

export function getBlobMediaType(url: string): "video" | "audio" | null {
  const videoExtensions = [".mp4", ".mov", ".webm", ".avi", ".mkv", ".m4v"];
  const audioExtensions = [".mp3", ".m4a", ".wav", ".ogg", ".aac", ".flac"];

  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (videoExtensions.some((ext) => pathname.endsWith(ext))) return "video";
    if (audioExtensions.some((ext) => pathname.endsWith(ext))) return "audio";
  } catch {
    // Invalid URL
  }
  return null;
}

/**
 * Unified media info for a question's answer.
 * Supports both Mux-based and legacy Vercel Blob answers.
 */
export type AnswerMediaInfo =
  | { source: "mux"; type: "video" | "audio"; playbackId: string; status: string }
  | { source: "blob"; type: "video" | "audio"; url: string }
  | null;

export function getAnswerMediaInfo(question: {
  muxPlaybackId?: string | null;
  muxAssetStatus?: string | null;
  muxMediaType?: string | null;
  answerUrl?: string | null;
}): AnswerMediaInfo {
  // Mux answer (ready or still processing)
  if (question.muxPlaybackId || question.muxAssetStatus) {
    return {
      source: "mux",
      type: (question.muxMediaType as "video" | "audio") ?? "video",
      playbackId: question.muxPlaybackId ?? "",
      status: question.muxAssetStatus ?? "preparing",
    };
  }

  // Legacy Vercel Blob answer
  if (question.answerUrl) {
    const type = getBlobMediaType(question.answerUrl);
    if (type) {
      return { source: "blob", type, url: question.answerUrl };
    }
  }

  return null;
}
