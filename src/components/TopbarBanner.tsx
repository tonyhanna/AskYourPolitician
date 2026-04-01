"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";

export function TopbarBanner() {
  const searchParams = useSearchParams();
  const [isError, setIsError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [phase, setPhase] = useState<"hidden" | "entering" | "visible" | "exiting">("hidden");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  const showBanner = useCallback((msg: string, error: boolean) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    setIsError(error);
    setPhase("entering");
    // Trigger reflow then start enter animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPhase("visible");
        timerRef.current = setTimeout(() => {
          setPhase("exiting");
        }, 5000);
      });
    });
  }, []);

  // URL param triggers — show banner once, then strip params so revalidation doesn't re-trigger
  useEffect(() => {
    const key = searchParams.get("success") === "true" ? "success"
      : searchParams.get("suggestion_verified") === "true" ? "suggestion_verified"
      : searchParams.get("already_upvoted") === "true" ? "already_upvoted"
      : null;
    if (!key) return;

    if (key === "success") showBanner("Din upvote er registreret", false);
    else if (key === "suggestion_verified") showBanner("Dit forslag er bekræftet og sendt til politikeren!", false);
    else if (key === "already_upvoted") showBanner("Du har allerede upvotet dette spørgsmål", true);

    // Remove the param from the URL so it won't fire again on revalidation
    const url = new URL(window.location.href);
    url.searchParams.delete(key);
    window.history.replaceState({}, "", url.pathname + (url.search || ""));
  }, [searchParams, showBanner]);

  // Custom event triggers (from inline upvote/cancel)
  useEffect(() => {
    function handleUpvoteBanner(e: Event) {
      const detail = (e as CustomEvent).detail;
      showBanner(detail.message, detail.isError ?? false);
    }
    window.addEventListener("upvote-banner", handleUpvoteBanner);
    return () => window.removeEventListener("upvote-banner", handleUpvoteBanner);
  }, [showBanner]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (phase === "hidden" && !message) return null;

  return (
    <div
      ref={bannerRef}
      className="w-full overflow-hidden"
      style={{
        maxHeight: phase === "entering" ? 0 : phase === "exiting" ? 0 : 60,
        opacity: phase === "visible" ? 1 : 0,
        transition: "max-height 300ms ease, opacity 300ms ease",
        zIndex: 60,
      }}
      onTransitionEnd={() => {
        if (phase === "exiting") {
          setPhase("hidden");
          setMessage(null);
        }
      }}
    >
      <div
        className="w-full py-3 text-center text-sm"
        style={{
          fontFamily: "var(--font-figtree)",
          fontWeight: 500,
          backgroundColor: "var(--system-bg0, #FF0000)",
          color: isError ? "var(--system-error, #FF0000)" : "var(--system-success, #FF0000)",
          borderBottom: "none",
        }}
      >
        {message}
      </div>
    </div>
  );
}
