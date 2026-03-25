"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Full-width banner that extends edge-to-edge.
 * Auto-detects background color from image corners, with optional override.
 * Renders as a top-level full-width element (outside max-w container).
 * Optionally overlays two lines of welcome text (right-aligned, Funnel Sans).
 */
export function BannerHero({
  bannerUrl,
  bannerBgColor,
  heroLine1,
  heroLine1Color,
  heroLine2,
  heroLine2Color,
}: {
  bannerUrl: string;
  bannerBgColor?: string | null;
  heroLine1?: string | null;
  heroLine1Color?: string | null;
  heroLine2?: string | null;
  heroLine2Color?: string | null;
}) {
  const [bgColor, setBgColor] = useState<string>(bannerBgColor || "transparent");

  useEffect(() => {
    // If override color is set, use it directly
    if (bannerBgColor) {
      setBgColor(bannerBgColor);
      return;
    }

    // Auto-detect from image corner pixels
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);

        // Sample corners and left/right edges
        const samples: [number, number][] = [
          [0, 0],
          [img.naturalWidth - 1, 0],
          [0, img.naturalHeight - 1],
          [img.naturalWidth - 1, img.naturalHeight - 1],
          [1, Math.floor(img.naturalHeight / 2)],
          [img.naturalWidth - 2, Math.floor(img.naturalHeight / 2)],
        ];

        // Average the sampled colors
        let r = 0, g = 0, b = 0;
        let count = 0;
        for (const [x, y] of samples) {
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          r += pixel[0];
          g += pixel[1];
          b += pixel[2];
          count++;
        }
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        setBgColor(`rgb(${r}, ${g}, ${b})`);
      } catch {
        // CORS or other error — fallback to transparent
        setBgColor("transparent");
      }
    };
    img.src = bannerUrl;
  }, [bannerUrl, bannerBgColor]);

  const hasHeroText = heroLine1 || heroLine2;
  const textRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [textScale, setTextScale] = useState(1);

  const computeScale = useCallback(() => {
    const text = textRef.current;
    const container = containerRef.current;
    if (!text || !container) return;
    // Temporarily reset scale to measure natural width (no visual flash — happens before paint)
    text.style.transform = "scale(1)";
    const naturalWidth = text.scrollWidth;
    const cs = getComputedStyle(container);
    const availableWidth = container.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const newScale = naturalWidth > availableWidth ? availableWidth / naturalWidth : 1;
    text.style.transform = `scale(${newScale})`;
    setTextScale(newScale);
  }, []);

  useEffect(() => {
    if (!hasHeroText) return;
    computeScale();
    window.addEventListener("resize", computeScale);
    return () => window.removeEventListener("resize", computeScale);
  }, [hasHeroText, heroLine1, heroLine2, computeScale]);

  return (
    <div
      className="w-full"
      style={{ backgroundColor: bgColor }}
    >
      <div className="max-w-2xl mx-auto relative overflow-hidden">
        <img
          src={bannerUrl}
          alt=""
          className="w-full block"
        />
        {hasHeroText && (
          <div
            ref={containerRef}
            className="absolute top-0 bottom-0 right-0 w-[60%] flex items-center justify-end pr-[48px] sm:pr-6 pointer-events-none"
          >
            <div
              ref={textRef}
              className="flex flex-col items-end whitespace-nowrap"
              style={{ transform: `scale(${textScale})`, transformOrigin: "right center" }}
            >
              {heroLine1 && (
                <span
                  className="leading-tight text-[18px] sm:text-[30px]"
                  style={{
                    fontFamily: "var(--font-figtree)",
                    fontWeight: 500,
                    color: heroLine1Color || "#ffffff",
                  }}
                >
                  {heroLine1}
                </span>
              )}
              {heroLine2 && (
                <span
                  className="leading-tight text-[18px] sm:text-[30px]"
                  style={{
                    fontFamily: "var(--font-figtree)",
                    fontWeight: 500,
                    color: heroLine2Color || "#ffffff",
                  }}
                >
                  {heroLine2}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
