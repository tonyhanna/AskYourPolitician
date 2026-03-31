"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightFromBracket, faPlus } from "@fortawesome/free-solid-svg-icons";
import { faCommentPlus, faFire } from "@fortawesome/pro-duotone-svg-icons";
import { StickyPillNav, useStickyNavState } from "./StickyPillNav";
import { ThemeToggleButton } from "./ThemeToggleButton";

type Tab = "questions" | "causes" | "settings";

const tabs = [
  { id: "questions", label: "Spørgsmål" },
  { id: "causes", label: "Mærkesager" },
  { id: "settings", label: "Indstillinger" },
];

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

  const switchTab = useCallback((id: string) => {
    scrollPositions.current[activeTab] = window.scrollY;
    const nextTab = id as Tab;
    setActiveTab(nextTab);
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollPositions.current[nextTab] });
    });
  }, [activeTab]);

  const content = activeTab === "questions" ? questionsTab : activeTab === "causes" ? causesTab : settingsTab;
  const showFab = activeTab === "questions" || activeTab === "causes";

  return (
    <>
      <StickyPillNav
        items={tabs}
        activeId={activeTab}
        onSelect={switchTab}
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
      <div className="space-y-6">
        {content}
      </div>
      <ThemeToggleButton />
      {/* Sticky FAB — bottom right */}
      {showFab && (
        <button
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            window.dispatchEvent(new CustomEvent("dashboard-create-open", { detail: { tab: activeTab } }));
          }}
          className="fixed bottom-6 right-6 rounded-full cursor-pointer flex items-center justify-center z-50"
          style={{
            width: 56,
            height: 56,
            backgroundColor: partyColor || "#00D564",
            color: partyColorDark || "#1E3A5F",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
          onPointerEnter={(e) => { if (!canHover.current) return; e.currentTarget.style.opacity = "0.8"; }}
          onPointerLeave={(e) => { if (!canHover.current) return; e.currentTarget.style.opacity = "1"; }}
          aria-label={activeTab === "questions" ? "Opret spørgsmål" : "Opret mærkesag"}
        >
          {activeTab === "questions" ? (
            <FontAwesomeIcon icon={faCommentPlus} style={{ fontSize: 24 }} />
          ) : (
            <span className="flex items-center gap-1">
              <FontAwesomeIcon icon={faFire} style={{ fontSize: 20 }} />
              <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10 }} />
            </span>
          )}
        </button>
      )}
    </>
  );
}
