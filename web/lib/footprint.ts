// Converts token counts into energy, CO2e and water.
//
// Method (see research notes in README):
//   T_eq (thousands) = output + input·r_in + cache_write·r_in·1.25 + cache_read·r_in·r_cr
//   Wh   = T_eq × e_out(tier)                 e_out is facility-level, PUE already included
//   gCO2 = kWh × carbon intensity of the data centre grid (location-based)
//   L    = kWh × (WUE_site / PUE + off-site water per kWh generated)
//
// Every coefficient has a low / mid / high value. Low uses all lows, high uses all highs.

export type Band = "low" | "mid" | "high";
export const BANDS: Band[] = ["low", "mid", "high"];

export type TokenCounts = {
  input_tokens: number;
  output_tokens: number;
  cache_write_tokens: number;
  cache_read_tokens: number;
};

export type Impact = { water: number; energy: number; co2: number }; // L, kWh, kg

type Tier = { label: string; whPer1kOut: Record<Band, number> };

// Wh per 1K output tokens. Active-parameter estimates from EcoLogits, energy from Epoch AI's method.
export const TIERS = {
  haiku:  { label: "Claude Haiku",       whPer1kOut: { low: 0.06, mid: 0.13, high: 0.21 } },
  sonnet: { label: "Claude Sonnet",      whPer1kOut: { low: 0.26, mid: 0.52, high: 2.3 } },
  opus:   { label: "Claude Opus",        whPer1kOut: { low: 0.40, mid: 0.79, high: 6.2 } },
  mini:   { label: "GPT mini",           whPer1kOut: { low: 0.15, mid: 0.28, high: 0.40 } },
  gpt5:   { label: "GPT-5 / 5.1",        whPer1kOut: { low: 0.18, mid: 0.35, high: 1.9 } },
  gpt52:  { label: "GPT-5.2 / 5.3",      whPer1kOut: { low: 0.25, mid: 0.50, high: 2.3 } },
  gpt55:  { label: "GPT-5.5 and newer",  whPer1kOut: { low: 0.53, mid: 1.15, high: 8.3 } },
} satisfies Record<string, Tier>;

export type TierId = keyof typeof TIERS;

export function tierFor(model: string): TierId {
  const m = model.toLowerCase();
  if (m.includes("haiku")) return "haiku";
  if (m.includes("sonnet")) return "sonnet";
  if (m.includes("opus") || m.includes("fable")) return "opus";
  if (m.startsWith("claude")) return "sonnet";
  if (m.includes("mini") || m.includes("nano")) return "mini";
  if (/gpt-5(\.1)?(-|$)/.test(m)) return "gpt5";
  if (/gpt-5\.[23]/.test(m)) return "gpt52";
  if (/gpt-5\.[4-9]|gpt-[6-9]/.test(m)) return "gpt55";
  return "gpt52";
}

export function tierLabel(id: TierId) {
  return TIERS[id].label;
}

// Input tokens cost less than output; weights follow API price ratios.
export const R_IN_ANTHROPIC: Record<Band, number> = { low: 0.10, mid: 0.20, high: 0.35 };
export const R_IN_OPENAI: Record<Band, number> = { low: 0.10, mid: 0.125, high: 0.35 };
export const R_CACHE_READ: Record<Band, number> = { low: 0.05, mid: 0.10, high: 0.20 };
export const CACHE_WRITE = 1.25;

// Data centre grid, g CO2e per kWh: eGRID Virginia / US average / world (Ember 2025).
export const CARBON_G_PER_KWH: Record<Band, number> = { low: 269, mid: 348, high: 458 };

// Water per kWh = on-site WUE / PUE + off-site water for generation.
export const WATER_L_PER_KWH: Record<Band, number> = {
  low: 0.15 / 1.09 + 3.14,
  mid: 0.30 / 1.15 + 4.35,
  high: 1.15 / 1.17 + 5.11,
};

export function energyWh(model: string, t: TokenCounts, band: Band): number {
  const tier = TIERS[tierFor(model)];
  const rIn = (model.toLowerCase().startsWith("claude") ? R_IN_ANTHROPIC : R_IN_OPENAI)[band];
  const teq =
    t.output_tokens +
    t.input_tokens * rIn +
    t.cache_write_tokens * rIn * CACHE_WRITE +
    t.cache_read_tokens * rIn * R_CACHE_READ[band];
  return (teq / 1000) * tier.whPer1kOut[band];
}

export function impactFromWh(wh: number, band: Band): Impact {
  const kwh = wh / 1000;
  return {
    energy: kwh,
    co2: (kwh * CARBON_G_PER_KWH[band]) / 1000,
    water: kwh * WATER_L_PER_KWH[band],
  };
}

export function usageImpact(rows: (TokenCounts & { model: string })[]): Record<Band, Impact> {
  const out = {} as Record<Band, Impact>;
  for (const band of BANDS) {
    const wh = rows.reduce((sum, r) => sum + energyWh(r.model, r, band), 0);
    out[band] = impactFromWh(wh, band);
  }
  return out;
}
