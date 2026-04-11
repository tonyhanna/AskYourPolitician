"use client";

import { useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export type PillNavItem = {
  id: string;
  label: string;
  icon?: IconDefinition;
  swapIconOpacity?: boolean;
};

type StickyPillNavProps = {
  items: PillNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Extra content rendered to the right of the pills (e.g. filter button) */
  rightContent?: React.ReactNode;
  /** Content rendered below the pill row (e.g. expanded tag filters) */
  bottomContent?: React.ReactNode;
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
  blurBackground,
  leftOverride,
}: StickyPillNavProps) {
  const canHover = useRef(false);
  useEffect(() => { canHover.current = window.matchMedia("(hover: hover)").matches; }, []);

  return (
    <div className="sticky top-[94px] z-40 mb-[25px]" style={{ position: "sticky" }}>
      {/* Full-width blur background (e.g. when filters are open on citizen page) */}
      {blurBackground && (
        <div style={{ position: "absolute", top: -24, left: -15, right: -15, bottom: (leftOverride || bottomContent) ? 0 : -19, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", backgroundColor: "color-mix(in srgb, var(--system-bg0, #FF0000) 70%, transparent)", zIndex: -1 }} />
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
                    backgroundColor: isActive ? "var(--system-bg0-contrast, #FF0000)" : "var(--system-bg1, #FF0000)",
                    color: isActive ? "var(--system-text0-contrast, #FF0000)" : "var(--system-text0, #FF0000)",
                  }}
                  onPointerEnter={(e) => {
                    if (!canHover.current) return;
                    e.currentTarget.style.color = "var(--system-text2, #FF0000)";
                    const svg = e.currentTarget.querySelector("svg");
                    if (svg) svg.style.color = "var(--system-icon2, #FF0000)";
                  }}
                  onPointerLeave={(e) => {
                    if (!canHover.current) return;
                    e.currentTarget.style.color = isActive ? "var(--system-text0-contrast, #FF0000)" : "var(--system-text0, #FF0000)";
                    const svg = e.currentTarget.querySelector("svg");
                    if (svg) svg.style.color = isActive ? "var(--system-icon0-contrast, #FF0000)" : "var(--system-icon0, #FF0000)";
                  }}
                >
                  {item.icon && <FontAwesomeIcon icon={item.icon} swapOpacity={item.swapIconOpacity} style={{ fontSize: 15, marginRight: 5, color: isActive ? "var(--system-icon0-contrast, #FF0000)" : "var(--system-icon0, #FF0000)", transition: "color 150ms ease" }} />}{item.label}
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

/** Hook for consumers that need canHover for their own elements */
export function useCanHover() {
  const canHover = useRef(false);
  useEffect(() => { canHover.current = window.matchMedia("(hover: hover)").matches; }, []);
  return canHover;
}
