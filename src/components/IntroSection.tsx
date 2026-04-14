"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { BannerHero } from "./BannerHero";

export function IntroSection({
  bannerUrl,
  bannerBgColor,
  heroLine1,
  heroLine1Color,
  heroLine2,
  heroLine2Color,
  politicianSlug,
}: {
  bannerUrl?: string | null;
  bannerBgColor?: string | null;
  heroLine1?: string | null;
  heroLine1Color?: string | null;
  heroLine2?: string | null;
  heroLine2Color?: string | null;
  politicianSlug: string;
}) {
  const visitsKey = `intro-visits:${politicianSlug}`;
  const [hidden, setHidden] = useState(true); // default hidden to avoid flash
  const [loaded, setLoaded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>(0);

  const measure = useCallback(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, []);

  // Determine visibility on mount: show if visits < 3 or session flag set
  // Use ref guard to avoid double-increment from React Strict Mode in dev
  const didCount = useRef(false);
  useEffect(() => {
    const visits = parseInt(localStorage.getItem(visitsKey) || "0", 10);
    if (visits < 3) {
      if (!didCount.current) {
        didCount.current = true;
        localStorage.setItem(visitsKey, String(visits + 1));
      }
      setHidden(false);
    } else {
      setHidden(true);
    }
    setLoaded(true);
  }, [visitsKey]);

  // Measure height — re-measure on resize and when images inside load
  useEffect(() => {
    if (!contentRef.current) return;
    measure();

    const images = contentRef.current.querySelectorAll("img");
    images.forEach((img) => {
      if (img.complete) {
        measure();
      } else {
        img.addEventListener("load", measure);
      }
    });

    window.addEventListener("resize", measure);
    return () => {
      images.forEach((img) => img.removeEventListener("load", measure));
      window.removeEventListener("resize", measure);
    };
  }, [loaded, bannerUrl, measure]);

  // Listen for toggle-intro event from profile icon click (in-memory only — gone on refresh)
  useEffect(() => {
    const toggleHandler = () => {
      setHidden(prev => {
        if (prev) {
          // Opening — scroll to top
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        return !prev;
      });
    };
    window.addEventListener("toggle-intro", toggleHandler);
    return () => window.removeEventListener("toggle-intro", toggleHandler);
  }, []);

  if (!bannerUrl) return null;

  const isVisible = loaded && !hidden;

  return (
    <div
      className="overflow-hidden transition-all duration-500 ease-in-out relative"
      style={{
        maxHeight: isVisible ? (contentHeight || 1000) : 0,
        opacity: isVisible ? 1 : 0,
        zIndex: 41,
      }}
    >
      <div ref={contentRef} className="relative">
        <BannerHero
          bannerUrl={bannerUrl}
          bannerBgColor={bannerBgColor}
          heroLine1={heroLine1}
          heroLine1Color={heroLine1Color}
          heroLine2={heroLine2}
          heroLine2Color={heroLine2Color}
        />
      </div>
    </div>
  );
}
