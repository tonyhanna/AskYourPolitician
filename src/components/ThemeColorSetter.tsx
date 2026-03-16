"use client";

import { useEffect } from "react";

/**
 * Toggles body background based on scroll position for overscroll rubber-band.
 *
 * - scrollY ≤ 0  → body bg = party color → canvas (propagated from body) = green
 * - scrollY > 0  → body bg = white       → canvas = white (no bottom bleed)
 *
 * html bg is intentionally NOT set so the CSS canvas propagates from body,
 * allowing dynamic color changes via scroll.
 *
 * The SSR style tag (page.tsx) sets `html body { background-color: partyColor }`
 * for initial paint (page always loads at scrollY=0).
 * The <meta name="theme-color"> handles Safari/Chrome toolbar color.
 */
export function ThemeColorSetter({ color }: { color: string }) {
  useEffect(() => {
    const body = document.body;
    const prevBody = body.style.backgroundColor;

    // Set initial body bg based on current scroll position
    body.style.backgroundColor = window.scrollY <= 0 ? color : "#ffffff";

    const handleScroll = () => {
      body.style.backgroundColor = window.scrollY <= 0 ? color : "#ffffff";
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      body.style.backgroundColor = prevBody;
    };
  }, [color]);

  return null;
}
