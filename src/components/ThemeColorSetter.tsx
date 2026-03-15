"use client";

import { useEffect } from "react";

/**
 * Sets the <html> background-color AND <meta name="theme-color"> to the party color.
 * - background-color: makes Safari/Chrome rubber-band over-scroll show party color
 * - theme-color meta: colors the Safari/Chrome mobile toolbar/status bar area
 */
export function ThemeColorSetter({ color }: { color: string }) {
  useEffect(() => {
    // Set html background for rubber-band over-scroll area
    const html = document.documentElement;
    const prevBg = html.style.backgroundColor;
    html.style.backgroundColor = color;

    // Set or create <meta name="theme-color"> for mobile browser toolbar
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    const prevThemeColor = meta?.content ?? null;
    if (meta) {
      meta.content = color;
    } else {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = color;
      document.head.appendChild(meta);
    }

    return () => {
      html.style.backgroundColor = prevBg;
      const m = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
      if (m && prevThemeColor !== null) {
        m.content = prevThemeColor;
      } else if (m && prevThemeColor === null) {
        m.remove();
      }
    };
  }, [color]);

  return null;
}
