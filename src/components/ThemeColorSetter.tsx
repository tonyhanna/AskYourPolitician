"use client";

import { useEffect } from "react";

/**
 * Sets party color on both <body> and <html> backgrounds + <meta name="theme-color">.
 *
 * Safari 26+ (iOS 26): ignores theme-color meta tag entirely. Instead derives toolbar
 * color from CSS background-color of position:sticky/fixed elements near viewport top,
 * with fallback to <body> background-color. <html> bg is ignored by Safari.
 *
 * Chrome mobile: still uses theme-color meta tag for toolbar.
 *
 * Overscroll rubber-band: determined by <body> background-color on both browsers.
 */
export function ThemeColorSetter({ color }: { color: string }) {
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const prevBodyBg = body.style.backgroundColor;
    const prevHtmlBg = html.style.backgroundColor;

    // Set both body and html background for maximum browser coverage
    body.style.backgroundColor = color;
    html.style.backgroundColor = color;

    // Set or create <meta name="theme-color"> for Chrome mobile toolbar
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
      body.style.backgroundColor = prevBodyBg;
      html.style.backgroundColor = prevHtmlBg;
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
