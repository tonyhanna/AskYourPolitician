"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Responsive grid columns based on container width.
 * Returns a ref to attach to the container, plus computed grid values.
 */
export function useResponsiveGrid(itemCount: number, cardW = 337, gapW = 16) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setAvailableWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rawCols = availableWidth > 0
    ? Math.max(1, Math.floor((availableWidth + gapW) / (cardW + gapW)))
    : 3;
  const maxCols = availableWidth > 0 ? Math.min(4, Math.max(1, rawCols)) : 3;
  const cols = Math.min(maxCols, itemCount || 1);
  const isFullWidth = maxCols <= 1;
  const gridWidth = cols * cardW + (cols - 1) * gapW;

  return { gridRef, cols, isFullWidth, gridWidth, cardW, gapW };
}
