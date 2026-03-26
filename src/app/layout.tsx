import type { Metadata } from "next";
import { Inter, Figtree } from "next/font/google";
import "./globals.css";
import { SystemColorProvider } from "@/components/SystemColorProvider";
import { getAppSettings } from "@/lib/settings";

// FontAwesome: prevent large icon flash on page load
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
config.autoAddCss = false;

const inter = Inter({
  subsets: ["latin"],
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-figtree",
});

export const metadata: Metadata = {
  title: "Introkrati",
  description: "Stil spørgsmål til din politiker og stem på de vigtigste.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getAppSettings();

  // Build inline blocking script to apply theme before paint
  const colorMap = JSON.stringify({
    light: {
      "--system-bg0": settings.colorBg0, "--system-bg0-contrast": settings.colorBg0Contrast,
      "--system-bg1": settings.colorBg1, "--system-bg2": settings.colorBg2,
      "--system-text0": settings.colorText0, "--system-text0-contrast": settings.colorText0Contrast,
      "--system-text1": settings.colorText1, "--system-text2": settings.colorText2, "--system-text3": settings.colorText3,
      "--system-icon0": settings.colorIcon0, "--system-icon0-contrast": settings.colorIcon0Contrast,
      "--system-icon1": settings.colorIcon1, "--system-icon2": settings.colorIcon2, "--system-icon3": settings.colorIcon3,
      "--system-accent0": settings.colorAccent0, "--system-accent0-contrast": settings.colorAccent0Contrast,
      "--system-accent1": settings.colorAccent1, "--system-accent1-contrast": settings.colorAccent1Contrast,
      "--system-success": settings.colorSuccess, "--system-success-contrast": settings.colorSuccessContrast,
      "--system-pending": settings.colorPending, "--system-pending-contrast": settings.colorPendingContrast,
      "--system-error": settings.colorError, "--system-error-contrast": settings.colorErrorContrast,
      "--system-overlay": settings.colorOverlay,
      "--system-background": settings.colorBg0,
    },
    dark: {
      "--system-bg0": settings.colorBg0Dark, "--system-bg0-contrast": settings.colorBg0ContrastDark,
      "--system-bg1": settings.colorBg1Dark, "--system-bg2": settings.colorBg2Dark,
      "--system-text0": settings.colorText0Dark, "--system-text0-contrast": settings.colorText0ContrastDark,
      "--system-text1": settings.colorText1Dark, "--system-text2": settings.colorText2Dark, "--system-text3": settings.colorText3Dark,
      "--system-icon0": settings.colorIcon0Dark, "--system-icon0-contrast": settings.colorIcon0ContrastDark,
      "--system-icon1": settings.colorIcon1Dark, "--system-icon2": settings.colorIcon2Dark, "--system-icon3": settings.colorIcon3Dark,
      "--system-accent0": settings.colorAccent0Dark, "--system-accent0-contrast": settings.colorAccent0ContrastDark,
      "--system-accent1": settings.colorAccent1Dark, "--system-accent1-contrast": settings.colorAccent1ContrastDark,
      "--system-success": settings.colorSuccessDark, "--system-success-contrast": settings.colorSuccessContrastDark,
      "--system-pending": settings.colorPendingDark, "--system-pending-contrast": settings.colorPendingContrastDark,
      "--system-error": settings.colorErrorDark, "--system-error-contrast": settings.colorErrorContrastDark,
      "--system-overlay": settings.colorOverlayDark,
      "--system-background": settings.colorBg0Dark,
    },
  });

  const themeScript = `(function(){try{var m=${colorMap};var p=localStorage.getItem("theme-preference");var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches);var c=d?m.dark:m.light;var r=document.documentElement;for(var k in c)r.style.setProperty(k,c[k]);r.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();`;

  return (
    <html lang="da" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.className} ${figtree.variable} antialiased`}>
        <SystemColorProvider
          colorBg0={settings.colorBg0}
          colorBg0Dark={settings.colorBg0Dark}
          colorBg0Contrast={settings.colorBg0Contrast}
          colorBg0ContrastDark={settings.colorBg0ContrastDark}
          colorBg1={settings.colorBg1}
          colorBg1Dark={settings.colorBg1Dark}
          colorBg2={settings.colorBg2}
          colorBg2Dark={settings.colorBg2Dark}
          colorText0={settings.colorText0}
          colorText0Dark={settings.colorText0Dark}
          colorText0Contrast={settings.colorText0Contrast}
          colorText0ContrastDark={settings.colorText0ContrastDark}
          colorText1={settings.colorText1}
          colorText1Dark={settings.colorText1Dark}
          colorText2={settings.colorText2}
          colorText2Dark={settings.colorText2Dark}
          colorText3={settings.colorText3}
          colorText3Dark={settings.colorText3Dark}
          colorIcon0={settings.colorIcon0}
          colorIcon0Dark={settings.colorIcon0Dark}
          colorIcon0Contrast={settings.colorIcon0Contrast}
          colorIcon0ContrastDark={settings.colorIcon0ContrastDark}
          colorIcon1={settings.colorIcon1}
          colorIcon1Dark={settings.colorIcon1Dark}
          colorIcon2={settings.colorIcon2}
          colorIcon2Dark={settings.colorIcon2Dark}
          colorIcon3={settings.colorIcon3}
          colorIcon3Dark={settings.colorIcon3Dark}
          colorAccent0={settings.colorAccent0}
          colorAccent0Dark={settings.colorAccent0Dark}
          colorAccent0Contrast={settings.colorAccent0Contrast}
          colorAccent0ContrastDark={settings.colorAccent0ContrastDark}
          colorAccent1={settings.colorAccent1}
          colorAccent1Dark={settings.colorAccent1Dark}
          colorAccent1Contrast={settings.colorAccent1Contrast}
          colorAccent1ContrastDark={settings.colorAccent1ContrastDark}
          colorSuccess={settings.colorSuccess}
          colorSuccessDark={settings.colorSuccessDark}
          colorSuccessContrast={settings.colorSuccessContrast}
          colorSuccessContrastDark={settings.colorSuccessContrastDark}
          colorPending={settings.colorPending}
          colorPendingDark={settings.colorPendingDark}
          colorPendingContrast={settings.colorPendingContrast}
          colorPendingContrastDark={settings.colorPendingContrastDark}
          colorError={settings.colorError}
          colorErrorDark={settings.colorErrorDark}
          colorErrorContrast={settings.colorErrorContrast}
          colorErrorContrastDark={settings.colorErrorContrastDark}
          colorOverlay={settings.colorOverlay}
          colorOverlayDark={settings.colorOverlayDark}
        >
          {children}
        </SystemColorProvider>
      </body>
    </html>
  );
}
