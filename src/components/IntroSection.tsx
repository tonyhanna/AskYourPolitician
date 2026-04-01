"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { BannerHero } from "./BannerHero";
import { useCanHover } from "./StickyPillNav";

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
  const storageKey = `intro-dismissed:${politicianSlug}`;
  const canHover = useCanHover();
  const [dismissed, setDismissed] = useState(true); // default true to avoid flash
  const [loaded, setLoaded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>(0);

  const measure = useCallback(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, []);

  useEffect(() => {
    const d = localStorage.getItem(storageKey) === "1";
    setDismissed(d);
    setLoaded(true);
  }, [storageKey]);

  // Measure height — re-measure on resize and when images inside load
  useEffect(() => {
    if (!contentRef.current) return;
    measure();

    // Listen for image loads inside the banner
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

  // Listen for "show-intro" event from info button in PoliticianTopBar
  useEffect(() => {
    const handler = () => {
      setDismissed(false);
      localStorage.removeItem(storageKey);
    };
    window.addEventListener("show-intro", handler);
    return () => window.removeEventListener("show-intro", handler);
  }, [storageKey]);

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(storageKey, "1");
    window.dispatchEvent(new Event("intro-dismissed"));
  }

  if (!bannerUrl) return null;

  const isVisible = loaded && !dismissed;

  return (
    <div
      className="overflow-hidden transition-all duration-500 ease-in-out"
      style={{
        maxHeight: isVisible ? (contentHeight || 1000) : 0,
        opacity: isVisible ? 1 : 0,
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
        {/* Dismiss button */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 rounded-full flex items-center justify-center cursor-pointer"
          style={{ width: 24, height: 24, backgroundColor: "var(--system-bg0, #FF0000)", zIndex: 10 }}
          aria-label="Luk banner"
          onPointerEnter={(e) => { if (!canHover.current) return; const svg = e.currentTarget.querySelector("svg"); if (svg) svg.style.color = "var(--system-icon0, #FF0000)"; }}
          onPointerLeave={(e) => { if (!canHover.current) return; const svg = e.currentTarget.querySelector("svg"); if (svg) svg.style.color = "var(--system-icon1, #FF0000)"; }}
        >
          <FontAwesomeIcon
            icon={faXmark}
            style={{ color: "var(--system-icon1, #FF0000)", fontSize: "13.5px" }}
          />
        </button>
      </div>
    </div>
  );
}
