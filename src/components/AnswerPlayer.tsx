"use client";

import { isBlobUrl, getBlobMediaType } from "@/lib/answer-utils";

export function AnswerPlayer({
  answerUrl,
  className,
}: {
  answerUrl: string;
  className?: string;
}) {
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
        <audio
          src={answerUrl}
          controls
          preload="metadata"
          className={className ?? "w-full"}
        >
          Din browser understøtter ikke lydafspilning.
        </audio>
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
