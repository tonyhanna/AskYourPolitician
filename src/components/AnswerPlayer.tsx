"use client";

import { isBlobUrl, getBlobMediaType, getYouTubeVideoId } from "@/lib/answer-utils";

export function AnswerPlayer({
  answerUrl,
  photoUrl,
  className,
}: {
  answerUrl: string;
  photoUrl?: string | null;
  className?: string;
}) {
  const youtubeId = getYouTubeVideoId(answerUrl);
  if (youtubeId) {
    return (
      <div className="w-full aspect-video">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
          title="Svar fra politiker"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className={className ?? "w-full h-full rounded-lg"}
        />
      </div>
    );
  }

  if (isBlobUrl(answerUrl)) {
    const mediaType = getBlobMediaType(answerUrl);

    if (mediaType === "video") {
      return (
        <video
          src={answerUrl}
          controls
          preload="metadata"
          playsInline
          className={className ?? "w-full rounded-lg"}
        >
          Din browser understøtter ikke videoafspilning.
        </video>
      );
    }

    if (mediaType === "audio") {
      return (
        <div className="w-full space-y-3">
          {photoUrl && (
            <img
              src={photoUrl}
              alt="Politiker"
              className="w-full rounded-lg object-cover max-h-80"
            />
          )}
          <audio
            src={answerUrl}
            controls
            preload="metadata"
            className={className ?? "w-full"}
          >
            Din browser understøtter ikke lydafspilning.
          </audio>
        </div>
      );
    }
  }

  return (
    <a
      href={answerUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-400 hover:text-blue-300 underline font-medium"
    >
      Se svar
    </a>
  );
}
