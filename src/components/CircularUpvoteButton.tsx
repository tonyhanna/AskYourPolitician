"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faXmark, faThumbsUp } from "@fortawesome/free-solid-svg-icons";
import { faArrowUp as faArrowUpDuotone, faHourglass } from "@fortawesome/pro-duotone-svg-icons";
import { directUpvote, cancelUpvote } from "@/app/[partySlug]/[politicianSlug]/actions";
import { useTheme } from "./SystemColorProvider";

/**
 * Shared circular upvote button used in both UnansweredQuestionCard and QuestionDetailCard.
 *
 * State machine covers 6 scenarios:
 *
 * LOGGED OUT — goal NOT reached:
 *   idle → tap/click → onLoginUpvote (modal)
 *   After modal submit → "submitted" (check icon, "Tjek din e-mail" tooltip)
 *
 * LOGGED OUT — goal reached:
 *   idle (hourglass) → hover/tap1 (tooltip + arrow-up) → click/tap2 → onLoginUpvote (modal)
 *   After modal submit → "submitted" (check icon, "Tjek din e-mail" tooltip)
 *
 * LOGGED IN — goal NOT reached, NOT upvoted:
 *   idle (arrow-up) → hover (+1) → click/tap → directUpvote
 *
 * LOGGED IN — goal NOT reached, upvoted:
 *   idle (check) → hover/tap1 (xmark + "Vil du fjerne?") → click/tap2 (thumbs-up + "Er du sikker?") → click/tap3 → cancelUpvote
 *
 * LOGGED IN — goal reached, NOT upvoted:
 *   idle (hourglass) → hover/tap1 (tooltip + arrow-up) → click/tap2 → directUpvote
 *
 * LOGGED IN — goal reached, upvoted:
 *   idle (hourglass) → hover/tap1 (tooltip + xmark) → click/tap2 (thumbs-up + "Er du sikker?") → click/tap3 → cancelUpvote
 */

type State = "idle" | "pending" | "upvoted" | "goalReachedNotUpvoted" | "goalReachedUpvoted" | "submitted";

type CircularUpvoteButtonProps = {
  questionId: string;
  isUpvoted: boolean;
  goalReached: boolean;
  hasSession: boolean;
  partySlug: string;
  politicianSlug: string;
  size?: number;
  onLoginUpvote?: () => void;
  goalReachedAt?: string | null;
  politicianFirstName?: string;
  onUpvoteSuccess?: (newGoalReached: boolean) => void;
  onCancelSuccess?: (stillGoalReached: boolean) => void;
  upvoteCount?: number;
  upvoteGoal?: number;
  tooltipPosition?: "left" | "top";
  onModalSubmitted?: () => void;
};

