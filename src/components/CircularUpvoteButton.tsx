"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faXmark, faThumbsUp } from "@fortawesome/free-solid-svg-icons";
import { faArrowUp as faArrowUpDuotone, faHourglass } from "@fortawesome/pro-duotone-svg-icons";
import { directUpvote, cancelUpvote } from "@/app/[partySlug]/[politicianSlug]/actions";
import { useSystemColors, useTheme } from "./SystemColorProvider";

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
 *   idle (hourglass 50%) → hover/tap1 (tooltip + arrow-up) → click/tap2 → onLoginUpvote (modal)
 *   After modal submit → "submitted" (check icon, "Tjek din e-mail" tooltip)
 *
 * LOGGED IN — goal NOT reached, NOT upvoted:
 *   idle (arrow-up) → hover (+1) → click/tap → directUpvote
 *
 * LOGGED IN — goal NOT reached, upvoted:
 *   idle (check on party color 50%) → hover/tap1 (xmark on red + "Vil du fjerne?") → click/tap2 (thumbs-up on red + "Er du sikker?") → click/tap3 → cancelUpvote
 *
 * LOGGED IN — goal reached, NOT upvoted:
 *   idle (hourglass 50%) → hover/tap1 (tooltip + arrow-up) → click/tap2 → directUpvote
 *
 * LOGGED IN — goal reached, upvoted:
 *   idle (hourglass 50%) → hover/tap1 (tooltip + xmark red) → click/tap2 → cancelUpvote
 */

type CircularUpvoteButtonProps = {
  questionId: string;
  isUpvoted: boolean;
  goalReached: boolean;
  hasSession: boolean;
  partySlug: string;
  politicianSlug: string;
  partyColor?: string | null;
  partyColorDark?: string | null;
  size?: number;
  onLoginUpvote?: () => void;
  goalReachedAt?: string | null;
  politicianFirstName?: string;
  /** Called after a successful upvote with the new upvoted/goalReached state */
  onUpvoteSuccess?: (newGoalReached: boolean) => void;
  /** Called after a successful cancel with the new goalReached state */
  onCancelSuccess?: (stillGoalReached: boolean) => void;
  /** Current upvote count — used to determine if upvote triggers goal */
  upvoteCount?: number;
  /** Goal threshold */
  upvoteGoal?: number;
  /** Tooltip position: "left" renders to the left of button, "top" renders above */
  tooltipPosition?: "left" | "top";
  /** Called when the upvote modal was submitted (logged-out flow) */
  onModalSubmitted?: () => void;
};

