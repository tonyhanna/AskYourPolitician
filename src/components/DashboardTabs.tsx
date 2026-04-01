"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightFromBracket, faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import { faCommentDots, faCommentPlus, faFire, faUserGear } from "@fortawesome/pro-duotone-svg-icons";
import { StickyPillNav, useCanHover } from "./StickyPillNav";
import { ThemeToggleButton } from "./ThemeToggleButton";

type Tab = "questions" | "causes" | "settings";

const tabs = [
  { id: "questions", label: "Spørgsmål", icon: faCommentDots, swapIconOpacity: true },
  { id: "causes", label: "Mærkesager", icon: faFire, swapIconOpacity: true },
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
  const canHover = useCanHover();
  const [formOpen, setFormOpen] = useState(false);

  // Listen for form close
  useEffect(() => {
    const handler = () => setFormOpen(false);
    window.addEventListener("dashboard-create-close", handler);
    return () => window.removeEventListener("dashboard-create-close", handler);
  }, []);


  // Reset formOpen on tab switch
  useEffect(() => { setFormOpen(false); }, [activeTab]);

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
        activeId={activeTab === "settings" ? "" : activeTab}
        onSelect={switchTab}
        rightContent={
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => switchTab("settings")}
              className="rounded-full cursor-pointer transition-colors duration-150 flex items-center justify-center"
              style={{
                width: 32,
                height: 32,
                backgroundColor: activeTab === "settings" ? "var(--system-bg0-contrast)" : "var(--system-bg1)",
              }}
              aria-label="Indstillinger"
              onPointerEnter={(e) => { if (!canHover.current) return; const svg = e.currentTarget.querySelector("svg"); if (svg) svg.style.color = "var(--system-icon2)"; }}
              onPointerLeave={(e) => { if (!canHover.current) return; const svg = e.currentTarget.querySelector("svg"); if (svg) svg.style.color = activeTab === "settings" ? "var(--system-icon0-contrast)" : "var(--system-icon0)"; }}
            >
              <FontAwesomeIcon icon={faUserGear} swapOpacity style={{ color: activeTab === "settings" ? "var(--system-icon0-contrast)" : "var(--system-icon0)", fontSize: 15 }} />
            </button>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-full cursor-pointer transition-colors duration-150 flex items-center justify-center"
                style={{
                  width: 32,
                  height: 32,
                  backgroundColor: "var(--system-bg1)",
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
            if (formOpen) {
              setFormOpen(false);
              window.dispatchEvent(new CustomEvent("dashboard-create-close"));
            } else {
              setFormOpen(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
              window.dispatchEvent(new CustomEvent("dashboard-create-open", { detail: { tab: activeTab } }));
            }
          }}
          className="fixed bottom-6 right-6 rounded-full cursor-pointer flex items-center justify-center z-50"
          style={{
            width: 56,
            height: 56,
            backgroundColor: "var(--party-primary)",
            color: "var(--party-dark)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
          onPointerEnter={(e) => { if (!canHover.current) return; e.currentTarget.querySelectorAll("svg").forEach((svg) => { svg.style.opacity = "0.5"; }); }}
          onPointerLeave={(e) => { if (!canHover.current) return; e.currentTarget.querySelectorAll("svg").forEach((svg) => { svg.style.opacity = "1"; }); }}
          aria-label={formOpen ? "Luk formular" : (activeTab === "questions" ? "Opret spørgsmål" : "Opret mærkesag")}
        >
          {formOpen ? (
            <FontAwesomeIcon icon={faXmark} style={{ fontSize: 24 }} />
          ) : activeTab === "questions" ? (
            <FontAwesomeIcon icon={faCommentPlus} style={{ fontSize: 24 }} />
          ) : (
            <span className="flex items-center">
              <FontAwesomeIcon icon={faFire} style={{ fontSize: 20 }} />
              <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10, marginLeft: -3 }} />
            </span>
          )}
        </button>
      )}
    </>
  );
}
