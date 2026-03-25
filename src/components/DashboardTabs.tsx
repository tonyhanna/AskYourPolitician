"use client";

import { useState } from "react";

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

  const content = activeTab === "questions" ? questionsTab : activeTab === "causes" ? causesTab : settingsTab;

  return (
    <div>
      <nav className="border-b border-gray-200 mb-8">
        <div className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? "border-b-2 border-gray-900 text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
      {content}
    </div>
  );
}
