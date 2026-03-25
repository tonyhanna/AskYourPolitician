"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightFromBracket } from "@fortawesome/free-solid-svg-icons";

type Tab = "politicians" | "users" | "settings";

const tabs: { id: Tab; label: string }[] = [
  { id: "politicians", label: "Politikere og partier" },
  { id: "users", label: "Brugere" },
  { id: "settings", label: "Indstillinger" },
];

type Props = {
  politiciansTab: React.ReactNode;
  usersTab: React.ReactNode;
  settingsTab: React.ReactNode;
  userEmail?: string;
  logoutAction?: () => Promise<void>;
};

export function AdminTabs({ politiciansTab, usersTab, settingsTab, userEmail, logoutAction }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("politicians");

  const content = activeTab === "politicians" ? politiciansTab : activeTab === "users" ? usersTab : settingsTab;

  return (
    <div>
      <nav className="border-b border-gray-200 mb-8">
        <div className="flex items-end gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 -mb-px text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? "border-b-2 border-gray-900 text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
          {userEmail && logoutAction && (
            <div className="ml-auto flex items-center gap-3 pb-3">
              <span className="text-xs text-gray-400">{userEmail}</span>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="text-gray-400 hover:text-red-600 transition cursor-pointer"
                  title="Log ud"
                >
                  <FontAwesomeIcon icon={faArrowRightFromBracket} className="text-sm" />
                </button>
              </form>
            </div>
          )}
        </div>
      </nav>
      {content}
    </div>
  );
}
