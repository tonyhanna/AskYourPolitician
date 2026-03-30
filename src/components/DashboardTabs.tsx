"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { StickyPillNav, useStickyNavState } from "./StickyPillNav";
import { ThemeToggleButton } from "./ThemeToggleButton";

type Tab = "questions" | "causes" | "settings";

const tabs = [
  { id: "questions", label: "Spørgsmål" },
  { id: "causes", label: "Mærkesager" },
  { id: "settings", label: "Indstillinger" },
];

const createLabels: Partial<Record<Tab, string>> = {
  questions: "+ Opret spørgsmål",
  causes: "+ Opret mærkesag",
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
  const [docked, setDocked] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver on sentinel to detect when create button scrolls out
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setDocked(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-120px 0px 0px 0px" } // account for sticky topbar + nav
    );
    observer.observe(el);
    return () => observer.disconnect();
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

  // Docked create button for the nav
  const dockedButton = docked && createLabel ? (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("dashboard-create-open", { detail: { tab: activeTab } }))}
      className="text-sm px-3 py-1.5 rounded-full cursor-pointer"
      style={{
        fontFamily: "var(--font-figtree)",
        fontWeight: 500,
        backgroundColor: partyColor || "#00D564",
        color: partyColorDark || "#1E3A5F",
      }}
      onPointerEnter={(e) => { if (!canHover.current) return; const s = e.currentTarget.querySelector("span"); if (s) s.style.opacity = "0.5"; }}
      onPointerLeave={(e) => { if (!canHover.current) return; const s = e.currentTarget.querySelector("span"); if (s) s.style.opacity = "1"; }}
    >
      <span>{createLabel}</span>
    </button>
  ) : undefined;

  return (
    <>
      <StickyPillNav
        items={tabs}
        activeId={activeTab}
        onSelect={switchTab}
        dockedContent={dockedButton}
        rightContent={
          <div className="flex items-center ml-auto">
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-full cursor-pointer transition-colors duration-150 flex items-center justify-center"
                style={{
                  width: 34,
                  height: 34,
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
      {/* Sentinel for IntersectionObserver — placed where the create button normally sits */}
      <div ref={sentinelRef} style={{ height: 1 }} />
      <div className="space-y-6">
        {content}
      </div>
      <ThemeToggleButton />
    </>
  );
}
