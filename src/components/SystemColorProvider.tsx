"use client";

import { useEffect, useState, useCallback, useMemo, createContext, useContext } from "react";

type SystemColors = {
  colorBg0: string;
  colorBg0Dark: string;
  colorBg0Contrast: string;
  colorBg0ContrastDark: string;
  colorBg1: string;
  colorBg1Dark: string;
  colorBg2: string;
  colorBg2Dark: string;
  colorText0: string;
  colorText0Dark: string;
  colorText0Contrast: string;
  colorText0ContrastDark: string;
  colorText1: string;
  colorText1Dark: string;
  colorText2: string;
  colorText2Dark: string;
  colorText3: string;
  colorText3Dark: string;
  colorIcon0: string;
  colorIcon0Dark: string;
  colorIcon0Contrast: string;
  colorIcon0ContrastDark: string;
  colorIcon1: string;
  colorIcon1Dark: string;
  colorIcon2: string;
  colorIcon2Dark: string;
  colorIcon3: string;
  colorIcon3Dark: string;
  colorAccent0: string;
  colorAccent0Dark: string;
  colorAccent0Contrast: string;
  colorAccent0ContrastDark: string;
  colorAccent1: string;
  colorAccent1Dark: string;
  colorAccent1Contrast: string;
  colorAccent1ContrastDark: string;
  colorSuccess: string;
  colorSuccessDark: string;
  colorSuccessContrast: string;
  colorSuccessContrastDark: string;
  colorPending: string;
  colorPendingDark: string;
  colorPendingContrast: string;
  colorPendingContrastDark: string;
  colorError: string;
  colorErrorDark: string;
  colorErrorContrast: string;
  colorErrorContrastDark: string;
  colorOverlay: string;
  colorOverlayDark: string;
  colorFormBg: string;
  colorFormBgDark: string;
  colorFormText0: string;
  colorFormText0Dark: string;
  colorFormText1: string;
  colorFormText1Dark: string;
};

/** Resolved colors for the current theme (light or dark) */
export type ResolvedColors = {
  bg0: string;
  bg0Contrast: string;
  bg1: string;
  bg2: string;
  text0: string;
  text0Contrast: string;
  text1: string;
  text2: string;
  text3: string;
  icon0: string;
  icon0Contrast: string;
  icon1: string;
  icon2: string;
  icon3: string;
  accent0: string;
  accent0Contrast: string;
  accent1: string;
  accent1Contrast: string;
  success: string;
  successContrast: string;
  pending: string;
  pendingContrast: string;
  error: string;
  errorContrast: string;
  overlay: string;
  formBg: string;
  formText0: string;
  formText1: string;
};

export type ThemePreference = "system" | "light" | "dark";

type ThemeContextValue = {
  isDark: boolean;
  preference: ThemePreference;
  toggle: () => void;
  setPreference: (pref: ThemePreference) => void;
  /** Resolved color values for the active theme — use in JS/inline styles */
  colors: ResolvedColors;
};

const DEFAULT_COLORS: ResolvedColors = {
  bg0: "#FFFFFF",
  bg0Contrast: "#000000",
  bg1: "#F6F6F5",
  bg2: "#000000",
  text0: "#000000",
  text0Contrast: "#FFFFFF",
  text1: "#000000",
  text2: "#000000",
  text3: "#000000",
  icon0: "#000000",
  icon0Contrast: "#FFFFFF",
  icon1: "#000000",
  icon2: "#000000",
  icon3: "#000000",
  accent0: "#000000",
  accent0Contrast: "#FFFFFF",
  accent1: "#000000",
  accent1Contrast: "#FFFFFF",
  success: "#98CA6D",
  successContrast: "#FFFFFF",
  pending: "#FFC904",
  pendingContrast: "#000000",
  error: "#FF4105",
  errorContrast: "#FFFFFF",
  overlay: "#000000",
  formBg: "#FFFFFF",
  formText0: "#000000",
  formText1: "#6B7280",
};

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  preference: "system",
  toggle: () => {},
  setPreference: () => {},
  colors: DEFAULT_COLORS,
});

export function useTheme() {
  return useContext(ThemeContext);
}

/** Convenience hook — returns only the resolved system colors */
export function useSystemColors() {
  return useContext(ThemeContext).colors;
}

const LS_KEY = "theme-preference";

function getStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(LS_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "system";
}

