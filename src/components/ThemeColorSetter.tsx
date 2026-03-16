"use client";

import { useEffect } from "react";

/**
 * Sets party color on both <html> and <body> background for overscroll rubber-band.
 * html bg needed for Safari/Chrome desktop, body bg needed for Chrome iOS.
 *
 * The <meta name="theme-color"> for Safari/Chrome toolbar is rendered
 * server-side in page.tsx JSX (must be in initial HTML for Safari).
 */
export function ThemeColorSetter({ color }: { color: string }) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.backgroundColor;
    const prevBody = body.style.backgroundColor;
    html.style.backgroundColor = color;
    body.style.backgroundColor = color;
    return () => {
      html.style.backgroundColor = prevHtml;
      body.style.backgroundColor = prevBody;
    };
  }, [color]);

  return null;
}
