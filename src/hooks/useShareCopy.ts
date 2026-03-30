"use client";

import { useState, useRef, useCallback } from "react";

/**
 * Share/copy link with blink animation.
 * On touch devices, uses Web Share API. Otherwise copies to clipboard.
 * Returns { copied, handleShare } — `copied` toggles briefly for icon animation.
 */
export function useShareCopy(url: string, title: string) {
  const [copied, setCopied] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const handleShare = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (isTouch && navigator.share) {
      navigator.share({ url, title }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current = [];
      setCopied(true);
      timersRef.current.push(setTimeout(() => setCopied(false), 600));
    }
  }, [url, title]);

  return { copied, handleShare };
}
