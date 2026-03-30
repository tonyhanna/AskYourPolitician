"use client";

import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { faSun, faMoon, faDesktop } from "@fortawesome/free-solid-svg-icons";
import { useTheme } from "./SystemColorProvider";

const themeOptions = [
  { pref: "light" as const, icon: faSun },
  { pref: "system" as const, icon: faDesktop },
  { pref: "dark" as const, icon: faMoon },
];

/**
 * Circular theme toggle button that shows the current theme icon.
 * Opens a popover with light/system/dark options.
 * Same styling as QuestionDetailEllipsis on the citizen page.
 */
export function ThemeToggleButton() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { preference, setPreference } = useTheme();
  const canHover = useRef(false);
  useEffect(() => { canHover.current = window.matchMedia("(hover: hover)").matches; }, []);

  const currentIcon = themeOptions.find((t) => t.pref === preference)?.icon ?? faDesktop;

  return (
    <div className="flex justify-center mt-auto" style={{ marginBottom: 30, paddingTop: 50 }}>
      {/* Backdrop to dismiss menu on outside click */}
      {menuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
      )}
      <div className="relative z-20">
        {/* Menu popover — opens upward */}
        {menuOpen && (
          <div
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-xl px-4 py-3 z-20"
            style={{
              backgroundColor: "var(--system-bg1)",
              fontFamily: "var(--font-figtree)",
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            {themeOptions.map(({ pref, icon }) => {
              const isSelected = preference === pref;
              const idle = isSelected ? "var(--system-icon0)" : "var(--system-icon3)";
              const hover = isSelected ? "var(--system-icon1)" : "var(--system-icon2)";
              return (
                <button
                  key={pref}
                  onClick={() => {
                    setPreference(pref);
                    setMenuOpen(false);
                  }}
                  className="cursor-pointer flex items-center justify-center transition-colors"
                  style={{ width: 28, height: 28, color: idle }}
                  onPointerEnter={(e) => { if (!canHover.current) return; e.currentTarget.style.color = hover; }}
                  onPointerLeave={(e) => { if (!canHover.current) return; e.currentTarget.style.color = idle; }}
                >
                  <FontAwesomeIcon icon={icon} style={{ fontSize: 12 }} />
                </button>
              );
            })}
          </div>
        )}
        {/* Toggle button — shows current theme icon, or xmark when open */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="cursor-pointer transition-colors rounded-full flex items-center justify-center z-20"
          style={{
            width: 24,
            height: 24,
            backgroundColor: "var(--system-bg1)",
            color: "var(--system-icon1)",
          }}
          onPointerEnter={(e) => { if (!canHover.current) return; e.currentTarget.style.color = "var(--system-icon0)"; }}
          onPointerLeave={(e) => { if (!canHover.current) return; e.currentTarget.style.color = "var(--system-icon1)"; }}
          aria-label="Skift tema"
        >
          {menuOpen ? (
            <FontAwesomeIcon icon={faXmark} style={{ fontSize: "13.5px" }} />
          ) : (
            <FontAwesomeIcon icon={currentIcon} style={{ fontSize: "13.5px" }} />
          )}
        </button>
      </div>
    </div>
  );
}
