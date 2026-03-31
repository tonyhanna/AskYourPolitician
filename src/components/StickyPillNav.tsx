"use client";

import { useEffect, useRef, useState } from "react";

export type PillNavItem = {
  id: string;
  label: string;
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
  /** Content docked before the pill buttons (e.g. create button that scrolls up into nav) */
  dockedContent?: React.ReactNode;
  /** Width (px) to reserve on the left for an externally sticky button overlaying the nav */
  dockedWidth?: number;
  /** 0→1 progress for docked background fade-in */
  dockProgress?: number;
};

/**
 * Shared sticky pill-button navigation used across citizen page, dashboard, and admin.
 *
 * Behavior:
 * - Sticky at top-[94px] z-40
 * - At top of page: solid opaque backgrounds (system-bg0-contrast / system-bg1)
 * - When scrolled: 70% transparent backgrounds with backdrop blur(12px)
 * - 200ms ease transitions on background-color and backdrop-filter
 * - Hover effects gated by (hover: hover) media query for iOS Safari safety
 *
 * Also exposes `isAtTop` and `canHover` via render prop pattern for consumers
 * that need scroll-aware styling on their own elements.
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
  dockedContent,
  dockedWidth = 0,
  dockProgress = 0,
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
      {/* Docked background: fades in as create button approaches nav */}
      {dockProgress > 0 && (
        <div style={{ position: "absolute", top: -24, left: -15, right: -15, bottom: -10, backdropFilter: `blur(${dockProgress * 12}px)`, WebkitBackdropFilter: `blur(${dockProgress * 12}px)`, backgroundColor: `color-mix(in srgb, var(--system-bg0) ${Math.round(dockProgress * 70)}%, transparent)`, zIndex: -1, opacity: dockProgress }} />
      )}
      <div className="flex items-start justify-between gap-2">
        {/* Left side: pills with translateX when docked */}
        {leftOverride || (
          <>
          {dockedContent}
          <div
            className="flex items-center gap-2"
            style={{ transform: dockedWidth > 0 ? `translateX(${dockedWidth}px)` : "translateX(0)", transition: "transform 200ms cubic-bezier(0.05, 0.7, 0.1, 1.0)", willChange: "transform" }}
          >
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
                  }}
                  onPointerLeave={(e) => {
                    if (!canHover.current) return;
                    e.currentTarget.style.color = isActive ? "var(--system-text0-contrast)" : "var(--system-text0)";
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          </>
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
