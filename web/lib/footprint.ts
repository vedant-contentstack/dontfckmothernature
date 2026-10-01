// Converts token counts into energy, CO2e and water.
//
//   weighted = output + (input + cache_write)·r_in
//   Wh       = weighted / 1000 × e_out(tier)     e_out is facility-level, PUE included
//            + cache Wh                          see below
//   cache Wh = (cache_x_new·J_new + cache_x_out·J_out) × size scale × facility overhead / 3600
//              cache_x_new = Σ over requests of cache_read × new tokens, cache_x_out = Σ cache_read × output
//   kg CO2   = kWh × grid g/kWh / 1000           US data-centre regions, location-based
//   L water  = kWh × (site WUE / PUE + off-site water per kWh generated)
//
// Every factor has a low / mid / high value (researched 1 Oct 2026, see /method):
//   e_out    ML.ENERGY v3 at batch ≥128, DeepSeek production, Oviedo et al. P75 as the high
//   r_in     prefill vs decode serving throughput (DeepSeek, SGLang, TRT-LLM), not API prices
//   cache    first-principles, per request: new tokens attending to cached ones (MLA ~5 MFLOP per pair,
//            GQA-405B ~8 MFLOP) and each output token reading cached KV (MLA ~70 KB, GQA ~516 KB) on H100
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
  cache_x_new?: number; // Σ cache_read × (input + cache_write) per request
  cache_x_out?: number; // Σ cache_read × output per request
};

// When per-request products are missing, assume a typical Claude Code request.
export const TYPICAL_REQUEST = { fresh: 1400, output: 350 };

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
export const CACHE_WRITE = 1.0; // writing KV costs about the same as a fresh prefill token

// GPU joules per (new token, cached token) pair and per (output token, cached token) pair, for an
// Opus-size model. Low: sparse or compressed attention. Mid: DeepSeek-style MLA. High: Llama-405B GQA.
export const CACHE_J_PER_PAIR: Record<Band, { fresh: number; output: number }> = {
  low: { fresh: 2.2e-6, output: 3.7e-6 },
  mid: { fresh: 8.9e-6, output: 14.7e-6 },
  high: { fresh: 14e-6, output: 108e-6 },
};
export const FACILITY_OVERHEAD = 1.7; // GPU energy to facility energy (host, idle, PUE), from Google's split
const OPUS_MID = 0.70;
export const CARBON_G_PER_KWH: Record<Band, number> = { low: 270, mid: 350, high: 420 };
export const WATER_L_PER_KWH: Record<Band, number> = {
  low: 0.06 / 1.15 + 2.385,
  mid: 0.30 / 1.12 + 3.142,
  high: 0.94 + 3.104,
};

type Factors = { eOut: Band; rIn: Band; cache: Band; grid: Band; water: Band };
const MID: Factors = { eOut: "mid", rIn: "mid", cache: "mid", grid: "mid", water: "mid" };
const FACTOR_KEYS = Object.keys(MID) as (keyof Factors)[];

function whAt(model: string, t: TokenCounts, f: Factors): number {
  const tier = TIERS[tierFor(model)];
  const weighted = t.output_tokens + (t.input_tokens + t.cache_write_tokens * CACHE_WRITE) * R_IN[f.rIn];
  const xNew = t.cache_x_new ?? t.cache_read_tokens * TYPICAL_REQUEST.fresh;
  const xOut = t.cache_x_out ?? t.cache_read_tokens * TYPICAL_REQUEST.output;
  const j = CACHE_J_PER_PAIR[f.cache];
  // Attention cost grows with model size, so scale from Opus by the tier's mid energy per token.
  const cacheWh = ((xNew * j.fresh + xOut * j.output) * FACILITY_OVERHEAD * (tier.whPer1kOut.mid / OPUS_MID)) / 3600;
  return (weighted / 1000) * tier.whPer1kOut[f.eOut] + cacheWh;
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
