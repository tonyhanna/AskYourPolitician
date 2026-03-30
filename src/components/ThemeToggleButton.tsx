"use client";

import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSun, faMoon, faDesktop } from "@fortawesome/free-solid-svg-icons";
import { useTheme } from "./SystemColorProvider";

const themeOptions = [
  { pref: "light" as const, icon: faSun },
  { pref: "system" as const, icon: faDesktop },
  { pref: "dark" as const, icon: faMoon },
];

/**
 * Circular theme toggle button that expands into a pill with all 3 options.
 * Shows the current theme icon when collapsed.
 * Same styling as QuestionDetailEllipsis on the citizen page.
 */
export function ThemeToggleButton() {
  const [expanded, setExpanded] = useState(false);
  const { preference, setPreference } = useTheme();
  const canHover = useRef(false);
  const btnRef = useRef<HTMLDivElement>(null);
  useEffect(() => { canHover.current = window.matchMedia("(hover: hover)").matches; }, []);

  // Dismiss on outside tap
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: TouchEvent | MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("touchstart", handler, { capture: true });
    document.addEventListener("mousedown", handler, { capture: true });
    return () => {
      document.removeEventListener("touchstart", handler, { capture: true });
      document.removeEventListener("mousedown", handler, { capture: true });
    };
  }, [expanded]);

  const currentIcon = themeOptions.find((t) => t.pref === preference)?.icon ?? faDesktop;

  return (
    <div className="flex justify-center mt-auto" style={{ marginBottom: 30, paddingTop: 50 }}>
      <div
        ref={btnRef}
        className="rounded-full flex items-center justify-center"
        style={{
          height: 24,
          backgroundColor: "var(--system-bg1)",
          overflow: "hidden",
          transition: "width 200ms ease",
          width: expanded ? 24 * 3 : 24,
        }}
      >
        {expanded ? (
          themeOptions.map(({ pref, icon }) => {
            const isSelected = preference === pref;
            const idle = isSelected ? "var(--system-icon0)" : "var(--system-icon3)";
            const hover = isSelected ? "var(--system-icon1)" : "var(--system-icon2)";
            return (
              <button
                key={pref}
                onClick={() => {
                  setPreference(pref);
                  setExpanded(false);
                }}
                className="cursor-pointer flex items-center justify-center"
                style={{ width: 24, height: 24, color: idle }}
                onPointerEnter={(e) => { if (!canHover.current) return; e.currentTarget.style.color = hover; }}
                onPointerLeave={(e) => { if (!canHover.current) return; e.currentTarget.style.color = idle; }}
              >
                <FontAwesomeIcon icon={icon} style={{ fontSize: "13.5px" }} />
              </button>
            );
          })
        ) : (
          <button
            onClick={() => setExpanded(true)}
            className="cursor-pointer flex items-center justify-center"
            style={{
              width: 24,
              height: 24,
              color: "var(--system-icon1)",
            }}
            onPointerEnter={(e) => { if (!canHover.current) return; e.currentTarget.style.color = "var(--system-icon0)"; }}
            onPointerLeave={(e) => { if (!canHover.current) return; e.currentTarget.style.color = "var(--system-icon1)"; }}
            aria-label="Skift tema"
          >
            <FontAwesomeIcon icon={currentIcon} style={{ fontSize: "13.5px" }} />
          </button>
        )}
      </div>
    </div>
  );
}
