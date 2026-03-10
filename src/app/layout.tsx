import type { Metadata } from "next";
import { Inter, Funnel_Sans } from "next/font/google";
import "./globals.css";

// FontAwesome: prevent large icon flash on page load
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
config.autoAddCss = false;

const inter = Inter({
  subsets: ["latin"],
});

export const funnelSans = Funnel_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-funnel-sans",
});

export const metadata: Metadata = {
  title: "Introkrati",
  description: "Stil spørgsmål til din politiker og stem på de vigtigste.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da">
      <body className={`${inter.className} ${funnelSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
