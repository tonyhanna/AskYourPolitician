"use client";

import { Suspense } from "react";
import { useEffect, useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faArrowLeft, faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { faCircleUserCircleUser } from "@fortawesome/pro-duotone-svg-icons";
import { faCommentPlus } from "@fortawesome/pro-solid-svg-icons";
import { faInfo, faMailbox, faMailboxFlagUp } from "@fortawesome/pro-duotone-svg-icons";
import { directSuggestion } from "@/app/[partySlug]/[politicianSlug]/actions";
import { stopImpersonation } from "@/app/admin/actions";
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
  mode?: "citizen" | "dashboard";
  citizenPageUrl?: string | null;
  isImpersonating?: boolean;
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
  mode = "citizen",
  citizenPageUrl,
  isImpersonating,
}: PoliticianTopBarProps) {
  const isDashboard = mode === "dashboard";
  const canHover = useRef(false);
  const isTouchRef = useRef(false);
  const [impersonateArmed, setImpersonateArmed] = useState(false);
  const [impersonateHover, setImpersonateHover] = useState(false);
  useEffect(() => { canHover.current = window.matchMedia("(hover: hover)").matches; }, []);
  const impersonateBtnRef = useRef<HTMLButtonElement>(null);
  // Dismiss impersonate armed state on tap outside
  useEffect(() => {
    if (!impersonateArmed) return;
    const handler = (e: TouchEvent | MouseEvent) => {
      if (impersonateBtnRef.current && !impersonateBtnRef.current.contains(e.target as Node)) {
        setImpersonateArmed(false);
      }
    };
    document.addEventListener("touchstart", handler, { capture: true });
    document.addEventListener("mousedown", handler, { capture: true });
    return () => {
      document.removeEventListener("touchstart", handler, { capture: true });
      document.removeEventListener("mousedown", handler, { capture: true });
    };
  }, [impersonateArmed]);
  const { error: colorError, errorContrast } = useSystemColors();
  const bgColor = partyColor ?? "#3B82F6";
  const nameColor = partyColorDark ?? "#1E3A5F";
  const partyTextColor = partyColorLight ?? "#93C5FD";
  const constituencyColor = partyColorDark ?? "#1E3A5F";

  // Form interaction state
  const [formActive, setFormActive] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  // Simple mailbox confirmation: "mailbox" → "flagUp" → null
  const [mailboxPhase, setMailboxPhase] = useState<"mailbox" | "flagUp" | "fadeIn" | null>(null);
  const pillBtnRef = useRef<HTMLButtonElement>(null);
  const pillSizeRef = useRef<{ width: number; height: number } | null>(null);
  const [namesRevealed, setNamesRevealed] = useState<false | "fading" | true>(false);
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

  /** Shared mailbox confirmation animation sequence.
   *  Desktop: plays inside the pill button area (form stays active).
   *  Mobile: plays inside the circular suggest button area.
   *  Both: mailbox → flagUp → fadeIn → done */
  const mailboxTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  function startMailboxAnimation(isDesktop: boolean) {
    // Clear any running animation
    mailboxTimersRef.current.forEach(clearTimeout);
    mailboxTimersRef.current = [];
    const t = (fn: () => void, ms: number) => { mailboxTimersRef.current.push(setTimeout(fn, ms)); };

    setSuccess(true);
    setMailboxPhase("mailbox");

    if (isDesktop) {
      // Fade out input, reveal politician names underneath
      t(() => { setText(""); setNamesRevealed("fading"); }, 200);
      t(() => setNamesRevealed(true), 250);
    }

    // mailbox → flagUp → fadeIn → done (shared timing)
    t(() => setMailboxPhase("flagUp"), 1000);
    t(() => {
      setMailboxPhase("fadeIn");
      if (isDesktop) { setFormActive(false); pillSizeRef.current = null; setNamesRevealed(false); }
    }, 2700);
    t(() => { setMailboxPhase(null); setSuccess(false); }, 2750);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!text.trim()) return;

    if (!hasSession) { setModalOpen(true); return; }

    // Capture pill size BEFORE pending changes text to "Sender..."
    if (pillBtnRef.current) {
      pillSizeRef.current = { width: pillBtnRef.current.offsetWidth, height: pillBtnRef.current.offsetHeight };
    }
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
      if (pillBtnRef.current) {
        pillSizeRef.current = { width: pillBtnRef.current.offsetWidth, height: pillBtnRef.current.offsetHeight };
      }
      startMailboxAnimation(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Der opstod en fejl");
    } finally {
      setPending(false);
    }
  }

  // Logged-out success: modal handles it, just reset after timeout
  useEffect(() => {
    if (success && !hasSession) {
      const timer = setTimeout(() => setSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [success, hasSession]);

  // Cleanup animation timers on unmount
  useEffect(() => () => mailboxTimersRef.current.forEach(clearTimeout), []);

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
      <form onSubmit={handleSubmit} noValidate style={{ cursor: "default" }}>
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
          <div className={`min-w-0 ml-[3px] ${!isDashboard && formActive && !namesRevealed ? "sm:hidden" : ""}`} style={namesRevealed === "fading" ? { opacity: 0 } : namesRevealed === true ? { opacity: 1, transition: "opacity 300ms ease-out" } : undefined}>
            <p
              className="text-base leading-tight truncate"
              style={{ color: nameColor }}
            >
              {isDashboard ? "Dashboard" : politicianName}
            </p>
            <p
              className="text-base leading-tight truncate"
              style={{ color: partyTextColor }}
            >
              {isDashboard ? politicianName : partyName}
            </p>
          </div>

          {/* Dashboard mode: impersonation button + citizen page link on right */}
          {isDashboard && (
            <div className="ml-auto flex items-center gap-3 shrink-0">
              {/* Impersonation button: user-hat-tie idle → xmark on hover/tap1 → stop on click/tap2 */}
              {isImpersonating && (() => {
                const showXmark = impersonateArmed || impersonateHover;
                return (
                  <button
                    ref={impersonateBtnRef}
                    type="button"
                    onPointerDown={(e) => { isTouchRef.current = e.pointerType === "touch"; }}
                    onClick={async () => {
                      if (isTouchRef.current && !impersonateArmed) {
                        setImpersonateArmed(true);
                        return;
                      }
                      await stopImpersonation();
                      window.location.href = "/admin";
                    }}
                    className="rounded-full flex items-center justify-center cursor-pointer relative"
                    style={{
                      width: 40, height: 40,
                      backgroundColor: showXmark ? "var(--system-bg0)" : nameColor,
                    }}
                    aria-label={impersonateArmed ? "Stop impersonering" : "Admin"}
                    onPointerEnter={() => { if (canHover.current) setImpersonateHover(true); }}
                    onPointerLeave={() => { if (canHover.current) setImpersonateHover(false); }}
                  >
                    {showXmark && (
                      <div className="absolute inset-0 rounded-full" style={{ backgroundColor: `${colorError}80` }} />
                    )}
                    <FontAwesomeIcon
                      icon={showXmark ? faXmark : faCircleUserCircleUser}
                      className="relative"
                      style={{ color: showXmark ? errorContrast : partyTextColor, fontSize: 18 }}
                    />
                  </button>
                );
              })()}
              {citizenPageUrl && (
                <a
                  href={citizenPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full flex items-center justify-center"
                  style={{ width: 40, height: 40, backgroundColor: partyTextColor }}
                  aria-label="Se borgerside"
                  onPointerEnter={(e) => { if (!canHover.current) return; const svg = e.currentTarget.querySelector("svg"); if (svg) svg.style.opacity = "0.5"; }}
                  onPointerLeave={(e) => { if (!canHover.current) return; const svg = e.currentTarget.querySelector("svg"); if (svg) svg.style.opacity = "1"; }}
                >
                  <FontAwesomeIcon icon={faArrowRight} className="transition-opacity" style={{ color: nameColor, fontSize: 18 }} />
                </a>
              )}
            </div>
          )}

          {/* Mobile-only: info button + suggest/close button (citizen mode only) */}
          {!isDashboard && (
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
            {/* Suggest button / mailbox confirmation / nothing */}
            {mailboxPhase && mailboxPhase !== "fadeIn" ? (
              <div
                className="rounded-full flex items-center justify-center"
                style={{ width: 40, height: 40, backgroundColor: partyColorDark || "#1E3A5F" }}
              >
                <FontAwesomeIcon
                  icon={mailboxPhase === "flagUp" ? faMailboxFlagUp : faMailbox}
                  style={{ color: partyColorLight || "#DBEAFE", fontSize: 20 }}
                />
              </div>
            ) : !success ? (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="cursor-pointer transition-opacity rounded-full flex items-center justify-center"
                style={{ width: 40, height: 40, backgroundColor: "#ffffff" }}
                aria-label="Foreslå et spørgsmål"
              >
                <FontAwesomeIcon icon={faCommentPlus} style={{ color: nameColor, fontSize: 20 }} />
              </button>
            ) : null}
          </div>
          )}

          {/* Desktop-only: expanded form input (replaces names on desktop) — citizen mode only */}
          {!isDashboard && formActive && (
            <div className="hidden sm:flex flex-1 items-center gap-2 min-w-0">
              <div className="relative flex-1 min-w-0" style={{ opacity: mailboxPhase ? 0 : 1, transition: "opacity 150ms ease-out", pointerEvents: mailboxPhase ? "none" : "auto" }}>
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
              {/* Send forslag button / mailbox confirmation */}
              {(text.trim().length > 0 || mailboxPhase) && (
                <button
                  ref={pillBtnRef}
                  type="submit"
                  disabled={pending || !!mailboxPhase}
                  className="group rounded-full whitespace-nowrap shrink-0 flex items-center justify-center cursor-pointer disabled:cursor-default text-base border-none"
                  style={{
                    ...(mailboxPhase
                      ? { backgroundColor: partyColorDark || "#1E3A5F" }
                      : { ...(hasSession ? { backgroundColor: nameColor, color: "#ffffff" } : { backgroundColor: partyTextColor, color: nameColor }) }),
                    ...(pillSizeRef.current
                      ? { width: pillSizeRef.current.width, height: pillSizeRef.current.height }
                      : { paddingLeft: 20, paddingRight: 20, paddingTop: 8, paddingBottom: 8 }),
                    fontFamily: "inherit",
                  }}
                >
                  {mailboxPhase ? (
                    <FontAwesomeIcon
                      icon={mailboxPhase === "flagUp" ? faMailboxFlagUp : faMailbox}
                      style={{ color: partyColorLight || "#DBEAFE", fontSize: 20 }}
                    />
                  ) : (
                    <span className={`transition-opacity ${pending ? "opacity-50" : "group-hover:opacity-50"}`}>
                      {pending ? "Sender..." : hasSession ? "Send forslag" : "Næste"}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Desktop-only: constituency + trigger button (normal mode) — citizen mode only */}
          {!isDashboard && !formActive && (
            <div className="ml-auto hidden sm:flex items-center gap-3 shrink-0" style={{ opacity: mailboxPhase === "fadeIn" ? 0 : 1, transition: mailboxPhase === null ? "opacity 300ms ease-out" : "none" }}>
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
              <button
                type="button"
                onClick={() => setFormActive(true)}
                className="bg-white text-base px-5 py-2 rounded-full whitespace-nowrap cursor-pointer"
                style={{ color: nameColor, opacity: mailboxPhase === "fadeIn" ? 0 : 1, transition: mailboxPhase === null ? "opacity 300ms ease-out" : "none" }}
              >
                Foreslå et spørgsmål...
              </button>
            </div>
          )}
        </div>

        {/* Error when logged in (desktop topbar submit) — citizen mode only */}
        {!isDashboard && formActive && error && hasSession && (
          <div className="px-[15px] pb-2">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}
      </form>

      {/* Suggestion modal (mobile: all users, desktop: logged-out only) — citizen mode only */}
      {!isDashboard && <SuggestionModal
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
          setText("");
          setFormActive(false);
          setModalOpen(false);
          startMailboxAnimation(false);
        }}
      />}
    </div>
  );
}
