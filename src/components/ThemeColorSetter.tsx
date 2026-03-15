"use client";

import { useEffect } from "react";

/**
 * Sets party color on <html> background for top overscroll rubber-band area.
 * Does NOT touch <body> to avoid coloring the bottom of the page.
 *
 * The <meta name="theme-color"> for Safari/Chrome toolbar is rendered
 * server-side in page.tsx JSX (must be in initial HTML for Safari).
 *
 * Safari 26+: derives toolbar color from CSS background-color of
 * position:sticky/fixed elements near viewport top (handled by sticky wrapper).
 */
export function ThemeColorSetter({ color }: { color: string }) {
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.backgroundColor;
    html.style.backgroundColor = color;
    return () => {
      html.style.backgroundColor = prev;
    };
  }, [color]);

  return null;
}
