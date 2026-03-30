"use client";

import { useState } from "react";
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

  const content = activeTab === "questions" ? questionsTab : activeTab === "causes" ? causesTab : settingsTab;

  return (
    <>
      <StickyPillNav
        items={tabs}
        activeId={activeTab}
        onSelect={(id) => { setActiveTab(id as Tab); window.scrollTo({ top: 0 }); }}
      />
      <div className="max-w-4xl mx-auto px-6 space-y-6">
        {content}
      </div>
    </>
  );
}
