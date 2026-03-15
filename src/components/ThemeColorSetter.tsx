"use client";

import { useEffect } from "react";

/**
 * Sets the <html> element background-color to the party color.
 * This makes the Safari rubber-band over-scroll area (and Chrome pull-down)
 * show the party color instead of white.
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
