// Converts token counts into energy, CO2e and water.
//
//   weighted = output + input·r_in + cache_write·r_in·CACHE_WRITE + cache_read·r_in·r_cache
//   Wh       = weighted / 1000 × e_out(tier)     e_out is facility-level, PUE included
//   kg CO2   = kWh × grid g/kWh / 1000           US data-centre regions, location-based
//   L water  = kWh × (site WUE / PUE + off-site water per kWh generated)
//
// Every factor has a low / mid / high value (researched 1 Oct 2026, see /method):
//   e_out    ML.ENERGY v3 at batch ≥128, DeepSeek production, Oviedo et al. P75 as the high
//   r_in     prefill vs decode serving throughput (DeepSeek, SGLang, TRT-LLM), not API prices
//   r_cache  first-principles: attention over cached context plus KV reads per output token
//   grid     eGRID2023: Virginia / blend / Ohio-Indiana-Iowa
//   water    AWS Virginia / fleet blend / Google Iowa, with Li et al. off-site water
//
// The displayed range does not put every factor at its extreme at once. Each factor is moved to its
// low or high on its own, and the effects are combined as a root-sum-square in log space, the usual
// way to combine independent uncertainties.

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

// Wh per 1K output tokens, facility-level.
export const TIERS = {
  haiku:  { label: "Claude Haiku",      whPer1kOut: { low: 0.06, mid: 0.13, high: 0.35 } },
  sonnet: { label: "Claude Sonnet",     whPer1kOut: { low: 0.20, mid: 0.45, high: 1.2 } },
  opus:   { label: "Claude Opus",       whPer1kOut: { low: 0.30, mid: 0.70, high: 2.0 } },
  mini:   { label: "GPT mini",          whPer1kOut: { low: 0.10, mid: 0.25, high: 0.60 } },
  gpt5:   { label: "GPT-5 / 5.1",       whPer1kOut: { low: 0.15, mid: 0.35, high: 1.0 } },
  gpt52:  { label: "GPT-5.2 / 5.3",     whPer1kOut: { low: 0.20, mid: 0.45, high: 1.2 } },
  gpt55:  { label: "GPT-5.5 and newer", whPer1kOut: { low: 0.30, mid: 0.70, high: 2.0 } },
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

export const R_IN: Record<Band, number> = { low: 0.25, mid: 0.40, high: 0.60 };
export const R_CACHE_READ: Record<Band, number> = { low: 0.02, mid: 0.05, high: 0.075 };
export const CACHE_WRITE = 1.0; // writing KV costs about the same as a fresh prefill token
export const CARBON_G_PER_KWH: Record<Band, number> = { low: 270, mid: 350, high: 420 };
export const WATER_L_PER_KWH: Record<Band, number> = {
  low: 0.06 / 1.15 + 2.385,
  mid: 0.30 / 1.12 + 3.142,
  high: 0.94 + 3.104,
};

type Factors = { eOut: Band; rIn: Band; rCache: Band; grid: Band; water: Band };
const MID: Factors = { eOut: "mid", rIn: "mid", rCache: "mid", grid: "mid", water: "mid" };
const FACTOR_KEYS = Object.keys(MID) as (keyof Factors)[];

function whAt(model: string, t: TokenCounts, f: Factors): number {
  const rIn = R_IN[f.rIn];
  const weighted =
    t.output_tokens +
    t.input_tokens * rIn +
    t.cache_write_tokens * rIn * CACHE_WRITE +
    t.cache_read_tokens * rIn * R_CACHE_READ[f.rCache];
  return (weighted / 1000) * TIERS[tierFor(model)].whPer1kOut[f.eOut];
}

function impactAt(rows: (TokenCounts & { model: string })[], f: Factors): Impact {
  const kwh = rows.reduce((s, r) => s + whAt(r.model, r, f), 0) / 1000;
  return { energy: kwh, co2: (kwh * CARBON_G_PER_KWH[f.grid]) / 1000, water: kwh * WATER_L_PER_KWH[f.water] };
}

export function usageImpact(rows: (TokenCounts & { model: string })[]): Record<Band, Impact> {
  const mid = impactAt(rows, MID);
  const low = { ...mid };
  const high = { ...mid };
  for (const metric of ["energy", "co2", "water"] as const) {
    if (mid[metric] <= 0) continue;
    let down = 0;
    let up = 0;
    for (const k of FACTOR_KEYS) {
      down += Math.log(mid[metric] / impactAt(rows, { ...MID, [k]: "low" })[metric]) ** 2;
      up += Math.log(impactAt(rows, { ...MID, [k]: "high" })[metric] / mid[metric]) ** 2;
    }
    low[metric] = mid[metric] / Math.exp(Math.sqrt(down));
    high[metric] = mid[metric] * Math.exp(Math.sqrt(up));
  }
  return { low, mid, high };
}
