"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightFromBracket, faPlus } from "@fortawesome/free-solid-svg-icons";
import { StickyPillNav, useStickyNavState } from "./StickyPillNav";
import { ThemeToggleButton } from "./ThemeToggleButton";

type Tab = "questions" | "causes" | "settings";

const tabs = [
  { id: "questions", label: "Spørgsmål" },
  { id: "causes", label: "Mærkesager" },
  { id: "settings", label: "Indstillinger" },
];

const createLabels: Partial<Record<Tab, string>> = {
  questions: "+ Tilføj",
  causes: "+ Tilføj",
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

  // Detect when the create button is about to stick (reach the nav)
  const [stuck, setStuck] = useState(false);
  const createWrapRef = useRef<HTMLDivElement>(null);
  const createBtnRef = useRef<HTMLButtonElement>(null);
  const [createBtnWidth, setCreateBtnWidth] = useState(0);

  // Measure button's natural (unshrunk) width once via the text span
  const measuredRef = useRef(false);
  useEffect(() => {
    if (createBtnRef.current && !measuredRef.current) {
      const span = createBtnRef.current.querySelector("span");
      if (span) {
        const textWidth = span.offsetWidth;
        setCreateBtnWidth(28 + textWidth + 17); // icon area (28) + text + right padding (17)
        measuredRef.current = true;
      }
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
      {/* Create button — scrolls with content, sticks at nav level, shrinks to circle as it docks */}
      {createLabel && (() => {
        const circleSize = 32;
        const shrinkProgress = Math.max(0, Math.min(1, dockProgress));
        const currentWidth = createBtnWidth > 0 ? createBtnWidth - (createBtnWidth - circleSize) * shrinkProgress : undefined;
        const textOpacity = 1 - shrinkProgress;
        return (
          <div ref={createWrapRef} style={{ position: "sticky", top: 94, zIndex: 41, marginTop: 25, marginBottom: 25, width: "fit-content" }}>
            <button
              ref={createBtnRef}
              onClick={() => window.dispatchEvent(new CustomEvent("dashboard-create-open", { detail: { tab: activeTab } }))}
              className="text-sm rounded-full cursor-pointer whitespace-nowrap overflow-hidden relative"
              style={{
                fontFamily: "var(--font-figtree)",
                fontWeight: 500,
                backgroundColor: partyColor || "#00D564",
                color: partyColorDark || "#1E3A5F",
                width: currentWidth,
                height: circleSize,
              }}
              onPointerEnter={(e) => { if (!canHover.current) return; e.currentTarget.style.opacity = "0.5"; }}
              onPointerLeave={(e) => { if (!canHover.current) return; e.currentTarget.style.opacity = "1"; }}
            >
              {/* Plus icon — always centered in the leftmost 32px circle */}
              <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10, position: "absolute", left: circleSize / 2, top: "50%", transform: "translate(-50%, -50%)" }} />
              {/* Text label — fixed position, fades/clips during shrink */}
              <span style={{ opacity: textOpacity, position: "absolute", left: circleSize - 4, top: "50%", transform: "translateY(-50%)", whiteSpace: "nowrap" }}>
                {createLabel?.replace("+ ", "")}
              </span>
            </button>
          </div>
        );
      })()}
      <div className="space-y-6">
        {content}
      </div>
      <ThemeToggleButton />
    </>
  );
}
