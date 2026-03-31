"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightFromBracket, faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import { StickyPillNav, useStickyNavState } from "./StickyPillNav";
import { ThemeToggleButton } from "./ThemeToggleButton";

type Tab = "questions" | "causes" | "settings";

const tabs = [
  { id: "questions", label: "Spørgsmål" },
  { id: "causes", label: "Mærkesager" },
  { id: "settings", label: "Indstillinger" },
];

const createLabels: Partial<Record<Tab, string>> = {
  questions: "+ Opret",
  causes: "+ Opret",
};

type Props = {
  questionsTab: React.ReactNode;
  causesTab: React.ReactNode;
  settingsTab: React.ReactNode;
  logoutAction: () => Promise<void>;
  partyColor?: string | null;
  partyColorDark?: string | null;
};

export function DashboardTabs({ questionsTab, causesTab, settingsTab, logoutAction, partyColor, partyColorDark }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("questions");
  const scrollPositions = useRef<Record<Tab, number>>({ questions: 0, causes: 0, settings: 0 });
  const { isAtTop, canHover } = useStickyNavState();
  const [formOpen, setFormOpen] = useState(false);

  // Listen for form close from components (e.g. after successful submit)
  useEffect(() => {
    const handler = () => setFormOpen(false);
    window.addEventListener("dashboard-create-close", handler);
    return () => window.removeEventListener("dashboard-create-close", handler);
  }, []);

  // Reset formOpen on tab switch
  useEffect(() => { setFormOpen(false); }, [activeTab]);

  // Detect when the create button is about to stick (reach the nav)
  const [stuck, setStuck] = useState(false);
  const createWrapRef = useRef<HTMLDivElement>(null);
  const createBtnRef = useRef<HTMLButtonElement>(null);
  const [addBtnWidth, setAddBtnWidth] = useState(0);
  const [cancelBtnWidth, setCancelBtnWidth] = useState(0);
  const measureRef = useRef<HTMLSpanElement>(null);

  // Measure both button widths via hidden measure span
  const measuredRef = useRef(false);
  useEffect(() => {
    if (measureRef.current && !measuredRef.current && createLabel) {
      const el = measureRef.current;
      // Measure "Tilføj"
      el.textContent = createLabel.replace("+ ", "");
      const addW = 28 + el.offsetWidth + 17;
      setAddBtnWidth(addW);
      // Measure "Annuller"
      el.textContent = "Annuller";
      const cancelW = 28 + el.offsetWidth + 17;
      setCancelBtnWidth(cancelW);
      measuredRef.current = true;
    }
  });
  // Re-measure on tab change
  useEffect(() => { measuredRef.current = false; }, [activeTab]);

  // Track scroll: check if button's natural position is near the sticky threshold
  // Also calculate dockProgress (0→1) for gradual background fade
  const [dockProgress, setDockProgress] = useState(0);
  useEffect(() => {
    const fadeDistance = 60;
    function onScroll() {
      const el = createWrapRef.current;
      if (!el) { setStuck(false); setDockProgress(0); return; }
      const rect = el.getBoundingClientRect();
      const distanceToStick = rect.top - 94;
      setStuck(distanceToStick <= 40);
      const progress = Math.max(0, Math.min(1, 1 - distanceToStick / fadeDistance));
      setDockProgress(progress);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const switchTab = useCallback((id: string) => {
    scrollPositions.current[activeTab] = window.scrollY;
    const nextTab = id as Tab;
    setActiveTab(nextTab);
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollPositions.current[nextTab] });
    });
  }, [activeTab]);

  const content = activeTab === "questions" ? questionsTab : activeTab === "causes" ? causesTab : settingsTab;
  const createLabel = createLabels[activeTab];

  return (
    <>
      <StickyPillNav
        items={tabs}
        activeId={activeTab}
        onSelect={switchTab}
        dockedWidth={stuck && createLabel ? 32 + 8 : 0}
        dockProgress={createLabel ? dockProgress : 0}
        forceOpaque={!!createLabel}
        rightContent={
          <div className="flex items-center ml-auto">
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-full cursor-pointer transition-colors duration-150 flex items-center justify-center"
                style={{
                  width: 32,
                  height: 32,
                  backdropFilter: isAtTop ? "none" : "blur(12px)",
                  WebkitBackdropFilter: isAtTop ? "none" : "blur(12px)",
                  backgroundColor: isAtTop ? "var(--system-bg1)" : "color-mix(in srgb, var(--system-bg1) 70%, transparent)",
                  transition: "background-color 200ms ease, backdrop-filter 200ms ease",
                }}
                aria-label="Log ud"
                onPointerEnter={(e) => { if (!canHover.current) return; const svg = e.currentTarget.querySelector("svg"); if (svg) svg.style.color = "var(--system-text2)"; }}
                onPointerLeave={(e) => { if (!canHover.current) return; const svg = e.currentTarget.querySelector("svg"); if (svg) svg.style.color = "var(--system-text0)"; }}
              >
                <FontAwesomeIcon icon={faArrowRightFromBracket} style={{ color: "var(--system-text0)", transition: "color 150ms", fontSize: 15 }} />
              </button>
            </form>
          </div>
        }
      />
      {/* Hidden span for measuring text widths */}
      <span ref={measureRef} className="text-sm" style={{ position: "absolute", visibility: "hidden", fontFamily: "var(--font-figtree)", fontWeight: 500, whiteSpace: "nowrap" }} />
      {/* Create button — scrolls with content, sticks at nav level, shrinks to circle as it docks */}
      {createLabel && (() => {
        const circleSize = 32;
        const shrinkProgress = Math.max(0, Math.min(1, dockProgress));
        const baseWidth = formOpen ? cancelBtnWidth : addBtnWidth;
        const currentWidth = baseWidth > 0 ? baseWidth - (baseWidth - circleSize) * shrinkProgress : undefined;
        const textOpacity = 1 - shrinkProgress;
        return (
          <>
          <div style={{ height: 25 }} />
          <div ref={createWrapRef} className="sticky top-[94px] z-[41]" style={{ width: "fit-content" }}>
            <button
              ref={createBtnRef}
              onClick={(e) => {
                // Reset hover opacity before state change
                const svg = e.currentTarget.querySelector("svg");
                const span = e.currentTarget.querySelector("span");
                if (svg) svg.style.opacity = "1";
                if (span) span.style.opacity = String(textOpacity);
                if (formOpen) {
                  setFormOpen(false);
                  window.dispatchEvent(new CustomEvent("dashboard-create-close"));
                } else {
                  setFormOpen(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  window.dispatchEvent(new CustomEvent("dashboard-create-open", { detail: { tab: activeTab } }));
                }
              }}
              className="text-sm rounded-full cursor-pointer whitespace-nowrap overflow-hidden relative"
              style={{
                fontFamily: "var(--font-figtree)",
                fontWeight: 500,
                backgroundColor: formOpen
                  ? `color-mix(in srgb, ${partyColor || "#00D564"} 20%, transparent)`
                  : (partyColor || "#00D564"),
                color: partyColorDark || "#1E3A5F",
                width: currentWidth,
                height: circleSize,
              }}
              onPointerEnter={(e) => { if (!canHover.current) return; const svg = e.currentTarget.querySelector("svg"); const span = e.currentTarget.querySelector("span"); if (svg) svg.style.opacity = "0.5"; if (span) span.style.opacity = String(textOpacity * 0.5); }}
              onPointerLeave={(e) => { if (!canHover.current) return; const svg = e.currentTarget.querySelector("svg"); const span = e.currentTarget.querySelector("span"); if (svg) svg.style.opacity = "1"; if (span) span.style.opacity = String(textOpacity); }}
            >
              {formOpen ? (
                <>
                  <FontAwesomeIcon icon={faXmark} style={{ fontSize: 12, position: "absolute", left: circleSize / 2, top: "50%", transform: "translate(-50%, -50%)" }} />
                  <span style={{ opacity: textOpacity, position: "absolute", left: circleSize - 4, top: "50%", transform: "translateY(-50%)", whiteSpace: "nowrap" }}>
                    Annuller
                  </span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10, position: "absolute", left: circleSize / 2, top: "50%", transform: "translate(-50%, -50%)" }} />
                  <span style={{ opacity: textOpacity, position: "absolute", left: circleSize - 4, top: "50%", transform: "translateY(-50%)", whiteSpace: "nowrap" }}>
                    {createLabel?.replace("+ ", "")}
                  </span>
                </>
              )}
            </button>
          </div>
          <div style={{ height: 25 }} />
          </>
        );
      })()}
      <div className="space-y-6">
        {content}
      </div>
      <ThemeToggleButton />
    </>
  );
}
