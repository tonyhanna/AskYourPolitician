"use client";

import { useState, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { StickyPillNav, useStickyNavState } from "./StickyPillNav";

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
};

export function DashboardTabs({ questionsTab, causesTab, settingsTab, logoutAction }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("questions");
  const scrollPositions = useRef<Record<Tab, number>>({ questions: 0, causes: 0, settings: 0 });
  const { isAtTop, canHover } = useStickyNavState();

  const switchTab = useCallback((id: string) => {
    // Save current scroll position for the tab we're leaving
    scrollPositions.current[activeTab] = window.scrollY;
    const nextTab = id as Tab;
    setActiveTab(nextTab);
    // Restore scroll position for the tab we're entering
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollPositions.current[nextTab] });
    });
  }, [activeTab]);

  const content = activeTab === "questions" ? questionsTab : activeTab === "causes" ? causesTab : settingsTab;

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
                className="text-sm px-3 py-1.5 rounded-full cursor-pointer transition-colors duration-150 flex items-center gap-1.5"
                style={{
                  fontFamily: "var(--font-figtree)",
                  fontWeight: 500,
                  backdropFilter: isAtTop ? "none" : "blur(12px)",
                  WebkitBackdropFilter: isAtTop ? "none" : "blur(12px)",
                  backgroundColor: isAtTop ? "var(--system-bg1)" : "color-mix(in srgb, var(--system-bg1) 70%, transparent)",
                  transition: "background-color 200ms ease, backdrop-filter 200ms ease",
                  color: "var(--system-text0)",
                }}
                onPointerEnter={(e) => { if (!canHover.current) return; e.currentTarget.style.color = "var(--system-text2)"; }}
                onPointerLeave={(e) => { if (!canHover.current) return; e.currentTarget.style.color = "var(--system-text0)"; }}
              >
                Log ud
                <FontAwesomeIcon icon={faArrowRightFromBracket} style={{ fontSize: 12 }} />
              </button>
            </form>
          </div>
        }
      />
      <div className="max-w-4xl mx-auto px-6 space-y-6">
        {content}
      </div>
    </>
  );
}
