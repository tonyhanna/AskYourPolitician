"use client";

import { useState, useRef, useCallback } from "react";
import { StickyPillNav } from "./StickyPillNav";

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
};

export function DashboardTabs({ questionsTab, causesTab, settingsTab }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("questions");
  const scrollPositions = useRef<Record<Tab, number>>({ questions: 0, causes: 0, settings: 0 });

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
      />
      <div className="max-w-4xl mx-auto px-6 space-y-6">
        {content}
      </div>
    </>
  );
}
