import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { Impact } from "./footprint";
import { FACTORS, HEADLINE, num, signed, type BalanceState, type Factor } from "./format";

export const CARD_SIZE = { width: 1200, height: 630 };

const font = (file: string) => readFile(join(process.cwd(), "assets", file));

const ICON: Record<Factor, { d: string; bg: string }> = {
  water: { d: "M12 2.8c-.3.3-7 7.6-7 12.3a7 7 0 0 0 14 0c0-4.7-6.7-12-7-12.3Z", bg: "#7CC4FF" },
  energy: { d: "M13.4 2 4.6 13.6h6.2L9.9 22l8.8-11.8h-6.2L13.4 2Z", bg: "#FFD24D" },
  co2: { d: "M7.2 19h10.2a4.3 4.3 0 0 0 .4-8.6A6 6 0 0 0 6.4 9.6 4.7 4.7 0 0 0 7.2 19Z", bg: "#7EE0A1" },
};
const BAL_BG: Record<BalanceState, string> = { debt: "#FF9EBB", even: "#FFD24D", credit: "#7EE0A1" };

function Panel({ title, values, sign, bg, grow }: { title: string; values: Impact; sign?: boolean; bg: string; grow: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flexGrow: grow, flexBasis: 0, background: bg, border: "4px solid #111", boxShadow: "8px 8px 0 #111", padding: "26px 26px 30px" }}>
      <div style={{ display: "flex", fontFamily: "Mono", fontWeight: 800, fontSize: 16, letterSpacing: 1.3, textTransform: "uppercase", paddingBottom: 12, borderBottom: "3px solid #111", marginBottom: 10 }}>
        {title}
      </div>
      {FACTORS.map((f) => (
        <div key={f.key} style={{ display: "flex", alignItems: "center", marginTop: 26 }}>
          <div style={{ display: "flex", width: 46, height: 46, alignItems: "center", justifyContent: "center", background: ICON[f.key].bg, border: "3px solid #111", marginRight: 14 }}>
            <svg width="24" height="24" viewBox="0 0 24 24"><path d={ICON[f.key].d} fill="#111" /></svg>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", fontFamily: "Mono", fontWeight: sign ? 800 : 700, fontSize: sign ? 42 : 39, letterSpacing: -0.7 }}>
            {sign ? signed(values[f.key]) : num(values[f.key])}
            <span style={{ fontWeight: 500, fontSize: 16, marginLeft: 7, color: sign ? "#111" : "#55524A", letterSpacing: 0 }}>{f.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export async function renderCard(d: { used: Impact; saved: Impact; balance: Impact; state: BalanceState; footnote: string }) {
  const [sans, mono700, mono800, mono500] = await Promise.all([
    font("Geist-wght-700.ttf"),
    font("JetBrains-Mono-wght-700.ttf"),
    font("JetBrains-Mono-wght-800.ttf"),
    font("JetBrains-Mono-wght-500.ttf"),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FFFDF5", color: "#111", padding: "46px 53px 40px", fontFamily: "Sans" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: -0.5 }}>
            dontfckmothernature<span style={{ color: "#16A34A", marginLeft: -9 }}>_</span>
          </div>
          <div style={{ display: "flex", fontSize: 44, letterSpacing: -1.6, lineHeight: 1 }}>{HEADLINE[d.state]}</div>
        </div>
        <div style={{ display: "flex", gap: 26, marginTop: 40 }}>
          <Panel title="Used by my AI" values={d.used} bg="#FFFDF5" grow={1} />
          <Panel title="Saved by me" values={d.saved} bg="#FFFDF5" grow={1} />
          <Panel title="Balance" values={d.balance} sign bg={BAL_BG[d.state]} grow={1.15} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", fontFamily: "Mono", fontWeight: 700, fontSize: 14, letterSpacing: 1.1, textTransform: "uppercase" }}>
          <span>{d.footnote}</span>
          <span>dontfckmothernature</span>
        </div>
      </div>
    ),
    {
      ...CARD_SIZE,
      fonts: [
        { name: "Sans", data: sans, weight: 700, style: "normal" },
        { name: "Mono", data: mono700, weight: 700, style: "normal" },
        { name: "Mono", data: mono800, weight: 800, style: "normal" },
        { name: "Mono", data: mono500, weight: 500, style: "normal" },
      ],
    },
  );
}

export const EXAMPLE = {
  used: { water: 31.0, energy: 6.8, co2: 2.4 },
  saved: { water: 18.6, energy: 3.7, co2: 1.0 },
  balance: { water: -12.4, energy: -3.1, co2: -1.4 },
  state: "debt" as BalanceState,
  footnote: "Example · lifetime · Claude Code + Codex · mid estimate",
};
