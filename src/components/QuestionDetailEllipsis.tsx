"use client";

import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEllipsis, faXmark, faArrowRightFromBracket, faSun, faMoon, faDesktop } from "@fortawesome/free-solid-svg-icons";
import { citizenLogout } from "@/app/[partySlug]/[politicianSlug]/actions";
import { useTheme, useSystemColors } from "./SystemColorProvider";

export function QuestionDetailEllipsis({
  hasSession,
  citizenEmail,
  partySlug,
  politicianSlug,
  partyColor,
  partyColorDark,
}: {
  hasSession: boolean;
  citizenEmail: string | null;
  partySlug: string;
  politicianSlug: string;
  partyColor?: string | null;
  partyColorDark?: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { preference, setPreference } = useTheme();
  const systemColors = useSystemColors();
  const canHover = useRef(false);
  useEffect(() => { canHover.current = window.matchMedia("(hover: hover)").matches; }, []);

  // Always show the ellipsis (even logged out) so dark mode toggle is accessible
  return (
    <div className="flex justify-center mt-auto" style={{ marginBottom: 30, paddingTop: 50 }}>
      {/* Invisible backdrop to dismiss menu on outside click */}
      {menuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
      )}
      <div className="relative z-20">
      {/* Menu popover — opens upward */}
      {menuOpen && (
        <div
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 rounded-xl px-4 py-3 z-20"
          style={{
            backgroundColor: "var(--system-bg1)",
            fontFamily: "var(--font-figtree)",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          {hasSession && citizenEmail && (
            <>
              <span className="text-sm" style={{ color: "var(--system-text0)" }}>{citizenEmail}</span>
              <button
                onClick={async () => {
                  const scrollY = window.scrollY;
                  await citizenLogout(partySlug, politicianSlug);
                  requestAnimationFrame(() => window.scrollTo(0, scrollY));
                }}
                className="cursor-pointer transition-colors flex items-center gap-2 text-sm"
                style={{ color: "var(--system-icon0)", fontWeight: 550 }}
                onPointerEnter={(e) => { if (!canHover.current) return; e.currentTarget.style.color = "var(--system-icon1)"; }}
                onPointerLeave={(e) => { if (!canHover.current) return; e.currentTarget.style.color = "var(--system-icon0)"; }}
              >
                Log ud
                <FontAwesomeIcon icon={faArrowRightFromBracket} />
              </button>
            </>
          )}
          {/* Theme selector: 3 icons side-by-side */}
          <div className="flex items-center gap-1">
            {([
              { pref: "light" as const, icon: faSun },
              { pref: "system" as const, icon: faDesktop },
              { pref: "dark" as const, icon: faMoon },
            ]).map(({ pref, icon }) => {
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
        </div>
      )}
      {/* Ellipsis / close button */}
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
        aria-label="Menu"
      >
        {menuOpen ? (
          <FontAwesomeIcon
            icon={faXmark}
            style={{ fontSize: "13.5px" }}
          />
        ) : (
          <FontAwesomeIcon
            icon={faEllipsis}
            style={{ fontSize: "13.5px" }}
          />
        )}
      </button>
      </div>
    </div>
  );
}
