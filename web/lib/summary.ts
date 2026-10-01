import "server-only";
import { db, type Profile } from "./db";
import { tierFor, tierLabel, usageImpact, type Band, type Impact, type TokenCounts } from "./footprint";
import { computeSavings, type OffsetLog, type SavingsResult } from "./savings";

export type UsageRow = TokenCounts & { source: "claude" | "codex"; model: string; first_at: string; last_at: string };

export type Summary = {
  country: string;
  shareSlug: string | null;
  used: Record<Band, Impact>;
  saved: SavingsResult;
  balance: Record<Band, Impact>;
  byModel: { model: string; tier: string; source: string; tokens: number; energy: number }[];
  firstAt: string | null;
  lastAt: string | null;
  logs: OffsetLog[];
};

function minus(a: Impact, b: Impact): Impact {
  return { water: b.water - a.water, energy: b.energy - a.energy, co2: b.co2 - a.co2 };
}

export async function loadSummary(profile: Profile, today: string): Promise<Summary> {
  const cols = "source, model, input_tokens, output_tokens, cache_write_tokens, cache_read_tokens, cache_x_new, cache_x_out, first_at, last_at";
  // Lifetime usage = rolled-up totals + the per-day rows still inside the 35-day window.
  const [totals, daily, offsets] = await Promise.all([
    db().from("usage_totals").select(cols).eq("user_id", profile.id),
    db().from("usage_daily").select(cols).eq("user_id", profile.id),
    db()
      .from("offset_logs")
      .select("id, kind, action_id, quantity, factor, amount, note, logged_on")
      .eq("user_id", profile.id)
      .order("logged_on", { ascending: false })
      .order("id", { ascending: false }),
  ]);
  for (const r of [totals, daily, offsets]) if (r.error) throw r.error;

  const rows = [...(totals.data ?? []), ...(daily.data ?? [])].map((r) => ({
    ...r,
    input_tokens: Number(r.input_tokens),
    output_tokens: Number(r.output_tokens),
    cache_write_tokens: Number(r.cache_write_tokens),
    cache_read_tokens: Number(r.cache_read_tokens),
    cache_x_new: Number(r.cache_x_new),
    cache_x_out: Number(r.cache_x_out),
  })) as UsageRow[];
  const logs = ((offsets.data ?? []) as OffsetLog[]).map((l) => ({
    ...l,
    quantity: Number(l.quantity),
    amount: l.amount == null ? null : Number(l.amount),
  }));

  const used = usageImpact(rows);
  const saved = computeSavings(logs, profile.country, today);
  // Savings carry no uncertainty band of their own, so the band only applies to usage.
  const balance = {
    low: minus(used.low, saved.total),
    mid: minus(used.mid, saved.total),
    high: minus(used.high, saved.total),
  };

  const models = new Map<string, Summary["byModel"][number]>();
  for (const r of rows) {
    const key = `${r.source}:${r.model}`;
    const m = models.get(key) ?? { model: r.model, tier: tierLabel(tierFor(r.model)), source: r.source, tokens: 0, energy: 0 };
    m.tokens += r.input_tokens + r.output_tokens + r.cache_write_tokens + r.cache_read_tokens;
    m.energy += usageImpact([r]).mid.energy;
    models.set(key, m);
  }

  const times = rows.flatMap((r) => [r.first_at, r.last_at]).sort();
  return {
    country: profile.country,
    shareSlug: profile.share_slug,
    used,
    saved,
    balance,
    byModel: [...models.values()].sort((a, b) => b.energy - a.energy),
    firstAt: times[0] ?? null,
    lastAt: times[times.length - 1] ?? null,
    logs,
  };
}
