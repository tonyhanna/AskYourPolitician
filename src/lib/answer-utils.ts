export function isBlobUrl(url: string): boolean {
  return url.includes(".public.blob.vercel-storage.com/");
}

/**
 * Media info for a question's answer (Mux-only).
 */
export type AnswerMediaInfo =
  | { type: "video" | "audio"; playbackId: string; status: string }
  | null;

export function getAnswerMediaInfo(question: {
  muxPlaybackId?: string | null;
  muxAssetStatus?: string | null;
  muxMediaType?: string | null;
}): AnswerMediaInfo {
  if (question.muxPlaybackId || question.muxAssetStatus) {
    return {
      type: (question.muxMediaType as "video" | "audio") ?? "video",
      playbackId: question.muxPlaybackId ?? "",
      status: question.muxAssetStatus ?? "preparing",
    };
  }
  return null;
}
