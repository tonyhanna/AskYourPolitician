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
    const html = document.documentElement;
    const body = document.body;
    const prevBody = body.style.backgroundColor;
    const prevHtml = html.style.backgroundColor;

    const getBg = () => getComputedStyle(html).getPropertyValue("--system-bg0").trim() || "#ffffff";

    const apply = () => {
      const atTop = window.scrollY <= 0;
      body.style.backgroundColor = atTop ? color : getBg();
      // Chrome desktop overscroll reveals html bg, so set it too
      html.style.backgroundColor = atTop ? color : getBg();
    };

    apply();

    window.addEventListener("scroll", apply, { passive: true });

    return () => {
      window.removeEventListener("scroll", apply);
      body.style.backgroundColor = prevBody;
      html.style.backgroundColor = prevHtml;
    };
  }, [color]);

  return null;
}
