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
 *
 * On mount, removes any stale SSR <style> tags from previous pages (e.g. admin)
 * that persist in <head> during client-side navigation and can cause iOS
 * rubber-band glitches.
 */
export function ThemeColorSetter({ color, styleHref }: { color: string; styleHref?: string }) {
  useEffect(() => {
    // Remove stale theme style tags from other pages
    if (styleHref) {
      document.querySelectorAll('style[data-precedence="theme"]').forEach((el) => {
        const href = el.getAttribute("href");
        if (href && href !== styleHref) {
          el.remove();
        }
      });
    }

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
  }, [color, styleHref]);

  return null;
}
