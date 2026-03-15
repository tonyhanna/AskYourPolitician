"use client";

import { Suspense } from "react";
import { useEffect, useState, useRef } from "react";
import { flushSync } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { faCommentLines } from "@fortawesome/pro-solid-svg-icons";
import { faInfo } from "@fortawesome/pro-duotone-svg-icons";
import { submitSuggestion, directSuggestion } from "@/app/[partySlug]/[politicianSlug]/actions";
import { SuccessBanner } from "./SuccessBanner";

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
}: PoliticianTopBarProps) {
  const bgColor = partyColor ?? "#3B82F6";
  const nameColor = partyColorDark ?? "#1E3A5F";
  const partyTextColor = partyColorLight ?? "#93C5FD";
  const constituencyColor = partyColorDark ?? "#1E3A5F";

  // Form interaction state
  const [formActive, setFormActive] = useState(false);
  const [text, setText] = useState("");
  const [showIdentity, setShowIdentity] = useState(false);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ firstName?: boolean; email?: boolean; emailInvalid?: boolean }>({});
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
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
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
    setShowIdentity(false);
    setError(null);
    setFieldErrors({});
    setFirstName("");
    setEmail("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!text.trim()) return;

    // If not logged in and identity panel not open yet, open it
    if (!hasSession && !showIdentity) {
      setShowIdentity(true);
      return;
    }

    // Validate identity fields when panel is open
    if (!hasSession && showIdentity) {
      const errors: { firstName?: boolean; email?: boolean; emailInvalid?: boolean } = {};
      if (!firstName.trim()) errors.firstName = true;
      if (!email.trim()) errors.email = true;
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.emailInvalid = true;
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
    }

    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("text", text);
    formData.set("politicianId", politicianId);
    formData.set("politicianSlug", politicianSlug);
    formData.set("partySlug", partySlug);

    try {
      if (hasSession) {
        await directSuggestion(formData);
      } else {
        await submitSuggestion(formData);
      }
      setSuccess(true);
      setText("");
      setFormActive(false);
      setShowIdentity(false);
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
      className="cursor-pointer"
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
          {/* Left: party logo + profile photo (always visible) */}
          <div className="flex items-center gap-1.5 shrink-0">
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
          <div className="sm:hidden ml-auto flex items-center gap-2 shrink-0">
            {introDismissed && !formActive && (
              <button
                type="button"
                onClick={() => {
                  setIntroDismissed(false);
                  window.dispatchEvent(new Event("show-intro"));
                }}
                className="cursor-pointer hover:opacity-50 transition-opacity rounded-full flex items-center justify-center"
                style={{ width: 24, height: 24, backgroundColor: "rgba(255,255,255,0.5)", marginRight: 10 }}
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
                onClick={() => {
                  if (formActive) {
                    resetForm();
                  } else {
                    // flushSync forces synchronous render so the input is in the DOM
                    // before we focus it — required for iOS to open the keyboard
                    flushSync(() => setFormActive(true));
                    mobileInputRef.current?.focus();
                  }
                }}
                className="cursor-pointer transition-opacity rounded-full flex items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: formActive ? "rgba(255,255,255,0.5)" : "#ffffff",
                }}
                aria-label={formActive ? "Luk" : "Foreslå et spørgsmål"}
              >
                <FontAwesomeIcon
                  icon={formActive ? faXmark : faCommentLines}
                  style={{ color: nameColor, fontSize: formActive ? 18 : 16 }}
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
              {text.trim().length > 0 && (() => {
                const isSend = hasSession || showIdentity;
                const identityIncomplete = showIdentity && (!firstName.trim() || !email.trim());
                return (
                  <button
                    type="submit"
                    disabled={pending}
                    className={`topbar-btn text-base px-5 py-2 rounded-full whitespace-nowrap cursor-pointer disabled:opacity-50 shrink-0 transition-opacity ${identityIncomplete ? "opacity-50" : ""}`}
                    style={isSend
                      ? { backgroundColor: nameColor, color: "#ffffff" }
                      : { backgroundColor: partyTextColor, color: nameColor }
                    }
                  >
                    {pending ? "Sender..." : isSend ? "Send forslag" : "Næste"}
                  </button>
                );
              })()}
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
              {introDismissed && (
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
              {success ? (
                <span
                  className="text-base px-5 py-2 rounded-full bg-white whitespace-nowrap"
                  style={{ color: nameColor }}
                >
                  {hasSession
                    ? "Tak! Dit forslag er sendt"
                    : "Tjek din email for at bekræfte"}
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

        {/* ── Mobile-only: second row (form input when active, success message, or nothing) ── */}
        {formActive && (
          <div className="px-[15px] pb-3 sm:hidden">
            <div className="flex items-center gap-2">
              <input
                ref={mobileInputRef}
                name="text"
                type="text"
                required
                maxLength={300}
                placeholder="Foreslå et spørgsmål..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="topbar-suggest-input flex-1 min-w-0 bg-white rounded-full px-5 py-2 text-base focus:outline-none"
                style={{ color: nameColor, "--placeholder-color": nameColor } as React.CSSProperties}
              />
              {text.trim().length > 0 && (() => {
                const isSend = hasSession || showIdentity;
                const identityIncomplete = showIdentity && (!firstName.trim() || !email.trim());
                return (
                  <button
                    type="submit"
                    disabled={pending}
                    className={`topbar-btn text-base px-5 py-2 rounded-full whitespace-nowrap cursor-pointer disabled:opacity-50 shrink-0 transition-opacity ${identityIncomplete ? "opacity-50" : ""}`}
                    style={isSend
                      ? { backgroundColor: nameColor, color: "#ffffff" }
                      : { backgroundColor: partyTextColor, color: nameColor }
                    }
                  >
                    {pending ? "Sender..." : isSend ? "Send forslag" : "Næste"}
                  </button>
                );
              })()}
            </div>
          </div>
        )}
        {!formActive && success && (
          <div className="px-[15px] pb-3 sm:hidden">
            <span
              className="block text-base px-5 py-2 rounded-full bg-white text-center"
              style={{ color: nameColor }}
            >
              {hasSession
                ? "Tak! Dit forslag er sendt"
                : "Tjek din email for at bekræfte"}
            </span>
          </div>
        )}

        {/* ── Identity panel (slides down when not logged in) ── */}
        {formActive && showIdentity && !hasSession && (
          <div className="px-[15px] pb-4 space-y-2">
            <p className="text-base mb-1" style={{ color: nameColor }}>
              Vi skal lige vide lidt mere om dig <span style={{ opacity: 0.5 }}>— alder er valgfri</span>
            </p>
            {/* Row 1: Fornavn + Alder */}
            <div className="flex items-center gap-2">
              <input
                name="firstName"
                type="text"
                required
                placeholder={fieldErrors.firstName ? "Fornavn skal udfyldes" : "Fornavn"}
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setFieldErrors((prev) => ({ ...prev, firstName: undefined })); }}
                className="topbar-field bg-white rounded-full px-5 py-2 text-base text-gray-900 focus:outline-none min-w-0"
                style={{ flex: "75", "--field-placeholder-color": fieldErrors.firstName ? "#FF4105" : "#9ca3af" } as React.CSSProperties}
              />
              <input
                name="age"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                placeholder="Alder"
                onKeyDown={(e) => { if (!/[0-9]/.test(e.key) && !["Backspace","Delete","ArrowLeft","ArrowRight","Tab"].includes(e.key)) e.preventDefault(); }}
                onPaste={(e) => { const text = e.clipboardData.getData("text"); if (!/^\d+$/.test(text)) e.preventDefault(); }}
                className="topbar-field bg-white rounded-full px-5 py-2 text-base text-gray-900 focus:outline-none min-w-0"
                style={{ flex: "25" }}
              />
            </div>
            {/* Row 2: E-mail (full width) */}
            <input
              name="email"
              type="email"
              required
              placeholder={fieldErrors.email ? "E-mail skal udfyldes" : "E-mail"}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors((prev) => ({ ...prev, email: undefined, emailInvalid: undefined })); }}
              className="topbar-field bg-white rounded-full px-5 py-2 text-base focus:outline-none w-full"
              style={{ color: fieldErrors.emailInvalid ? "#FF4105" : "#111827", "--field-placeholder-color": fieldErrors.email ? "#FF4105" : "#9ca3af" } as React.CSSProperties}
            />
          </div>
        )}

        {/* Error when logged in (no identity panel) */}
        {formActive && error && (hasSession || !showIdentity) && (
          <div className="px-[15px] pb-2">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}
      </form>
    </div>
  );
}
