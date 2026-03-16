"use client";

import { useEffect } from "react";

/**
 * Sets party color on <html> bg always (Safari/Chrome desktop rubber-band).
 * Sets party color on <body> bg only when scrolled to top (Chrome iOS rubber-band).
 * When scrolled away from top, body bg reverts to white to prevent green bleed
 * at the bottom during overscroll bounce.
 *
 * The SSR style tag (page.tsx) sets both html+body green for initial paint.
 * This component takes over after hydration, toggling body bg on scroll.
 */
export function ThemeColorSetter({ color }: { color: string }) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.backgroundColor;
    const prevBody = body.style.backgroundColor;

    html.style.backgroundColor = color;
    // Set initial body bg based on current scroll position
    body.style.backgroundColor = window.scrollY <= 0 ? color : "#ffffff";

    const handleScroll = () => {
      body.style.backgroundColor = window.scrollY <= 0 ? color : "#ffffff";
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      html.style.backgroundColor = prevHtml;
      body.style.backgroundColor = prevBody;
    };
  }, [color]);

  return null;
}