export function CircularUpvoteButton({
  questionId,
  isUpvoted,
  goalReached,
  hasSession,
  partySlug,
  politicianSlug,
  partyColor,
  partyColorDark,
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
  const { pending: colorPending, error: colorError, pendingContrast, errorContrast } = useSystemColors();
  const { isDark } = useTheme();
  const alphaHex = isDark ? "BF" : "80";
  const iconSize = Math.round(size * 0.525);
  const plusOneSize = Math.round(size * 0.4375);

  // Core state
  const [state, setState] = useState<"idle" | "pending" | "upvoted" | "goalReachedNotUpvoted" | "goalReachedUpvoted" | "submitted">(
    () => {
      if (goalReached && isUpvoted) return "goalReachedUpvoted";
      if (goalReached && !isUpvoted) return "goalReachedNotUpvoted";
      if (isUpvoted) return "upvoted";
      return "idle";
    }
  );

  // Hover state (desktop only via pointer events)
  const [isHovering, setIsHovering] = useState(false);
  // Mobile multi-tap: 0 = idle, 1 = first tap (armed), 2 = second tap (confirmed, for 3-tap flows)
  const [armed, setArmed] = useState(0);
  // Desktop multi-click for goalReachedUpvoted: false = hover showing xmark, true = clicked showing thumbs-up
  const [desktopConfirmed, setDesktopConfirmed] = useState(false);
  const isTouchRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const flipTooltipRef = useRef(false);

  // Sync state when server props change (e.g. after revalidation)
  useEffect(() => {
    if (goalReached && isUpvoted) setState("goalReachedUpvoted");
    else if (goalReached && !isUpvoted) setState("goalReachedNotUpvoted");
    else if (isUpvoted) setState("upvoted");
    else setState("idle");
    setArmed(0);
    setDesktopConfirmed(false);
    setIsHovering(false);
  }, [isUpvoted, goalReached]);

  // Notify parent when modal was submitted (logged-out flow completed)
  useEffect(() => {
    if (state === "submitted") {
      onModalSubmitted?.();
    }
  }, [state, onModalSubmitted]);

  // Deadline hours remaining
  const deadlineHoursLeft = useMemo(() => {
    if (!goalReachedAt) return null;
    const deadline = new Date(goalReachedAt).getTime() + 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((deadline - Date.now()) / (1000 * 60 * 60)));
  }, [goalReachedAt]);

  // Deadline tooltip text
  const deadlineText = useMemo(() => {
    if (deadlineHoursLeft !== null && deadlineHoursLeft > 0)
      return `${politicianFirstName} svarer inden for ${deadlineHoursLeft} timer`;
    if (deadlineHoursLeft === 0) return "Fristen er udløbet";
    return `Afventer svar fra ${politicianFirstName}`;
  }, [deadlineHoursLeft, politicianFirstName]);

  // Check if tooltip should flip below button or align right (synchronous via ref)
  const alignRightRef = useRef(false);
  const checkFlip = useCallback(() => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      flipTooltipRef.current = rect.top < 200;
      // If button center is within 150px of viewport right edge, align tooltip to right
      const distFromRight = window.innerWidth - rect.right;
      alignRightRef.current = distFromRight < 150;
    }
  }, []);

  // Pointer-aware hover
  const handlePointerEnter = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "mouse") {
      checkFlip();
      setIsHovering(true);
    }
  }, [checkFlip]);
  const handlePointerLeave = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "mouse") {
      setIsHovering(false);
      setArmed(0);
      setDesktopConfirmed(false);
    }
  }, []);

  // Upvote action
  const doUpvote = useCallback(async () => {
    if (!hasSession) {
      onLoginUpvote?.();
      return;
    }
    setState("pending");
    try {
      await directUpvote(questionId, partySlug, politicianSlug);
      const newGoalReached = upvoteCount !== undefined && upvoteGoal !== undefined
        ? (upvoteCount + 1) >= upvoteGoal
        : goalReached;
      setIsHovering(false);
      setArmed(0);
      setDesktopConfirmed(false);
      if (newGoalReached) {
        setState("goalReachedUpvoted");
      } else {
        setState("upvoted");
      }
      window.dispatchEvent(new CustomEvent("upvote-banner", { detail: { message: "Din upvote er registreret" } }));
      onUpvoteSuccess?.(newGoalReached);
    } catch {
      // Revert to previous state
      if (goalReached) setState("goalReachedNotUpvoted");
      else setState("idle");
    }
  }, [hasSession, questionId, partySlug, politicianSlug, upvoteCount, upvoteGoal, goalReached, onLoginUpvote, onUpvoteSuccess]);

  // Cancel upvote action
  const doCancel = useCallback(async () => {
    const prevState = state;
    setState("pending");
    try {
      await cancelUpvote(questionId, partySlug, politicianSlug);
      setIsHovering(false);
      setArmed(0);
      setDesktopConfirmed(false);
      // After cancel: check if still goal-reached
      const stillGoalReached = upvoteCount !== undefined && upvoteGoal !== undefined
        ? (upvoteCount - 1) >= upvoteGoal
        : false;
      if (stillGoalReached) {
        setState("goalReachedNotUpvoted");
      } else {
        setState("idle");
      }
      window.dispatchEvent(new CustomEvent("upvote-banner", { detail: { message: "Din upvote er fjernet" } }));
      onCancelSuccess?.(stillGoalReached);
    } catch {
      setState(prevState);
    }
  }, [state, questionId, partySlug, politicianSlug, upvoteCount, upvoteGoal, onCancelSuccess]);

  // Mark as submitted (called by parent after modal form submission)
  const markSubmitted = useCallback(() => {
    setState("submitted");
  }, []);

  // Expose markSubmitted via a ref-like pattern through window event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.questionId === questionId) {
        markSubmitted();
      }
    };
    window.addEventListener("upvote-submitted", handler);
    return () => window.removeEventListener("upvote-submitted", handler);
  }, [questionId, markSubmitted]);

  // Click handler — routes to correct action based on state + touch/mouse
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    checkFlip();
    const isTouch = isTouchRef.current;

    switch (state) {
      case "idle": {
        // LOGGED IN/OUT — goal not reached, not upvoted → upvote or modal
        doUpvote();
        break;
      }
      case "upvoted": {
        // LOGGED IN — goal not reached, upvoted → 3-tap mobile / 2-click desktop
        if (isTouch) {
          if (armed === 0) {
            setArmed(1); // tap 1: show xmark + "Vil du fjerne din tidligere upvote?"
          } else if (armed === 1) {
            setArmed(2); // tap 2: show thumbs-up + "Er du sikker?"
          } else {
            doCancel(); // tap 3: execute cancel
          }
        } else {
          if (!desktopConfirmed) {
            setDesktopConfirmed(true); // click 1: show thumbs-up + "Er du sikker?"
          } else {
            doCancel(); // click 2: execute cancel
          }
        }
        break;
      }
      case "goalReachedNotUpvoted": {
        // Goal reached, not upvoted → 2-tap to upvote
        if (isTouch && armed === 0) {
          setArmed(1);
        } else {
          doUpvote();
        }
        break;
      }
      case "goalReachedUpvoted": {
        // Goal reached, upvoted → 3-tap mobile / 2-click desktop
        if (isTouch) {
          if (armed === 0) {
            setArmed(1); // tap 1: show xmark + "...Vil du fjerne..."
          } else if (armed === 1) {
            setArmed(2); // tap 2: show thumbs-up + "Er du sikker?"
          } else {
            doCancel(); // tap 3: execute
          }
        } else {
          // Desktop: first click shows thumbs-up + "Er du sikker?", second click executes
          if (!desktopConfirmed) {
            setDesktopConfirmed(true);
          } else {
            doCancel();
          }
        }
        break;
      }
      case "submitted": {
        // No action — just show tooltip
        if (isTouch && armed === 0) {
          setArmed(1);
        }
        break;
      }
      case "pending":
        break;
    }
  }, [state, armed, desktopConfirmed, doUpvote, doCancel, checkFlip]);

  // Tooltip content and styling
  const renderTooltip = () => {
    const active = isHovering || armed > 0;
    if (!active) return null;

    let content: React.ReactNode = null;
    let bgColor = partyColor || "#7E7D7A";
    let width: number | undefined = undefined;

    switch (state) {
      case "goalReachedNotUpvoted": {
        if (!hasSession) {
          // Logged out — 2-line tooltip
          width = 260;
          content = (
            <>
              <span className="text-sm block" style={{ color: "#ffffff" }}>{deadlineText}.</span>
              <span className="text-sm block mt-1" style={{ color: partyColorDark || "#0E412E" }}>
                Dette spørgsmål har nået sit upvote-mål. Sæt din egen upvote for at blive notificeret, når {politicianFirstName} svarer.
              </span>
            </>
          );
        } else {
          // Logged in — 2-line tooltip
          width = 260;
          content = (
            <>
              <span className="text-sm block" style={{ color: "#ffffff" }}>{deadlineText}.</span>
              <span className="text-sm block mt-1" style={{ color: partyColorDark || "#0E412E" }}>
                Dette spørgsmål har nået sit upvote-mål. Sæt din egen upvote for at blive notificeret, når {politicianFirstName} svarer.
              </span>
            </>
          );
        }
        break;
      }
      case "goalReachedUpvoted": {
        bgColor = colorError;
        // Desktop: hover = first text, after click = "Er du sikker?"
        // Mobile: tap1 (armed=1) = first text, tap2 (armed=2) = "Er du sikker?"
        const showConfirmText = desktopConfirmed || armed === 2;
        if (showConfirmText) {
          content = <span className="text-sm" style={{ color: errorContrast }}>Er du sikker?</span>;
          // Short text — no fixed width, let it follow text width
        } else {
          width = 240;
          content = (
            <span className="text-sm" style={{ color: errorContrast }}>
              <span style={{ opacity: 0.5 }}>{deadlineText}.</span> Vil du fjerne din tidligere upvote?
            </span>
          );
        }
        break;
      }
      case "upvoted": {
        bgColor = colorError;
        const showConfirm = desktopConfirmed || armed === 2;
        if (showConfirm) {
          content = <span className="text-sm" style={{ color: errorContrast }}>Er du sikker?</span>;
        } else {
          width = 240;
          content = <span className="text-sm" style={{ color: errorContrast }}>Vil du fjerne din tidligere upvote?</span>;
        }
        break;
      }
      case "submitted": {
        content = <span className="text-sm" style={{ color: "#ffffff" }}>Tjek din e-mail</span>;
        break;
      }
      default:
        return null;
    }

    if (!content) return null;

    // Red tooltips (cancel flows) use fixed width; on mobile right-aligned, on desktop centered
    const isRedTooltip = bgColor === colorError;

    const flipped = flipTooltipRef.current;
    const alignRight = alignRightRef.current;
    // Desktop horizontal: centered unless near right edge → right-aligned
    const desktopH = alignRight ? "sm:right-0" : "sm:right-auto sm:left-1/2 sm:-translate-x-1/2";

    let positionClasses: string;
    let positionStyle: React.CSSProperties = {};
    if (isRedTooltip && tooltipPosition === "left") {
      positionClasses = "absolute right-full mr-3 top-0";
    } else if (isRedTooltip) {
      positionClasses = flipped
        ? `absolute right-0 ${desktopH}`
        : `absolute bottom-full mb-2 right-0 ${desktopH}`;
      if (flipped) positionStyle = { top: "100%", marginTop: 8 };
    } else if (tooltipPosition === "left") {
      positionClasses = "absolute right-full mr-3 top-0";
    } else {
      positionClasses = flipped
        ? `absolute right-0 ${desktopH}`
        : `absolute bottom-full mb-2 right-0 ${desktopH}`;
      if (flipped) positionStyle = { top: "100%", marginTop: 8 };
    }

    return (
      <div
        className={`${positionClasses} rounded-xl px-4 py-3`}
        style={{
          ...positionStyle,
          backgroundColor: bgColor,
          fontFamily: "var(--font-figtree)",
          fontWeight: 500,
          whiteSpace: width ? "normal" : "nowrap",
          width,
          zIndex: 30,
          pointerEvents: "none",
        }}
      >
        {content}
      </div>
    );
  };

  // Button appearance based on state + hover/armed
  const getButtonAppearance = (): { icon: typeof faCheck; iconColor: string; bgColor: string; label: string } => {
    const active = isHovering || armed > 0;

    switch (state) {
      case "idle":
        // Arrow-up on party color; hover → +1 on dark (handled separately in render)
        return {
          icon: faArrowUpDuotone,
          iconColor: partyColorDark || "#0E412E",
          bgColor: active ? (partyColorDark || "#0E412E") : (partyColor || "#00D564"),
          label: "Upvote",
        };

      case "upvoted":
        // Desktop: hover = xmark on red, desktopConfirmed = thumbs-up on red
        // Mobile: idle = check, armed=1 = xmark on red, armed=2 = thumbs-up on red
        if (desktopConfirmed || armed === 2) {
          return {
            icon: faThumbsUp,
            iconColor: errorContrast,
            bgColor: `${colorError}${alphaHex}`,
            label: "Bekræft fjern upvote",
          };
        }
        if ((isHovering && !isTouchRef.current) || armed === 1) {
          return {
            icon: faXmark,
            iconColor: errorContrast,
            bgColor: `${colorError}${alphaHex}`,
            label: "Fjern upvote",
          };
        }
        // Idle: check on party color with opacity (same as "submitted" / "Tjek din e-mail" state)
        return {
          icon: faCheck,
          iconColor: partyColorDark || "#0E412E",
          bgColor: `${partyColor || "#00D564"}${alphaHex}`,
          label: "Du har upvoted",
        };

      case "goalReachedNotUpvoted":
        if (active) {
          // Arrow-up on full party color
          return {
            icon: faArrowUpDuotone,
            iconColor: partyColorDark || "#0E412E",
            bgColor: partyColor || "#00D564",
            label: "Upvote",
          };
        }
        // Hourglass on yellow
        return {
          icon: faHourglass,
          iconColor: pendingContrast,
          bgColor: `${colorPending}${alphaHex}`,
          label: "Afventer svar",
        };

      case "goalReachedUpvoted": {
        const showConfirm = desktopConfirmed || armed === 2;
        if (active && showConfirm) {
          // Thumbs-up on red (confirmation step)
          return {
            icon: faThumbsUp,
            iconColor: errorContrast,
            bgColor: `${colorError}${alphaHex}`,
            label: "Bekræft fjern upvote",
          };
        }
        if (active) {
          // Xmark on red (first interaction)
          return {
            icon: faXmark,
            iconColor: errorContrast,
            bgColor: `${colorError}${alphaHex}`,
            label: "Fjern upvote",
          };
        }
        // Hourglass on yellow
        return {
          icon: faHourglass,
          iconColor: pendingContrast,
          bgColor: `${colorPending}${alphaHex}`,
          label: "Afventer svar",
        };
      }

      case "submitted":
        // Check on 50% party color
        return {
          icon: faCheck,
          iconColor: partyColorDark || "#0E412E",
          bgColor: `${partyColor || "#00D564"}80`,
          label: "Upvote sendt",
        };

      case "pending":
        return {
          icon: faArrowUpDuotone,
          iconColor: partyColorDark || "#0E412E",
          bgColor: partyColor || "#00D564",
          label: "Behandler...",
        };
    }
  };

  const appearance = getButtonAppearance();
  const showPlusOne = state === "idle" && (isHovering || armed > 0);

  return (
    <>
      {/* Invisible backdrop to dismiss armed state on outside tap (mobile) */}
      {armed > 0 && (
        <div
          className="fixed inset-0 z-10"
          onClick={(e) => { e.stopPropagation(); setArmed(0); setDesktopConfirmed(false); }}
        />
      )}
      <div ref={wrapperRef} className="relative" style={{ zIndex: armed > 0 || desktopConfirmed ? 20 : undefined }}>
        {renderTooltip()}
        <button
          onPointerDown={(e) => { isTouchRef.current = e.pointerType === "touch"; }}
          onClick={handleClick}
          disabled={state === "pending"}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          className="cursor-pointer rounded-full flex items-center justify-center disabled:opacity-50 relative z-20"
          style={{
            width: size,
            height: size,
            backgroundColor: appearance.bgColor,
          }}
          aria-label={appearance.label}
        >
          {showPlusOne ? (
            <span
              style={{
                color: "#FFFFFF",
                fontSize: plusOneSize,
                fontFamily: "var(--font-figtree)",
                fontWeight: 700,
              }}
            >
              +1
            </span>
          ) : (
            <FontAwesomeIcon
              icon={appearance.icon}
              style={{ color: appearance.iconColor, fontSize: iconSize }}
            />
          )}
        </button>
      </div>
    </>
  );
}
