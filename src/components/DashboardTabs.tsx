"use client";

import { useState, useEffect, useRef } from "react";

type Tab = "questions" | "causes" | "settings";

const tabs: { id: Tab; label: string }[] = [
  { id: "questions", label: "Spørgsmål" },
  { id: "causes", label: "Mærkesager" },
  { id: "settings", label: "Indstillinger" },
];

type Props = {
  questionsTab: React.ReactNode;
  causesTab: React.ReactNode;
  settingsTab: React.ReactNode;
};

export function DashboardTabs({ questionsTab, causesTab, settingsTab }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("questions");
  const [isAtTop, setIsAtTop] = useState(true);
  const canHover = useRef(false);
  useEffect(() => { canHover.current = window.matchMedia("(hover: hover)").matches; }, []);

  // Track scroll position for opacity/blur transition
  useEffect(() => {
    function onScroll() {
      setIsAtTop(window.scrollY < 10);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const content = activeTab === "questions" ? questionsTab : activeTab === "causes" ? causesTab : settingsTab;

  return (
    <div>
      {/* Sticky nav — matches citizen page section nav exactly */}
      <div className="sticky top-[94px] z-40 mb-[25px]" style={{ position: "sticky" }}>
        <div className="flex items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="text-sm px-3 py-1.5 rounded-full cursor-pointer transition-colors duration-150"
              style={{
                fontFamily: "var(--font-figtree)",
                fontWeight: 500,
                backdropFilter: isAtTop ? "none" : "blur(12px)",
                WebkitBackdropFilter: isAtTop ? "none" : "blur(12px)",
                backgroundColor: activeTab === tab.id
                  ? (isAtTop ? "var(--system-bg0-contrast)" : "color-mix(in srgb, var(--system-bg0-contrast) 70%, transparent)")
                  : (isAtTop ? "var(--system-bg1)" : "color-mix(in srgb, var(--system-bg1) 70%, transparent)"),
                transition: "background-color 200ms ease, backdrop-filter 200ms ease",
                color: activeTab === tab.id ? "var(--system-text0-contrast)" : "var(--system-text0)",
              }}
              onPointerEnter={(e) => {
                if (!canHover.current) return;
                e.currentTarget.style.color = "var(--system-text2)";
              }}
              onPointerLeave={(e) => {
                if (!canHover.current) return;
                e.currentTarget.style.color = activeTab === tab.id ? "var(--system-text0-contrast)" : "var(--system-text0)";
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {content}
    </div>
  );
}