function getSystemPreference(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(isDark: boolean, colors: SystemColors): ResolvedColors {
  return {
    bg0: isDark ? colors.colorBg0Dark : colors.colorBg0,
    bg0Contrast: isDark ? colors.colorBg0ContrastDark : colors.colorBg0Contrast,
    bg1: isDark ? colors.colorBg1Dark : colors.colorBg1,
    bg2: isDark ? colors.colorBg2Dark : colors.colorBg2,
    text0: isDark ? colors.colorText0Dark : colors.colorText0,
    text0Contrast: isDark ? colors.colorText0ContrastDark : colors.colorText0Contrast,
    text1: isDark ? colors.colorText1Dark : colors.colorText1,
    text2: isDark ? colors.colorText2Dark : colors.colorText2,
    text3: isDark ? colors.colorText3Dark : colors.colorText3,
    icon0: isDark ? colors.colorIcon0Dark : colors.colorIcon0,
    icon0Contrast: isDark ? colors.colorIcon0ContrastDark : colors.colorIcon0Contrast,
    icon1: isDark ? colors.colorIcon1Dark : colors.colorIcon1,
    icon2: isDark ? colors.colorIcon2Dark : colors.colorIcon2,
    icon3: isDark ? colors.colorIcon3Dark : colors.colorIcon3,
    accent0: isDark ? colors.colorAccent0Dark : colors.colorAccent0,
    accent0Contrast: isDark ? colors.colorAccent0ContrastDark : colors.colorAccent0Contrast,
    accent1: isDark ? colors.colorAccent1Dark : colors.colorAccent1,
    accent1Contrast: isDark ? colors.colorAccent1ContrastDark : colors.colorAccent1Contrast,
    success: isDark ? colors.colorSuccessDark : colors.colorSuccess,
    successContrast: isDark ? colors.colorSuccessContrastDark : colors.colorSuccessContrast,
    pending: isDark ? colors.colorPendingDark : colors.colorPending,
    pendingContrast: isDark ? colors.colorPendingContrastDark : colors.colorPendingContrast,
    error: isDark ? colors.colorErrorDark : colors.colorError,
    errorContrast: isDark ? colors.colorErrorContrastDark : colors.colorErrorContrast,
    overlay: isDark ? colors.colorOverlayDark : colors.colorOverlay,
    formBg: isDark ? colors.colorFormBgDark : colors.colorFormBg,
    formText0: isDark ? colors.colorFormText0Dark : colors.colorFormText0,
    formText1: isDark ? colors.colorFormText1Dark : colors.colorFormText1,
  };
}

function applyCSS(resolved: ResolvedColors) {
  const root = document.documentElement;
  root.style.setProperty("--system-bg0", resolved.bg0);
  root.style.setProperty("--system-bg0-contrast", resolved.bg0Contrast);
  root.style.setProperty("--system-bg1", resolved.bg1);
  root.style.setProperty("--system-bg2", resolved.bg2);
  root.style.setProperty("--system-text0", resolved.text0);
  root.style.setProperty("--system-text0-contrast", resolved.text0Contrast);
  root.style.setProperty("--system-text1", resolved.text1);
  root.style.setProperty("--system-text2", resolved.text2);
  root.style.setProperty("--system-text3", resolved.text3);
  root.style.setProperty("--system-icon0", resolved.icon0);
  root.style.setProperty("--system-icon0-contrast", resolved.icon0Contrast);
  root.style.setProperty("--system-icon1", resolved.icon1);
  root.style.setProperty("--system-icon2", resolved.icon2);
  root.style.setProperty("--system-icon3", resolved.icon3);
  root.style.setProperty("--system-accent0", resolved.accent0);
  root.style.setProperty("--system-accent0-contrast", resolved.accent0Contrast);
  root.style.setProperty("--system-accent1", resolved.accent1);
  root.style.setProperty("--system-accent1-contrast", resolved.accent1Contrast);
  root.style.setProperty("--system-success", resolved.success);
  root.style.setProperty("--system-success-contrast", resolved.successContrast);
  root.style.setProperty("--system-pending", resolved.pending);
  root.style.setProperty("--system-pending-contrast", resolved.pendingContrast);
  root.style.setProperty("--system-error", resolved.error);
  root.style.setProperty("--system-error-contrast", resolved.errorContrast);
  root.style.setProperty("--system-overlay", resolved.overlay);
  root.style.setProperty("--system-form-bg", resolved.formBg);
  root.style.setProperty("--system-form-text0", resolved.formText0);
  root.style.setProperty("--system-form-text1", resolved.formText1);
}

function isDarkForPreference(pref: ThemePreference): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return getSystemPreference();
}

export function SystemColorProvider({
  children,
  ...colors
}: SystemColors & { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [mounted, setMounted] = useState(false);
  // Always start as light to match SSR; the blocking script handles visual appearance via CSS vars
  const isDark = useMemo(() => mounted ? isDarkForPreference(preference) : false, [preference, mounted]);
  const resolved = useMemo(() => resolve(isDark, colors), [isDark, colors]);

  // Initialise on mount
  useEffect(() => {
    const stored = getStoredPreference();
    setPreference(stored);
    setMounted(true);
    applyCSS(resolve(isDarkForPreference(stored), colors));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep CSS vars in sync when resolved changes — skip before mount since the blocking script already set them
  useEffect(() => {
    if (!mounted) return;
    applyCSS(resolved);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, [resolved, isDark, mounted]);

  // Listen for system preference changes (only when preference is "system")
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (preference !== "system") return;
      // Force re-evaluate by toggling preference state
      setPreference("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [preference]);

  const setPref = useCallback((next: ThemePreference) => {
    if (next === "system") {
      localStorage.removeItem(LS_KEY);
    } else {
      localStorage.setItem(LS_KEY, next);
    }
    setPreference(next);
  }, []);

  // Cycle: system → dark → light → system
  const toggle = useCallback(() => {
    setPreference((prev) => {
      let next: ThemePreference;
      if (prev === "system") {
        next = getSystemPreference() ? "light" : "dark";
      } else if (prev === "dark") {
        next = "light";
      } else {
        next = "system";
      }
      if (next === "system") {
        localStorage.removeItem(LS_KEY);
      } else {
        localStorage.setItem(LS_KEY, next);
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ isDark, preference, toggle, setPreference: setPref, colors: resolved }), [isDark, preference, toggle, setPref, resolved]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
