import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Link-preview images for the site's own pages (share cards for users live in lib/card.tsx).
export const SOCIAL_SIZE = { width: 1200, height: 630 };

const font = (file: string) => readFile(join(process.cwd(), "assets", file));

const CHIPS = [
  { label: "Water", bg: "#7CC4FF", d: "M12 2.8c-.3.3-7 7.6-7 12.3a7 7 0 0 0 14 0c0-4.7-6.7-12-7-12.3Z" },
  { label: "Energy", bg: "#FFD24D", d: "M13.4 2 4.6 13.6h6.2L9.9 22l8.8-11.8h-6.2L13.4 2Z" },
  { label: "CO₂", bg: "#7EE0A1", d: "M7.2 19h10.2a4.3 4.3 0 0 0 .4-8.6A6 6 0 0 0 6.4 9.6 4.7 4.7 0 0 0 7.2 19Z" },
];

export async function renderSocial({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) {
  const [sans, mono] = await Promise.all([font("Geist-wght-700.ttf"), font("JetBrains-Mono-wght-800.ttf")]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FFFDF5", color: "#111", padding: "56px 64px", fontFamily: "Sans" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: -0.6 }}>
            dontfckmothernature<span style={{ color: "#16A34A", marginLeft: -10 }}>_</span>
          </div>
          <div style={{ display: "flex", fontFamily: "Mono", fontSize: 18, letterSpacing: 2, textTransform: "uppercase" }}>{eyebrow}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", marginBottom: "auto" }}>
          <div style={{ display: "flex", fontSize: 76, lineHeight: 1.02, letterSpacing: -3, maxWidth: 980 }}>{title}</div>
          <div style={{ display: "flex", fontSize: 30, color: "#55524A", marginTop: 26, maxWidth: 900, lineHeight: 1.3 }}>{note}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 22 }}>
            {CHIPS.map((c) => (
              <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 12, border: "4px solid #111", boxShadow: "7px 7px 0 #111", background: "#FFFDF5", padding: "12px 18px 12px 12px" }}>
                <div style={{ display: "flex", width: 40, height: 40, alignItems: "center", justifyContent: "center", background: c.bg, border: "3px solid #111" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24"><path d={c.d} fill="#111" /></svg>
                </div>
                <span style={{ fontFamily: "Mono", fontSize: 20, letterSpacing: 1.5, textTransform: "uppercase" }}>{c.label}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontFamily: "Mono", fontSize: 18, letterSpacing: 1.5, textTransform: "uppercase" }}>For Claude Code + Codex</div>
        </div>
      </div>
    ),
    {
      ...SOCIAL_SIZE,
      fonts: [
        { name: "Sans", data: sans, weight: 700, style: "normal" },
        { name: "Mono", data: mono, weight: 800, style: "normal" },
      ],
    },
  );
}
