"use client";

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export type PillNavItem = {
  id: string;
  label: string;
  icon?: IconDefinition;
};

type StickyPillNavProps = {
  items: PillNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Extra content rendered to the right of the pills (e.g. filter button) */
  rightContent?: React.ReactNode;
  /** Content rendered below the pill row (e.g. expanded tag filters) */
  bottomContent?: React.ReactNode;
  /** When true, forces solid (non-blurred) backgrounds regardless of scroll.
   *  Used by citizen page when filters are open. */
  forceOpaque?: boolean;
  /** Show full-width blur background behind the entire sticky nav.
   *  Used by citizen page when filters are open to blur content behind tags. */
  blurBackground?: boolean;
  /** Content rendered in place of pills when items is empty (e.g. inline tags) */
  leftOverride?: React.ReactNode;
};

/**
 * Shared sticky pill-button navigation used across citizen page and dashboard.
 *
 * Behavior:
 * - Sticky at top-[94px] z-40
 * - At top of page: solid opaque backgrounds (system-bg0-contrast / system-bg1)
 * - When scrolled: 70% transparent backgrounds with backdrop blur(12px)
 * - 200ms ease transitions on background-color and backdrop-filter
 * - Hover effects gated by (hover: hover) media query for iOS Safari safety
 */
export function StickyPillNav({
  items,
  activeId,
  onSelect,
  rightContent,
  bottomContent,
  forceOpaque,
  blurBackground,
  leftOverride,
}: StickyPillNavProps) {
  const [isAtTop, setIsAtTop] = useState(true);
  const canHover = useRef(false);
  useEffect(() => { canHover.current = window.matchMedia("(hover: hover)").matches; }, []);

  useEffect(() => {
    function onScroll() { setIsAtTop(window.scrollY < 10); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = isAtTop || !!forceOpaque;

  return (
    <div className="sticky top-[94px] z-40 mb-[25px]" style={{ position: "sticky" }}>
      {/* Full-width blur background (e.g. when filters are open on citizen page) */}
      {blurBackground && (
        <div style={{ position: "absolute", top: -24, left: -15, right: -15, bottom: 0, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", backgroundColor: "color-mix(in srgb, var(--system-bg0) 70%, transparent)", zIndex: -1 }} />
      )}
      <div className="flex items-start justify-between">
        {/* Left side: pills or override content */}
        {leftOverride || (
          <div className="flex items-center gap-2">
            {items.map((item) => {
              const isActive = item.id === activeId;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className="text-sm px-3 py-1.5 rounded-full cursor-pointer transition-colors duration-150"
                  style={{
                    fontFamily: "var(--font-figtree)",
                    fontWeight: 500,
                    backdropFilter: solid ? "none" : "blur(12px)",
                    WebkitBackdropFilter: solid ? "none" : "blur(12px)",
                    backgroundColor: isActive
                      ? (solid ? "var(--system-bg0-contrast)" : "color-mix(in srgb, var(--system-bg0-contrast) 70%, transparent)")
                      : (solid ? "var(--system-bg1)" : "color-mix(in srgb, var(--system-bg1) 70%, transparent)"),
                    transition: "background-color 200ms ease, backdrop-filter 200ms ease",
                    color: isActive ? "var(--system-text0-contrast)" : "var(--system-text0)",
                  }}
                  onPointerEnter={(e) => {
                    if (!canHover.current) return;
                    e.currentTarget.style.color = "var(--system-text2)";
                    const svg = e.currentTarget.querySelector("svg");
                    if (svg) svg.style.color = "var(--system-icon2)";
                  }}
                  onPointerLeave={(e) => {
                    if (!canHover.current) return;
                    e.currentTarget.style.color = isActive ? "var(--system-text0-contrast)" : "var(--system-text0)";
                    const svg = e.currentTarget.querySelector("svg");
                    if (svg) svg.style.color = isActive ? "var(--system-icon0-contrast)" : "var(--system-icon0)";
                  }}
                >
                  {item.icon && <FontAwesomeIcon icon={item.icon} swapOpacity style={{ fontSize: 15, marginRight: 5, color: isActive ? "var(--system-icon0-contrast)" : "var(--system-icon0)" }} />}{item.label}
                </button>
              );
            })}
          </div>
        )}
        {/* Right side: extra content */}
        {rightContent}
      </div>
      {/* Bottom: content below the pill row */}
      {bottomContent}
    </div>
  );
}

/** Hook for consumers that need isAtTop / canHover for their own elements */
export function useStickyNavState() {
  const [isAtTop, setIsAtTop] = useState(true);
  const canHover = useRef(false);
  useEffect(() => { canHover.current = window.matchMedia("(hover: hover)").matches; }, []);

  useEffect(() => {
    function onScroll() { setIsAtTop(window.scrollY < 10); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return { isAtTop, canHover };
}
