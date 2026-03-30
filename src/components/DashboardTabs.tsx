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
  const canHover = useRef(false);
  useEffect(() => { canHover.current = window.matchMedia("(hover: hover)").matches; }, []);

  const content = activeTab === "questions" ? questionsTab : activeTab === "causes" ? causesTab : settingsTab;

  return (
    <div>
      <nav className="flex items-center gap-2 mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="text-sm px-3 py-1.5 rounded-full cursor-pointer transition-colors duration-150"
            style={{
              fontFamily: "var(--font-figtree)",
              fontWeight: 500,
              backgroundColor: activeTab === tab.id ? "var(--system-bg0-contrast)" : "var(--system-bg1)",
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
      </nav>
      {content}
    </div>
  );
}
