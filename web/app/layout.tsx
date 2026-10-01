import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-sans", subsets: ["latin"], weight: ["500", "600", "700"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["500", "700", "800"] });

const SITE_URL = "https://dontfckmothernature.vercel.app";
const DESCRIPTION = "The water, energy and CO₂ behind your Claude Code and Codex usage, and a checklist to pay it back.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "dontfckmothernature", template: "%s · dontfckmothernature" },
  description: DESCRIPTION,
  authors: [{ name: "Vedant Karle", url: "https://vedantkarle.in" }],
  creator: "Vedant Karle",
  openGraph: { type: "website", siteName: "dontfckmothernature", url: SITE_URL, title: "dontfckmothernature", description: DESCRIPTION, locale: "en_US" },
  twitter: { card: "summary_large_image", title: "dontfckmothernature", description: DESCRIPTION },
  alternates: { canonical: SITE_URL },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable}`}>
      <body>
        {children}
        <footer className="site-foot">
          Created by: Vedant Karle (<a href="https://vedantkarle.in" target="_blank" rel="noopener noreferrer">vedantkarle.in</a>) · <a href="/privacy">Privacy</a> · <a href="/method">Method</a>
        </footer>
      </body>
    </html>
  );
}
