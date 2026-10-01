import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-sans", subsets: ["latin"], weight: ["500", "600", "700"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["500", "700", "800"] });

export const metadata: Metadata = {
  title: "dontfckmothernature",
  description: "The water, energy and CO₂ behind your Claude Code and Codex usage, and a checklist to pay it back.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable}`}>
      <body>
        {children}
        <footer className="site-foot">
          Created by: Vedant Karle (<a href="https://vedantkarle.in" target="_blank" rel="noopener noreferrer">vedantkarle.in</a>)
        </footer>
      </body>
    </html>
  );
}