export function CircularUpvoteButton({
  questionId,
  isUpvoted,
  goalReached,
  hasSession,
  partySlug,
  politicianSlug,
  size = 40,
  onLoginUpvote,
  goalReachedAt,
  politicianFirstName,
  onUpvoteSuccess,
  onCancelSuccess,
  upvoteCount,
  upvoteGoal,
  tooltipPosition = "left",
  onModalSubmitted,
}: CircularUpvoteButtonProps) {
  const { isDark } = useTheme();
  const iconSize = Math.round(size * 0.525);
  const plusOneSize = Math.round(size * 0.4375);

  // Party colors from CSS variables
  const pp = "var(--inline-btn-bg, #FF0000)";
  const pd = "var(--inline-btn-icon, #FF0000)";
  const pl = "var(--party-light, #FF0000)";
  // System colors with alpha via color-mix
  const redBg = isDark
    ? "color-mix(in srgb, var(--system-error, #FF0000) 75%, transparent)"
    : "color-mix(in srgb, var(--system-error, #FF0000) 50%, transparent)";
  const yellowBg = isDark
    ? "color-mix(in srgb, var(--system-pending, #FF0000) 75%, transparent)"
    : "color-mix(in srgb, var(--system-pending, #FF0000) 50%, transparent)";
  const errorContrast = "var(--system-error-contrast, #FF0000)";
  const pendingContrast = "var(--system-pending-contrast, #FF0000)";
  // Party color with alpha
  const ppAlpha = isDark
    ? "color-mix(in srgb, var(--inline-btn-bg, #FF0000) 75%, transparent)"
    : "color-mix(in srgb, var(--inline-btn-bg, #FF0000) 50%, transparent)";

  // ── Core state ──────────────────────────────────────────────────────
  const [state, setState] = useState<State>(() => deriveState(goalReached, isUpvoted));
  const [isHovering, setIsHovering] = useState(false);
  const [armed, setArmed] = useState(0); // Mobile multi-tap: 0=idle, 1=first, 2=confirmed
  const [desktopConfirmed, setDesktopConfirmed] = useState(false);
  const isTouchRef = useRef(false);
  const canHoverRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const flipTooltipRef = useRef(false);
  const alignRightRef = useRef(false);

  useEffect(() => { canHoverRef.current = window.matchMedia("(hover: hover)").matches; }, []);

  // Sync state when server props change
  useEffect(() => {
    setState(deriveState(goalReached, isUpvoted));
    resetInteraction();
  }, [isUpvoted, goalReached]);

  useEffect(() => { if (state === "submitted") onModalSubmitted?.(); }, [state, onModalSubmitted]);

  // Reset when another upvote button becomes armed
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.questionId !== questionId) resetInteraction();
    };
    window.addEventListener("upvote-armed", handler);
    return () => window.removeEventListener("upvote-armed", handler);
  }, [questionId]);

  // Dismiss on tap/click outside button (replaces transparent overlay)
  useEffect(() => {
    if (armed === 0 && !desktopConfirmed) return;
    const handler = (e: TouchEvent | MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        resetInteraction();
      }
    };
    document.addEventListener("touchstart", handler, { capture: true });
    document.addEventListener("mousedown", handler, { capture: true });
    return () => {
      document.removeEventListener("touchstart", handler, { capture: true });
      document.removeEventListener("mousedown", handler, { capture: true });
    };
  }, [armed, desktopConfirmed]);

  // ── Deadline info ───────────────────────────────────────────────────
  const deadlineHoursLeft = useMemo(() => {
    if (!goalReachedAt) return null;
    const deadline = new Date(goalReachedAt).getTime() + 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((deadline - Date.now()) / (1000 * 60 * 60)));
  }, [goalReachedAt]);

  const deadlineText = useMemo(() => {
    if (deadlineHoursLeft !== null && deadlineHoursLeft > 0)
      return `${politicianFirstName} svarer inden for ${deadlineHoursLeft} timer`;
    if (deadlineHoursLeft === 0) return "Fristen er udløbet";
    return `Afventer svar fra ${politicianFirstName}`;
  }, [deadlineHoursLeft, politicianFirstName]);

  // ── Helpers ─────────────────────────────────────────────────────────
  function resetInteraction() {
    setArmed(0);
    setDesktopConfirmed(false);
    setIsHovering(false);
  }

  const checkFlip = useCallback(() => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      flipTooltipRef.current = rect.top < 200;
      alignRightRef.current = (window.innerWidth - rect.right) < 150;
    }
  }, []);

  // ── Pointer handlers ────────────────────────────────────────────────
  const handlePointerEnter = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && canHoverRef.current) { checkFlip(); setIsHovering(true); }
  }, [checkFlip]);

  const handlePointerLeave = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && canHoverRef.current) resetInteraction();
  }, []);

  // ── Server actions ──────────────────────────────────────────────────
  const doUpvote = useCallback(async () => {
    if (!hasSession) { onLoginUpvote?.(); return; }
    setState("pending");
    try {
      await directUpvote(questionId, partySlug, politicianSlug);
      const newGoalReached = upvoteCount !== undefined && upvoteGoal !== undefined
        ? (upvoteCount + 1) >= upvoteGoal : goalReached;
      resetInteraction();
      setState(newGoalReached ? "goalReachedUpvoted" : "upvoted");
      window.dispatchEvent(new CustomEvent("upvote-banner", { detail: { message: "Din upvote er registreret" } }));
      onUpvoteSuccess?.(newGoalReached);
    } catch {
      setState(goalReached ? "goalReachedNotUpvoted" : "idle");
    }
  }, [hasSession, questionId, partySlug, politicianSlug, upvoteCount, upvoteGoal, goalReached, onLoginUpvote, onUpvoteSuccess]);

  const doCancel = useCallback(async () => {
    const prevState = state;
    setState("pending");
    try {
      await cancelUpvote(questionId, partySlug, politicianSlug);
      resetInteraction();
      const stillGoalReached = upvoteCount !== undefined && upvoteGoal !== undefined
        ? (upvoteCount - 1) >= upvoteGoal : false;
      setState(stillGoalReached ? "goalReachedNotUpvoted" : "idle");
      window.dispatchEvent(new CustomEvent("upvote-banner", { detail: { message: "Din upvote er fjernet" } }));
      onCancelSuccess?.(stillGoalReached);
    } catch {
      setState(prevState);
    }
  }, [state, questionId, partySlug, politicianSlug, upvoteCount, upvoteGoal, onCancelSuccess]);

  // Listen for modal submission event
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.questionId === questionId) setState("submitted");
    };
    window.addEventListener("upvote-submitted", handler);
    return () => window.removeEventListener("upvote-submitted", handler);
  }, [questionId]);

  // ── Click handler (state machine router) ────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    checkFlip();
    const isTouch = isTouchRef.current;

    switch (state) {
      case "idle":
        doUpvote();
        break;

      case "upvoted":
      case "goalReachedUpvoted":
        // Both cancel flows use 3-tap mobile / 2-click desktop
        if (isTouch) {
          if (armed < 2) {
            const next = armed + 1;
            setArmed(next);
            window.dispatchEvent(new CustomEvent("upvote-armed", { detail: { questionId } }));
          } else doCancel();
        } else {
          if (!desktopConfirmed) {
            setDesktopConfirmed(true);
            window.dispatchEvent(new CustomEvent("upvote-armed", { detail: { questionId } }));
          } else doCancel();
        }
        break;

      case "goalReachedNotUpvoted":
        if (isTouch && armed === 0) {
          setArmed(1);
          window.dispatchEvent(new CustomEvent("upvote-armed", { detail: { questionId } }));
        } else doUpvote();
        break;

      case "submitted":
        if (isTouch && armed === 0) {
          setArmed(1);
          window.dispatchEvent(new CustomEvent("upvote-armed", { detail: { questionId } }));
        }
        break;

      case "pending":
        break;
    }
  }, [state, armed, desktopConfirmed, doUpvote, doCancel, checkFlip]);

  // ── Tooltip ─────────────────────────────────────────────────────────
  const tooltip = useMemo(() => {
    const active = isHovering || armed > 0;
    if (!active) return null;

    const isConfirmStep = desktopConfirmed || armed === 2;

    switch (state) {
      case "goalReachedNotUpvoted":
        return {
          bg: ppAlpha, width: 260,
          content: (
            <>
              <span className="text-sm block" style={{ color: pd, opacity: 0.5 }}>{deadlineText}.</span>
              <span className="text-sm block mt-1" style={{ color: pd }}>
                Dette spørgsmål har nået sit upvote-mål. Sæt din egen upvote for at blive notificeret, når {politicianFirstName} svarer.
              </span>
            </>
          ),
        };

      case "goalReachedUpvoted":
        return isConfirmStep
          ? { bg: redBg, content: <span className="text-sm" style={{ color: errorContrast }}>Er du sikker?</span> }
          : { bg: redBg, width: 240, content: (
              <span className="text-sm" style={{ color: errorContrast }}>
                <span style={{ opacity: 0.5 }}>{deadlineText}.</span> Vil du fjerne din tidligere upvote?
              </span>
            )};

      case "upvoted":
        return isConfirmStep
          ? { bg: redBg, content: <span className="text-sm" style={{ color: errorContrast }}>Er du sikker?</span> }
          : { bg: redBg, content: <span className="text-sm" style={{ color: errorContrast }}>Vil du fjerne din tidligere upvote?</span> };

      case "submitted":
        return { bg: ppAlpha, content: <span className="text-sm" style={{ color: pd }}>Tjek din e-mail</span> };

      default:
        return null;
    }
  }, [isHovering, armed, desktopConfirmed, state, ppAlpha, pd, redBg, errorContrast, deadlineText, politicianFirstName]);

  // ── Button appearance ───────────────────────────────────────────────
  const appearance = useMemo(() => {
    const active = isHovering || armed > 0;
    const isConfirmStep = desktopConfirmed || armed === 2;
    const isFirstStep = (isHovering && !isTouchRef.current) || armed === 1;

    switch (state) {
      case "idle":
        return { icon: faArrowUpDuotone, iconColor: pd, bgColor: active ? "var(--system-bg0-contrast, #FF0000)" : pp, label: "Upvote" };

      case "upvoted":
        if (isConfirmStep) return { icon: faThumbsUp, iconColor: errorContrast, bgColor: redBg, label: "Bekræft fjern upvote" };
        if (isFirstStep) return { icon: faXmark, iconColor: errorContrast, bgColor: redBg, label: "Fjern upvote" };
        return { icon: faCheck, iconColor: pd, bgColor: ppAlpha, label: "Du har upvoted" };

      case "goalReachedNotUpvoted":
        if (active) return { icon: faArrowUpDuotone, iconColor: pd, bgColor: pp, label: "Upvote" };
        return { icon: faHourglass, iconColor: pendingContrast, bgColor: yellowBg, label: "Afventer svar" };

      case "goalReachedUpvoted":
        if (active && isConfirmStep) return { icon: faThumbsUp, iconColor: errorContrast, bgColor: redBg, label: "Bekræft fjern upvote" };
        if (active) return { icon: faXmark, iconColor: errorContrast, bgColor: redBg, label: "Fjern upvote" };
        return { icon: faHourglass, iconColor: pendingContrast, bgColor: yellowBg, label: "Afventer svar" };

      case "submitted":
        return { icon: faCheck, iconColor: pd, bgColor: ppAlpha, label: "Upvote sendt" };

      case "pending":
        return { icon: faArrowUpDuotone, iconColor: pd, bgColor: pp, label: "Behandler..." };
    }
  }, [state, isHovering, armed, desktopConfirmed, pp, pd, ppAlpha, redBg, yellowBg, pendingContrast, errorContrast]);

  const showPlusOne = state === "idle" && (isHovering || armed > 0);

  // ── Tooltip position ────────────────────────────────────────────────
  const tooltipEl = useMemo(() => {
    if (!tooltip) return null;
    const isRed = tooltip.bg.includes("system-error");
    const flipped = flipTooltipRef.current;
    const alignRight = alignRightRef.current;
    const desktopH = alignRight ? "sm:right-0" : "sm:right-auto sm:left-1/2 sm:-translate-x-1/2";

    let posClasses: string;
    let posStyle: React.CSSProperties = {};
    if (tooltipPosition === "left") {
      posClasses = "absolute right-full mr-3 top-0";
    } else if (flipped) {
      posClasses = `absolute right-0 ${desktopH}`;
      posStyle = { top: "100%", marginTop: 8 };
    } else {
      posClasses = `absolute bottom-full mb-2 right-0 ${desktopH}`;
    }

    return (
      <div
        className={`${posClasses} rounded-xl px-4 py-3`}
        style={{
          ...posStyle,
          backgroundColor: tooltip.bg,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          fontFamily: "var(--font-figtree)",
          fontWeight: 500,
          whiteSpace: tooltip.width ? "normal" : "nowrap",
          width: tooltip.width,
          zIndex: 30,
          pointerEvents: "none",
        }}
      >
        {tooltip.content}
      </div>
    );
  }, [tooltip, tooltipPosition]);

  // ── Render ──────────────────────────────────────────────────────────
  return (
      <div ref={wrapperRef} className="relative" style={{ zIndex: armed > 0 || desktopConfirmed ? 20 : undefined }}>
        {tooltipEl}
        <button
          onPointerDown={(e) => { isTouchRef.current = e.pointerType === "touch"; }}
          onClick={handleClick}
          disabled={state === "pending"}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          className="cursor-pointer rounded-full flex items-center justify-center disabled:opacity-50 relative z-20"
          style={{ width: size, height: size, backgroundColor: appearance.bgColor }}
          aria-label={appearance.label}
        >
          {showPlusOne ? (
            <span style={{ color: "var(--system-text0-contrast, #FF0000)", fontSize: plusOneSize, fontFamily: "var(--font-figtree)", fontWeight: 700 }}>+1</span>
          ) : (
            <FontAwesomeIcon icon={appearance.icon} style={{ color: appearance.iconColor, fontSize: iconSize }} />
          )}
        </button>
      </div>
  );
}

/** Derive initial state from server props */
function deriveState(goalReached: boolean, isUpvoted: boolean): State {
  if (goalReached && isUpvoted) return "goalReachedUpvoted";
  if (goalReached) return "goalReachedNotUpvoted";
  if (isUpvoted) return "upvoted";
  return "idle";
}
