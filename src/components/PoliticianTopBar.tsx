"use client";

import { Suspense } from "react";
import { useEffect, useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { faCommentPlus } from "@fortawesome/pro-solid-svg-icons";
import { faInfo } from "@fortawesome/pro-duotone-svg-icons";
import { directSuggestion } from "@/app/[partySlug]/[politicianSlug]/actions";
import { useSystemColors } from "./SystemColorProvider";
import { SuccessBanner } from "./SuccessBanner";
import { SuggestionModal } from "./SuggestionModal";

type PoliticianTopBarProps = {
  politicianName: string;
  partyName: string;
  profilePhotoUrl: string | null;
  partyLogoUrl: string | null;
  constituency: string | null;
  partyColor: string | null;
  partyColorDark: string | null;
  partyColorLight: string | null;
  politicianId: string;
  partySlug: string;
  politicianSlug: string;
  hasSession: boolean;
  backHref?: string | null;
  redirectPath?: string | null;
};

export function PoliticianTopBar({
  politicianName,
  partyName,
  profilePhotoUrl,
  partyLogoUrl,
  constituency,
  partyColor,
  partyColorDark,
  partyColorLight,
  politicianId,
  partySlug,
  politicianSlug,
  hasSession,
  backHref,
  redirectPath,
}: PoliticianTopBarProps) {
  const { error: colorError } = useSystemColors();
  const bgColor = partyColor ?? "#3B82F6";
  const nameColor = partyColorDark ?? "#1E3A5F";
  const partyTextColor = partyColorLight ?? "#93C5FD";
  const constituencyColor = partyColorDark ?? "#1E3A5F";

  // Form interaction state
  const [formActive, setFormActive] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const introStorageKey = `intro-dismissed:${politicianSlug}`;
  const [introDismissed, setIntroDismissed] = useState(false);
  useEffect(() => {
    setIntroDismissed(localStorage.getItem(introStorageKey) === "1");
    const handler = () => setIntroDismissed(true);
    window.addEventListener("intro-dismissed", handler);
    return () => window.removeEventListener("intro-dismissed", handler);
  }, [introStorageKey]);

  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 680);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus desktop input when form activates (mobile focus is handled
  // synchronously via flushSync in the button click handler)
  useEffect(() => {
    if (formActive && window.innerWidth >= 640) {
      inputRef.current?.focus();
    }
  }, [formActive]);

  // Close form on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && formActive) {
        resetForm();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [formActive]);

  // Close form on click outside (only when text is empty)
  useEffect(() => {
    if (!formActive) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!text.trim()) resetForm();
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [formActive, text]);

  function resetForm() {
    setFormActive(false);
    setText("");
    setError(null);
    setModalOpen(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!text.trim()) return;

    // Logged-out users: open modal instead of submitting directly
    if (!hasSession) {
      setModalOpen(true);
      return;
    }

    // Logged-in users: submit directly from topbar
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("text", text);
    formData.set("politicianId", politicianId);
    formData.set("politicianSlug", politicianSlug);
    formData.set("partySlug", partySlug);
    if (redirectPath) formData.set("redirectPath", redirectPath);

    try {
      await directSuggestion(formData);
      setSuccess(true);
      setText("");
      setFormActive(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Der opstod en fejl");
    } finally {
      setPending(false);
    }
  }

  // Success message — show briefly then reset
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  return (
    <div
      ref={containerRef}
      className="sticky top-0 z-50 cursor-pointer"
      style={{ backgroundColor: bgColor, fontFamily: "var(--font-figtree)", fontWeight: 500 }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("button, a, input, textarea")) return;
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      <Suspense>
        <SuccessBanner />
      </Suspense>
      <style>{`
        .topbar-suggest-input::placeholder { color: var(--placeholder-color); opacity: 0.5; }
        .topbar-field::placeholder { color: var(--field-placeholder-color, #9ca3af); }
        .topbar-btn:hover:not(:disabled) { opacity: 0.8; }
        .topbar-age::-webkit-inner-spin-button,
        .topbar-age::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .topbar-age { -moz-appearance: textfield; }
      `}</style>
      <form onSubmit={handleSubmit} noValidate>
        {/* ── Top row: logos + names + desktop form/button ── */}
        <div className="px-[15px] h-[75px] flex items-center gap-3">
          {/* Left: back button (optional) + party logo + profile photo (always visible) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {backHref && (
              <a
                href={backHref}
                className="group w-12 h-12 rounded-full flex items-center justify-center shrink-0 relative"
                aria-label="Tilbage"
              >
                <span
                  className="absolute inset-0 rounded-full transition-opacity group-hover:opacity-50"
                  style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
                />
                <FontAwesomeIcon
                  icon={faArrowLeft}
                  className="relative"
                  style={{ color: partyColorDark || "#1E3A5F", fontSize: 18 }}
                />
              </a>
            )}
            {partyLogoUrl && (
              <img
                src={partyLogoUrl}
                alt=""
                className="w-12 h-12 rounded-full object-cover shrink-0"
              />
            )}
            {profilePhotoUrl && (
              <img
                src={profilePhotoUrl}
                alt=""
                className="w-12 h-12 rounded-full object-cover shrink-0"
              />
            )}
          </div>

          {/* Names (always visible on mobile; hidden on desktop when form is active) */}
          <div className={`min-w-0 ml-[3px] ${formActive ? "sm:hidden" : ""}`}>
            <p
              className="text-base leading-tight truncate"
              style={{ color: nameColor }}
            >
              {politicianName}
            </p>
            <p
              className="text-base leading-tight truncate"
              style={{ color: partyTextColor }}
            >
              {partyName}
            </p>
          </div>

          {/* Mobile-only: info button + suggest/close button */}
          <div className="sm:hidden ml-auto flex items-center gap-3 shrink-0">
            {!backHref && introDismissed && !formActive && (
              <button
                type="button"
                onClick={() => {
                  setIntroDismissed(false);
                  window.dispatchEvent(new Event("show-intro"));
                }}
                className="cursor-pointer hover:opacity-50 transition-opacity rounded-full flex items-center justify-center"
                style={{ width: 24, height: 24, backgroundColor: "rgba(255,255,255,0.5)" }}
                aria-label="Vis information"
              >
                <FontAwesomeIcon
                  icon={faInfo}
                  style={{ color: partyColorDark || "#1E3A5F", fontSize: "13.5px" }}
                />
              </button>
            )}
            {/* Suggest button (comment-lines) / Close button (xmark) */}
            {!success && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="cursor-pointer transition-opacity rounded-full flex items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: "#ffffff",
                }}
                aria-label="Foreslå et spørgsmål"
              >
                <FontAwesomeIcon
                  icon={faCommentPlus}
                  style={{ color: nameColor, fontSize: 20 }}
                />
              </button>
            )}
          </div>

          {/* Desktop-only: expanded form input (replaces names on desktop) */}
          {formActive && (
            <div className="hidden sm:flex flex-1 items-center gap-2 min-w-0">
              <div className="relative flex-1 min-w-0">
                <input
                  ref={inputRef}
                  name="text"
                  type="text"
                  required
                  maxLength={300}
                  placeholder="Foreslå et spørgsmål..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="topbar-suggest-input w-full bg-white rounded-full px-5 pr-10 py-2 text-base focus:outline-none"
                  style={{ color: nameColor, "--placeholder-color": nameColor } as React.CSSProperties}
                />
                {text.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setText(""); inputRef.current?.focus(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 cursor-pointer opacity-40 hover:opacity-70 transition-opacity"
                    style={{ color: nameColor }}
                  >
                    <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
                  </button>
                )}
              </div>
              {text.trim().length > 0 && (
                <button
                  type="submit"
                  disabled={pending}
                  className="topbar-btn text-base px-5 py-2 rounded-full whitespace-nowrap cursor-pointer disabled:opacity-50 shrink-0 transition-opacity"
                  style={hasSession
                    ? { backgroundColor: nameColor, color: "#ffffff" }
                    : { backgroundColor: partyTextColor, color: nameColor }
                  }
                >
                  {pending ? "Sender..." : hasSession ? "Send forslag" : "Næste"}
                </button>
              )}
            </div>
          )}

          {/* Desktop-only: constituency + trigger button (normal mode) */}
          {!formActive && (
            <div className="ml-auto hidden sm:flex items-center gap-3 shrink-0">
              {constituency && (
                <span
                  className="text-base"
                  style={{ color: constituencyColor, opacity: 0.5 }}
                >
                  {constituency}
                </span>
              )}
              {!backHref && introDismissed && (
                <button
                  type="button"
                  onClick={() => {
                    setIntroDismissed(false);
                    window.dispatchEvent(new Event("show-intro"));
                  }}
                  className="cursor-pointer hover:opacity-50 transition-opacity rounded-full flex items-center justify-center"
                  style={{ width: 24, height: 24, backgroundColor: "rgba(255,255,255,0.5)" }}
                  aria-label="Vis information"
                >
                  <FontAwesomeIcon
                    icon={faInfo}
                    style={{ color: partyColorDark || "#1E3A5F", fontSize: "13.5px" }}
                  />
                </button>
              )}
              {success && hasSession ? (
                <span
                  className="text-base px-5 py-2 rounded-full whitespace-nowrap"
                  style={{ backgroundColor: nameColor, color: "var(--system-text0-contrast)" }}
                >
                  Tak! Dit forslag er sendt
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setFormActive(true)}
                  className="bg-white text-base px-5 py-2 rounded-full whitespace-nowrap cursor-pointer"
                  style={{ color: nameColor }}
                >
                  Foreslå et spørgsmål...
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Mobile-only: success message (logged-in only, logged-out uses modal) ── */}
        {!formActive && success && hasSession && (
          <div className="px-[15px] pb-3 sm:hidden">
            <span
              className="block text-base px-5 py-2 rounded-full text-center"
              style={{ backgroundColor: nameColor, color: "var(--system-text0-contrast)" }}
            >
              Tak! Dit forslag er sendt
            </span>
          </div>
        )}

        {/* Error when logged in (desktop topbar submit) */}
        {formActive && error && hasSession && (
          <div className="px-[15px] pb-2">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}
      </form>

      {/* Suggestion modal (mobile: all users, desktop: logged-out only) */}
      <SuggestionModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); }}
        initialText={text}
        politicianId={politicianId}
        politicianSlug={politicianSlug}
        partySlug={partySlug}
        partyColor={partyColor}
        partyColorDark={partyColorDark}
        partyColorLight={partyColorLight}
        hasSession={hasSession}
        redirectPath={redirectPath}
        onSuccess={() => {
          setSuccess(true);
          setText("");
          setFormActive(false);
          setModalOpen(false);
        }}
      />
    </div>
  );
}
